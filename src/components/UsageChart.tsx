import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'
import { TrendingUp, DollarSign, Zap } from 'lucide-react'
import { cn } from '../lib/utils'

export interface DayUsage {
  date: string
  inputTokens: number
  outputTokens: number
  cacheTokens: number
  costUSD: number | null
  byModel: Record<string, { inputTokens: number; outputTokens: number; costUSD: number | null }>
}

interface Props {
  data: DayUsage[]
}

function formatTokensShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatCostUSD(usd: number | null): string {
  if (usd === null) return '—'
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function shortenDate(date: string): string {
  // "2026-03-01" → "Mar 1"
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const day = payload[0]?.payload as DayUsage | undefined
  if (!day) return null
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-3 shadow-xl text-xs">
      <p className="font-semibold text-zinc-700 dark:text-zinc-200 mb-1.5">{label}</p>
      <div className="space-y-1">
        <p><span className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-500 mr-1.5" />Input: {formatTokensShort(day.inputTokens)}</p>
        <p><span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500 mr-1.5" />Output: {formatTokensShort(day.outputTokens)}</p>
        {day.cacheTokens > 0 && (
          <p className="text-zinc-400">Cache: {formatTokensShort(day.cacheTokens)}</p>
        )}
        {day.costUSD !== null && (
          <p className="text-emerald-600 dark:text-emerald-400 font-medium mt-1">Cost: {formatCostUSD(day.costUSD)}</p>
        )}
      </div>
    </div>
  )
}

export function UsageChart({ data }: Props) {
  const stats = useMemo(() => {
    let totalCost: number | null = null
    let totalTokens = 0
    let peakDay = ''
    let peakCost = 0
    const modelTotals = new Map<string, { tokens: number; cost: number | null }>()

    for (const day of data) {
      totalTokens += day.inputTokens + day.outputTokens
      if (day.costUSD !== null) {
        totalCost = (totalCost ?? 0) + day.costUSD
        if (day.costUSD > peakCost) {
          peakCost = day.costUSD
          peakDay = day.date
        }
      }
      for (const [model, mb] of Object.entries(day.byModel)) {
        const existing = modelTotals.get(model) ?? { tokens: 0, cost: null }
        existing.tokens += mb.inputTokens + mb.outputTokens
        if (mb.costUSD !== null) existing.cost = (existing.cost ?? 0) + mb.costUSD
        modelTotals.set(model, existing)
      }
    }

    // Top model by tokens
    let topModel = ''
    let topModelTokens = 0
    for (const [model, m] of modelTotals) {
      if (m.tokens > topModelTokens) { topModel = model; topModelTokens = m.tokens }
    }

    return { totalCost, totalTokens, peakDay, peakCost, topModel }
  }, [data])

  const chartData = useMemo(() =>
    data.map(d => ({
      ...d,
      label: shortenDate(d.date),
    })),
  [data])

  const hasData = data.some(d => d.inputTokens > 0 || d.outputTokens > 0)

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
        <BarChart className="w-12 h-12 text-zinc-400" />
        <p className="text-sm text-zinc-500">No usage data in the last 30 days</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="w-4 h-4 text-emerald-500" />}
          label="Total Cost (30d)"
          value={formatCostUSD(stats.totalCost)}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          icon={<Zap className="w-4 h-4 text-blue-500" />}
          label="Total Tokens"
          value={formatTokensShort(stats.totalTokens)}
          accent="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-orange-500" />}
          label="Peak Day"
          value={stats.peakDay ? `${shortenDate(stats.peakDay)} (${formatCostUSD(stats.peakCost)})` : '—'}
          accent="text-orange-600 dark:text-orange-400"
        />
        <StatCard
          icon={<Zap className="w-4 h-4 text-violet-500" />}
          label="Top Model"
          value={stats.topModel ? shortenModel(stats.topModel) : '—'}
          accent="text-violet-600 dark:text-violet-400"
        />
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 p-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatTokensShort}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value: string) => <span className="text-zinc-600 dark:text-zinc-400">{value}</span>}
            />
            <Bar dataKey="inputTokens" name="Input Tokens" fill="#8b5cf6" radius={[2, 2, 0, 0]} stackId="tokens" fillOpacity={0.85} />
            <Bar dataKey="outputTokens" name="Output Tokens" fill="#3b82f6" radius={[2, 2, 0, 0]} stackId="tokens" fillOpacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-zinc-400">{label}</span>
      </div>
      <p className={cn('text-sm font-semibold font-mono', accent)}>{value}</p>
    </div>
  )
}

function shortenModel(model: string): string {
  if (model.includes('claude')) {
    const m = model.replace('claude-', '').replace(/-/g, ' ')
    return m.replace(/\b\w/g, c => c.toUpperCase())
  }
  return model
}
