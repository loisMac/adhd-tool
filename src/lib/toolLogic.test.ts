import { describe, expect, it } from 'vitest'
import {
  clampNumber,
  chunkTask,
  formatLastCheck,
  formatDuration,
  formatTime,
  getAccumulatedWorkSeconds,
  getBreakSeconds,
  getRescueActions,
  getSelfCareReminder,
} from './toolLogic'

describe('toolLogic', () => {
  it('splits a long task into distinct steps when enough clauses are present', () => {
    expect(chunkTask('open notes, write outline, send draft')).toEqual([
      'open notes',
      'write outline',
      'send draft',
    ])
  })

  it('falls back to gentle starter steps for short input', () => {
    expect(chunkTask('finish taxes')).toEqual([
      'Write what "finish taxes" looks like when it is done.',
      'Pick the first 5 to 10 minute piece of "finish taxes".',
      'Start a short timer and do only that first piece of "finish taxes".',
    ])
  })

  it('returns a list of grounding reset actions', () => {
    const actions = getRescueActions()

    expect(actions.length).toBeGreaterThan(0)
    expect(actions.some((a) => /breath/i.test(a))).toBe(true)
    expect(actions.some((a) => /water/i.test(a))).toBe(true)
    expect(actions.some((a) => /stand/i.test(a))).toBe(true)
  })

  it('formats short durations as mm:ss', () => {
    expect(formatTime(125)).toBe('02:05')
  })

  it('formats long durations as hh:mm:ss', () => {
    expect(formatDuration(3723)).toBe('01:02:03')
  })

  it('returns a breakfast reminder in the morning meal window', () => {
    const now = new Date('2026-03-27T09:30:00').getTime()

    expect(getSelfCareReminder({ now })).toEqual({
      message: 'Had breakfast yet?',
      focus: 'food',
    })
  })

  it('returns a lunch reminder in the lunch window', () => {
    const now = new Date('2026-03-27T13:00:00').getTime()

    expect(getSelfCareReminder({ now })).toEqual({
      message: 'Had lunch yet?',
      focus: 'food',
    })
  })

  it('returns a dinner reminder in the dinner window', () => {
    const now = new Date('2026-03-27T19:00:00').getTime()

    expect(getSelfCareReminder({ now })).toEqual({
      message: 'Had dinner yet?',
      focus: 'food',
    })
  })

  it('returns a water reminder when no meal reminder is due', () => {
    const now = new Date('2026-03-27T16:00:00').getTime()

    expect(getSelfCareReminder({ now, lastFoodCheck: now })).toEqual({
      message: 'Had some water recently?',
      focus: 'water',
    })
  })

  it('hides reminders after a recent matching check', () => {
    const now = new Date('2026-03-27T13:15:00').getTime()
    const lunchCheck = new Date('2026-03-27T12:10:00').getTime()
    const recentWater = now - 20 * 60 * 1000

    expect(getSelfCareReminder({ now, lastFoodCheck: lunchCheck, lastWaterCheck: recentWater })).toBe(null)
  })

  it('accumulates work time from a stored total and current session', () => {
    expect(getAccumulatedWorkSeconds(1800, 1_000, 4_600)).toBe(1800 + 3)
  })

  it('returns the saved total when no active work session exists', () => {
    expect(getAccumulatedWorkSeconds(900, null, 4_600)).toBe(900)
  })

  it('calculates break seconds from the break start time', () => {
    expect(getBreakSeconds(1_000, 6_000)).toBe(5)
  })

  it('formats a recent self-care check as just now', () => {
    expect(formatLastCheck(10_000, 10_030)).toBe('Checked just now')
  })

  it('formats a self-care check in minutes', () => {
    expect(formatLastCheck(10_000, 190_000)).toBe('Checked 3 min ago')
  })

  it('formats an older self-care check in hours', () => {
    expect(formatLastCheck(10_000, 7_210_000)).toBe('Checked 2 hr ago')
  })

  it('clamps numeric values to the provided range', () => {
    expect(clampNumber(2, 5, 10)).toBe(5)
    expect(clampNumber(8, 5, 10)).toBe(8)
    expect(clampNumber(14, 5, 10)).toBe(10)
  })
})
