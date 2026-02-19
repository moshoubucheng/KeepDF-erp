import { useTranslation } from 'react-i18next'
import { ShoppingCart, Package, Users, Loader2, Clock, X } from 'lucide-react'
import type { SearchResponse, SearchResultItem } from '@/api/types'
import { cn } from '@/utils/cn'

interface GlobalSearchResultsProps {
  results: SearchResponse | null
  isSearching: boolean
  query: string
  history: string[]
  selectedIndex: number
  onSelectResult: (item: SearchResultItem) => void
  onSelectHistory: (term: string) => void
  onClearHistory: () => void
  onHoverIndex: (index: number) => void
}

export function GlobalSearchResults({
  results,
  isSearching,
  query,
  history,
  selectedIndex,
  onSelectResult,
  onSelectHistory,
  onClearHistory,
  onHoverIndex,
}: GlobalSearchResultsProps) {
  const { t } = useTranslation()
  const trimmedQuery = query.trim()

  // Show search history when query is empty or < 2 chars
  if (trimmedQuery.length < 2) {
    if (history.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-sm text-text-muted">
          {t('search.min_chars')}
        </div>
      )
    }

    return (
      <div className="py-2">
        <div className="flex items-center justify-between px-4 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {t('search.recent')}
          </span>
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
          >
            <X className="h-3 w-3" />
            {t('search.clear_recent')}
          </button>
        </div>
        {history.map((term, i) => (
          <button
            key={term}
            data-selected={selectedIndex === i}
            onClick={() => onSelectHistory(term)}
            onMouseEnter={() => onHoverIndex(i)}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer',
              selectedIndex === i
                ? 'bg-accent-purple/15 text-accent-purple'
                : 'text-text-secondary hover:bg-bg-input hover:text-text-primary',
            )}
          >
            <Clock className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{term}</span>
          </button>
        ))}
      </div>
    )
  }

  // Loading spinner
  if (isSearching && !results) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('search.placeholder')}
      </div>
    )
  }

  if (!results) return null

  const { orders, products, customers } = results
  const totalCount = orders.items.length + products.items.length + customers.items.length

  if (totalCount === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-text-muted">
        {t('search.no_results')}
      </div>
    )
  }

  // Build flat list for keyboard navigation indexing
  let flatIndex = 0

  const groups: { key: string; labelKey: string; icon: typeof ShoppingCart; items: SearchResultItem[]; startIndex: number }[] = []

  if (orders.items.length > 0) {
    groups.push({ key: 'orders', labelKey: 'search.group.orders', icon: ShoppingCart, items: orders.items, startIndex: flatIndex })
    flatIndex += orders.items.length
  }
  if (products.items.length > 0) {
    groups.push({ key: 'products', labelKey: 'search.group.products', icon: Package, items: products.items, startIndex: flatIndex })
    flatIndex += products.items.length
  }
  if (customers.items.length > 0) {
    groups.push({ key: 'customers', labelKey: 'search.group.customers', icon: Users, items: customers.items, startIndex: flatIndex })
    flatIndex += customers.items.length
  }

  return (
    <div className="py-2">
      {isSearching && (
        <div className="flex items-center gap-2 px-4 py-1 text-[11px] text-text-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
        </div>
      )}
      {groups.map((group) => {
        const Icon = group.icon
        return (
          <div key={group.key}>
            <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {t(group.labelKey)}
            </div>
            {group.items.map((item, i) => {
              const idx = group.startIndex + i
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  data-selected={selectedIndex === idx}
                  onClick={() => onSelectResult(item)}
                  onMouseEnter={() => onHoverIndex(idx)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer',
                    selectedIndex === idx
                      ? 'bg-accent-purple/15 text-accent-purple'
                      : 'text-text-secondary hover:bg-bg-input hover:text-text-primary',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <div className="truncate font-medium">{item.title}</div>
                    {item.subtitle && (
                      <div className="truncate text-xs text-text-muted">{item.subtitle}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )
      })}
      <div className="px-4 py-1.5 text-[11px] text-text-muted text-center">
        {t('search.results_count', { count: orders.total + products.total + customers.total })}
      </div>
    </div>
  )
}
