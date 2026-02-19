import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchApi } from '@/api/endpoints/search'
import type { SearchResponse } from '@/api/types'

const HISTORY_KEY = 'erp_search_history'
const MAX_HISTORY = 8
const DEBOUNCE_MS = 300

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(items: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)))
}

export function useGlobalSearch() {
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<string[]>(loadHistory)
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS)

  const enabled = debouncedQuery.trim().length >= 2

  const { data, isLoading, isFetching } = useQuery<SearchResponse>({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => searchApi.search({ q: debouncedQuery.trim(), limit: 5 }),
    enabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const addToHistory = useCallback((term: string) => {
    const trimmed = term.trim()
    if (trimmed.length < 2) return
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY)
      saveHistory(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }, [])

  return {
    query,
    setQuery,
    results: enabled ? data ?? null : null,
    isSearching: enabled && (isLoading || isFetching),
    history,
    addToHistory,
    clearHistory,
  }
}
