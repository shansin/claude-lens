/**
 * Notifications module
 *
 * Handles desktop notification preferences and budget config.
 * Task completion notifications are fired from main.ts by calling
 * checkTaskCompletions(previousData, newData).
 *
 * Handlers:
 *   'get-notification-prefs'  () → NotificationPrefs
 *   'save-notification-prefs' (prefs: NotificationPrefs) → ActionResult
 *   'get-budget-config'       () → BudgetConfig
 *   'save-budget-config'      (config: BudgetConfig) → ActionResult
 */
import { Notification } from 'electron'
import type { IpcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'

const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const PREFS_PATH  = path.join(CLAUDE_DIR, 'notification-prefs.json')
const BUDGET_PATH = path.join(CLAUDE_DIR, 'budget.json')

// ── Types ─────────────────────────────────────────────────────────

interface NotificationPrefs {
  taskCompleted: boolean
  teamCreated: boolean
  costThreshold: boolean
  costThresholdAmount: number  // USD
}

interface BudgetConfig {
  enabled: boolean
  perTeamDailyLimit: number   // USD, 0 = disabled
  globalDailyLimit: number    // USD, 0 = disabled
  warningPercent: number      // e.g. 80 = warn at 80% of limit
}

interface ActionResult {
  ok: boolean
  error?: string
}

// ── Defaults ──────────────────────────────────────────────────────

const DEFAULT_PREFS: NotificationPrefs = {
  taskCompleted: true,
  teamCreated: false,
  costThreshold: false,
  costThresholdAmount: 1.0,
}

const DEFAULT_BUDGET: BudgetConfig = {
  enabled: false,
  perTeamDailyLimit: 0,
  globalDailyLimit: 0,
  warningPercent: 80,
}

// ── Helpers ───────────────────────────────────────────────────────

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback
    const raw = fs.readFileSync(filePath, 'utf-8')
    return { ...fallback, ...JSON.parse(raw) } as T
  } catch {
    return fallback
  }
}

function safeWriteJson(filePath: string, data: unknown): ActionResult {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true }
  } catch (err: unknown) {
    return { ok: false, error: String(err) }
  }
}

// ── Exported helper ───────────────────────────────────────────────

export interface TaskData {
  teamName: string
  tasks: Array<{ id: string; status: string; subject: string; owner?: string }>
}

export function checkTaskCompletions(
  previous: TaskData[],
  current: TaskData[],
  prefs: NotificationPrefs
): void {
  if (!prefs.taskCompleted) return

  // Build map of previous task statuses: teamName+id → status
  const prevMap = new Map<string, string>()
  for (const team of previous) {
    for (const task of team.tasks) {
      prevMap.set(`${team.teamName}:${task.id}`, task.status)
    }
  }

  for (const team of current) {
    for (const task of team.tasks) {
      if (task.status !== 'completed') continue
      const prevStatus = prevMap.get(`${team.teamName}:${task.id}`)
      if (prevStatus === 'completed') continue  // already was completed

      new Notification({
        title: 'Task completed',
        body: `${task.subject}${task.owner ? ' by ' + task.owner : ''}`,
      }).show()
    }
  }
}

// ── Registration ──────────────────────────────────────────────────

export function registerNotificationHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('get-notification-prefs', (): NotificationPrefs => {
    return safeReadJson<NotificationPrefs>(PREFS_PATH, DEFAULT_PREFS)
  })

  ipcMain.handle('save-notification-prefs', (_e, prefs: NotificationPrefs): ActionResult => {
    return safeWriteJson(PREFS_PATH, prefs)
  })

  ipcMain.handle('get-budget-config', (): BudgetConfig => {
    return safeReadJson<BudgetConfig>(BUDGET_PATH, DEFAULT_BUDGET)
  })

  ipcMain.handle('save-budget-config', (_e, config: BudgetConfig): ActionResult => {
    return safeWriteJson(BUDGET_PATH, config)
  })
}
