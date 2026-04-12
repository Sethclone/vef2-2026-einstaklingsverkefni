# Dividend Snowballer — Backend

Hono + Prisma 7 + PostgreSQL REST API.

## Setup

```bash
npm install

# 1. Copy .env.example to .env and fill in values
cp .env.example .env

# 2. Create the database and run migrations
npx prisma migrate dev --name init

# 3. Start the dev server
npm run dev      # http://localhost:3000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/portfolios` | List all portfolios |
| POST | `/api/portfolios` | Create portfolio |
| GET | `/api/portfolios/:id` | Get portfolio with holdings |
| PUT | `/api/portfolios/:id` | Update portfolio |
| DELETE | `/api/portfolios/:id` | Delete portfolio |
| POST | `/api/portfolios/:id/holdings` | Add holding |
| PUT | `/api/portfolios/:id/holdings/:hid` | Update holding |
| DELETE | `/api/portfolios/:id/holdings/:hid` | Remove holding |
| POST | `/api/portfolios/:id/simulate` | Run snowball simulation |
| GET | `/api/stocks/:symbol/quote` | Fetch live stock quote |
| GET | `/api/stocks/:symbol/dividends` | Fetch dividend history |

## Simulate body parameters

```json
{
  "years": 10,
  "growthRate": 7,
  "dividendGrowthRate": 3,
  "drip": true,
  "additionalAnnualInvestment": 0
}
```
