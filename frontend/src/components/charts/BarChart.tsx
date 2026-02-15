import { useMemo } from 'react'
import type { EChartsOption } from 'echarts-for-react'
import { BaseChart } from './BaseChart'
import { useChart } from '@/hooks/useChart'

/** Simple data format: array of {name, value} pairs */
export interface BarChartSimpleItem {
  name: string
  value: number
}

/** Multi-series data format: explicit categories and named series */
export interface BarChartSeriesItem {
  name: string
  data: number[]
}

export interface BarChartProps {
  /** Simple data format: array of {name, value} */
  data?: BarChartSimpleItem[]
  /** Multi-series: category labels for the category axis */
  categories?: string[]
  /** Multi-series: array of named series */
  series?: BarChartSeriesItem[]
  /** Render bars horizontally (default: false) */
  horizontal?: boolean
  /** Colors for each series/bar; falls back to theme palette */
  colors?: string[]
  /** Chart title */
  title?: string
  /** Chart height (CSS value) */
  height?: string
  /** Show loading spinner */
  loading?: boolean
  /** Show bar value labels on the bars */
  showLabel?: boolean
}

export function BarChart({
  data,
  categories,
  series,
  horizontal = false,
  colors,
  title,
  height = '300px',
  loading = false,
  showLabel = false,
}: BarChartProps) {
  const theme = useChart()

  const option = useMemo<EChartsOption>(() => {
    const seriesColors = colors ?? theme.palette

    // Build category axis data and series list
    let categoryData: string[]
    let chartSeries: EChartsOption[]

    if (categories && series) {
      // Multi-series mode
      categoryData = categories
      chartSeries = series.map((s, i) => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        barMaxWidth: 32,
        itemStyle: {
          color: seriesColors[i % seriesColors.length],
          borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
          },
        },
        label: showLabel
          ? {
              show: true,
              position: horizontal ? 'right' : 'top',
              color: theme.textMuted,
              fontSize: 11,
            }
          : { show: false },
      }))
    } else if (data) {
      // Simple single-series mode
      categoryData = data.map((d) => d.name)
      chartSeries = [
        {
          type: 'bar',
          data: data.map((d, i) => ({
            value: d.value,
            itemStyle: {
              color: seriesColors[i % seriesColors.length],
              borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
            },
          })),
          barMaxWidth: 32,
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
          label: showLabel
            ? {
                show: true,
                position: horizontal ? 'right' : 'top',
                color: theme.textMuted,
                fontSize: 11,
              }
            : { show: false },
        },
      ]
    } else {
      categoryData = []
      chartSeries = []
    }

    const categoryAxis = {
      type: 'category' as const,
      data: categoryData,
      axisLine: { lineStyle: { color: theme.gridLine } },
      axisTick: { show: false },
      axisLabel: {
        color: theme.textMuted,
        fontSize: 11,
        rotate: !horizontal && categoryData.length > 8 ? 30 : 0,
      },
    }

    const valueAxis = {
      type: 'value' as const,
      splitLine: { lineStyle: { color: theme.gridLine, type: 'dashed' as const } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.textMuted, fontSize: 11 },
    }

    return {
      title: title
        ? {
            text: title,
            textStyle: {
              color: theme.textPrimary,
              fontSize: 14,
              fontWeight: 600,
            },
            left: 0,
            top: 0,
          }
        : undefined,
      grid: {
        top: title ? 48 : 24,
        right: 16,
        bottom: 24,
        left: 16,
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend:
        series && series.length > 1
          ? {
              right: 0,
              top: 0,
              data: series.map((s) => s.name),
            }
          : undefined,
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: chartSeries,
    }
  }, [data, categories, series, horizontal, colors, title, showLabel, theme])

  return <BaseChart option={option} height={height} loading={loading} />
}
