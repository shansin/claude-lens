import { useState, useEffect, useCallback, useRef } from 'react'
import { useTeamData } from './hooks/useTeamData'
import { Toolbar } from './components/Toolbar'
import { CardView } from './components/views/CardView'
import { GraphView } from './components/views/GraphView'
import { SplitView } from './components/views/SplitView'
import { ProjectsView } from './components/views/ProjectsView'
import { AnalyticsView } from './components/views/AnalyticsView'
import { ContentView } from './components/views/ContentView'

import { ConversationView } from './components/views/ConversationView'
import { SystemView } from './components/views/SystemView'
import { SettingsView } from './components/views/SettingsView'
import { CommandPalette } from './components/CommandPalette'
import { Toast } from './components/Toast'
import type { ViewMode, SourceMode } from './types'
import { Loader2, X } from 'lucide-react'

const SOURCE_KEYS: Record<string, SourceMode> = {
  '1': 'projects', '2': 'teams', '3': 'analytics',
  '4': 'content', '5': 'conversations',
  '6': 'system', '7': 'settings',
}

function CreateTeamModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (name: string, description: string) => void
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Team name is required'); return }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError('Name can only contain letters, numbers, hyphens, and underscores')
      return
    }
    onCreate(trimmed, desc.trim())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10
                      shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">New Team</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300
                       hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Team Name <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="my-team"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-white/10
                         bg-zinc-50 dark:bg-white/5 text-zinc-800 dark:text-zinc-200
                         placeholder-zinc-400 dark:placeholder-zinc-500
                         focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Description
            </label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What does this team do?"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-white/10
                         bg-zinc-50 dark:bg-white/5 text-zinc-800 dark:text-zinc-200
                         placeholder-zinc-400 dark:placeholder-zinc-500
                         focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-400
                         hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded-lg font-medium bg-violet-600 hover:bg-violet-700
                         text-white transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function App() {
  const {
    teams, theme, loading, scanning, lastUpdated, claudeDir,
    costMap, projects, toastMsg,
    refresh, refreshScanned,
    deleteTeam, archiveTeam, clearTasks, createTeam, openCwd, revealTeam, copyText,
  } = useTeamData()

  const [source, setSource] = useState<SourceMode>('teams')
  const [view,   setView]   = useState<ViewMode>('cards')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [convSession, setConvSession] = useState<{ projectKey: string; sessionId: string } | null>(null)
  const isDark = theme === 'dark'

  const [todayCostUSD, setTodayCostUSD] = useState<number | null>(null)
  const [monthlyCostUSD, setMonthlyCostUSD] = useState<number | null>(null)
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const refreshTodayStats = useCallback(async () => {
    try {
      const usage = await window.electronAPI.getUsageByDay(31)
      // usage is ordered oldest→newest, so today is the last element
      const today = usage[usage.length - 1]
      if (today) setTodayCostUSD(today.costUSD)
      // Sum all days for monthly cost
      const monthTotal = usage.reduce((sum, d) => sum + (d.costUSD ?? 0), 0)
      setMonthlyCostUSD(monthTotal > 0 ? monthTotal : null)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    refreshTodayStats()
    statsIntervalRef.current = setInterval(refreshTodayStats, 30_000)
    return () => clearInterval(statsIntervalRef.current)
  }, [refreshTodayStats])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  const handleRefresh = useCallback(() => {
    refresh()
    if (source === 'projects') refreshScanned()
  }, [refresh, refreshScanned, source])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
      if (isEditable) return

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(p => !p)
        return
      }
      if (e.key === 'Escape') { setPaletteOpen(false); return }

      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (SOURCE_KEYS[e.key]) { setSource(SOURCE_KEYS[e.key]); return }
        if (e.key === 'r') { handleRefresh(); return }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleRefresh])

  // Open a specific conversation session (e.g. from Search results)
  const handleOpenSession = useCallback((projectKey: string, sessionId: string) => {
    setConvSession({ projectKey, sessionId })
    setSource('conversations')
  }, [])

  const teamActionProps = {
    costMap,
    onDelete:     deleteTeam,
    onArchive:    archiveTeam,
    onClearTasks: clearTasks,
    onOpenCwd:    openCwd,
    onReveal:     revealTeam,
    onCopy:       copyText,
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden">
      <Toolbar
        source={source}
        onSourceChange={setSource}
        view={view}
        onViewChange={setView}
        onRefresh={handleRefresh}
        teamCount={teams.length}
        projectCount={projects.length}
        claudeDir={claudeDir}
        scanning={scanning}
        onOpenPalette={() => setPaletteOpen(true)}
        onNewTeam={() => setShowCreateTeam(true)}
        todayCostUSD={todayCostUSD}
        monthlyCostUSD={monthlyCostUSD}
      />

      <main className="flex-1 overflow-hidden relative">
        {source === 'teams' && (
          loading ? (
            <div className="flex items-center justify-center h-full gap-3 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Loading teams…</span>
            </div>
          ) : (
            <>
              {view === 'cards' && <CardView teams={teams} {...teamActionProps} />}
              {view === 'graph' && <GraphView teams={teams} isDark={isDark} />}
              {view === 'split' && <SplitView teams={teams} isDark={isDark} {...teamActionProps} />}
            </>
          )
        )}

        {source === 'projects' && (
          <ProjectsView
            projects={projects}
            scanning={scanning}
            onOpenCwd={openCwd}
            onCopy={copyText}
            onSelectTeam={() => setSource('teams')}
          />
        )}

        {source === 'analytics'     && <AnalyticsView projects={projects} />}
        {source === 'content'       && <ContentView />}
        {source === 'conversations' && (
          <ConversationView
            initialProjectKey={convSession?.projectKey}
            initialSessionId={convSession?.sessionId}
            onCopy={copyText}
            projects={projects}
            costMap={costMap}
          />
        )}
        {source === 'system'    && <SystemView />}
        {source === 'settings'  && (
          <SettingsView teams={teams.map(t => ({ teamName: t.teamName }))} />
        )}
      </main>

      <Toast message={toastMsg} />

      {/* Command palette overlay */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(s) => { setSource(s as SourceMode); setPaletteOpen(false) }}
        teams={teams.map(t => ({ teamName: t.teamName, leadSessionId: t.team.leadSessionId }))}
        projects={projects.map(p => ({ projectKey: p.projectKey, displayName: p.displayName, cwd: p.cwd }))}
      />

      {/* Create team modal */}
      {showCreateTeam && (
        <CreateTeamModal
          onClose={() => setShowCreateTeam(false)}
          onCreate={createTeam}
        />
      )}
    </div>
  )
}
