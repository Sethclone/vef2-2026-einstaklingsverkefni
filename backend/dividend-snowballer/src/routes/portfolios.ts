import { Hono } from 'hono'
import { prisma } from '../db/prisma.js'
import { getQuote, getAnnualDividend } from '../lib/alphaVantage.js'
import { runSimulation } from '../lib/simulation.js'

const portfolios = new Hono()

// GET /api/portfolios
portfolios.get('/', async (c) => {
  const all = await prisma.portfolio.findMany({
    include: { _count: { select: { holdings: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ data: all })
})

// POST /api/portfolios
portfolios.post('/', async (c) => {
  const body = await c.req.json<{ name?: string; description?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
  const portfolio = await prisma.portfolio.create({
    data: { name: body.name.trim(), description: body.description?.trim() ?? null },
  })
  return c.json({ data: portfolio }, 201)
})

// GET /api/portfolios/:id
portfolios.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'invalid id' }, 400)
  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    include: { holdings: { orderBy: { createdAt: 'asc' } } },
  })
  if (!portfolio) return c.json({ error: 'portfolio not found' }, 404)
  return c.json({ data: portfolio })
})

// PUT /api/portfolios/:id
portfolios.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'invalid id' }, 400)
  const body = await c.req.json<{ name?: string; description?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
  try {
    const portfolio = await prisma.portfolio.update({
      where: { id },
      data: { name: body.name.trim(), description: body.description?.trim() ?? null },
    })
    return c.json({ data: portfolio })
  } catch {
    return c.json({ error: 'portfolio not found' }, 404)
  }
})

// DELETE /api/portfolios/:id
portfolios.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'invalid id' }, 400)
  try {
    await prisma.portfolio.delete({ where: { id } })
    return c.json({ data: { success: true } })
  } catch {
    return c.json({ error: 'portfolio not found' }, 404)
  }
})

// ─── Holdings ─────────────────────────────────────────────────────────────────

// POST /api/portfolios/:id/holdings
portfolios.post('/:id/holdings', async (c) => {
  const portfolioId = parseInt(c.req.param('id'))
  if (isNaN(portfolioId)) return c.json({ error: 'invalid portfolio id' }, 400)

  const body = await c.req.json<{
    symbol?: string; companyName?: string; shares?: number; avgCostBasis?: number
  }>()

  if (!body.symbol?.trim()) return c.json({ error: 'symbol is required' }, 400)
  if (!body.shares || body.shares <= 0) return c.json({ error: 'shares must be a positive number' }, 400)

  const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } })
  if (!portfolio) return c.json({ error: 'portfolio not found' }, 404)

  const holding = await prisma.holding.create({
    data: {
      portfolioId,
      symbol: body.symbol.trim().toUpperCase(),
      companyName: body.companyName?.trim() ?? null,
      shares: Number(body.shares),
      avgCostBasis: body.avgCostBasis != null ? Number(body.avgCostBasis) : null,
    },
  })
  return c.json({ data: holding }, 201)
})

// PUT /api/portfolios/:id/holdings/:hid
portfolios.put('/:id/holdings/:hid', async (c) => {
  const hid = parseInt(c.req.param('hid'))
  if (isNaN(hid)) return c.json({ error: 'invalid holding id' }, 400)

  const body = await c.req.json<{ shares?: number; companyName?: string; avgCostBasis?: number }>()
  if (!body.shares || body.shares <= 0) return c.json({ error: 'shares must be a positive number' }, 400)

  try {
    const holding = await prisma.holding.update({
      where: { id: hid },
      data: {
        shares: Number(body.shares),
        companyName: body.companyName?.trim() ?? null,
        avgCostBasis: body.avgCostBasis != null ? Number(body.avgCostBasis) : null,
      },
    })
    return c.json({ data: holding })
  } catch {
    return c.json({ error: 'holding not found' }, 404)
  }
})

// DELETE /api/portfolios/:id/holdings/:hid
portfolios.delete('/:id/holdings/:hid', async (c) => {
  const hid = parseInt(c.req.param('hid'))
  if (isNaN(hid)) return c.json({ error: 'invalid holding id' }, 400)
  try {
    await prisma.holding.delete({ where: { id: hid } })
    return c.json({ data: { success: true } })
  } catch {
    return c.json({ error: 'holding not found' }, 404)
  }
})

// ─── Simulation ───────────────────────────────────────────────────────────────

// POST /api/portfolios/:id/simulate
portfolios.post('/:id/simulate', async (c) => {
  const portfolioId = parseInt(c.req.param('id'))
  if (isNaN(portfolioId)) return c.json({ error: 'invalid portfolio id' }, 400)

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { holdings: true },
  })
  if (!portfolio) return c.json({ error: 'portfolio not found' }, 404)
  if (portfolio.holdings.length === 0) return c.json({ error: 'portfolio has no holdings' }, 400)

  const body = await c.req.json<{
    years?: number; growthRate?: number; dividendGrowthRate?: number;
    drip?: boolean; additionalAnnualInvestment?: number
  }>()

  const years = Math.round(Number(body.years ?? 10))
  const growthRate = Number(body.growthRate ?? 7)
  const dividendGrowthRate = Number(body.dividendGrowthRate ?? 3)
  const drip = body.drip !== false
  const additionalAnnualInvestment = Number(body.additionalAnnualInvestment ?? 0)

  if (years < 1 || years > 50) return c.json({ error: 'years must be between 1 and 50' }, 400)
  if (growthRate < -20 || growthRate > 50) return c.json({ error: 'growthRate must be between -20 and 50' }, 400)

  // Fetch live market data for each holding (parallel with graceful failure)
  type EnrichedHolding = { symbol: string; shares: number; currentPrice: number; annualDividendPerShare: number }
  const fetched = await Promise.allSettled(
    portfolio.holdings.map(async (h): Promise<EnrichedHolding> => {
      const [quote, annualDiv] = await Promise.all([
        getQuote(h.symbol),
        getAnnualDividend(h.symbol),
      ])
      return { symbol: h.symbol, shares: h.shares, currentPrice: quote.price, annualDividendPerShare: annualDiv }
    })
  )

  const enrichedHoldings: EnrichedHolding[] = fetched
    .filter((r): r is PromiseFulfilledResult<EnrichedHolding> => r.status === 'fulfilled')
    .map(r => r.value)

  if (enrichedHoldings.length === 0) {
    return c.json({ error: 'Could not fetch market data for any holdings. Check your API key or try again later.' }, 502)
  }

  const results = runSimulation({ holdings: enrichedHoldings, years, growthRate, dividendGrowthRate, drip, additionalAnnualInvestment })

  const sim = await prisma.simulation.create({
    data: { portfolioId, years, growthRate, dividendGrowthRate, drip, results: results as object },
  })

  return c.json({ data: { id: sim.id, ...results } })
})

export default portfolios
