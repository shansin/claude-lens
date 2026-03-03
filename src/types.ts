// ── Teams & tasks ─────────────────────────────────────────────

export interface TeamMember {
  agentId: string
  name: string
  agentType: string
  model: string
  joinedAt: number
  cwd: string
  subscriptions: string[]
}

export interface TeamConfig {
  name: string
  description: string
  createdAt: number
  leadAgentId: string
  leadSessionId?: string
  members: TeamMember[]
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted'

export interface Task {
  id: string
  subject: string
  description: string
  activeForm?: string
  status: TaskStatus
  blocks: string[]
  blockedBy: string[]
  owner?: string
}

export interface TeamData {
  teamName: string
  team: TeamConfig
  tasks: Task[]
}

// ── Projects ──────────────────────────────────────────────────

export interface ProjectSession {
  sessionId: string
  firstSeen: number
  lastSeen: number
  linkedTeam?: string
  model: string
}

export interface ProjectData {
  projectKey: string
  cwd: string
  displayName: string
  sessions: ProjectSession[]
  models: string[]
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheTokens: number
  costUSD: number | null
  lastActivity: number
  linkedTeams: string[]
  totalMessages: number
}

// ── Cost map (teamName → sessionId → CostEntry) ───────────────

export interface AgentCost {
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUSD: number | null
}

export type AgentCostMap = Record<string, AgentCost>
export type CostMap      = Record<string, AgentCostMap>

export interface TeamCostSummary {
  totalInputTokens:  number
  totalOutputTokens: number
  totalCostUSD:      number | null
  hasRealCost:       boolean
  agents:            AgentCostMap
}

// ── UI ────────────────────────────────────────────────────────

export type ViewMode   = 'cards' | 'graph' | 'split'
export type SourceMode = 'teams' | 'projects' | 'analytics' | 'content' | 'search' | 'system' | 'settings' | 'conversations'
export type Theme      = 'light' | 'dark'

// ── Conversation viewer ────────────────────────────────────────

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string | Array<{ type: string; text?: string }> }
  | { type: 'thinking'; thinking: string }

export interface SessionMessage {
  id: string
  type: 'user' | 'assistant'
  timestamp: number
  model?: string
  content: ContentBlock[]
  usage?: { inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number }
}

// ── Electron API ──────────────────────────────────────────────

export interface ActionResult { ok: boolean; cancelled?: boolean; error?: string }

export interface ScannedData { costMap: CostMap; projects: ProjectData[] }

declare global {
  interface Window {
    electronAPI: {
      getInitialData: () => Promise<TeamData[]>
      getTheme:       () => Promise<Theme>
      getClaudeDir:   () => Promise<string>
      getCosts:       () => Promise<CostMap>
      getProjects:    () => Promise<ProjectData[]>
      getAllScanned:   () => Promise<ScannedData>
      startWatching:  () => void
      stopWatching:   () => void
      onTeamData:     (cb: (data: TeamData[])   => void) => () => void
      onThemeChanged: (cb: (theme: Theme)        => void) => () => void
      onScannedData:  (cb: (data: ScannedData)   => void) => () => void
      deleteTeam:     (teamName: string) => Promise<ActionResult>
      archiveTeam:    (teamName: string) => Promise<ActionResult>
      clearTasks:     (teamName: string) => Promise<ActionResult>
      openCwd:        (cwd: string)      => Promise<void>
      copyText:       (text: string)     => Promise<boolean>
      revealTeam:     (teamName: string) => Promise<boolean>
      // Conversations
      getSessionMessages: (projectKey: string, sessionId: string) => Promise<SessionMessage[]>
      // Content
      getPlans:          () => Promise<any[]>
      getTodos:          () => Promise<any[]>
      getMemoryFiles:    () => Promise<any[]>
      getProjectSizes:   () => Promise<any[]>
      deleteProjectData: (projectKey: string) => Promise<{ ok: boolean; deletedCount: number; freedBytes: number; error?: string }>
      exportCsv:         () => Promise<{ ok: boolean; path?: string; rowCount?: number; error?: string }>
      searchContent:     (query: string, limit?: number) => Promise<any[]>
      // Analytics
      getUsageByDay:     () => Promise<any[]>
      getActivityFeed:   (limit?: number) => Promise<any[]>
      getUsageExtended:  (days: number) => Promise<any[]>
      getAgentMetrics:   (teamName: string) => Promise<any[]>
      getModelComparison:() => Promise<any[]>
      // System
      getProcesses:      () => Promise<any[]>
      killProcess:       (pid: number) => Promise<{ ok: boolean; error?: string }>
      getAuthStatus:     () => Promise<any>
      getTelemetryEvents:() => Promise<any[]>
      // Settings
      getSettings:      () => Promise<Record<string, unknown>>
      saveSettings:     (settings: Record<string, unknown>) => Promise<ActionResult>
      getSettingsPath:  () => Promise<string>
      addEnvVar:        (key: string, value: string) => Promise<ActionResult>
      deleteEnvVar:     (key: string) => Promise<ActionResult>
      addHook:          (event: string, hook: { type: string; command: string; matcher?: string }) => Promise<ActionResult>
      deleteHook:       (event: string, index: number) => Promise<ActionResult>
      addMcpServer:     (name: string, config: { command: string; args?: string[]; env?: Record<string, string> }) => Promise<ActionResult>
      deleteMcpServer:  (name: string) => Promise<ActionResult>
      setEffortLevel:   (level: 'low' | 'medium' | 'high') => Promise<ActionResult>
      setPermissions:   (mode: string) => Promise<ActionResult>
      // Utility / profiles
      saveFile:               (filePath: string, content: string) => Promise<{ ok: boolean; error?: string }>
      testHook:               (command: string, sampleInput?: string) => Promise<{ ok: boolean; output: string; exitCode: number; error?: string }>
      getSettingsProfiles:    () => Promise<SettingsProfile[]>
      saveSettingsProfile:    (name: string) => Promise<{ ok: boolean; error?: string }>
      loadSettingsProfile:    (name: string) => Promise<{ ok: boolean; error?: string }>
      deleteSettingsProfile:  (name: string) => Promise<{ ok: boolean; error?: string }>
      getNotificationPrefs:   () => Promise<NotificationPrefs>
      saveNotificationPrefs:  (prefs: NotificationPrefs) => Promise<{ ok: boolean }>
      getBudgetConfig:        () => Promise<BudgetConfig>
      saveBudgetConfig:       (config: BudgetConfig) => Promise<{ ok: boolean }>
      getTeamTemplates:       () => Promise<TeamTemplate[]>
      saveTeamTemplate:       (name: string, teamName: string) => Promise<{ ok: boolean; error?: string }>
      deleteTeamTemplate:     (name: string) => Promise<{ ok: boolean; error?: string }>
    }
  }
}

// ── Utility types ──────────────────────────────────────────────

export interface SettingsProfile {
  name: string
  createdAt: number
  preview: string
}

export interface NotificationPrefs {
  taskCompleted: boolean
  teamCreated: boolean
  costThreshold: boolean
  costThresholdAmount: number
}

export interface BudgetConfig {
  enabled: boolean
  perTeamDailyLimit: number
  globalDailyLimit: number
  warningPercent: number
}

export interface TeamTemplate {
  name: string
  description: string
  memberCount: number
  createdAt: number
}
