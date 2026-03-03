import { useState, useEffect } from 'react'
import { User2, Save, Download, Trash2 } from 'lucide-react'
import { cn } from '../lib/utils'

interface SettingsProfile {
  name: string
  createdAt: number
  preview: string
}

interface Props {
  onToast: (msg: string) => void
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function SettingsProfiles({ onToast }: Props) {
  const [profiles, setProfiles]     = useState<SettingsProfile[]>([])
  const [loading, setLoading]       = useState(true)
  const [saveName, setSaveName]     = useState('')
  const [saving, setSaving]         = useState(false)
  const [loadingName, setLoadingName] = useState<string | null>(null)
  const [deletingName, setDeletingName] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await window.electronAPI.getSettingsProfiles()
      setProfiles(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      const res = await window.electronAPI.saveSettingsProfile(saveName.trim())
      if (res.ok) {
        onToast(`Profile "${saveName.trim()}" saved`)
        setSaveName('')
        await load()
      } else {
        onToast(`Error: ${res.error ?? 'Failed to save'}`)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleLoad(name: string) {
    setLoadingName(name)
    try {
      const res = await window.electronAPI.loadSettingsProfile(name)
      if (res.ok) onToast(`Profile "${name}" loaded`)
      else onToast(`Error: ${res.error ?? 'Failed to load'}`)
    } finally {
      setLoadingName(null)
    }
  }

  async function handleDelete(name: string) {
    setDeletingName(name)
    try {
      const res = await window.electronAPI.deleteSettingsProfile(name)
      if (res.ok) {
        onToast(`Profile "${name}" deleted`)
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
          <Save className="w-4 h-4 text-indigo-500" />
          Save Current Settings as Profile
        </h3>
        <div className="flex items-center gap-2">
          <input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Profile name…"
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            onClick={handleSave}
            disabled={!saveName.trim() || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {/* Profiles list */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-3">
          <User2 className="w-4 h-4 text-indigo-500" />
          Saved Profiles
        </h3>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            Loading…
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-zinc-400 ml-6">No saved profiles yet</p>
        ) : (
          <div className="space-y-2">
            {profiles.map(profile => (
              <div
                key={profile.name}
                className="flex items-start gap-3 px-3 py-3 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] group"
              >
                <User2 className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{profile.name}</span>
                    <span className="text-xs text-zinc-400">{formatDate(profile.createdAt)}</span>
                  </div>
                  {profile.preview && (
                    <p className="text-xs text-zinc-400 truncate">{profile.preview}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleLoad(profile.name)}
                    disabled={loadingName === profile.name}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20 disabled:opacity-50 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    {loadingName === profile.name ? 'Loading…' : 'Load'}
                  </button>
                  <button
                    onClick={() => handleDelete(profile.name)}
                    disabled={deletingName === profile.name}
                    className={cn(
                      'p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 disabled:opacity-50 transition-all'
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
