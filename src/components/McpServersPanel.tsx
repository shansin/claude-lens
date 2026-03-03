import { useState } from 'react'
import { Plus, Trash2, Server } from 'lucide-react'
import { cn } from '../lib/utils'

interface McpConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

interface Props {
  servers: Record<string, McpConfig>
  onUpdate: () => void
}

const inputClass = 'w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40'

export function McpServersPanel({ servers, onUpdate }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [argsStr, setArgsStr] = useState('')
  const [envStr, setEnvStr] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  function flash(type: 'ok' | 'err', msg: string) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 2500)
  }

  async function handleAdd() {
    if (!name.trim() || !command.trim()) return
    const args = argsStr.trim() ? argsStr.trim().split(/\s+/) : undefined
    let env: Record<string, string> | undefined
    if (envStr.trim()) {
      env = {}
      for (const line of envStr.trim().split('\n')) {
        const eqIdx = line.indexOf('=')
        if (eqIdx > 0) {
          env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim()
        }
      }
    }
    const config: McpConfig = { command: command.trim() }
    if (args) config.args = args
    if (env && Object.keys(env).length > 0) config.env = env
    const res = await window.electronAPI.addMcpServer(name.trim(), config)
    if (res.ok) {
      setName(''); setCommand(''); setArgsStr(''); setEnvStr('')
      setShowForm(false)
      flash('ok', `Added ${name.trim()}`)
      onUpdate()
    } else flash('err', res.error ?? 'Failed')
  }

  async function handleDelete(serverName: string) {
    const res = await window.electronAPI.deleteMcpServer(serverName)
    if (res.ok) { flash('ok', `Removed ${serverName}`); onUpdate() }
    else if (!res.cancelled) flash('err', res.error ?? 'Failed')
  }

  const entries = Object.entries(servers)

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

      {entries.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-40">
          <Server className="w-10 h-10 text-zinc-400" />
          <p className="text-sm text-zinc-500">No MCP servers configured</p>
        </div>
      )}

      {/* Server cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {entries.map(([srvName, cfg]) => (
          <div
            key={srvName}
            className="border border-zinc-200 dark:border-white/10 rounded-xl p-4 bg-white dark:bg-zinc-900/50 group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-teal-500 shrink-0" />
                <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{srvName}</span>
              </div>
              <button
                onClick={() => handleDelete(srvName)}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 shrink-0">command</span>
                <code className="font-mono text-zinc-600 dark:text-zinc-400 truncate">{cfg.command}</code>
              </div>
              {cfg.args && cfg.args.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 shrink-0">args</span>
                  <code className="font-mono text-zinc-600 dark:text-zinc-400 truncate">{cfg.args.join(' ')}</code>
                </div>
              )}
              {cfg.env && Object.keys(cfg.env).length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 shrink-0">env</span>
                  <span className="text-zinc-500 dark:text-zinc-500">{Object.keys(cfg.env).length} variable{Object.keys(cfg.env).length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm ? (
        <div className="border border-zinc-200 dark:border-white/10 rounded-lg p-4 space-y-3 bg-zinc-50 dark:bg-white/[0.03]">
          <div>
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">Server Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. my-mcp-server" className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">Command</label>
            <input value={command} onChange={e => setCommand(e.target.value)} placeholder="e.g. npx -y @my/mcp-server" className={cn(inputClass, 'font-mono')} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
              Args <span className="text-zinc-400 font-normal">(space-separated)</span>
            </label>
            <input value={argsStr} onChange={e => setArgsStr(e.target.value)} placeholder="--port 3000" className={cn(inputClass, 'font-mono')} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
              Env Vars <span className="text-zinc-400 font-normal">(KEY=value, one per line)</span>
            </label>
            <textarea
              value={envStr}
              onChange={e => setEnvStr(e.target.value)}
              placeholder={'API_KEY=xxx\nDEBUG=true'}
              rows={3}
              className={cn(inputClass, 'font-mono resize-none')}
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!name.trim() || !command.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add Server
            </button>
            <button
              onClick={() => { setShowForm(false); setName(''); setCommand(''); setArgsStr(''); setEnvStr('') }}
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
          Add Server
        </button>
      )}
    </div>
  )
}
