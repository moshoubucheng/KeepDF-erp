import { useAuthStore } from '@/stores/auth.store'

export function useAuth() {
  const { user, isAdmin, isAuthenticated, isLoading, logout } = useAuthStore()
  return { user, isAdmin, isAuthenticated, isLoading, logout }
}
