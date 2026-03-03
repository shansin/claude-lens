import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime, getTeamStats, getAgentInitials, shortenModel, STATUS_CONFIG } from './utils'

// ── formatRelativeTime ────────────────────────────────────────────

describe('formatRelativeTime', () => {
  afterEach(() => vi.restoreAllMocks())

  const freeze = (nowMs: number) => vi.spyOn(Date, 'now').mockReturnValue(nowMs)

  it('returns "just now" for the current moment', () => {
    freeze(1_000_000)
    expect(formatRelativeTime(1_000_000)).toBe('just now')
  })

  it('returns "just now" for future timestamps (bug fix: was returning negative values)', () => {
    freeze(1_000_000)
    expect(formatRelativeTime(1_000_001)).toBe('just now')
    expect(formatRelativeTime(1_000_000 + 60_000)).toBe('just now')
  })

  it('returns seconds for sub-minute diffs', () => {
    freeze(1_000_000)
    expect(formatRelativeTime(1_000_000 - 30_000)).toBe('30s ago')
    expect(formatRelativeTime(1_000_000 - 1_000)).toBe('1s ago')
    expect(formatRelativeTime(1_000_000 - 59_000)).toBe('59s ago')
  })

  it('returns minutes for sub-hour diffs', () => {
    freeze(1_000_000)
    expect(formatRelativeTime(1_000_000 - 60_000)).toBe('1m ago')
    expect(formatRelativeTime(1_000_000 - 90_000)).toBe('1m ago')
    expect(formatRelativeTime(1_000_000 - 3_540_000)).toBe('59m ago')
  })

  it('returns hours for sub-day diffs', () => {
    freeze(10_000_000)
    expect(formatRelativeTime(10_000_000 - 3_600_000)).toBe('1h ago')
    expect(formatRelativeTime(10_000_000 - 7_200_000)).toBe('2h ago')
    expect(formatRelativeTime(10_000_000 - 82_800_000)).toBe('23h ago')
  })

  it('returns days for diffs >= 24 hours', () => {
    freeze(100_000_000)
    expect(formatRelativeTime(100_000_000 - 86_400_000)).toBe('1d ago')
    expect(formatRelativeTime(100_000_000 - 172_800_000)).toBe('2d ago')
  })
})

// ── getTeamStats ──────────────────────────────────────────────────

describe('getTeamStats', () => {
  it('returns all zeros for empty task list', () => {
    expect(getTeamStats([])).toEqual({ total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 })
  })

  it('counts tasks by status', () => {
    const tasks = [
      { status: 'completed' as const },
      { status: 'completed' as const },
      { status: 'in_progress' as const },
      { status: 'pending' as const },
    ]
    expect(getTeamStats(tasks)).toEqual({ total: 4, completed: 2, inProgress: 1, pending: 1, progress: 50 })
  })

  it('excludes deleted tasks from total and progress (bug fix: deleted tasks were diluting progress)', () => {
    const tasks = [
      { status: 'completed' as const },
      { status: 'completed' as const },
      { status: 'deleted' as const },
      { status: 'deleted' as const },
      { status: 'deleted' as const },
    ]
    const stats = getTeamStats(tasks)
    // total excludes deleted: 2 active tasks, both completed → 100%
    expect(stats.total).toBe(2)
    expect(stats.completed).toBe(2)
    expect(stats.progress).toBe(100)
  })

  it('progress is 0 when total (non-deleted) is 0', () => {
    const tasks = [{ status: 'deleted' as const }]
    expect(getTeamStats(tasks).progress).toBe(0)
    expect(getTeamStats(tasks).total).toBe(0)
  })

  it('rounds progress to nearest integer', () => {
    // 1 of 3 = 33.33...%
    const tasks = [
      { status: 'completed' as const },
      { status: 'pending' as const },
      { status: 'pending' as const },
    ]
    expect(getTeamStats(tasks).progress).toBe(33)
  })

  it('progress reaches 100% when all non-deleted tasks are completed', () => {
    const tasks = [
      { status: 'completed' as const },
      { status: 'completed' as const },
      { status: 'deleted' as const },
    ]
    expect(getTeamStats(tasks).progress).toBe(100)
  })
})

// ── getAgentInitials ──────────────────────────────────────────────

describe('getAgentInitials', () => {
  it('returns up to 2 uppercase initials from hyphenated name', () => {
    expect(getAgentInitials('frontend-dev')).toBe('FD')
    expect(getAgentInitials('code-reviewer')).toBe('CR')
  })

  it('handles single-word names', () => {
    expect(getAgentInitials('alice')).toBe('A')
  })

  it('slices to at most 2 characters', () => {
    expect(getAgentInitials('a-b-c-d')).toBe('AB')
  })

  it('handles empty segments from leading/trailing hyphens', () => {
    // Edge: empty string segment produces empty initial
    expect(getAgentInitials('-agent')).toBe('A')
  })
})

// ── shortenModel ──────────────────────────────────────────────────

describe('shortenModel', () => {
  it('formats claude model with version as "Major.Minor" (bug fix: was producing space instead of period)', () => {
    expect(shortenModel('claude-sonnet-4-6')).toBe('Sonnet 4.6')
    expect(shortenModel('claude-haiku-4-5')).toBe('Haiku 4.5')
    expect(shortenModel('claude-opus-4-6')).toBe('Opus 4.6')
  })

  it('formats claude model names with full id prefix', () => {
    expect(shortenModel('claude-sonnet-4-5-20251001')).toBe('Sonnet 4.5 20251001')
  })

  it('capitalises all words in claude model name', () => {
    expect(shortenModel('claude-sonnet-4-6')).toMatch(/^[A-Z]/)
  })

  it('formats non-claude models by replacing colons and hyphens with spaces', () => {
    expect(shortenModel('qwen3:8b')).toBe('Qwen3 8B')
    expect(shortenModel('llama3-8b')).toBe('Llama3 8B')
  })

  it('uppercases first letter of each word in non-claude models', () => {
    expect(shortenModel('mixtral:7b')).toBe('Mixtral 7B')
  })
})

// ── STATUS_CONFIG ─────────────────────────────────────────────────

describe('STATUS_CONFIG', () => {
  it('has an entry for every TaskStatus', () => {
    const statuses = ['pending', 'in_progress', 'completed', 'deleted'] as const
    for (const s of statuses) {
      expect(STATUS_CONFIG[s]).toBeDefined()
      expect(STATUS_CONFIG[s].label).toBeTruthy()
      expect(STATUS_CONFIG[s].color).toBeTruthy()
      expect(STATUS_CONFIG[s].dot).toBeTruthy()
    }
  })
})
