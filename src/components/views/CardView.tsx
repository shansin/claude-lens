import { formatRelativeTime, getTeamStats } from '../../lib/utils'
import { AgentPill } from '../AgentPill'
import { TaskRow } from '../TaskRow'
import { TeamActionMenu } from '../TeamActionMenu'
import { CostPanel } from '../CostPanel'
import type { TeamData, CostMap } from '../../types'
import { Users, CheckSquare, Clock, FolderOpen } from 'lucide-react'

interface Props {
  teams: TeamData[]
  costMap: CostMap
  onSelectTeam?: (team: TeamData) => void
  onDelete:  (name: string) => void
  onArchive: (name: string) => void
  onClearTasks: (name: string) => void
  onOpenCwd: (cwd: string) => void
  onReveal:  (name: string) => void
  onCopy:    (text: string, label: string) => void
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 bg-zinc-200 dark:bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-700"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function Stat({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <Icon className="w-3.5 h-3.5" />
      <span className="font-medium text-zinc-700 dark:text-zinc-200">{value}</span>
      <span>{label}</span>
    </div>
  )
}

export function CardView({ teams, costMap, onSelectTeam, onDelete, onArchive, onClearTasks, onOpenCwd, onReveal, onCopy }: Props) {
  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
        <FolderOpen className="w-16 h-16 text-zinc-400" />
        <p className="text-lg font-medium text-zinc-500">No teams found</p>
        <p className="text-sm text-zinc-400">Teams appear in ~/.claude/teams/</p>
      </div>
    )
  }

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 auto-rows-min overflow-y-auto h-full">
      {teams.map((item) => {
        const stats = getTeamStats(item.tasks)
        const isLead = (id: string) => id === item.team.leadAgentId

        return (
          <div
            key={item.teamName}
            onClick={() => onSelectTeam?.(item)}
            className="group rounded-2xl border bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-white/10
                       hover:border-violet-400/60 dark:hover:border-violet-400/30 hover:shadow-lg dark:hover:shadow-violet-500/5
                       transition-all duration-200 overflow-hidden cursor-pointer"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 data-sensitive className="font-bold text-base text-zinc-900 dark:text-white truncate leading-tight flex-1">
                  {item.team.name}
                </h3>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatRelativeTime(item.team.createdAt)}
                  </span>
                  <TeamActionMenu
                    team={item}
                    onDelete={onDelete}
                    onArchive={onArchive}
                    onClearTasks={onClearTasks}
                    onOpenCwd={onOpenCwd}
                    onReveal={onReveal}
                    onCopy={onCopy}
                  />
                </div>
              </div>
              {item.team.description && (
                <p data-sensitive className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-snug">
                  {item.team.description}
                </p>
              )}
            </div>

            {/* Stats row */}
            <div className="px-5 pb-3 flex items-center gap-4">
              <Stat icon={Users}       value={item.team.members.length} label="agents" />
              <Stat icon={CheckSquare} value={stats.completed}          label="done" />
              <Stat icon={Clock}       value={stats.inProgress}         label="active" />
              {stats.total > 0 && (
                <span className="ml-auto text-xs font-mono text-violet-500 dark:text-violet-400">
                  {stats.progress}%
                </span>
              )}
            </div>
            {stats.total > 0 && (
              <div className="px-5 pb-3">
                <ProgressBar value={stats.progress} />
              </div>
            )}

            {/* Agents */}
            {item.team.members.length > 0 && (
              <div className="px-4 pb-3">
                <div className="flex flex-col gap-1.5">
                  {item.team.members.map(member => (
                    <AgentPill
                      key={member.agentId}
                      member={member}
                      isLead={isLead(member.agentId)}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Tasks */}
            {item.tasks.length > 0 && (
              <div className="border-t border-zinc-100 dark:border-white/[0.06] px-3 py-2">
                <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-2 pb-1.5">
                  Tasks
                </p>
                <div className="flex flex-col gap-0.5">
                  {item.tasks.slice(0, 5).map(task => (
                    <TaskRow key={task.id} task={task} compact />
                  ))}
                  {item.tasks.length > 5 && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 px-2 py-1">
                      +{item.tasks.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Cost */}
            <CostPanel costMap={costMap} teamName={item.team.name} />
          </div>
        )
      })}
    </div>
  )
}
