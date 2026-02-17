import { useEffect, useRef } from 'react'

interface SwipeGestureOptions {
  /** Callback when user swipes right from left edge */
  onSwipeRight?: () => void
  /** Callback when user swipes left */
  onSwipeLeft?: () => void
  /** Max X from left edge to start tracking (default 30px) */
  edgeThreshold?: number
  /** Min horizontal distance to trigger (default 60px) */
  minDistance?: number
  /** Enabled flag (default true) */
  enabled?: boolean
}

/**
 * Touch swipe gesture hook.
 * Left-edge right-swipe opens sidebar, left-swipe closes.
 */
export function useSwipeGesture({
  onSwipeRight,
  onSwipeLeft,
  edgeThreshold = 30,
  minDistance = 60,
  enabled = true,
}: SwipeGestureOptions) {
  const touchRef = useRef<{ startX: number; startY: number; fromEdge: boolean } | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        fromEdge: touch.clientX <= edgeThreshold,
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchRef.current) return
      const touch = e.changedTouches[0]
      const diffX = touch.clientX - touchRef.current.startX
      const diffY = Math.abs(touch.clientY - touchRef.current.startY)

      // Ignore if vertical scroll is dominant
      if (diffY > Math.abs(diffX)) {
        touchRef.current = null
        return
      }

      if (diffX > minDistance && touchRef.current.fromEdge) {
        onSwipeRight?.()
      } else if (diffX < -minDistance) {
        onSwipeLeft?.()
      }

      touchRef.current = null
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, edgeThreshold, minDistance, onSwipeRight, onSwipeLeft])
}
