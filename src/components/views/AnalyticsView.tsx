import { useState, useEffect, useCallback } from 'react'
import { BarChart2, Activity, Calendar, Layers } from 'lucide-react'
import { cn } from '../../lib/utils'
import { UsageChart } from '../UsageChart'
import { ActivityFeed } from '../ActivityFeed'
import { ActivityHeatmap } from '../ActivityHeatmap'
import { ModelComparison } from '../ModelComparison'
import type { DayUsage } from '../UsageChart'
import type { ActivityEntry } from '../ActivityFeed'

type Tab = 'overview' | 'heatmap' | 'models' | 'activity'

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: 'Overview',      icon: BarChart2 },
  { key: 'heatmap',  label: 'Heatmap',       icon: Calendar },
  { key: 'models',   label: 'Models',        icon: Layers },
  { key: 'activity', label: 'Activity Feed', icon: Activity },
]

export function AnalyticsView() {
  const [tab, setTab] = useState<Tab>('overview')
  const [usageData, setUsageData] = useState<DayUsage[]>([])
  const [activityData, setActivityData] = useState<ActivityEntry[]>([])
  const [heatmapData, setHeatmapData] = useState<DayUsage[]>([])
  const [loadingUsage, setLoadingUsage] = useState(true)
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [loadingHeatmap, setLoadingHeatmap] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoadingUsage(true)
      setLoadingActivity(true)
      setLoadingHeatmap(true)
      setLoadingModels(true)
      const [usage, activity, heatmap] = await Promise.all([
        (window as any).electronAPI.getUsageByDay(),
        (window as any).electronAPI.getActivityFeed(200),
        (window as any).electronAPI.getUsageExtended(365),
      ])
      setUsageData(usage ?? [])
      setActivityData(activity ?? [])
      setHeatmapData(heatmap ?? [])
    } catch (e) {
      console.error('AnalyticsView load error:', e)
    } finally {
      setLoadingUsage(false)
      setLoadingActivity(false)
      setLoadingHeatmap(false)
      setLoadingModels(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-zinc-200 dark:border-white/[0.06]
                      bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm shrink-0">
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
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && (
          <div className="p-6">
            {loadingUsage ? (
              <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm">Loading usage data…</span>
              </div>
            ) : (
              <UsageChart data={usageData} />
            )}
          </div>
        )}
        {tab === 'heatmap' && (
          <div className="p-6">
            {loadingHeatmap ? (
              <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm">Loading heatmap data…</span>
              </div>
            ) : (
              <ActivityHeatmap data={heatmapData} />
            )}
          </div>
        )}
        {tab === 'models' && (
          <div className="p-6">
            {loadingModels ? (
              <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm">Loading model data…</span>
              </div>
            ) : (
              <ModelComparison />
            )}
          </div>
        )}
        {tab === 'activity' && (
          <ActivityFeed entries={activityData} loading={loadingActivity} />
        )}
      </div>
    </div>
  )
}
