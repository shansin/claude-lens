import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '../../lib/utils'
import { Search, FileText, FolderOpen, ExternalLink } from 'lucide-react'

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

interface Props {
  onOpenSession?: (projectKey: string, sessionId: string) => void
}

function formatTime(ts: number) {
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

export function SearchView({ onOpenSession }: Props = {}) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const res = await window.electronAPI.searchContent(q.trim(), 50)
      setResults(res)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!query.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    timerRef.current = setTimeout(() => doSearch(query), 500)
    return () => clearTimeout(timerRef.current)
  }, [query, doSearch])

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-white/[0.06]
                      bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm shrink-0">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search conversation content…"
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-white/10
                       bg-zinc-50 dark:bg-white/5 text-zinc-800 dark:text-zinc-200
                       placeholder-zinc-400 dark:placeholder-zinc-500
                       focus:outline-none focus:ring-2 focus:ring-violet-500/40 dark:focus:ring-violet-400/30"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
        {searched && !loading && (
          <p className="text-xs text-zinc-400 mt-2">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!searched && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
            <Search className="w-12 h-12 text-zinc-400" />
            <p className="text-sm text-zinc-500">Search across all conversation history</p>
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
            <Search className="w-12 h-12 text-zinc-400" />
            <p className="text-sm text-zinc-500">No results for "{query}"</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
            {results.map((r, i) => (
              <div key={`${r.sessionId}-${i}`} className="px-6 py-3 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  {/* Project badge */}
                  <span data-sensitive className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                    <FolderOpen className="w-3 h-3" />
                    {r.projectName}
                  </span>
                  {/* Team badge */}
                  {r.teamName && (
                    <span data-sensitive className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                      {r.teamName}
                    </span>
                  )}
                  {/* Timestamp */}
                  <span className="text-xs text-zinc-400 ml-auto">{formatTime(r.timestamp)}</span>
                  {/* Open button */}
                  {onOpenSession && r.projectKey && (
                    <button
                      onClick={() => onOpenSession(r.projectKey!, r.sessionId)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </button>
                  )}
                  {/* Type icon */}
                  <span className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono',
                    r.type === 'user'
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
                  )}>
                    <FileText className="w-3 h-3 mr-1" />
                    {r.type}
                  </span>
                </div>
                <p data-sensitive className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  <HighlightedSnippet text={r.snippet} query={query} />
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
