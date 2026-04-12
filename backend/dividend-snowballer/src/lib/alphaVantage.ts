import 'dotenv/config'

const BASE_URL = 'https://www.alphavantage.co/query'

function apiKey(): string {
  return process.env['ALPHA_VANTAGE_API_KEY'] ?? 'demo'
}

// Simple in-memory cache to to reduce API calls.
interface CacheEntry { data: unknown; timestamp: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null }
  return entry.data as T
}
function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() })
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
