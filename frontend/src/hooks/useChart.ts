/**
 * Custom hook that provides ECharts theme colors matching the dark/light theme.
 */
import { useUIStore } from '@/stores/ui.store'

export interface ChartThemeColors {
  /** Primary accent colors for series data */
  purple: string
  blue: string
  emerald: string
  amber: string
  red: string
  /** Extended palette for multi-series charts */
  palette: string[]
  /** Background & surface */
  bgPrimary: string
  bgCard: string
  /** Text */
  textPrimary: string
  textSecondary: string
  textMuted: string
  /** Grid & borders */
  border: string
  gridLine: string
  /** Tooltip */
  tooltipBg: string
  tooltipBorder: string
}

const SHARED_ACCENTS = {
  purple: '#8b5cf6',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  palette: [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#a78bfa',
  ],
}

const DARK: ChartThemeColors = {
  ...SHARED_ACCENTS,
  bgPrimary: '#0a0e1a',
  bgCard: '#1a1f2e',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: 'rgba(255, 255, 255, 0.06)',
  gridLine: 'rgba(255, 255, 255, 0.06)',
  tooltipBg: 'rgba(15, 23, 42, 0.95)',
  tooltipBorder: 'rgba(255, 255, 255, 0.1)',
}

const LIGHT: ChartThemeColors = {
  ...SHARED_ACCENTS,
  bgPrimary: '#ffffff',
  bgCard: '#f8fafc',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: 'rgba(0, 0, 0, 0.08)',
  gridLine: 'rgba(0, 0, 0, 0.08)',
  tooltipBg: 'rgba(255, 255, 255, 0.95)',
  tooltipBorder: 'rgba(0, 0, 0, 0.1)',
}

export function useChart(): ChartThemeColors {
  const theme = useUIStore((s) => s.theme)
  return theme === 'light' ? LIGHT : DARK
}
