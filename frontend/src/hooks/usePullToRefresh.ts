import { useState, useRef, useCallback } from 'react'

interface PullToRefreshState {
  pulling: boolean
  pullDistance: number
  refreshing: boolean
}

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number
  maxPull?: number
  enabled?: boolean
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  enabled = true,
}: PullToRefreshOptions) {
  const [state, setState] = useState<PullToRefreshState>({
    pulling: false,
    pullDistance: 0,
    refreshing: false,
  })

  const touchRef = useRef<{ startY: number; scrollTop: number } | null>(null)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || state.refreshing) return
      const container = e.currentTarget
      touchRef.current = {
        startY: e.touches[0].clientY,
        scrollTop: container.scrollTop,
      }
    },
    [enabled, state.refreshing],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current || !enabled || state.refreshing) return
      // Only pull when scrolled to top
      if (touchRef.current.scrollTop > 0) return

      const diff = e.touches[0].clientY - touchRef.current.startY
      if (diff <= 0) {
        setState((s) => (s.pulling ? { ...s, pulling: false, pullDistance: 0 } : s))
        return
      }

      // Apply resistance
      const distance = Math.min(diff * 0.5, maxPull)
      setState({ pulling: true, pullDistance: distance, refreshing: false })
    },
    [enabled, maxPull, state.refreshing],
  )

  const handleTouchEnd = useCallback(async () => {
    if (!touchRef.current || state.refreshing) {
      touchRef.current = null
      return
    }

    if (state.pullDistance >= threshold) {
      setState({ pulling: false, pullDistance: 0, refreshing: true })
      try {
        await onRefresh()
      } finally {
        setState({ pulling: false, pullDistance: 0, refreshing: false })
      }
    } else {
      setState({ pulling: false, pullDistance: 0, refreshing: false })
    }
    touchRef.current = null
  }, [state.pullDistance, state.refreshing, threshold, onRefresh])

  return {
    ...state,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    canTrigger: state.pullDistance >= threshold,
  }
}
