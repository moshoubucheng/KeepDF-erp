import { describe, it, expect } from 'vitest'
import { normalizeLayout, DEFAULT_LAYOUT, WIDGET_REGISTRY, ALL_WIDGET_IDS } from '../pages/dashboard/widget-registry'

describe('normalizeLayout', () => {
  it('returns default layout for null/undefined input', () => {
    const result = normalizeLayout(null, true)
    expect(result).toHaveLength(ALL_WIDGET_IDS.length)
    expect(result[0].widgetId).toBe('stats')
    expect(result.every(i => i.visible)).toBe(true)
  })

  it('returns default layout for non-array input', () => {
    const result = normalizeLayout('invalid', false)
    // non-admin: should not have adminCharts
    const adminWidget = result.find(i => i.widgetId === 'adminCharts')
    expect(adminWidget).toBeUndefined()
  })

  it('filters admin-only widgets for non-admin users', () => {
    const result = normalizeLayout(DEFAULT_LAYOUT, false)
    expect(result.find(i => i.widgetId === 'adminCharts')).toBeUndefined()
  })

  it('includes admin-only widgets for admin users', () => {
    const result = normalizeLayout(DEFAULT_LAYOUT, true)
    expect(result.find(i => i.widgetId === 'adminCharts')).toBeDefined()
  })

  it('preserves custom order', () => {
    const custom = [
      { widgetId: 'recentOrders', order: 0, visible: true, width: 2 },
      { widgetId: 'stats', order: 1, visible: true, width: 2 },
    ]
    const result = normalizeLayout(custom, false)
    expect(result[0].widgetId).toBe('recentOrders')
    expect(result[1].widgetId).toBe('stats')
  })

  it('adds missing widgets at the end', () => {
    const partial = [
      { widgetId: 'stats', order: 0, visible: true, width: 2 },
    ]
    const result = normalizeLayout(partial, false)
    expect(result[0].widgetId).toBe('stats')
    // Should have all non-admin widgets
    const nonAdminCount = ALL_WIDGET_IDS.filter(id => !WIDGET_REGISTRY[id].adminOnly).length
    expect(result).toHaveLength(nonAdminCount)
  })

  it('fills missing width with default', () => {
    const noWidth = [
      { widgetId: 'stats', order: 0, visible: true },
    ]
    const result = normalizeLayout(noWidth, false)
    expect(result[0].width).toBe(WIDGET_REGISTRY.stats.defaultWidth)
  })

  it('preserves visibility settings', () => {
    const layout = [
      { widgetId: 'stats', order: 0, visible: false, width: 2 },
      { widgetId: 'quickActions', order: 1, visible: true, width: 1 },
    ]
    const result = normalizeLayout(layout, false)
    expect(result.find(i => i.widgetId === 'stats')?.visible).toBe(false)
    expect(result.find(i => i.widgetId === 'quickActions')?.width).toBe(1)
  })

  it('skips unknown widget IDs', () => {
    const layout = [
      { widgetId: 'unknownWidget', order: 0, visible: true, width: 2 },
      { widgetId: 'stats', order: 1, visible: true, width: 2 },
    ]
    const result = normalizeLayout(layout, false)
    expect(result.find(i => i.widgetId === 'unknownWidget')).toBeUndefined()
  })

  it('skips duplicate widget IDs', () => {
    const layout = [
      { widgetId: 'stats', order: 0, visible: true, width: 2 },
      { widgetId: 'stats', order: 1, visible: false, width: 1 },
    ]
    const result = normalizeLayout(layout, false)
    const statsItems = result.filter(i => i.widgetId === 'stats')
    expect(statsItems).toHaveLength(1)
    expect(statsItems[0].visible).toBe(true) // first one wins
  })

  it('re-indexes order sequentially', () => {
    const layout = [
      { widgetId: 'recentOrders', order: 10, visible: true, width: 2 },
      { widgetId: 'stats', order: 5, visible: true, width: 2 },
    ]
    const result = normalizeLayout(layout, false)
    expect(result[0].order).toBe(0)
    expect(result[1].order).toBe(1)
  })
})
