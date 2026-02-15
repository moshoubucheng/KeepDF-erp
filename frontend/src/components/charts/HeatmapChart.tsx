import { useMemo } from 'react'
import type { EChartsOption } from 'echarts-for-react'
import { BaseChart } from './BaseChart'
import { useChart } from '@/hooks/useChart'

export interface HeatmapDataItem {
  /** Day of the week: 0 = Monday, 6 = Sunday */
  day: number
  /** Hour of the day: 0-23 */
  hour: number
  /** Intensity value */
  value: number
}

export interface HeatmapChartProps {
  data: HeatmapDataItem[]
  /** Chart title */
  title?: string
  /** Chart height (CSS value). Defaults to 280px for a compact 7x24 grid. */
  height?: string
  /** Show loading spinner */
  loading?: boolean
  /** Min color (low values). Defaults to a dark purple tint. */
  minColor?: string
  /** Max color (high values). Defaults to bright purple. */
  maxColor?: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, '0') + ':00',
)

export function HeatmapChart({
  data,
  title,
  height = '280px',
  loading = false,
  minColor,
  maxColor,
}: HeatmapChartProps) {
  const theme = useChart()

  const option = useMemo<EChartsOption>(() => {
    // Determine the value range for the visual map
    const values = data.map((d) => d.value)
    const maxVal = values.length ? Math.max(...values) : 1
    const minVal = 0

    // Convert data to [hour, day, value] format for echarts heatmap
    const heatmapData = data.map((d) => [d.hour, d.day, d.value])

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
        right: 60,
        bottom: 36,
        left: 8,
        containLabel: true,
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: {
          value: [number, number, number]
          marker: string
        }) => {
          const [hour, day, value] = params.value
          return (
            `${params.marker} ` +
            `<span style="font-weight:600">${DAYS[day]}</span> ` +
            `${HOURS[hour]}<br/>` +
            `Value: <b>${value.toLocaleString()}</b>`
          )
        },
      },
      xAxis: {
        type: 'category',
        data: HOURS,
        position: 'bottom',
        splitArea: { show: false },
        axisLine: { lineStyle: { color: theme.gridLine } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.textMuted,
          fontSize: 10,
          interval: 2,
        },
      },
      yAxis: {
        type: 'category',
        data: DAYS,
        splitArea: { show: false },
        axisLine: { lineStyle: { color: theme.gridLine } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.textMuted,
          fontSize: 11,
        },
      },
      visualMap: {
        min: minVal,
        max: maxVal,
        calculable: false,
        orient: 'vertical',
        right: 0,
        top: 'center',
        itemHeight: 120,
        itemWidth: 12,
        textStyle: {
          color: theme.textMuted,
          fontSize: 10,
        },
        inRange: {
          color: [
            minColor ?? 'rgba(139, 92, 246, 0.05)',
            maxColor ?? '#8b5cf6',
          ],
        },
      },
      series: [
        {
          type: 'heatmap',
          data: heatmapData,
          emphasis: {
            itemStyle: {
              borderColor: theme.textPrimary,
              borderWidth: 1,
              shadowBlur: 8,
              shadowColor: 'rgba(139, 92, 246, 0.4)',
            },
          },
          itemStyle: {
            borderRadius: 2,
            borderColor: theme.bgCard,
            borderWidth: 1,
          },
          label: { show: false },
        },
      ],
    }
  }, [data, title, minColor, maxColor, theme])

  return <BaseChart option={option} height={height} loading={loading} />
}
