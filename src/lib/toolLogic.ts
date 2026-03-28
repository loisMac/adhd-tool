export const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export type TaskChunkerType = 'admin' | 'writing' | 'study' | 'chore' | 'life' | 'work' | 'other'
export type TaskChunkerBlocker = 'first-step' | 'too-big' | 'avoiding' | 'prioritise' | 'low-energy'
export type TaskChunkerStepSize = 'tiny' | 'small' | 'normal'

export type ChunkTaskOptions = {
  taskType?: TaskChunkerType
  blocker?: TaskChunkerBlocker
  stepSize?: TaskChunkerStepSize
}

const summarizeInput = (input: string, maxLength = 60) => {
  const cleaned = input.replace(/\s+/g, ' ').trim().replace(/[.!?,;:]+$/, '')

  if (cleaned.length <= maxLength) {
    return cleaned
  }

  return `${cleaned.slice(0, maxLength - 3).trimEnd()}...`
}

const sizeLabels: Record<TaskChunkerStepSize, string> = {
  tiny: '2 to 5 minutes',
  small: '5 to 10 minutes',
  normal: '10 to 20 minutes',
}

export const splitTaskClauses = (input: string) =>
  input
    .trim()
    .split(/\n|[.;]+|,(?=\s*[a-z0-9])/gi)
    .map((step) => step.trim().replace(/^[\-•\d.)\s]+/, '').replace(/[.!?,;:]+$/, ''))
    .filter(Boolean)

const buildBlockerSteps = (
  focus: string,
  blocker: TaskChunkerBlocker,
  stepSize: TaskChunkerStepSize,
) => {
  const duration = sizeLabels[stepSize]

  switch (blocker) {
    case 'first-step':
      return [
        `Open the main thing connected to "${focus}" and just look at it.`,
        'Put the first thing you need in front of you so there is only one place to begin.',
      ]
    case 'too-big':
      return [
        `Write one sentence about what "${focus}" looks like when it is done.`,
        `Pick one part of "${focus}" that you could work on for ${duration}.`,
      ]
    case 'avoiding':
      return [
        `Open what you need for "${focus}" and stay with it for 30 seconds without trying to finish it.`,
        `Set a ${duration} timer and only aim to get yourself moving, not to finish the whole thing.`,
      ]
    case 'prioritise':
      return [
        `List the 3 parts of "${focus}" that feel most important or most urgent.`,
        'Choose the part with the nearest deadline, biggest consequence, or lowest effort to start.',
      ]
    case 'low-energy':
      return [
        `Choose the easiest version of "${focus}" you could manage today.`,
        `Set yourself up to do one ${duration} step sitting down, slowly, with as little friction as possible.`,
      ]
  }
}

const buildTaskTypeSteps = (
  focus: string,
  taskType: TaskChunkerType,
  stepSize: TaskChunkerStepSize,
) => {
  const duration = sizeLabels[stepSize]

  switch (taskType) {
    case 'admin':
      return [
        `Do one admin action for "${focus}", like opening one form, checking one date, or replying to one message.`,
        'Leave yourself a note for the next admin action before you stop.',
      ]
    case 'writing':
      return [
        `Open a doc and write a rough sentence or bullet list for one part of "${focus}".`,
        `Keep going for ${duration}, then stop and note the next sentence, point, or paragraph to return to.`,
      ]
    case 'study':
      return [
        `Pick one section, question, or page linked to "${focus}" and work only on that.`,
        `Write one short note about what to study next after this ${duration} block.`,
      ]
    case 'chore':
      return [
        `Get the supplies you need and do one visible pass of "${focus}" in a single area only.`,
        `Stop after ${duration} or one small zone, then decide whether to continue or call that enough for now.`,
      ]
    case 'life':
      return [
        `Do the first real-world action for "${focus}", like checking details, making the call, or sending the message.`,
        `Write down anything you still need so the next step is easier later.`,
      ]
    case 'work':
      return [
        `Open the doc, board, inbox, or file for "${focus}" and complete one meaningful piece of it.`,
        `Stop after ${duration} and leave a clear next-step note for future you.`,
      ]
    case 'other':
      return [
        `Do the smallest visible part of "${focus}" that would move it forward today.`,
        `When you stop, write the very next step so you do not have to figure it out again later.`,
      ]
  }
}

export const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const chunkTask = (input: string, options: ChunkTaskOptions = {}) => {
  const cleaned = input.trim()

  if (!cleaned) {
    return []
  }

  const splitByClauses = splitTaskClauses(cleaned)

  if (splitByClauses.length >= 3) {
    return splitByClauses
  }

  const focus = summarizeInput(cleaned)
  const taskType = options.taskType ?? 'other'
  const blocker = options.blocker ?? 'too-big'
  const stepSize = options.stepSize ?? 'small'

  return [
    ...buildBlockerSteps(focus, blocker, stepSize),
    ...buildTaskTypeSteps(focus, taskType, stepSize),
  ]
}

export const getRescueActions = () => [
  'Stand up. Stretch your arms above your head. Sit back down.',
  'Take 3 slow breaths — in through your nose, out through your mouth.',
  'Drink a glass of water right now.',
  'Shake out your hands and roll your shoulders back.',
  'Look away from the screen for 30 seconds and let your eyes rest.',
  'Walk to another room and back, then sit down and open the task.',
  'Put both feet flat on the floor. Take one breath. Name 3 things you can see.',
  'Splash cold water on your wrists or hands.',
  'Write one sentence: exactly what the very next action is.',
  'Set a 2-minute timer. Just sit with it. Begin when it goes off.',
]

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
