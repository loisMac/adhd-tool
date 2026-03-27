export type SortedBrainDump = {
  work: string[]
  life: string[]
  health: string[]
  admin: string[]
  money: string[]
  creative: string[]
  misc: string[]
}

export const emptyBrainDump = (): SortedBrainDump => ({
  work: [],
  life: [],
  health: [],
  admin: [],
  money: [],
  creative: [],
  misc: [],
})

export const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const chunkTask = (input: string) => {
  const cleaned = input.trim()

  if (!cleaned) {
    return []
  }

  const splitByClauses = cleaned
    .split(/\n|\.|;|,|\band\b|\bthen\b/gi)
    .map((step) => step.trim())
    .filter(Boolean)

  if (splitByClauses.length >= 3) {
    return splitByClauses
  }

  return [
    'Write what done looks like in one line.',
    'Pick the first action that takes 5 to 10 minutes.',
    'Start a short timer and do only that first action.',
  ]
}

export const sortBrainDump = (text: string): SortedBrainDump => {
  const sorted = emptyBrainDump()
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  lines.forEach((line) => {
    const lower = line.toLowerCase()

    if (/(client|meeting|project|deadline|team|email)/.test(lower)) {
      sorted.work.push(line)
      return
    }
    if (/(rent|invoice|money|budget|tax|pay)/.test(lower)) {
      sorted.money.push(line)
      return
    }
    if (/(doctor|sleep|medicine|walk|eat|water|health)/.test(lower)) {
      sorted.health.push(line)
      return
    }
    if (/(form|admin|document|renew|appointment|bank)/.test(lower)) {
      sorted.admin.push(line)
      return
    }
    if (/(idea|write|draw|music|design|create)/.test(lower)) {
      sorted.creative.push(line)
      return
    }
    if (/(home|clean|laundry|kitchen|family|shop|groceries)/.test(lower)) {
      sorted.life.push(line)
      return
    }

    sorted.misc.push(line)
  })

  return sorted
}

type SelfCareReminder = {
  message: string
  focus: 'food' | 'water'
}

type SelfCareReminderInput = {
  now?: number
  lastFoodCheck?: number | null
  lastWaterCheck?: number | null
}

const mealWindows = [
  { label: 'breakfast', startHour: 6, endHour: 11 },
  { label: 'lunch', startHour: 12, endHour: 15 },
  { label: 'dinner', startHour: 18, endHour: 21 },
]

const WATER_INTERVAL_MS = 75 * 60 * 1000

export const getSelfCareReminder = ({
  now = Date.now(),
  lastFoodCheck = null,
  lastWaterCheck = null,
}: SelfCareReminderInput = {}): SelfCareReminder | null => {
  const current = new Date(now)
  const hour = current.getHours()

  const activeMeal = mealWindows.find(
    (window) => hour >= window.startHour && hour <= window.endHour,
  )

  if (activeMeal) {
    const mealWindowStart = new Date(current)
    mealWindowStart.setHours(activeMeal.startHour, 0, 0, 0)

    if (!lastFoodCheck || lastFoodCheck < mealWindowStart.getTime()) {
      return {
        message: `Had ${activeMeal.label} yet?`,
        focus: 'food',
      }
    }
  }

  const isDaytime = hour >= 9 && hour <= 21
  if (isDaytime && (!lastWaterCheck || now - lastWaterCheck >= WATER_INTERVAL_MS)) {
    return {
      message: 'Had some water recently?',
      focus: 'water',
    }
  }

  return null
}

export const getAccumulatedWorkSeconds = (
  totalWorkSeconds: number,
  workStartTime: number | null,
  now = Date.now(),
) => {
  if (!workStartTime) {
    return totalWorkSeconds
  }

  return totalWorkSeconds + Math.floor((now - workStartTime) / 1000)
}

export const getBreakSeconds = (breakStartTime: number | null, now = Date.now()) => {
  if (!breakStartTime) {
    return 0
  }

  return Math.floor((now - breakStartTime) / 1000)
}

export const formatLastCheck = (timestamp: number, now = Date.now()) => {
  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000))

  if (diffSeconds < 60) {
    return 'Checked just now'
  }

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) {
    return `Checked ${diffMinutes} min ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `Checked ${diffHours} hr ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  return `Checked ${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

export const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}
