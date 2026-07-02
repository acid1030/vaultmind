import { useEffect } from 'react'
import { useAppStore } from '@/store/app'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ToastContainer } from '@/components/shared/Toast'
import { FullPageLoader } from '@/components/shared/Skeleton'
import LoginPage from './pages/LoginPage'
import MainLayout from './pages/MainLayout'

export default function App() {
  const { initialized, isLoggedIn, init, loading } = useAppStore()

  useEffect(() => {
    init()
  }, [init])

  if (!initialized || loading) {
    return <FullPageLoader message="正在初始化 VaultMind..." />
  }

  return (
    <ErrorBoundary>
      {isLoggedIn ? <MainLayout /> : <LoginPage />}
      <ToastContainer />
    </ErrorBoundary>
  )
}
