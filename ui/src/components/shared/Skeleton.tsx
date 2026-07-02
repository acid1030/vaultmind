import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded animate-shimmer', className)}
      style={{
        background: 'linear-gradient(90deg, hsl(218 36% 8%) 0%, hsl(218 30% 12%) 50%, hsl(218 36% 8%) 100%)',
        backgroundSize: '200% 100%',
      }}
    />
  )
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass-card rounded-md p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2 w-1/4" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FullPageLoader({ message = '加载中...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-dot-grid)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 animate-spin"
          style={{ borderColor: 'hsl(190 60% 30%)', borderTopColor: 'hsl(190 90% 60%)' }} />
        <p className="text-sm" style={{ color: 'hsl(218 16% 50%)' }}>{message}</p>
      </div>
    </div>
  )
}
