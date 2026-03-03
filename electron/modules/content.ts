/**
 * Content module – IPC handlers for plans, todos, memory, cleanup, export, search
 *
 * Handlers registered:
 *   'get-plans'          → PlanFile[]
 *   'get-todos'          → TodoFile[]
 *   'get-memory-files'   → MemoryFile[]
 *   'get-project-sizes'  → ProjectSize[]
 *   'delete-project-data' → { ok, deletedCount, freedBytes, error? }
 *   'export-csv'         → { ok, path, rowCount, error? }
 *   'search-content'     → SearchResult[]
 */

import type { IpcMain, BrowserWindow } from 'electron'
import { dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import readline from 'readline'
import { spawnSync } from 'child_process'

const CLAUDE_DIR   = path.join(os.homedir(), '.claude')
const PLANS_DIR    = path.join(CLAUDE_DIR, 'plans')
const TODOS_DIR    = path.join(CLAUDE_DIR, 'todos')
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')

// ── Pricing (per million tokens) [input, output] ─────────────────

const PRICING: Record<string, [number, number]> = {
  'claude-opus-4-6':   [15,  75],
  'claude-sonnet-4-6': [3,   15],
  'claude-haiku-4-5':  [0.8, 4],
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

interface PlanFile {
  name: string
  path: string
  content: string
  modifiedAt: number
}

interface TodoTask {
  id: string
  subject: string
  description: string
  status: string
  activeForm?: string
  blocks: string[]
  blockedBy: string[]
  owner?: string
}

interface TodoFile {
  filename: string
  agentId: string
  tasks: TodoTask[]
}

interface MemoryFile {
  cwd: string
  projectName: string
  filePath: string
  filename: string
  content: string
  sizeBytes: number
  modifiedAt: number
}

interface ProjectSize {
  projectKey: string
  cwd?: string
  displayName: string
  fileCount: number
  sizeBytes: number
  lastActivity: number
  oldestActivity: number
}

interface SearchResult {
  sessionId: string
  projectKey: string
  projectCwd: string
  projectName: string
  teamName?: string
  timestamp: number
  type: string
  snippet: string
}

// ── Helpers ───────────────────────────────────────────────────────

function safeReadDir(dir: string): string[] {
  try { return fs.readdirSync(dir) } catch { return [] }
}

function safeStat(p: string): fs.Stats | null {
  try { return fs.statSync(p) } catch { return null }
}

function safeReadFile(p: string): string | null {
  try { return fs.readFileSync(p, 'utf-8') } catch { return null }
}

/** Extract cwd from a JSONL file by reading its first few lines */
function extractCwdFromJsonl(filePath: string): string | undefined {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(4096)
    const bytesRead = fs.readSync(fd, buf, 0, 4096, 0)
    fs.closeSync(fd)
    const chunk = buf.toString('utf-8', 0, bytesRead)
    const lines = chunk.split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line)
        if (obj.cwd) return obj.cwd
      } catch { /* skip bad line */ }
    }
  } catch { /* skip */ }
  return undefined
}

// ── Handler implementations ───────────────────────────────────────

function getPlans(): PlanFile[] {
  const files = safeReadDir(PLANS_DIR).filter(f => f.endsWith('.md'))
  return files.map(f => {
    const fullPath = path.join(PLANS_DIR, f)
    const stat = safeStat(fullPath)
    const content = safeReadFile(fullPath) ?? ''
    return {
      name: f.replace(/\.md$/, ''),
      path: fullPath,
      content,
      modifiedAt: stat ? stat.mtimeMs : 0,
    }
  }).sort((a, b) => b.modifiedAt - a.modifiedAt)
}

function getTodos(): TodoFile[] {
  const files = safeReadDir(TODOS_DIR).filter(f => f.endsWith('.json'))
  const results: TodoFile[] = []
  for (const f of files) {
    const fullPath = path.join(TODOS_DIR, f)
    const raw = safeReadFile(fullPath)
    if (!raw) continue
    try {
      const data = JSON.parse(raw)
      // Filename pattern: typically the agent ID or similar
      const agentId = f.replace(/\.json$/, '')
      const tasks: TodoTask[] = Array.isArray(data) ? data : (data.tasks ?? [])
      results.push({ filename: f, agentId, tasks })
    } catch { /* skip bad json */ }
  }
  return results
}

function getMemoryFiles(): MemoryFile[] {
  const results: MemoryFile[] = []
  const seenPaths = new Set<string>()

  // Scan ~/.claude/projects/ dirs to find cwds
  const projectDirs = safeReadDir(PROJECTS_DIR)
  for (const projKey of projectDirs) {
    const projDir = path.join(PROJECTS_DIR, projKey)
    const stat = safeStat(projDir)
    if (!stat?.isDirectory()) continue

    // Try to find cwd from a JSONL file
    let cwd: string | undefined
    const jsonlFiles = safeReadDir(projDir).filter(f => f.endsWith('.jsonl'))
    if (jsonlFiles.length > 0) {
      cwd = extractCwdFromJsonl(path.join(projDir, jsonlFiles[0]))
    }

    // Check memory subdirectory in ~/.claude/projects/<key>/memory/
    const memDir = path.join(projDir, 'memory')
    const memFiles = safeReadDir(memDir).filter(f => f.endsWith('.md'))
    for (const mf of memFiles) {
      const fp = path.join(memDir, mf)
      if (seenPaths.has(fp)) continue
      seenPaths.add(fp)
      const mStat = safeStat(fp)
      const content = safeReadFile(fp) ?? ''
      results.push({
        cwd: cwd ?? projKey,
        projectName: cwd ? path.basename(cwd) : projKey,
        filePath: fp,
        filename: mf,
        content,
        sizeBytes: mStat?.size ?? 0,
        modifiedAt: mStat ? mStat.mtimeMs : 0,
      })
    }

    // Check if the cwd has CLAUDE.md or memory/ dir
    if (cwd) {
      const claudeMd = path.join(cwd, 'CLAUDE.md')
      if (!seenPaths.has(claudeMd)) {
        const cStat = safeStat(claudeMd)
        if (cStat) {
          seenPaths.add(claudeMd)
          const content = safeReadFile(claudeMd) ?? ''
          results.push({
            cwd,
            projectName: path.basename(cwd),
            filePath: claudeMd,
            filename: 'CLAUDE.md',
            content,
            sizeBytes: cStat.size,
            modifiedAt: cStat.mtimeMs,
          })
        }
      }

      const cwdMemDir = path.join(cwd, 'memory')
      const cwdMemFiles = safeReadDir(cwdMemDir).filter(f => f.endsWith('.md'))
      for (const mf of cwdMemFiles) {
        const fp = path.join(cwdMemDir, mf)
        if (seenPaths.has(fp)) continue
        seenPaths.add(fp)
        const mStat = safeStat(fp)
        const content = safeReadFile(fp) ?? ''
        results.push({
          cwd,
          projectName: path.basename(cwd),
          filePath: fp,
          filename: mf,
          content,
          sizeBytes: mStat?.size ?? 0,
          modifiedAt: mStat ? mStat.mtimeMs : 0,
        })
      }
    }
  }

  return results.sort((a, b) => b.modifiedAt - a.modifiedAt)
}

function getProjectSizes(): ProjectSize[] {
  const results: ProjectSize[] = []
  const projectDirs = safeReadDir(PROJECTS_DIR)

  for (const projKey of projectDirs) {
    const projDir = path.join(PROJECTS_DIR, projKey)
    const stat = safeStat(projDir)
    if (!stat?.isDirectory()) continue

    const files = safeReadDir(projDir).filter(f => f.endsWith('.jsonl'))
    if (files.length === 0) continue

    let totalSize = 0
    let oldest = Infinity
    let newest = 0
    let cwd: string | undefined

    for (const f of files) {
      const fp = path.join(projDir, f)
      const fStat = safeStat(fp)
      if (!fStat) continue
      totalSize += fStat.size
      if (fStat.mtimeMs < oldest) oldest = fStat.mtimeMs
      if (fStat.mtimeMs > newest) newest = fStat.mtimeMs
    }

    // Try to get cwd from first JSONL
    if (files.length > 0) {
      cwd = extractCwdFromJsonl(path.join(projDir, files[0]))
    }

    const displayName = cwd ? path.basename(cwd) : projKey.replace(/-/g, '/')

    results.push({
      projectKey: projKey,
      cwd,
      displayName,
      fileCount: files.length,
      sizeBytes: totalSize,
      lastActivity: newest,
      oldestActivity: oldest === Infinity ? newest : oldest,
    })
  }

  return results.sort((a, b) => b.sizeBytes - a.sizeBytes)
}

async function deleteProjectData(
  projectKey: string,
  getMainWindow: () => BrowserWindow | null
): Promise<{ ok: boolean; deletedCount: number; freedBytes: number; error?: string }> {
  const win = getMainWindow()
  if (!win) return { ok: false, deletedCount: 0, freedBytes: 0, error: 'No window' }

  const projDir = path.join(PROJECTS_DIR, projectKey)
  if (!fs.existsSync(projDir)) {
    return { ok: false, deletedCount: 0, freedBytes: 0, error: 'Project not found' }
  }

  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    title: 'Delete project session data',
    message: `Delete all session data for "${projectKey}"?`,
    detail: 'This will remove all .jsonl files for this project. This cannot be undone.',
  })

  if (response !== 0) return { ok: false, deletedCount: 0, freedBytes: 0 }

  let deletedCount = 0
  let freedBytes = 0
  const files = safeReadDir(projDir).filter(f => f.endsWith('.jsonl'))
  for (const f of files) {
    const fp = path.join(projDir, f)
    const fStat = safeStat(fp)
    if (fStat) freedBytes += fStat.size
    try {
      fs.unlinkSync(fp)
      deletedCount++
    } catch { /* skip */ }
  }

  return { ok: true, deletedCount, freedBytes }
}

async function exportCsv(
  getMainWindow: () => BrowserWindow | null
): Promise<{ ok: boolean; path?: string; rowCount?: number; error?: string }> {
  const win = getMainWindow()
  if (!win) return { ok: false, error: 'No window' }

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export usage data as CSV',
    defaultPath: `claude-usage-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  })
  if (canceled || !filePath) return { ok: false }

  const rows: string[] = ['date,project,sessionId,teamName,model,inputTokens,outputTokens,cacheTokens,costUSD']
  let rowCount = 0

  const projectDirs = safeReadDir(PROJECTS_DIR)
  for (const projKey of projectDirs) {
    const projDir = path.join(PROJECTS_DIR, projKey)
    const stat = safeStat(projDir)
    if (!stat?.isDirectory()) continue

    const jsonlFiles = safeReadDir(projDir).filter(f => f.endsWith('.jsonl'))
    for (const jf of jsonlFiles) {
      const fp = path.join(projDir, jf)
      const content = safeReadFile(fp)
      if (!content) continue

      const sessionId = jf.replace(/\.jsonl$/, '')
      const displayName = projKey.replace(/-/g, '/')

      // Aggregate per-session
      let inputTokens = 0
      let outputTokens = 0
      let cacheTokens = 0
      let model = ''
      let teamName = ''
      let lastTimestamp = ''

      for (const line of content.split('\n')) {
        if (!line.trim()) continue
        try {
          const obj = JSON.parse(line)
          if (obj.teamName) teamName = obj.teamName
          if (obj.model) model = obj.model
          if (obj.timestamp) lastTimestamp = obj.timestamp

          const usage = obj.message?.usage
          if (usage) {
            inputTokens += usage.input_tokens ?? 0
            outputTokens += usage.output_tokens ?? 0
            cacheTokens += usage.cache_creation_input_tokens ?? 0
          }
        } catch { /* skip */ }
      }

      if (inputTokens === 0 && outputTokens === 0) continue

      const cost = calcCost(inputTokens, outputTokens, model)
      const date = lastTimestamp ? lastTimestamp.slice(0, 10) : ''
      rows.push(`${date},${csvEscape(displayName)},${sessionId},${csvEscape(teamName)},${csvEscape(model)},${inputTokens},${outputTokens},${cacheTokens},${cost !== null ? cost.toFixed(6) : ''}`)
      rowCount++
    }
  }

  try {
    fs.writeFileSync(filePath, rows.join('\n'), 'utf-8')
    return { ok: true, path: filePath, rowCount }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

function csvEscape(s: string): string {
  if (!s) return ''
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function searchContent(query: string, limit: number = 50): SearchResult[] {
  const results: SearchResult[] = []
  const q = query.toLowerCase()

  const projectDirs = safeReadDir(PROJECTS_DIR)
  for (const projKey of projectDirs) {
    if (results.length >= limit) break
    const projDir = path.join(PROJECTS_DIR, projKey)
    const stat = safeStat(projDir)
    if (!stat?.isDirectory()) continue

    const displayName = projKey.replace(/-/g, '/')

    const jsonlFiles = safeReadDir(projDir).filter(f => f.endsWith('.jsonl'))
    for (const jf of jsonlFiles) {
      if (results.length >= limit) break
      const fp = path.join(projDir, jf)
      const content = safeReadFile(fp)
      if (!content) continue

      const sessionId = jf.replace(/\.jsonl$/, '')
      let cwd = ''
      let teamName: string | undefined

      for (const line of content.split('\n')) {
        if (results.length >= limit) break
        if (!line.trim()) continue
        try {
          const obj = JSON.parse(line)
          if (obj.cwd && !cwd) cwd = obj.cwd
          if (obj.teamName && !teamName) teamName = obj.teamName

          if (obj.type !== 'user' && obj.type !== 'assistant') continue

          // Extract text from message content
          let text = ''
          const msg = obj.message
          if (msg?.content) {
            if (typeof msg.content === 'string') {
              text = msg.content
            } else if (Array.isArray(msg.content)) {
              text = msg.content
                .filter((b: any) => b.type === 'text')
                .map((b: any) => b.text)
                .join(' ')
            }
          }

          const lowerText = text.toLowerCase()
          const idx = lowerText.indexOf(q)
          if (idx === -1) continue

          // Build snippet: 150 chars around match
          const start = Math.max(0, idx - 60)
          const end = Math.min(text.length, idx + q.length + 90)
          let snippet = text.slice(start, end).replace(/\n/g, ' ')
          if (start > 0) snippet = '…' + snippet
          if (end < text.length) snippet = snippet + '…'

          results.push({
            sessionId,
            projectKey: projKey,
            projectCwd: cwd || projKey,
            projectName: cwd ? path.basename(cwd) : displayName,
            teamName,
            timestamp: obj.timestamp ? new Date(obj.timestamp).getTime() : 0,
            type: obj.type,
            snippet,
          })
        } catch { /* skip */ }
      }
    }
  }

  return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
}

// ── Registration ──────────────────────────────────────────────────

export function registerContentHandlers(
  ipc: IpcMain,
  getMainWindow: () => BrowserWindow | null
) {
  ipc.handle('get-plans', () => getPlans())
  ipc.handle('get-todos', () => getTodos())
  ipc.handle('get-memory-files', () => getMemoryFiles())
  ipc.handle('get-project-sizes', () => getProjectSizes())
  ipc.handle('delete-project-data', (_e, projectKey: string) => deleteProjectData(projectKey, getMainWindow))
  ipc.handle('export-csv', () => exportCsv(getMainWindow))
  ipc.handle('search-content', (_e, query: string, limit?: number) => searchContent(query, limit))

  ipc.handle('save-file', async (_e, filePath: string, content: string) => {
    try {
      if (!filePath.startsWith(os.homedir())) {
        return { ok: false, error: 'Path must be within home directory' }
      }
      fs.writeFileSync(filePath, content, 'utf-8')
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipc.handle('test-hook', async (_e, command: string, sampleInput?: string) => {
    try {
      const result = spawnSync(command, {
        shell: true,
        timeout: 10000,
        input: sampleInput ?? '',
        encoding: 'utf-8',
      })
      const output = (result.stdout ?? '') + (result.stderr ?? '')
      return {
        ok: result.status === 0,
        output,
        exitCode: result.status ?? -1,
        error: result.error ? String(result.error) : undefined,
      }
    } catch (err: unknown) {
      return { ok: false, output: '', exitCode: -1, error: String(err) }
    }
  })
}
