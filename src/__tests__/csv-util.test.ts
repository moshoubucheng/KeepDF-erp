import { describe, it, expect } from 'vitest'
import { toCSV } from '../utils/csv'

describe('CSV Utility (RFC 4180)', () => {
    const columns = [
        { key: 'id', header: 'ID' },
        { key: 'name', header: '商品名' },
        { key: 'price', header: '価格' },
    ]

    it('generates correct header row', () => {
        const csv = toCSV([], columns)
        expect(csv).toBe('ID,商品名,価格')
    })

    it('generates data rows', () => {
        const data = [
            { id: 1, name: 'テスト商品', price: 1200 },
            { id: 2, name: '別の商品', price: 3800 },
        ]
        const csv = toCSV(data, columns)
        const lines = csv.split('\r\n')
        expect(lines).toHaveLength(3)
        expect(lines[1]).toBe('1,テスト商品,1200')
        expect(lines[2]).toBe('2,別の商品,3800')
    })

    it('escapes commas in fields', () => {
        const data = [{ id: 1, name: 'A, B, C', price: 100 }]
        const csv = toCSV(data, columns)
        const lines = csv.split('\r\n')
        expect(lines[1]).toBe('1,"A, B, C",100')
    })

    it('escapes double quotes in fields', () => {
        const data = [{ id: 1, name: 'He said "hello"', price: 100 }]
        const csv = toCSV(data, columns)
        const lines = csv.split('\r\n')
        expect(lines[1]).toBe('1,"He said ""hello""",100')
    })

    it('escapes newlines in fields', () => {
        const data = [{ id: 1, name: 'Line1\nLine2', price: 100 }]
        const csv = toCSV(data, columns)
        const lines = csv.split('\r\n')
        expect(lines[1]).toContain('"Line1\nLine2"')
    })

    it('handles null and undefined values', () => {
        const data = [{ id: 1, name: null, price: undefined }]
        const csv = toCSV(data as any, columns)
        const lines = csv.split('\r\n')
        expect(lines[1]).toBe('1,,')
    })

    it('handles empty data array', () => {
        const csv = toCSV([], columns)
        expect(csv).toBe('ID,商品名,価格')
    })
})
