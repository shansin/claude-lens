import { useState } from 'react'
import { Activity, Shield, Zap, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ProcessMonitor } from '../ProcessMonitor'
import { AuthStatus } from '../AuthStatus'
import { TelemetryPanel } from '../TelemetryPanel'

interface Props {
  onClose?: () => void
}

type Tab = 'processes' | 'auth' | 'telemetry'

const TABS: { key: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'processes', label: 'Processes', icon: Activity },
  { key: 'auth',      label: 'Auth',      icon: Shield },
  { key: 'telemetry', label: 'Telemetry', icon: Zap },
]

export function SystemView({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('processes')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-white/[0.06]
                      bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="w-4.5 h-4.5 text-violet-500" />
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">System</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab pills */}
          <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-white/[0.06] rounded-lg p-0.5
                          border border-zinc-200 dark:border-white/10">
            {TABS.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    activeTab === tab.key
                      ? 'bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300
                         hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'processes' && <ProcessMonitor />}
        {activeTab === 'auth' && <AuthStatus />}
        {activeTab === 'telemetry' && <TelemetryPanel />}
      </div>
    </div>
  )
}
