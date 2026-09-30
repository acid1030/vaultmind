import { useEffect } from 'react'
import { useAppStore } from '@/store/app'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ToastContainer } from '@/components/shared/Toast'
import { FullPageLoader } from '@/components/shared/Skeleton'
import LoginPage from './pages/LoginPage'
import MainLayout from './pages/MainLayout'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { vaultApi } from '@/lib/ipc'

export default function App() {
  const { initialized, isLoggedIn, init, logout, loading, error, state } = useAppStore()

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => vaultApi.onSyncStatus(() => {
    useAppStore.getState().refresh()
  }), [])

  useEffect(() => {
    if (!isLoggedIn) return
    let timer = window.setTimeout(() => logout(), 30 * 60 * 1000)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => logout(), 30 * 60 * 1000)
    }
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach(event => window.addEventListener(event, reset, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach(event => window.removeEventListener(event, reset))
    }
  }, [isLoggedIn, logout])

  if (!initialized || loading) {
    return <FullPageLoader message="正在初始化 AxonMind..." />
  }

  if (error && !state) {
    return (
      <main className="vm-startup-error">
        <div className="glass-panel">
          <span className="vm-startup-error-icon"><AlertTriangle className="w-6 h-6" /></span>
          <h1>AxonMind 暂时无法启动</h1>
          <p>{error}</p>
          <Button variant="primary" onClick={init}><RefreshCw className="w-4 h-4" />重新加载</Button>
        </div>
      </main>
    )
  }

  return (
    <ErrorBoundary>
      {isLoggedIn ? <MainLayout /> : <LoginPage />}
      <ToastContainer />
    </ErrorBoundary>
  )
}
