import { useState, useEffect, useCallback, useRef } from 'react'
import { Folder, MessageSquare, Search, Copy, ChevronDown, ChevronRight, Download, FileText, FolderOpen, ExternalLink } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatRelativeTime, shortenModel } from '../../lib/utils'
import { formatCost } from '../../lib/costs'
import { ConversationThread } from '../ConversationThread'
import type { SessionMessage, ProjectData, ProjectSession, CostMap } from '../../types'

interface Props {
  initialProjectKey?: string
  initialSessionId?: string
  onCopy?: (text: string, label: string) => void
  projects?: ProjectData[]
  costMap?: CostMap
}

function messagesToMarkdown(messages: SessionMessage[], projectName: string, sessionId: string): string {
  const lines: string[] = [
    `# Conversation: ${projectName}`,
    `**Session:** \`${sessionId}\``,
    `**Exported:** ${new Date().toLocaleString()}`,
    '',
    '---',
    '',
  ]

  for (const msg of messages) {
    lines.push(`## ${msg.type === 'user' ? 'User' : 'Assistant'}`)
    if (msg.model) lines.push(`*${shortenModel(msg.model.replace(/-\d{8}$/, ''))}*`)
    if (msg.timestamp) lines.push(`*${new Date(msg.timestamp).toLocaleString()}*`)
    lines.push('')

    for (const block of msg.content) {
      if (block.type === 'text') {
        lines.push(block.text)
      } else if (block.type === 'tool_use') {
        lines.push(`\`\`\`json`)
        lines.push(`// Tool: ${block.name}`)
        lines.push(JSON.stringify(block.input, null, 2))
        lines.push('```')
      } else if (block.type === 'tool_result') {
        const text = typeof block.content === 'string'
          ? block.content
          : block.content.map(c => c.text ?? '').join('\n')
        lines.push('**Tool result:**')
        lines.push('```')
        lines.push(text.slice(0, 2000))
        if (text.length > 2000) lines.push('…(truncated)')
        lines.push('```')
      } else if (block.type === 'thinking') {
        lines.push(`> *Thinking: ${block.thinking}*`)
      }
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }
  return lines.join('\n')
}

interface SearchResult {
  sessionId: string
  projectCwd: string
  projectName: string
  projectKey?: string
  teamName?: string
  timestamp: number
  type: string
  snippet: string
}

function formatSearchTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/30 text-inherit rounded px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  )
}

export function ConversationView({ initialProjectKey, initialSessionId, onCopy, projects: projectsProp, costMap }: Props) {
  const [projects, setProjects]               = useState<ProjectData[]>(projectsProp ?? [])
  const [selectedProject, setSelectedProject] = useState<string | null>(initialProjectKey ?? null)
  const [selectedSession, setSelectedSession] = useState<string | null>(initialSessionId ?? null)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    initialProjectKey ? new Set([initialProjectKey]) : new Set()
  )
  const [messages, setMessages]   = useState<SessionMessage[]>([])
  const [loading, setLoading]     = useState(false)
  const [projectSearch, setProjectSearch] = useState('')

  // Search state
  const [sidebarMode, setSidebarMode] = useState<'browse' | 'search'>('browse')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchExecuted, setSearchExecuted] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimerRef.current)
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSearchExecuted(false)
      return
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true)
      setSearchExecuted(true)
      try {
        const res = await window.electronAPI.searchContent(searchQuery.trim(), 50)
        setSearchResults(res)
      } finally {
        setSearchLoading(false)
      }
    }, 500)
    return () => clearTimeout(searchTimerRef.current)
  }, [searchQuery])

  const handleSearchOpenSession = useCallback((projectKey: string, sessionId: string) => {
    setSelectedProject(projectKey)
    setSelectedSession(sessionId)
    setExpandedProjects(prev => new Set([...prev, projectKey]))
    setSidebarMode('browse')
  }, [])

  // Load projects only if not provided via props
  useEffect(() => {
    if (projectsProp && projectsProp.length > 0) {
      setProjects(projectsProp)
      return
    }
    window.electronAPI.getAllScanned().then(({ projects: ps }) => {
      setProjects(ps)
    })
  }, [projectsProp])

  // Sync projects prop changes
  useEffect(() => {
    if (projectsProp) setProjects(projectsProp)
  }, [projectsProp])

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

  const handleExport = async () => {
    if (!messages.length || !selectedSession) return
    const projectName = currentProject?.displayName ?? selectedProject ?? 'conversation'
    const markdown = messagesToMarkdown(messages, projectName, selectedSession)
    const suggestedName = `conversation-${selectedSession.slice(-8)}.md`
    const result = await window.electronAPI.exportSession(markdown, suggestedName)
    if (result.ok && result.path) {
      onCopy?.(result.path, `Saved to ${result.path}`)
    }
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left panel - project/session browser + search */}
      <div className="w-[280px] shrink-0 flex flex-col border-r border-zinc-200 dark:border-white/[0.06]
                      bg-zinc-50/50 dark:bg-zinc-950/30">
        {/* Mode toggle: Browse / Search */}
        <div className="flex items-center gap-0.5 px-3 pt-3 pb-2 shrink-0">
          <button
            onClick={() => setSidebarMode('browse')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
              sidebarMode === 'browse'
                ? 'bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm border border-zinc-200/80 dark:border-white/10'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            )}
          >
            <Folder className="w-3.5 h-3.5" />
            Browse
          </button>
          <button
            onClick={() => setSidebarMode('search')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
              sidebarMode === 'search'
                ? 'bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm border border-zinc-200/80 dark:border-white/10'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            )}
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </button>
        </div>

        {sidebarMode === 'browse' ? (
          <>
            {/* Filter */}
            <div className="px-3 pb-3 border-b border-zinc-200 dark:border-white/[0.06] shrink-0">
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
                      costMap={costMap}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Search bar */}
            <div className="px-3 pb-3 border-b border-zinc-200 dark:border-white/[0.06] shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search conversations…"
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-white/10
                             bg-white dark:bg-white/[0.05] text-zinc-800 dark:text-zinc-200
                             placeholder-zinc-400 dark:placeholder-zinc-500
                             focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
                {searchLoading && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {searchExecuted && !searchLoading && (
                <p className="text-[10px] text-zinc-400 mt-1.5 px-0.5">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Search results */}
            <div className="flex-1 overflow-y-auto">
              {!searchExecuted && !searchLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40 p-4">
                  <Search className="w-8 h-8 text-zinc-400" />
                  <p className="text-xs text-zinc-500 text-center">Search across all conversations</p>
                </div>
              )}
              {searchExecuted && !searchLoading && searchResults.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40 p-4">
                  <Search className="w-8 h-8 text-zinc-400" />
                  <p className="text-xs text-zinc-500 text-center">No results for "{searchQuery}"</p>
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                  {searchResults.map((r, i) => (
                    <button
                      key={`${r.sessionId}-${i}`}
                      onClick={() => r.projectKey && handleSearchOpenSession(r.projectKey, r.sessionId)}
                      className="w-full text-left px-3 py-2.5 hover:bg-zinc-100 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span data-sensitive className="text-[10px] font-medium text-blue-600 dark:text-blue-400 truncate">
                          {r.projectName}
                        </span>
                        {r.teamName && (
                          <span data-sensitive className="text-[10px] text-violet-500 dark:text-violet-400 truncate">
                            {r.teamName}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-400 ml-auto shrink-0">
                          {formatSearchTime(r.timestamp)}
                        </span>
                      </div>
                      <p data-sensitive className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-2">
                        <HighlightedSnippet text={r.snippet} query={searchQuery} />
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
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
                <span data-sensitive className="font-medium truncate">{currentProject?.displayName ?? selectedProject}</span>
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
              <div className="ml-auto flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs
                               text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06]
                               transition-colors"
                    title="Export as Markdown"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </button>
                )}
                <button
                  onClick={() => onCopy?.(selectedSession, 'Session ID copied')}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs
                             text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06]
                             transition-colors"
                  title="Copy session ID"
                >
                  <Copy className="w-3 h-3" />
                  Copy ID
                </button>
              </div>
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
  costMap?: CostMap
}

function ProjectRow({ project, expanded, selectedProject, selectedSession, onToggle, onSelectSession, costMap }: ProjectRowProps) {
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
        <span data-sensitive className="truncate font-medium">{project.displayName}</span>
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
              costMap={costMap}
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
  costMap?: CostMap
}

function SessionRow({ session, projectKey, active, onSelect, costMap }: SessionRowProps) {
  const sessionCost = session.linkedTeam && costMap
    ? (costMap[session.linkedTeam]?.[session.sessionId]?.costUSD ?? null)
    : null

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
      {sessionCost !== null && (
        <span className="shrink-0 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
          {formatCost(sessionCost)}
        </span>
      )}
      <span className="ml-auto shrink-0 text-zinc-400">{formatRelativeTime(session.lastSeen)}</span>
    </button>
  )
}
