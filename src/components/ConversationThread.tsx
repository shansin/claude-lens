import { useState, useEffect, useRef, useMemo } from 'react'
import { Terminal, FileText, Globe, Cpu, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { cn, shortenModel } from '../lib/utils'
import type { ContentBlock, SessionMessage } from '../types'

export type { ContentBlock, SessionMessage }

function shortModelName(model?: string): string {
  if (!model) return ''
  const m = model.replace(/-\d{8}$/, '')
  return shortenModel(m)
}

function formatTs(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function getToolIcon(name: string) {
  const lc = name.toLowerCase()
  if (lc === 'bash' || lc.includes('shell') || lc.includes('terminal')) {
    return <Terminal className="w-3.5 h-3.5" />
  }
  if (['read', 'write', 'edit', 'glob', 'grep', 'notebookedit', 'notebookread'].includes(lc)) {
    return <FileText className="w-3.5 h-3.5" />
  }
  if (lc.includes('fetch') || lc.includes('search') || lc.includes('web')) {
    return <Globe className="w-3.5 h-3.5" />
  }
  return <Cpu className="w-3.5 h-3.5" />
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

function ToolUseBlock({ block }: { block: Extract<ContentBlock, { type: 'tool_use' }> }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors"
      >
        <span className="text-zinc-400 dark:text-zinc-500">{getToolIcon(block.name)}</span>
        <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/[0.08]">
          {block.name}
        </span>
        <span className="ml-auto text-zinc-400 dark:text-zinc-500">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-zinc-200 dark:border-white/[0.06] p-3">
          <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-all overflow-auto max-h-64
                          bg-zinc-100 dark:bg-black/30 rounded p-2">
            <code>{JSON.stringify(block.input, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

function ToolResultBlock({ block }: { block: Extract<ContentBlock, { type: 'tool_result' }> }) {
  const text = typeof block.content === 'string'
    ? block.content
    : block.content.map(c => c.text ?? '').join('\n')
  const preview = text.slice(0, 300)
  const truncated = text.length > 300
  return (
    <div className="bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-white/[0.06] rounded-lg px-3 py-2">
      <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-1">Tool result</p>
      <pre className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap break-all overflow-hidden max-h-24 font-mono">
        {preview}{truncated ? '…' : ''}
      </pre>
    </div>
  )
}

function ThinkingBlock({ block }: { block: Extract<ContentBlock, { type: 'thinking' }> }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500 italic hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Thinking…
      </button>
      {expanded && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 italic whitespace-pre-wrap pl-4 border-l-2 border-zinc-200 dark:border-white/[0.08]">
          {block.thinking}
        </p>
      )}
    </div>
  )
}

function MessageCard({ msg, searchQuery }: { msg: SessionMessage; searchQuery: string }) {
  const isUser = msg.type === 'user'
  return (
    <div className={cn(
      'rounded-xl border-l-4 p-4 bg-white dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06] shadow-sm',
      isUser ? 'border-l-blue-500' : 'border-l-violet-500'
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          'text-xs font-semibold',
          isUser ? 'text-blue-600 dark:text-blue-400' : 'text-violet-600 dark:text-violet-400'
        )}>
          {isUser ? 'User' : 'Assistant'}
        </span>
        {!isUser && msg.model && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">
            {shortModelName(msg.model)}
          </span>
        )}
        {!isUser && msg.usage && (
          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500 font-mono">
            {msg.usage.inputTokens}↑ {msg.usage.outputTokens}↓
          </span>
        )}
      </div>

      {/* Content blocks */}
      <div data-sensitive className="flex flex-col gap-2">
        {msg.content.map((block, i) => {
          if (block.type === 'text') {
            return (
              <p key={i} className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-200 leading-relaxed">
                <HighlightText text={block.text} query={searchQuery} />
              </p>
            )
          }
          if (block.type === 'tool_use') {
            return <ToolUseBlock key={i} block={block} />
          }
          if (block.type === 'tool_result') {
            return <ToolResultBlock key={i} block={block} />
          }
          if (block.type === 'thinking') {
            return <ThinkingBlock key={i} block={block} />
          }
          return null
        })}
      </div>

      {/* Timestamp */}
      {msg.timestamp > 0 && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">{formatTs(msg.timestamp)}</p>
      )}
    </div>
  )
}

function messageMatchesQuery(msg: SessionMessage, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return msg.content.some(block => {
    if (block.type === 'text') return block.text.toLowerCase().includes(q)
    if (block.type === 'thinking') return block.thinking.toLowerCase().includes(q)
    if (block.type === 'tool_result') {
      const text = typeof block.content === 'string'
        ? block.content
        : block.content.map(c => c.text ?? '').join(' ')
      return text.toLowerCase().includes(q)
    }
    return false
  })
}

interface Props {
  messages: SessionMessage[]
  loading: boolean
}

export function ConversationThread({ messages, loading }: Props) {
  const [searchOpen, setSearchOpen]   = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Ctrl+F / Cmd+F opens search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(v => {
          if (!v) setTimeout(() => searchInputRef.current?.focus(), 50)
          return !v
        })
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages
    return messages.filter(m => messageMatchesQuery(m, searchQuery.trim()))
  }, [messages, searchQuery])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-zinc-400">
        <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        <span className="text-sm">Loading messages…</span>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
        <p className="text-sm text-zinc-500">No messages in this session</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* In-session search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-white/[0.06]
                        bg-white/80 dark:bg-zinc-950/80 shrink-0">
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages… (Esc to close)"
            className="flex-1 text-sm bg-transparent text-zinc-800 dark:text-zinc-200
                       placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
          />
          {searchQuery && (
            <span className="text-xs text-zinc-400">
              {filteredMessages.length} / {messages.length}
            </span>
          )}
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery('') }}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Thread */}
      <div className="overflow-y-auto flex-1 p-4">
        {filteredMessages.length === 0 && searchQuery ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
            <Search className="w-8 h-8 text-zinc-400" />
            <p className="text-sm text-zinc-500">No messages match "{searchQuery}"</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-3xl mx-auto">
            {filteredMessages.map(msg => (
              <MessageCard key={msg.id} msg={msg} searchQuery={searchQuery} />
            ))}
          </div>
        )}
      </div>

      {/* Hint when search is closed */}
      {!searchOpen && messages.length > 0 && (
        <div className="px-4 py-1.5 border-t border-zinc-100 dark:border-white/[0.04] shrink-0">
          <button
            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50) }}
            className="text-xs text-zinc-400 hover:text-zinc-500 transition-colors flex items-center gap-1"
          >
            <Search className="w-3 h-3" />
            <span>Search messages (⌘F)</span>
          </button>
        </div>
      )}
    </div>
  )
}
