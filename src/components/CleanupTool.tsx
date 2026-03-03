import { useState } from 'react'
import { cn, formatRelativeTime } from '../lib/utils'
import { Trash2 } from 'lucide-react'

interface ProjectSize {
  projectKey: string
  cwd?: string
  displayName: string
  fileCount: number
  sizeBytes: number
  lastActivity: number
  oldestActivity: number
}

interface Props {
  projects: ProjectSize[]
  onDeleted: () => void
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

export function CleanupTool({ projects, onDeleted }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null)

  const totalSize = projects.reduce((s, p) => s + p.sizeBytes, 0)
  const totalFiles = projects.reduce((s, p) => s + p.fileCount, 0)

  const handleDelete = async (projectKey: string) => {
    setDeleting(projectKey)
    try {
      const result = await window.electronAPI.deleteProjectData(projectKey)
      if (result.ok) onDeleted()
    } finally {
      setDeleting(null)
    }
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
        <Trash2 className="w-12 h-12 text-zinc-400" />
        <p className="text-sm text-zinc-500">No project data found</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto p-6">
      {/* Summary */}
      <div className="flex items-center gap-6 mb-6 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06]">
        <div>
          <p className="text-xs text-zinc-400">Total space used</p>
          <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono">{formatBytes(totalSize)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Session files</p>
          <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono">{totalFiles}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Projects</p>
          <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono">{projects.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-white/[0.03] border-b border-zinc-200 dark:border-white/[0.06]">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Project</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Files</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Size</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Last active</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
            {projects.map(p => (
              <tr key={p.projectKey} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-700 dark:text-zinc-200 truncate max-w-[300px]">{p.displayName}</p>
                  {p.cwd && (
                    <p className="text-xs text-zinc-400 truncate max-w-[300px]" title={p.cwd}>{p.cwd}</p>
                  )}
                </td>
                <td className="text-right px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">{p.fileCount}</td>
                <td className="text-right px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">{formatBytes(p.sizeBytes)}</td>
                <td className="text-right px-4 py-3 text-zinc-500 dark:text-zinc-400">{formatRelativeTime(p.lastActivity)}</td>
                <td className="text-right px-4 py-3">
                  <button
                    onClick={() => handleDelete(p.projectKey)}
                    disabled={deleting === p.projectKey}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                      'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10',
                      'border border-red-200 dark:border-red-500/20',
                      deleting === p.projectKey && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Trash2 className="w-3 h-3" />
                    {deleting === p.projectKey ? 'Deleting…' : 'Delete'}
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
