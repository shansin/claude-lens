import { useState, useEffect, useCallback, useRef } from 'react'
import { BarChart2, Activity, Calendar, Layers, Database, AlertCircle, RefreshCw, DollarSign } from 'lucide-react'
import { cn } from '../../lib/utils'
import { UsageChart } from '../UsageChart'
import { ActivityFeed } from '../ActivityFeed'
import { ActivityHeatmap } from '../ActivityHeatmap'
import { ModelComparison } from '../ModelComparison'
import { formatCost, formatTokens } from '../../lib/costs'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { DayUsage, ActivityEntry, CacheStats, ProjectData } from '../../types'

type Tab = 'overview' | 'heatmap' | 'models' | 'cache' | 'activity'

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: 'Overview',      icon: BarChart2 },
  { key: 'heatmap',  label: 'Heatmap',       icon: Calendar },
  { key: 'models',   label: 'Models',        icon: Layers },
  { key: 'cache',    label: 'Cache',         icon: Database },
  { key: 'activity', label: 'Activity Feed', icon: Activity },
]

const RANGE_OPTIONS = [
  { days: 7,  label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
]

interface Props {
  projects?: ProjectData[]
}

// ── Cache tab ─────────────────────────────────────────────────────

function shortenDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CacheTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-zinc-700 dark:text-zinc-200 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {formatTokens(Math.round(p.value))}</p>
      ))}
    </div>
  )
}

function CacheView({ stats }: { stats: CacheStats }) {
  const hitRatePct = Math.round(stats.hitRate * 100)
  const chartData = stats.days
    .filter(d => d.cacheCreationTokens > 0 || d.cacheReadTokens > 0)
    .map(d => ({ ...d, label: shortenDate(d.date) }))

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Cache Hit Rate</p>
          <p className={cn(
            'text-lg font-bold font-mono',
            hitRatePct >= 60 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-200'
          )}>{hitRatePct}%</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Total Saved</p>
          <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatCost(stats.totalSavedUSD)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Cache Reads</p>
          <p className="text-sm font-semibold font-mono text-blue-600 dark:text-blue-400">
            {formatTokens(stats.totalCacheReadTokens)}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">{formatCost(stats.totalCacheReadCostUSD)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Cache Writes</p>
          <p className="text-sm font-semibold font-mono text-violet-600 dark:text-violet-400">
            {formatTokens(stats.totalCacheCreationTokens)}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">{formatCost(stats.totalCacheCreationCostUSD)}</p>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
          <Database className="w-12 h-12 text-zinc-400" />
          <p className="text-sm text-zinc-500">No cache activity in the last 90 days</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 p-4">
          <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-4">Cache Tokens by Day</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="cacheCreate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cacheRead" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={formatTokens} width={50} />
              <Tooltip content={<CacheTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => <span className="text-zinc-600 dark:text-zinc-400">{v}</span>} />
              <Area type="monotone" dataKey="cacheCreationTokens" name="Cache Writes" stroke="#8b5cf6" fill="url(#cacheCreate)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="cacheReadTokens"     name="Cache Reads"  stroke="#3b82f6" fill="url(#cacheRead)"   strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Top projects section ───────────────────────────────────────────

function TopProjects({ projects }: { projects: ProjectData[] }) {
  const top = [...projects]
    .filter(p => p.costUSD !== null && p.costUSD > 0)
    .sort((a, b) => (b.costUSD ?? 0) - (a.costUSD ?? 0))
    .slice(0, 5)

  if (top.length === 0) return null

  const maxCost = top[0]?.costUSD ?? 1

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Top Projects by Cost</h3>
      </div>
      <div className="space-y-2.5">
        {top.map(proj => (
          <div key={proj.projectKey} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span data-sensitive className="text-zinc-700 dark:text-zinc-300 truncate max-w-xs font-medium">{proj.displayName}</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 ml-4 shrink-0">{formatCost(proj.costUSD)}</span>
            </div>
            <div className="h-1.5 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                style={{ width: `${((proj.costUSD ?? 0) / maxCost) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Error state ────────────────────────────────────────────────────

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-sm text-zinc-500">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                   bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400
                   hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────

export function AnalyticsView({ projects }: Props) {
  const [tab, setTab]             = useState<Tab>('overview')
  const [overviewDays, setOverviewDays] = useState(30)
  const [usageData,    setUsageData]    = useState<DayUsage[]>([])
  const [activityData, setActivityData] = useState<ActivityEntry[]>([])
  const [heatmapData,  setHeatmapData]  = useState<DayUsage[]>([])
  const [cacheStats,   setCacheStats]   = useState<CacheStats | null>(null)

  const [loadingTabs, setLoadingTabs] = useState<Set<Tab>>(new Set())
  const [tabErrors,   setTabErrors]   = useState<Partial<Record<Tab, string>>>({})

  // Use a ref for the loaded-tab cache to avoid stale-closure / infinite-loop issues
  const loadedRef   = useRef<Set<string>>(new Set())
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const markLoading  = (t: Tab) => setLoadingTabs(prev => new Set([...prev, t]))
  const clearLoading = (t: Tab) => setLoadingTabs(prev => { const n = new Set(prev); n.delete(t); return n })

  const loadTab = useCallback(async (t: Tab, force = false) => {
    // Build a cache key that includes overviewDays for the overview tab
    const cacheKey = t === 'overview' ? `${t}-${overviewDays}` : t
    if (!force && loadedRef.current.has(cacheKey)) return

    markLoading(t)
    setTabErrors(prev => ({ ...prev, [t]: undefined }))
    try {
      if (t === 'overview') {
        const data = await window.electronAPI.getUsageExtended(overviewDays)
        setUsageData(data ?? [])
      } else if (t === 'heatmap') {
        const data = await window.electronAPI.getUsageExtended(365)
        setHeatmapData(data ?? [])
      } else if (t === 'cache') {
        const data = await window.electronAPI.getCacheStats(90)
        setCacheStats(data)
      } else if (t === 'activity') {
        const data = await window.electronAPI.getActivityFeed(200)
        setActivityData(data ?? [])
      }
      loadedRef.current.add(cacheKey)
    } catch (e) {
      console.error(`AnalyticsView: failed to load tab "${t}"`, e)
      setTabErrors(prev => ({ ...prev, [t]: 'Failed to load data.' }))
    } finally {
      clearLoading(t)
    }
  }, [overviewDays])

  // When overviewDays changes, invalidate the overview cache key so it reloads
  useEffect(() => {
    loadedRef.current.delete(`overview-${overviewDays}`)
    // Delete all overview-* keys to ensure stale ranges are evicted
    for (const key of loadedRef.current) {
      if (key.startsWith('overview-')) loadedRef.current.delete(key)
    }
  }, [overviewDays])

  // Load current tab when it changes or when overviewDays changes for overview
  useEffect(() => {
    loadTab(tab)
  }, [tab, overviewDays, loadTab])

  // Auto-refresh every 30s, paused when tab is hidden
  useEffect(() => {
    const start = () => {
      intervalRef.current = setInterval(() => {
        if (!document.hidden) loadTab(tab, true)
      }, 30_000)
    }
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalRef.current)
      } else {
        start()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    start()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(intervalRef.current)
    }
  }, [tab, loadTab])

  const isLoading = (t: Tab) => loadingTabs.has(t)

  const Spinner = () => (
    <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
      <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-200 dark:border-white/[0.06]
                      bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  tab === t.key
                    ? 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {isLoading(t.key) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                )}
              </button>
            )
          })}
        </div>

        {/* Date range picker for overview */}
        {tab === 'overview' && (
          <div className="ml-auto flex items-center gap-0.5 bg-zinc-100 dark:bg-white/[0.06] rounded-lg p-0.5 border border-zinc-200 dark:border-white/10">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setOverviewDays(opt.days)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                  overviewDays === opt.days
                    ? 'bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && (
          <div className="p-6 space-y-6">
            {tabErrors.overview ? (
              <TabError message={tabErrors.overview} onRetry={() => loadTab('overview', true)} />
            ) : isLoading('overview') ? (
              <Spinner />
            ) : (
              <>
                <UsageChart data={usageData} />
                {projects && projects.length > 0 && <TopProjects projects={projects} />}
              </>
            )}
          </div>
        )}

        {tab === 'heatmap' && (
          <div className="p-6">
            {tabErrors.heatmap ? (
              <TabError message={tabErrors.heatmap} onRetry={() => loadTab('heatmap', true)} />
            ) : isLoading('heatmap') ? (
              <Spinner />
            ) : (
              <ActivityHeatmap data={heatmapData} />
            )}
          </div>
        )}

        {tab === 'models' && (
          <div className="p-6">
            {tabErrors.models ? (
              <TabError message={tabErrors.models} onRetry={() => loadTab('models', true)} />
            ) : (
              <ModelComparison />
            )}
          </div>
        )}

        {tab === 'cache' && (
          <div className="p-6">
            {tabErrors.cache ? (
              <TabError message={tabErrors.cache} onRetry={() => loadTab('cache', true)} />
            ) : isLoading('cache') ? (
              <Spinner />
            ) : cacheStats ? (
              <CacheView stats={cacheStats} />
            ) : null}
          </div>
        )}

        {tab === 'activity' && (
          <ActivityFeed entries={activityData} loading={isLoading('activity')} />
        )}
      </div>
    </div>
  )
}
