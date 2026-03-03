import { useState, useEffect, useCallback } from 'react'
import { Settings, Code, Server, User2, Bell, Copy } from 'lucide-react'
import { cn } from '../../lib/utils'
import { SettingsGeneral } from '../SettingsGeneral'
import { HooksManager } from '../HooksManager'
import { McpServersPanel } from '../McpServersPanel'
import { SettingsProfiles } from '../SettingsProfiles'
import { NotificationSettings } from '../NotificationSettings'
import { TeamTemplatesPanel } from '../TeamTemplatesPanel'

type Tab = 'general' | 'hooks' | 'mcp' | 'profiles' | 'notifications' | 'templates'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'general',       label: 'General',       icon: Settings },
  { key: 'hooks',         label: 'Hooks',         icon: Code },
  { key: 'mcp',           label: 'MCP Servers',   icon: Server },
  { key: 'profiles',      label: 'Profiles',      icon: User2 },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'templates',     label: 'Templates',     icon: Copy },
]

interface Props {
  teams?: Array<{ teamName: string }>
}

export function SettingsView({ teams = [] }: Props) {
  const [tab, setTab] = useState<Tab>('general')
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    try {
      const data = await window.electronAPI.getSettings()
      setSettings(data)
      setError(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-zinc-400">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm">Loading settings…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-red-500">Failed to load settings: {error}</p>
        <button onClick={loadSettings} className="text-sm text-blue-500 hover:underline">Retry</button>
      </div>
    )
  }

  const hooks = (settings._hooks ?? {}) as Record<string, { type: string; command: string; matcher?: string }[]>
  const mcpServers = (settings.mcpServers ?? {}) as Record<string, { command: string; args?: string[]; env?: Record<string, string> }>

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
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                tab === t.key
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm border border-zinc-200 dark:border-white/10'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
        <span className="ml-auto text-xs text-zinc-400 font-mono">~/.claude/settings.json</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
        {tab === 'general' && (
          <SettingsGeneral settings={settings} onSaved={loadSettings} />
        )}
        {tab === 'hooks' && (
          <HooksManager hooks={hooks} onUpdate={loadSettings} />
        )}
        {tab === 'mcp' && (
          <McpServersPanel servers={mcpServers} onUpdate={loadSettings} />
        )}
        {tab === 'profiles' && (
          <SettingsProfiles onToast={(msg) => { console.log(msg) }} />
        )}
        {tab === 'notifications' && (
          <NotificationSettings onToast={(msg) => console.log(msg)} />
        )}
        {tab === 'templates' && (
          <TeamTemplatesPanel teams={teams} onToast={(msg) => console.log(msg)} />
        )}
      </div>
    </div>
  )
}
