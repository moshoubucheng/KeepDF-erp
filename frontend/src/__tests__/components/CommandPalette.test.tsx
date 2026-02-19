import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor, act } from '../helpers/render'
import { CommandPalette } from '@/components/ui/CommandPalette'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock useGlobalSearch to avoid async API calls in tests
import { useState } from 'react'
const emptySearchResults = { success: true, orders: { items: [], total: 0 }, products: { items: [], total: 0 }, customers: { items: [], total: 0 } }
vi.mock('@/hooks/useGlobalSearch', () => ({
  useGlobalSearch: () => {
    const [query, setQuery] = useState('')
    return {
      query,
      setQuery,
      results: emptySearchResults,
      isSearching: false,
      history: [],
      addToHistory: vi.fn(),
      clearHistory: vi.fn(),
    }
  },
}))

function dispatchKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }),
    )
  })
}

beforeEach(() => {
  mockNavigate.mockClear()
  Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true })
})

describe('CommandPalette', () => {
  it('opens with Cmd+K', async () => {
    render(<CommandPalette />)

    expect(screen.queryByPlaceholderText('search.global_placeholder')).not.toBeInTheDocument()

    dispatchKey('k', { metaKey: true })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('search.global_placeholder')).toBeInTheDocument()
    })
  })

  it('closes with Escape', async () => {
    render(<CommandPalette />)

    dispatchKey('k', { metaKey: true })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('search.global_placeholder')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('search.global_placeholder')).not.toBeInTheDocument()
    })
  })

  it('shows navigation items', async () => {
    render(<CommandPalette />)

    dispatchKey('k', { metaKey: true })

    await waitFor(() => {
      expect(screen.getByText('cmd.group.navigation')).toBeInTheDocument()
    })
  })

  it('filters results based on search query', async () => {
    render(<CommandPalette />)

    dispatchKey('k', { metaKey: true })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('search.global_placeholder')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('search.global_placeholder'), 'zzzzz')

    await waitFor(() => {
      expect(screen.getByText('search.no_results')).toBeInTheDocument()
    })
  })

  it('navigates on Enter', async () => {
    render(<CommandPalette />)

    dispatchKey('k', { metaKey: true })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('search.global_placeholder')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows shortcuts help with Cmd+/', async () => {
    render(<CommandPalette />)

    dispatchKey('/', { metaKey: true })

    await waitFor(() => {
      // Title appears in both header and content — use getAllByText
      const titles = screen.getAllByText('cmd.shortcuts_title')
      expect(titles.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('navigates items with arrow keys', async () => {
    render(<CommandPalette />)

    dispatchKey('k', { metaKey: true })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('search.global_placeholder')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.keyboard('{ArrowDown}')

    const selectedItems = document.querySelectorAll('[data-selected="true"]')
    expect(selectedItems.length).toBe(1)
  })

  it('closes on backdrop click', async () => {
    render(<CommandPalette />)

    dispatchKey('k', { metaKey: true })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('search.global_placeholder')).toBeInTheDocument()
    })

    // Click the overlay backdrop
    const user = userEvent.setup()
    const overlay = document.querySelector('.fixed.inset-0')
    if (overlay) {
      await user.click(overlay as HTMLElement)
    }

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('search.global_placeholder')).not.toBeInTheDocument()
    })
  })
})
