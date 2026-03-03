import { useState, useRef, useEffect } from 'react'
import {
  MoreVertical, Trash2, Archive, FolderOpen, Copy, ListX, FolderSearch,
} from 'lucide-react'
import { cn } from '../lib/utils'
import type { TeamData } from '../types'

interface Props {
  team: TeamData
  onDelete:  (name: string) => void
  onArchive: (name: string) => void
  onClearTasks: (name: string) => void
  onOpenCwd: (cwd: string) => void
  onReveal:  (name: string) => void
  onCopy:    (text: string, label: string) => void
}

interface MenuItem {
  icon: React.ElementType
  label: string
  action: () => void
  danger?: boolean
  divider?: boolean
}

export function TeamActionMenu({ team, onDelete, onArchive, onClearTasks, onOpenCwd, onReveal, onCopy }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cwd = team.team.members[0]?.cwd ?? ''

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const items: (MenuItem | 'separator')[] = [
    {
      icon: FolderOpen,
      label: 'Open working dir',
      action: () => { onOpenCwd(cwd); setOpen(false) },
    },
    {
      icon: FolderSearch,
      label: 'Reveal in files',
      action: () => { onReveal(team.teamName); setOpen(false) },
    },
    {
      icon: Copy,
      label: 'Copy team name',
      action: () => { onCopy(team.team.name, 'Copied team name'); setOpen(false) },
    },
    {
      icon: Copy,
      label: 'Copy session ID',
      action: () => { onCopy(team.team.leadSessionId ?? '', 'Copied session ID'); setOpen(false) },
    },
    'separator',
    {
      icon: ListX,
      label: 'Clear tasks',
      action: () => { onClearTasks(team.teamName); setOpen(false) },
      danger: true,
    },
    {
      icon: Archive,
      label: 'Archive team',
      action: () => { onArchive(team.teamName); setOpen(false) },
    },
    {
      icon: Trash2,
      label: 'Delete team',
      action: () => { onDelete(team.teamName); setOpen(false) },
      danger: true,
    },
  ]

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          open
            ? 'bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200'
            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100'
        )}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-52 rounded-xl border border-zinc-200 dark:border-white/10
                        bg-white dark:bg-zinc-900 shadow-xl shadow-black/20 py-1 overflow-hidden">
          {items.map((item, i) => {
            if (item === 'separator') {
              return <div key={i} className="my-1 border-t border-zinc-100 dark:border-white/[0.06]" />
            }
            const { icon: Icon, label, action, danger } = item
            return (
              <button
                key={label}
                onClick={action}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left',
                  danger
                    ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                    : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/5'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
