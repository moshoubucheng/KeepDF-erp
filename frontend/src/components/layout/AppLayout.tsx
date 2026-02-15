import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Sidebar -- fixed 250px on desktop, overlay on mobile */}
      <Sidebar />

      {/* Main content area -- offset by sidebar width on desktop */}
      <div className="flex flex-1 flex-col md:ml-[250px]">
        <Header />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
