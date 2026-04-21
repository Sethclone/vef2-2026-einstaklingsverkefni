import 'dotenv/config'

const SERVER_ROOT = 'https://live.trading212.com'
const API_BASE = `${SERVER_ROOT}/api/v0`

function getAuthHeader(): string {
  const key = process.env['TRADING_212_API_KEY']
  const secret = process.env['TRADING_212_API_SECRET']
  if (!key || !secret) throw new Error('TRADING_212_API_KEY and TRADING_212_API_SECRET must be set')
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`
}


interface CacheEntry { data: unknown; timestamp: number; ttl: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 60 * 60 * 1000            // 1 hour  (positions, recent dividends)
const LONG_CACHE_TTL = 24 * 60 * 60 * 1000  // 24 hours (full dividend history)

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > entry.ttl) { cache.delete(key); return null }
  return entry.data as T
}
function setCache(key: string, data: unknown, ttl = CACHE_TTL): void {
  cache.set(key, { data, timestamp: Date.now(), ttl })
}


interface T212Instrument {
  ticker: string
  name: string
  isin?: string
  currency?: string
}

interface T212Position {
  averagePricePaid: number
  createdAt: string
  currentPrice: number
  quantity: number
  instrument: T212Instrument
  walletImpact: {
    currency: string
    currentValue: number
    totalCost: number
    unrealizedProfitLoss: number
    fxImpact: number
  }
}

interface T212DividendItem {
  ticker: string
  paidOn: string
  grossAmountPerShare: number
  quantity: number
  amount: number
  currency: string
  type: string
  instrument: T212Instrument
}

async function t212Fetch(path: string): Promise<unknown> {
  const url = path.startsWith('/api/')
    ? `${SERVER_ROOT}${path}`
    : `${API_BASE}${path}`

  const res = await fetch(url, {
    headers: { Authorization: getAuthHeader() },
  })
  if (res.status === 429) throw new Error('Trading 212 rate limit reached. Try again shortly.')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Trading 212 API returned ${res.status}${text ? `: ${text}` : ''}`)
  }
  return res.json()
}

async function getPositionsMap(): Promise<Map<string, T212Position>> {
  const cacheKey = 'positions:all'
  const cached = getCached<Map<string, T212Position>>(cacheKey)
  if (cached) return cached

  const json = await t212Fetch('/equity/positions')
  const data: T212Position[] = Array.isArray(json) ? json : (json as { items: T212Position[] })?.items ?? []
  const map = new Map<string, T212Position>()
  for (const pos of data) {
    map.set(pos.instrument.ticker, pos)
  }
  setCache(cacheKey, map)
  return map
}

// ─── Symbol → T212 ticker mapping ─────────────────────────────────────────────
// DB stores symbols like "AAPL". T212 uses "AAPL_US_EQ".
// Strategy:
//   1. Exact match (user may have stored the full ticker)
//   2. Ticker starts with "SYMBOL_" (covers "AAPL_US_EQ" → "AAPL")
//   3. First N parts minus the two trailing segments (e.g. "BRK_B_US_EQ" → "BRK_B")
//   4. instrument.shortName match
async function symbolToTicker(symbol: string): Promise<string | null> {
  const positions = await getPositionsMap()

  if (positions.has(symbol)) return symbol

  const upperSymbol = symbol.toUpperCase()

  for (const [ticker, pos] of positions) {
    const parts = ticker.split('_')

    // Single-part base: AAPL from AAPL_US_EQ
    if (parts[0] === upperSymbol) return ticker

    // Multi-part base: BRK_B from BRK_B_US_EQ (remove last 2 segments)
    if (parts.length >= 3) {
      const base = parts.slice(0, -2).join('_')
      if (base === upperSymbol) return ticker
    }

    // instrument shortName / name
    if (
      pos.instrument?.name?.toUpperCase() === upperSymbol ||
      ticker.replace(/_[A-Z]{2}_EQ$/, '').replace(/_EQ$/, '') === upperSymbol
    ) return ticker
  }
  return null
}

async function getAllDividends(t212Ticker: string): Promise<T212DividendItem[]> {
  const cacheKey = `dividends-t212:${t212Ticker}`
  const cached = getCached<T212DividendItem[]>(cacheKey)
  if (cached) return cached

  const items: T212DividendItem[] = []
  let path: string | null =
    `/equity/history/dividends?ticker=${encodeURIComponent(t212Ticker)}&limit=50`

  while (path) {
    const data = await t212Fetch(path) as { items: T212DividendItem[]; nextPagePath: string | null }
    items.push(...data.items)
    path = data.nextPagePath ?? null
  }

  setCache(cacheKey, items, LONG_CACHE_TTL)
  return items
}


export interface AccountDividendPayment {
  ticker: string
  companyName: string
  paidOn: string           // ISO date
  amount: number           // total EUR received
  grossAmountPerShare: number
  quantity: number
}

export interface AccountDividendSummary {
  totalPaid: number
  paidThisYear: number
  recentPayments: AccountDividendPayment[]
}

export async function getAccountDividends(): Promise<AccountDividendSummary> {
  const cacheKey = 'account-dividends:all'
  const cached = getCached<AccountDividendSummary>(cacheKey)
  if (cached) return cached

  const items: T212DividendItem[] = []
  let path: string | null = '/equity/history/dividends?limit=50'

  while (path) {
    const data = await t212Fetch(path) as { items: T212DividendItem[]; nextPagePath: string | null }
    items.push(...(data.items ?? []))
    path = data.nextPagePath ?? null
  }

  const thisYear = new Date().getFullYear()
  let totalPaid = 0
  let paidThisYear = 0

  const recentPayments: AccountDividendPayment[] = []

  for (const d of items) {
    if (d.amount == null || d.amount <= 0) continue
    totalPaid += d.amount
    if (new Date(d.paidOn).getFullYear() === thisYear) {
      paidThisYear += d.amount
    }
    recentPayments.push({
      ticker: d.ticker ?? d.instrument?.ticker ?? '',
      companyName: d.instrument?.name ?? d.ticker ?? '',
      paidOn: d.paidOn,
      amount: d.amount,
      grossAmountPerShare: d.grossAmountPerShare ?? 0,
      quantity: d.quantity ?? 0,
    })
  }

  // Sort by most recent first
  recentPayments.sort((a, b) => new Date(b.paidOn).getTime() - new Date(a.paidOn).getTime())

  const summary: AccountDividendSummary = {
    totalPaid: Math.round(totalPaid * 100) / 100,
    paidThisYear: Math.round(paidThisYear * 100) / 100,
    recentPayments: recentPayments.slice(0, 50),
  }

  setCache(cacheKey, summary)
  return summary
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

/**
 * Returns current price from your T212 open position.
 * changePercent = total return since your average purchase price.
 * 
 */
export async function getQuote(symbol: string): Promise<StockQuote> {
  const ticker = await symbolToTicker(symbol)
  if (!ticker) {
    throw new Error(
      `No open position found for "${symbol}" in your Trading 212 account. ` +
      `Make sure the symbol matches a holding you own (e.g. "AAPL" for AAPL_US_EQ).`
    )
  }

  const positions = await getPositionsMap()
  const pos = positions.get(ticker)!

  const changePercent =
    pos.averagePricePaid > 0
      ? ((pos.currentPrice - pos.averagePricePaid) / pos.averagePricePaid) * 100
      : 0

  return {
    symbol,
    price: pos.currentPrice,
    open: pos.averagePricePaid,   // approx: cost basis
    high: pos.currentPrice,
    low: pos.currentPrice,
    volume: 0,
    changePercent,
  }
}

/**
 * Returns per-share dividend history from your actual T212 dividend payments.
 */
export async function getDividends(symbol: string): Promise<DividendEntry[]> {
  const ticker = await symbolToTicker(symbol)
  if (!ticker) return []

  const items = await getAllDividends(ticker)
  return items
    .filter(d => d.amount != null && d.amount > 0 && d.quantity > 0)
    .map(d => ({
      exDate: d.paidOn,
      amount: d.amount / d.quantity,  // EUR per share (account currency)
    }))
}

/**
 * Trailing 12-month annual dividend per share.
 */
export async function getAnnualDividend(symbol: string): Promise<number> {
  const dividends = await getDividends(symbol)
  if (dividends.length === 0) return 0

  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const lastYear = dividends.filter(d => new Date(d.exDate) >= oneYearAgo)
  if (lastYear.length > 0) return lastYear.reduce((sum, d) => sum + d.amount, 0)

  // Fallback: most recent 4 payments
  return dividends.slice(0, 4).reduce((sum, d) => sum + d.amount, 0)
}

/**
 * Annualised dividend growth rate (CAGR) from actual T212 dividend payment history.
 * Uses grossAmountPerShare grouped by year.
 */
export async function getDividendGrowthRate(symbol: string): Promise<number> {
  const dividends = await getDividends(symbol)
  if (dividends.length < 4) return 3

  const byYear = new Map<number, number>()
  for (const d of dividends) {
    const year = new Date(d.exDate).getFullYear()
    byYear.set(year, (byYear.get(year) ?? 0) + d.amount)
  }

  const sorted = Array.from(byYear.entries()).sort((a, b) => a[0] - b[0])
  if (sorted.length < 2) return 3

  const recent = sorted.slice(-5)
  const [firstYear, firstAmt] = recent[0]
  const [lastYear, lastAmt] = recent[recent.length - 1]
  const n = lastYear - firstYear
  if (n === 0 || firstAmt <= 0) return 3

  const cagr = (Math.pow(lastAmt / firstAmt, 1 / n) - 1) * 100
  console.log(
    `[T212] Dividend growth for ${symbol}: $${firstAmt.toFixed(4)}/sh (${firstYear}) → ` +
    `$${lastAmt.toFixed(4)}/sh (${lastYear}) ⇒ CAGR ${cagr.toFixed(2)}%`
  )
  if (cagr <= 0) return 2
  return Math.round(Math.min(25, cagr) * 100) / 100
}

/**
 * Annualised price growth rate estimated from your position:
 *   CAGR = (currentPrice / averagePricePaid)^(1/years) − 1
 * Falls back to 7% if the position is too new (<6 months) or data is missing.
 * This is a rough estimate based on your actual purchase price and holding period, not market data.
 */
export async function getStockGrowthRate(symbol: string): Promise<number> {
  const ticker = await symbolToTicker(symbol)
  if (!ticker) return 7

  const positions = await getPositionsMap()
  const pos = positions.get(ticker)!

  if (!pos.averagePricePaid || pos.averagePricePaid <= 0 || !pos.createdAt) return 7

  const years =
    (Date.now() - new Date(pos.createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)

  if (years < 0.5) return 7 // too new to estimate growth, return default

  const cagr = (Math.pow(pos.currentPrice / pos.averagePricePaid, 1 / years) - 1) * 100
  const result = Math.round(Math.min(25, Math.max(-10, cagr)) * 100) / 100

  console.log(
    `[T212] Stock growth for ${symbol}: avg cost $${pos.averagePricePaid.toFixed(2)} → ` +
    `current $${pos.currentPrice.toFixed(2)} over ${years.toFixed(1)} yrs ⇒ CAGR ${result}%`
  )
  return result
}
