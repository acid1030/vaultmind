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

const TOAST_STYLES: Record<Toast['type'], { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: 'hsl(152 50% 14% / 0.95)', border: 'hsl(152 50% 28% / 0.5)', color: 'hsl(152 72% 68%)', icon: '✓' },
  error:   { bg: 'hsl(356 50% 14% / 0.95)', border: 'hsl(356 50% 28% / 0.5)', color: 'hsl(356 84% 78%)', icon: '✕' },
  warning: { bg: 'hsl(43 60% 16% / 0.95)',   border: 'hsl(43 60% 30% / 0.5)', color: 'hsl(43 90% 72%)',  icon: '!' },
  info:    { bg: 'hsl(218 36% 10% / 0.95)', border: 'hsl(218 24% 22% / 0.5)', color: 'hsl(190 90% 72%)', icon: 'i' },
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type]
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-lg backdrop-blur-xl animate-slide-in-right max-w-[400px]"
            style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
              boxShadow: '0 8px 32px hsl(218 42% 2% / 0.4)',
            }}
          >
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: style.color + '20', color: style.color }}
            >
              {style.icon}
            </span>
            <span className="text-sm flex-1" style={{ color: 'hsl(210 30% 90%)' }}>
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-xs opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: 'hsl(218 16% 60%)' }}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
