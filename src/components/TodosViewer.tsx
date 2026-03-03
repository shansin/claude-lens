import { StatusBadge } from './StatusBadge'
import { cn } from '../lib/utils'
import type { Task } from '../types'
import { CheckSquare } from 'lucide-react'

interface TodoFile {
  filename: string
  agentId: string
  tasks: Task[]
}

interface Props {
  todos: TodoFile[]
}

export function TodosViewer({ todos }: Props) {
  if (todos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
        <CheckSquare className="w-12 h-12 text-zinc-400" />
        <p className="text-sm text-zinc-500">No todos found in ~/.claude/todos/</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {todos.map(todo => (
          <div
            key={todo.filename}
            className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 truncate max-w-[200px]" title={todo.agentId}>
                  {todo.agentId}
                </span>
                <span className="text-xs text-zinc-400">{todo.tasks.length} tasks</span>
              </div>
            </div>

            {/* Tasks */}
            <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {todo.tasks.map(task => (
                <div key={task.id} className="px-4 py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium truncate',
                      task.status === 'completed' ? 'line-through opacity-50' : 'text-zinc-800 dark:text-zinc-100'
                    )}>
                      {task.status === 'in_progress' ? task.activeForm || task.subject : task.subject}
                    </p>
                    {task.description && (
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
              ))}
              {todo.tasks.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-zinc-400">No tasks</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
