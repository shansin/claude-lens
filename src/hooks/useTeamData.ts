import { useState, useEffect, useCallback } from 'react'
import type { TeamData, Theme, CostMap, ProjectData, ActionResult } from '../types'

export function useTeamData() {
  const [teams,       setTeams]       = useState<TeamData[]>([])
  const [theme,       setTheme]       = useState<Theme>('dark')
  const [loading,     setLoading]     = useState(true)
  const [scanning,    setScanning]    = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [claudeDir,   setClaudeDir]   = useState('')
  const [costMap,     setCostMap]     = useState<CostMap>({})
  const [projects,    setProjects]    = useState<ProjectData[]>([])
  const [toastMsg,    setToastMsg]    = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const refresh = useCallback(async () => {
    try {
      const data = await window.electronAPI.getInitialData()
      setTeams(data)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('Failed to load team data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshScanned = useCallback(async () => {
    setScanning(true)
    try {
      const { costMap: cm, projects: ps } = await window.electronAPI.getAllScanned()
      setCostMap(cm)
      setProjects(ps)
    } catch (e) {
      console.error('Failed to scan data:', e)
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([
      window.electronAPI.getTheme(),
      window.electronAPI.getClaudeDir(),
    ]).then(([t, dir]) => { setTheme(t); setClaudeDir(dir) })

    refresh().then(() => window.electronAPI.startWatching())
    refreshScanned()

    const unsubTeam    = window.electronAPI.onTeamData(data => { setTeams(data); setLastUpdated(new Date()) })
    const unsubTheme   = window.electronAPI.onThemeChanged(t => setTheme(t))
    const unsubScanned = window.electronAPI.onScannedData(({ costMap: cm, projects: ps }) => {
      setCostMap(cm); setProjects(ps)
    })

    return () => { unsubTeam(); unsubTheme(); unsubScanned(); window.electronAPI.stopWatching() }
  }, [refresh, refreshScanned])

  // ── Actions ──────────────────────────────────────────────────

  const withFeedback = async (action: () => Promise<ActionResult>, successMsg: string) => {
    const result = await action()
    if (result.cancelled) return
    if (result.ok) { showToast(successMsg); await refresh() }
    else showToast(`Error: ${result.error}`)
  }

  const deleteTeam  = (n: string) => withFeedback(() => window.electronAPI.deleteTeam(n),  `Deleted "${n}"`)
  const archiveTeam = (n: string) => withFeedback(() => window.electronAPI.archiveTeam(n), `Archived "${n}"`)
  const clearTasks  = (n: string) => withFeedback(() => window.electronAPI.clearTasks(n),  `Cleared tasks for "${n}"`)
  const createTeam  = (name: string, description: string) =>
    withFeedback(() => window.electronAPI.createTeam(name, description), `Created team "${name}"`)
  const openCwd     = (cwd: string) => window.electronAPI.openCwd(cwd)
  const revealTeam  = (n: string) => window.electronAPI.revealTeam(n)
  const copyText    = async (text: string, label = 'Copied') => {
    await window.electronAPI.copyText(text)
    showToast(label)
  }

  return {
    teams, theme, loading, scanning, lastUpdated, claudeDir,
    costMap, projects, toastMsg,
    refresh, refreshScanned,
    deleteTeam, archiveTeam, clearTasks, createTeam, openCwd, revealTeam, copyText,
  }
}
