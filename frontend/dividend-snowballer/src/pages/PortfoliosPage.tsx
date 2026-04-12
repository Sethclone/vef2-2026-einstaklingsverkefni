import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import Modal from '../components/Modal'
import type { Portfolio } from '../types'

export default function PortfoliosPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.portfolios.list()
      setPortfolios(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return
    try {
      setSaving(true)
      await api.portfolios.create({ name: formName.trim(), description: formDesc.trim() || undefined })
      setFormName('')
      setFormDesc('')
      setShowModal(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create portfolio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Your Portfolios</h1>
          <p className="text-muted">Build a portfolio and simulate dividend snowball growth over time.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Portfolio
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading portfolios…</div>
      ) : portfolios.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">❄</div>
          <h2>No portfolios yet</h2>
          <p>Create your first portfolio to get started with dividend snowball simulation.</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create Portfolio</button>
        </div>
      ) : (
        <div className="portfolio-grid">
          {portfolios.map(p => (
            <div key={p.id} className="portfolio-card" onClick={() => navigate(`/portfolio/${p.id}`)}>
              <div className="portfolio-card-header">
                <h2>{p.name}</h2>
                <span className="badge">{p._count?.holdings ?? 0} holdings</span>
              </div>
              {p.description && <p className="portfolio-desc">{p.description}</p>}
              <div className="portfolio-card-footer">
                <span className="text-muted text-sm">
                  {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <button className="btn btn-ghost btn-sm">View →</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="New Portfolio" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="form">
            <div className="form-group">
              <label htmlFor="port-name">Portfolio name</label>
              <input
                id="port-name"
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Dividend Growth Portfolio"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="port-desc">Description (optional)</label>
              <input
                id="port-desc"
                type="text"
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="e.g. Blue-chip dividend payers"
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Creating…' : 'Create Portfolio'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
