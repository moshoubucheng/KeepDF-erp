import { useEffect, useRef, useCallback } from 'react'

export interface ShortcutDef {
  /** Single key (e.g. 'k', '/', 'f') — used with modifier combos */
  key?: string
  /** Require meta (Cmd on macOS, Ctrl on others) */
  meta?: boolean
  /** Require Shift */
  shift?: boolean
  /** Require Alt/Option */
  alt?: boolean
  /** Key sequence (e.g. ['g', 'd'] for vim-style "gd") — NO modifiers */
  sequence?: string[]
  /** Handler function */
  handler: () => void
  /** If true, fires even when an input/textarea/select is focused */
  allowInInput?: boolean
}

const SEQUENCE_TIMEOUT = 500

export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  const sequenceBufferRef = useRef<string[]>([])
  const sequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSequence = useCallback(() => {
    sequenceBufferRef.current = []
    if (sequenceTimerRef.current) {
      clearTimeout(sequenceTimerRef.current)
      sequenceTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const inputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      const isMac = navigator.platform?.toUpperCase().includes('MAC') ?? false
      const metaHeld = isMac ? e.metaKey : e.ctrlKey

      // --- Single-key + modifier shortcuts ---
      for (const s of shortcutsRef.current) {
        if (!s.key) continue
        if (inputFocused && !s.allowInInput) continue

        const wantMeta = s.meta ?? false
        const wantShift = s.shift ?? false
        const wantAlt = s.alt ?? false

        if (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          metaHeld === wantMeta &&
          e.shiftKey === wantShift &&
          e.altKey === wantAlt
        ) {
          e.preventDefault()
          e.stopPropagation()
          clearSequence()
          s.handler()
          return
        }
      }

      // --- Sequence handling ---
      if (inputFocused) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()
      if (key.length !== 1) return

      if (sequenceTimerRef.current) {
        clearTimeout(sequenceTimerRef.current)
      }

      sequenceBufferRef.current.push(key)

      for (const s of shortcutsRef.current) {
        if (!s.sequence) continue
        const seq = s.sequence.map((k) => k.toLowerCase())
        const buf = sequenceBufferRef.current

        if (buf.length === seq.length) {
          const matches = seq.every((k, i) => k === buf[i])
          if (matches) {
            e.preventDefault()
            clearSequence()
            s.handler()
            return
          }
        }
      }

      const maxLen = Math.max(
        ...shortcutsRef.current
          .filter((s) => s.sequence)
          .map((s) => s.sequence!.length),
        0,
      )

      if (sequenceBufferRef.current.length >= maxLen) {
        clearSequence()
      } else {
        sequenceTimerRef.current = setTimeout(clearSequence, SEQUENCE_TIMEOUT)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      clearSequence()
    }
  }, [clearSequence])
}
