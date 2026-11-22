import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/errors/ErrorBoundary'
import { AppErrorFallback } from './components/errors/ErrorFallbacks'
import { installGlobalErrorHandlers } from './components/errors/reportClientError'

installGlobalErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Last line of defence: a rendering error anywhere shows a recoverable page instead of a blank screen. */}
    <ErrorBoundary name="app" fallback={props => <AppErrorFallback {...props} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
