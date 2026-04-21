import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import portfolios from './routes/portfolios.js'
import stocks from './routes/stocks.js'
import t212Routes from './routes/t212.js'

const app = new Hono()

//CORS middleware for all routes
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.get('/api/health', (c) =>
  c.json({ data: { status: 'ok', service: 'dividend-snowball-api' } })
)

app.route('/api/portfolios', portfolios)
app.route('/api/stocks', stocks)
app.route('/api/t212', t212Routes)

app.get('/', (c) => c.text('Dividend Snowballer API'))

const port = Number(process.env.PORT) || 3000

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
