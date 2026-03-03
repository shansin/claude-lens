import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TaskStatus } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  pending:     { label: 'Pending',     color: 'text-zinc-400',    dot: 'bg-zinc-400' },
  in_progress: { label: 'In Progress', color: 'text-blue-400',    dot: 'bg-blue-400' },
  completed:   { label: 'Done',        color: 'text-emerald-400', dot: 'bg-emerald-400' },
  deleted:     { label: 'Deleted',     color: 'text-red-400',     dot: 'bg-red-400' },
}

export function getTeamStats(tasks: { status: TaskStatus }[]) {
  const total = tasks.length
  const completed = tasks.filter(t => t.status === 'completed').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const pending = tasks.filter(t => t.status === 'pending').length
  const progress = total ? Math.round((completed / total) * 100) : 0
  return { total, completed, inProgress, pending, progress }
}

export function getAgentInitials(name: string) {
  return name.split('-').map(p => p[0]?.toUpperCase() ?? '').join('').slice(0, 2)
}

export function shortenModel(model: string) {
  // e.g. "claude-sonnet-4-6" -> "Sonnet 4.6", "qwen3:8b" -> "Qwen3 8B"
  if (model.includes('claude')) {
    const m = model.replace('claude-', '').replace(/-/g, ' ')
    return m.replace(/\b\w/g, c => c.toUpperCase())
  }
  return model.replace(/[:-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
