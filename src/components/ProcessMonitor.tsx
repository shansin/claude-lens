import { useState, useEffect, useCallback, useRef } from 'react'
import { Cpu, RefreshCw, Skull, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'
import type { ProcessInfo } from '../types'

const HISTORY_LEN = 12 // 60s at 5s interval

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <span className="inline-block w-16" />
  const w = 64, h = 20
  const max = Math.max(...data, 1)
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - (v / max) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} className="opacity-70 inline-block align-middle">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ProcessMonitor() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  // pid → rolling CPU history
  const historyRef = useRef<Map<number, number[]>>(new Map())
  const [, forceUpdate] = useState(0)

  const updateHistory = useCallback((procs: ProcessInfo[]) => {
    const map    = historyRef.current
    const active = new Set(procs.map(p => p.pid))
    // Remove stale entries
    for (const pid of map.keys()) {
      if (!active.has(pid)) map.delete(pid)
    }
    // Append new readings
    for (const p of procs) {
      const hist = map.get(p.pid) ?? []
      hist.push(p.cpu)
      if (hist.length > HISTORY_LEN) hist.shift()
      map.set(p.pid, hist)
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const data = await window.electronAPI.getProcesses()
      const procs = data ?? []
      setProcesses(procs)
      updateHistory(procs)
      forceUpdate(n => n + 1)
      setError(null)
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }, [updateHistory])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const handleKill = async (pid: number) => {
    try {
      await window.electronAPI.killProcess(pid)
      setTimeout(refresh, 500)
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm">Scanning processes…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-zinc-500">Failed to read processes</p>
        <button
          onClick={refresh}
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

  if (processes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
        <Cpu className="w-10 h-10 text-zinc-400" />
        <p className="text-sm text-zinc-500">No Claude processes running</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </span>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {processes.length} process{processes.length !== 1 ? 'es' : ''}
          </span>
        </div>
        <button
          onClick={refresh}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300
                     hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-white/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-white/[0.03] border-b border-zinc-200 dark:border-white/[0.06]">
              <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">PID</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">CPU%</th>
              <th className="px-3 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400">CPU History</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">MEM%</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Time</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Command</th>
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {processes.map(p => {
              const hist  = historyRef.current.get(p.pid) ?? [p.cpu]
              const isHot = p.cpu > 50
              return (
                <tr
                  key={p.pid}
                  className="border-b last:border-b-0 border-zinc-100 dark:border-white/[0.04]
                             hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-200">{p.pid}</td>
                  <td className={cn(
                    'px-3 py-2 text-right font-mono',
                    isHot ? 'text-amber-500' : 'text-zinc-600 dark:text-zinc-300'
                  )}>
                    {p.cpu.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Sparkline data={hist} color={isHot ? '#f59e0b' : '#6366f1'} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-600 dark:text-zinc-300">
                    {p.mem.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                    {p.elapsed}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300 max-w-xs truncate font-mono text-xs">
                    {p.command}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleKill(p.pid)}
                      className="p-1 rounded text-red-400 hover:text-red-600 dark:hover:text-red-300
                                 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Kill process"
                    >
                      <Skull className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
