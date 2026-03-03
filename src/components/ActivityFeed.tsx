import { useState, useMemo } from 'react'
import { Search, User, Bot, MessageSquare } from 'lucide-react'
import { cn, formatRelativeTime } from '../lib/utils'

export interface ActivityEntry {
  timestamp: number
  type: 'user' | 'assistant'
  sessionId: string
  projectCwd: string
  projectName: string
  teamName?: string
  model?: string
  preview?: string
}

interface Props {
  entries: ActivityEntry[]
  loading: boolean
}

function shortenModel(model: string): string {
  if (model.includes('opus'))   return 'Opus'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('haiku'))  return 'Haiku'
  return model.split('-').slice(-2).join(' ')
}

export function ActivityFeed({ entries, loading }: Props) {
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    if (!filter.trim()) return entries
    const q = filter.toLowerCase()
    return entries.filter(e =>
      e.projectName.toLowerCase().includes(q) ||
      (e.preview?.toLowerCase().includes(q)) ||
      (e.teamName?.toLowerCase().includes(q))
    )
  }, [entries, filter])

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/[0.06] shrink-0">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by project, team, or content…"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-white/10
                       bg-zinc-50 dark:bg-white/5 text-zinc-800 dark:text-zinc-200
                       placeholder-zinc-400 dark:placeholder-zinc-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-blue-400/30"
          />
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
            <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm">Loading activity…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
            <MessageSquare className="w-10 h-10 text-zinc-400" />
            <p className="text-sm text-zinc-500">
              {filter ? `No results for "${filter}"` : 'No activity found'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
            {filtered.slice(0, 500).map((entry, i) => (
              <div
                key={`${entry.sessionId}-${entry.timestamp}-${i}`}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                {/* Type indicator */}
                <div className="mt-1 shrink-0">
                  {entry.type === 'user' ? (
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                      <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                      <Bot className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Time */}
                    <span className="text-xs text-zinc-400 font-mono shrink-0">
                      {formatRelativeTime(entry.timestamp)}
                    </span>

                    {/* Project badge */}
                    <span className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                      'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400'
                    )}>
                      {entry.projectName}
                    </span>

                    {/* Team badge */}
                    {entry.teamName && (
                      <span className={cn(
                        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                        'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      )}>
                        {entry.teamName}
                      </span>
                    )}

                    {/* Model badge */}
                    {entry.model && (
                      <span className={cn(
                        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                        'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400'
                      )}>
                        {shortenModel(entry.model)}
                      </span>
                    )}
                  </div>

                  {/* Preview */}
                  {entry.preview && (
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400 truncate">
                      {entry.preview}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
