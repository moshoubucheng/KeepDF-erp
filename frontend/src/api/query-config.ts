import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { ApiError } from './client'
import { useUIStore } from '@/stores/ui.store'

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Don't retry client errors (4xx)
  if (error instanceof ApiError && error.status < 500) return false
  return failureCount < 3
}

function retryDelay(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 8000)
  const jitter = Math.random() * 500
  return base + jitter
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        // Skip 401 — already handled by api client (auto-logout)
        if (error instanceof ApiError && error.status === 401) return

        const message = error instanceof ApiError
          ? error.data.error || error.message
          : 'An unexpected error occurred'
        useUIStore.getState().addToast('error', message)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // Skip if the mutation already has its own onError handler
        if (mutation.options.onError) return
        // Skip 401
        if (error instanceof ApiError && error.status === 401) return

        const message = error instanceof ApiError
          ? error.data.error || error.message
          : 'An unexpected error occurred'
        useUIStore.getState().addToast('error', message)
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        retryDelay,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
