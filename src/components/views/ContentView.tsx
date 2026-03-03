import { useState, useEffect, useCallback } from 'react'
import { cn } from '../../lib/utils'
import { PlansViewer } from '../PlansViewer'
import { TodosViewer } from '../TodosViewer'
import { MemoryBrowser } from '../MemoryBrowser'
import { CleanupTool } from '../CleanupTool'
import { BookOpen, CheckSquare, Brain, Trash2, Download } from 'lucide-react'

type Tab = 'plans' | 'todos' | 'memory' | 'cleanup' | 'export'

const TABS: { key: Tab; label: string; icon: typeof BookOpen }[] = [
  { key: 'plans',   label: 'Plans',   icon: BookOpen },
  { key: 'todos',   label: 'Todos',   icon: CheckSquare },
  { key: 'memory',  label: 'Memory',  icon: Brain },
  { key: 'cleanup', label: 'Cleanup', icon: Trash2 },
  { key: 'export',  label: 'Export',  icon: Download },
]

interface PlanFile { name: string; path: string; content: string; modifiedAt: number }
interface TodoFile { filename: string; agentId: string; tasks: any[] }
interface MemoryFile { cwd: string; projectName: string; filePath: string; filename: string; content: string; sizeBytes: number; modifiedAt: number }
interface ProjectSize { projectKey: string; cwd?: string; displayName: string; fileCount: number; sizeBytes: number; lastActivity: number; oldestActivity: number }

export function ContentView() {
  const [tab, setTab] = useState<Tab>('plans')
  const [plans, setPlans]           = useState<PlanFile[]>([])
  const [todos, setTodos]           = useState<TodoFile[]>([])
  const [memFiles, setMemFiles]     = useState<MemoryFile[]>([])
  const [projSizes, setProjSizes]   = useState<ProjectSize[]>([])
  const [loading, setLoading]       = useState(false)
  const [exporting, setExporting]   = useState(false)
  const [exportResult, setExportResult] = useState<{ ok: boolean; path?: string; rowCount?: number; error?: string } | null>(null)

  const loadTab = useCallback(async (t: Tab) => {
    setLoading(true)
    try {
      switch (t) {
        case 'plans':
          setPlans(await window.electronAPI.getPlans())
          break
        case 'todos':
          setTodos(await window.electronAPI.getTodos())
          break
        case 'memory':
          setMemFiles(await window.electronAPI.getMemoryFiles())
          break
        case 'cleanup':
          setProjSizes(await window.electronAPI.getProjectSizes())
          break
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTab(tab)
  }, [tab, loadTab])

  const handleExport = async () => {
    setExporting(true)
    setExportResult(null)
    try {
      const result = await window.electronAPI.exportCsv()
      setExportResult(result)
    } finally {
      setExporting(false)
    }
  }

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
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                tab === t.key
                  ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full gap-3 text-zinc-400">
            <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <>
            {tab === 'plans'   && <PlansViewer plans={plans} />}
            {tab === 'todos'   && <TodosViewer todos={todos} />}
            {tab === 'memory'  && <MemoryBrowser files={memFiles} />}
            {tab === 'cleanup' && <CleanupTool projects={projSizes} onDeleted={() => loadTab('cleanup')} />}
            {tab === 'export'  && (
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <div className="text-center">
                  <Download className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Export Usage Data</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md">
                    Export all session usage data as a CSV file with columns for date, project, session, team, model, tokens, and cost.
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
                    'bg-violet-600 hover:bg-violet-700 text-white shadow-sm',
                    exporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Download className="w-4 h-4" />
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </button>
                {exportResult && (
                  <div className={cn(
                    'px-4 py-3 rounded-xl text-sm max-w-md text-center',
                    exportResult.ok
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20'
                      : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20'
                  )}>
                    {exportResult.ok
                      ? `Exported ${exportResult.rowCount} rows to ${exportResult.path}`
                      : exportResult.error ?? 'Export cancelled'}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
