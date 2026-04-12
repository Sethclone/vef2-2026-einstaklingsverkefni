import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, formatCurrency } from '../lib/api'
import Modal from '../components/Modal'
import type { Portfolio, Holding, StockQuote } from '../types'

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const portfolioId = parseInt(id ?? '0')
  const navigate = useNavigate()

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({})
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add holding modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ symbol: '', companyName: '', shares: '', avgCostBasis: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Edit holding modal
  const [editHolding, setEditHolding] = useState<Holding | null>(null)
  const [editForm, setEditForm] = useState({ shares: '', companyName: '', avgCostBasis: '' })
  const [editSaving, setEditSaving] = useState(false)

  // Delete confirmation
  const [deletingHoldingId, setDeletingHoldingId] = useState<number | null>(null)

  const loadPortfolio = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.portfolios.get(portfolioId)
      setPortfolio(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }, [portfolioId])

  useEffect(() => { loadPortfolio() }, [loadPortfolio])

  const fetchQuotes = async (holdings: Holding[]) => {
    if (holdings.length === 0) return
    setLoadingQuotes(true)
    const results = await Promise.allSettled(
      holdings.map(h => api.stocks.quote(h.symbol).then(q => ({ symbol: h.symbol, quote: q })))
    )
    const map: Record<string, StockQuote> = {}
    for (const r of results) {
      if (r.status === 'fulfilled') map[r.value.symbol] = r.value.quote
    }
    setQuotes(map)
    setLoadingQuotes(false)
  }

  useEffect(() => {
    if (portfolio?.holdings?.length) fetchQuotes(portfolio.holdings)
  }, [portfolio?.holdings?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    if (!addForm.symbol.trim() || !addForm.shares) return
    try {
      setAddSaving(true)
      await api.holdings.create(portfolioId, {
        symbol: addForm.symbol.trim(),
        companyName: addForm.companyName.trim() || undefined,
        shares: parseFloat(addForm.shares),
        avgCostBasis: addForm.avgCostBasis ? parseFloat(addForm.avgCostBasis) : undefined,
      })
      setAddForm({ symbol: '', companyName: '', shares: '', avgCostBasis: '' })
      setShowAddModal(false)
      await loadPortfolio()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add holding')
    } finally {
      setAddSaving(false)
    }
  }

  const openEdit = (h: Holding) => {
    setEditHolding(h)
    setEditForm({ shares: String(h.shares), companyName: h.companyName ?? '', avgCostBasis: h.avgCostBasis != null ? String(h.avgCostBasis) : '' })
  }

  const handleEditHolding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editHolding || !editForm.shares) return
    try {
      setEditSaving(true)
      await api.holdings.update(portfolioId, editHolding.id, {
        shares: parseFloat(editForm.shares),
        companyName: editForm.companyName.trim() || undefined,
        avgCostBasis: editForm.avgCostBasis ? parseFloat(editForm.avgCostBasis) : undefined,
      })
      setEditHolding(null)
      await loadPortfolio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update holding')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteHolding = async (holdingId: number) => {
    try {
      await api.holdings.delete(portfolioId, holdingId)
      setDeletingHoldingId(null)
      await loadPortfolio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete holding')
    }
  }

  const handleDeletePortfolio = async () => {
    if (!confirm(`Delete portfolio "${portfolio?.name}"? This cannot be undone.`)) return
    try {
      await api.portfolios.delete(portfolioId)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete portfolio')
    }
  }

  const totalValue = portfolio?.holdings?.reduce((sum, h) => {
    const q = quotes[h.symbol]
    return sum + (q ? q.price * h.shares : 0)
  }, 0) ?? 0

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (error && !portfolio) return <div className="page"><div className="alert alert-error">{error}<br /><Link to="/">← Back</Link></div></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link to="/">Portfolios</Link> / {portfolio?.name}</div>
          <h1>{portfolio?.name}</h1>
          {portfolio?.description && <p className="text-muted">{portfolio.description}</p>}
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost btn-sm" onClick={handleDeletePortfolio}>Delete Portfolio</button>
          {(portfolio?.holdings?.length ?? 0) > 0 && (
            <Link to={`/portfolio/${portfolioId}/simulate`} className="btn btn-primary">
              Run Simulation →
            </Link>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="section-header">
        <h2>Holdings</h2>
        <div className="section-actions">
          {(portfolio?.holdings?.length ?? 0) > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => portfolio?.holdings && fetchQuotes(portfolio.holdings)} disabled={loadingQuotes}>
              {loadingQuotes ? 'Refreshing…' : '↻ Refresh Prices'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowAddModal(true)}>+ Add Holding</button>
        </div>
      </div>

      {(portfolio?.holdings?.length ?? 0) === 0 ? (
        <div className="empty-state-sm">
          <p>No holdings yet. Add your first stock.</p>
          <button className="btn btn-secondary" onClick={() => setShowAddModal(true)}>+ Add Holding</button>
        </div>
      ) : (
        <>
          {totalValue > 0 && (
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-label">Portfolio Value</span>
                <span className="stat-value">{formatCurrency(totalValue)}</span>
                <span className="stat-note">at current prices</span>
              </div>
            </div>
          )}
          <div className="table-wrapper">
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Company</th>
                  <th className="num">Shares</th>
                  <th className="num">Price</th>
                  <th className="num">Value</th>
                  <th className="num">Avg Cost</th>
                  <th className="num">Change</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {portfolio?.holdings?.map(h => {
                  const q = quotes[h.symbol]
                  const value = q ? q.price * h.shares : null
                  return (
                    <tr key={h.id}>
                      <td><span className="symbol-badge">{h.symbol}</span></td>
                      <td className="company-name">{h.companyName ?? '—'}</td>
                      <td className="num">{h.shares.toLocaleString()}</td>
                      <td className="num">{q ? formatCurrency(q.price) : <span className="text-muted">—</span>}</td>
                      <td className="num">{value != null ? formatCurrency(value) : <span className="text-muted">—</span>}</td>
                      <td className="num">{h.avgCostBasis != null ? formatCurrency(h.avgCostBasis) : <span className="text-muted">—</span>}</td>
                      <td className="num">
                        {q ? (
                          <span className={q.changePercent >= 0 ? 'positive' : 'negative'}>
                            {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="row-actions">
                        <button className="btn-icon" onClick={() => openEdit(h)} title="Edit">✎</button>
                        <button className="btn-icon danger" onClick={() => setDeletingHoldingId(h.id)} title="Delete">✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add Holding Modal */}
      {showAddModal && (
        <Modal title="Add Holding" onClose={() => { setShowAddModal(false); setAddError(null) }}>
          <form onSubmit={handleAddHolding} className="form">
            {addError && <div className="alert alert-error">{addError}</div>}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="add-symbol">Ticker symbol *</label>
                <input id="add-symbol" type="text" value={addForm.symbol} onChange={e => setAddForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} placeholder="e.g. AAPL" required autoFocus />
              </div>
              <div className="form-group">
                <label htmlFor="add-company">Company name</label>
                <input id="add-company" type="text" value={addForm.companyName} onChange={e => setAddForm(f => ({ ...f, companyName: e.target.value }))} placeholder="e.g. Apple Inc." />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="add-shares">Shares *</label>
                <input id="add-shares" type="number" min="0.0001" step="any" value={addForm.shares} onChange={e => setAddForm(f => ({ ...f, shares: e.target.value }))} placeholder="e.g. 10" required />
              </div>
              <div className="form-group">
                <label htmlFor="add-cost">Avg cost basis / share ($)</label>
                <input id="add-cost" type="number" min="0" step="any" value={addForm.avgCostBasis} onChange={e => setAddForm(f => ({ ...f, avgCostBasis: e.target.value }))} placeholder="e.g. 145.00" />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={addSaving}>{addSaving ? 'Adding…' : 'Add Holding'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Holding Modal */}
      {editHolding && (
        <Modal title={`Edit ${editHolding.symbol}`} onClose={() => setEditHolding(null)}>
          <form onSubmit={handleEditHolding} className="form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-shares">Shares *</label>
                <input id="edit-shares" type="number" min="0.0001" step="any" value={editForm.shares} onChange={e => setEditForm(f => ({ ...f, shares: e.target.value }))} required autoFocus />
              </div>
              <div className="form-group">
                <label htmlFor="edit-cost">Avg cost basis / share ($)</label>
                <input id="edit-cost" type="number" min="0" step="any" value={editForm.avgCostBasis} onChange={e => setEditForm(f => ({ ...f, avgCostBasis: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="edit-company">Company name</label>
              <input id="edit-company" type="text" value={editForm.companyName} onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditHolding(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Holding Confirmation */}
      {deletingHoldingId != null && (
        <Modal title="Delete Holding" onClose={() => setDeletingHoldingId(null)}>
          <p>Remove this holding from the portfolio?</p>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setDeletingHoldingId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => handleDeleteHolding(deletingHoldingId)}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
