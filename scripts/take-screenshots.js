#!/usr/bin/env node
/**
 * Screenshot automation script for Claude Lens.
 * Launches the built Electron app, navigates each view, and captures PNGs.
 *
 * Usage: npx electron --no-sandbox scripts/take-screenshots.js
 */

const { app, BrowserWindow, ipcMain, nativeTheme, shell, clipboard, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const ROOT = path.join(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')
const DIST_ELECTRON = path.join(ROOT, 'dist-electron')
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots')

// Register all IPC handlers exactly as the main app does
const { registerContentHandlers }     = require(path.join(DIST_ELECTRON, 'modules/content'))
const { registerSettingsHandlers }    = require(path.join(DIST_ELECTRON, 'modules/settings'))
const { registerAnalyticsHandlers }   = require(path.join(DIST_ELECTRON, 'modules/analytics'))
const { registerSystemHandlers }      = require(path.join(DIST_ELECTRON, 'modules/system'))
const { registerViewerHandlers }      = require(path.join(DIST_ELECTRON, 'modules/viewer'))
const { registerMetricsHandlers }     = require(path.join(DIST_ELECTRON, 'modules/metrics'))
const { registerNotificationHandlers } = require(path.join(DIST_ELECTRON, 'modules/notifications'))

// Replicate IPC handlers from main.ts ─────────────────────────────────────
const CLAUDE_DIR  = path.join(os.homedir(), '.claude')
const TEAMS_DIR   = path.join(CLAUDE_DIR, 'teams')
const TASKS_DIR   = path.join(CLAUDE_DIR, 'tasks')
const ARCHIVE_DIR = path.join(CLAUDE_DIR, 'teams-archive')

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

// Pricing / cost helpers
const MODEL_PRICING = {
  'claude-opus-4':    { input: 15,  output: 75,  cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-sonnet-4':  { input: 3,   output: 15,  cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-haiku-4':   { input: 0.8, output: 4,   cacheWrite: 1.00,  cacheRead: 0.08 },
  'claude-sonnet-3':  { input: 3,   output: 15,  cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-haiku-3':   { input: 0.8, output: 4,   cacheWrite: 1.00,  cacheRead: 0.08 },
  'claude-opus-3':    { input: 15,  output: 75,  cacheWrite: 18.75, cacheRead: 1.50 },
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

// Full port of scanClaudeData + serialize from main.ts ──────────────────────
function scanClaudeData() {
  const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')
  const teamCosts = new Map()   // teamName → Map<key, entry>
  const projects  = new Map()   // projDir  → ProjectMeta

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

        const recType   = rec.type
        const cwd       = rec.cwd
        const sessionId = rec.sessionId
        const teamName  = rec.teamName
        const tsRaw     = rec.timestamp
        const ts        = tsRaw ? new Date(tsRaw).getTime() : 0

        if (!cwd || !sessionId) continue

        if (!projMeta) {
          projMeta = { projectKey: projDir, cwd, sessions: new Map(), msgBucket: new Map(), linkedTeams: new Set(), lastActivity: 0 }
          projects.set(projDir, projMeta)
        }

        if (!projMeta.sessions.has(sessionId)) {
          projMeta.sessions.set(sessionId, { sessionId, firstSeen: ts, lastSeen: ts, linkedTeam: teamName, model: '' })
        }
        const sess = projMeta.sessions.get(sessionId)
        if (ts > sess.lastSeen)  sess.lastSeen  = ts
        if (ts < sess.firstSeen) sess.firstSeen = ts
        if (teamName) { sess.linkedTeam = teamName; projMeta.linkedTeams.add(teamName) }
        if (ts > projMeta.lastActivity) projMeta.lastActivity = ts

        if (recType !== 'assistant') continue
        const msg   = rec.message
        if (!msg) continue
        const usage = msg.usage
        const model = msg.model
        if (!usage || !model) continue
        sess.model = model

        const msgId    = msg.id ?? `${sessionId}:${ts}`
        const existing = projMeta.msgBucket.get(msgId)
        if (!existing || (usage.output_tokens ?? 0) >= (existing.usage.output_tokens ?? 0)) {
          projMeta.msgBucket.set(msgId, { usage, model, sessionId, ts })
        }

        if (teamName) {
          if (!teamCosts.has(teamName)) teamCosts.set(teamName, new Map())
          const tmap = teamCosts.get(teamName)
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

function serializeCostMap(teamCosts) {
  const result = {}
  for (const [teamName, sessMap] of teamCosts) {
    const agentMap = {}
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

function serializeProjects(projects) {
  const result = []
  for (const [, meta] of projects) {
    let totalIn = 0, totalOut = 0, totalCache = 0, totalCost = null
    for (const { usage, model } of meta.msgBucket.values()) {
      totalIn    += usage.input_tokens ?? 0
      totalOut   += usage.output_tokens ?? 0
      totalCache += (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)
      const c = calcCost(usage, model)
      if (c !== null && c > 0) totalCost = (totalCost ?? 0) + c
    }
    const modelSet = new Set()
    for (const s of meta.sessions.values()) { if (s.model) modelSet.add(s.model) }
    const sessions = [...meta.sessions.values()].sort((a, b) => b.lastSeen - a.lastSeen)
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

function getScannedData() {
  const { teamCosts, projects } = scanClaudeData()
  return {
    costMap:  serializeCostMap(teamCosts),
    projects: serializeProjects(projects),
  }
}

function buildCostMapForTeams(teams, costMap) {
  const teamCostMap = {}
  for (const { teamName, team } of teams) {
    if (!team.members) continue
    let teamTotal = 0
    for (const member of team.members) {
      const cwd = member.cwd
      if (!cwd) continue
      const projKey = cwd.replace(/^\//, '').replace(/\//g, '-')
      teamTotal += costMap[projKey] ?? 0
    }
    teamCostMap[teamName] = teamTotal
  }
  return teamCostMap
}

// ── Register core IPC handlers ──────────────────────────────────────────────
function registerCoreHandlers(win) {
  // Matches the exact handler names from electron/main.ts
  ipcMain.handle('get-initial-data', () => readTeamData())
  ipcMain.handle('get-claude-dir',   () => CLAUDE_DIR)
  ipcMain.handle('get-theme',        () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  ipcMain.handle('get-costs',        () => getScannedData().costMap)
  ipcMain.handle('get-projects',     () => getScannedData().projects)
  ipcMain.handle('get-all-scanned',  () => getScannedData())
  ipcMain.handle('delete-team', (_e, teamName) => {
    const teamPath = path.join(TEAMS_DIR, teamName)
    const taskPath = path.join(TASKS_DIR, teamName)
    fs.rmSync(teamPath, { recursive: true, force: true })
    fs.rmSync(taskPath, { recursive: true, force: true })
    return { ok: true }
  })
  ipcMain.handle('archive-team', (_e, teamName) => {
    const src = path.join(TEAMS_DIR, teamName)
    const dst = path.join(ARCHIVE_DIR, teamName)
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true })
    fs.renameSync(src, dst)
    return { ok: true }
  })
  ipcMain.handle('clear-tasks', (_e, teamName) => {
    const taskPath = path.join(TASKS_DIR, teamName)
    fs.rmSync(taskPath, { recursive: true, force: true })
    fs.mkdirSync(taskPath, { recursive: true })
    return { ok: true }
  })
  ipcMain.handle('open-cwd', (_e, cwd) => { shell.openPath(cwd); return { ok: true } })
  ipcMain.handle('reveal-team', (_e, teamName) => {
    shell.showItemInFolder(path.join(TEAMS_DIR, teamName))
    return { ok: true }
  })
  ipcMain.handle('copy-text', (_e, text) => { clipboard.writeText(text); return { ok: true } })
  ipcMain.handle('show-confirm-dialog', (_e, opts) => {
    return dialog.showMessageBox(win, { type: 'question', buttons: ['Confirm', 'Cancel'], ...opts })
  })
  ipcMain.handle('get-notifications-settings', () => ({ enabled: false, taskComplete: false, teamCreate: false, costThreshold: null, budgets: {} }))
  ipcMain.handle('set-notifications-settings', () => ({ ok: true }))
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function capture(win, filename) {
  await sleep(100)
  const image = await win.webContents.capturePage()
  const outPath = path.join(SCREENSHOTS_DIR, filename)
  fs.writeFileSync(outPath, image.toPNG())
  console.log(`  ✓ ${filename}`)
}

async function clickNavByText(win, text) {
  await win.webContents.executeJavaScript(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim().startsWith(${JSON.stringify(text)}));
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `)
}

async function clickNavByTitle(win, title) {
  await win.webContents.executeJavaScript(`
    (function() {
      const btn = document.querySelector('button[title=${JSON.stringify(title)}]');
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `)
}

async function clickTabByText(win, text) {
  await win.webContents.executeJavaScript(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim() === ${JSON.stringify(text)});
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `)
}

async function openCommandPalette(win) {
  await win.webContents.executeJavaScript(`
    (function() {
      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
      document.dispatchEvent(event);
    })()
  `)
}

// ── Main ─────────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  console.log(`\nClaude Lens Screenshot Tool`)
  console.log(`Output: ${SCREENSHOTS_DIR}\n`)

  // Register all IPC handlers
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(DIST_ELECTRON, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Override theme to dark for consistent screenshots
  nativeTheme.themeSource = 'dark'

  registerCoreHandlers(win)
  registerContentHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerAnalyticsHandlers(ipcMain)
  registerSystemHandlers(ipcMain, () => win)
  registerViewerHandlers(ipcMain)
  registerMetricsHandlers(ipcMain)
  registerNotificationHandlers(ipcMain)

  await win.loadFile(path.join(DIST_DIR, 'index.html'))
  win.show()

  // Wait for app to fully load (data fetching, React render)
  await sleep(5000)

  // Inject blur style for all elements marked as sensitive
  await win.webContents.executeJavaScript(`
    (function() {
      const style = document.createElement('style');
      style.id = 'sensitive-blur';
      style.textContent = '[data-sensitive] { filter: blur(8px) !important; user-select: none !important; }';
      document.head.appendChild(style);
    })()
  `)

  console.log('Taking screenshots...\n')

  // ── 1. Card View (default: Teams + Cards) ──────────────────────────────────
  await clickNavByText(win, 'Teams')
  await sleep(800)
  await clickNavByText(win, 'Cards')
  await sleep(1200)
  await capture(win, 'card-view.png')

  // ── 2. Graph View ──────────────────────────────────────────────────────────
  await clickNavByText(win, 'Graph')
  await sleep(1500)
  await capture(win, 'graph-view.png')

  // ── 3. Split View ──────────────────────────────────────────────────────────
  await clickNavByText(win, 'Split')
  await sleep(2000)
  // Click the first team node in the ReactFlow graph to open the detail panel
  await win.webContents.executeJavaScript(`
    (function() {
      const teamNode = document.querySelector('.react-flow__node-team');
      if (teamNode) { teamNode.click(); return true; }
      return false;
    })()
  `)
  await sleep(1000)
  await capture(win, 'split-view.png')

  // ── 4. Analytics Overview ──────────────────────────────────────────────────
  await clickNavByText(win, 'Analytics')
  await sleep(2500)  // let chart data load
  await clickTabByText(win, 'Overview')
  await sleep(1000)
  await capture(win, 'analytics-overview.png')

  // ── 5. Activity Heatmap ────────────────────────────────────────────────────
  await clickTabByText(win, 'Heatmap')
  await sleep(1200)
  await capture(win, 'activity-heatmap.png')

  // ── 6. Model Comparison ────────────────────────────────────────────────────
  await clickTabByText(win, 'Models')
  await sleep(1000)
  await capture(win, 'analytics-models.png')

  // ── 7. Activity Feed tab ──────────────────────────────────────────────────
  await clickTabByText(win, 'Activity Feed')
  await sleep(1000)
  await capture(win, 'analytics-activity-feed.png')

  // ── 8. Conversations ───────────────────────────────────────────────────────
  await clickNavByText(win, 'Conversations')
  await sleep(2000)
  // Click the first project row to expand it
  await win.webContents.executeJavaScript(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      // The first project row button has a ChevronRight icon
      const projectBtn = btns.find(b => b.querySelector('svg') && b.className.includes('text-left'));
      if (projectBtn) { projectBtn.click(); return 'clicked project'; }
      return 'no project found';
    })()
  `)
  await sleep(1000)
  // Click the first session button (appears after expansion)
  await win.webContents.executeJavaScript(`
    (function() {
      // After expansion, session rows appear indented. Find a button with font-mono text (session ID pattern)
      const allBtns = Array.from(document.querySelectorAll('button'));
      // Session buttons contain a span with class font-mono and text starting with "…"
      const sessionBtn = allBtns.find(b => {
        const mono = b.querySelector('.font-mono');
        return mono && mono.textContent.startsWith('…');
      });
      if (sessionBtn) { sessionBtn.click(); return 'clicked: ' + sessionBtn.textContent.trim().slice(0,20); }
      return 'no session btn found, total btns: ' + allBtns.length;
    })()
  `)
  await sleep(3000) // wait for conversation to load
  await capture(win, 'conversation-browser.png')

  // ── 9. Search ─────────────────────────────────────────────────────────────
  await clickNavByText(win, 'Search')
  await sleep(800)
  // Type a search query
  await win.webContents.executeJavaScript(`
    (function() {
      const input = document.querySelector('input[type="search"], input[placeholder*="earch"], input[placeholder*="query"]');
      if (input) {
        input.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, 'claude');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `)
  await sleep(1500)
  await capture(win, 'search-view.png')

  // ── 10. Content View ──────────────────────────────────────────────────────
  await clickNavByText(win, 'Content')
  await sleep(1000)
  await capture(win, 'content-view.png')

  // ── 11. Projects View ─────────────────────────────────────────────────────
  await clickNavByText(win, 'Projects')
  await sleep(1500)
  await capture(win, 'projects-view.png')

  // ── 12. System View – Processes tab ──────────────────────────────────────
  await clickNavByTitle(win, 'System')
  await sleep(1200)
  await capture(win, 'system-view.png')

  // ── 12b. System View – Auth tab ───────────────────────────────────────────
  await clickTabByText(win, 'Auth')
  await sleep(1200)
  await capture(win, 'system-auth.png')

  // ── 13. Settings – General tab (default) ──────────────────────────────────
  await clickNavByTitle(win, 'Settings')
  await sleep(1000)
  await capture(win, 'settings-general.png')

  // ── 13b. Settings – Hooks tab ─────────────────────────────────────────────
  await clickTabByText(win, 'Hooks')
  await sleep(800)
  await capture(win, 'settings-hooks.png')

  // ── 13c. Settings – MCP Servers tab ───────────────────────────────────────
  await clickTabByText(win, 'MCP Servers')
  await sleep(800)
  await capture(win, 'settings-mcp.png')

  // ── 13d. Settings – Notifications tab ────────────────────────────────────
  await clickTabByText(win, 'Notifications')
  await sleep(800)
  await capture(win, 'settings-notifications.png')

  // ── 13e. Settings – Templates tab ─────────────────────────────────────────
  await clickTabByText(win, 'Templates')
  await sleep(800)
  await capture(win, 'settings-templates.png')

  // ── 13f. Settings – Profiles tab ──────────────────────────────────────────
  await clickTabByText(win, 'Profiles')
  await sleep(800)
  await capture(win, 'settings-profiles.png')

  // ── 14. Command Palette ───────────────────────────────────────────────────
  // Go back to Teams first
  await clickNavByText(win, 'Teams')
  await sleep(800)
  await openCommandPalette(win)
  await sleep(800)
  await capture(win, 'command-palette.png')

  // ── 15. Graph View (light mode) ───────────────────────────────────────────
  nativeTheme.themeSource = 'light'
  await win.webContents.executeJavaScript(`
    (function() {
      // Dismiss palette if open
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    })()
  `)
  await clickNavByText(win, 'Graph')
  await sleep(1500)
  await capture(win, 'graph-view-light.png')

  // Restore dark
  nativeTheme.themeSource = 'dark'
  await clickNavByText(win, 'Cards')
  await sleep(1000)
  await capture(win, 'card-view-dark.png')

  console.log(`\nDone! ${fs.readdirSync(SCREENSHOTS_DIR).length} screenshots saved to:\n  ${SCREENSHOTS_DIR}\n`)
  app.quit()
})

app.on('window-all-closed', () => app.quit())
