import 'dotenv/config'

const API_BASE = 'https://finnhub.io/api/v1'

function getApiKey(): string {
  const key = process.env['FINNHUB_API_KEY']
  if (!key) throw new Error('FINNHUB_API_KEY must be set in environment variables')
  return key
}

// ─── Cache ────────────────────────────────────────────────────────────────────
interface CacheEntry { data: unknown; timestamp: number; ttl: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 60 * 60 * 1000            // 1 hour  (quotes, dividends)
const LONG_CACHE_TTL = 24 * 60 * 60 * 1000  // 24 hours (candle data)

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > entry.ttl) { cache.delete(key); return null }
  return entry.data as T
}
function setCache(key: string, data: unknown, ttl = CACHE_TTL): void {
  cache.set(key, { data, timestamp: Date.now(), ttl })
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
async function fhFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ ...params, token: getApiKey() })
  const url = `${API_BASE}${endpoint}?${qs}`
  const res = await fetch(url)
  if (res.status === 429) throw new Error('Finnhub rate limit reached (60 req/min). Try again shortly.')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Finnhub API returned ${res.status}${text ? `: ${text}` : ''}`)
  }
  return res.json() as Promise<T>
}

// ─── Finnhub Response Types ───────────────────────────────────────────────────
interface FinnhubQuote {
  c: number  // current price
  o: number  // open
  h: number  // high
  l: number  // low
  pc: number // previous close
  dp: number // percent change
}

interface FinnhubDividend {
  symbol: string
  date: string        // ex-dividend date
  amount: number
  adjustedAmount: number
  currency: string
}

interface FinnhubDividendResponse {
  data: FinnhubDividend[]
  symbol: string
}

interface FinnhubMetric {
  metric: {
    dividendPerShareAnnual?: number
    dividendPerShareTTM?: number
    dividendGrowthRate5Y?: number
    dividendYieldNormalized?: number
  }
}

interface FinnhubCandle {
  c: number[]  // close prices
  t: number[]  // timestamps
  s: string    // status: "ok" | "no_data"
}

// ─── Public interface (matches alphaVantage.ts exports) ──────────────────────

export interface StockQuote {
  symbol: string
  price: number
  open: number
  high: number
  low: number
  volume: number
  changePercent: number
}

export interface DividendEntry {
  exDate: string
  amount: number
}

export async function getQuote(symbol: string): Promise<StockQuote> {
  const cacheKey = `quote:${symbol}`
  const cached = getCached<StockQuote>(cacheKey)
  if (cached) return cached

  const data = await fhFetch<FinnhubQuote>('/quote', { symbol: symbol.toUpperCase() })
  if (data.c == null) throw new Error(`No quote data available for "${symbol}"`)

  const result: StockQuote = {
    symbol,
    price: data.c,
    open: data.o,
    high: data.h,
    low: data.l,
    volume: 0,
    changePercent: data.dp ?? 0,
  }
  setCache(cacheKey, result)
  return result
}

export async function getDividends(_symbol: string): Promise<DividendEntry[]> {

  return []
}

async function getMetrics(symbol: string): Promise<FinnhubMetric['metric']> {
  const cacheKey = `metric:${symbol}`
  const cached = getCached<FinnhubMetric['metric']>(cacheKey)
  if (cached) return cached

  const data = await fhFetch<FinnhubMetric>('/stock/metric', {
    symbol: symbol.toUpperCase(),
    metric: 'all',
  })

  setCache(cacheKey, data.metric ?? {})
  return data.metric ?? {}
}

export async function getAnnualDividend(symbol: string): Promise<number> {
  const m = await getMetrics(symbol)
  return m.dividendPerShareAnnual ?? m.dividendPerShareTTM ?? 0
}

export async function getDividendGrowthRate(symbol: string): Promise<number> {
  const m = await getMetrics(symbol)
  // dividendGrowthRate5Y is in percent (e.g. 5.2 means 5.2%)
  const raw = m.dividendGrowthRate5Y
  if (raw == null || raw <= 0) return 2
  return Math.round(Math.min(25, raw) * 100) / 100
}

export async function getStockGrowthRate(symbol: string): Promise<number> {
  const cacheKey = `candles:${symbol}`
  const cached = getCached<number>(cacheKey)
  if (cached !== null) return cached

  const to = Math.floor(Date.now() / 1000)
  const from = Math.floor(Date.now() / 1000) - 5 * 365.25 * 24 * 60 * 60

  let data: FinnhubCandle
  try {
    data = await fhFetch<FinnhubCandle>('/stock/candle', {
      symbol: symbol.toUpperCase(),
      resolution: 'M',
      from: String(Math.floor(from)),
      to: String(to),
    })
  } catch {

    setCache(cacheKey, 7, LONG_CACHE_TTL)
    return 7
  }

  if (data.s !== 'ok' || !data.c || data.c.length < 2) {
    setCache(cacheKey, 7, LONG_CACHE_TTL)
    return 7
  }


  const closes = data.c.length > 12 ? data.c.slice(1) : data.c
  const first = closes[0]
  const last = closes[closes.length - 1]
  const years = (closes.length - 1) / 12

  if (years < 0.5 || first <= 0) {
    setCache(cacheKey, 7, LONG_CACHE_TTL)
    return 7
  }

  const cagr = (Math.pow(last / first, 1 / years) - 1) * 100
  const result = Math.round(Math.min(25, Math.max(-10, cagr)) * 100) / 100
  setCache(cacheKey, result, LONG_CACHE_TTL)
  return result
}
