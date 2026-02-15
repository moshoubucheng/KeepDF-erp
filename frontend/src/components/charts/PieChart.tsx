import { useMemo } from 'react'
import type { EChartsOption } from 'echarts-for-react'
import { BaseChart } from './BaseChart'
import { useChart } from '@/hooks/useChart'

export interface PieChartDataItem {
  name: string
  value: number
}

export interface PieChartProps {
  data: PieChartDataItem[]
  /** Chart title */
  title?: string
  /** Colors for each slice; falls back to theme palette */
  colors?: string[]
  /** Chart height (CSS value) */
  height?: string
  /** Show loading spinner */
  loading?: boolean
  /** Inner radius percentage for the doughnut hole (default: '55%') */
  innerRadius?: string
  /** Outer radius percentage (default: '75%') */
  outerRadius?: string
}

export function PieChart({
  data,
  title,
  colors,
  height = '300px',
  loading = false,
  innerRadius = '55%',
  outerRadius = '75%',
}: PieChartProps) {
  const theme = useChart()

  const option = useMemo<EChartsOption>(() => {
    const seriesColors = colors ?? theme.palette

    const total = data.reduce((sum, item) => sum + item.value, 0)

    // Format the total for the center label
    const formattedTotal =
      total >= 1_000_000
        ? `${(total / 1_000_000).toFixed(1)}M`
        : total >= 1_000
          ? `${(total / 1_000).toFixed(1)}K`
          : total.toLocaleString()

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
      tooltip: {
        trigger: 'item',
        formatter: (params: { name: string; value: number; percent: number }) =>
          `<span style="font-weight:600">${params.name}</span><br/>` +
          `${params.value.toLocaleString()} (${params.percent}%)`,
      },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'center',
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 12,
        textStyle: {
          color: theme.textSecondary,
          fontSize: 12,
        },
        formatter: (name: string) => {
          const item = data.find((d) => d.name === name)
          if (!item) return name
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
          return `${name}  ${pct}%`
        },
      },
      series: [
        {
          type: 'pie',
          radius: [innerRadius, outerRadius],
          center: ['40%', '55%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: theme.bgCard,
            borderWidth: 2,
          },
          label: {
            show: true,
            position: 'center',
            formatter: () =>
              [
                `{total|${formattedTotal}}`,
                `{label|Total}`,
              ].join('\n'),
            rich: {
              total: {
                fontSize: 22,
                fontWeight: 700,
                color: theme.textPrimary,
                lineHeight: 30,
              },
              label: {
                fontSize: 12,
                color: theme.textMuted,
                lineHeight: 18,
              },
            },
          },
          emphasis: {
            label: { show: true },
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
            },
          },
          labelLine: { show: false },
          data: data.map((item, i) => ({
            ...item,
            itemStyle: {
              color: seriesColors[i % seriesColors.length],
            },
          })),
        },
      ],
    }
  }, [data, title, colors, innerRadius, outerRadius, theme])

  return <BaseChart option={option} height={height} loading={loading} />
}
