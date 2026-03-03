import { cn, STATUS_CONFIG } from '../lib/utils'
import type { TaskStatus } from '../types'

interface Props {
  status: TaskStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
      'bg-current/10 border border-current/20',
      cfg.color
    )}>
      <span className={cn(
        'rounded-full',
        size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
        cfg.dot,
        status === 'in_progress' && 'animate-pulse'
      )} />
      {cfg.label}
    </span>
  )
}
