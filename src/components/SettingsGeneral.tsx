import { useState } from 'react'
import { Plus, Trash2, Zap, Globe, Terminal } from 'lucide-react'
import { cn } from '../lib/utils'

interface Props {
  settings: Record<string, unknown>
  onSaved: () => void
}

const EFFORT_LEVELS = ['low', 'medium', 'high'] as const
const PERMISSION_MODES = [
  { value: 'default', label: 'Default' },
  { value: 'bypassPermissions', label: 'Bypass Permissions' },
  { value: 'acceptEdits', label: 'Accept Edits' },
]

const inputClass = 'w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40'

export function SettingsGeneral({ settings, onSaved }: Props) {
  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvVal, setNewEnvVal] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const effortLevel = (settings.effortLevel as string) ?? 'high'
  const permissions = (settings.permissions as Record<string, string>)?.defaultMode ?? 'default'
  const envVars = (settings.env as Record<string, string>) ?? {}
  const statusLine = (settings.statusLine as Record<string, string>)?.command ?? ''

  function flash(type: 'ok' | 'err', msg: string) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 2500)
  }

  async function handleSetEffort(level: string) {
    const res = await window.electronAPI.setEffortLevel(level as 'low' | 'medium' | 'high')
    if (res.ok) { flash('ok', `Effort set to ${level}`); onSaved() }
    else flash('err', res.error ?? 'Failed')
  }

  async function handleSetPermissions(mode: string) {
    const res = await window.electronAPI.setPermissions(mode)
    if (res.ok) { flash('ok', `Permissions set to ${mode}`); onSaved() }
    else flash('err', res.error ?? 'Failed')
  }

  async function handleAddEnv() {
    if (!newEnvKey.trim()) return
    const res = await window.electronAPI.addEnvVar(newEnvKey.trim(), newEnvVal)
    if (res.ok) {
      setNewEnvKey('')
      setNewEnvVal('')
      flash('ok', `Added ${newEnvKey}`)
      onSaved()
    } else flash('err', res.error ?? 'Failed')
  }

  async function handleDeleteEnv(key: string) {
    const res = await window.electronAPI.deleteEnvVar(key)
    if (res.ok) { flash('ok', `Removed ${key}`); onSaved() }
    else flash('err', res.error ?? 'Failed')
  }

  async function handleStatusLine(cmd: string) {
    const s = { ...settings, statusLine: cmd ? { type: 'command', command: cmd } : undefined }
    const res = await window.electronAPI.saveSettings(s)
    if (res.ok) { flash('ok', 'Status line updated'); onSaved() }
    else if (!res.cancelled) flash('err', res.error ?? 'Failed')
  }

  const envEntries = Object.entries(envVars)

  return (
    <div className="space-y-8">
      {/* Feedback */}
      {feedback && (
        <div className={cn(
          'px-4 py-2 rounded-lg text-sm font-medium',
          feedback.type === 'ok'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
        )}>
          {feedback.msg}
        </div>
      )}

      {/* Effort Level */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-3">
          <Zap className="w-4 h-4 text-amber-500" />
          Effort Level
        </h3>
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/[0.06] rounded-lg p-1 border border-zinc-200 dark:border-white/10 w-fit">
          {EFFORT_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => handleSetEffort(level)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize',
                effortLevel === level
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </section>

      {/* Permissions */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-3">
          <Globe className="w-4 h-4 text-blue-500" />
          Default Permission Mode
        </h3>
        <select
          value={permissions}
          onChange={e => handleSetPermissions(e.target.value)}
          className={inputClass + ' max-w-xs'}
        >
          {PERMISSION_MODES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </section>

      {/* Environment Variables */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-3">
          <Terminal className="w-4 h-4 text-green-500" />
          Environment Variables
        </h3>
        <div className="border border-zinc-200 dark:border-white/10 rounded-lg overflow-hidden">
          {envEntries.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-white/[0.03] border-b border-zinc-200 dark:border-white/10">
                  <th className="text-left px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Key</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Value</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {envEntries.map(([k, v]) => (
                  <tr key={k} className="border-b border-zinc-100 dark:border-white/[0.04] last:border-0">
                    <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300">{k}</td>
                    <td className="px-3 py-2 font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">{v}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => handleDeleteEnv(k)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {envEntries.length === 0 && (
            <p className="px-3 py-4 text-sm text-zinc-400 text-center">No environment variables set</p>
          )}
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-white/[0.03] border-t border-zinc-200 dark:border-white/10">
            <input
              value={newEnvKey}
              onChange={e => setNewEnvKey(e.target.value)}
              placeholder="KEY"
              className="flex-1 px-2 py-1.5 rounded border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              value={newEnvVal}
              onChange={e => setNewEnvVal(e.target.value)}
              placeholder="value"
              className="flex-1 px-2 py-1.5 rounded border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <button
              onClick={handleAddEnv}
              disabled={!newEnvKey.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </div>
      </section>

      {/* Status Line */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-3">
          <Terminal className="w-4 h-4 text-purple-500" />
          Status Line Command
        </h3>
        <div className="flex items-center gap-2">
          <input
            defaultValue={statusLine}
            placeholder="e.g. echo 'my status'"
            onBlur={e => {
              if (e.target.value !== statusLine) handleStatusLine(e.target.value)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            className={inputClass + ' max-w-md font-mono'}
          />
        </div>
        <p className="mt-1.5 text-xs text-zinc-400">Shell command whose stdout is shown in the status line</p>
      </section>
    </div>
  )
}
