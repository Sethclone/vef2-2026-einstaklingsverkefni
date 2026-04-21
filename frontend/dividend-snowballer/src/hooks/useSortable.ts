import { useState, useMemo } from 'react'

export type SortDir = 'asc' | 'desc'

export interface SortState<K extends string> {
  key: K | null
  dir: SortDir
}

export function useSortable<K extends string, T>(
  rows: T[],
  getValue: (row: T, key: K) => string | number | null | undefined,
) {
  const [sort, setSort] = useState<SortState<K>>({ key: null, dir: 'asc' })

  const toggle = (key: K) => {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    )
  }

  const sorted = useMemo(() => {
    if (!sort.key) return rows
    const k = sort.key
    return [...rows].sort((a, b) => {
      const av = getValue(a, k) ?? ''
      const bv = getValue(b, k) ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, sort, getValue])


  const thProps = (key: K, className?: string) => ({
    onClick: () => toggle(key),
    style: { cursor: 'pointer', userSelect: 'none' as const },
    className,
    children: undefined as never,   
    'data-sort': sort.key === key ? sort.dir : undefined,
  })

  const indicator = (key: K) =>
    sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''

  return { sorted, sort, toggle, thProps, indicator }
}
