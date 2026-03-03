/**
 * Viewer module – IPC handlers for reading conversation sessions
 *
 * Handlers:
 *   'get-session-list'     (projectKey: string) → SessionListEntry[]
 *   'get-session-messages' (projectKey: string, sessionId: string) → SessionMessage[]
 */
import type { IpcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')

// ── Types ─────────────────────────────────────────────────────────

interface SessionListEntry {
  sessionId: string
  messageCount: number
  lastTimestamp: number
  model: string
  linkedTeam?: string
  cwd: string
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string | Array<{ type: string; text?: string }> }
  | { type: 'thinking'; thinking: string }

interface SessionMessage {
  id: string
  type: 'user' | 'assistant'
  timestamp: number
  model?: string
  content: ContentBlock[]
  usage?: {
    inputTokens: number
    outputTokens: number
    cacheCreationTokens: number
    cacheReadTokens: number
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function safeReadDir(dir: string): string[] {
  try { return fs.readdirSync(dir) } catch { return [] }
}

function safeReadFile(p: string): string | null {
  try { return fs.readFileSync(p, 'utf-8') } catch { return null }
}

function normaliseContent(raw: unknown): ContentBlock[] {
  if (!raw) return []
  if (typeof raw === 'string') {
    return raw ? [{ type: 'text', text: raw }] : []
  }
  if (Array.isArray(raw)) {
    return raw.filter(Boolean) as ContentBlock[]
  }
  return []
}

// ── get-session-list ──────────────────────────────────────────────

function getSessionList(projectKey: string): SessionListEntry[] {
  const projDir = path.join(PROJECTS_DIR, projectKey)
  const files = safeReadDir(projDir).filter(f => f.endsWith('.jsonl'))
  const results: SessionListEntry[] = []

  for (const f of files) {
    const sessionId = f.replace(/\.jsonl$/, '')
    const fp = path.join(projDir, f)
    const content = safeReadFile(fp)
    if (!content) continue

    let messageCount = 0
    let lastTimestamp = 0
    let model = ''
    let linkedTeam: string | undefined
    let cwd = ''

    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line)
        if (obj.cwd && !cwd) cwd = obj.cwd
        if (obj.teamName && !linkedTeam) linkedTeam = obj.teamName
        if (obj.type === 'user' || obj.type === 'assistant') {
          messageCount++
          const ts = obj.timestamp ? new Date(obj.timestamp).getTime() : 0
          if (ts > lastTimestamp) lastTimestamp = ts
          if (obj.message?.model) model = obj.message.model
        }
      } catch { /* skip bad line */ }
    }

    results.push({ sessionId, messageCount, lastTimestamp, model, linkedTeam, cwd })
  }

  return results.sort((a, b) => b.lastTimestamp - a.lastTimestamp)
}

// ── get-session-messages ──────────────────────────────────────────

function getSessionMessages(projectKey: string, sessionId: string): SessionMessage[] {
  const fp = path.join(PROJECTS_DIR, projectKey, `${sessionId}.jsonl`)
  const content = safeReadFile(fp)
  if (!content) return []

  const messages: SessionMessage[] = []

  for (const line of content.split('\n')) {
    if (!line.trim()) continue
    try {
      const obj = JSON.parse(line)
      if (obj.type !== 'user' && obj.type !== 'assistant') continue

      const msg = obj.message
      if (!msg) continue

      const contentBlocks = normaliseContent(msg.content)
      if (contentBlocks.length === 0) continue

      const ts = obj.timestamp ? new Date(obj.timestamp).getTime() : 0

      let usage: SessionMessage['usage'] | undefined
      if (msg.usage) {
        usage = {
          inputTokens: msg.usage.input_tokens ?? 0,
          outputTokens: msg.usage.output_tokens ?? 0,
          cacheCreationTokens: msg.usage.cache_creation_input_tokens ?? 0,
          cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
        }
      }

      messages.push({
        id: msg.id ?? `${sessionId}:${ts}`,
        type: obj.type as 'user' | 'assistant',
        timestamp: ts,
        model: msg.model || undefined,
        content: contentBlocks,
        usage,
      })
    } catch { /* skip bad line */ }
  }

  return messages
}

// ── Registration ──────────────────────────────────────────────────

export function registerViewerHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('get-session-list', (_e, projectKey: string) => getSessionList(projectKey))
  ipcMain.handle('get-session-messages', (_e, projectKey: string, sessionId: string) => getSessionMessages(projectKey, sessionId))
}
