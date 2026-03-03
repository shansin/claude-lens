import { useState, useEffect, useCallback } from 'react'
import { Folder, MessageSquare, Search, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatRelativeTime, shortenModel } from '../../lib/utils'
import { ConversationThread } from '../ConversationThread'
import type { SessionMessage, ProjectData, ProjectSession } from '../../types'

interface Props {
  initialProjectKey?: string
  initialSessionId?: string
  onCopy?: (text: string, label: string) => void
}

export function ConversationView({ initialProjectKey, initialSessionId, onCopy }: Props) {
  const [projects, setProjects]               = useState<ProjectData[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(initialProjectKey ?? null)
  const [selectedSession, setSelectedSession] = useState<string | null>(initialSessionId ?? null)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    initialProjectKey ? new Set([initialProjectKey]) : new Set()
  )
  const [messages, setMessages]   = useState<SessionMessage[]>([])
  const [loading, setLoading]     = useState(false)
  const [projectSearch, setProjectSearch] = useState('')

  // Load projects on mount
  useEffect(() => {
    window.electronAPI.getAllScanned().then(({ projects: ps }) => {
      setProjects(ps)
    })
  }, [])

  // Auto-select initial session
  useEffect(() => {
    if (initialProjectKey && initialSessionId && projects.length > 0) {
      setSelectedProject(initialProjectKey)
      setSelectedSession(initialSessionId)
      setExpandedProjects(prev => new Set([...prev, initialProjectKey]))
    }
  }, [initialProjectKey, initialSessionId, projects.length])

  // Load messages when session changes
  useEffect(() => {
    if (!selectedProject || !selectedSession) return
    setLoading(true)
    setMessages([])
    window.electronAPI.getSessionMessages(selectedProject, selectedSession)
      .then(msgs => setMessages(msgs))
      .finally(() => setLoading(false))
  }, [selectedProject, selectedSession])

  const toggleProjectExpanded = useCallback((key: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const selectSession = useCallback((projectKey: string, sessionId: string) => {
    setSelectedProject(projectKey)
    setSelectedSession(sessionId)
    setExpandedProjects(prev => new Set([...prev, projectKey]))
  }, [])

  const filteredProjects = projects.filter(p => {
    if (!projectSearch.trim()) return true
    const q = projectSearch.toLowerCase()
    return p.displayName.toLowerCase().includes(q) || p.cwd.toLowerCase().includes(q)
  })

  // Find current session info
  const currentProject = projects.find(p => p.projectKey === selectedProject)
  const currentSession = currentProject?.sessions.find(s => s.sessionId === selectedSession)
  const totalTokens = messages.reduce((sum, m) => {
    if (!m.usage) return sum
    return sum + m.usage.inputTokens + m.usage.outputTokens
  }, 0)

  return (
    <div className="flex h-full min-h-0">
      {/* Left panel - project/session browser */}
      <div className="w-[280px] shrink-0 flex flex-col border-r border-zinc-200 dark:border-white/[0.06]
                      bg-zinc-50/50 dark:bg-zinc-950/30">
        {/* Search */}
        <div className="px-3 py-3 border-b border-zinc-200 dark:border-white/[0.06] shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
              placeholder="Filter projects…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-white/10
                         bg-white dark:bg-white/[0.05] text-zinc-800 dark:text-zinc-200
                         placeholder-zinc-400 dark:placeholder-zinc-500
                         focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto">
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40 p-4">
              <Folder className="w-8 h-8 text-zinc-400" />
              <p className="text-xs text-zinc-500 text-center">No projects found</p>
            </div>
          ) : (
            <div className="py-1">
              {filteredProjects.map(proj => (
                <ProjectRow
                  key={proj.projectKey}
                  project={proj}
                  expanded={expandedProjects.has(proj.projectKey)}
                  selectedProject={selectedProject}
                  selectedSession={selectedSession}
                  onToggle={toggleProjectExpanded}
                  onSelectSession={selectSession}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedSession ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
            <MessageSquare className="w-12 h-12 text-zinc-400" />
            <p className="text-sm text-zinc-500">Select a session to view its conversation</p>
          </div>
        ) : (
          <>
            {/* Header bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-white/[0.06]
                            bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm shrink-0 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 text-sm text-zinc-600 dark:text-zinc-300 truncate">
                <span className="font-medium truncate">{currentProject?.displayName ?? selectedProject}</span>
                <span className="text-zinc-400 shrink-0">›</span>
                <span className="font-mono text-xs text-zinc-500 shrink-0">…{selectedSession.slice(-8)}</span>
              </div>
              {currentSession?.model && (
                <span className="shrink-0 px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 dark:bg-violet-500/10
                                 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                  {shortenModel(currentSession.model.replace(/-\d{8}$/, ''))}
                </span>
              )}
              <span className="shrink-0 text-xs text-zinc-400">{messages.length} messages</span>
              {totalTokens > 0 && (
                <span className="shrink-0 text-xs text-zinc-400 font-mono">{totalTokens.toLocaleString()} tokens</span>
              )}
              <button
                onClick={() => onCopy?.(selectedSession, 'Session ID')}
                className="ml-auto shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs
                           text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06]
                           transition-colors"
                title="Copy session ID"
              >
                <Copy className="w-3 h-3" />
                Copy ID
              </button>
            </div>

            {/* Thread */}
            <div className="flex-1 min-h-0">
              <ConversationThread messages={messages} loading={loading} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface ProjectRowProps {
  project: ProjectData
  expanded: boolean
  selectedProject: string | null
  selectedSession: string | null
  onToggle: (key: string) => void
  onSelectSession: (projectKey: string, sessionId: string) => void
}

function ProjectRow({ project, expanded, selectedProject, selectedSession, onToggle, onSelectSession }: ProjectRowProps) {
  const isActive = selectedProject === project.projectKey
  return (
    <div>
      <button
        onClick={() => onToggle(project.projectKey)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
          isActive
            ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300'
            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
        )}
      >
        <span className="text-zinc-400 shrink-0">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <Folder className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
        <span className="truncate font-medium">{project.displayName}</span>
        <span className="ml-auto shrink-0 text-zinc-400">{project.sessions.length}</span>
      </button>
      {expanded && (
        <div className="pl-8 pb-1">
          {project.sessions.map(session => (
            <SessionRow
              key={session.sessionId}
              session={session}
              projectKey={project.projectKey}
              active={selectedSession === session.sessionId && selectedProject === project.projectKey}
              onSelect={onSelectSession}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SessionRowProps {
  session: ProjectSession
  projectKey: string
  active: boolean
  onSelect: (projectKey: string, sessionId: string) => void
}

function SessionRow({ session, projectKey, active, onSelect }: SessionRowProps) {
  return (
    <button
      onClick={() => onSelect(projectKey, session.sessionId)}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs rounded-md mx-1 my-0.5 transition-colors',
        active
          ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300'
          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-zinc-700 dark:hover:text-zinc-300'
      )}
    >
      <MessageSquare className="w-3 h-3 shrink-0 text-zinc-400" />
      <span className="font-mono truncate">…{session.sessionId.slice(-8)}</span>
      {session.model && (
        <span className="shrink-0 px-1 py-0.5 rounded text-zinc-400 dark:text-zinc-500 font-mono text-[10px]
                         bg-zinc-100 dark:bg-white/[0.06]">
          {shortenModel(session.model.replace(/-\d{8}$/, ''))}
        </span>
      )}
      <span className="ml-auto shrink-0 text-zinc-400">{formatRelativeTime(session.lastSeen)}</span>
    </button>
  )
}
