import { useMemo } from 'react'
import type { EChartsOption } from 'echarts-for-react'
import { BaseChart } from './BaseChart'
import { useChart } from '@/hooks/useChart'

export interface LineChartProps {
  /** Array of data points. Each object must have a date field plus one or more value fields. */
  data: Record<string, string | number>[]
  /** Key used for the x-axis (default: 'date') */
  xKey?: string
  /** Keys used for the y-axis series. If omitted, all numeric keys except xKey are used. */
  yKeys?: string[]
  /** Colors for each series; falls back to the theme palette. */
  colors?: string[]
  /** Chart title displayed in the top-left corner */
  title?: string
  /** Chart height (CSS value) */
  height?: string
  /** Show loading spinner */
  loading?: boolean
}

export function LineChart({
  data,
  xKey = 'date',
  yKeys,
  colors,
  title,
  height = '300px',
  loading = false,
}: LineChartProps) {
  const theme = useChart()

  const option = useMemo<EChartsOption>(() => {
    if (!data.length) {
      return { xAxis: { data: [] }, yAxis: {}, series: [] }
    }

    // Derive y-axis keys if not provided
    const resolvedYKeys =
      yKeys ??
      Object.keys(data[0]).filter(
        (k) => k !== xKey && typeof data[0][k] === 'number',
      )

    const seriesColors = colors ?? theme.palette

    const xData = data.map((d) => String(d[xKey]))

    const series = resolvedYKeys.map((key, i) => {
      const color = seriesColors[i % seriesColors.length]
      return {
        name: key,
        type: 'line' as const,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        data: data.map((d) => d[key] ?? 0),
        lineStyle: {
          width: 2,
          color,
        },
        itemStyle: {
          color,
        },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(color, 0.25) },
              { offset: 1, color: hexToRgba(color, 0.02) },
            ],
          },
        },
        emphasis: {
          focus: 'series' as const,
          itemStyle: {
            borderWidth: 2,
          },
        },
      }
    })

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
      },
      legend:
        resolvedYKeys.length > 1
          ? {
              data: resolvedYKeys,
              right: 0,
              top: 0,
            }
          : undefined,
      xAxis: {
        type: 'category',
        data: xData,
        boundaryGap: false,
        axisLine: { lineStyle: { color: theme.gridLine } },
        axisTick: { show: false },
        axisLabel: { color: theme.textMuted, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: theme.gridLine, type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: theme.textMuted, fontSize: 11 },
      },
      series,
    }
  }, [data, xKey, yKeys, colors, title, theme])

  return <BaseChart option={option} height={height} loading={loading} />
}

/** Convert a hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
