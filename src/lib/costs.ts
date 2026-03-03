import type { AgentCostMap, CostMap, TeamCostSummary } from '../types'

export function summariseTeamCost(agentMap: AgentCostMap | undefined): TeamCostSummary {
  if (!agentMap || Object.keys(agentMap).length === 0) {
    return { totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: null, hasRealCost: false, agents: {} }
  }
  let totalIn = 0, totalOut = 0, totalCost: number | null = null, hasReal = false
  for (const entry of Object.values(agentMap)) {
    totalIn  += entry.inputTokens
    totalOut += entry.outputTokens
    if (entry.costUSD !== null) {
      hasReal = true
      totalCost = (totalCost ?? 0) + entry.costUSD
    }
  }
  return {
    totalInputTokens:  totalIn,
    totalOutputTokens: totalOut,
    totalCostUSD:      totalCost,
    hasRealCost:       hasReal,
    agents:            agentMap,
  }
}

export function getTeamCost(costMap: CostMap, teamName: string): TeamCostSummary {
  return summariseTeamCost(costMap[teamName])
}

export function formatCost(usd: number | null): string {
  if (usd === null) return '—'
  if (usd === 0) return '$0.00'
  if (usd < 0.001) return '<$0.001'
  if (usd < 1) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}
