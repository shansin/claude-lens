import { useState, useMemo } from 'react'
import { ProjectCard } from '../ProjectCard'
import { formatCost, formatTokens } from '../../lib/costs'
import type { ProjectData } from '../../types'
import { FolderSearch, Search, DollarSign, Zap, Layers, SortAsc } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props {
  projects: ProjectData[]
  scanning: boolean
  onOpenCwd: (cwd: string) => void
  onCopy:    (text: string, label: string) => void
  onSelectTeam?: (teamName: string) => void
}

type SortKey = 'recent' | 'cost' | 'tokens' | 'sessions'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent',   label: 'Recent' },
  { key: 'cost',     label: 'Cost' },
  { key: 'tokens',   label: 'Tokens' },
  { key: 'sessions', label: 'Sessions' },
]

export function ProjectsView({ projects, scanning, onOpenCwd, onCopy, onSelectTeam }: Props) {
  const [search, setSearch]   = useState('')
  const [sortBy, setSortBy]   = useState<SortKey>('recent')

  const totalCost   = projects.reduce((s, p) => s + (p.costUSD ?? 0), 0)
  const totalTokens = projects.reduce((s, p) => s + p.totalInputTokens + p.totalOutputTokens, 0)
  const hasCost     = projects.some(p => p.costUSD !== null && p.costUSD > 0)

  const filtered = useMemo(() => {
    let list = projects
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.displayName.toLowerCase().includes(q) ||
        p.cwd.toLowerCase().includes(q) ||
        p.linkedTeams.some(t => t.toLowerCase().includes(q)) ||
        p.models.some(m => m.toLowerCase().includes(q))
      )
    }
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'cost':     return (b.costUSD ?? 0) - (a.costUSD ?? 0)
        case 'tokens':   return (b.totalInputTokens + b.totalOutputTokens) - (a.totalInputTokens + a.totalOutputTokens)
        case 'sessions': return b.sessions.length - a.sessions.length
        default:         return b.lastActivity - a.lastActivity
      }
    })
  }, [projects, search, sortBy])

  if (!scanning && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
        <FolderSearch className="w-16 h-16 text-zinc-400" />
        <p className="text-lg font-medium text-zinc-500">No projects found</p>
        <p className="text-sm text-zinc-400">Projects appear in ~/.claude/projects/</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-200 dark:border-white/[0.06]
                      bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <Layers className="w-4 h-4 text-zinc-400" />
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">{projects.length}</span>
          <span className="text-zinc-400">projects</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Zap className="w-4 h-4 text-zinc-400" />
          <span className="font-semibold text-zinc-700 dark:text-zinc-200 font-mono">{formatTokens(totalTokens)}</span>
          <span className="text-zinc-400">tokens total</span>
        </div>
        {hasCost && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{formatCost(totalCost)}</span>
            <span className="text-zinc-400">total cost</span>
          </div>
        )}
        {scanning && (
          <span className="ml-auto text-xs text-zinc-400 animate-pulse">Scanning…</span>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-100 dark:border-white/[0.04] shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-white/10
                       bg-zinc-50 dark:bg-white/5 text-zinc-800 dark:text-zinc-200
                       placeholder-zinc-400 dark:placeholder-zinc-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-blue-400/30"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <SortAsc className="w-3.5 h-3.5 text-zinc-400" />
          <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-white/[0.06] rounded-lg p-0.5 border border-zinc-200 dark:border-white/10">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                  sortBy === opt.key
                    ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length !== projects.length && (
          <span className="text-xs text-zinc-400">{filtered.length} of {projects.length}</span>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {scanning && projects.length === 0 ? (
          <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
            <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm">Scanning projects…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 auto-rows-min">
            {filtered.map(proj => (
              <ProjectCard
                key={proj.projectKey}
                project={proj}
                onOpenCwd={onOpenCwd}
                onCopy={onCopy}
                onSelectTeam={onSelectTeam}
              />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-3 flex flex-col items-center justify-center py-16 gap-3 opacity-40">
                <Search className="w-10 h-10 text-zinc-400" />
                <p className="text-sm text-zinc-500">No projects match "{search}"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
