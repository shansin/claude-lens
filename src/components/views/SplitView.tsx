import { useState } from 'react'
import { GraphView } from './GraphView'
import { AgentPill } from '../AgentPill'
import { TaskRow } from '../TaskRow'
import { TeamActionMenu } from '../TeamActionMenu'
import { CostPanel } from '../CostPanel'
import { formatRelativeTime, getTeamStats } from '../../lib/utils'
import type { TeamData, CostMap } from '../../types'
import { X, Users, CheckSquare, Clock, Hash } from 'lucide-react'

interface Props {
  teams: TeamData[]
  isDark: boolean
  costMap: CostMap
  onDelete:  (name: string) => void
  onArchive: (name: string) => void
  onClearTasks: (name: string) => void
  onOpenCwd: (cwd: string) => void
  onReveal:  (name: string) => void
  onCopy:    (text: string, label: string) => void
}

function DetailPanel({
  team, costMap, onClose,
  onDelete, onArchive, onClearTasks, onOpenCwd, onReveal, onCopy,
}: {
  team: TeamData
  costMap: CostMap
  onClose: () => void
  onDelete: (n: string) => void
  onArchive: (n: string) => void
  onClearTasks: (n: string) => void
  onOpenCwd: (cwd: string) => void
  onReveal: (n: string) => void
  onCopy: (text: string, label: string) => void
}) {
  const stats  = getTeamStats(team.tasks)
  const isLead = (id: string) => id === team.team.leadAgentId

  return (
    <div className="h-full flex flex-col border-l border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-100 dark:border-white/[0.06] shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-base text-zinc-900 dark:text-white truncate">{team.team.name}</h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{formatRelativeTime(team.team.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <TeamActionMenu
            team={team}
            onDelete={onDelete}
            onArchive={onArchive}
            onClearTasks={onClearTasks}
            onOpenCwd={onOpenCwd}
            onReveal={onReveal}
            onCopy={onCopy}
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Description */}
        {team.team.description && (
          <div className="px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06]">
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{team.team.description}</p>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-px bg-zinc-100 dark:bg-white/[0.06] border-b border-zinc-100 dark:border-white/[0.06]">
          {[
            { icon: Users,       val: team.team.members.length, label: 'Agents'  },
            { icon: CheckSquare, val: stats.completed,           label: 'Done'    },
            { icon: Clock,       val: stats.inProgress,          label: 'Active'  },
          ].map(({ icon: Icon, val, label }) => (
            <div key={label} className="flex flex-col items-center py-3 bg-white dark:bg-zinc-900">
              <Icon className="w-4 h-4 text-zinc-400 mb-1" />
              <span className="text-xl font-bold text-zinc-900 dark:text-white">{val}</span>
              <span className="text-xs text-zinc-400">{label}</span>
            </div>
          ))}
        </div>

        {/* Progress */}
        {stats.total > 0 && (
          <div className="px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06]">
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
              <span>Progress</span>
              <span className="font-mono text-violet-500 dark:text-violet-400">{stats.progress}%</span>
            </div>
            <div className="h-2 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-700"
                style={{ width: `${stats.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Agents */}
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/[0.06]">
          <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">Agents</p>
          <div className="flex flex-col gap-2">
            {team.team.members.map(m => (
              <AgentPill key={m.agentId} member={m} isLead={isLead(m.agentId)} />
            ))}
          </div>
        </div>

        {/* Cost */}
        <CostPanel costMap={costMap} teamName={team.team.name} />

        {/* Tasks */}
        {team.tasks.length > 0 && (
          <div className="px-3 py-3">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 px-2">
              Tasks ({team.tasks.length})
            </p>
            <div className="flex flex-col gap-0.5">
              {team.tasks.map(task => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function SplitView({ teams, isDark, costMap, onDelete, onArchive, onClearTasks, onOpenCwd, onReveal, onCopy }: Props) {
  const [selected, setSelected] = useState<TeamData | null>(null)

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0">
        <GraphView teams={teams} isDark={isDark} onSelectTeam={setSelected} />
      </div>
      <div className="w-80 shrink-0">
        {selected ? (
          <DetailPanel
            team={selected}
            costMap={costMap}
            onClose={() => setSelected(null)}
            onDelete={onDelete}
            onArchive={onArchive}
            onClearTasks={onClearTasks}
            onOpenCwd={onOpenCwd}
            onReveal={onReveal}
            onCopy={onCopy}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40
                          border-l border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95">
            <Hash className="w-10 h-10 text-zinc-400" />
            <p className="text-sm text-zinc-500">Click a team node to see details</p>
          </div>
        )}
      </div>
    </div>
  )
}
