import { StatusBadge } from './StatusBadge'
import { cn } from '../lib/utils'
import type { Task } from '../types'

interface Props {
  task: Task
  compact?: boolean
}

export function TaskRow({ task, compact }: Props) {
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-lg transition-colors',
      'hover:bg-zinc-100 dark:hover:bg-white/5',
      compact ? 'px-2 py-1.5' : 'px-3 py-2.5'
    )}>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-medium truncate',
          compact ? 'text-xs' : 'text-sm',
          task.status === 'completed' ? 'line-through opacity-50' : 'text-zinc-800 dark:text-zinc-100'
        )}>
          {task.status === 'in_progress' ? task.activeForm || task.subject : task.subject}
        </p>
        {!compact && task.description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
            {task.description}
          </p>
        )}
        {task.owner && (
          <p className="text-xs text-violet-500 dark:text-violet-400 mt-0.5">
            → {task.owner}
          </p>
        )}
      </div>
      <StatusBadge status={task.status} size="sm" />
    </div>
  )
}
