import { describe, it, expect } from 'vitest'
import { encodeCursor, decodeCursor, buildCursorWhere } from '../utils/cursor'

describe('Cursor Utilities', () => {
    it('encodes and decodes a cursor roundtrip', () => {
        const ts = '2025-01-15T10:30:00.000Z'
        const id = 42
        const cursor = encodeCursor(ts, id)
        const decoded = decodeCursor(cursor)

        expect(decoded).not.toBeNull()
        expect(decoded!.timestamp).toBe(ts)
        expect(decoded!.id).toBe(id)
    })

    it('handles timestamps with colons correctly', () => {
        const ts = '2025-12-31 23:59:59'
        const id = 999
        const cursor = encodeCursor(ts, id)
        const decoded = decodeCursor(cursor)

        expect(decoded).not.toBeNull()
        expect(decoded!.timestamp).toBe(ts)
        expect(decoded!.id).toBe(id)
    })

    it('returns null for invalid cursor', () => {
        expect(decodeCursor('not-valid-base64!!!')).toBeNull()
        expect(decodeCursor(btoa('no-colon'))).toBeNull()
        expect(decodeCursor(btoa('timestamp:not-a-number'))).toBeNull()
    })

    it('builds DESC WHERE clause correctly', () => {
        const cursor = { timestamp: '2025-01-15T10:30:00', id: 42 }
        const { clause, binds } = buildCursorWhere(cursor)

        expect(clause).toContain('<')
        expect(clause).toContain('created_at')
        expect(binds).toEqual(['2025-01-15T10:30:00', '2025-01-15T10:30:00', 42])
    })

    it('builds ASC WHERE clause correctly', () => {
        const cursor = { timestamp: '2025-01-01', id: 1 }
        const { clause, binds } = buildCursorWhere(cursor, 'sent_at', 'ASC')

        expect(clause).toContain('>')
        expect(clause).toContain('sent_at')
        expect(binds).toEqual(['2025-01-01', '2025-01-01', 1])
    })
})
