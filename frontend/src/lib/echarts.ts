/**
 * Custom ECharts bundle — only registers chart types & components actually used.
 * Import this instead of the full 'echarts' package to save ~700KB.
 */
import * as echarts from 'echarts/core'

// Chart types
import { LineChart } from 'echarts/charts'
import { BarChart } from 'echarts/charts'
import { PieChart } from 'echarts/charts'
import { HeatmapChart } from 'echarts/charts'

// Components
import { TitleComponent } from 'echarts/components'
import { TooltipComponent } from 'echarts/components'
import { GridComponent } from 'echarts/components'
import { LegendComponent } from 'echarts/components'
import { VisualMapComponent } from 'echarts/components'

// Renderer
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  HeatmapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export default echarts
