import { app, BrowserWindow, ipcMain, nativeTheme, shell, clipboard, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import chokidar from 'chokidar'
import { registerContentHandlers }      from './modules/content'
import { registerSettingsHandlers }     from './modules/settings'
import { registerAnalyticsHandlers }    from './modules/analytics'
import { registerSystemHandlers }       from './modules/system'
import { registerViewerHandlers }       from './modules/viewer'
import { registerMetricsHandlers }      from './modules/metrics'
import { registerNotificationHandlers, checkTaskCompletions } from './modules/notifications'
import type { TaskData } from './modules/notifications'

const CLAUDE_DIR   = path.join(os.homedir(), '.claude')
const TEAMS_DIR    = path.join(CLAUDE_DIR, 'teams')
const TASKS_DIR    = path.join(CLAUDE_DIR, 'tasks')

// Previous task snapshot for notification diffing
let prevTaskSnapshot: TaskData[] = []
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')
const ARCHIVE_DIR  = path.join(CLAUDE_DIR, 'teams-archive')

let mainWindow: BrowserWindow | null = null
let watcher: ReturnType<typeof chokidar.watch> | null = null

// ── Window ───────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    frame: process.platform !== 'darwin',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const isDev = process.env.NODE_ENV === 'development'
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  })
}

// ── Team/task data ───────────────────────────────────────────────

interface TeamDataPayload {
  teamName: string
  team: Record<string, unknown>
  tasks: unknown[]
}

function readTeamData(): TeamDataPayload[] {
  if (!fs.existsSync(TEAMS_DIR)) return []
  const result: TeamDataPayload[] = []
  for (const d of fs.readdirSync(TEAMS_DIR)) {
    try {
      const cfgPath = path.join(TEAMS_DIR, d, 'config.json')
      if (!fs.existsSync(cfgPath)) continue
      const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
      result.push({ team: config, tasks: readTeamTasks(d), teamName: d })
    } catch { /* skip */ }
  }
  return result.sort((a, b) => {
    const at = (a.team as { createdAt?: number }).createdAt ?? 0
    const bt = (b.team as { createdAt?: number }).createdAt ?? 0
    return bt - at
  })
}

function readTeamTasks(teamName: string): unknown[] {
  const taskDir = path.join(TASKS_DIR, teamName)
  if (!fs.existsSync(taskDir)) return []
  try {
    return fs.readdirSync(taskDir)
      .filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(taskDir, f), 'utf8')) } catch { return null } })
      .filter(Boolean)
      .sort((a: { id: string }, b: { id: string }) => Number(a.id) - Number(b.id))
  } catch { return [] }
}

// ── Pricing / cost helpers ───────────────────────────────────────

interface UsageRecord {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

// Pricing per million tokens: [input, output, cache-write, cache-read]
const PRICING: Record<string, [number, number, number, number]> = {
  'claude-opus-4-6':   [15,   75,    18.75, 1.5  ],
  'claude-opus-4-5':   [15,   75,    18.75, 1.5  ],
  'claude-sonnet-4-6': [3,    15,    3.75,  0.3  ],
  'claude-sonnet-4-5': [3,    15,    3.75,  0.3  ],
  'claude-sonnet-3-7': [3,    15,    3.75,  0.3  ],
  'claude-sonnet-3-5': [3,    15,    3.75,  0.3  ],
  'claude-haiku-4-5':  [0.8,  4,     1.0,   0.08 ],
  'claude-haiku-3-5':  [0.8,  4,     1.0,   0.08 ],
  'claude-3-opus':     [15,   75,    18.75, 1.5  ],
  'claude-3-haiku':    [0.25, 1.25,  0.3,   0.03 ],
}

function getPricing(model: string): [number, number, number, number] | null {
  const key = Object.keys(PRICING).find(k => model.includes(k))
  return key ? PRICING[key] : null
}

function calcCost(usage: UsageRecord, model: string): number | null {
  const p = getPricing(model)
  if (!p) return null
  const [pIn, pOut, pCW, pCR] = p
  const M = 1_000_000
  return (
    ((usage.input_tokens ?? 0) * pIn +
     (usage.output_tokens ?? 0) * pOut +
     (usage.cache_creation_input_tokens ?? 0) * pCW +
     (usage.cache_read_input_tokens ?? 0) * pCR) / M
  )
}

// ── Single-pass JSONL scan → costs + project data ────────────────

interface CostEntry {
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUSD: number | null
}

// teamCosts: teamName → sessionId → CostEntry (deduplicated per message)
type RawTeamCosts  = Map<string, Map<string, CostEntry>>

interface SessionMeta {
  sessionId: string
  firstSeen: number     // epoch ms
  lastSeen: number
  linkedTeam?: string
  model: string
}

interface ProjectMeta {
  projectKey: string   // dir name
  cwd: string
  sessions: Map<string, SessionMeta>
  // per message-id dedup bucket: msgId → UsageRecord + model
  msgBucket: Map<string, { usage: UsageRecord; model: string; sessionId: string; ts: number }>
  linkedTeams: Set<string>
  lastActivity: number
}

interface ScanResult {
  // For existing cost map (teamName → sessionId → CostEntry)
  teamCosts: Map<string, Map<string, CostEntry>>
  // Per-project aggregated
  projects: Map<string, ProjectMeta>
}

function scanClaudeData(): ScanResult {
  const teamCosts: RawTeamCosts = new Map()
  const projects: Map<string, ProjectMeta> = new Map()

  if (!fs.existsSync(PROJECTS_DIR)) return { teamCosts, projects }

  for (const projDir of fs.readdirSync(PROJECTS_DIR)) {
    const projPath = path.join(PROJECTS_DIR, projDir)
    try {
      if (!fs.statSync(projPath).isDirectory()) continue
    } catch { continue }

    let projMeta: ProjectMeta | null = null

    for (const fname of fs.readdirSync(projPath)) {
      if (!fname.endsWith('.jsonl')) continue
      let lines: string[]
      try { lines = fs.readFileSync(path.join(projPath, fname), 'utf8').split('\n') }
      catch { continue }

      for (const line of lines) {
        if (!line.trim()) continue
        let rec: Record<string, unknown>
        try { rec = JSON.parse(line) } catch { continue }

        const recType   = rec.type as string | undefined
        const cwd       = rec.cwd as string | undefined
        const sessionId = rec.sessionId as string | undefined
        const teamName  = rec.teamName as string | undefined
        const tsRaw     = rec.timestamp as string | undefined
        const ts        = tsRaw ? new Date(tsRaw).getTime() : 0

        if (!cwd || !sessionId) continue

        // Initialise project meta on first cwd encounter
        if (!projMeta) {
          projMeta = {
            projectKey: projDir,
            cwd,
            sessions: new Map(),
            msgBucket: new Map(),
            linkedTeams: new Set(),
            lastActivity: 0,
          }
          projects.set(projDir, projMeta)
        }

        // Track session
        if (!projMeta.sessions.has(sessionId)) {
          projMeta.sessions.set(sessionId, {
            sessionId, firstSeen: ts, lastSeen: ts,
            linkedTeam: teamName, model: '',
          })
        }
        const sess = projMeta.sessions.get(sessionId)!
        if (ts > sess.lastSeen) sess.lastSeen = ts
        if (ts < sess.firstSeen) sess.firstSeen = ts
        if (teamName) { sess.linkedTeam = teamName; projMeta.linkedTeams.add(teamName) }
        if (ts > projMeta.lastActivity) projMeta.lastActivity = ts

        // Only process assistant messages with usage
        if (recType !== 'assistant') continue
        const msg   = rec.message as Record<string, unknown> | undefined
        if (!msg) continue
        const usage = msg.usage as UsageRecord | undefined
        const model = msg.model as string | undefined
        if (!usage || !model) continue
        sess.model = model

        // Deduplicate on message id: keep the record with the highest output_tokens
        const msgId = (msg.id as string | undefined) ?? `${sessionId}:${ts}`
        const existing = projMeta.msgBucket.get(msgId)
        if (!existing || (usage.output_tokens ?? 0) >= (existing.usage.output_tokens ?? 0)) {
          projMeta.msgBucket.set(msgId, { usage, model, sessionId, ts })
        }

        // Also track for team cost map (deduplicated per teamName:sessionId:msgId)
        if (teamName) {
          if (!teamCosts.has(teamName)) teamCosts.set(teamName, new Map())
          const tmap = teamCosts.get(teamName)!
          const key  = `${sessionId}:${msgId}`
          const texisting = tmap.get(key)
          if (!texisting || (usage.output_tokens ?? 0) >= (texisting.outputTokens ?? 0)) {
            tmap.set(key, {
              model,
              inputTokens:         usage.input_tokens ?? 0,
              outputTokens:        usage.output_tokens ?? 0,
              cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
              cacheReadTokens:     usage.cache_read_input_tokens ?? 0,
              costUSD:             calcCost(usage, model),
            })
          }
        }
      }
    }
  }

  return { teamCosts, projects }
}

// ── Serialize scan result into wire types ────────────────────────

interface SerializedCostEntry {
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUSD: number | null
}
type SerializedAgentCostMap = Record<string, SerializedCostEntry>
type SerializedCostMap      = Record<string, SerializedAgentCostMap>

function serializeCostMap(teamCosts: RawTeamCosts): SerializedCostMap {
  const result: SerializedCostMap = {}
  for (const [teamName, sessMap] of teamCosts) {
    // Aggregate all session entries per teamName into one (we don't have agentName here)
    // but keep sessionId as the key for fine-grained view
    const agentMap: SerializedAgentCostMap = {}
    for (const [key, entry] of sessMap) {
      const sessionId = key.split(':')[0]
      if (!agentMap[sessionId]) {
        agentMap[sessionId] = { model: entry.model, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, costUSD: null }
      }
      const dest = agentMap[sessionId]
      dest.inputTokens         += entry.inputTokens
      dest.outputTokens        += entry.outputTokens
      dest.cacheCreationTokens += entry.cacheCreationTokens
      dest.cacheReadTokens     += entry.cacheReadTokens
      if (entry.costUSD !== null) dest.costUSD = (dest.costUSD ?? 0) + entry.costUSD
      dest.model = entry.model
    }
    result[teamName] = agentMap
  }
  return result
}

export interface SerializedProjectSession {
  sessionId: string
  firstSeen: number
  lastSeen: number
  linkedTeam?: string
  model: string
}

export interface SerializedProjectData {
  projectKey: string
  cwd: string
  displayName: string
  sessions: SerializedProjectSession[]
  models: string[]
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheTokens: number
  costUSD: number | null
  lastActivity: number
  linkedTeams: string[]
  totalMessages: number
}

function serializeProjects(projects: Map<string, ProjectMeta>): SerializedProjectData[] {
  const result: SerializedProjectData[] = []

  for (const [, meta] of projects) {
    let totalIn = 0, totalOut = 0, totalCache = 0, totalCost: number | null = null

    for (const { usage, model } of meta.msgBucket.values()) {
      totalIn    += usage.input_tokens ?? 0
      totalOut   += usage.output_tokens ?? 0
      totalCache += (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)
      const c = calcCost(usage, model)
      if (c !== null) totalCost = (totalCost ?? 0) + c
    }

    const modelSet = new Set<string>()
    for (const s of meta.sessions.values()) { if (s.model) modelSet.add(s.model) }

    const sessions: SerializedProjectSession[] = [...meta.sessions.values()]
      .sort((a, b) => b.lastSeen - a.lastSeen)

    result.push({
      projectKey:        meta.projectKey,
      cwd:               meta.cwd,
      displayName:       path.basename(meta.cwd),
      sessions,
      models:            [...modelSet],
      totalInputTokens:  totalIn,
      totalOutputTokens: totalOut,
      totalCacheTokens:  totalCache,
      costUSD:           totalCost,
      lastActivity:      meta.lastActivity,
      linkedTeams:       [...meta.linkedTeams],
      totalMessages:     meta.msgBucket.size,
    })
  }

  return result.sort((a, b) => b.lastActivity - a.lastActivity)
}

// Cached scan (invalidated by watcher)
let scanCache: { costMap: SerializedCostMap; projects: SerializedProjectData[] } | null = null

function getScannedData() {
  if (scanCache) return scanCache
  const { teamCosts, projects } = scanClaudeData()
  scanCache = {
    costMap:  serializeCostMap(teamCosts),
    projects: serializeProjects(projects),
  }
  return scanCache
}

function invalidateScanCache() { scanCache = null }

// ── Filesystem watcher ───────────────────────────────────────────

function pushData() {
  if (!mainWindow) return
  try {
    const data = readTeamData()
    // Check for newly completed tasks and fire desktop notifications
    const newSnapshot: TaskData[] = data.map(d => ({
      teamName: d.teamName,
      tasks: (d.tasks as Array<{ id: string; status: string; subject: string; owner?: string }>),
    }))
    try {
      const { getNotificationPrefs } = require('./modules/notifications')
      const prefs = getNotificationPrefs ? getNotificationPrefs() : { taskCompleted: true, teamCreated: false, costThreshold: false, costThresholdAmount: 10 }
      checkTaskCompletions(prevTaskSnapshot, newSnapshot, prefs)
    } catch { /* notifications optional */ }
    prevTaskSnapshot = newSnapshot
    mainWindow.webContents.send('team-data', data)
  }
  catch (e) { console.error('pushData:', e) }
}

function pushScanned() {
  if (!mainWindow) return
  invalidateScanCache()
  try {
    const data = getScannedData()
    mainWindow.webContents.send('scanned-data', data)
  } catch (e) { console.error('pushScanned:', e) }
}

function startWatcher() {
  if (watcher) return
  const dirs = [TEAMS_DIR, TASKS_DIR, PROJECTS_DIR].filter(d => fs.existsSync(d))
  if (!dirs.length) return

  watcher = chokidar.watch(dirs, {
    ignoreInitial: true,
    ignored: /\.lock$/,
    depth: 4,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 150 },
  })

  let teamDebounce: ReturnType<typeof setTimeout> | null = null
  let scanDebounce: ReturnType<typeof setTimeout> | null = null

  watcher.on('all', (event, filePath) => {
    if (filePath.includes(path.sep + 'projects' + path.sep)) {
      if (scanDebounce) clearTimeout(scanDebounce)
      scanDebounce = setTimeout(pushScanned, 2000) // projects scan is heavier
    } else {
      if (teamDebounce) clearTimeout(teamDebounce)
      teamDebounce = setTimeout(pushData, 300)
    }
  })
}

// ── Management helpers ───────────────────────────────────────────

function rmrf(p: string) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }) }

function deleteTeam(teamName: string): { ok: boolean; error?: string } {
  try { rmrf(path.join(TEAMS_DIR, teamName)); rmrf(path.join(TASKS_DIR, teamName)); return { ok: true } }
  catch (e) { return { ok: false, error: String(e) } }
}

function archiveTeam(teamName: string): { ok: boolean; error?: string } {
  try {
    if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true })
    const src = path.join(TEAMS_DIR, teamName)
    if (fs.existsSync(src)) fs.renameSync(src, path.join(ARCHIVE_DIR, `${teamName}-${Date.now()}`))
    rmrf(path.join(TASKS_DIR, teamName))
    return { ok: true }
  } catch (e) { return { ok: false, error: String(e) } }
}

function clearTasks(teamName: string): { ok: boolean; error?: string } {
  try {
    const d = path.join(TASKS_DIR, teamName)
    if (fs.existsSync(d))
      fs.readdirSync(d).filter(f => f.endsWith('.json')).forEach(f => fs.unlinkSync(path.join(d, f)))
    return { ok: true }
  } catch (e) { return { ok: false, error: String(e) } }
}

// ── IPC ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('get-initial-data', () => readTeamData())
  ipcMain.handle('get-theme',        () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  ipcMain.handle('get-claude-dir',   () => CLAUDE_DIR)
  ipcMain.handle('get-costs',        () => getScannedData().costMap)
  ipcMain.handle('get-projects',     () => getScannedData().projects)
  ipcMain.handle('get-all-scanned',  () => getScannedData())

  ipcMain.on('start-watching', () => startWatcher())
  ipcMain.on('stop-watching',  () => { watcher?.close(); watcher = null })

  ipcMain.handle('delete-team', async (_e, teamName: string) => {
    const { response } = await dialog.showMessageBox(mainWindow!, {
      type: 'warning', title: 'Delete team', message: `Delete "${teamName}"?`,
      detail: 'Permanently removes the team config and all tasks.',
      buttons: ['Delete', 'Cancel'], defaultId: 1, cancelId: 1,
    })
    if (response !== 0) return { ok: false, cancelled: true }
    const r = deleteTeam(teamName); if (r.ok) pushData(); return r
  })

  ipcMain.handle('archive-team', async (_e, teamName: string) => {
    const { response } = await dialog.showMessageBox(mainWindow!, {
      type: 'question', title: 'Archive team', message: `Archive "${teamName}"?`,
      detail: `Moves to ~/.claude/teams-archive/ and clears tasks.`,
      buttons: ['Archive', 'Cancel'], defaultId: 0, cancelId: 1,
    })
    if (response !== 0) return { ok: false, cancelled: true }
    const r = archiveTeam(teamName); if (r.ok) pushData(); return r
  })

  ipcMain.handle('clear-tasks', async (_e, teamName: string) => {
    const { response } = await dialog.showMessageBox(mainWindow!, {
      type: 'warning', title: 'Clear tasks', message: `Clear all tasks for "${teamName}"?`,
      buttons: ['Clear', 'Cancel'], defaultId: 1, cancelId: 1,
    })
    if (response !== 0) return { ok: false, cancelled: true }
    const r = clearTasks(teamName); if (r.ok) pushData(); return r
  })

  ipcMain.handle('open-cwd',    (_e, cwd: string)      => shell.openPath(cwd))
  ipcMain.handle('copy-text',   (_e, text: string)     => { clipboard.writeText(text); return true })
  ipcMain.handle('reveal-team', (_e, teamName: string) => {
    const p = path.join(TEAMS_DIR, teamName)
    if (fs.existsSync(p)) shell.showItemInFolder(p)
    return true
  })

  // Module handlers
  registerContentHandlers(ipcMain, () => mainWindow)
  registerSettingsHandlers(ipcMain, () => mainWindow)
  registerAnalyticsHandlers(ipcMain)
  registerSystemHandlers(ipcMain, () => mainWindow)
  registerViewerHandlers(ipcMain)
  registerMetricsHandlers(ipcMain)
  registerNotificationHandlers(ipcMain)

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { watcher?.close(); if (process.platform !== 'darwin') app.quit() })
