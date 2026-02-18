export interface WidgetLayoutItem {
  widgetId: string
  order: number
  visible: boolean
  width: 1 | 2
}

export interface WidgetDefinition {
  id: string
  titleKey: string
  defaultWidth: 1 | 2
  adminOnly: boolean
}

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  stats: { id: 'stats', titleKey: 'dashboard.widget.stats', defaultWidth: 2, adminOnly: false },
  quickActions: { id: 'quickActions', titleKey: 'dashboard.widget.quickActions', defaultWidth: 2, adminOnly: false },
  trendChart: { id: 'trendChart', titleKey: 'dashboard.widget.trendChart', defaultWidth: 2, adminOnly: false },
  platformCharts: { id: 'platformCharts', titleKey: 'dashboard.widget.platformCharts', defaultWidth: 2, adminOnly: false },
  adminCharts: { id: 'adminCharts', titleKey: 'dashboard.widget.adminCharts', defaultWidth: 2, adminOnly: true },
  recentOrders: { id: 'recentOrders', titleKey: 'dashboard.widget.recentOrders', defaultWidth: 2, adminOnly: false },
}

export const ALL_WIDGET_IDS = Object.keys(WIDGET_REGISTRY)

export const DEFAULT_LAYOUT: WidgetLayoutItem[] = ALL_WIDGET_IDS.map((id, i) => ({
  widgetId: id,
  order: i,
  visible: true,
  width: WIDGET_REGISTRY[id].defaultWidth,
}))

/**
 * Normalize a raw layout from the backend:
 * - Filter out admin-only widgets for non-admin users
 * - Add missing widgets (new ones added after user saved layout)
 * - Fill in missing `width` field with defaults
 * - Re-index order
 */
export function normalizeLayout(raw: unknown, isAdmin: boolean): WidgetLayoutItem[] {
  const items: WidgetLayoutItem[] = []
  const seen = new Set<string>()

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object' || typeof item.widgetId !== 'string') continue
      const def = WIDGET_REGISTRY[item.widgetId]
      if (!def) continue
      if (def.adminOnly && !isAdmin) continue
      if (seen.has(item.widgetId)) continue
      seen.add(item.widgetId)
      items.push({
        widgetId: item.widgetId,
        order: typeof item.order === 'number' ? item.order : items.length,
        visible: typeof item.visible === 'boolean' ? item.visible : true,
        width: item.width === 1 || item.width === 2 ? item.width : def.defaultWidth,
      })
    }
  }

  // Add any missing widgets
  for (const id of ALL_WIDGET_IDS) {
    const def = WIDGET_REGISTRY[id]
    if (def.adminOnly && !isAdmin) continue
    if (seen.has(id)) continue
    items.push({
      widgetId: id,
      order: items.length,
      visible: true,
      width: def.defaultWidth,
    })
  }

  // Sort by order and re-index
  items.sort((a, b) => a.order - b.order)
  items.forEach((item, i) => { item.order = i })

  return items
}
