import type { Metric } from 'web-vitals'

function reportMetric(metric: Metric) {
  console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(1)}ms (${metric.rating})`)
}

export function initWebVitals() {
  import('web-vitals').then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
    onCLS(reportMetric)
    onFCP(reportMetric)
    onLCP(reportMetric)
    onTTFB(reportMetric)
    onINP(reportMetric)
  })
}
