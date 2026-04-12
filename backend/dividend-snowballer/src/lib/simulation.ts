export interface HoldingInput {
  symbol: string
  shares: number
  currentPrice: number
  annualDividendPerShare: number
}

export interface SimulationInput {
  holdings: HoldingInput[]
  years: number
  growthRate: number         // annual stock price appreciation, e.g. 7 for 7%
  dividendGrowthRate: number // annual dividend per share growth, e.g. 3 for 3%
  drip: boolean              // dividend reinvestment
  additionalAnnualInvestment?: number // optional extra cash per year
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
  yearResults: YearResult[]
  initialValue: number
  finalValue: number
  totalDividendsEarned: number
  totalReturn: number // percentage
}

export function runSimulation(input: SimulationInput): SimulationResult {
  const { holdings, years, growthRate, dividendGrowthRate, drip, additionalAnnualInvestment = 0 } = input

  const growthFactor = 1 + growthRate / 100
  const dgrFactor = 1 + dividendGrowthRate / 100

  let prices = holdings.map(h => h.currentPrice)
  let divRates = holdings.map(h => h.annualDividendPerShare)
  let shares = holdings.map(h => h.shares)

  const initialValue = shares.reduce((sum, s, i) => sum + s * prices[i], 0)

  const yearResults: YearResult[] = []
  let cumulativeDividends = 0


  // Year by year simulation loop
  for (let year = 1; year <= years; year++) {
    //Grow stock prices
    prices = prices.map(p => p * growthFactor)

    //Grow dividend rates
    divRates = divRates.map(d => d * dgrFactor)

    //Calculate dividends earned this year (on shares held at start of year)
    const annualDividends = shares.reduce((sum, s, i) => sum + s * divRates[i], 0)

    //DRIP: reinvest dividends proportionally
    if (drip && annualDividends > 0) {
      const totalVal = shares.reduce((sum, s, i) => sum + s * prices[i], 0)
      if (totalVal > 0) {
        shares = shares.map((s, i) => {
          const weight = (s * prices[i]) / totalVal
          return s + (annualDividends * weight) / prices[i]
        })
      }
    }

    //Additional proportional annual investment
    if (additionalAnnualInvestment > 0) {
      const totalVal = shares.reduce((sum, s, i) => sum + s * prices[i], 0)
      if (totalVal > 0) {
        shares = shares.map((s, i) => {
          const weight = (s * prices[i]) / totalVal
          return s + (additionalAnnualInvestment * weight) / prices[i]
        })
      }
    }

    cumulativeDividends += annualDividends

    const portfolioValue = shares.reduce((sum, s, i) => sum + s * prices[i], 0)
    const totalShares = shares.reduce((sum, s) => sum + s, 0)
    const dividendYield = portfolioValue > 0 ? (annualDividends / portfolioValue) * 100 : 0

    yearResults.push({
      year,
      portfolioValue: Math.round(portfolioValue * 100) / 100,
      annualDividends: Math.round(annualDividends * 100) / 100,
      cumulativeDividends: Math.round(cumulativeDividends * 100) / 100,
      totalShares: Math.round(totalShares * 10000) / 10000,
      dividendYield: Math.round(dividendYield * 100) / 100,
    })
  }

  const finalValue = yearResults[yearResults.length - 1]?.portfolioValue ?? initialValue
  const totalReturn = initialValue > 0 ? ((finalValue - initialValue) / initialValue) * 100 : 0

  return {
    yearResults,
    initialValue: Math.round(initialValue * 100) / 100,
    finalValue: Math.round(finalValue * 100) / 100,
    totalDividendsEarned: Math.round(cumulativeDividends * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
  }
}
