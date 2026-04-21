import type { Portfolio, Holding, SimulationParams, SimulationResult, StockQuote, SuggestedParams, T212Portfolio, T212SimulationResult, AccountDividendSummary } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json.data as T
}

export const api = {
  portfolios: {
    list: () => request<Portfolio[]>('/api/portfolios'),

    get: (id: number) => request<Portfolio>(`/api/portfolios/${id}`),

    create: (data: { name: string; description?: string }) =>
      request<Portfolio>('/api/portfolios', { method: 'POST', body: JSON.stringify(data) }),

    update: (id: number, data: { name: string; description?: string }) =>
      request<Portfolio>(`/api/portfolios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id: number) =>
      request<{ success: boolean }>(`/api/portfolios/${id}`, { method: 'DELETE' }),
  },

  holdings: {
    create: (
      portfolioId: number,
      data: { symbol: string; companyName?: string; shares: number; avgCostBasis?: number }
    ) =>
      request<Holding>(`/api/portfolios/${portfolioId}/holdings`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (
      portfolioId: number,
      holdingId: number,
      data: { shares: number; companyName?: string; avgCostBasis?: number }
    ) =>
      request<Holding>(`/api/portfolios/${portfolioId}/holdings/${holdingId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (portfolioId: number, holdingId: number) =>
      request<{ success: boolean }>(
        `/api/portfolios/${portfolioId}/holdings/${holdingId}`,
        { method: 'DELETE' }
      ),
  },

  stocks: {
    quote: (symbol: string) => request<StockQuote>(`/api/stocks/${symbol}/quote`),
  },

  t212: {
    portfolio: () => request<T212Portfolio>('/api/t212/portfolio'),

    dividends: () => request<AccountDividendSummary>('/api/t212/dividends'),

    suggestParams: () => request<SuggestedParams>('/api/t212/suggested-params'),

    simulate: (params: Omit<SimulationParams, never>) =>
      request<T212SimulationResult>('/api/t212/simulate', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
  },

  suggestParams: (portfolioId: number) =>
    request<SuggestedParams>(`/api/portfolios/${portfolioId}/suggested-params`),

  simulate: (portfolioId: number, params: SimulationParams) =>
    request<SimulationResult>(`/api/portfolios/${portfolioId}/simulate`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}
