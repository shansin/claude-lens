/**
 * Settings module – IPC handlers for ~/.claude/settings.json
 *
 * Handlers registered:
 *   'get-settings'       → Record<string, unknown>
 *   'save-settings'      → { ok: boolean; error?: string }
 *   'get-settings-path'  → string
 *   'add-env-var'        → { ok: boolean; error?: string }
 *   'delete-env-var'     → { ok: boolean; error?: string }
 *   'add-hook'           → { ok: boolean; error?: string }
 *   'delete-hook'        → { ok: boolean; error?: string }
 *   'add-mcp-server'     → { ok: boolean; error?: string }
 *   'delete-mcp-server'  → { ok: boolean; error?: string }
 *   'set-effort-level'   → { ok: boolean; error?: string }
 *   'set-permissions'    → { ok: boolean; error?: string }
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import type { IpcMain, BrowserWindow } from 'electron'
import { dialog } from 'electron'

const SETTINGS_PATH   = path.join(os.homedir(), '.claude', 'settings.json')
const PROFILES_DIR    = path.join(os.homedir(), '.claude', 'settings-profiles')
const TEMPLATES_DIR   = path.join(os.homedir(), '.claude', 'team-templates')
const TEAMS_DIR       = path.join(os.homedir(), '.claude', 'teams')

// ── Helpers ─────────────────────────────────────────────────────

function readSettings(): Record<string, unknown> {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return {}
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeSettings(settings: Record<string, unknown>): void {
  const dir = path.dirname(SETTINGS_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
}

// ── Register ────────────────────────────────────────────────────

export function registerSettingsHandlers(
  ipcMain: IpcMain,
  mainWindow: () => BrowserWindow | null,
) {
  ipcMain.handle('get-settings', () => {
    return readSettings()
  })

  ipcMain.handle('get-settings-path', () => {
    return SETTINGS_PATH
  })

  ipcMain.handle('save-settings', async (_e, settings: Record<string, unknown>) => {
    try {
      const win = mainWindow()
      if (win) {
        const { response } = await dialog.showMessageBox(win, {
          type: 'question',
          buttons: ['Save', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
          title: 'Save Settings',
          message: 'Overwrite ~/.claude/settings.json with new settings?',
        })
        if (response !== 0) return { ok: false, cancelled: true }
      }
      writeSettings(settings)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('add-env-var', (_e, key: string, value: string) => {
    try {
      const s = readSettings()
      if (!s.env || typeof s.env !== 'object') s.env = {}
      ;(s.env as Record<string, string>)[key] = value
      writeSettings(s)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('delete-env-var', (_e, key: string) => {
    try {
      const s = readSettings()
      if (s.env && typeof s.env === 'object') {
        delete (s.env as Record<string, string>)[key]
      }
      writeSettings(s)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('add-hook', (_e, event: string, hook: { type: string; command: string; matcher?: string }) => {
    try {
      const s = readSettings()
      if (!s._hooks || typeof s._hooks !== 'object') s._hooks = {}
      const hooks = s._hooks as Record<string, unknown[]>
      if (!Array.isArray(hooks[event])) hooks[event] = []
      hooks[event].push(hook)
      writeSettings(s)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('delete-hook', (_e, event: string, index: number) => {
    try {
      const s = readSettings()
      const hooks = s._hooks as Record<string, unknown[]> | undefined
      if (hooks && Array.isArray(hooks[event])) {
        hooks[event].splice(index, 1)
        if (hooks[event].length === 0) delete hooks[event]
      }
      writeSettings(s)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('add-mcp-server', (_e, name: string, config: { command: string; args?: string[]; env?: Record<string, string> }) => {
    try {
      const s = readSettings()
      if (!s.mcpServers || typeof s.mcpServers !== 'object') s.mcpServers = {}
      ;(s.mcpServers as Record<string, unknown>)[name] = config
      writeSettings(s)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('delete-mcp-server', async (_e, name: string) => {
    try {
      const win = mainWindow()
      if (win) {
        const { response } = await dialog.showMessageBox(win, {
          type: 'warning',
          buttons: ['Delete', 'Cancel'],
          defaultId: 1,
          cancelId: 1,
          title: 'Delete MCP Server',
          message: `Remove MCP server "${name}" from settings?`,
        })
        if (response !== 0) return { ok: false, cancelled: true }
      }
      const s = readSettings()
      if (s.mcpServers && typeof s.mcpServers === 'object') {
        delete (s.mcpServers as Record<string, unknown>)[name]
      }
      writeSettings(s)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('set-effort-level', (_e, level: 'low' | 'medium' | 'high') => {
    try {
      const s = readSettings()
      s.effortLevel = level
      writeSettings(s)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('set-permissions', (_e, mode: string) => {
    try {
      const s = readSettings()
      if (!s.permissions || typeof s.permissions !== 'object') s.permissions = {}
      ;(s.permissions as Record<string, string>).defaultMode = mode
      writeSettings(s)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  // ── Settings profiles ────────────────────────────────────────────

  ipcMain.handle('get-settings-profiles', () => {
    try {
      if (!fs.existsSync(PROFILES_DIR)) return []
      const files = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'))
      return files.map(f => {
        const fp = path.join(PROFILES_DIR, f)
        let createdAt = 0
        let preview = ''
        try {
          const stat = fs.statSync(fp)
          createdAt = stat.mtimeMs
          const raw = fs.readFileSync(fp, 'utf-8')
          preview = raw.slice(0, 80)
        } catch { /* skip */ }
        return { name: f.replace(/\.json$/, ''), createdAt, preview }
      }).sort((a, b) => b.createdAt - a.createdAt)
    } catch (err: unknown) {
      return []
    }
  })

  ipcMain.handle('save-settings-profile', (_e, name: string) => {
    try {
      if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true })
      const current = readSettings()
      const dest = path.join(PROFILES_DIR, `${name}.json`)
      fs.writeFileSync(dest, JSON.stringify(current, null, 2), 'utf-8')
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('load-settings-profile', (_e, name: string) => {
    try {
      const src = path.join(PROFILES_DIR, `${name}.json`)
      if (!fs.existsSync(src)) return { ok: false, error: 'Profile not found' }
      const raw = fs.readFileSync(src, 'utf-8')
      const profile = JSON.parse(raw)
      writeSettings(profile)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('delete-settings-profile', (_e, name: string) => {
    try {
      const fp = path.join(PROFILES_DIR, `${name}.json`)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  // ── Team templates ───────────────────────────────────────────────

  ipcMain.handle('get-team-templates', () => {
    try {
      if (!fs.existsSync(TEMPLATES_DIR)) return []
      const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'))
      return files.map(f => {
        const fp = path.join(TEMPLATES_DIR, f)
        let description = ''
        let memberCount = 0
        let createdAt = 0
        try {
          const stat = fs.statSync(fp)
          createdAt = stat.mtimeMs
          const raw = fs.readFileSync(fp, 'utf-8')
          const data = JSON.parse(raw)
          description = data.description ?? ''
          memberCount = Array.isArray(data.members) ? data.members.length : 0
        } catch { /* skip */ }
        return { name: f.replace(/\.json$/, ''), description, memberCount, createdAt }
      }).sort((a, b) => b.createdAt - a.createdAt)
    } catch {
      return []
    }
  })

  ipcMain.handle('save-team-template', (_e, name: string, teamName: string) => {
    try {
      const configPath = path.join(TEAMS_DIR, teamName, 'config.json')
      if (!fs.existsSync(configPath)) return { ok: false, error: 'Team config not found' }
      const raw = fs.readFileSync(configPath, 'utf-8')
      const config = JSON.parse(raw)

      // Strip runtime fields
      const { leadAgentId, leadSessionId, createdAt, ...template } = config
      void leadAgentId; void leadSessionId; void createdAt
      if (Array.isArray(template.members)) {
        template.members = template.members.map((m: Record<string, unknown>) => {
          const { joinedAt, cwd, subscriptions, ...rest } = m
          void joinedAt; void cwd; void subscriptions
          return rest
        })
      }

      if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true })
      const dest = path.join(TEMPLATES_DIR, `${name}.json`)
      fs.writeFileSync(dest, JSON.stringify(template, null, 2), 'utf-8')
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('delete-team-template', (_e, name: string) => {
    try {
      const fp = path.join(TEMPLATES_DIR, `${name}.json`)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err) }
    }
  })
}
