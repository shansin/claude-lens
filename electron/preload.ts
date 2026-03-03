import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Data
  getInitialData: () => ipcRenderer.invoke('get-initial-data'),
  getTheme:       () => ipcRenderer.invoke('get-theme'),
  getClaudeDir:   () => ipcRenderer.invoke('get-claude-dir'),
  getCosts:       () => ipcRenderer.invoke('get-costs'),
  getProjects:    () => ipcRenderer.invoke('get-projects'),
  getAllScanned:   () => ipcRenderer.invoke('get-all-scanned'),

  // Live updates
  startWatching: () => ipcRenderer.send('start-watching'),
  stopWatching:  () => ipcRenderer.send('stop-watching'),
  onTeamData: (cb: (data: unknown) => void) => {
    ipcRenderer.on('team-data', (_e, d) => cb(d))
    return () => ipcRenderer.removeAllListeners('team-data')
  },
  onThemeChanged: (cb: (theme: string) => void) => {
    ipcRenderer.on('theme-changed', (_e, t) => cb(t))
    return () => ipcRenderer.removeAllListeners('theme-changed')
  },
  onScannedData: (cb: (data: unknown) => void) => {
    ipcRenderer.on('scanned-data', (_e, d) => cb(d))
    return () => ipcRenderer.removeAllListeners('scanned-data')
  },

  // Management
  deleteTeam:  (teamName: string) => ipcRenderer.invoke('delete-team', teamName),
  archiveTeam: (teamName: string) => ipcRenderer.invoke('archive-team', teamName),
  clearTasks:  (teamName: string) => ipcRenderer.invoke('clear-tasks', teamName),
  openCwd:     (cwd: string)      => ipcRenderer.invoke('open-cwd', cwd),
  copyText:    (text: string)     => ipcRenderer.invoke('copy-text', text),
  revealTeam:  (teamName: string) => ipcRenderer.invoke('reveal-team', teamName),

  // Content (plans, todos, memory, cleanup, export, search)
  getPlans:          ()                             => ipcRenderer.invoke('get-plans'),
  getTodos:          ()                             => ipcRenderer.invoke('get-todos'),
  getMemoryFiles:    ()                             => ipcRenderer.invoke('get-memory-files'),
  getProjectSizes:   ()                             => ipcRenderer.invoke('get-project-sizes'),
  deleteProjectData: (projectKey: string)           => ipcRenderer.invoke('delete-project-data', projectKey),
  exportCsv:         ()                             => ipcRenderer.invoke('export-csv'),
  searchContent:     (query: string, limit?: number) => ipcRenderer.invoke('search-content', query, limit),

  // Settings
  getSettings:     ()                                                                              => ipcRenderer.invoke('get-settings'),
  saveSettings:    (settings: Record<string, unknown>)                                             => ipcRenderer.invoke('save-settings', settings),
  getSettingsPath: ()                                                                              => ipcRenderer.invoke('get-settings-path'),
  addEnvVar:       (key: string, value: string)                                                   => ipcRenderer.invoke('add-env-var', key, value),
  deleteEnvVar:    (key: string)                                                                   => ipcRenderer.invoke('delete-env-var', key),
  addHook:         (event: string, hook: { type: string; command: string; matcher?: string })     => ipcRenderer.invoke('add-hook', event, hook),
  deleteHook:      (event: string, index: number)                                                 => ipcRenderer.invoke('delete-hook', event, index),
  addMcpServer:    (name: string, config: { command: string; args?: string[]; env?: Record<string, string> }) => ipcRenderer.invoke('add-mcp-server', name, config),
  deleteMcpServer: (name: string)                                                                 => ipcRenderer.invoke('delete-mcp-server', name),
  setEffortLevel:  (level: 'low' | 'medium' | 'high')                                           => ipcRenderer.invoke('set-effort-level', level),
  setPermissions:  (mode: string)                                                                 => ipcRenderer.invoke('set-permissions', mode),

  // Analytics
  getUsageByDay:    ()               => ipcRenderer.invoke('get-usage-by-day'),
  getActivityFeed:  (limit?: number) => ipcRenderer.invoke('get-activity-feed', limit),
  getUsageExtended: (days: number)   => ipcRenderer.invoke('get-usage-extended', days),

  // System
  getProcesses:       ()            => ipcRenderer.invoke('get-processes'),
  killProcess:        (pid: number) => ipcRenderer.invoke('kill-process', pid),
  getAuthStatus:      ()            => ipcRenderer.invoke('get-auth-status'),
  getTelemetryEvents: ()            => ipcRenderer.invoke('get-telemetry-events'),

  // Conversation viewer
  getSessionMessages: (projectKey: string, sessionId: string) => ipcRenderer.invoke('get-session-messages', projectKey, sessionId),

  // Metrics
  getAgentMetrics:    (teamName: string) => ipcRenderer.invoke('get-agent-metrics', teamName),
  getModelComparison: ()                 => ipcRenderer.invoke('get-model-comparison'),

  // Content extras
  saveFile: (filePath: string, content: string)    => ipcRenderer.invoke('save-file', filePath, content),
  testHook: (command: string, sampleInput?: string) => ipcRenderer.invoke('test-hook', command, sampleInput),

  // Settings profiles
  getSettingsProfiles:   ()                                      => ipcRenderer.invoke('get-settings-profiles'),
  saveSettingsProfile:   (name: string)                          => ipcRenderer.invoke('save-settings-profile', name),
  loadSettingsProfile:   (name: string)                          => ipcRenderer.invoke('load-settings-profile', name),
  deleteSettingsProfile: (name: string)                          => ipcRenderer.invoke('delete-settings-profile', name),

  // Team templates
  getTeamTemplates:   ()                                         => ipcRenderer.invoke('get-team-templates'),
  saveTeamTemplate:   (name: string, teamName: string)           => ipcRenderer.invoke('save-team-template', name, teamName),
  deleteTeamTemplate: (name: string)                             => ipcRenderer.invoke('delete-team-template', name),

  // Notifications & budget
  getNotificationPrefs:  ()                               => ipcRenderer.invoke('get-notification-prefs'),
  saveNotificationPrefs: (prefs: unknown)                 => ipcRenderer.invoke('save-notification-prefs', prefs),
  getBudgetConfig:       ()                               => ipcRenderer.invoke('get-budget-config'),
  saveBudgetConfig:      (config: unknown)                => ipcRenderer.invoke('save-budget-config', config),
})
