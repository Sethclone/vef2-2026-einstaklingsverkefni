import 'dotenv/config'

const BASE_URL = 'https://www.alphavantage.co/query'

function apiKey(): string {
  return process.env['ALPHA_VANTAGE_API_KEY'] ?? 'demo'
}

// Simple in-memory cache to to reduce API calls.
interface CacheEntry { data: unknown; timestamp: number; ttl: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 60 * 60 * 1000       // 1 hour  (quotes, dividends)
const LONG_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours (monthly price history)

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > entry.ttl) { cache.delete(key); return null }
  return entry.data as T
}
function setCache(key: string, data: unknown, ttl = CACHE_TTL): void {
  cache.set(key, { data, timestamp: Date.now(), ttl })
}

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

  const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Alpha Vantage returned ${res.status}`)
  const data = await res.json() as Record<string, unknown>

  if (data['Note']) throw new Error('Alpha Vantage rate limit reached. Try again in a minute.')
  if (data['Information']) throw new Error(String(data['Information']))

  const q = data['Global Quote'] as Record<string, string> | undefined
  if (!q || !q['05. price']) throw new Error(`No quote data found for symbol: ${symbol}`)

  const quote: StockQuote = {
    symbol: q['01. symbol'] ?? symbol,
    price: parseFloat(q['05. price']),
    open: parseFloat(q['02. open'] ?? '0'),
    high: parseFloat(q['03. high'] ?? '0'),
    low: parseFloat(q['04. low'] ?? '0'),
    volume: parseInt(q['06. volume'] ?? '0', 10),
    changePercent: parseFloat((q['10. change percent'] ?? '0').replace('%', '')),
  }

  setCache(cacheKey, quote)
  return quote
}

export async function getDividends(symbol: string): Promise<DividendEntry[]> {
  const cacheKey = `dividends:${symbol}`
  const cached = getCached<DividendEntry[]>(cacheKey)
  if (cached) return cached

  const url = `${BASE_URL}?function=DIVIDENDS&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Alpha Vantage returned ${res.status}`)
  const data = await res.json() as Record<string, unknown>

  if (data['Note']) throw new Error('Alpha Vantage rate limit reached. Try again in a minute.')
  if (data['Information']) throw new Error(String(data['Information']))

  type RawDiv = { ex_dividend_date: string; amount: string }
  const rawList = data['data'] as RawDiv[] | undefined
  if (!rawList) return []

  const dividends: DividendEntry[] = rawList.map(d => ({
    exDate: d.ex_dividend_date,
    amount: parseFloat(d.amount),
  }))

  setCache(cacheKey, dividends)
  return dividends
}

export async function getAnnualDividend(symbol: string): Promise<number> {
  const dividends = await getDividends(symbol)
  if (dividends.length === 0) return 0

  // Sum dividends from the last 12 months
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const lastYear = dividends.filter(d => new Date(d.exDate) >= oneYearAgo)
  if (lastYear.length > 0) return lastYear.reduce((sum, d) => sum + d.amount, 0)

  // Fallback: most recent 4 quarters
  return dividends.slice(0, 4).reduce((sum, d) => sum + d.amount, 0)
}

/** Calculates annualised dividend growth rate (CAGR) from historical dividend data.
 *  Reuses the already-cached getDividends() result */
export async function getDividendGrowthRate(symbol: string): Promise<number> {
  const dividends = await getDividends(symbol)
  if (dividends.length < 4) return 3 // not enough history, use default

  // Group total annual dividends by calendar year
  const byYear = new Map<number, number>()
  for (const d of dividends) {
    const year = new Date(d.exDate).getFullYear()
    byYear.set(year, (byYear.get(year) ?? 0) + d.amount)
  }

  const sorted = Array.from(byYear.entries()).sort((a, b) => a[0] - b[0])
  if (sorted.length < 2) return 3

  // Use up to the last 5 complete years
  const recent = sorted.slice(-5)
  const [firstYear, firstAmt] = recent[0]
  const [lastYear, lastAmt] = recent[recent.length - 1]
  const n = lastYear - firstYear
  if (n === 0 || firstAmt <= 0) return 3

  const cagr = (Math.pow(lastAmt / firstAmt, 1 / n) - 1) * 100
  console.log(`Dividend growth for ${symbol}: from $${firstAmt.toFixed(2)} in ${firstYear} to $${lastAmt.toFixed(2)} in ${lastYear} => CAGR: ${cagr.toFixed(2)}%`)
  if (cagr <= 0) return 2
  return Math.round(Math.min(25, cagr) * 100) / 100
}

/** Calculates 5-year annualised price CAGR using monthly adjusted prices.
 *  Cached for 24 hours */
export async function getStockGrowthRate(symbol: string): Promise<number> {
  const cacheKey = `monthly-cagr:${symbol}`
  const cached = getCached<number>(cacheKey)
  if (cached !== null) return cached

  const url = `${BASE_URL}?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey()}`
  const res = await fetch(url)
  if (!res.ok) { setCache(cacheKey, 7, LONG_CACHE_TTL); return 7 }
  const data = await res.json() as Record<string, unknown>

  if (data['Note'] || data['Information']) { setCache(cacheKey, 7, LONG_CACHE_TTL); return 7 }

  const series = data['Monthly Adjusted Time Series'] as Record<string, Record<string, string>> | undefined
  if (!series) { setCache(cacheKey, 7, LONG_CACHE_TTL); return 7 }

  // Sort ascending (oldest first). Drop the most recent entry — it may be a partial month.
  const allDates = Object.keys(series).sort()
  const dates = allDates.slice(0, -1) // exclude current incomplete month
  if (dates.length < 24) { setCache(cacheKey, 7, LONG_CACHE_TTL); return 7 }

  // Take exactly 60 months (5 years) or all available
  const window = dates.slice(-60)
  const firstDate = new Date(window[0])
  const lastDate = new Date(window[window.length - 1])
  const years = (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

  const firstPrice = parseFloat(series[window[0]]['5. adjusted close'])
  const lastPrice = parseFloat(series[window[window.length - 1]]['5. adjusted close'])

  if (firstPrice <= 0 || years < 1) { setCache(cacheKey, 7, LONG_CACHE_TTL); return 7 }

  const cagr = (Math.pow(lastPrice / firstPrice, 1 / years) - 1) * 100
  // Clamp to a realistic range (-10%–25%)
  const result = Math.round(Math.min(25, Math.max(-10, cagr)) * 100) / 100

  setCache(cacheKey, result, LONG_CACHE_TTL)
  return result
}
