import { formatRelativeTime, shortenModel, cn } from '../lib/utils'
import { formatCost, formatTokens } from '../lib/costs'
import type { ProjectData } from '../types'
import {
  FolderCode, MessageSquare, Clock, Zap, DollarSign,
  GitBranch, Copy, FolderOpen, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

interface Props {
  project: ProjectData
  onOpenCwd: (cwd: string) => void
  onCopy:    (text: string, label: string) => void
  onSelectTeam?: (teamName: string) => void
}

const MODEL_COLORS: Record<string, string> = {
  claude:    'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/20',
  gpt:       'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20',
  gemini:    'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20',
  default:   'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/10',
}

function modelColor(model: string) {
  if (model.includes('claude')) return MODEL_COLORS.claude
  if (model.includes('gpt'))    return MODEL_COLORS.gpt
  if (model.includes('gemini')) return MODEL_COLORS.gemini
  return MODEL_COLORS.default
}

export function ProjectCard({ project, onOpenCwd, onCopy, onSelectTeam }: Props) {
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const totalTokens = project.totalInputTokens + project.totalOutputTokens
  const hasCost = project.costUSD !== null && project.costUSD > 0

  return (
    <div className="rounded-2xl border bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-white/10
                    hover:border-blue-400/60 dark:hover:border-blue-400/30 hover:shadow-lg dark:hover:shadow-blue-500/5
                    transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shrink-0 shadow-sm">
            <FolderCode className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-zinc-900 dark:text-white truncate leading-tight">
              {project.displayName}
            </h3>
            <button
              onClick={() => onCopy(project.cwd, 'Copied path')}
              className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mt-0.5 group/path"
              title="Copy path"
            >
              <span className="truncate max-w-[220px]">{project.cwd}</span>
              <Copy className="w-3 h-3 opacity-0 group-hover/path:opacity-100 shrink-0" />
            </button>
          </div>
          <button
            onClick={() => onOpenCwd(project.cwd)}
            title="Open folder"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors shrink-0"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 pb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{project.sessions.length}</span>
          <span>sessions</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Zap className="w-3.5 h-3.5" />
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{formatTokens(totalTokens)}</span>
          <span>tokens</span>
        </div>
        {project.lastActivity > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatRelativeTime(project.lastActivity)}</span>
          </div>
        )}
        {hasCost && (
          <div className="flex items-center gap-1 text-xs ml-auto">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">
              {formatCost(project.costUSD)}
            </span>
          </div>
        )}
      </div>

      {/* Models */}
      {project.models.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {project.models.map(m => (
            <span key={m} className={cn(
              'inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium',
              modelColor(m)
            )}>
              {shortenModel(m)}
            </span>
          ))}
        </div>
      )}

      {/* Linked teams */}
      {project.linkedTeams.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {project.linkedTeams.map(t => (
            <button
              key={t}
              onClick={() => onSelectTeam?.(t)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full
                         bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400
                         border border-violet-200 dark:border-violet-500/20
                         hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors"
            >
              <GitBranch className="w-3 h-3" />
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Sessions expandable */}
      {project.sessions.length > 0 && (
        <div className="border-t border-zinc-100 dark:border-white/[0.06]">
          <button
            onClick={() => setSessionsOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
          >
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Sessions ({project.sessions.length})
            </span>
            {sessionsOpen
              ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
          </button>

          {sessionsOpen && (
            <div className="px-3 pb-3 space-y-1">
              {project.sessions.slice(0, 8).map(sess => (
                <div key={sess.sessionId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onCopy(sess.sessionId, 'Copied session ID')}
                      className="text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors truncate block"
                    >
                      {sess.sessionId.slice(0, 8)}…
                    </button>
                    {sess.linkedTeam && (
                      <span className="text-xs text-violet-500 dark:text-violet-400">{sess.linkedTeam}</span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-zinc-400">{formatRelativeTime(sess.lastSeen)}</div>
                    {sess.model && (
                      <div className={cn('text-xs font-medium', modelColor(sess.model).split(' ')[3] || 'text-zinc-400')}>
                        {shortenModel(sess.model)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {project.sessions.length > 8 && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 px-2 py-1">
                  +{project.sessions.length - 8} more sessions
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
