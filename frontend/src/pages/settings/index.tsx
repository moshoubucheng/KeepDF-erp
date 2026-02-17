import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Shield, Settings } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/utils/cn'
import { ProfileTab } from './ProfileTab'
import { SecurityTab } from './SecurityTab'
import { SystemTab } from './SystemTab'

type TabId = 'profile' | 'security' | 'system'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user, isAdmin, fetchMe } = useAuthStore()
  const addToast = useUIStore((s) => s.addToast)
  const [activeTab, setActiveTab] = useState<TabId>('profile')

  const tabs: Tab[] = [
    { id: 'profile', label: t('settings.profile', 'Profile'), icon: <User size={16} /> },
    { id: 'security', label: t('settings.security', 'Security'), icon: <Shield size={16} /> },
    { id: 'system', label: t('settings.system', 'System'), icon: <Settings size={16} />, adminOnly: true },
  ]

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t('settings.title', 'Settings')}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t('settings.subtitle', 'Manage your account and system configuration')}
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer',
              'border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-accent-purple text-accent-purple'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profile' && <ProfileTab user={user} addToast={addToast} fetchMe={fetchMe} />}
      {activeTab === 'security' && <SecurityTab user={user} addToast={addToast} fetchMe={fetchMe} />}
      {activeTab === 'system' && isAdmin && <SystemTab addToast={addToast} />}
    </div>
  )
}
