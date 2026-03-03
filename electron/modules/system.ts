/**
 * System monitoring module – IPC handlers
 *
 * Handlers registered:
 *   'get-processes'       → ProcessInfo[]
 *   'kill-process'        → { ok: boolean; error?: string }
 *   'get-auth-status'     → AuthStatus
 *   'get-telemetry-events'→ TelemetryEvent[]
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { IpcMain, BrowserWindow } from 'electron'
import { dialog } from 'electron'

// ── Types ────────────────────────────────────────────────────────

export interface ProcessInfo {
  pid: number
  cpu: number
  mem: number
  command: string
  elapsed: string
}

export interface AuthStatus {
  subscriptionType: string | null
  rateLimitTier: string | null
  expiresAt: string | null
  scopes: string[]
  isExpired: boolean
  claudeVersion: string | null
}

export interface TelemetryEvent {
  eventName: string
  timestamp: string
  sessionId: string
  model: string
  version: string
  processStats?: { cpu?: number; memory?: number }
}

// ── Helpers ──────────────────────────────────────────────────────

const CLAUDE_DIR = path.join(os.homedir(), '.claude')

function getClaudeProcesses(): ProcessInfo[] {
  try {
    const raw = execSync('ps aux', { encoding: 'utf8', timeout: 5000 })
    const lines = raw.split('\n').filter(l => l.toLowerCase().includes('claude'))

    return lines.map(line => {
      const cols = line.trim().split(/\s+/)
      // ps aux columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND...
      if (cols.length < 11) return null
      const pid = Number(cols[1])
      const cpu = parseFloat(cols[2]) || 0
      const mem = parseFloat(cols[3]) || 0
      const elapsed = cols[9] || ''
      const command = cols.slice(10).join(' ')
      return { pid, cpu, mem, command, elapsed }
    }).filter(Boolean) as ProcessInfo[]
  } catch {
    return []
  }
}

function readAuthStatus(): AuthStatus {
  const result: AuthStatus = {
    subscriptionType: null,
    rateLimitTier: null,
    expiresAt: null,
    scopes: [],
    isExpired: false,
    claudeVersion: null,
  }

  try {
    const credPath = path.join(CLAUDE_DIR, '.credentials.json')
    if (fs.existsSync(credPath)) {
      const cred = JSON.parse(fs.readFileSync(credPath, 'utf8'))
      result.subscriptionType = cred.subscriptionType ?? cred.planType ?? null
      result.rateLimitTier = cred.rateLimitTier ?? cred.tier ?? null
      result.expiresAt = cred.expiresAt ?? cred.exp ?? null
      result.scopes = Array.isArray(cred.scopes) ? cred.scopes : []

      if (result.expiresAt) {
        result.isExpired = new Date(result.expiresAt).getTime() < Date.now()
      }
    }
  } catch { /* ignore */ }

  // Try to get Claude version from telemetry
  try {
    const telDir = path.join(CLAUDE_DIR, 'telemetry')
    if (fs.existsSync(telDir)) {
      const files = fs.readdirSync(telDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()

      for (const f of files.slice(0, 3)) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(telDir, f), 'utf8'))
          const events = Array.isArray(data) ? data : [data]
          for (const ev of events) {
            if (ev.version || ev.appVersion || ev.claude_version) {
              result.claudeVersion = ev.version ?? ev.appVersion ?? ev.claude_version
              break
            }
          }
          if (result.claudeVersion) break
        } catch { /* skip */ }
      }
    }
  } catch { /* ignore */ }

  return result
}

function readTelemetryEvents(): TelemetryEvent[] {
  const events: TelemetryEvent[] = []
  try {
    const telDir = path.join(CLAUDE_DIR, 'telemetry')
    if (!fs.existsSync(telDir)) return events

    const files = fs.readdirSync(telDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 5) // last 5 files

    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(telDir, f), 'utf8'))
        const raw = Array.isArray(data) ? data : [data]

        for (const ev of raw.slice(0, 20)) { // first 20 events per file
          events.push({
            eventName: ev.event ?? ev.eventName ?? ev.type ?? 'unknown',
            timestamp: ev.timestamp ?? ev.ts ?? '',
            sessionId: ev.sessionId ?? ev.session_id ?? '',
            model: ev.model ?? ev.properties?.model ?? '',
            version: ev.version ?? ev.appVersion ?? '',
            processStats: ev.process ? {
              cpu: ev.process.cpu ?? ev.process.cpuUsage,
              memory: ev.process.memory ?? ev.process.memoryUsage,
            } : undefined,
          })
        }
      } catch { /* skip file */ }
    }
  } catch { /* ignore */ }

  return events.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
    return tb - ta
  })
}

// ── Register ─────────────────────────────────────────────────────

export function registerSystemHandlers(
  ipcMain: IpcMain,
  mainWindow: () => BrowserWindow | null,
) {
  ipcMain.handle('get-processes', () => {
    return getClaudeProcesses()
  })

  ipcMain.handle('kill-process', async (_e, pid: number) => {
    const win = mainWindow()
    if (!win) return { ok: false, error: 'No window' }

    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Kill process',
      message: `Kill process ${pid}?`,
      detail: 'This will send SIGTERM to the process.',
      buttons: ['Kill', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })

    if (response !== 0) return { ok: false, error: 'Cancelled' }

    try {
      process.kill(pid, 'SIGTERM')
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('get-auth-status', () => {
    return readAuthStatus()
  })

  ipcMain.handle('get-telemetry-events', () => {
    return readTelemetryEvents()
  })
}
