import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/utils/cn'

export function AppLayout() {
  const { sidebarHidden } = useUIStore()

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Sidebar -- fixed 250px on desktop, overlay on mobile */}
      <Sidebar />

      {/* Main content area -- offset by sidebar width on desktop */}
      <div className={cn(
        'flex flex-1 flex-col transition-[margin] duration-200',
        sidebarHidden ? 'md:ml-0' : 'md:ml-[250px]',
      )}>
        <Header />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
