export interface Portfolio {
  id: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  holdings?: Holding[]
  _count?: { holdings: number }
}

export interface Holding {
  id: number
  portfolioId: number
  symbol: string
  companyName: string | null
  shares: number
  avgCostBasis: number | null
  createdAt: string
  updatedAt: string
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

export interface SimulationParams {
  years: number
  growthRate: number
  dividendGrowthRate: number
  drip: boolean
  additionalAnnualInvestment: number
}

export interface YearResult {
  year: number
  portfolioValue: number
  annualDividends: number
  cumulativeDividends: number
  totalShares: number
  dividendYield: number
}

export interface SimulationResult {
  id: number
  yearResults: YearResult[]
  initialValue: number
  finalValue: number
  totalDividendsEarned: number
  totalReturn: number
}
