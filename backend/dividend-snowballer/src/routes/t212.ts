import { Hono } from 'hono'
import * as t212 from '../lib/trading212.js'
import { getDividendYieldPct, getDividendGrowthRate as finnhubDGR } from '../lib/finnhub.js'
import { getTaxRate, countryFromTicker } from '../lib/taxRates.js'
import { runSimulation } from '../lib/simulation.js'
import type { AccountDividendSummary } from '../lib/trading212.js'

const t212Routes = new Hono()

// ─── Types ────────────────────────────────────────────────────────────────────
interface T212Position {
  averagePricePaid: number
  createdAt: string
  currentPrice: number
  quantity: number
  instrument: { ticker: string; name: string; currency?: string }
  walletImpact: {
    currency: string
    currentValue: number
    totalCost: number
    unrealizedProfitLoss: number
    fxImpact: number
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────
/** Extract base symbol (AAPL) from T212 ticker (AAPL_US_EQ) */
function baseSymbol(ticker: string | undefined): string {
  if (!ticker) return ''
  const parts = ticker.split('_')
  if (parts.length >= 3) return parts.slice(0, -2).join('_')
  return ticker
}

const T212_SERVER = 'https://live.trading212.com'

function getT212AuthHeader(): string {
  const key = process.env['TRADING_212_API_KEY']
  const secret = process.env['TRADING_212_API_SECRET']
  if (!key || !secret) throw new Error('TRADING_212_API_KEY and TRADING_212_API_SECRET must be set')
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`
}

// Simple in-route cache for positions
let positionsCacheData: T212Position[] | null = null
let positionsCacheTime = 0
const POSITIONS_TTL = 60 * 60 * 1000 // 1 hour

async function t212PositionsFetch(): Promise<T212Position[]> {
  if (positionsCacheData && Date.now() - positionsCacheTime < POSITIONS_TTL) {
    return positionsCacheData
  }
  const res = await fetch(`${T212_SERVER}/api/v0/equity/positions`, {
    headers: { Authorization: getT212AuthHeader() },
  })
  if (res.status === 429) throw new Error('Trading 212 rate limit reached. Try again shortly.')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Trading 212 API returned ${res.status}${text ? `: ${text}` : ''}`)
  }
  const json = await res.json()
  // T212 may return { "items": [...] } or a plain array
  positionsCacheData = (Array.isArray(json) ? json : json?.items ?? []) as T212Position[]
  positionsCacheTime = Date.now()
  return positionsCacheData
}

// ─── GET /api/t212/portfolio ──────────────────────────────────────────────────
t212Routes.get('/portfolio', async (c) => {
  try {
    const positions = await t212PositionsFetch()

    const items = await Promise.all(
      positions.map(async pos => {
        const symbol = baseSymbol(pos.instrument.ticker)
        const countryCode = countryFromTicker(pos.instrument.ticker) ?? 'US'
        const dividendTaxRate = getTaxRate(countryCode)

        // walletImpact is already in account currency (EUR) — handles GBX, USD, etc.
        const currentValueEUR = pos.walletImpact?.currentValue ?? pos.quantity * pos.currentPrice
        const totalCostEUR = pos.walletImpact?.totalCost ?? pos.quantity * pos.averagePricePaid
        const unrealizedPL = pos.walletImpact?.unrealizedProfitLoss ?? (currentValueEUR - totalCostEUR)
        const unrealizedPLPct = totalCostEUR > 0 ? (unrealizedPL / totalCostEUR) * 100 : 0
        const currentPriceEUR = pos.quantity > 0 ? currentValueEUR / pos.quantity : pos.currentPrice
        const avgCostBasisEUR = pos.quantity > 0 ? totalCostEUR / pos.quantity : pos.averagePricePaid

        // Use Finnhub's normalised dividend yield (60 req/min, currency-agnostic)
        const yieldPct = await getDividendYieldPct(symbol).catch(() => 0)
        const annualDividend = (yieldPct / 100) * currentPriceEUR

        return {
          ticker: pos.instrument.ticker,
          symbol,
          companyName: pos.instrument?.name ?? symbol,
          shares: pos.quantity,
          avgCostBasis: Math.round(avgCostBasisEUR * 100) / 100,
          currentPrice: Math.round(currentPriceEUR * 100) / 100,
          currentValue: Math.round(currentValueEUR * 100) / 100,
          unrealizedPL: Math.round(unrealizedPL * 100) / 100,
          unrealizedPLPct: Math.round(unrealizedPLPct * 100) / 100,
          annualDividendPerShare: Math.round(annualDividend * 100) / 100,
          annualDividendTotal: Math.round(annualDividend * pos.quantity * 100) / 100,
          dividendYield: currentPriceEUR > 0 ? Math.round((annualDividend / currentPriceEUR) * 10000) / 100 : 0,
          dividendTaxRate,
          countryCode,
        }
      })
    )

    const totalValue = items.reduce((s, i) => s + i.currentValue, 0)
    const totalCost = items.reduce((s, i) => s + i.avgCostBasis * i.shares, 0)
    const totalUnrealizedPL = items.reduce((s, i) => s + i.unrealizedPL, 0)

    return c.json({
      data: {
        positions: items,
        totalValue: Math.round(totalValue * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalUnrealizedPL: Math.round(totalUnrealizedPL * 100) / 100,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch T212 portfolio'
    return c.json({ error: message }, 500)
  }
})

// ─── GET /api/t212/suggested-params ──────────────────────────────────────────
t212Routes.get('/suggested-params', async (c) => {
  try {
    const positions = await t212PositionsFetch()
    if (positions.length === 0) {
      return c.json({ data: { suggestedGrowthRate: 7, suggestedDividendGrowthRate: 3 } })
    }

    const settled = await Promise.allSettled(
      positions.map(async pos => {
        const symbol = baseSymbol(pos.instrument.ticker)
        const [gr, dgr] = await Promise.all([
          t212.getStockGrowthRate(symbol),
          finnhubDGR(symbol),
        ])
        return { gr, dgr }
      })
    )
    const results = settled
      .filter((r): r is PromiseFulfilledResult<{ gr: number; dgr: number }> => r.status === 'fulfilled')
      .map(r => r.value)

    const valid = results
    if (valid.length === 0) {
      return c.json({ data: { suggestedGrowthRate: 7, suggestedDividendGrowthRate: 3, usingFallback: true } })
    }

    const avgGr = valid.reduce((s, v) => s + v.gr, 0) / valid.length
    const avgDgr = valid.reduce((s, v) => s + v.dgr, 0) / valid.length

    return c.json({
      data: {
        suggestedGrowthRate: Math.round(avgGr * 100) / 100,
        suggestedDividendGrowthRate: Math.round(avgDgr * 100) / 100,
        usingFallback: false,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to compute suggested params'
    return c.json({ error: message }, 500)
  }
})

// ─── POST /api/t212/simulate ──────────────────────────────────────────────────
t212Routes.post('/simulate', async (c) => {
  try {
    const body = await c.req.json<{
      years?: number
      growthRate?: number
      dividendGrowthRate?: number
      drip?: boolean
      additionalAnnualInvestment?: number
    }>()

    const years = body.years ?? 10
    const growthRate = body.growthRate ?? 7
    const dividendGrowthRate = body.dividendGrowthRate ?? 3
    const drip = body.drip ?? true
    const additionalAnnualInvestment = body.additionalAnnualInvestment ?? 0

    const positions = await t212PositionsFetch()
    if (positions.length === 0) return c.json({ error: 'No T212 positions found' }, 400)

    // Build holdings array using Finnhub dividend yield (60 req/min, currency-agnostic)
    const holdingData = await Promise.all(
      positions.map(async pos => {
        const symbol = baseSymbol(pos.instrument.ticker)
        const countryCode = countryFromTicker(pos.instrument.ticker) ?? 'US'
        // Use walletImpact for EUR-denominated prices
        const currentValueEUR = pos.walletImpact?.currentValue ?? pos.quantity * pos.currentPrice
        const currentPriceEUR = pos.quantity > 0 ? currentValueEUR / pos.quantity : pos.currentPrice
        const yieldPct = await getDividendYieldPct(symbol).catch(() => 0)
        const annualDividendPerShare = (yieldPct / 100) * currentPriceEUR
        return {
          symbol,
          shares: pos.quantity,
          currentPrice: currentPriceEUR,
          annualDividendPerShare,
          countryCode,
          value: currentValueEUR,
        }
      })
    )

    // Weighted-average dividend tax rate across all positions
    const totalValue = holdingData.reduce((s, h) => s + h.value, 0)
    const weightedTaxRate = totalValue > 0
      ? holdingData.reduce((s, h) => s + getTaxRate(h.countryCode) * (h.value / totalValue), 0)
      : 0.15

    const result = runSimulation({
      holdings: holdingData.map(h => ({
        symbol: h.symbol,
        shares: h.shares,
        currentPrice: h.currentPrice,
        annualDividendPerShare: h.annualDividendPerShare,
      })),
      years,
      growthRate,
      dividendGrowthRate,
      drip,
      additionalAnnualInvestment,
      dividendTaxRate: weightedTaxRate,
    })

    return c.json({ data: { ...result, dividendTaxRate: Math.round(weightedTaxRate * 10000) / 100 } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Simulation failed'
    return c.json({ error: message }, 500)
  }
})

// ─── GET /api/t212/dividends ──────────────────────────────────────────────────
// Returns total dividends received all-time and year-to-date.
t212Routes.get('/dividends', async (c) => {
  try {
    const summary: AccountDividendSummary = await t212.getAccountDividends()
    return c.json({ data: summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dividend history'
    return c.json({ error: message }, 500)
  }
})

// ─── GET /api/t212/debug ─────────────────────────────────────────────────────
// Returns the raw T212 positions response — use this to verify the data shape.
t212Routes.get('/debug', async (c) => {
  try {
    const res = await fetch(`${T212_SERVER}/api/v0/equity/positions`, {
      headers: { Authorization: getT212AuthHeader() },
    })
    const text = await res.text()
    return c.json({ status: res.status, raw: JSON.parse(text) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Debug fetch failed'
    return c.json({ error: message }, 500)
  }
})

export default t212Routes
