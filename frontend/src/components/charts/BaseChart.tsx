import ReactEChartsCore from 'echarts-for-react/lib/core'
import type { EChartsOption } from 'echarts-for-react'
import echarts from '@/lib/echarts'
import { useMemo } from 'react'
import { useChart } from '@/hooks/useChart'

export interface BaseChartProps {
  option: EChartsOption
  height?: string
  loading?: boolean
  className?: string
}

/**
 * Base wrapper around echarts-for-react that applies the dark theme defaults,
 * handles loading state, and auto-resizes on container changes.
 */
export function BaseChart({
  option,
  height = '300px',
  loading = false,
  className,
}: BaseChartProps) {
  const theme = useChart()

  const mergedOption = useMemo<EChartsOption>(() => {
    return {
      // Transparent background so the card bg shows through
      backgroundColor: 'transparent',
      // Global text style
      textStyle: {
        color: theme.textSecondary,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 12,
      },
      // Default grid with comfortable padding
      grid: {
        top: 40,
        right: 16,
        bottom: 24,
        left: 16,
        containLabel: true,
        ...((option as Record<string, unknown>).grid as object),
      },
      // Default tooltip
      tooltip: {
        trigger: 'axis',
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        textStyle: {
          color: theme.textPrimary,
          fontSize: 12,
        },
        ...((option as Record<string, unknown>).tooltip as object),
      },
      // Default legend
      legend: {
        textStyle: {
          color: theme.textSecondary,
          fontSize: 12,
        },
        ...((option as Record<string, unknown>).legend as object),
      },
      // Spread the rest of the caller's option (series, xAxis, yAxis, etc.)
      ...option,
    }
  }, [option, theme])

  const loadingOption = useMemo(
    () => ({
      text: '',
      color: theme.purple,
      maskColor: 'rgba(10, 14, 26, 0.6)',
      zlevel: 0,
      spinnerRadius: 14,
      lineWidth: 2,
    }),
    [theme],
  )

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={mergedOption}
      style={{ height, width: '100%' }}
      showLoading={loading}
      loadingOption={loadingOption}
      notMerge={true}
      lazyUpdate={true}
      autoResize={true}
      className={className}
    />
  )
}
