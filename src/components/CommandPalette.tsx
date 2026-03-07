import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, LayoutGrid, Users, FolderCode } from 'lucide-react'
import { cn } from '../lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (source: string) => void
  teams: Array<{ teamName: string }>
  projects: Array<{ projectKey: string; displayName: string; cwd: string }>
}

type CommandItem =
  | { type: 'navigate'; label: string; description: string; source: string }
  | { type: 'team'; label: string; teamName: string }
  | { type: 'project'; label: string; displayName: string; cwd: string }

const NAVIGATE_ITEMS: CommandItem[] = [
  { type: 'navigate', label: 'Projects',      description: 'Browse Claude projects',        source: 'projects' },
  { type: 'navigate', label: 'Agent Teams',    description: 'View all agent teams',          source: 'teams' },
  { type: 'navigate', label: 'Analytics',     description: 'Usage stats and charts',        source: 'analytics' },
  { type: 'navigate', label: 'Content',       description: 'Memory files and plans',        source: 'content' },
  { type: 'navigate', label: 'Conversations', description: 'Browse conversation logs',      source: 'conversations' },
  { type: 'navigate', label: 'System',        description: 'Processes and auth status',     source: 'system' },
  { type: 'navigate', label: 'Settings',      description: 'Configure app settings',       source: 'settings' },
]

function getIcon(item: CommandItem) {
  if (item.type === 'navigate') return LayoutGrid
  if (item.type === 'team')    return Users
  return FolderCode
}

function getLabel(item: CommandItem): string {
  if (item.type === 'navigate') return item.label
  if (item.type === 'team')    return `Team: Copy session ID – ${item.teamName}`
  return `Project: Open – ${item.displayName}`
}

function getHint(item: CommandItem): string {
  if (item.type === 'navigate') return '↩ Navigate'
  if (item.type === 'team')    return '↩ Copy'
  return '↩ Open'
}

export function CommandPalette({ open, onClose, onNavigate, teams, projects }: Props) {
  const [query, setQuery]       = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  const allItems: CommandItem[] = [
    ...NAVIGATE_ITEMS,
    ...teams.map(t => ({ type: 'team' as const, label: getLabel({ type: 'team', label: '', teamName: t.teamName }), teamName: t.teamName })),
    ...projects.map(p => ({ type: 'project' as const, label: getLabel({ type: 'project', label: '', displayName: p.displayName, cwd: p.cwd }), displayName: p.displayName, cwd: p.cwd })),
  ]

  const filtered = query.trim()
    ? allItems.filter(item => getLabel(item).toLowerCase().includes(query.toLowerCase()))
    : allItems

  const execute = useCallback((item: CommandItem) => {
    if (item.type === 'navigate') {
      onNavigate(item.source)
    } else if (item.type === 'team') {
      window.electronAPI.copyText(item.teamName)
    } else {
      window.electronAPI.openCwd(item.cwd)
    }
    onClose()
  }, [onNavigate, onClose])

  // Auto-focus when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  // Reset active index when filter changes
  useEffect(() => { setActiveIdx(0) }, [query])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // Global Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIdx]) execute(filtered[activeIdx])
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-white/10 w-full max-w-xl mx-4 mt-32 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-white/10">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search…"
            className="flex-1 text-base bg-transparent text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
          />
          <kbd className="text-xs text-zinc-400 border border-zinc-200 dark:border-white/10 rounded px-1.5 py-0.5 font-mono">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-400">No results</div>
          ) : (
            filtered.map((item, i) => {
              const Icon = getIcon(item)
              const isActive = i === activeIdx
              return (
                <button
                  key={`${item.type}-${getLabel(item)}`}
                  data-idx={i}
                  onClick={() => execute(item)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    isActive
                      ? 'bg-violet-500/10 dark:bg-violet-500/15'
                      : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-violet-500' : 'text-zinc-400')} />
                  <div className="flex-1 min-w-0">
                    <span className={cn('text-sm font-medium', isActive ? 'text-violet-700 dark:text-violet-300' : 'text-zinc-700 dark:text-zinc-200')}>
                      {getLabel(item)}
                    </span>
                    {item.type === 'navigate' && (
                      <span className="text-xs text-zinc-400 ml-2">{item.description}</span>
                    )}
                  </div>
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded border font-mono shrink-0',
                    isActive
                      ? 'border-violet-300 dark:border-violet-500/40 text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10'
                      : 'border-zinc-200 dark:border-white/10 text-zinc-400'
                  )}>
                    {getHint(item)}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
