import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Loader2 } from 'lucide-react'

export function RequireAuth() {
  const { token, user, isLoading, fetchMe } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    if (token && !user && !isLoading) {
      fetchMe()
    }
  }, [token, user, isLoading, fetchMe])

  // No token at all -- redirect to login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Token exists but user data is still loading
  if (!user || isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent-purple" />
          <span className="text-sm text-text-muted">Loading...</span>
        </div>
      </div>
    )
  }

  // User hasn't completed onboarding -- redirect (unless already on /onboarding)
  if (user.onboarding_completed === 0 && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
