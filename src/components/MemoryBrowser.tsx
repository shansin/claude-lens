import { useState, useMemo } from 'react'
import { cn } from '../lib/utils'
import { Brain, ChevronRight, ChevronDown, FileText, FolderOpen, Pencil, X, Save } from 'lucide-react'

interface MemoryFile {
  cwd: string
  projectName: string
  filePath: string
  filename: string
  content: string
  sizeBytes: number
  modifiedAt: number
}

interface Props {
  files: MemoryFile[]
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

export function MemoryBrowser({ files }: Props) {
  const [expanded, setExpanded]         = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<MemoryFile | null>(null)
  const [editMode, setEditMode]         = useState(false)
  const [editContent, setEditContent]   = useState('')
  const [saving, setSaving]             = useState(false)
  const [feedback, setFeedback]         = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, MemoryFile[]>()
    for (const f of files) {
      const key = f.cwd
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [files])

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function openFile(f: MemoryFile) {
    setSelectedFile(f)
    setEditMode(false)
  }

  function startEdit(f: MemoryFile) {
    setSelectedFile(f)
    setEditContent(f.content)
    setEditMode(true)
    setFeedback(null)
  }

  function cancelEdit() {
    setEditMode(false)
    setFeedback(null)
  }

  async function handleSave() {
    if (!selectedFile) return
    setSaving(true)
    try {
      const res = await window.electronAPI.saveFile(selectedFile.filePath, editContent)
      if (res.ok) {
        setFeedback({ type: 'ok', msg: 'File saved' })
        setEditMode(false)
        // Update local content so view shows the new text
        selectedFile.content = editContent
      } else {
        setFeedback({ type: 'err', msg: res.error ?? 'Failed to save' })
      }
    } finally {
      setSaving(false)
      if (feedback?.type === 'ok') setTimeout(() => setFeedback(null), 2500)
    }
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
        <Brain className="w-12 h-12 text-zinc-400" />
        <p className="text-sm text-zinc-500">No memory files found</p>
        <p className="text-xs text-zinc-400">Looks for CLAUDE.md and memory/*.md in project directories</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Tree */}
      <div className="w-72 shrink-0 border-r border-zinc-200 dark:border-white/[0.06] overflow-y-auto">
        {grouped.map(([cwd, groupFiles]) => {
          const isExpanded = expanded.has(cwd)
          const projectName = groupFiles[0]?.projectName ?? cwd
          return (
            <div key={cwd}>
              <button
                onClick={() => toggleExpand(cwd)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
              >
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                }
                <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{projectName}</span>
                <span className="ml-auto text-xs text-zinc-400">{groupFiles.length}</span>
              </button>
              {isExpanded && (
                <div className="ml-5">
                  {groupFiles.map(f => (
                    <button
                      key={f.filePath}
                      onClick={() => openFile(f)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
                        selectedFile?.filePath === f.filePath
                          ? 'bg-violet-50 dark:bg-violet-500/10'
                          : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                      )}
                    >
                      <FileText className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate">{f.filename}</span>
                      <span className="ml-auto text-xs text-zinc-400 font-mono">{formatBytes(f.sizeBytes)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedFile ? (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{selectedFile.filename}</h3>
              <span className="text-xs text-zinc-400 font-mono">{formatBytes(selectedFile.sizeBytes)}</span>
              <div className="ml-auto flex items-center gap-1">
                {!editMode && (
                  <button
                    onClick={() => startEdit(selectedFile)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-zinc-400 mb-4 truncate" title={selectedFile.filePath}>{selectedFile.filePath}</p>

            {/* Feedback */}
            {feedback && (
              <div className={cn(
                'mb-3 px-3 py-2 rounded-lg text-xs font-medium',
                feedback.type === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
              )}>
                {feedback.msg}
              </div>
            )}

            {editMode ? (
              /* Edit panel */
              <div className="flex flex-col flex-1 gap-3">
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="flex-1 min-h-0 px-4 py-3 text-sm font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Read-only view */
              <pre className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-50 dark:bg-white/[0.03] rounded-lg p-4 border border-zinc-200 dark:border-white/[0.06]">
                {selectedFile.content}
              </pre>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full opacity-40">
            <p className="text-sm text-zinc-500">Select a file to view its contents</p>
          </div>
        )}
      </div>
    </div>
  )
}
