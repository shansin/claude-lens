import { describe, it, expect } from 'vitest'
import { summariseTeamCost, getTeamCost, formatCost, formatTokens } from './costs'
import type { AgentCostMap, CostMap } from '../types'

// ── summariseTeamCost ─────────────────────────────────────────────

describe('summariseTeamCost', () => {
  it('returns zero summary for undefined input', () => {
    expect(summariseTeamCost(undefined)).toEqual({
      totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: null,
      hasRealCost: false, agents: {},
    })
  })

  it('returns zero summary for empty map', () => {
    expect(summariseTeamCost({})).toEqual({
      totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: null,
      hasRealCost: false, agents: {},
    })
  })

  it('sums tokens across all agents', () => {
    const map: AgentCostMap = {
      agent1: { model: 'claude-sonnet-4-6', inputTokens: 100, outputTokens: 50, cacheCreationTokens: 0, cacheReadTokens: 0, costUSD: null },
      agent2: { model: 'claude-haiku-4-5',  inputTokens: 200, outputTokens: 80, cacheCreationTokens: 0, cacheReadTokens: 0, costUSD: null },
    }
    const result = summariseTeamCost(map)
    expect(result.totalInputTokens).toBe(300)
    expect(result.totalOutputTokens).toBe(130)
  })

  it('sums costUSD when at least one agent has real cost', () => {
    const map: AgentCostMap = {
      agent1: { model: 'm', inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, costUSD: 0.5 },
      agent2: { model: 'm', inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, costUSD: 0.25 },
    }
    const result = summariseTeamCost(map)
    expect(result.totalCostUSD).toBeCloseTo(0.75)
    expect(result.hasRealCost).toBe(true)
  })

  it('keeps totalCostUSD null when all agents have null cost', () => {
    const map: AgentCostMap = {
      agent1: { model: 'm', inputTokens: 100, outputTokens: 50, cacheCreationTokens: 0, cacheReadTokens: 0, costUSD: null },
    }
    const result = summariseTeamCost(map)
    expect(result.totalCostUSD).toBeNull()
    expect(result.hasRealCost).toBe(false)
  })

  it('mixes null and real costs: sums only real costs', () => {
    const map: AgentCostMap = {
      agent1: { model: 'm', inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, costUSD: 1.0 },
      agent2: { model: 'm', inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, costUSD: null },
    }
    const result = summariseTeamCost(map)
    expect(result.totalCostUSD).toBeCloseTo(1.0)
    expect(result.hasRealCost).toBe(true)
  })

  it('passes through the original agentMap as agents', () => {
    const map: AgentCostMap = {
      a: { model: 'm', inputTokens: 1, outputTokens: 1, cacheCreationTokens: 0, cacheReadTokens: 0, costUSD: null },
    }
    expect(summariseTeamCost(map).agents).toBe(map)
  })
})

// ── getTeamCost ───────────────────────────────────────────────────

describe('getTeamCost', () => {
  it('returns summary for a known team', () => {
    const costMap: CostMap = {
      myTeam: {
        agent1: { model: 'm', inputTokens: 10, outputTokens: 5, cacheCreationTokens: 0, cacheReadTokens: 0, costUSD: 0.1 },
      },
    }
    const result = getTeamCost(costMap, 'myTeam')
    expect(result.totalInputTokens).toBe(10)
    expect(result.totalCostUSD).toBeCloseTo(0.1)
  })

  it('returns zero summary for unknown team', () => {
    const result = getTeamCost({}, 'nonexistent')
    expect(result).toEqual({
      totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: null,
      hasRealCost: false, agents: {},
    })
  })
})

// ── formatCost ────────────────────────────────────────────────────

describe('formatCost', () => {
  it('returns em dash for null', () => {
    expect(formatCost(null)).toBe('—')
  })

  it('returns $0.00 for zero', () => {
    expect(formatCost(0)).toBe('$0.00')
  })

  it('returns <$0.001 for tiny positive values', () => {
    expect(formatCost(0.0001)).toBe('<$0.001')
    expect(formatCost(0.0009)).toBe('<$0.001')
  })

  it('returns 4 decimal places for values in [0.001, 1)', () => {
    expect(formatCost(0.001)).toBe('$0.0010')
    expect(formatCost(0.1234)).toBe('$0.1234')
    expect(formatCost(0.9999)).toBe('$0.9999')
  })

  it('returns 2 decimal places for values >= 1', () => {
    expect(formatCost(1)).toBe('$1.00')
    expect(formatCost(1.5)).toBe('$1.50')
    expect(formatCost(100.123)).toBe('$100.12')
  })
})

// ── formatTokens ──────────────────────────────────────────────────

describe('formatTokens', () => {
  it('returns raw number for values under 1000', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(1)).toBe('1')
    expect(formatTokens(999)).toBe('999')
  })

  it('returns K suffix for thousands', () => {
    expect(formatTokens(1_000)).toBe('1K')
    expect(formatTokens(1_500)).toBe('2K')   // toFixed(0) rounds
    expect(formatTokens(999_999)).toBe('1000K')
  })

  it('returns M suffix for millions', () => {
    expect(formatTokens(1_000_000)).toBe('1.0M')
    expect(formatTokens(1_500_000)).toBe('1.5M')
    expect(formatTokens(10_000_000)).toBe('10.0M')
  })
})
