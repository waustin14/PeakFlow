import { cn } from '@/lib/utils'

interface ValueWithUnitProps {
  value: number | null | undefined
  unit: string
  decimals?: number
  className?: string
  valueClassName?: string
  unitClassName?: string
}

export function ValueWithUnit({
  value,
  unit,
  decimals = 2,
  className,
  valueClassName,
  unitClassName,
}: ValueWithUnitProps) {
  if (value === null || value === undefined) {
    return (
      <span className={cn('text-muted-foreground', className)}>
        <span className={valueClassName}>—</span>
      </span>
    )
  }

  return (
    <span className={cn('tabular-nums', className)}>
      <span className={cn('font-medium', valueClassName)}>
        {value.toFixed(decimals)}
      </span>
      <span className={cn('ml-1 text-xs text-muted-foreground', unitClassName)}>
        {unit}
      </span>
    </span>
  )
}
