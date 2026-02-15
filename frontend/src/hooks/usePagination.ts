import { useState, useCallback } from 'react'

interface PaginationState {
  page: number
  limit: number
}

export function usePagination(initialLimit = 20) {
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: initialLimit })

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }))
  }, [])

  const nextPage = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
  }, [])

  const prevPage = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
  }, [])

  const resetPage = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [])

  return { ...pagination, setPage, nextPage, prevPage, resetPage }
}
