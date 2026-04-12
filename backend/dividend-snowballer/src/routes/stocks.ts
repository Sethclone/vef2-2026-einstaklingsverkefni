import { Hono } from 'hono'
import { getQuote, getDividends, getAnnualDividend } from '../lib/alphaVantage.js'

const stocks = new Hono()

// GET /api/stocks/:symbol/quote
stocks.get('/:symbol/quote', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase()
  try {
    const quote = await getQuote(symbol)
    return c.json({ data: quote })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: message }, 502)
  }
})

// GET /api/stocks/:symbol/dividends
stocks.get('/:symbol/dividends', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase()
  try {
    const [dividends, annualDividend] = await Promise.all([
      getDividends(symbol),
      getAnnualDividend(symbol),
    ])
    return c.json({ data: { dividends, annualDividend } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: message }, 502)
  }
})

export default stocks
