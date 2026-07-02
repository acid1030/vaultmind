import React, { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('VaultMind ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--bg-dot-grid)' }}>
          <div className="glass-panel rounded-xl p-8 max-w-md text-center">
            <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'hsl(356 50% 14% / 0.5)', border: '1px solid hsl(356 50% 28% / 0.4)' }}>
              <AlertTriangle className="w-7 h-7" style={{ color: 'hsl(356 84% 70%)' }} />
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'hsl(210 30% 92%)' }}>
              页面出错了
            </h2>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: 'hsl(218 16% 50%)' }}>
              {this.state.error?.message || '发生未知错误'}
            </p>
            <Button variant="outline" size="sm" onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}>
              <RefreshCw className="w-3.5 h-3.5" />
              刷新页面
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
