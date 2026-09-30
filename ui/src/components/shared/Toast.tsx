import { create } from 'zustand'
import { useEffect, useCallback } from 'react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    if (toast.duration !== 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, toast.duration || 4000)
    }
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// Hook for convenience
export function useToast() {
  const addToast = useToastStore((s) => s.addToast)
  return useCallback((message: string, type: Toast['type'] = 'info', duration?: number) => {
    addToast({ message, type, duration })
  }, [addToast])
}

const TOAST_ICONS: Record<Toast['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        return (
          <div
            key={toast.id}
            className={`vm-toast vm-toast-${toast.type} pointer-events-auto animate-slide-in-right`}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            <span className="vm-toast-icon">{TOAST_ICONS[toast.type]}</span>
            <span className="vm-toast-message">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="vm-toast-close"
              aria-label="关闭通知">
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
