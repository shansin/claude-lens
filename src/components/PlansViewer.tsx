import { useState } from 'react'
import { cn } from '../lib/utils'
import { FileText, BookOpen } from 'lucide-react'
import { formatRelativeTime } from '../lib/utils'

interface PlanFile {
  name: string
  path: string
  content: string
  modifiedAt: number
}

interface Props {
  plans: PlanFile[]
}

/** Simple markdown-ish renderer: headers → bold, **bold**, - lists → bullets */
function renderMarkdown(content: string) {
  const lines = content.split('\n')
  const elements: JSX.Element[] = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Headers
    const headerMatch = line.match(/^(#{1,4})\s+(.*)/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const text = headerMatch[2]
      const cls = level === 1
        ? 'text-lg font-bold text-zinc-800 dark:text-zinc-100 mt-4 mb-2'
        : level === 2
        ? 'text-base font-bold text-zinc-700 dark:text-zinc-200 mt-3 mb-1'
        : 'text-sm font-semibold text-zinc-600 dark:text-zinc-300 mt-2 mb-1'
      elements.push(<p key={i} className={cls}>{renderInline(text)}</p>)
      continue
    }

    // Bullet lists
    if (line.match(/^\s*[-*]\s+/)) {
      const text = line.replace(/^\s*[-*]\s+/, '')
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0
      elements.push(
        <div key={i} className="flex gap-2 text-sm text-zinc-600 dark:text-zinc-300" style={{ paddingLeft: indent * 4 }}>
          <span className="text-zinc-400 select-none mt-0.5">•</span>
          <span>{renderInline(text)}</span>
        </div>
      )
      continue
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />)
      continue
    }

    // Normal text
    elements.push(<p key={i} className="text-sm text-zinc-600 dark:text-zinc-300">{renderInline(line)}</p>)
  }

  return elements
}

function renderInline(text: string) {
  // Bold: **text** or __text__
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-zinc-800 dark:text-zinc-100">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <strong key={i} className="font-semibold text-zinc-800 dark:text-zinc-100">{part.slice(2, -2)}</strong>
    }
    // Inline code: `text`
    const codeParts = part.split(/(`[^`]+`)/g)
    if (codeParts.length > 1) {
      return codeParts.map((cp, j) => {
        if (cp.startsWith('`') && cp.endsWith('`')) {
          return <code key={`${i}-${j}`} className="px-1 py-0.5 bg-zinc-100 dark:bg-white/10 rounded text-xs font-mono">{cp.slice(1, -1)}</code>
        }
        return cp
      })
    }
    return part
  })
}

export function PlansViewer({ plans }: Props) {
  const [selected, setSelected] = useState<number>(0)

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
        <BookOpen className="w-12 h-12 text-zinc-400" />
        <p className="text-sm text-zinc-500">No plans found in ~/.claude/plans/</p>
      </div>
    )
  }

  const plan = plans[selected]

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r border-zinc-200 dark:border-white/[0.06] overflow-y-auto">
        {plans.map((p, i) => (
          <button
            key={p.path}
            onClick={() => setSelected(i)}
            className={cn(
              'w-full text-left px-3 py-2.5 border-b border-zinc-100 dark:border-white/[0.04] transition-colors',
              i === selected
                ? 'bg-violet-50 dark:bg-violet-500/10'
                : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
            )}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{p.name}</span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 ml-5.5">{formatRelativeTime(p.modifiedAt)}</p>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-4">{plan.name}</h2>
        <div className="space-y-0.5">
          {renderMarkdown(plan.content)}
        </div>
      </div>
    </div>
  )
}
