import { cn, getAgentInitials, shortenModel } from '../lib/utils'
import type { TeamMember } from '../types'

interface Props {
  member: TeamMember
  isLead?: boolean
  size?: 'sm' | 'md'
}

export function AgentPill({ member, isLead, size = 'md' }: Props) {
  const initials = getAgentInitials(member.name)
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-xl border transition-colors',
      'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10',
      'hover:border-violet-400/50 dark:hover:border-violet-400/30',
      size === 'sm' ? 'px-2.5 py-1.5' : 'px-3 py-2'
    )}>
      <div className={cn(
        'rounded-lg flex items-center justify-center font-bold text-white shrink-0',
        size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm',
        isLead
          ? 'bg-gradient-to-br from-violet-500 to-purple-600'
          : 'bg-gradient-to-br from-zinc-500 to-zinc-600'
      )}>
        {initials}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'font-medium truncate',
            size === 'sm' ? 'text-xs' : 'text-sm',
            'text-zinc-800 dark:text-zinc-100'
          )}>
            {member.name}
          </span>
          {isLead && (
            <span className="text-xs bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full shrink-0">
              lead
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
            {member.agentType}
          </span>
          {member.model && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="text-xs text-blue-500 dark:text-blue-400 font-mono truncate">
                {shortenModel(member.model)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
