import { useState, useEffect, useRef } from 'react'
import { Bell, DollarSign } from 'lucide-react'
import { cn } from '../lib/utils'

interface NotificationPrefs {
  taskCompleted: boolean
  teamCreated: boolean
  costThreshold: boolean
  costThresholdAmount: number
}

interface BudgetConfig {
  enabled: boolean
  perTeamDailyLimit: number
  globalDailyLimit: number
  warningPercent: number
}

interface Props {
  onToast: (msg: string) => void
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/40',
        checked ? 'bg-violet-500' : 'bg-zinc-300 dark:bg-zinc-600'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  )
}

export function NotificationSettings({ onToast }: Props) {
  const [prefs, setPrefs]         = useState<NotificationPrefs | null>(null)
  const [budget, setBudget]       = useState<BudgetConfig | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    Promise.all([
      window.electronAPI.getNotificationPrefs(),
      window.electronAPI.getBudgetConfig(),
    ]).then(([p, b]) => {
      setPrefs(p)
      setBudget(b)
      setLoading(false)
    })
  }, [])

  function schedulePrefseSave(next: NotificationPrefs) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await window.electronAPI.saveNotificationPrefs(next)
        onToast('Notification preferences saved')
      } finally {
        setSaving(false)
      }
    }, 800)
  }

  function updatePrefs(patch: Partial<NotificationPrefs>) {
    setPrefs(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      schedulePrefseSave(next)
      return next
    })
  }

  async function saveBudget(next: BudgetConfig) {
    setSaving(true)
    try {
      await window.electronAPI.saveBudgetConfig(next)
      onToast('Budget config saved')
    } finally {
      setSaving(false)
    }
  }

  function updateBudget(patch: Partial<BudgetConfig>) {
    setBudget(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      saveBudget(next)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        Loading…
      </div>
    )
  }

  if (!prefs || !budget) return null

  return (
    <div className="space-y-8">
      {saving && (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <div className="w-3 h-3 border border-zinc-300 dark:border-zinc-600 border-t-blue-500 rounded-full animate-spin" />
          Saving…
        </div>
      )}

      {/* Desktop Notifications */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-4">
          <Bell className="w-4 h-4 text-indigo-500" />
          Desktop Notifications
        </h3>
        <div className="space-y-3 ml-6">
          {/* Task completed */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">Task completed</p>
              <p className="text-xs text-zinc-400">Notify when an agent task finishes</p>
            </div>
            <Toggle checked={prefs.taskCompleted} onChange={v => updatePrefs({ taskCompleted: v })} />
          </div>

          {/* Team created */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">Team created</p>
              <p className="text-xs text-zinc-400">Notify when a new team is spawned</p>
            </div>
            <Toggle checked={prefs.teamCreated} onChange={v => updatePrefs({ teamCreated: v })} />
          </div>

          {/* Cost threshold */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">Cost threshold reached</p>
              <p className="text-xs text-zinc-400">Notify when spend exceeds amount</p>
              {prefs.costThreshold && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-xs text-zinc-500">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={prefs.costThresholdAmount}
                    onChange={e => updatePrefs({ costThresholdAmount: parseFloat(e.target.value) || 0 })}
                    className="w-24 px-2 py-1 rounded border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              )}
            </div>
            <Toggle checked={prefs.costThreshold} onChange={v => updatePrefs({ costThreshold: v })} />
          </div>
        </div>
      </section>

      {/* Budget Limits */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-4">
          <DollarSign className="w-4 h-4 text-indigo-500" />
          Budget Limits
        </h3>
        <div className="space-y-3 ml-6">
          {/* Enable */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">Enable budget limits</p>
              <p className="text-xs text-zinc-400">Track and limit daily spending</p>
            </div>
            <Toggle checked={budget.enabled} onChange={v => updateBudget({ enabled: v })} />
          </div>

          {budget.enabled && (
            <>
              {/* Per-team daily limit */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-200">Per-team daily limit</p>
                  <p className="text-xs text-zinc-400">USD per team per day (0 = disabled)</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-zinc-500">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={budget.perTeamDailyLimit}
                    onChange={e => updateBudget({ perTeamDailyLimit: parseFloat(e.target.value) || 0 })}
                    className="w-24 px-2 py-1.5 rounded border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              {/* Global daily limit */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-200">Global daily limit</p>
                  <p className="text-xs text-zinc-400">Total USD across all teams per day (0 = disabled)</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-zinc-500">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={budget.globalDailyLimit}
                    onChange={e => updateBudget({ globalDailyLimit: parseFloat(e.target.value) || 0 })}
                    className="w-24 px-2 py-1.5 rounded border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              {/* Warning percent */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-200">Warn at % of limit</p>
                  <p className="text-xs text-zinc-400">Show warning when this threshold is reached</p>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={5}
                    value={budget.warningPercent}
                    onChange={e => updateBudget({ warningPercent: parseInt(e.target.value) || 80 })}
                    className="w-20 px-2 py-1.5 rounded border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <span className="text-sm text-zinc-500">%</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
