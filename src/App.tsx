import { useState, useEffect, useCallback } from 'react'
import { useTeamData } from './hooks/useTeamData'
import { Toolbar } from './components/Toolbar'
import { CardView } from './components/views/CardView'
import { GraphView } from './components/views/GraphView'
import { SplitView } from './components/views/SplitView'
import { ProjectsView } from './components/views/ProjectsView'
import { AnalyticsView } from './components/views/AnalyticsView'
import { ContentView } from './components/views/ContentView'
import { SearchView } from './components/views/SearchView'
import { ConversationView } from './components/views/ConversationView'
import { SystemView } from './components/views/SystemView'
import { SettingsView } from './components/views/SettingsView'
import { CommandPalette } from './components/CommandPalette'
import { Toast } from './components/Toast'
import type { ViewMode, SourceMode } from './types'
import { Loader2 } from 'lucide-react'

export default function App() {
  const {
    teams, theme, loading, scanning, lastUpdated, claudeDir,
    costMap, projects, toastMsg,
    refresh, refreshScanned,
    deleteTeam, archiveTeam, clearTasks, openCwd, revealTeam, copyText,
  } = useTeamData()

  const [source, setSource] = useState<SourceMode>('teams')
  const [view,   setView]   = useState<ViewMode>('cards')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [convSession, setConvSession] = useState<{ projectKey: string; sessionId: string } | null>(null)
  const isDark = theme === 'dark'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  // Cmd+K / Ctrl+K opens command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(p => !p)
      }
      if (e.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleRefresh = () => {
    refresh()
    if (source === 'projects') refreshScanned()
  }

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
        lastUpdated={lastUpdated}
        claudeDir={claudeDir}
        scanning={scanning}
        onOpenPalette={() => setPaletteOpen(true)}
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

        {source === 'analytics'     && <AnalyticsView />}
        {source === 'content'       && <ContentView />}
        {source === 'search'        && (
          <SearchView onOpenSession={handleOpenSession} />
        )}
        {source === 'conversations' && (
          <ConversationView
            initialProjectKey={convSession?.projectKey}
            initialSessionId={convSession?.sessionId}
            onCopy={copyText}
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
    </div>
  )
}
