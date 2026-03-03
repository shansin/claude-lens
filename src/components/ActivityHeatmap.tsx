import { useMemo } from 'react'

interface DayUsage {
  date: string
  inputTokens: number
  outputTokens: number
  cacheTokens: number
  costUSD: number | null
}

interface Props {
  data: DayUsage[]
}

function totalTokens(d: DayUsage) {
  return d.inputTokens + d.outputTokens + d.cacheTokens
}

function cellColor(tokens: number): string {
  if (tokens === 0)         return 'bg-zinc-100 dark:bg-zinc-800'
  if (tokens < 1_000)       return 'bg-violet-100 dark:bg-violet-900/40'
  if (tokens < 10_000)      return 'bg-violet-300 dark:bg-violet-700/60'
  if (tokens < 100_000)     return 'bg-violet-500 dark:bg-violet-500'
  return                           'bg-violet-700 dark:bg-violet-400'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatCost(usd: number | null): string {
  if (usd === null) return '—'
  if (usd < 0.01)   return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

// Build a 53×7 grid starting from the Sunday that's ~1 year ago
function buildGrid(data: DayUsage[]): { byDate: Map<string, DayUsage>; startDate: Date } {
  const byDate = new Map<string, DayUsage>()
  for (const d of data) byDate.set(d.date, d)

  // Start grid on the Sunday <= 364 days ago
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 364)
  // rewind to prior Sunday
  startDate.setDate(startDate.getDate() - startDate.getDay())

  return { byDate, startDate }
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

export function ActivityHeatmap({ data }: Props) {
  const { byDate, startDate } = useMemo(() => buildGrid(data), [data])

  // Build columns (weeks). Each column = 7 days.
  const columns = useMemo(() => {
    const cols: Array<Array<{ dateStr: string; day: DayUsage | undefined }>> = []
    const cursor = new Date(startDate)
    for (let col = 0; col < 53; col++) {
      const week: Array<{ dateStr: string; day: DayUsage | undefined }> = []
      for (let dow = 0; dow < 7; dow++) {
        const y = cursor.getFullYear()
        const m = String(cursor.getMonth() + 1).padStart(2, '0')
        const dd = String(cursor.getDate()).padStart(2, '0')
        const dateStr = `${y}-${m}-${dd}`
        week.push({ dateStr, day: byDate.get(dateStr) })
        cursor.setDate(cursor.getDate() + 1)
      }
      cols.push(week)
    }
    return cols
  }, [byDate, startDate])

  // Month labels: for each column, show month name if first day of column changes month
  const monthLabels = useMemo(() => {
    const labels: Array<string> = []
    let lastMonth = -1
    for (const col of columns) {
      const d = new Date(col[0].dateStr + 'T00:00:00')
      const month = d.getMonth()
      if (month !== lastMonth) {
        labels.push(d.toLocaleDateString('en-US', { month: 'short' }))
        lastMonth = month
      } else {
        labels.push('')
      }
    }
    return labels
  }, [columns])

  // Summary stats
  const summary = useMemo(() => {
    let activeDays = 0
    let totalTok = 0
    let totalCost: number | null = null
    for (const d of data) {
      const t = totalTokens(d)
      if (t > 0) activeDays++
      totalTok += t
      if (d.costUSD !== null) totalCost = (totalCost ?? 0) + d.costUSD
    }
    return { activeDays, totalTok, totalCost }
  }, [data])

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="inline-flex gap-1">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-[3px] mt-6 mr-1">
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="h-[11px] text-[9px] text-zinc-400 leading-none text-right w-5">
                {label}
              </div>
            ))}
          </div>

          {/* Columns */}
          <div className="flex flex-col gap-1">
            {/* Month labels row */}
            <div className="flex gap-[3px]">
              {monthLabels.map((label, i) => (
                <div key={i} className="w-[11px] text-[9px] text-zinc-400 whitespace-nowrap overflow-visible">
                  {label}
                </div>
              ))}
            </div>

            {/* Grid rows (7 days of week) */}
            {[0, 1, 2, 3, 4, 5, 6].map(dow => (
              <div key={dow} className="flex gap-[3px]">
                {columns.map((col, colIdx) => {
                  const cell = col[dow]
                  const tokens = cell.day ? totalTokens(cell.day) : 0
                  const cost = cell.day?.costUSD ?? null
                  const title = `${formatDate(cell.dateStr)}: ${formatTokens(tokens)} tokens, ${formatCost(cost)}`
                  return (
                    <div
                      key={colIdx}
                      title={title}
                      className={`w-[11px] h-[11px] rounded-[2px] cursor-default ${cellColor(tokens)}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>Less</span>
        {(['bg-zinc-100 dark:bg-zinc-800', 'bg-violet-100 dark:bg-violet-900/40', 'bg-violet-300 dark:bg-violet-700/60', 'bg-violet-500 dark:bg-violet-500', 'bg-violet-700 dark:bg-violet-400'] as const).map((cls, i) => (
          <div key={i} className={`w-[11px] h-[11px] rounded-[2px] ${cls}`} />
        ))}
        <span>More</span>
      </div>

      {/* Summary */}
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">{summary.activeDays}</span> days active
        {' · '}
        <span className="font-medium text-zinc-700 dark:text-zinc-200">{formatTokens(summary.totalTok)}</span> total tokens
        {' · '}
        <span className="font-medium text-zinc-700 dark:text-zinc-200">{formatCost(summary.totalCost)}</span> total cost
      </p>
    </div>
  )
}
