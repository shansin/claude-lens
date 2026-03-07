#!/usr/bin/env node
/**
 * Demo mode for Claude Lens.
 * Launches the production build normally for interactive use,
 * but mumbles (replaces) sensitive text with deterministic fake names
 * so the UI looks real and readable without exposing private data.
 *
 * Usage: npm run demo
 */

const { app, BrowserWindow, ipcMain, nativeTheme, shell, clipboard, dialog, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const chokidar = require('chokidar')

const ROOT          = path.join(__dirname, '..')
const DIST_DIR      = path.join(ROOT, 'dist')
const DIST_ELECTRON = path.join(ROOT, 'dist-electron')

// ── IPC modules ──────────────────────────────────────────────────────────────
const { registerContentHandlers }      = require(path.join(DIST_ELECTRON, 'modules/content'))
const { registerSettingsHandlers }     = require(path.join(DIST_ELECTRON, 'modules/settings'))
const { registerAnalyticsHandlers }    = require(path.join(DIST_ELECTRON, 'modules/analytics'))
const { registerSystemHandlers }       = require(path.join(DIST_ELECTRON, 'modules/system'))
const { registerViewerHandlers }       = require(path.join(DIST_ELECTRON, 'modules/viewer'))
const { registerMetricsHandlers }      = require(path.join(DIST_ELECTRON, 'modules/metrics'))
const { registerNotificationHandlers, checkTaskCompletions } = require(path.join(DIST_ELECTRON, 'modules/notifications'))

// ── Data helpers (mirrors main.ts) ───────────────────────────────────────────
const CLAUDE_DIR  = path.join(os.homedir(), '.claude')
const TEAMS_DIR   = path.join(CLAUDE_DIR, 'teams')
const TASKS_DIR   = path.join(CLAUDE_DIR, 'tasks')
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')
const ARCHIVE_DIR = path.join(CLAUDE_DIR, 'teams-archive')

let mainWindow = null
let watcher = null
let prevTaskSnapshot = []

function readTeamTasks(teamName) {
  const taskDir = path.join(TASKS_DIR, teamName)
  if (!fs.existsSync(taskDir)) return []
  return fs.readdirSync(taskDir)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(taskDir, f), 'utf8')) } catch { return null } })
    .filter(Boolean)
    .sort((a, b) => Number(a.id) - Number(b.id))
}

function readTeamData() {
  if (!fs.existsSync(TEAMS_DIR)) return []
  const result = []
  for (const d of fs.readdirSync(TEAMS_DIR)) {
    try {
      const cfgPath = path.join(TEAMS_DIR, d, 'config.json')
      if (!fs.existsSync(cfgPath)) continue
      const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
      result.push({ team: config, tasks: readTeamTasks(d), teamName: d })
    } catch { /* skip */ }
  }
  return result.sort((a, b) => (b.team.createdAt ?? 0) - (a.team.createdAt ?? 0))
}

const MODEL_PRICING = {
  'claude-opus-4':   { input: 15,  output: 75,  cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-sonnet-4': { input: 3,   output: 15,  cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-haiku-4':  { input: 0.8, output: 4,   cacheWrite: 1.00,  cacheRead: 0.08 },
  'claude-sonnet-3': { input: 3,   output: 15,  cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-haiku-3':  { input: 0.8, output: 4,   cacheWrite: 1.00,  cacheRead: 0.08 },
  'claude-opus-3':   { input: 15,  output: 75,  cacheWrite: 18.75, cacheRead: 1.50 },
}
function getPrice(model) {
  for (const [k, v] of Object.entries(MODEL_PRICING)) { if (model?.includes(k)) return v }
  return null
}
function calcCost(usage, model) {
  const p = getPrice(model)
  if (!p) return 0
  return (
    (usage.input_tokens  ?? 0) / 1e6 * p.input +
    (usage.output_tokens ?? 0) / 1e6 * p.output +
    (usage.cache_creation_input_tokens ?? 0) / 1e6 * p.cacheWrite +
    (usage.cache_read_input_tokens     ?? 0) / 1e6 * p.cacheRead
  )
}

function scanClaudeData() {
  const teamCosts = new Map()
  const projects  = new Map()
  if (!fs.existsSync(PROJECTS_DIR)) return { teamCosts, projects }
  for (const projDir of fs.readdirSync(PROJECTS_DIR)) {
    const projPath = path.join(PROJECTS_DIR, projDir)
    try { if (!fs.statSync(projPath).isDirectory()) continue } catch { continue }
    let projMeta = null
    for (const fname of fs.readdirSync(projPath)) {
      if (!fname.endsWith('.jsonl')) continue
      let lines
      try { lines = fs.readFileSync(path.join(projPath, fname), 'utf8').split('\n') }
      catch { continue }
      for (const line of lines) {
        if (!line.trim()) continue
        let rec
        try { rec = JSON.parse(line) } catch { continue }
        const recType = rec.type, cwd = rec.cwd, sessionId = rec.sessionId
        const teamName = rec.teamName, tsRaw = rec.timestamp
        const ts = tsRaw ? new Date(tsRaw).getTime() : 0
        if (!cwd || !sessionId) continue
        if (!projMeta) {
          projMeta = { projectKey: projDir, cwd, sessions: new Map(), msgBucket: new Map(), linkedTeams: new Set(), lastActivity: 0 }
          projects.set(projDir, projMeta)
        }
        if (!projMeta.sessions.has(sessionId))
          projMeta.sessions.set(sessionId, { sessionId, firstSeen: ts, lastSeen: ts, linkedTeam: teamName, model: '' })
        const sess = projMeta.sessions.get(sessionId)
        if (ts > sess.lastSeen)  sess.lastSeen  = ts
        if (ts < sess.firstSeen) sess.firstSeen = ts
        if (teamName) { sess.linkedTeam = teamName; projMeta.linkedTeams.add(teamName) }
        if (ts > projMeta.lastActivity) projMeta.lastActivity = ts
        if (recType !== 'assistant') continue
        const msg = rec.message
        if (!msg) continue
        const usage = msg.usage, model = msg.model
        if (!usage || !model) continue
        sess.model = model
        const msgId = msg.id ?? `${sessionId}:${ts}`
        const existing = projMeta.msgBucket.get(msgId)
        if (!existing || (usage.output_tokens ?? 0) >= (existing.usage.output_tokens ?? 0))
          projMeta.msgBucket.set(msgId, { usage, model, sessionId, ts })
        if (teamName) {
          if (!teamCosts.has(teamName)) teamCosts.set(teamName, new Map())
          const tmap = teamCosts.get(teamName)
          const key  = `${sessionId}:${msgId}`
          const tex  = tmap.get(key)
          if (!tex || (usage.output_tokens ?? 0) >= (tex.outputTokens ?? 0))
            tmap.set(key, { model, inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0,
              cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
              cacheReadTokens: usage.cache_read_input_tokens ?? 0, costUSD: calcCost(usage, model) })
        }
      }
    }
  }
  return { teamCosts, projects }
}

function serializeCostMap(teamCosts) {
  const result = {}
  for (const [teamName, sessMap] of teamCosts) {
    const agentMap = {}
    for (const [key, entry] of sessMap) {
      const sessionId = key.split(':')[0]
      if (!agentMap[sessionId])
        agentMap[sessionId] = { model: entry.model, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, costUSD: null }
      const dest = agentMap[sessionId]
      dest.inputTokens += entry.inputTokens; dest.outputTokens += entry.outputTokens
      dest.cacheCreationTokens += entry.cacheCreationTokens; dest.cacheReadTokens += entry.cacheReadTokens
      if (entry.costUSD !== null) dest.costUSD = (dest.costUSD ?? 0) + entry.costUSD
      dest.model = entry.model
    }
    result[teamName] = agentMap
  }
  return result
}

function serializeProjects(projects) {
  const result = []
  for (const [, meta] of projects) {
    let totalIn = 0, totalOut = 0, totalCache = 0, totalCost = null
    for (const { usage, model } of meta.msgBucket.values()) {
      totalIn  += usage.input_tokens ?? 0; totalOut += usage.output_tokens ?? 0
      totalCache += (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)
      const c = calcCost(usage, model)
      if (c !== null && c > 0) totalCost = (totalCost ?? 0) + c
    }
    const modelSet = new Set()
    for (const s of meta.sessions.values()) { if (s.model) modelSet.add(s.model) }
    const sessions = [...meta.sessions.values()].sort((a, b) => b.lastSeen - a.lastSeen)
    result.push({
      projectKey: meta.projectKey, cwd: meta.cwd, displayName: path.basename(meta.cwd),
      sessions, models: [...modelSet], totalInputTokens: totalIn, totalOutputTokens: totalOut,
      totalCacheTokens: totalCache, costUSD: totalCost, lastActivity: meta.lastActivity,
      linkedTeams: [...meta.linkedTeams], totalMessages: meta.msgBucket.size,
    })
  }
  return result.sort((a, b) => b.lastActivity - a.lastActivity)
}

let scanCache = null
function getScannedData() {
  if (scanCache) return scanCache
  const { teamCosts, projects } = scanClaudeData()
  scanCache = { costMap: serializeCostMap(teamCosts), projects: serializeProjects(projects) }
  return scanCache
}
function invalidateScanCache() { scanCache = null }

// ── Filesystem watcher ───────────────────────────────────────────────────────
function pushData() {
  if (!mainWindow) return
  try {
    const data = readTeamData()
    const newSnapshot = data.map(d => ({ teamName: d.teamName, tasks: d.tasks }))
    try {
      const { getNotificationPrefs } = require(path.join(DIST_ELECTRON, 'modules/notifications'))
      const prefs = getNotificationPrefs ? getNotificationPrefs() : { taskCompleted: true, teamCreated: false, costThreshold: false, costThresholdAmount: 10 }
      checkTaskCompletions(prevTaskSnapshot, newSnapshot, prefs)
    } catch { /* notifications optional */ }
    prevTaskSnapshot = newSnapshot
    mainWindow.webContents.send('team-data', data)
  } catch (e) { console.error('pushData:', e) }
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
    ignoreInitial: true, ignored: /\.lock$/, depth: 4,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 150 },
  })
  let teamDebounce = null, scanDebounce = null
  watcher.on('all', (_event, filePath) => {
    if (filePath.includes(path.sep + 'projects' + path.sep)) {
      if (scanDebounce) clearTimeout(scanDebounce)
      scanDebounce = setTimeout(pushScanned, 2000)
    } else {
      if (teamDebounce) clearTimeout(teamDebounce)
      teamDebounce = setTimeout(pushData, 300)
    }
  })
}

// ── Mumble injection ─────────────────────────────────────────────────────────
const MUMBLE_SCRIPT = `
(function() {
  const ADJ = ['amber','azure','bold','bright','calm','cobalt','crisp','dark','dawn','deep',
               'echo','ember','fern','gold','grey','ice','jade','keen','lime','lunar',
               'mint','nova','oak','pine','polar','quick','red','sage','silver','steel',
               'swift','teal','ultra','vast','warm','wild','zinc'];
  const NOUN = ['arc','base','bay','beam','bolt','bridge','byte','cave','core','crest',
                'dash','delta','depot','dome','drop','edge','field','flow','flux','forge',
                'gate','gem','grid','grove','hub','isle','key','lab','lane','link',
                'loft','mesh','mine','node','nook','orb','peak','pipe','pod','port',
                'pulse','reef','ring','root','shelf','slab','slot','spark','stack','trail',
                'vault','vent','wave','well','yard','zone'];
  const LOREM = ['implement','refactor','update','configure','optimize','validate',
                 'integrate','deploy','scaffold','document','migrate','rebuild','review',
                 'extend','module','service','component','pipeline','interface','handler',
                 'router','schema','repository','middleware','endpoint','utility','fixture'];

  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h ^ str.charCodeAt(i)) >>> 0;
    return h;
  }

  const nameCache = new Map();

  function fakeIdent(original) {
    const key = original.trim();
    if (!key) return original;
    if (nameCache.has(key)) return nameCache.get(key);
    const h = hash(key);
    const sep = original.includes('_') ? '_' : '-';
    const result = ADJ[h % ADJ.length] + sep + NOUN[(h >>> 6) % NOUN.length];
    nameCache.set(key, result);
    return result;
  }

  function fakePath(original) {
    const parts = original.split('/');
    return parts.map((seg, i) => (i < 3 || !seg) ? seg : fakeIdent(seg)).join('/');
  }

  function fakeLong(original) {
    const wc = Math.max(1, original.trim().split(/\\\\s+/).length);
    const h = hash(original);
    const words = Array.from({ length: Math.min(wc, 10) }, (_, i) => LOREM[(h + i * 7) % LOREM.length]);
    const s = words.join(' ');
    return s[0].toUpperCase() + s.slice(1);
  }

  function mumble(text) {
    const t = text.trim();
    if (!t) return text;
    if (/^\\\\u2026?[a-f0-9-]{8,}$/.test(t)) {
      const pre = t.startsWith('\\\\u2026') ? '\\\\u2026' : '';
      return pre + '1a2b3c4d5e6f7890abcdef'.slice(0, t.replace('\\\\u2026','').length);
    }
    if (t.startsWith('\\\\u2192 ')) return '\\\\u2192 ' + fakeIdent(t.slice(2));
    if (/^[~/]/.test(t)) return fakePath(t);
    if (!t.includes(' ')) return fakeIdent(t);
    if (t.split(/\\\\s+/).length <= 2) return fakeIdent(t);
    return fakeLong(t);
  }

  function mumbleElement(el) {
    if (el.dataset.mumbled) return;
    el.dataset.mumbled = '1';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(n => { if (n.textContent.trim()) n.textContent = mumble(n.textContent); });
  }

  document.querySelectorAll('[data-sensitive]').forEach(mumbleElement);

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.hasAttribute('data-sensitive')) mumbleElement(node);
        node.querySelectorAll('[data-sensitive]').forEach(mumbleElement);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})()
`

// ── Main ─────────────────────────────────────────────────────────────────────
function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }) }

app.whenReady().then(async () => {
  console.log('\n🔒 Claude Lens – Demo Mode (sensitive data mumbled)\n')

  const iconPath = path.join(ROOT, 'build/icon.png')
  const appIcon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    frame: process.platform !== 'darwin',
    autoHideMenuBar: true,
    icon: appIcon,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#f8fafc',
    webPreferences: {
      preload: path.join(DIST_ELECTRON, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.setIcon(appIcon)
  nativeTheme.themeSource = 'dark'

  // ── Register all IPC handlers (same as main.ts) ──────────────────────────
  ipcMain.handle('get-initial-data', () => readTeamData())
  ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  ipcMain.handle('get-claude-dir', () => CLAUDE_DIR)
  ipcMain.handle('get-costs', () => getScannedData().costMap)
  ipcMain.handle('get-projects', () => getScannedData().projects)
  ipcMain.handle('get-all-scanned', () => getScannedData())

  ipcMain.on('start-watching', () => startWatcher())
  ipcMain.on('stop-watching', () => { if (watcher) { watcher.close(); watcher = null } })

  ipcMain.handle('delete-team', async (_e, teamName) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning', title: 'Delete team', message: `Delete "${teamName}"?`,
      detail: 'Permanently removes the team config and all tasks.',
      buttons: ['Delete', 'Cancel'], defaultId: 1, cancelId: 1,
    })
    if (response !== 0) return { ok: false, cancelled: true }
    try { rmrf(path.join(TEAMS_DIR, teamName)); rmrf(path.join(TASKS_DIR, teamName)); pushData(); return { ok: true } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('archive-team', async (_e, teamName) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question', title: 'Archive team', message: `Archive "${teamName}"?`,
      detail: 'Moves to ~/.claude/teams-archive/ and clears tasks.',
      buttons: ['Archive', 'Cancel'], defaultId: 0, cancelId: 1,
    })
    if (response !== 0) return { ok: false, cancelled: true }
    try {
      if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true })
      const src = path.join(TEAMS_DIR, teamName)
      if (fs.existsSync(src)) fs.renameSync(src, path.join(ARCHIVE_DIR, `${teamName}-${Date.now()}`))
      rmrf(path.join(TASKS_DIR, teamName))
      pushData()
      return { ok: true }
    } catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('clear-tasks', async (_e, teamName) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning', title: 'Clear tasks', message: `Clear all tasks for "${teamName}"?`,
      buttons: ['Clear', 'Cancel'], defaultId: 1, cancelId: 1,
    })
    if (response !== 0) return { ok: false, cancelled: true }
    try {
      const d = path.join(TASKS_DIR, teamName)
      if (fs.existsSync(d)) fs.readdirSync(d).filter(f => f.endsWith('.json')).forEach(f => fs.unlinkSync(path.join(d, f)))
      pushData()
      return { ok: true }
    } catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('open-cwd', (_e, cwd) => shell.openPath(cwd))
  ipcMain.handle('copy-text', (_e, text) => { clipboard.writeText(text); return true })
  ipcMain.handle('reveal-team', (_e, teamName) => {
    const p = path.join(TEAMS_DIR, teamName)
    if (fs.existsSync(p)) shell.showItemInFolder(p)
    return true
  })

  ipcMain.handle('create-team', async (_e, teamName, description) => {
    try {
      const teamDir = path.join(TEAMS_DIR, teamName)
      if (fs.existsSync(teamDir)) return { ok: false, error: `Team "${teamName}" already exists` }
      fs.mkdirSync(teamDir, { recursive: true })
      const config = { name: teamName, description: description || '', createdAt: Date.now(), leadAgentId: '', leadSessionId: '', members: [] }
      fs.writeFileSync(path.join(teamDir, 'config.json'), JSON.stringify(config, null, 2), 'utf8')
      pushData()
      return { ok: true }
    } catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('export-session', async (_e, markdown, suggestedName) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Conversation',
      defaultPath: path.join(os.homedir(), 'Desktop', suggestedName),
      filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'All Files', extensions: ['*'] }],
    })
    if (canceled || !filePath) return { ok: false, cancelled: true }
    try { fs.writeFileSync(filePath, markdown, 'utf8'); return { ok: true, path: filePath } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('show-confirm-dialog', (_e, opts) =>
    dialog.showMessageBox(mainWindow, { type: 'question', buttons: ['Confirm', 'Cancel'], ...opts }))
  ipcMain.handle('get-notifications-settings', () => ({ enabled: false, taskComplete: false, teamCreate: false, costThreshold: null, budgets: {} }))
  ipcMain.handle('set-notifications-settings', () => ({ ok: true }))

  registerContentHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerAnalyticsHandlers(ipcMain)
  registerSystemHandlers(ipcMain, () => mainWindow)
  registerViewerHandlers(ipcMain)
  registerMetricsHandlers(ipcMain)
  registerNotificationHandlers(ipcMain)

  // ── Load app ─────────────────────────────────────────────────────────────
  await mainWindow.loadFile(path.join(DIST_DIR, 'index.html'))
  mainWindow.show()

  // Wait for React to render, then inject mumble script
  mainWindow.webContents.on('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 2000))
    await mainWindow.webContents.executeJavaScript(MUMBLE_SCRIPT)
  })
  // Also inject immediately for the initial load
  await new Promise(r => setTimeout(r, 3000))
  await mainWindow.webContents.executeJavaScript(MUMBLE_SCRIPT)

  mainWindow.on('closed', () => { mainWindow = null })
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  })

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) app.whenReady() })
})

app.on('window-all-closed', () => {
  if (watcher) { watcher.close(); watcher = null }
  if (process.platform !== 'darwin') app.quit()
})
