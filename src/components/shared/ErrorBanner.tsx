import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorBannerProps {
  message: string
  onDismiss?: () => void
  className?: string
}

export function ErrorBanner({ message, onDismiss, className }: ErrorBannerProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive',
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 hover:opacity-70">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
