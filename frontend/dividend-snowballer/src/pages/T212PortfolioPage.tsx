import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, formatCurrency, formatPercent } from '../lib/api'
import type { T212Portfolio, T212PortfolioItem, AccountDividendSummary } from '../types'

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`stat-card ${accent ? 'accent' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-note">{sub}</span>}
    </div>
  )
}

export default function T212PortfolioPage() {
  const [portfolio, setPortfolio] = useState<T212Portfolio | null>(null)
  const [dividends, setDividends] = useState<AccountDividendSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.t212.portfolio()
      .then(setPortfolio)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load portfolio'))
      .finally(() => setLoading(false))

    api.t212.dividends()
      .then(setDividends)
      .catch(() => { /* ignore dividend loading errors */ })
  }, [])

  if (loading) return <div className="page"><div className="loading">Loading your T212 portfolio…</div></div>
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!portfolio) return null

  const plSign = portfolio.totalUnrealizedPL >= 0 ? '+' : ''

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Portfolio</h1>

        </div>
        <button className="btn btn-primary" onClick={() => navigate('/t212/simulate')}>
          Simulate Returns →
        </button>
      </div>

      <div className="stats-row">
        <StatCard label="Total Value" value={formatCurrency(portfolio.totalValue)} />
        <StatCard label="Total Cost" value={formatCurrency(portfolio.totalCost)} />
        <StatCard
          label="Unrealized P&L"
          value={`${plSign}${formatCurrency(portfolio.totalUnrealizedPL)}`}
          accent={portfolio.totalUnrealizedPL >= 0}
        />
        {dividends && (
          <>
            <StatCard label="Dividends This Year" value={formatCurrency(dividends.paidThisYear)} accent={dividends.paidThisYear > 0} />
            <StatCard label="Total Dividends Received" value={formatCurrency(dividends.totalPaid)} />
          </>
        )}
        <StatCard label="Holdings" value={String(portfolio.positions.length)} />
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Company</th>
              <th className="text-right">Shares</th>
              <th className="text-right">Avg Cost</th>
              <th className="text-right">Price</th>
              <th className="text-right">Value</th>
              <th className="text-right">P&L</th>
              <th className="text-right">Div/Share</th>
              <th className="text-right">Yield</th>
              <th className="text-right">Tax Rate</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.positions.map((pos: T212PortfolioItem) => (
              <tr key={pos.ticker}>
                <td><span className="symbol-badge">{pos.symbol}</span></td>
                <td>{pos.companyName}</td>
                <td className="text-right">{pos.shares.toFixed(4)}</td>
                <td className="text-right">{formatCurrency(pos.avgCostBasis)}</td>
                <td className="text-right">{formatCurrency(pos.currentPrice)}</td>
                <td className="text-right">{formatCurrency(pos.currentValue)}</td>
                <td className={`text-right ${pos.unrealizedPL >= 0 ? 'positive' : 'negative'}`}>
                  {pos.unrealizedPL >= 0 ? '+' : ''}{formatCurrency(pos.unrealizedPL)}
                  <span className="text-muted"> ({formatPercent(pos.unrealizedPLPct)})</span>
                </td>
                <td className="text-right">{pos.annualDividendPerShare > 0 ? formatCurrency(pos.annualDividendPerShare) : '—'}</td>
                <td className="text-right">{pos.dividendYield > 0 ? `${pos.dividendYield.toFixed(2)}%` : '—'}</td>
                <td className="text-right">
                  <span className="tax-badge">{(pos.dividendTaxRate * 100).toFixed(1)}% {pos.countryCode}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dividends && dividends.recentPayments.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Dividend Payment History</h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Company</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Per Share</th>
                  <th className="text-right">Total Received</th>
                </tr>
              </thead>
              <tbody>
                {dividends.recentPayments.map((p, i) => (
                  <tr key={i}>
                    <td>{new Date(p.paidOn).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td>{p.companyName}</td>
                    <td className="text-right">{p.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td className="text-right">{formatCurrency(p.grossAmountPerShare)}</td>
                    <td className="text-right positive">{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
