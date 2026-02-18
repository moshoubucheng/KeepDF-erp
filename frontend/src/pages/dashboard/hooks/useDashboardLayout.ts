import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '@/api/endpoints/dashboard'
import { normalizeLayout, DEFAULT_LAYOUT, type WidgetLayoutItem } from '../widget-registry'

const LS_KEY = 'erp_dashboard_layout'

function readLocalCache(): unknown[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function writeLocalCache(layout: WidgetLayoutItem[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(layout))
  } catch { /* ignore */ }
}

export function useDashboardLayout(isAdmin: boolean) {
  const queryClient = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const [layout, setLayoutState] = useState<WidgetLayoutItem[]>(() =>
    normalizeLayout(readLocalCache(), isAdmin),
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch layout from server
  const layoutQuery = useQuery({
    queryKey: ['dashboard', 'layout'],
    queryFn: () => dashboardApi.getLayout(),
    staleTime: 300_000,
  })

  // Sync server data into state on first load
  const serverSynced = useRef(false)
  useEffect(() => {
    if (layoutQuery.data && !serverSynced.current) {
      serverSynced.current = true
      const normalized = normalizeLayout(layoutQuery.data.layout, isAdmin)
      setLayoutState(normalized)
      writeLocalCache(normalized)
    }
  }, [layoutQuery.data, isAdmin])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (items: WidgetLayoutItem[]) => dashboardApi.saveLayout(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'layout'] })
    },
  })

  // Debounced save
  const debouncedSave = useCallback((items: WidgetLayoutItem[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveMutation.mutate(items)
    }, 800)
  }, [saveMutation])

  const updateLayout = useCallback((updater: (prev: WidgetLayoutItem[]) => WidgetLayoutItem[]) => {
    setLayoutState(prev => {
      const next = updater(prev)
      writeLocalCache(next)
      debouncedSave(next)
      return next
    })
  }, [debouncedSave])

  const reorderWidgets = useCallback((activeId: string, overId: string) => {
    updateLayout(prev => {
      const items = [...prev]
      const oldIndex = items.findIndex(i => i.widgetId === activeId)
      const newIndex = items.findIndex(i => i.widgetId === overId)
      if (oldIndex === -1 || newIndex === -1) return prev
      const [moved] = items.splice(oldIndex, 1)
      items.splice(newIndex, 0, moved)
      items.forEach((item, i) => { item.order = i })
      return items
    })
  }, [updateLayout])

  const moveWidget = useCallback((widgetId: string, direction: 'up' | 'down') => {
    updateLayout(prev => {
      const visibleItems = prev.filter(i => i.visible)
      const idx = visibleItems.findIndex(i => i.widgetId === widgetId)
      if (idx === -1) return prev
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= visibleItems.length) return prev

      const items = [...prev]
      const aIdx = items.findIndex(i => i.widgetId === visibleItems[idx].widgetId)
      const bIdx = items.findIndex(i => i.widgetId === visibleItems[swapIdx].widgetId)
      const tmpOrder = items[aIdx].order
      items[aIdx] = { ...items[aIdx], order: items[bIdx].order }
      items[bIdx] = { ...items[bIdx], order: tmpOrder }
      items.sort((a, b) => a.order - b.order)
      items.forEach((item, i) => { item.order = i })
      return items
    })
  }, [updateLayout])

  const toggleVisibility = useCallback((widgetId: string) => {
    updateLayout(prev =>
      prev.map(i => i.widgetId === widgetId ? { ...i, visible: !i.visible } : i),
    )
  }, [updateLayout])

  const setWidgetWidth = useCallback((widgetId: string, width: 1 | 2) => {
    updateLayout(prev =>
      prev.map(i => i.widgetId === widgetId ? { ...i, width } : i),
    )
  }, [updateLayout])

  const resetLayout = useCallback(() => {
    const defaultItems = normalizeLayout(DEFAULT_LAYOUT, isAdmin)
    setLayoutState(defaultItems)
    writeLocalCache(defaultItems)
    saveMutation.mutate(defaultItems)
  }, [isAdmin, saveMutation])

  const visibleWidgets = layout.filter(i => i.visible)
  const hiddenWidgets = layout.filter(i => !i.visible)

  return {
    layout,
    visibleWidgets,
    hiddenWidgets,
    editMode,
    setEditMode,
    reorderWidgets,
    moveWidget,
    toggleVisibility,
    setWidgetWidth,
    resetLayout,
    isSaving: saveMutation.isPending,
  }
}
