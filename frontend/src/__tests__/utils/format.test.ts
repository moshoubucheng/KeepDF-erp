import { describe, it, expect } from 'vitest'
import { formatCurrency, formatNumber, formatDate, formatDateShort, formatPercent } from '@/utils/format'

describe('formatCurrency', () => {
  it('formats JPY with yen symbol and thousand separators', () => {
    const result = formatCurrency(1000)
    expect(result).toContain('1,000')
    // Yen sign may be halfwidth (¥) or fullwidth (￥) depending on runtime
    expect(result).toMatch(/[¥￥]/)
  })

  it('formats zero correctly', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0')
    expect(result).toMatch(/[¥￥]/)
  })

  it('formats large numbers', () => {
    const result = formatCurrency(1234567)
    expect(result).toContain('1,234,567')
  })
})

describe('formatNumber', () => {
  it('adds thousand separators', () => {
    expect(formatNumber(1000)).toBe('1,000')
  })

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('handles large numbers', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })
})

describe('formatDate', () => {
  it('formats date string to ja-JP locale', () => {
    const result = formatDate('2024-06-15T10:30:00Z')
    // ja-JP format includes year/month/day
    expect(result).toMatch(/2024/)
    expect(result).toMatch(/06/)
    expect(result).toMatch(/15/)
  })

  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('-')
  })
})

describe('formatDateShort', () => {
  it('formats to short date (month/day)', () => {
    const result = formatDateShort('2024-06-15T10:30:00Z')
    expect(result).toMatch(/06/)
    expect(result).toMatch(/15/)
    // Should not contain year
    expect(result).not.toMatch(/2024/)
  })

  it('returns dash for empty string', () => {
    expect(formatDateShort('')).toBe('-')
  })
})

describe('formatPercent', () => {
  it('formats decimal to percentage', () => {
    expect(formatPercent(0.5)).toBe('50.0%')
  })

  it('formats with custom decimals', () => {
    expect(formatPercent(0.1234, 2)).toBe('12.34%')
  })

  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })
})
