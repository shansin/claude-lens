import { useState, useEffect } from 'react'
import { Crown } from 'lucide-react'
import { cn } from '../lib/utils'

interface AgentMetric {
  agentName: string
  agentType: string
  model: string
  isLead: boolean
  tasksCompleted: number
  tasksActive: number
  tasksPending: number
  estimatedCostUSD: number | null
}

interface Props {
  teamName: string
}

function formatCost(usd: number | null): string {
  if (usd === null) return '—'
  if (usd < 0.01)   return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function shortenModel(model: string): string {
  if (model.includes('claude')) {
    return model.replace('claude-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
  return model.replace(/[:-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function AgentMetrics({ teamName }: Props) {
  const [metrics, setMetrics] = useState<AgentMetric[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    ;(window as any).electronAPI.getAgentMetrics(teamName)
      .then((data: AgentMetric[]) => {
        const sorted = [...(data ?? [])].sort((a, b) => b.tasksCompleted - a.tasksCompleted)
        setMetrics(sorted)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [teamName])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm">Loading agent metrics…</span>
      </div>
    )
  }

  if (metrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
        <Crown className="w-10 h-10 text-zinc-400" />
        <p className="text-sm text-zinc-500">No agent data for this team</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02]">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Agent</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Type</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Model</th>
            <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Done</th>
            <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Active</th>
            <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Pending</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
          {metrics.map((m) => (
            <tr
              key={m.agentName}
              className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {m.isLead && (
                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className={cn(
                    'font-medium text-zinc-800 dark:text-zinc-200 truncate',
                    m.isLead && 'text-violet-700 dark:text-violet-300'
                  )}>
                    {m.agentName}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">{m.agentType}</td>
              <td className="px-4 py-3">
                <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{shortenModel(m.model)}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-medium',
                  'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                )}>
                  {m.tasksCompleted}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-medium',
                  'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400'
                )}>
                  {m.tasksActive}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-medium',
                  'bg-zinc-100 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400'
                )}>
                  {m.tasksPending}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                {formatCost(m.estimatedCostUSD)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
