import { useState, useEffect } from 'react'
import { Zap, RefreshCw } from 'lucide-react'
import { cn, formatRelativeTime } from '../lib/utils'

interface TelemetryEvent {
  eventName: string
  timestamp: string
  sessionId: string
  model: string
  version: string
  processStats?: { cpu?: number; memory?: number }
}

export function TelemetryPanel() {
  const [events, setEvents] = useState<TelemetryEvent[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const data = await (window as any).electronAPI.getTelemetryEvents()
      setEvents(data ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm">Loading telemetry…</span>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
        <Zap className="w-10 h-10 text-zinc-400" />
        <p className="text-sm text-zinc-500">No telemetry events found</p>
        <p className="text-xs text-zinc-400">Events appear in ~/.claude/telemetry/</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={refresh}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300
                     hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto max-h-[60vh] space-y-1.5 pr-1">
        {events.map((ev, i) => (
          <div
            key={`${ev.timestamp}-${i}`}
            className="flex items-start gap-3 px-3 py-2.5 rounded-lg
                       bg-white dark:bg-white/[0.02] border border-zinc-100 dark:border-white/[0.04]
                       hover:border-zinc-200 dark:hover:border-white/[0.08] transition-colors"
          >
            <div className="shrink-0 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {ev.eventName}
                </span>
                {ev.model && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-mono
                                   bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {ev.model}
                  </span>
                )}
                {ev.version && (
                  <span className="text-xs text-zinc-400 font-mono">v{ev.version}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                {ev.timestamp && (
                  <span>{formatRelativeTime(new Date(ev.timestamp).getTime())}</span>
                )}
                {ev.sessionId && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-600">·</span>
                    <span className="font-mono truncate max-w-[8rem]" title={ev.sessionId}>
                      {ev.sessionId.slice(0, 8)}
                    </span>
                  </>
                )}
                {ev.processStats && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-600">·</span>
                    {ev.processStats.cpu != null && (
                      <span className={cn(
                        'font-mono',
                        ev.processStats.cpu > 50 ? 'text-amber-500' : ''
                      )}>
                        CPU {ev.processStats.cpu.toFixed(1)}%
                      </span>
                    )}
                    {ev.processStats.memory != null && (
                      <span className="font-mono">
                        MEM {(ev.processStats.memory / (1024 * 1024)).toFixed(0)}MB
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
