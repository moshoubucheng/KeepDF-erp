import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from './api/query-config'
import App from './App'
import '@fontsource-variable/inter'
import './i18n'
import './index.css'

const queryClient = createQueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)

// Report Web Vitals in production
if (import.meta.env.PROD) {
  import('./lib/web-vitals').then(({ initWebVitals }) => initWebVitals())
}
