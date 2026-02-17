import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, PackagePlus, RefreshCw, BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/utils/cn'

interface QuickAction {
  labelKey: string
  icon: React.ReactNode
  path: string
  color: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    labelKey: 'dashboard.quick_new_order',
    icon: <Plus className="h-4 w-4" />,
    path: '/orders',
    color: 'bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20',
  },
  {
    labelKey: 'dashboard.quick_add_product',
    icon: <PackagePlus className="h-4 w-4" />,
    path: '/inventory',
    color: 'bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20',
  },
  {
    labelKey: 'dashboard.quick_sync_platforms',
    icon: <RefreshCw className="h-4 w-4" />,
    path: '/settings',
    color: 'bg-accent-emerald/10 text-accent-emerald hover:bg-accent-emerald/20',
  },
  {
    labelKey: 'dashboard.quick_view_reports',
    icon: <BarChart3 className="h-4 w-4" />,
    path: '/reports',
    color: 'bg-accent-amber/10 text-accent-amber hover:bg-accent-amber/20',
  },
]

export function QuickActions() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-xs font-medium text-text-muted mr-1">
            {t('dashboard.quick_actions')}
          </span>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                action.color,
              )}
            >
              {action.icon}
              {t(action.labelKey)}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
