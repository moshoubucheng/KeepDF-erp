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
  const pullDistanceRef = useRef(0)
  const refreshingRef = useRef(false)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || refreshingRef.current) return
      const container = e.currentTarget
      touchRef.current = {
        startY: e.touches[0].clientY,
        scrollTop: container.scrollTop,
      }
    },
    [enabled],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current || !enabled || refreshingRef.current) return
      // Only pull when scrolled to top
      if (touchRef.current.scrollTop > 0) return

      const diff = e.touches[0].clientY - touchRef.current.startY
      if (diff <= 0) {
        if (pullDistanceRef.current > 0) {
          pullDistanceRef.current = 0
          setState({ pulling: false, pullDistance: 0, refreshing: false })
        }
        return
      }

      // Apply resistance
      const distance = Math.min(diff * 0.5, maxPull)
      pullDistanceRef.current = distance
      setState({ pulling: true, pullDistance: distance, refreshing: false })
    },
    [enabled, maxPull],
  )

  const handleTouchEnd = useCallback(async () => {
    if (!touchRef.current || refreshingRef.current) {
      touchRef.current = null
      return
    }

    if (pullDistanceRef.current >= threshold) {
      refreshingRef.current = true
      setState({ pulling: false, pullDistance: 0, refreshing: true })
      try {
        await onRefresh()
      } finally {
        refreshingRef.current = false
        setState({ pulling: false, pullDistance: 0, refreshing: false })
      }
    } else {
      setState({ pulling: false, pullDistance: 0, refreshing: false })
    }
    pullDistanceRef.current = 0
    touchRef.current = null
  }, [threshold, onRefresh])

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
