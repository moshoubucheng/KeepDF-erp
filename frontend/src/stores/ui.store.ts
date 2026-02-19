import { create } from 'zustand'

type Theme = 'dark' | 'light'

interface ToastItem {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

interface UIState {
  sidebarOpen: boolean
  sidebarHidden: boolean
  theme: Theme
  toasts: ToastItem[]
  commandPaletteOpen: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
  setSidebarHidden: (hidden: boolean) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  addToast: (type: ToastItem['type'], message: string) => void
  removeToast: (id: string) => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('erp_theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  localStorage.setItem('erp_theme', theme)
}

// Apply initial theme
applyTheme(getInitialTheme())

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: false,
  sidebarHidden: false,
  theme: getInitialTheme(),
  toasts: [],
  commandPaletteOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  setSidebarHidden: (hidden: boolean) => set({ sidebarHidden: hidden }),

  setTheme: (theme: Theme) => {
    applyTheme(theme)
    set({ theme })
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },

  addToast: (type, message) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
}))
