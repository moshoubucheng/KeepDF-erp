import { useTranslation } from 'react-i18next'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

interface Props {
  platformData: { name: string; value: number }[]
  isLoading: boolean
}

const PLATFORM_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']

export function RevenueByPlatformWidget({ platformData, isLoading }: Props) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-32 w-32 animate-pulse rounded-full bg-bg-input" />
      </div>
    )
  }

  if (platformData.length === 0) {
    return <p className="p-4 text-sm text-text-muted">{t('dashboard.no_data')}</p>
  }

  const option = {
    tooltip: {
      trigger: 'item' as const,
      formatter: '{b}: ¥{c} ({d}%)',
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#888', fontSize: 11 },
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: 'transparent',
          borderWidth: 2,
        },
        label: { show: false },
        data: platformData.map((d, i) => ({
          ...d,
          itemStyle: { color: PLATFORM_COLORS[i % PLATFORM_COLORS.length] },
        })),
      },
    ],
  }

  return (
    <div className="p-2">
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: 200 }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}
