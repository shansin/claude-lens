import { cn } from '../lib/utils'
import { CheckCircle } from 'lucide-react'

interface Props { message: string | null }

export function Toast({ message }: Props) {
  return (
    <div className={cn(
      'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]',
      'flex items-center gap-2.5 px-4 py-3 rounded-2xl',
      'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900',
      'shadow-2xl shadow-black/40 border border-white/10 dark:border-black/10',
      'text-sm font-medium',
      'transition-all duration-300',
      message ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
    )}>
      <CheckCircle className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
      {message}
    </div>
  )
}
