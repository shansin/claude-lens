import { useState, useEffect } from 'react'
import { Copy, Trash2, ChevronDown, Users } from 'lucide-react'
import { cn } from '../lib/utils'

interface TeamTemplate {
  name: string
  description: string
  memberCount: number
  createdAt: number
}

interface Props {
  teams: Array<{ teamName: string }>
  onToast: (msg: string) => void
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function TeamTemplatesPanel({ teams, onToast }: Props) {
  const [templates, setTemplates]       = useState<TeamTemplate[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving]             = useState(false)
  const [deletingName, setDeletingName] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await window.electronAPI.getTeamTemplates()
      setTemplates(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    if (teams.length > 0) setSelectedTeam(teams[0].teamName)
  }, [teams])

  async function handleSave() {
    if (!selectedTeam || !templateName.trim()) return
    setSaving(true)
    try {
      const res = await window.electronAPI.saveTeamTemplate(templateName.trim(), selectedTeam)
      if (res.ok) {
        onToast(`Template "${templateName.trim()}" saved`)
        setTemplateName('')
        await load()
      } else {
        onToast(`Error: ${res.error ?? 'Failed to save'}`)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(name: string) {
    setDeletingName(name)
    try {
      const res = await window.electronAPI.deleteTeamTemplate(name)
      if (res.ok) {
        onToast(`Template "${name}" deleted`)
        await load()
      } else {
        onToast(`Error: ${res.error ?? 'Failed to delete'}`)
      }
    } finally {
      setDeletingName(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Save section */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-3">
          <Copy className="w-4 h-4 text-indigo-500" />
          Save Team as Template
        </h3>
        <div className="space-y-2">
          {teams.length === 0 ? (
            <p className="text-xs text-zinc-400">No active teams to save as template</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedTeam}
                    onChange={e => setSelectedTeam(e.target.value)}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    {teams.map(t => (
                      <option key={t.teamName} value={t.teamName}>{t.teamName}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="Template name…"
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  onClick={handleSave}
                  disabled={!selectedTeam || !templateName.trim() || saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Templates list */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-3">
          <Users className="w-4 h-4 text-indigo-500" />
          Saved Templates
        </h3>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            Loading…
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-zinc-400 ml-6">No team templates yet</p>
        ) : (
          <div className="space-y-2">
            {templates.map(tpl => (
              <div
                key={tpl.name}
                className="flex items-start gap-3 px-3 py-3 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] group"
              >
                <Users className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{tpl.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400">
                      {tpl.memberCount} member{tpl.memberCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-zinc-400">{formatDate(tpl.createdAt)}</span>
                  </div>
                  {tpl.description && (
                    <p className="text-xs text-zinc-400 truncate">{tpl.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(tpl.name)}
                  disabled={deletingName === tpl.name}
                  className={cn(
                    'p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 disabled:opacity-50 transition-all'
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
