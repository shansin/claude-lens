import { LayoutGrid, GitFork, Columns, RefreshCw, FolderCode, Users, BarChart2, FolderOpen, Monitor, Settings, MessageSquare, Plus } from 'lucide-react'
import { cn } from '../lib/utils'
import type { ViewMode, SourceMode } from '../types'

interface Props {
  source: SourceMode
  onSourceChange: (s: SourceMode) => void
  view: ViewMode
  onViewChange: (v: ViewMode) => void
  onRefresh: () => void
  onOpenPalette: () => void
  onNewTeam?: () => void
  teamCount: number
  projectCount: number
  claudeDir: string
  scanning: boolean
  todayCostUSD: number | null
  monthlyCostUSD: number | null
}

function costColor(n: number): string {
  if (n < 5)  return 'text-emerald-400'
  if (n < 20) return 'text-amber-400'
  return 'text-red-400'
}

const VIEWS: { id: ViewMode; icon: React.ElementType; label: string }[] = [
  { id: 'cards', icon: LayoutGrid, label: 'Cards' },
  { id: 'graph', icon: GitFork, label: 'Graph' },
  { id: 'split', icon: Columns, label: 'Split' },
]

const PRIMARY_NAV: { id: SourceMode; icon: React.ElementType; label: string }[] = [
  { id: 'projects', icon: FolderCode, label: 'Projects' },
  { id: 'teams', icon: Users, label: 'Agent Teams' },
  { id: 'analytics', icon: BarChart2, label: 'Analytics' },
  { id: 'content', icon: FolderOpen, label: 'Content' },
  { id: 'conversations', icon: MessageSquare, label: 'Conversations' },
]

export function Toolbar({
  source, onSourceChange,
  view, onViewChange,
  onRefresh, onOpenPalette, onNewTeam,
  teamCount, projectCount,
  claudeDir,
  scanning,
  todayCostUSD,
  monthlyCostUSD,
}: Props) {
  return (
    <header className="relative flex items-center gap-3 px-5 py-3
                       bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shrink-0 select-none">
      {/* Animated gradient bottom border */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, #8b5cf6 25%, #3b82f6 50%, #8b5cf6 75%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'gradient-slide 4s linear infinite',
        }}
      />
      {/* Logo */}
      <div className="flex items-center gap-2.5 mr-1 pt-0.5">
        <div className="w-7 h-7 flex items-center justify-center shrink-0">
          <img src="./icon.png" alt="Claude Lens" className="w-full h-full object-contain drop-shadow-sm" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-zinc-900 dark:text-white leading-none">Claude Lens</h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-none mt-0.5 font-mono">{claudeDir}</p>
        </div>
      </div>

      {/* Primary nav */}
      <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-white/[0.06] rounded-xl p-1 border border-zinc-200 dark:border-white/10">
        {PRIMARY_NAV.map(({ id, icon: Icon, label }) => {
          const isActive = source === id
          let badge: React.ReactNode = null
          if (id === 'teams') {
            badge = (
              <span className={cn(
                'text-xs font-mono rounded-full px-1.5 py-px',
                isActive ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400'
                  : 'bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-zinc-400'
              )}>{teamCount}</span>
            )
          } else if (id === 'projects') {
            badge = scanning
              ? <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              : (
                <span className={cn(
                  'text-xs font-mono rounded-full px-1.5 py-px',
                  isActive ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                    : 'bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-zinc-400'
                )}>{projectCount}</span>
              )
          }
          return (
            <button
              key={id}
              onClick={() => onSourceChange(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                isActive
                  ? 'bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm border border-zinc-200/80 dark:border-white/10'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {badge}
            </button>
          )
        })}
      </div>

      {/* View switcher (only for Teams) */}
      {source === 'teams' && (
        <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-white/[0.06] rounded-xl p-1 border border-zinc-200 dark:border-white/10">
          {VIEWS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              title={label}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                view === id
                  ? 'bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm border border-zinc-200/80 dark:border-white/10'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Status: model + cost */}
      <div className="hidden sm:flex items-center gap-2">
        {(todayCostUSD !== null || monthlyCostUSD !== null) && (
          <div className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium font-mono',
            'bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/10',
            costColor(todayCostUSD ?? 0),
          )}>
            {todayCostUSD !== null && (
              <>
                <span>${todayCostUSD.toFixed(2)}</span>
                <span className="text-zinc-500 dark:text-zinc-600 font-normal">today</span>
              </>
            )}
            {todayCostUSD !== null && monthlyCostUSD !== null && (
              <span className="text-zinc-300 dark:text-zinc-700 mx-0.5">|</span>
            )}
            {monthlyCostUSD !== null && (
              <>
                <span className={costColor(monthlyCostUSD)}>${monthlyCostUSD.toFixed(2)}</span>
                <span className="text-zinc-500 dark:text-zinc-600 font-normal">month</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* New Team button (only visible on teams source) */}
      {source === 'teams' && onNewTeam && (
        <button
          onClick={onNewTeam}
          title="New Team"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                     bg-violet-600 hover:bg-violet-700 text-white transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          New Team
        </button>
      )}

      {/* System & Settings icon buttons */}
      <button
        onClick={() => onSourceChange('system')}
        title="System"
        className={cn(
          'p-2 rounded-lg transition-colors',
          source === 'system'
            ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400'
            : 'hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
        )}
      >
        <Monitor className="w-4 h-4" />
      </button>

      <button
        onClick={() => onSourceChange('settings')}
        title="Settings"
        className={cn(
          'p-2 rounded-lg transition-colors',
          source === 'settings'
            ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400'
            : 'hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
        )}
      >
        <Settings className="w-4 h-4" />
      </button>

      <button
        onClick={onRefresh}
        title="Refresh"
        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

    </header>
  )
}
