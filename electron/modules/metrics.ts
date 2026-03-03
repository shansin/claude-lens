/**
 * Metrics module – agent performance and model comparison
 *
 * Handlers:
 *   'get-agent-metrics'    (teamName: string) → AgentMetric[]
 *   'get-model-comparison' ()                → ModelStats[]
 *   'get-usage-extended'   (days: number)    → DayUsage[]
 */

import type { IpcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')
const TEAMS_DIR    = path.join(os.homedir(), '.claude', 'teams')
const TASKS_DIR    = path.join(os.homedir(), '.claude', 'tasks')

// ── Pricing (per million tokens) [input, output] ─────────────────

const PRICING: Record<string, [number, number]> = {
  'claude-opus-4-6':   [15,  75],
  'claude-sonnet-4-6': [3,   15],
  'claude-haiku-4-5':  [0.8, 4],
  'claude-sonnet-4-5': [3,   15],
  'claude-sonnet-3-7': [3,   15],
  'claude-haiku-3-5':  [0.8, 4],
}

function getPricing(model: string): [number, number] | null {
  const key = Object.keys(PRICING).find(k => model.includes(k))
  return key ? PRICING[key] : null
}

function calcCost(inputTokens: number, outputTokens: number, model: string): number | null {
  const p = getPricing(model)
  if (!p) return null
  return (inputTokens * p[0] + outputTokens * p[1]) / 1_000_000
}

// ── Types ─────────────────────────────────────────────────────────

interface AgentMetric {
  agentName: string
  agentType: string
  model: string
  isLead: boolean
  tasksCompleted: number
  tasksActive: number
  tasksPending: number
  estimatedCostUSD: number | null
}

interface ModelStats {
  model: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheTokens: number
  costUSD: number | null
  messageCount: number
  projectCount: number
}

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

// ── Helpers ───────────────────────────────────────────────────────

function safeReadDir(dir: string): string[] {
  try { return fs.readdirSync(dir) } catch { return [] }
}

function safeReadFile(p: string): string | null {
  try { return fs.readFileSync(p, 'utf-8') } catch { return null }
}

function safeReadJson<T>(p: string): T | null {
  const raw = safeReadFile(p)
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

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
  for (const projDir of safeReadDir(PROJECTS_DIR)) {
    const projPath = path.join(PROJECTS_DIR, projDir)
    try { if (!fs.statSync(projPath).isDirectory()) continue } catch { continue }
    for (const fname of safeReadDir(projPath)) {
      if (!fname.endsWith('.jsonl')) continue
      const content = safeReadFile(path.join(projPath, fname))
      if (!content) continue
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

// ── get-agent-metrics ─────────────────────────────────────────────

interface TeamConfig {
  teamName?: string
  leadAgentId?: string
  leadSessionId?: string
  members?: Array<{
    name: string
    agentType?: string
    agentId?: string
    model?: string
  }>
}

interface TaskFile {
  id?: string
  status?: string
  subject?: string
  owner?: string
}

function getAgentMetrics(teamName: string): AgentMetric[] {
  const configPath = path.join(TEAMS_DIR, teamName, 'config.json')
  const config = safeReadJson<TeamConfig>(configPath)
  if (!config?.members) return []

  // Read tasks
  const tasksDir = path.join(TASKS_DIR, teamName)
  const taskFiles = safeReadDir(tasksDir).filter(f => f.endsWith('.json'))
  const tasks: TaskFile[] = []
  for (const tf of taskFiles) {
    const t = safeReadJson<TaskFile>(path.join(tasksDir, tf))
    if (t) tasks.push(t)
  }

  // Scan JSONL for costs, grouped by teamName + sessionId
  // We'll build a map: sessionId → { inputTokens, outputTokens, model }
  const sessionCosts = new Map<string, { inputTokens: number; outputTokens: number; model: string }>()
  const msgSeen = new Set<string>()

  for (const { rec } of iterateAllRecords()) {
    if (rec.teamName !== teamName) continue
    if (rec.type !== 'assistant') continue
    const msg = rec.message
    if (!msg?.usage || !msg.model) continue

    const msgId = msg.id ?? `${rec.sessionId}:${rec.timestamp}`
    if (msgSeen.has(msgId)) continue
    msgSeen.add(msgId)

    const sid = rec.sessionId ?? ''
    const existing = sessionCosts.get(sid) ?? { inputTokens: 0, outputTokens: 0, model: msg.model }
    existing.inputTokens += msg.usage.input_tokens ?? 0
    existing.outputTokens += msg.usage.output_tokens ?? 0
    if (msg.model) existing.model = msg.model
    sessionCosts.set(sid, existing)
  }

  return config.members.map(member => {
    const isLead = member.agentId === config.leadAgentId

    const memberTasks = tasks.filter(t => t.owner === member.name)
    const tasksCompleted = memberTasks.filter(t => t.status === 'completed').length
    const tasksActive    = memberTasks.filter(t => t.status === 'in_progress').length
    const tasksPending   = memberTasks.filter(t => t.status === 'pending').length

    // Try to match cost via leadSessionId for lead, or by agentId appearing in sessionId
    let estimatedCostUSD: number | null = null
    if (isLead && config.leadSessionId) {
      const sc = sessionCosts.get(config.leadSessionId)
      if (sc) {
        estimatedCostUSD = calcCost(sc.inputTokens, sc.outputTokens, sc.model)
      }
    } else if (member.agentId) {
      // Check sessions whose sessionId contains the agentId
      for (const [sid, sc] of sessionCosts) {
        if (sid.includes(member.agentId)) {
          const c = calcCost(sc.inputTokens, sc.outputTokens, sc.model)
          if (c !== null) estimatedCostUSD = (estimatedCostUSD ?? 0) + c
        }
      }
    }

    return {
      agentName: member.name,
      agentType: member.agentType ?? '',
      model: member.model ?? '',
      isLead,
      tasksCompleted,
      tasksActive,
      tasksPending,
      estimatedCostUSD,
    }
  })
}

// ── get-model-comparison ──────────────────────────────────────────

function getModelComparison(): ModelStats[] {
  // Deduplicate by message.id, group by model
  const msgBucket = new Map<string, {
    model: string
    inputTokens: number
    outputTokens: number
    cacheTokens: number
    projDir: string
  }>()

  for (const { rec, projDir } of iterateAllRecords()) {
    if (rec.type !== 'assistant') continue
    const msg = rec.message
    if (!msg?.usage || !msg.model) continue

    const ts = rec.timestamp ?? ''
    const msgId = msg.id ?? `${rec.sessionId}:${ts}`
    const usage = msg.usage

    const existing = msgBucket.get(msgId)
    if (!existing || (usage.output_tokens ?? 0) >= existing.outputTokens) {
      msgBucket.set(msgId, {
        model: msg.model,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheTokens: (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
        projDir,
      })
    }
  }

  const modelMap = new Map<string, ModelStats & { projects: Set<string> }>()

  for (const entry of msgBucket.values()) {
    let stat = modelMap.get(entry.model)
    if (!stat) {
      stat = {
        model: entry.model,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheTokens: 0,
        costUSD: null,
        messageCount: 0,
        projectCount: 0,
        projects: new Set(),
      }
      modelMap.set(entry.model, stat)
    }

    stat.totalInputTokens += entry.inputTokens
    stat.totalOutputTokens += entry.outputTokens
    stat.totalCacheTokens += entry.cacheTokens
    stat.messageCount++
    stat.projects.add(entry.projDir)

    const cost = calcCost(entry.inputTokens, entry.outputTokens, entry.model)
    if (cost !== null) stat.costUSD = (stat.costUSD ?? 0) + cost
  }

  return Array.from(modelMap.values())
    .map(({ projects, ...rest }) => ({ ...rest, projectCount: projects.size }))
    .sort((a, b) => b.messageCount - a.messageCount)
}

// ── get-usage-extended ────────────────────────────────────────────

function getUsageExtended(days: number): DayUsage[] {
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

// ── Registration ──────────────────────────────────────────────────

export function registerMetricsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('get-agent-metrics', (_e, teamName: string) => getAgentMetrics(teamName))
  ipcMain.handle('get-model-comparison', () => getModelComparison())
  ipcMain.handle('get-usage-extended', (_e, days: number) => getUsageExtended(days))
}
