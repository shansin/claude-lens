/**
 * Analytics module – IPC handlers for usage charts + activity feed + cache stats
 *
 * Handlers registered:
 *   'get-usage-by-day'   (days?: number)  → DayUsage[]
 *   'get-activity-feed'  (limit?: number) → ActivityEntry[]
 *   'get-cache-stats'    (days?: number)  → CacheStats
 */

import type { IpcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')

// ── Pricing (per million tokens) [input, output, cacheWrite, cacheRead] ──

const PRICING: Record<string, [number, number, number, number]> = {
  'claude-opus-4-6':   [15,   75,   18.75, 1.5],
  'claude-opus-4-5':   [15,   75,   18.75, 1.5],
  'claude-sonnet-4-6': [3,    15,   3.75,  0.3],
  'claude-sonnet-4-5': [3,    15,   3.75,  0.3],
  'claude-sonnet-3-7': [3,    15,   3.75,  0.3],
  'claude-sonnet-3-5': [3,    15,   3.75,  0.3],
  'claude-haiku-4-5':  [0.8,  4,    1.0,   0.08],
  'claude-haiku-3-5':  [0.8,  4,    1.0,   0.08],
  'claude-3-opus':     [15,   75,   18.75, 1.5],
  'claude-3-haiku':    [0.25, 1.25, 0.3,   0.03],
}

function getPricing(model: string): [number, number, number, number] | null {
  const key = Object.keys(PRICING).find(k => model.includes(k))
  return key ? PRICING[key] : null
}

function calcCost(inputTokens: number, outputTokens: number, model: string): number | null {
  const p = getPricing(model)
  if (!p) return null
  return (inputTokens * p[0] + outputTokens * p[1]) / 1_000_000
}

// ── Types ─────────────────────────────────────────────────────────

interface ModelBucket {
  inputTokens: number
  outputTokens: number
  costUSD: number | null
}

interface DayUsage {
  date: string
  inputTokens: number
  outputTokens: number
  cacheTokens: number
  costUSD: number | null
  byModel: Record<string, ModelBucket>
}

interface ActivityEntry {
  timestamp: number
  type: 'user' | 'assistant'
  sessionId: string
  projectCwd: string
  projectName: string
  teamName?: string
  model?: string
  preview?: string
}

interface CacheDayStat {
  date: string
  cacheCreationTokens: number
  cacheReadTokens: number
  cacheCreationCostUSD: number
  cacheReadCostUSD: number
  savedUSD: number
}

export interface CacheStats {
  days: CacheDayStat[]
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
  totalCacheCreationCostUSD: number
  totalCacheReadCostUSD: number
  totalSavedUSD: number
  hitRate: number
}

// ── JSONL scanning helper ─────────────────────────────────────────

interface RawRecord {
  type?: string
  cwd?: string
  sessionId?: string
  teamName?: string
  timestamp?: string
  message?: {
    id?: string
    model?: string
    content?: unknown
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
}

function* iterateAllRecords(): Generator<{ rec: RawRecord; projDir: string }> {
  if (!fs.existsSync(PROJECTS_DIR)) return
  for (const projDir of fs.readdirSync(PROJECTS_DIR)) {
    const projPath = path.join(PROJECTS_DIR, projDir)
    try { if (!fs.statSync(projPath).isDirectory()) continue } catch { continue }
    for (const fname of fs.readdirSync(projPath)) {
      if (!fname.endsWith('.jsonl')) continue
      let content: string
      try { content = fs.readFileSync(path.join(projPath, fname), 'utf8') } catch { continue }
      for (const line of content.split('\n')) {
        if (!line.trim()) continue
        try {
          const rec = JSON.parse(line) as RawRecord
          yield { rec, projDir }
        } catch { /* skip */ }
      }
    }
  }
}

// ── get-usage-by-day ──────────────────────────────────────────────

function getUsageByDay(days = 30): DayUsage[] {
  const now = Date.now()
  const cutoff = now - days * 24 * 60 * 60 * 1000

  const msgBucket = new Map<string, {
    date: string
    model: string
    inputTokens: number
    outputTokens: number
    cacheTokens: number
  }>()

  for (const { rec } of iterateAllRecords()) {
    if (rec.type !== 'assistant') continue
    const msg = rec.message
    if (!msg?.usage || !msg.model) continue

    const ts = rec.timestamp ? new Date(rec.timestamp).getTime() : 0
    if (ts < cutoff || ts === 0) continue

    const date = new Date(ts).toISOString().slice(0, 10)
    const msgId = msg.id ?? `${rec.sessionId}:${ts}`
    const usage = msg.usage

    const existing = msgBucket.get(msgId)
    if (!existing || (usage.output_tokens ?? 0) >= existing.outputTokens) {
      msgBucket.set(msgId, {
        date,
        model: msg.model,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheTokens: (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
      })
    }
  }

  const dayMap = new Map<string, DayUsage>()

  for (const entry of msgBucket.values()) {
    let day = dayMap.get(entry.date)
    if (!day) {
      day = { date: entry.date, inputTokens: 0, outputTokens: 0, cacheTokens: 0, costUSD: null, byModel: {} }
      dayMap.set(entry.date, day)
    }

    day.inputTokens += entry.inputTokens
    day.outputTokens += entry.outputTokens
    day.cacheTokens += entry.cacheTokens

    const cost = calcCost(entry.inputTokens, entry.outputTokens, entry.model)
    if (cost !== null) day.costUSD = (day.costUSD ?? 0) + cost

    if (!day.byModel[entry.model]) {
      day.byModel[entry.model] = { inputTokens: 0, outputTokens: 0, costUSD: null }
    }
    const mb = day.byModel[entry.model]
    mb.inputTokens += entry.inputTokens
    mb.outputTokens += entry.outputTokens
    if (cost !== null) mb.costUSD = (mb.costUSD ?? 0) + cost
  }

  const result: DayUsage[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    result.push(dayMap.get(dateStr) ?? {
      date: dateStr, inputTokens: 0, outputTokens: 0, cacheTokens: 0, costUSD: null, byModel: {},
    })
  }

  return result
}

// ── get-cache-stats ───────────────────────────────────────────────

function getCacheStats(days = 90): CacheStats {
  const now = Date.now()
  const cutoff = now - days * 24 * 60 * 60 * 1000

  const msgBucket = new Map<string, {
    date: string
    model: string
    cacheCreationTokens: number
    cacheReadTokens: number
    outputTokens: number
  }>()

  for (const { rec } of iterateAllRecords()) {
    if (rec.type !== 'assistant') continue
    const msg = rec.message
    if (!msg?.usage || !msg.model) continue

    const ts = rec.timestamp ? new Date(rec.timestamp).getTime() : 0
    if (ts < cutoff || ts === 0) continue

    const cacheCreate = msg.usage.cache_creation_input_tokens ?? 0
    const cacheRead   = msg.usage.cache_read_input_tokens ?? 0
    if (cacheCreate === 0 && cacheRead === 0) continue

    const date  = new Date(ts).toISOString().slice(0, 10)
    const msgId = msg.id ?? `${rec.sessionId}:${ts}`
    const outTokens = msg.usage.output_tokens ?? 0

    const existing = msgBucket.get(msgId)
    if (!existing || outTokens >= existing.outputTokens) {
      msgBucket.set(msgId, {
        date, model: msg.model,
        cacheCreationTokens: cacheCreate,
        cacheReadTokens: cacheRead,
        outputTokens: outTokens,
      })
    }
  }

  const dayMap = new Map<string, CacheDayStat>()

  for (const entry of msgBucket.values()) {
    let day = dayMap.get(entry.date)
    if (!day) {
      day = { date: entry.date, cacheCreationTokens: 0, cacheReadTokens: 0, cacheCreationCostUSD: 0, cacheReadCostUSD: 0, savedUSD: 0 }
      dayMap.set(entry.date, day)
    }
    day.cacheCreationTokens += entry.cacheCreationTokens
    day.cacheReadTokens     += entry.cacheReadTokens

    const p = getPricing(entry.model)
    if (p) {
      const [inputPrice, , cacheWritePrice, cacheReadPrice] = p
      day.cacheCreationCostUSD += (entry.cacheCreationTokens * cacheWritePrice) / 1_000_000
      day.cacheReadCostUSD     += (entry.cacheReadTokens     * cacheReadPrice)  / 1_000_000
      // Savings = what read tokens would have cost at full input price minus actual cache-read price
      day.savedUSD             += (entry.cacheReadTokens * (inputPrice - cacheReadPrice)) / 1_000_000
    }
  }

  // Fill missing days
  const resultDays: CacheDayStat[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d       = new Date(now - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    resultDays.push(dayMap.get(dateStr) ?? {
      date: dateStr, cacheCreationTokens: 0, cacheReadTokens: 0,
      cacheCreationCostUSD: 0, cacheReadCostUSD: 0, savedUSD: 0,
    })
  }

  let totalCreation = 0, totalRead = 0, totalCreationCost = 0, totalReadCost = 0, totalSaved = 0
  for (const d of resultDays) {
    totalCreation    += d.cacheCreationTokens
    totalRead        += d.cacheReadTokens
    totalCreationCost += d.cacheCreationCostUSD
    totalReadCost    += d.cacheReadCostUSD
    totalSaved       += d.savedUSD
  }

  const hitRate = (totalCreation + totalRead) > 0
    ? totalRead / (totalCreation + totalRead)
    : 0

  return {
    days: resultDays,
    totalCacheCreationTokens:  totalCreation,
    totalCacheReadTokens:      totalRead,
    totalCacheCreationCostUSD: totalCreationCost,
    totalCacheReadCostUSD:     totalReadCost,
    totalSavedUSD:             totalSaved,
    hitRate,
  }
}

// ── get-activity-feed ─────────────────────────────────────────────

function extractPreview(content: unknown): string | undefined {
  if (!content) return undefined
  if (typeof content === 'string') return content.slice(0, 100) || undefined
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === 'object' && 'type' in block) {
        const b = block as { type: string; text?: string }
        if (b.type === 'text' && b.text) return b.text.slice(0, 100)
      }
    }
  }
  return undefined
}

function getActivityFeed(limit: number = 100): ActivityEntry[] {
  const entries: ActivityEntry[] = []

  for (const { rec } of iterateAllRecords()) {
    if (rec.type !== 'user' && rec.type !== 'assistant') continue
    if (!rec.message?.content) continue

    const ts = rec.timestamp ? new Date(rec.timestamp).getTime() : 0
    if (ts === 0) continue

    const preview = extractPreview(rec.message.content)

    entries.push({
      timestamp:   ts,
      type:        rec.type as 'user' | 'assistant',
      sessionId:   rec.sessionId ?? '',
      projectCwd:  rec.cwd ?? '',
      projectName: path.basename(rec.cwd ?? ''),
      teamName:    rec.teamName || undefined,
      model:       rec.message.model || undefined,
      preview,
    })
  }

  entries.sort((a, b) => b.timestamp - a.timestamp)
  return entries.slice(0, limit)
}

// ── Register handlers ─────────────────────────────────────────────

export function registerAnalyticsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('get-usage-by-day',  (_e, days?: number) => getUsageByDay(days ?? 30))
  ipcMain.handle('get-activity-feed', (_e, limit?: number) => getActivityFeed(limit ?? 100))
  ipcMain.handle('get-cache-stats',   (_e, days?: number) => getCacheStats(days ?? 90))
}
