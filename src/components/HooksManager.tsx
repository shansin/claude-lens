import { useState } from 'react'
import { Plus, Trash2, Code, ChevronDown, Play, X } from 'lucide-react'
import { cn } from '../lib/utils'

interface HookEntry {
  type: string
  command: string
  matcher?: string
}

interface TestState {
  running: boolean
  output?: string
  exitCode?: number
  error?: string
}

interface Props {
  hooks: Record<string, HookEntry[]>
  onUpdate: () => void
}

const HOOK_EVENTS = ['Stop', 'Notification', 'PreToolUse', 'PostToolUse'] as const

export function HooksManager({ hooks, onUpdate }: Props) {
  const [showForm, setShowForm]     = useState(false)
  const [formEvent, setFormEvent]   = useState<string>(HOOK_EVENTS[0])
  const [formCommand, setFormCommand] = useState('')
  const [formMatcher, setFormMatcher] = useState('')
  const [feedback, setFeedback]     = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  // Map key: `${event}-${index}` → test state
  const [testStates, setTestStates] = useState<Record<string, TestState>>({})

  function flash(type: 'ok' | 'err', msg: string) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 2500)
  }

  async function handleAdd() {
    if (!formCommand.trim()) return
    const hook: HookEntry = { type: 'command', command: formCommand.trim() }
    if (formMatcher.trim()) hook.matcher = formMatcher.trim()
    const res = await window.electronAPI.addHook(formEvent, hook)
    if (res.ok) {
      setFormCommand('')
      setFormMatcher('')
      setShowForm(false)
      flash('ok', `Hook added to ${formEvent}`)
      onUpdate()
    } else flash('err', res.error ?? 'Failed')
  }

  async function handleDelete(event: string, index: number) {
    const res = await window.electronAPI.deleteHook(event, index)
    if (res.ok) { flash('ok', 'Hook removed'); onUpdate() }
    else flash('err', res.error ?? 'Failed')
  }

  function testKey(event: string, index: number) { return `${event}-${index}` }

  async function handleTest(event: string, index: number, command: string) {
    const key = testKey(event, index)
    setTestStates(prev => ({ ...prev, [key]: { running: true } }))
    try {
      const res = await window.electronAPI.testHook(command, '{}')
      setTestStates(prev => ({
        ...prev,
        [key]: {
          running: false,
          output: res.output,
          exitCode: res.exitCode,
          error: res.error,
        },
      }))
    } catch (err) {
      setTestStates(prev => ({
        ...prev,
        [key]: { running: false, error: String(err), exitCode: -1, output: '' },
      }))
    }
  }

  function closeTest(event: string, index: number) {
    const key = testKey(event, index)
    setTestStates(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const allEvents = [...new Set([...HOOK_EVENTS, ...Object.keys(hooks)])]

  return (
    <div className="space-y-6">
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

      {/* Hook groups */}
      {allEvents.map(event => {
        const entries = hooks[event] ?? []
        return (
          <section key={event}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
              <Code className="w-4 h-4 text-indigo-500" />
              {event}
              {entries.length > 0 && (
                <span className="text-xs font-normal text-zinc-400">({entries.length})</span>
              )}
            </h3>
            {entries.length === 0 ? (
              <p className="text-xs text-zinc-400 ml-6">No hooks configured</p>
            ) : (
              <div className="space-y-1.5 ml-6">
                {entries.map((hook, i) => {
                  const key = testKey(event, i)
                  const ts  = testStates[key]
                  return (
                    <div key={i} className="space-y-1">
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/10
                                   bg-zinc-50 dark:bg-white/[0.03] group"
                      >
                        <code className="flex-1 text-sm font-mono text-zinc-700 dark:text-zinc-300 truncate">
                          {hook.command}
                        </code>
                        {hook.matcher && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shrink-0">
                            {hook.matcher}
                          </span>
                        )}
                        <button
                          onClick={() => ts ? closeTest(event, i) : handleTest(event, i, hook.command)}
                          title={ts ? 'Close test' : 'Test hook'}
                          className={cn(
                            'p-1 rounded transition-colors shrink-0',
                            ts
                              ? 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10'
                              : 'text-zinc-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-500 opacity-0 group-hover:opacity-100'
                          )}
                        >
                          {ts ? <X className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDelete(event, i)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Inline test panel */}
                      {ts && (
                        <div className="ml-2 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">Testing:</span>
                            <code className="text-xs font-mono text-zinc-600 dark:text-zinc-300 truncate">{hook.command}</code>
                            {ts.running && (
                              <div className="ml-auto w-3 h-3 border border-zinc-300 dark:border-zinc-600 border-t-emerald-500 rounded-full animate-spin" />
                            )}
                            {!ts.running && ts.exitCode !== undefined && (
                              <span className={cn(
                                'ml-auto text-xs px-1.5 py-0.5 rounded font-mono font-medium',
                                ts.exitCode === 0
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                              )}>
                                exit {ts.exitCode}
                              </span>
                            )}
                          </div>
                          {!ts.running && (ts.output || ts.error) && (
                            <pre className={cn(
                              'text-xs font-mono whitespace-pre-wrap rounded p-2 max-h-32 overflow-y-auto',
                              ts.exitCode === 0
                                ? 'bg-zinc-50 dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-300'
                                : 'bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400'
                            )}>
                              {ts.error ?? ts.output}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

      {/* Add form */}
      {showForm ? (
        <div className="border border-zinc-200 dark:border-white/10 rounded-lg p-4 space-y-3 bg-zinc-50 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 shrink-0">Event</label>
            <div className="relative">
              <select
                value={formEvent}
                onChange={e => setFormEvent(e.target.value)}
                className="appearance-none px-3 py-1.5 pr-8 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                {HOOK_EVENTS.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">Command</label>
            <textarea
              value={formCommand}
              onChange={e => setFormCommand(e.target.value)}
              placeholder="e.g. notify-send 'Claude stopped'"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
              Matcher <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <input
              value={formMatcher}
              onChange={e => setFormMatcher(e.target.value)}
              placeholder="e.g. Bash"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!formCommand.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add Hook
            </button>
            <button
              onClick={() => { setShowForm(false); setFormCommand(''); setFormMatcher('') }}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Hook
        </button>
      )}
    </div>
  )
}
