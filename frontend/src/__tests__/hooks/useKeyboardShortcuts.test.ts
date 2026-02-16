import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts, type ShortcutDef } from '@/hooks/useKeyboardShortcuts'

function fireKeyDown(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  })
  document.dispatchEvent(event)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useKeyboardShortcuts', () => {
  it('fires handler on modifier key combo', () => {
    const handler = vi.fn()
    const shortcuts: ShortcutDef[] = [
      { key: 'k', meta: true, handler },
    ]

    // Mock Mac platform for metaKey
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true })

    renderHook(() => useKeyboardShortcuts(shortcuts))

    fireKeyDown('k', { metaKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('fires handler with Ctrl on non-Mac', () => {
    const handler = vi.fn()
    const shortcuts: ShortcutDef[] = [
      { key: 'k', meta: true, handler },
    ]

    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true })

    renderHook(() => useKeyboardShortcuts(shortcuts))

    fireKeyDown('k', { ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('skips handler when input is focused and allowInInput is false', () => {
    const handler = vi.fn()
    const shortcuts: ShortcutDef[] = [
      { key: 'k', meta: true, handler, allowInInput: false },
    ]

    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true })

    renderHook(() => useKeyboardShortcuts(shortcuts))

    // Create an input and focus it
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(event)

    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('fires handler in input when allowInInput is true', () => {
    const handler = vi.fn()
    const shortcuts: ShortcutDef[] = [
      { key: 'k', meta: true, handler, allowInInput: true },
    ]

    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true })

    renderHook(() => useKeyboardShortcuts(shortcuts))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(event)

    expect(handler).toHaveBeenCalledTimes(1)
    document.body.removeChild(input)
  })

  it('handles key sequences (vim-style)', async () => {
    const handler = vi.fn()
    const shortcuts: ShortcutDef[] = [
      { sequence: ['g', 'd'], handler },
    ]

    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true })

    renderHook(() => useKeyboardShortcuts(shortcuts))

    fireKeyDown('g')
    fireKeyDown('d')

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not fire sequence in input elements', () => {
    const handler = vi.fn()
    const shortcuts: ShortcutDef[] = [
      { sequence: ['g', 'd'], handler },
    ]

    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true })

    renderHook(() => useKeyboardShortcuts(shortcuts))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event1 = new KeyboardEvent('keydown', { key: 'g', bubbles: true })
    const event2 = new KeyboardEvent('keydown', { key: 'd', bubbles: true })
    input.dispatchEvent(event1)
    input.dispatchEvent(event2)

    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })
})
