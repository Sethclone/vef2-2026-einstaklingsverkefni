import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api, formatCurrency, formatPercent } from '../lib/api'
import type { SimulationParams, SimulationResult } from '../types'

const DEFAULT_PARAMS: SimulationParams = {
  years: 10,
  growthRate: 7,
  dividendGrowthRate: 3,
  drip: true,
  additionalAnnualInvestment: 0,
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`stat-card ${accent ? 'accent' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-note">{sub}</span>}
    </div>
  )
}

// Custom tooltip for Recharts to match dark theme
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">Year {label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function SimulatePage() {
  const { id } = useParams<{ id: string }>()
  const portfolioId = parseInt(id ?? '0')

  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingSuggested, setLoadingSuggested] = useState(true)
  const [usedSuggested, setUsedSuggested] = useState(false)

  useEffect(() => {
    api.suggestParams(portfolioId)
      .then(s => {
        setParams(p => ({ ...p, growthRate: s.suggestedGrowthRate, dividendGrowthRate: s.suggestedDividendGrowthRate }))
        setUsedSuggested(true)
      })
      .catch(() => { /* silently fall back to defaults */ })
      .finally(() => setLoadingSuggested(false))
  }, [portfolioId])

  const set = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) =>
    setParams(p => ({ ...p, [key]: value }))

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    try {
      setRunning(true)
      const data = await api.simulate(portfolioId, params)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link to="/sandbox">Sandbox</Link> / <Link to={`/sandbox/portfolio/${portfolioId}`}>Portfolio</Link> / Simulate
          </div>
          <h1>Snowball Simulator</h1>
          <p className="text-muted">Set assumptions and see how your portfolio could grow with dividend reinvestment.</p>
        </div>
      </div>

      <div className="simulate-layout">
        {/* Parameters form */}
        <div className="sim-params card">
          <h2>Parameters</h2>
          {loadingSuggested && <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>Estimating rates from historical data…</p>}
          {!loadingSuggested && usedSuggested && <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>✦ Rates pre-filled from historical data. You can adjust them below.</p>}
          <form onSubmit={handleRun} className="form">
            <div className="form-group">
              <label htmlFor="s-years">Time horizon (years)</label>
              <input
                id="s-years" type="number" min={1} max={50}
                value={params.years}
                onChange={e => set('years', parseInt(e.target.value))}
              />
              <span className="form-hint">1 – 50 years</span>
            </div>

            <div className="form-group">
              <label htmlFor="s-growth">Expected annual price growth (%)</label>
              <input
                id="s-growth" type="number" min={-20} max={50} step={0.1}
                value={params.growthRate}
                onChange={e => set('growthRate', parseFloat(e.target.value))}
              />
              <span className="form-hint">Historical S&amp;P 500 avg ≈ 7% (inflation-adj.)</span>
            </div>

            <div className="form-group">
              <label htmlFor="s-dgr">Expected dividend growth rate (%)</label>
              <input
                id="s-dgr" type="number" min={0} max={30} step={0.1}
                value={params.dividendGrowthRate}
                onChange={e => set('dividendGrowthRate', parseFloat(e.target.value))}
              />
              <span className="form-hint">Typical DGR for dividend growers ≈ 3–8%</span>
            </div>

            <div className="form-group">
              <label htmlFor="s-extra">Additional annual investment ($)</label>
              <input
                id="s-extra" type="number" min={0} step={100}
                value={params.additionalAnnualInvestment}
                onChange={e => set('additionalAnnualInvestment', parseFloat(e.target.value))}
              />
              <span className="form-hint">Extra cash invested each year (optional)</span>
            </div>

            <div className="form-group form-group-check">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={params.drip}
                  onChange={e => set('drip', e.target.checked)}
                />
                <span>DRIP — Reinvest dividends automatically</span>
              </label>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <button type="submit" className="btn btn-primary btn-full" disabled={running}>
              {running ? 'Running simulation…' : '▶ Run Simulation'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div className="sim-results">
          {!result && !running && (
            <div className="empty-state-sm">
              <div className="empty-icon">📈</div>
              <p>Configure parameters and run the simulation to see results.</p>
            </div>
          )}

          {result && (
            <>
              <div className="stats-row four-col">
                <StatCard label="Initial Value" value={formatCurrency(result.initialValue)} />
                <StatCard label="Final Value" value={formatCurrency(result.finalValue)} accent />
                <StatCard label="Total Dividends" value={formatCurrency(result.totalDividendsEarned)} sub="earned over period" />
                <StatCard label="Total Return" value={formatPercent(result.totalReturn, 1)} sub={`over ${params.years} years`} accent={result.totalReturn > 0} />
              </div>

              {/* Portfolio Value Chart */}
              <div className="card chart-card">
                <h3>Portfolio Value Over Time</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={result.yearResults} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradDivs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                    <XAxis dataKey="year" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} label={{ value: 'Year', position: 'insideBottom', offset: -2, fill: '#94a3b8' }} />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: '#94a3b8', paddingTop: '8px' }} />
                    <Area type="monotone" dataKey="portfolioValue" name="Portfolio Value" stroke="#60a5fa" fill="url(#gradValue)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="cumulativeDividends" name="Cumulative Dividends" stroke="#4ade80" fill="url(#gradDivs)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Annual Dividends Chart */}
              <div className="card chart-card">
                <h3>Annual Dividends</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={result.yearResults} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                    <XAxis dataKey="year" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="annualDividends" name="Annual Dividends" fill="#4ade80" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Year-by-year table */}
              <div className="card">
                <h3>Year-by-Year Breakdown</h3>
                <div className="table-wrapper">
                  <table className="holdings-table">
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th className="num">Portfolio Value</th>
                        <th className="num">Annual Dividends</th>
                        <th className="num">Cumulative Dividends</th>
                        <th className="num">Dividend Yield</th>
                        <th className="num">Total Shares</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.yearResults.map(r => (
                        <tr key={r.year}>
                          <td>{r.year}</td>
                          <td className="num">{formatCurrency(r.portfolioValue)}</td>
                          <td className="num positive">{formatCurrency(r.annualDividends)}</td>
                          <td className="num">{formatCurrency(r.cumulativeDividends)}</td>
                          <td className="num">{r.dividendYield.toFixed(2)}%</td>
                          <td className="num">{r.totalShares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
