import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import './App.css'
import {
  clampNumber,
  chunkTask,
  emptyBrainDump,
  formatLastCheck,
  formatDuration,
  formatTime,
  getAccumulatedWorkSeconds,
  getBreakSeconds,
  getSelfCareReminder,
  sortBrainDump,
} from './lib/toolLogic'

type TaskItem = {
  id: number
  text: string
  done: boolean
}

type InvoiceEntry = {
  id: number
  client: string
  amount: number
  date: string
  paid: boolean
}

type SortedBrainDump = {
  work: string[]
  life: string[]
  health: string[]
  admin: string[]
  money: string[]
  creative: string[]
  misc: string[]
}

type WindDownItem = {
  id: number
  text: string
  done: boolean
}

type WindDown = {
  items: WindDownItem[]
  notes: string
}

type SelfCare = {
  water: boolean
  food: boolean
  posture: boolean
  lastFoodCheck: number | null
  lastWaterCheck: number | null
  lastReset: number
}

type WeeklyReview = {
  win: string
  friction: string
  support: string
  nextWeek: string
  boundaries: string
}

type TransitionHelper = {
  savedWork: boolean
  wroteNext: boolean
  movedBody: boolean
  startedNext: boolean
  nextTaskNote: string
}

type StuckRescue = {
  challenge: string
  chosenAction: string
  startedAt: number | null
}

type TimeAnchor = {
  intervalMinutes: number
  taskLabel: string
  lastPromptAt: number | null
  lastPromptText: string
}

type ProfileData = {
  bigTaskInput: string
  chunkedSteps: string[]
  taskInput: string
  tasks: TaskItem[]
  nextTask: string
  bodyDoubleMinutes: number
  bodyDoubleSecondsLeft: number
  windDown: WindDown
  invoiceClient: string
  invoiceAmount: string
  invoiceDate: string
  invoices: InvoiceEntry[]
  brainDumpInput: string
  sortedBrainDump: SortedBrainDump
  weeklyReview: WeeklyReview
  transitionHelper: TransitionHelper
  stuckRescue: StuckRescue
  timeAnchor: TimeAnchor
  pomodoroWork: number
  pomodoroRest: number
  pomodoroSecondsLeft: number
  workStartTime: number | null
  breakStartTime: number | null
  isWorking: boolean
  totalWorkSeconds: number
  selfCare: SelfCare
}

type TipsState = Record<string, boolean>
type DayMode = 'gentle' | 'focus' | 'recovery'
type ThemeName = 'dawn' | 'moss' | 'ocean' | 'night'

type ToolId =
  | 'task-chunker'
  | 'body-doubling'
  | 'next-task'
  | 'transition-helper'
  | 'stuck-rescue'
  | 'time-anchor'
  | 'wind-down'
  | 'money-tracker'
  | 'brain-dump'
  | 'weekly-review'
  | 'pomodoro'
  | 'self-care'

type ToolIconName =
  | 'chunker'
  | 'double'
  | 'next'
  | 'transition'
  | 'rescue'
  | 'anchor'
  | 'winddown'
  | 'money'
  | 'dump'
  | 'review'
  | 'pomo'
  | 'selfcare'

const STORAGE_PREFIX = 'calm-space'
const THEME_KEY = `${STORAGE_PREFIX}:theme`
const DAY_MODE_KEY = `${STORAGE_PREFIX}:day-mode`

const toolLinks: Array<{ id: ToolId; label: string }> = [
  { id: 'task-chunker', label: 'Task Splitter' },
  { id: 'body-doubling', label: 'Body Doubling' },
  { id: 'next-task', label: 'What Next' },
  { id: 'transition-helper', label: 'Transition' },
  { id: 'stuck-rescue', label: 'Stuck Rescue' },
  { id: 'time-anchor', label: 'Time Anchor' },
  { id: 'money-tracker', label: 'Money' },
  { id: 'brain-dump', label: 'Brain Dump' },
  { id: 'weekly-review', label: 'Weekly Review' },
  { id: 'pomodoro', label: 'Pomodoro' },
  { id: 'self-care', label: 'Body Check' },
  { id: 'wind-down', label: 'Wind-down' },
]

const toolTipsText: Record<ToolId, string> = {
  'task-chunker':
    'Write the task in plain words. Keep it rough. We will split it into small actions.',
  'body-doubling':
    'Set a short session and begin. You can pause any time.',
  'next-task': 'Keep this list short. The button picks one next action.',
  'transition-helper':
    'Use this quick checklist when switching tasks so your brain can land gently.',
  'stuck-rescue':
    'When you are frozen, pick one tiny move and commit for 10 minutes.',
  'time-anchor':
    'Get gentle local-time nudges while working so time does not disappear.',
  'wind-down':
    'This helps you close the day. Done is better than perfect.',
  'money-tracker':
    'Log invoices as you send them so you can see what is paid and what is still outstanding.',
  'brain-dump': 'One thought per line. Then sort.',
  'weekly-review':
    'Short answers are fine. You are only looking for what helped and what did not.',
  pomodoro: 'Adjust focus and rest times to match your energy.',
  'self-care': 'Quick check-in for water, food, and posture while the day is moving.',
}

const dayModes: Array<{
  id: DayMode
  title: string
  summary: string
  bodyDouble: number
  focus: number
  rest: number
}> = [
  {
    id: 'gentle',
    title: 'Gentle Start',
    summary: 'Lower pressure, softer momentum, easier entry.',
    bodyDouble: 20,
    focus: 25,
    rest: 10,
  },
  {
    id: 'focus',
    title: 'Deep Focus',
    summary: 'Longer focus blocks for high-priority work.',
    bodyDouble: 45,
    focus: 50,
    rest: 15,
  },
  {
    id: 'recovery',
    title: 'Recovery Mode',
    summary: 'Protect energy and keep progress sustainable.',
    bodyDouble: 15,
    focus: 20,
    rest: 15,
  },
]

const themes: Array<{ id: ThemeName; label: string }> = [
  { id: 'dawn', label: 'Dawn' },
  { id: 'moss', label: 'Moss' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'night', label: 'Night' },
]

const defaultTips = (): TipsState =>
  Object.fromEntries(Object.keys(toolTipsText).map((id) => [id, true])) as TipsState

const defaultData = (): ProfileData => ({
  bigTaskInput: '',
  chunkedSteps: [],
  taskInput: '',
  tasks: [],
  nextTask: 'Press the button to pick one task.',
  bodyDoubleMinutes: 25,
  bodyDoubleSecondsLeft: 25 * 60,
  windDown: {
    items: [],
    notes: '',
  },
  invoiceClient: '',
  invoiceAmount: '',
  invoiceDate: '',
  invoices: [],
  brainDumpInput: '',
  sortedBrainDump: emptyBrainDump(),
  weeklyReview: {
    win: '',
    friction: '',
    support: '',
    nextWeek: '',
    boundaries: '',
  },
  transitionHelper: {
    savedWork: false,
    wroteNext: false,
    movedBody: false,
    startedNext: false,
    nextTaskNote: '',
  },
  stuckRescue: {
    challenge: '',
    chosenAction: '',
    startedAt: null,
  },
  timeAnchor: {
    intervalMinutes: 30,
    taskLabel: '',
    lastPromptAt: null,
    lastPromptText: '',
  },
  pomodoroWork: 35,
  pomodoroRest: 12,
  pomodoroSecondsLeft: 35 * 60,
  workStartTime: null,
  breakStartTime: null,
  isWorking: false,
  totalWorkSeconds: 0,
  selfCare: {
    water: false,
    food: false,
    posture: false,
    lastFoodCheck: null,
    lastWaterCheck: null,
    lastReset: Date.now(),
  },
})

const profileStorageKey = (profileId: string) => `${STORAGE_PREFIX}:profile:${profileId}`
const profileTipsKey = (profileId: string) => `${STORAGE_PREFIX}:tips:${profileId}`

const loadStoredTheme = (): ThemeName => {
  try {
    const rawTheme = localStorage.getItem(THEME_KEY)
    if (rawTheme && themes.some((item) => item.id === rawTheme)) {
      return rawTheme as ThemeName
    }
  } catch {
    // Silently fail
  }

  return 'dawn'
}

const loadStoredDayMode = (): DayMode => {
  try {
    const rawDayMode = localStorage.getItem(DAY_MODE_KEY)
    if (rawDayMode && dayModes.some((item) => item.id === rawDayMode)) {
      return rawDayMode as DayMode
    }
  } catch {
    // Silently fail
  }

  return 'gentle'
}

const loadStoredProfile = (profileId: string) => {
  const empty = defaultData()
  const freshTips = defaultTips()

  try {
    const raw = localStorage.getItem(profileStorageKey(profileId))
    const rawTips = localStorage.getItem(profileTipsKey(profileId))

    const data = raw
      ? (() => {
          const parsed = JSON.parse(raw) as Partial<ProfileData>
          return {
            ...empty,
            ...parsed,
            windDown: { ...empty.windDown, ...parsed.windDown },
            weeklyReview: { ...empty.weeklyReview, ...parsed.weeklyReview },
            transitionHelper: { ...empty.transitionHelper, ...parsed.transitionHelper },
            stuckRescue: { ...empty.stuckRescue, ...parsed.stuckRescue },
            timeAnchor: { ...empty.timeAnchor, ...parsed.timeAnchor },
            selfCare: { ...empty.selfCare, ...parsed.selfCare },
            sortedBrainDump: { ...emptyBrainDump(), ...parsed.sortedBrainDump },
            tasks: parsed.tasks ?? [],
            chunkedSteps: parsed.chunkedSteps ?? [],
            invoices: parsed.invoices ?? [],
          }
        })()
      : empty

    const tips = rawTips
      ? (() => {
          const parsedTips = JSON.parse(rawTips) as Partial<TipsState>
          return Object.keys(freshTips).reduce((acc, keyName) => {
            acc[keyName] =
              typeof parsedTips[keyName] === 'boolean' ? parsedTips[keyName] : freshTips[keyName]
            return acc
          }, {} as TipsState)
        })()
      : freshTips

    return {
      data,
      tips,
      workElapsedSeconds: data.workStartTime
        ? getAccumulatedWorkSeconds(data.totalWorkSeconds, data.workStartTime)
        : data.totalWorkSeconds,
      breakElapsedSeconds: data.breakStartTime ? getBreakSeconds(data.breakStartTime) : 0,
    }
  } catch {
    return {
      data: empty,
      tips: freshTips,
      workElapsedSeconds: 0,
      breakElapsedSeconds: 0,
    }
  }
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(amount)

const companionLines = [
  'I am here with you. Keep it small and steady.',
  'You dont need to finish everything. Just this step.',
  'If you got distracted, welcome back. Start again now.',
  'Breathe, then continue for 2 more minutes.',
  'Quiet progress still counts.',
]

const rescueActions = [
  'Do 2 minutes only.',
  'Reduce the task to one tiny step.',
  'Write the very next click/action.',
  'Stand, stretch, then restart.',
  'Open the file and add one line.',
  'Send a short "need 15 min" message.',
]

const formatClock = (timestamp: number) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)

const playToneSequence = (tones: number[], duration = 0.14, gap = 0.05) => {
  try {
    const AudioCtor = globalThis.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) {
      return
    }

    const context = new AudioCtor()
    let time = context.currentTime + 0.01

    tones.forEach((frequency) => {
      const oscillator = context.createOscillator()
      const gainNode = context.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, time)

      gainNode.gain.setValueAtTime(0.0001, time)
      gainNode.gain.exponentialRampToValueAtTime(0.12, time + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration)

      oscillator.connect(gainNode)
      gainNode.connect(context.destination)
      oscillator.start(time)
      oscillator.stop(time + duration)

      time += duration + gap
    })

    window.setTimeout(() => {
      void context.close()
    }, Math.ceil((tones.length * (duration + gap) + 0.2) * 1000))
  } catch {
    // If audio playback is blocked by the browser, keep the app silent.
  }
}

function ToolIcon({ name }: { name: ToolIconName }) {
  const paths: Record<ToolIconName, string> = {
    chunker: 'M4 6h16M4 12h10M4 18h8M16 12l2 2 3-4',
    double: 'M8 6a6 6 0 1 0 0.01 0M16 6a6 6 0 1 0 0.01 0',
    next: 'M5 12h14M13 8l4 4-4 4',
    transition: 'M4 6h10M4 12h12M4 18h8M16 8l4 4-4 4',
    rescue: 'M12 3a9 9 0 1 0 9 9M9 12h6M12 9v6',
    anchor: 'M12 3v18M5 7h14M7 12h10M5 17h14',
    winddown: 'M12 4a8 8 0 1 0 8 8 6 6 0 0 1-8-8',
    money: 'M4 9h16v10H4zM8 13h8M9 9V6h6v3',
    dump: 'M5 5h14v14H5zM8 9h8M8 13h5',
    review: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h4',
    pomo: 'M12 7a5 5 0 1 0 5 5h-5zM10 3h4',
    selfcare: 'M12 2c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3M6 9h12v10H6z',
  }

  return (
    <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

function ToolHeading({
  id,
  title,
  copy,
  icon,
}: {
  id: string
  title: string
  copy: string
  icon: ToolIconName
}) {
  return (
    <div className="panel-head">
      <div className="panel-title-row">
        <span className="tool-icon-wrap">
          <ToolIcon name={icon} />
        </span>
        <h2 id={id}>{title}</h2>
      </div>
      <p>{copy}</p>
    </div>
  )
}

function App() {
  const profileId = 'default'
  const [storedProfile] = useState(() => loadStoredProfile(profileId))
  const [theme, setTheme] = useState<ThemeName>(() => loadStoredTheme())
  const [dayMode, setDayMode] = useState<DayMode>(() => loadStoredDayMode())
  const [data, setData] = useState<ProfileData>(storedProfile.data)
  const [toolTips, setToolTips] = useState<TipsState>(storedProfile.tips)
  const [bodyDoubleRunning, setBodyDoubleRunning] = useState(false)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroMode, setPomodoroMode] = useState<'focus' | 'rest'>('focus')
  const [workElapsedSeconds, setWorkElapsedSeconds] = useState(storedProfile.workElapsedSeconds)
  const [breakElapsedSeconds, setBreakElapsedSeconds] = useState(storedProfile.breakElapsedSeconds)
  const [stuckRescueSecondsLeft, setStuckRescueSecondsLeft] = useState(0)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(DAY_MODE_KEY, dayMode)
  }, [dayMode])

  useEffect(() => {
    try {
      localStorage.setItem(profileStorageKey(profileId), JSON.stringify(data))
      localStorage.setItem(profileTipsKey(profileId), JSON.stringify(toolTips))
    } catch {
      // Silently fail if storage is unavailable
    }
  }, [data, toolTips, profileId])

  useEffect(() => {
    if (!bodyDoubleRunning) {
      return
    }

    const timer = window.setInterval(() => {
      setData((prev) => {
        if (prev.bodyDoubleSecondsLeft <= 1) {
          window.clearInterval(timer)
          setBodyDoubleRunning(false)
          playToneSequence([523.25, 659.25, 783.99])
          return { ...prev, bodyDoubleSecondsLeft: 0 }
        }

        return { ...prev, bodyDoubleSecondsLeft: prev.bodyDoubleSecondsLeft - 1 }
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [bodyDoubleRunning])

  useEffect(() => {
    if (!pomodoroRunning) {
      return
    }

    const timer = window.setInterval(() => {
      setData((prev) => {
        if (prev.pomodoroSecondsLeft <= 1) {
          const nextMode = pomodoroMode === 'focus' ? 'rest' : 'focus'
          setPomodoroMode(nextMode)
          playToneSequence(nextMode === 'rest' ? [392, 523.25] : [440, 659.25])

          return {
            ...prev,
            pomodoroSecondsLeft:
              nextMode === 'focus' ? prev.pomodoroWork * 60 : prev.pomodoroRest * 60,
          }
        }

        return { ...prev, pomodoroSecondsLeft: prev.pomodoroSecondsLeft - 1 }
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [pomodoroMode, pomodoroRunning])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setData((prev) => {
        if (prev.isWorking && prev.workStartTime) {
          setWorkElapsedSeconds(getAccumulatedWorkSeconds(prev.totalWorkSeconds, prev.workStartTime))
        }

        if (!prev.isWorking && prev.breakStartTime) {
          setBreakElapsedSeconds(getBreakSeconds(prev.breakStartTime))
        }

        return prev
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!data.stuckRescue.startedAt) {
      return
    }

    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - data.stuckRescue.startedAt!) / 1000)
      const left = Math.max(0, 10 * 60 - elapsed)
      setStuckRescueSecondsLeft(left)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [data.stuckRescue.startedAt])

  useEffect(() => {
    if (!data.isWorking) {
      return
    }

    const timer = window.setInterval(() => {
      setData((prev) => {
        if (!prev.isWorking) {
          return prev
        }

        const now = Date.now()
        const intervalMs = clampNumber(prev.timeAnchor.intervalMinutes, 10, 120) * 60 * 1000
        const lastPromptAt = prev.timeAnchor.lastPromptAt ?? now

        if (now - lastPromptAt < intervalMs) {
          return prev
        }

        const taskText = prev.timeAnchor.taskLabel.trim() || 'your current task'
        const prompt = `It is ${formatClock(now)}. Still on ${taskText}?`

        playToneSequence([659.25, 783.99], 0.08, 0.04)

        return {
          ...prev,
          timeAnchor: {
            ...prev.timeAnchor,
            lastPromptAt: now,
            lastPromptText: prompt,
          },
        }
      })
    }, 15000)

    return () => window.clearInterval(timer)
  }, [data.isWorking])

  const currentDayMode = useMemo(
    () => dayModes.find((item) => item.id === dayMode) ?? dayModes[0],
    [dayMode],
  )

  const totals = useMemo(() => {
    const total = data.invoices.reduce((sum, item) => sum + item.amount, 0)
    const paid = data.invoices
      .filter((item) => item.paid)
      .reduce((sum, item) => sum + item.amount, 0)

    return {
      total,
      paid,
      outstanding: total - paid,
    }
  }, [data.invoices])

  const windDownProgress = useMemo(() => {
    return data.windDown.items.filter((item) => item.done).length
  }, [data.windDown.items])

  const weeklyProgress = useMemo(() => {
    const answers = Object.values(data.weeklyReview).filter((item) => item.trim().length > 0)
    return answers.length
  }, [data.weeklyReview])

  const totalBrainDumpItems = useMemo(() => {
    return Object.values(data.sortedBrainDump).reduce((sum, entries) => sum + entries.length, 0)
  }, [data.sortedBrainDump])

  const bodyDoubleProgress = useMemo(() => {
    const total = Math.max(1, data.bodyDoubleMinutes * 60)
    const elapsed = total - data.bodyDoubleSecondsLeft
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  }, [data.bodyDoubleMinutes, data.bodyDoubleSecondsLeft])

  const bodyDoubleCompanionLine = useMemo(() => {
    if (!bodyDoubleRunning) {
      return 'Press Start when ready. I will stay here with you.'
    }

    const elapsed = data.bodyDoubleMinutes * 60 - data.bodyDoubleSecondsLeft
    const index = Math.floor(Math.max(0, elapsed) / 90) % companionLines.length
    return companionLines[index]
  }, [bodyDoubleRunning, data.bodyDoubleMinutes, data.bodyDoubleSecondsLeft])

  const selfCareReminder = getSelfCareReminder({
    lastFoodCheck: data.selfCare.lastFoodCheck,
    lastWaterCheck: data.selfCare.lastWaterCheck,
  })
  const selfCareStatus = formatLastCheck(data.selfCare.lastReset)
  const hasTaskChunkerContent = Boolean(data.bigTaskInput.trim() || data.chunkedSteps.length > 0)
  const canAddTask = data.taskInput.trim().length > 0
  const hasCompletedTasks = data.tasks.some((task) => task.done)
  const hasOpenTasks = data.tasks.some((task) => !task.done)
  const hasNextTaskContent =
    data.taskInput.trim().length > 0 ||
    data.tasks.length > 0 ||
    data.nextTask !== 'Press the button to pick one task.'
  const hasWindDownContent =
    data.windDown.items.length > 0 || data.windDown.notes.trim().length > 0
  const canAddInvoice =
    data.invoiceClient.trim().length > 0 &&
    !Number.isNaN(Number(data.invoiceAmount)) &&
    Number(data.invoiceAmount) > 0
  const hasMoneyTrackerContent =
    data.invoiceClient.trim().length > 0 ||
    data.invoiceAmount.trim().length > 0 ||
    data.invoiceDate.length > 0 ||
    data.invoices.length > 0
  const hasBrainDumpContent = data.brainDumpInput.trim().length > 0 || totalBrainDumpItems > 0
  const hasWeeklyReviewContent = Object.values(data.weeklyReview).some((item) => item.trim().length > 0)
  const hasPomodoroDeviation =
    pomodoroRunning || pomodoroMode !== 'focus' || data.pomodoroSecondsLeft !== data.pomodoroWork * 60
  const hasBodyDoublingDeviation =
    bodyDoubleRunning || data.bodyDoubleSecondsLeft !== data.bodyDoubleMinutes * 60
  const hasSelfCareContent = data.selfCare.water || data.selfCare.food || data.selfCare.posture
  const transitionProgress = [
    data.transitionHelper.savedWork,
    data.transitionHelper.wroteNext,
    data.transitionHelper.movedBody,
    data.transitionHelper.startedNext,
  ].filter(Boolean).length
  const hasTransitionContent =
    transitionProgress > 0 || data.transitionHelper.nextTaskNote.trim().length > 0
  const hasRescueContent =
    data.stuckRescue.challenge.trim().length > 0 ||
    data.stuckRescue.chosenAction.trim().length > 0 ||
    data.stuckRescue.startedAt !== null
  const hasAnchorContent =
    data.timeAnchor.taskLabel.trim().length > 0 ||
    data.timeAnchor.lastPromptAt !== null ||
    data.timeAnchor.lastPromptText.trim().length > 0

  const confirmReset = (message: string, hasContent: boolean, action: () => void) => {
    if (!hasContent) {
      return
    }

    if (window.confirm(message)) {
      action()
    }
  }

  const handleInvoiceEnter = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && canAddInvoice) {
      addInvoice()
    }
  }

  const applyDayMode = (mode: DayMode) => {
    const chosen = dayModes.find((item) => item.id === mode)
    if (!chosen) {
      return
    }

    setDayMode(mode)
    setBodyDoubleRunning(false)
    setPomodoroRunning(false)
    setPomodoroMode('focus')

    setData((prev) => ({
      ...prev,
      bodyDoubleMinutes: chosen.bodyDouble,
      bodyDoubleSecondsLeft: chosen.bodyDouble * 60,
      pomodoroWork: chosen.focus,
      pomodoroRest: chosen.rest,
      pomodoroSecondsLeft: chosen.focus * 60,
    }))
  }

  const addTask = () => {
    const text = data.taskInput.trim()
    if (!text) {
      return
    }

    setData((prev) => ({
      ...prev,
      taskInput: '',
      tasks: [...prev.tasks, { id: Date.now(), text, done: false }],
    }))
  }

  const addWindDownItem = (text: string) => {
    const cleaned = text.trim()
    if (!cleaned) {
      return
    }

    setData((prev) => ({
      ...prev,
      windDown: {
        ...prev.windDown,
        items: [...prev.windDown.items, { id: Date.now(), text: cleaned, done: false }],
      },
    }))
  }

  const clearDoneTasks = () => {
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => !task.done),
    }))
  }

  const pickNextTask = () => {
    const openTasks = data.tasks.filter((task) => !task.done)

    if (openTasks.length === 0) {
      setData((prev) => ({
        ...prev,
        nextTask: 'No open tasks right now. You are clear.',
      }))
      return
    }

    const randomIndex = Math.floor(Math.random() * openTasks.length)
    const selected = openTasks[randomIndex]

    setData((prev) => ({
      ...prev,
      nextTask: selected.text,
    }))
  }

  const addInvoice = () => {
    const client = data.invoiceClient.trim()
    const amount = Number(data.invoiceAmount)

    if (!client || Number.isNaN(amount) || amount <= 0) {
      return
    }

    const entry: InvoiceEntry = {
      id: Date.now(),
      client,
      amount,
      date: data.invoiceDate || new Date().toISOString().slice(0, 10),
      paid: false,
    }

    setData((prev) => ({
      ...prev,
      invoiceClient: '',
      invoiceAmount: '',
      invoiceDate: '',
      invoices: [entry, ...prev.invoices],
    }))
  }

  const startWork = () => {
    const now = Date.now()
    setData((prev) => ({
      ...prev,
      workStartTime: now,
      breakStartTime: null,
      isWorking: true,
      totalWorkSeconds: 0,
      timeAnchor: {
        ...prev.timeAnchor,
        lastPromptAt: now,
        lastPromptText: '',
      },
    }))
    setWorkElapsedSeconds(0)
    setBreakElapsedSeconds(0)
  }

  const goOnBreak = () => {
    const nextTotal = getAccumulatedWorkSeconds(data.totalWorkSeconds, data.workStartTime)

    setData((prev) => ({
      ...prev,
      workStartTime: null,
      breakStartTime: Date.now(),
      isWorking: false,
      totalWorkSeconds: nextTotal,
    }))
    setWorkElapsedSeconds(nextTotal)
    setBreakElapsedSeconds(0)
  }

  const endBreak = () => {
    const now = Date.now()
    setData((prev) => ({
      ...prev,
      workStartTime: now,
      breakStartTime: null,
      isWorking: true,
      timeAnchor: {
        ...prev.timeAnchor,
        lastPromptAt: now,
      },
    }))
    setWorkElapsedSeconds(data.totalWorkSeconds)
    setBreakElapsedSeconds(0)
  }

  const stopWork = () => {
    setData((prev) => ({
      ...prev,
      workStartTime: null,
      breakStartTime: null,
      isWorking: false,
      totalWorkSeconds: 0,
      timeAnchor: {
        ...prev.timeAnchor,
        lastPromptText: '',
      },
    }))
    setWorkElapsedSeconds(0)
    setBreakElapsedSeconds(0)
  }

  const chooseRescueAction = () => {
    const index = Math.floor(Math.random() * rescueActions.length)
    const chosen = rescueActions[index]

    setData((prev) => ({
      ...prev,
      stuckRescue: {
        ...prev.stuckRescue,
        chosenAction: chosen,
        startedAt: Date.now(),
      },
    }))
    setStuckRescueSecondsLeft(10 * 60)
  }

  const resetTransitionHelper = () => {
    confirmReset('Reset this transition helper?', hasTransitionContent, () => {
      setData((prev) => ({
        ...prev,
        transitionHelper: {
          savedWork: false,
          wroteNext: false,
          movedBody: false,
          startedNext: false,
          nextTaskNote: '',
        },
      }))
    })
  }

  const resetStuckRescue = () => {
    confirmReset('Reset this stuck rescue plan?', hasRescueContent, () => {
      setData((prev) => ({
        ...prev,
        stuckRescue: {
          challenge: '',
          chosenAction: '',
          startedAt: null,
        },
      }))
      setStuckRescueSecondsLeft(0)
    })
  }

  const resetTimeAnchor = () => {
    confirmReset('Reset this time anchor?', hasAnchorContent, () => {
      setData((prev) => ({
        ...prev,
        timeAnchor: {
          ...prev.timeAnchor,
          taskLabel: '',
          lastPromptAt: prev.isWorking ? Date.now() : null,
          lastPromptText: '',
        },
      }))
    })
  }

  const resetTaskChunker = () => {
    if (!hasTaskChunkerContent) {
      return
    }

    setData((prev) => ({
      ...prev,
      bigTaskInput: '',
      chunkedSteps: [],
    }))
  }

  const resetBodyDoubling = () => {
    if (!hasBodyDoublingDeviation) {
      return
    }

    setBodyDoubleRunning(false)
    setData((prev) => ({
      ...prev,
      bodyDoubleSecondsLeft: prev.bodyDoubleMinutes * 60,
    }))
  }

  const resetNextTask = () => {
    confirmReset('Reset this task list?', hasNextTaskContent, () => {
      setData((prev) => ({
        ...prev,
        taskInput: '',
        tasks: [],
        nextTask: 'Press the button to pick one task.',
      }))
    })
  }

  const resetWindDown = () => {
    confirmReset('Reset this wind-down list?', hasWindDownContent, () => {
      setData((prev) => ({
        ...prev,
        windDown: {
          items: [],
          notes: '',
        },
      }))
    })
  }

  const resetMoneyTracker = () => {
    confirmReset('Reset all invoice entries?', hasMoneyTrackerContent, () => {
      setData((prev) => ({
        ...prev,
        invoiceClient: '',
        invoiceAmount: '',
        invoiceDate: '',
        invoices: [],
      }))
    })
  }

  const resetBrainDump = () => {
    confirmReset('Clear this brain dump?', hasBrainDumpContent, () => {
      setData((prev) => ({
        ...prev,
        brainDumpInput: '',
        sortedBrainDump: emptyBrainDump(),
      }))
    })
  }

  const resetWeeklyReview = () => {
    confirmReset('Reset this weekly review?', hasWeeklyReviewContent, () => {
      setData((prev) => ({
        ...prev,
        weeklyReview: {
          win: '',
          friction: '',
          support: '',
          nextWeek: '',
          boundaries: '',
        },
      }))
    })
  }

  const resetPomodoro = () => {
    if (!hasPomodoroDeviation) {
      return
    }

    setPomodoroRunning(false)
    setPomodoroMode('focus')
    setData((prev) => ({
      ...prev,
      pomodoroSecondsLeft: prev.pomodoroWork * 60,
    }))
  }

  const updateSelfCare = (field: 'water' | 'food' | 'posture') => {
    const now = Date.now()

    setData((prev) => ({
      ...prev,
      selfCare: {
        ...prev.selfCare,
        [field]: !prev.selfCare[field],
        ...(field === 'food' && !prev.selfCare.food ? { lastFoodCheck: now } : {}),
        ...(field === 'water' && !prev.selfCare.water ? { lastWaterCheck: now } : {}),
        lastReset: now,
      },
    }))
  }

  const completeSelfCareReminder = (focus: 'food' | 'water') => {
    const now = Date.now()

    setData((prev) => ({
      ...prev,
      selfCare: {
        ...prev.selfCare,
        [focus]: true,
        ...(focus === 'food' ? { lastFoodCheck: now } : {}),
        ...(focus === 'water' ? { lastWaterCheck: now } : {}),
        lastReset: now,
      },
    }))
  }

  const resetSelfCare = () => {
    confirmReset('Reset this body check-in?', hasSelfCareContent, () => {
      setData((prev) => ({
        ...prev,
        selfCare: {
          water: false,
          food: false,
          posture: false,
          lastFoodCheck: null,
          lastWaterCheck: null,
          lastReset: Date.now(),
        },
      }))
    })
  }

  const dismissTip = (id: ToolId) => {
    setToolTips((prev) => ({ ...prev, [id]: false }))
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to tools
      </a>

      <section className="work-timer-bar" aria-label="Work session tracker">
        <div className="timer-display">
          {data.isWorking ? (
            <>
              <div>
                <p className="timer-label">Today</p>
                <p className="timer-time">{formatDuration(workElapsedSeconds)}</p>
                <p className="timer-meta">Currently working</p>
                <p className="timer-guide">
                  This tracks the whole day, not just the current stretch. Start once, pause for
                  breaks, then resume where you left off.
                </p>
              </div>
            </>
          ) : data.breakStartTime ? (
            <>
              <div>
                <p className="timer-label">Today</p>
                <p className="timer-time">{formatDuration(workElapsedSeconds)}</p>
                <p className="timer-meta">On break for {formatTime(breakElapsedSeconds)}</p>
                <p className="timer-guide">
                  This tracks the whole day, not just the current stretch. Start once, pause for
                  breaks, then resume where you left off.
                </p>
              </div>
            </>
          ) : (
            <div>
              <p className="timer-label">Today</p>
              <p className="timer-time">{formatDuration(workElapsedSeconds)}</p>
              <p className="timer-meta">Ready to start</p>
              <p className="timer-guide">
                This tracks the whole day, not just the current stretch. Start once, pause for
                breaks, then resume where you left off.
              </p>
            </div>
          )}
        </div>
        <div className="timer-controls">
          {!data.isWorking && !data.breakStartTime ? (
            <button type="button" onClick={startWork} className="btn-start">
              Start day
            </button>
          ) : null}
          {data.isWorking ? (
            <>
              <button type="button" onClick={goOnBreak} className="btn-break">
                Take a break
              </button>
              <button type="button" onClick={stopWork} className="btn-stop">
                End day
              </button>
            </>
          ) : null}
          {data.breakStartTime ? (
            <>
              <button type="button" onClick={endBreak} className="btn-resume">
                Resume work
              </button>
              <button type="button" onClick={stopWork} className="btn-stop">
                End day
              </button>
            </>
          ) : null}
        </div>
      </section>

      <section className="timer-info" aria-label="Work timer explanation">
        <p>
          Welcome. This is your Calm Space dashboard, built to reduce overwhelm with clear,
          supportive tools for planning, focus, check-ins, and gentle end-of-day wrap-up.
        </p>
      </section>

      {data.isWorking && selfCareReminder ? (
        <section className="self-care-reminder" aria-label="Self-care reminder" role="note">
          <p className="reminder-text">{selfCareReminder.message}</p>
          <div className="reminder-checklist">
            {selfCareReminder.focus === 'food' ? (
              <label className="reminder-item">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => completeSelfCareReminder('food')}
                />
                <span>Food</span>
              </label>
            ) : null}
            {selfCareReminder.focus === 'water' ? (
              <label className="reminder-item">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => completeSelfCareReminder('water')}
                />
                <span>Water</span>
              </label>
            ) : null}
          </div>
        </section>
      ) : null}

      <header className="hero" id="top">
        <div className="hero-glow" aria-hidden="true"></div>
        <img className="brand-logo" src="/calmspace-logo.svg" alt="Calm Space logo" />
        <p className="eyebrow">Calm Space Toolkit</p>
        <h1>Simple tools for work and daily life.</h1>
        <p className="intro">
          Built for neurodivergent people by neurodivergent people.
        </p>

        <section className="mode-and-theme" aria-label="Choose your setup for today">
          <div className="mode-picker">
            <p>Choose your day mode</p>
            <div className="chip-row">
              {dayModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`chip ${dayMode === mode.id ? 'active-chip' : ''}`}
                  onClick={() => applyDayMode(mode.id)}
                >
                  <strong>{mode.title}</strong>
                  <span>{mode.summary}</span>
                </button>
              ))}
            </div>
            <p className="mode-summary" aria-live="polite">
              {currentDayMode.title}: body doubling {currentDayMode.bodyDouble} min, pomodoro{' '}
              {currentDayMode.focus}/{currentDayMode.rest} min.
            </p>
          </div>

          <div className="theme-picker">
            <p>Theme</p>
            <div className="theme-row">
              {themes.map((themeOption) => (
                <button
                  key={themeOption.id}
                  type="button"
                  className={`theme-chip theme-${themeOption.id} ${
                    theme === themeOption.id ? 'active-theme' : ''
                  }`}
                  onClick={() => setTheme(themeOption.id)}
                >
                  {themeOption.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </header>

      <nav className="jump-nav" aria-label="Jump to a tool">
        <p>Jump to a tool:</p>
        <ul>
          {toolLinks.map((link) => (
            <li key={link.id}>
              <a href={`#${link.id}`}>{link.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <main id="main-content" className="tool-stack">
        <section id="task-chunker" className="tool-panel fade-in" aria-labelledby="chunker-heading">
          <ToolHeading
            id="chunker-heading"
            title="Task splitter"
            copy="Paste a big task and get a short list of small steps."
            icon="chunker"
          />

          {toolTips['task-chunker'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['task-chunker']}</p>
              <button type="button" onClick={() => dismissTip('task-chunker')}>
                Got it
              </button>
            </div>
          ) : null}

          <label>
            Big task
            <textarea
              rows={4}
              placeholder="Example: finish onboarding pack"
              value={data.bigTaskInput}
              onChange={(event) =>
                setData((prev) => ({ ...prev, bigTaskInput: event.target.value }))
              }
            />
          </label>

          <button
            type="button"
            disabled={!hasTaskChunkerContent}
            onClick={() =>
              setData((prev) => ({
                ...prev,
                chunkedSteps: chunkTask(prev.bigTaskInput),
              }))
            }
          >
            Break this into small steps
          </button>

          {data.chunkedSteps.length > 0 ? (
            <ol className="list-output">
              {data.chunkedSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="empty-state">Your step-by-step plan will appear here.</p>
          )}

          <button type="button" className="btn-clear" disabled={!hasTaskChunkerContent} onClick={resetTaskChunker}>
            Reset tool
          </button>
        </section>

        <section id="body-doubling" className="tool-panel fade-in" aria-labelledby="body-double-heading">
          <ToolHeading
            id="body-double-heading"
            title="Body doubling timer"
            copy="Set a timer and work alongside a calm visual companion."
            icon="double"
          />

          {toolTips['body-doubling'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['body-doubling']}</p>
              <button type="button" onClick={() => dismissTip('body-doubling')}>
                Got it
              </button>
            </div>
          ) : null}

          <div className="ambient" aria-hidden="true">
            <span className="orb orb-a"></span>
            <span className="orb orb-b"></span>
            <span className="orb orb-c"></span>
          </div>

          <div className="double-input">
            <label>
              Session length (minutes)
              <input
                type="number"
                min={5}
                max={180}
                value={data.bodyDoubleMinutes}
                onChange={(event) => {
                  const next = clampNumber(Number(event.target.value), 5, 180)

                  setData((prev) => ({
                    ...prev,
                    bodyDoubleMinutes: next,
                    bodyDoubleSecondsLeft: next * 60,
                  }))
                  setBodyDoubleRunning(false)
                }}
              />
            </label>
          </div>

          <p className="timer" aria-live="polite">
            {formatTime(data.bodyDoubleSecondsLeft)}
          </p>

          <div className="presence-card" aria-live="polite">
            <p className="presence-title">
              <span
                className={`presence-dot ${bodyDoubleRunning ? 'presence-dot-active' : ''}`}
                aria-hidden="true"
              ></span>
              {bodyDoubleRunning ? 'Working together now' : 'Companion waiting'}
            </p>
            <p className="presence-line">{bodyDoubleCompanionLine}</p>
            <div className="presence-track" aria-hidden="true">
              <span style={{ width: `${bodyDoubleProgress}%` }}></span>
            </div>
          </div>

          <div className="button-row">
            <button type="button" onClick={() => setBodyDoubleRunning(true)}>
              Start
            </button>
            <button type="button" onClick={() => setBodyDoubleRunning(false)}>
              Pause
            </button>
            <button type="button" className="btn-clear" disabled={!hasBodyDoublingDeviation} onClick={resetBodyDoubling}>
              Reset tool
            </button>
          </div>
        </section>

        <section id="next-task" className="tool-panel fade-in" aria-labelledby="next-task-heading">
          <ToolHeading
            id="next-task-heading"
            title="Pick my next task"
            copy="Add tasks, then pick one next action."
            icon="next"
          />

          {toolTips['next-task'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['next-task']}</p>
              <button type="button" onClick={() => dismissTip('next-task')}>
                Got it
              </button>
            </div>
          ) : null}

          <div className="inline-input">
            <label>
              Add a task
              <input
                type="text"
                placeholder="Example: reply to Sam"
                value={data.taskInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    addTask()
                  }
                }}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, taskInput: event.target.value }))
                }
              />
            </label>
            <button type="button" disabled={!canAddTask} onClick={addTask}>
              Add task
            </button>
          </div>

          <div className="button-row">
            <button type="button" disabled={!hasOpenTasks} onClick={pickNextTask}>
              Pick my next task
            </button>
            <button type="button" disabled={!hasCompletedTasks} onClick={clearDoneTasks}>
              Clear completed
            </button>
          </div>

          <p className="next-task" aria-live="polite">
            {data.nextTask}
          </p>

          {data.tasks.length > 0 ? (
            <ul className="checklist">
              {data.tasks.map((task) => (
                <li key={task.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() =>
                        setData((prev) => ({
                          ...prev,
                          tasks: prev.tasks.map((item) =>
                            item.id === task.id ? { ...item, done: !item.done } : item,
                          ),
                        }))
                      }
                    />
                    <span>{task.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Add a few tasks, then let this tool pick one for you.</p>
          )}

          <button type="button" className="btn-clear" disabled={!hasNextTaskContent} onClick={resetNextTask}>
            Reset tool
          </button>
        </section>

        <section id="transition-helper" className="tool-panel fade-in" aria-labelledby="transition-heading">
          <ToolHeading
            id="transition-heading"
            title="Transition helper"
            copy="A tiny checklist to switch tasks without losing your place."
            icon="transition"
          />

          {toolTips['transition-helper'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['transition-helper']}</p>
              <button type="button" onClick={() => dismissTip('transition-helper')}>
                Got it
              </button>
            </div>
          ) : null}

          <p className="meta-line">Progress: {transitionProgress}/4 checks</p>

          <ul className="checklist">
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={data.transitionHelper.savedWork}
                  onChange={() =>
                    setData((prev) => ({
                      ...prev,
                      transitionHelper: {
                        ...prev.transitionHelper,
                        savedWork: !prev.transitionHelper.savedWork,
                      },
                    }))
                  }
                />
                <span>Saved current work</span>
              </label>
            </li>
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={data.transitionHelper.wroteNext}
                  onChange={() =>
                    setData((prev) => ({
                      ...prev,
                      transitionHelper: {
                        ...prev.transitionHelper,
                        wroteNext: !prev.transitionHelper.wroteNext,
                      },
                    }))
                  }
                />
                <span>Wrote one next step</span>
              </label>
            </li>
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={data.transitionHelper.movedBody}
                  onChange={() =>
                    setData((prev) => ({
                      ...prev,
                      transitionHelper: {
                        ...prev.transitionHelper,
                        movedBody: !prev.transitionHelper.movedBody,
                      },
                    }))
                  }
                />
                <span>Stood up or stretched</span>
              </label>
            </li>
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={data.transitionHelper.startedNext}
                  onChange={() =>
                    setData((prev) => ({
                      ...prev,
                      transitionHelper: {
                        ...prev.transitionHelper,
                        startedNext: !prev.transitionHelper.startedNext,
                      },
                    }))
                  }
                />
                <span>Started the first minute of the next task</span>
              </label>
            </li>
          </ul>

          <label>
            Next step note
            <input
              type="text"
              placeholder="Example: Open draft and write intro"
              value={data.transitionHelper.nextTaskNote}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  transitionHelper: {
                    ...prev.transitionHelper,
                    nextTaskNote: event.target.value,
                  },
                }))
              }
            />
          </label>

          <button type="button" className="btn-clear" disabled={!hasTransitionContent} onClick={resetTransitionHelper}>
            Reset tool
          </button>
        </section>

        <section id="stuck-rescue" className="tool-panel fade-in" aria-labelledby="stuck-heading">
          <ToolHeading
            id="stuck-heading"
            title="Stuck rescue"
            copy="When you freeze, choose one tiny move and commit for 10 minutes."
            icon="rescue"
          />

          {toolTips['stuck-rescue'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['stuck-rescue']}</p>
              <button type="button" onClick={() => dismissTip('stuck-rescue')}>
                Got it
              </button>
            </div>
          ) : null}

          <label>
            What are you stuck on?
            <textarea
              rows={3}
              placeholder="Example: I keep avoiding starting the report"
              value={data.stuckRescue.challenge}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  stuckRescue: { ...prev.stuckRescue, challenge: event.target.value },
                }))
              }
            />
          </label>

          <div className="button-row">
            <button type="button" onClick={chooseRescueAction}>
              Pick one tiny move
            </button>
            <button
              type="button"
              onClick={() => {
                setStuckRescueSecondsLeft(10 * 60)
                setData((prev) => ({
                  ...prev,
                  stuckRescue: { ...prev.stuckRescue, startedAt: Date.now() },
                }))
              }}
              disabled={!data.stuckRescue.chosenAction}
            >
              Start 10 min focus
            </button>
          </div>

          {data.stuckRescue.chosenAction ? (
            <p className="next-task" aria-live="polite">
              Do this now: {data.stuckRescue.chosenAction}
            </p>
          ) : (
            <p className="empty-state">Press the button to get a tiny action.</p>
          )}

          {data.stuckRescue.startedAt ? (
            <p className="meta-line" aria-live="polite">
              10-minute commitment: {formatTime(stuckRescueSecondsLeft)} left
            </p>
          ) : null}

          <button type="button" className="btn-clear" disabled={!hasRescueContent} onClick={resetStuckRescue}>
            Reset tool
          </button>
        </section>

        <section id="time-anchor" className="tool-panel fade-in" aria-labelledby="anchor-heading">
          <ToolHeading
            id="anchor-heading"
            title="Time anchor"
            copy="Gentle local-time nudges while you work so hours do not disappear."
            icon="anchor"
          />

          {toolTips['time-anchor'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['time-anchor']}</p>
              <button type="button" onClick={() => dismissTip('time-anchor')}>
                Got it
              </button>
            </div>
          ) : null}

          <div className="double-input">
            <label>
              Check-in every (minutes)
              <input
                type="number"
                min={10}
                max={120}
                value={data.timeAnchor.intervalMinutes}
                onChange={(event) => {
                  const next = clampNumber(Number(event.target.value), 10, 120)
                  setData((prev) => ({
                    ...prev,
                    timeAnchor: { ...prev.timeAnchor, intervalMinutes: next },
                  }))
                }}
              />
            </label>

            <label>
              What are you working on?
              <input
                type="text"
                placeholder="Example: design homepage"
                value={data.timeAnchor.taskLabel}
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    timeAnchor: { ...prev.timeAnchor, taskLabel: event.target.value },
                  }))
                }
              />
            </label>
          </div>

          {data.timeAnchor.lastPromptText ? (
            <p className="next-task" aria-live="polite">
              {data.timeAnchor.lastPromptText}
            </p>
          ) : (
            <p className="empty-state">Start your day timer to begin gentle time check-ins.</p>
          )}

          <button type="button" className="btn-clear" disabled={!hasAnchorContent} onClick={resetTimeAnchor}>
            Reset tool
          </button>
        </section>

        <section id="money-tracker" className="tool-panel fade-in" aria-labelledby="finance-heading">
          <ToolHeading
            id="finance-heading"
            title="Track invoices you sent"
            copy="Log who you billed, how much, and whether it has been paid yet."
            icon="money"
          />

          {toolTips['money-tracker'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['money-tracker']}</p>
              <button type="button" onClick={() => dismissTip('money-tracker')}>
                Got it
              </button>
            </div>
          ) : null}

          <div className="triple-input">
            <label>
              Client
              <input
                type="text"
                placeholder="Client name"
                value={data.invoiceClient}
                onKeyDown={handleInvoiceEnter}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, invoiceClient: event.target.value }))
                }
              />
            </label>
            <label>
              Amount
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={data.invoiceAmount}
                onKeyDown={handleInvoiceEnter}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, invoiceAmount: event.target.value }))
                }
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={data.invoiceDate}
                onKeyDown={handleInvoiceEnter}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, invoiceDate: event.target.value }))
                }
              />
            </label>
          </div>

          <button type="button" disabled={!canAddInvoice} onClick={addInvoice}>
            Save entry
          </button>

          <div className="finance-summary">
            <p>Total tracked: {formatCurrency(totals.total)}</p>
            <p>Paid: {formatCurrency(totals.paid)}</p>
            <p>Outstanding: {formatCurrency(totals.outstanding)}</p>
          </div>

          {data.invoices.length > 0 ? (
            <ul className="invoice-list">
              {data.invoices.map((invoice) => (
                <li key={invoice.id}>
                  <p>
                    {invoice.client} - {formatCurrency(invoice.amount)} ({invoice.date})
                  </p>
                  <div className="invoice-actions">
                    <button
                      type="button"
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          invoices: prev.invoices.map((item) =>
                            item.id === invoice.id ? { ...item, paid: !item.paid } : item,
                          ),
                        }))
                      }
                    >
                      {invoice.paid ? 'Marked paid' : 'Mark as paid'}
                    </button>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          invoices: prev.invoices.filter((item) => item.id !== invoice.id),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No entries yet. Add one to start tracking.</p>
          )}

          <button type="button" className="btn-clear" disabled={!hasMoneyTrackerContent} onClick={resetMoneyTracker}>
            Reset tool
          </button>
        </section>

        <section id="brain-dump" className="tool-panel fade-in" aria-labelledby="brain-dump-heading">
          <ToolHeading
            id="brain-dump-heading"
            title="Brain dump and auto-sort"
            copy="Write everything down, then sort it in one click."
            icon="dump"
          />

          {toolTips['brain-dump'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['brain-dump']}</p>
              <button type="button" onClick={() => dismissTip('brain-dump')}>
                Got it
              </button>
            </div>
          ) : null}

          <label>
            Brain dump
            <textarea
              rows={7}
              placeholder="One thought per line works best."
              value={data.brainDumpInput}
              onChange={(event) =>
                setData((prev) => ({ ...prev, brainDumpInput: event.target.value }))
              }
            />
          </label>

          <button
            type="button"
            disabled={data.brainDumpInput.trim().length === 0}
            onClick={() =>
              setData((prev) => ({
                ...prev,
                sortedBrainDump: sortBrainDump(prev.brainDumpInput),
              }))
            }
          >
            Sort into categories
          </button>

          {totalBrainDumpItems > 0 ? (
            <>
              <p className="meta-line">{totalBrainDumpItems} items sorted</p>
              <div className="sort-grid">
                {Object.entries(data.sortedBrainDump).map(([group, entries]) => (
                  <article key={group}>
                    <h3>{group.charAt(0).toUpperCase() + group.slice(1)}</h3>
                    <ul>
                      {entries.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">Your categorized list will appear here.</p>
          )}

          <button type="button" className="btn-clear" disabled={!hasBrainDumpContent} onClick={resetBrainDump}>
            Reset tool
          </button>
        </section>

        <section id="weekly-review" className="tool-panel fade-in" aria-labelledby="weekly-heading">
          <ToolHeading
            id="weekly-heading"
            title="Weekly review prompts"
            copy="Quick prompts to review your week."
            icon="review"
          />

          {toolTips['weekly-review'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['weekly-review']}</p>
              <button type="button" onClick={() => dismissTip('weekly-review')}>
                Got it
              </button>
            </div>
          ) : null}

          <p className="meta-line">Progress: {weeklyProgress}/5 prompts answered</p>

          <label>
            What felt good this week?
            <textarea
              rows={2}
              value={data.weeklyReview.win}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  weeklyReview: { ...prev.weeklyReview, win: event.target.value },
                }))
              }
            />
          </label>

          <label>
            What felt sticky or heavy?
            <textarea
              rows={2}
              value={data.weeklyReview.friction}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  weeklyReview: { ...prev.weeklyReview, friction: event.target.value },
                }))
              }
            />
          </label>

          <label>
            What support would make next week easier?
            <textarea
              rows={2}
              value={data.weeklyReview.support}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  weeklyReview: { ...prev.weeklyReview, support: event.target.value },
                }))
              }
            />
          </label>

          <label>
            Top priorities for next week
            <textarea
              rows={2}
              value={data.weeklyReview.nextWeek}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  weeklyReview: { ...prev.weeklyReview, nextWeek: event.target.value },
                }))
              }
            />
          </label>

          <label>
            One boundary that protects your energy
            <textarea
              rows={2}
              value={data.weeklyReview.boundaries}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  weeklyReview: { ...prev.weeklyReview, boundaries: event.target.value },
                }))
              }
            />
          </label>

          <button type="button" className="btn-clear" disabled={!hasWeeklyReviewContent} onClick={resetWeeklyReview}>
            Reset tool
          </button>
        </section>

        <section id="pomodoro" className="tool-panel fade-in" aria-labelledby="pomodoro-heading">
          <ToolHeading
            id="pomodoro-heading"
            title="Flexible pomodoro"
            copy="Focus timer with adjustable rest."
            icon="pomo"
          />

          {toolTips.pomodoro ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText.pomodoro}</p>
              <button type="button" onClick={() => dismissTip('pomodoro')}>
                Got it
              </button>
            </div>
          ) : null}

          <div className="double-input">
            <label>
              Focus minutes
              <input
                type="number"
                min={10}
                max={90}
                value={data.pomodoroWork}
                onChange={(event) => {
                  const next = clampNumber(Number(event.target.value), 10, 90)

                  setData((prev) => ({
                    ...prev,
                    pomodoroWork: next,
                    pomodoroSecondsLeft:
                      pomodoroMode === 'focus' ? next * 60 : prev.pomodoroSecondsLeft,
                  }))
                }}
              />
            </label>

            <label>
              Rest minutes
              <input
                type="number"
                min={5}
                max={45}
                value={data.pomodoroRest}
                onChange={(event) => {
                  const next = clampNumber(Number(event.target.value), 5, 45)

                  setData((prev) => ({
                    ...prev,
                    pomodoroRest: next,
                    pomodoroSecondsLeft:
                      pomodoroMode === 'rest' ? next * 60 : prev.pomodoroSecondsLeft,
                  }))
                }}
              />
            </label>
          </div>

          <p className="mode-label">Current mode: {pomodoroMode === 'focus' ? 'Focus' : 'Rest'}</p>

          <p className="timer" aria-live="polite">
            {formatTime(data.pomodoroSecondsLeft)}
          </p>

          <div className="button-row">
            <button type="button" onClick={() => setPomodoroRunning(true)}>
              Start
            </button>
            <button type="button" onClick={() => setPomodoroRunning(false)}>
              Pause
            </button>
            <button
              type="button"
              onClick={() => {
                setPomodoroRunning(false)
                setPomodoroMode(pomodoroMode === 'focus' ? 'rest' : 'focus')
                setData((prev) => ({
                  ...prev,
                  pomodoroSecondsLeft:
                    pomodoroMode === 'focus' ? prev.pomodoroRest * 60 : prev.pomodoroWork * 60,
                }))
              }}
            >
              Skip to {pomodoroMode === 'focus' ? 'rest' : 'focus'}
            </button>
            <button
              type="button"
              className="btn-clear"
              disabled={!hasPomodoroDeviation}
              onClick={resetPomodoro}
            >
              Reset tool
            </button>
          </div>
        </section>

        <section id="self-care" className="tool-panel fade-in" aria-labelledby="selfcare-heading">
          <ToolHeading
            id="selfcare-heading"
            title="Body check-in"
            copy="A quick place to keep track of water, food, and posture through the day."
            icon="selfcare"
          />

          {toolTips['self-care'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['self-care']}</p>
              <button type="button" onClick={() => dismissTip('self-care')}>
                Got it
              </button>
            </div>
          ) : null}

          <p className="meta-line">{selfCareStatus}</p>

          <ul className="checklist">
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={data.selfCare.water}
                  onChange={() => updateSelfCare('water')}
                />
                <span>Had some water</span>
              </label>
            </li>
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={data.selfCare.food}
                  onChange={() => updateSelfCare('food')}
                />
                <span>Ate something</span>
              </label>
            </li>
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={data.selfCare.posture}
                  onChange={() => updateSelfCare('posture')}
                />
                <span>Stretched or checked posture</span>
              </label>
            </li>
          </ul>

          <button type="button" className="btn-clear" disabled={!hasSelfCareContent} onClick={resetSelfCare}>
            Reset tool
          </button>
        </section>

        <section id="wind-down" className="tool-panel fade-in" aria-labelledby="wind-down-heading">
          <ToolHeading
            id="wind-down-heading"
            title="End-of-day wind-down"
            copy="A short checklist to close your workday."
            icon="winddown"
          />

          {toolTips['wind-down'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['wind-down']}</p>
              <button type="button" onClick={() => dismissTip('wind-down')}>
                Got it
              </button>
            </div>
          ) : null}

          <div className="inline-input">
            <label>
              Add checklist item
              <input
                type="text"
                placeholder="Example: Send final emails"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    if (event.currentTarget.value.trim()) {
                      addWindDownItem(event.currentTarget.value)
                      event.currentTarget.value = ''
                    }
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={(event) => {
                const field = event.currentTarget.previousElementSibling?.querySelector('input')
                if (!(field instanceof HTMLInputElement) || !field.value.trim()) {
                  return
                }

                addWindDownItem(field.value)
                field.value = ''
              }}
            >
              Add item
            </button>
          </div>

          <p className="meta-line">Press Enter or use the button to add each item.</p>

          {data.windDown.items.length > 0 ? (
            <>
              <p className="meta-line">Progress: {windDownProgress}/{data.windDown.items.length} checked</p>
              <ul className="checklist">
                {data.windDown.items.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() =>
                          setData((prev) => ({
                            ...prev,
                            windDown: {
                              ...prev.windDown,
                              items: prev.windDown.items.map((i) =>
                                i.id === item.id ? { ...i, done: !i.done } : i,
                              ),
                            },
                          }))
                        }
                      />
                      <span>{item.text}</span>
                    </label>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          windDown: {
                            ...prev.windDown,
                            items: prev.windDown.items.filter((i) => i.id !== item.id),
                          },
                        }))
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="empty-state">No items yet. Add one to start building your checklist.</p>
          )}

          <label>
            Message to future-you
            <textarea
              rows={3}
              placeholder="Example: Start with invoice before opening chat."
              value={data.windDown.notes}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  windDown: { ...prev.windDown, notes: event.target.value },
                }))
              }
            />
          </label>

          <button type="button" className="btn-clear" disabled={!hasWindDownContent} onClick={resetWindDown}>
            Reset tool
          </button>
        </section>
      </main>

      <section className="support-note" aria-label="Support this project">
        <h2>Support This Project</h2>
        <p>
          If this toolkit helps you, you can support it on Ko-fi. Donations help cover hosting,
          updates, and new tools. No pressure at all. Use it freely either way.
        </p>
        <a className="donate" href="https://ko-fi.com/loismakeswebsites" target="_blank" rel="noreferrer">
          Support on Ko-fi
        </a>
        <p className="site-credit">Built by loismakeswebsites</p>
      </section>
    </div>
  )
}

export default App
