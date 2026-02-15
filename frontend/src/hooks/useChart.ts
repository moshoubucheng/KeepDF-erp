/**
 * Custom hook that provides ECharts theme colors matching the dark/light theme.
 */

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

export function useChart(): ChartThemeColors {
  // Currently matches the dark theme; can be extended to read from
  // CSS custom properties or a theme context for light-mode support.
  return {
    purple: '#8b5cf6',
    blue: '#3b82f6',
    emerald: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    palette: [
      '#8b5cf6',
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#06b6d4',
      '#ec4899',
      '#f97316',
      '#14b8a6',
      '#a78bfa',
    ],
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
}
