import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Layers } from 'lucide-react'

interface ModelStats {
  model: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheTokens: number
  costUSD: number | null
  messageCount: number
  projectCount: number
}

function stripClaude(model: string): string {
  return model.replace(/^claude-/, '')
}

function formatCost(usd: number | null): string {
  if (usd === null) return '—'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as ModelStats & { shortName: string } | undefined
  if (!d) return null
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{d.model}</p>
      {d.costUSD !== null
        ? <p className="text-emerald-600 dark:text-emerald-400">Cost: {formatCost(d.costUSD)}</p>
        : <p className="text-zinc-500">Cost: not available</p>
      }
      <p>Input: {formatTokens(d.totalInputTokens)}</p>
      <p>Output: {formatTokens(d.totalOutputTokens)}</p>
      {d.totalCacheTokens > 0 && <p>Cache: {formatTokens(d.totalCacheTokens)}</p>}
      <p>Messages: {d.messageCount.toLocaleString()}</p>
    </div>
  )
}

export function ModelComparison() {
  const [data, setData] = useState<ModelStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
      ; (window as any).electronAPI.getModelComparison()
        .then((d: ModelStats[]) => setData(d ?? []))
        .catch(console.error)
        .finally(() => setLoading(false))
  }, [])

  const chartData = useMemo(() =>
    data.map(m => ({ ...m, shortName: stripClaude(m.model) })),
    [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm">Loading model data…</span>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
        <Layers className="w-10 h-10 text-zinc-400" />
        <p className="text-sm text-zinc-500">No model data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Bar chart */}
      <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 p-4">
        <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-4">Cost by Model (USD)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 30 }}>
            <defs>
              <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
            <XAxis
              dataKey="shortName"
              tick={{ fontSize: 10, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={false}
              angle={-25}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v === 0 ? '0' : `$${v.toFixed(2)}`}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="costUSD"
              name="Cost"
              fill="url(#violetGrad)"
              radius={[4, 4, 0, 0]}
              label={(props: any) => {
                const { x, y, width, value, index } = props
                if (value !== null) return null
                // Show token count if no cost
                const tokens = (chartData[index]?.totalInputTokens ?? 0) + (chartData[index]?.totalOutputTokens ?? 0)
                return (
                  <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#a1a1aa">
                    {formatTokens(tokens)}
                  </text>
                )
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02]">
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Model</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Messages</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Input Tokens</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Output Tokens</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Cache Tokens</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Total Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
            {data.map(m => (
              <tr key={m.model} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5 font-mono text-zinc-700 dark:text-zinc-300">{m.model}</td>
                <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-400">{m.messageCount.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-400">{formatTokens(m.totalInputTokens)}</td>
                <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-400">{formatTokens(m.totalOutputTokens)}</td>
                <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-400">{formatTokens(m.totalCacheTokens)}</td>
                <td className="px-4 py-2.5 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">{formatCost(m.costUSD)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
