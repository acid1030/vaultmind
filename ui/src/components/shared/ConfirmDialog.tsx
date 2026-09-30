import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmOptions {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null)
  const resolver = useRef<((result: boolean) => void) | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const close = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setState(null)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => {
    resolver.current?.(false)
    resolver.current = resolve
    setState({ ...options, open: true })
  }), [])

  useEffect(() => {
    if (!state?.open) return
    cancelRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state?.open, close])

  useEffect(() => () => resolver.current?.(false), [])

  const confirmDialog = state?.open ? (
    <div className="vm-dialog-overlay" onMouseDown={() => close(false)}>
      <div
        className="vm-confirm-dialog animate-scale-in"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="vm-confirm-title"
        aria-describedby="vm-confirm-description"
        onMouseDown={event => event.stopPropagation()}
      >
        <button className="vm-dialog-close" onClick={() => close(false)} aria-label="关闭确认对话框">
          <X className="w-4 h-4" />
        </button>
        <span className={state.destructive === false ? 'vm-confirm-icon vm-confirm-icon-info' : 'vm-confirm-icon'}>
          <AlertTriangle className="w-5 h-5" />
        </span>
        <div className="vm-confirm-copy">
          <h2 id="vm-confirm-title">{state.title}</h2>
          <p id="vm-confirm-description">{state.description}</p>
        </div>
        <div className="vm-confirm-actions">
          <Button ref={cancelRef} variant="ghost" onClick={() => close(false)}>{state.cancelLabel || '取消'}</Button>
          <Button variant={state.destructive === false ? 'primary' : 'destructive'} onClick={() => close(true)}>
            {state.confirmLabel || '确认删除'}
          </Button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, confirmDialog }
}
