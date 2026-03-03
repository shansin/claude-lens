import { useState, useEffect, useCallback } from 'react'
import { Cpu, RefreshCw, Skull } from 'lucide-react'
import { cn } from '../lib/utils'

interface ProcessInfo {
  pid: number
  cpu: number
  mem: number
  command: string
  elapsed: string
}

export function ProcessMonitor() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await (window as any).electronAPI.getProcesses()
      setProcesses(data ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const handleKill = async (pid: number) => {
    try {
      await (window as any).electronAPI.killProcess(pid)
      // Refresh after a short delay
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
              <th className="px-3 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">MEM%</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Time</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Command</th>
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {processes.map(p => (
              <tr
                key={p.pid}
                className="border-b last:border-b-0 border-zinc-100 dark:border-white/[0.04]
                           hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-200">{p.pid}</td>
                <td className={cn(
                  'px-3 py-2 text-right font-mono',
                  p.cpu > 50 ? 'text-amber-500' : 'text-zinc-600 dark:text-zinc-300'
                )}>
                  {p.cpu.toFixed(1)}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
