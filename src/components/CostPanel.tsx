import { DollarSign, Zap, Database, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn, shortenModel } from '../lib/utils'
import { formatCost, formatTokens, getTeamCost } from '../lib/costs'
import type { CostMap } from '../types'

interface Props {
  costMap: CostMap
  teamName: string
  compact?: boolean
}

export function CostPanel({ costMap, teamName, compact }: Props) {
  const [expanded, setExpanded] = useState(false)
  const summary = getTeamCost(costMap, teamName)
  const hasData = summary.totalInputTokens > 0 || summary.totalOutputTokens > 0

  if (!hasData) {
    return (
      <div className={cn(
        'flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500',
        compact ? '' : 'px-3 py-2'
      )}>
        <DollarSign className="w-3.5 h-3.5" />
        <span>No usage data</span>
      </div>
    )
  }

  const totalTokens = summary.totalInputTokens + summary.totalOutputTokens

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={cn(
          'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
          summary.hasRealCost
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400'
        )}>
          <DollarSign className="w-3 h-3" />
          {summary.hasRealCost ? formatCost(summary.totalCostUSD) : `${formatTokens(totalTokens)} tok`}
        </span>
      </div>
    )
  }

  return (
    <div className="border-t border-zinc-100 dark:border-white/[0.06]">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Usage & Cost
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-sm font-bold',
            summary.hasRealCost ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'
          )}>
            {summary.hasRealCost ? formatCost(summary.totalCostUSD) : '—'}
          </span>
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Totals row */}
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={Zap}      label="Input"  value={formatTokens(summary.totalInputTokens)} />
            <Stat icon={Zap}      label="Output" value={formatTokens(summary.totalOutputTokens)} />
            <Stat icon={Database} label="Cache"  value={formatTokens(
              Object.values(summary.agents).reduce((s, a) => s + a.cacheReadTokens, 0)
            )} />
          </div>

          {/* Per-agent breakdown */}
          {Object.entries(summary.agents).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Per agent</p>
              {Object.entries(summary.agents).map(([name, agent]) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <div className="min-w-0 mr-2">
                    <span className="text-zinc-700 dark:text-zinc-200 font-medium truncate">{name}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 ml-1.5 font-mono text-xs">
                      {shortenModel(agent.model)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <span className="text-zinc-400 dark:text-zinc-500 font-mono">
                      {formatTokens(agent.inputTokens + agent.outputTokens)}
                    </span>
                    <span className={cn(
                      'font-semibold font-mono min-w-[3.5rem] text-right',
                      agent.costUSD !== null
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-400 dark:text-zinc-500'
                    )}>
                      {formatCost(agent.costUSD)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!summary.hasRealCost && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
              Cost tracking only available for Claude API models
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-zinc-50 dark:bg-white/5 rounded-lg px-2.5 py-2 text-center">
      <Icon className="w-3 h-3 text-zinc-400 mx-auto mb-0.5" />
      <div className="text-sm font-bold text-zinc-700 dark:text-zinc-200 font-mono">{value}</div>
      <div className="text-xs text-zinc-400">{label}</div>
    </div>
  )
}
