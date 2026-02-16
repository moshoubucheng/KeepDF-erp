import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useUIStore } from '@/stores/ui.store'

const initialState = useUIStore.getState()

beforeEach(() => {
  useUIStore.setState({ ...initialState, toasts: [] })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ui.store', () => {
  it('toggleTheme switches between dark and light', () => {
    // Default is dark
    expect(useUIStore.getState().theme).toBe('dark')

    useUIStore.getState().toggleTheme()
    expect(useUIStore.getState().theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    useUIStore.getState().toggleTheme()
    expect(useUIStore.getState().theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setTheme applies specific theme', () => {
    useUIStore.getState().setTheme('light')
    expect(useUIStore.getState().theme).toBe('light')
    expect(localStorage.setItem).toHaveBeenCalledWith('erp_theme', 'light')
  })

  it('addToast adds a toast and auto-removes after 4s', () => {
    useUIStore.getState().addToast('success', 'Saved!')

    const toasts = useUIStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('success')
    expect(toasts[0].message).toBe('Saved!')

    // Advance timer by 4s
    vi.advanceTimersByTime(4000)

    expect(useUIStore.getState().toasts).toHaveLength(0)
  })

  it('removeToast manually removes a toast', () => {
    useUIStore.getState().addToast('error', 'Oops')
    const id = useUIStore.getState().toasts[0].id

    useUIStore.getState().removeToast(id)
    expect(useUIStore.getState().toasts).toHaveLength(0)
  })

  it('toggleSidebar toggles sidebarOpen state', () => {
    expect(useUIStore.getState().sidebarOpen).toBe(false)

    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarOpen).toBe(true)

    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarOpen).toBe(false)
  })

  it('closeSidebar sets sidebarOpen to false', () => {
    useUIStore.getState().toggleSidebar() // open
    useUIStore.getState().closeSidebar()
    expect(useUIStore.getState().sidebarOpen).toBe(false)
  })
})
