import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import './App.css'
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

type BrainDumpItem = {
  id: string
  text: string
  triage: 'today' | 'later' | 'release' | null
}

type WindDownItem = {
  id: number
  text: string
  done: boolean
}

type WindDown = {
  items: WindDownItem[]
  notes: string
  noteWrittenDate: string | null
  noteShown: boolean
}

type SelfCare = {
  water: boolean
  food: boolean
  posture: boolean
  lastFoodCheck: number | null
  lastWaterCheck: number | null
  foodReminderSnoozeUntil: number | null
  waterReminderSnoozeUntil: number | null
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
  displayName: string
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
  brainDumpItems: BrainDumpItem[]
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
type ToolView = 'all' | 'single'

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
const ESSENTIALS_ONLY_KEY = `${STORAGE_PREFIX}:essentials-only`
const TOOL_VIEW_KEY = `${STORAGE_PREFIX}:tool-view`
const SINGLE_TOOL_KEY = `${STORAGE_PREFIX}:single-tool`

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

const defaultCollapsedTools = (): Record<ToolId, boolean> => ({
  'task-chunker': true,
  'body-doubling': true,
  'next-task': false,
  'transition-helper': true,
  'stuck-rescue': true,
  'time-anchor': true,
  'money-tracker': true,
  'brain-dump': true,
  'weekly-review': true,
  pomodoro: true,
  'self-care': true,
  'wind-down': true,
})

const essentialToolIds: ToolId[] = [
  'task-chunker',
  'body-doubling',
  'next-task',
  'stuck-rescue',
  'wind-down',
]

const toolTipsText: Record<ToolId, string> = {
  'task-chunker':
    'Write it however it comes out. We will turn it into small, doable steps.',
  'body-doubling':
    'Pick a short session and start. Pause whenever you need to.',
  'next-task': 'Keep this list short. The button picks one next step for you.',
  'transition-helper':
    'Use this quick checklist when switching tasks so your brain can catch up.',
  'stuck-rescue':
    'If you feel stuck, pick one tiny move and do just 10 minutes.',
  'time-anchor':
    'Get gentle time nudges while you work, so hours do not disappear.',
  'wind-down':
    'Use this to close your day without overthinking it.',
  'money-tracker':
    'Log invoices as you send them so you can quickly see what is paid and what is not.',
  'brain-dump': 'Get it all out, then sort each thought: do today, park for later, or let go.',
  'weekly-review':
    'Short answers are enough. Just notice what helped and what did not.',
  pomodoro: 'Set your focus and rest times to match your energy today.',
  'self-care': 'A quick check for water, food, and posture while you work.',
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
    summary: 'Lower pressure and ease into the day.',
    bodyDouble: 20,
    focus: 25,
    rest: 10,
  },
  {
    id: 'focus',
    title: 'Deep Focus',
    summary: 'Longer focus blocks for priority work.',
    bodyDouble: 45,
    focus: 50,
    rest: 15,
  },
  {
    id: 'recovery',
    title: 'Recovery Mode',
    summary: 'Protect your energy and keep things manageable.',
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
  displayName: '',
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
    noteWrittenDate: null,
    noteShown: false,
  },
  invoiceClient: '',
  invoiceAmount: '',
  invoiceDate: '',
  invoices: [],
  brainDumpInput: '',
  brainDumpItems: [],
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
    foodReminderSnoozeUntil: null,
    waterReminderSnoozeUntil: null,
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

const loadStoredEssentialsOnly = (): boolean => {
  try {
    const raw = localStorage.getItem(ESSENTIALS_ONLY_KEY)
    if (raw === null) {
      return true
    }

    return raw === 'true'
  } catch {
    // Silently fail
  }

  return true
}

const loadStoredToolView = (): ToolView => {
  try {
    const raw = localStorage.getItem(TOOL_VIEW_KEY)
    if (raw === 'all') {
      return 'all'
    }

    return 'single'
  } catch {
    // Silently fail
  }

  return 'single'
}

const loadStoredSingleTool = (): ToolId => {
  try {
    const storedTool = localStorage.getItem(SINGLE_TOOL_KEY)
    if (storedTool && toolLinks.some((tool) => tool.id === storedTool)) {
      return storedTool as ToolId
    }
  } catch {
    // Silently fail
  }

  return 'next-task'
}

const getToolViewFromUrl = (): { view: ToolView | null; tool: ToolId | null } => {
  try {
    const params = new URLSearchParams(window.location.search)
    const viewParam = params.get('view')
    const toolParam = params.get('tool')
    const view = viewParam === 'single' ? 'single' : null
    const tool = toolParam && toolLinks.some((item) => item.id === toolParam)
      ? (toolParam as ToolId)
      : null

    return { view, tool }
  } catch {
    return { view: null, tool: null }
  }
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
            brainDumpItems: parsed.brainDumpItems ?? [],
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
  'You do not need to finish everything. Just this step.',
  'If you got distracted, welcome back. Start again now.',
  'Breathe, then continue for 2 more minutes.',
  'Quiet progress still counts.',
]

const formatClock = (timestamp: number) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)

const lowercaseFirst = (text: string) => {
  if (!text) {
    return text
  }

  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`
}

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
  toolId,
  id,
  title,
  copy,
  icon,
  category,
  showCollapseToggle,
  isCollapsed,
  onToggleCollapse,
}: {
  toolId: ToolId
  id: string
  title: string
  copy: string
  icon: ToolIconName
  category: string
  showCollapseToggle?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}) {
  return (
    <div className="panel-head">
      <p className="tool-category">{category}</p>
      <div className="panel-title-row">
        <span className="tool-icon-wrap">
          <ToolIcon name={icon} />
        </span>
        <h2 id={id}>{title}</h2>
      </div>
      <p>{copy}</p>
      {showCollapseToggle && onToggleCollapse ? (
        <button
          type="button"
          className="panel-collapse-toggle btn-secondary"
          onClick={onToggleCollapse}
          aria-expanded={!isCollapsed}
          aria-controls={toolId}
        >
          {isCollapsed ? 'Show details' : 'Hide details'}
        </button>
      ) : null}
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
  const [activeTool, setActiveTool] = useState<ToolId>('task-chunker')
  const [brainDumpReviewing, setBrainDumpReviewing] = useState(false)
  const [selfCareModalFocus, setSelfCareModalFocus] = useState<'food' | 'water' | null>(null)
  const [essentialsOnly, setEssentialsOnly] = useState<boolean>(() => loadStoredEssentialsOnly())
  const [toolView, setToolView] = useState<ToolView>(() => loadStoredToolView())
  const [singleToolId, setSingleToolId] = useState<ToolId>(() => loadStoredSingleTool())
  const [collapsedTools, setCollapsedTools] = useState<Record<ToolId, boolean>>(() => defaultCollapsedTools())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(DAY_MODE_KEY, dayMode)
  }, [dayMode])

  useEffect(() => {
    try {
      localStorage.setItem(ESSENTIALS_ONLY_KEY, String(essentialsOnly))
    } catch {
      // Silently fail if storage is unavailable
    }
  }, [essentialsOnly])

  useEffect(() => {
    try {
      localStorage.setItem(TOOL_VIEW_KEY, toolView)
      localStorage.setItem(SINGLE_TOOL_KEY, singleToolId)
    } catch {
      // Silently fail if storage is unavailable
    }
  }, [toolView, singleToolId])

  useEffect(() => {
    const fromUrl = getToolViewFromUrl()
    if (fromUrl.tool) {
      setSingleToolId(fromUrl.tool)
    }
    if (fromUrl.view === 'single') {
      setToolView('single')
    }
  }, [])

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (toolView === 'single') {
        url.searchParams.set('view', 'single')
        url.searchParams.set('tool', singleToolId)
      } else {
        url.searchParams.delete('view')
        url.searchParams.delete('tool')
      }

      const nextUrl = `${url.pathname}${url.search}${url.hash}`
      window.history.replaceState(null, '', nextUrl)
    } catch {
      // Silently fail
    }
  }, [toolView, singleToolId])

  const visibleToolLinks = useMemo(
    () =>
      essentialsOnly
        ? toolLinks.filter((tool) => essentialToolIds.includes(tool.id))
        : toolLinks,
    [essentialsOnly],
  )

  const isToolVisible = (toolId: ToolId) => !essentialsOnly || essentialToolIds.includes(toolId)
  const isToolVisibleInLayout =
    (toolId: ToolId) => isToolVisible(toolId) && (toolView === 'all' || singleToolId === toolId)

  const isCollapsedInAllView = (toolId: ToolId) => toolView === 'all' && collapsedTools[toolId]

  const getToolPanelClass = (toolId: ToolId) =>
    `tool-panel fade-in ${isToolVisibleInLayout(toolId) ? '' : 'tool-hidden'} ${isCollapsedInAllView(toolId) ? 'collapsed-panel' : ''}`

  const toggleToolCollapsed = (toolId: ToolId) => {
    setCollapsedTools((prev) => ({ ...prev, [toolId]: !prev[toolId] }))
  }

  const getHeadingControls = (toolId: ToolId) => ({
    toolId,
    showCollapseToggle: toolView === 'all',
    isCollapsed: collapsedTools[toolId],
    onToggleCollapse: () => toggleToolCollapsed(toolId),
  })

  const openSingleTool = (toolId: ToolId) => {
    setSingleToolId(toolId)
    setActiveTool(toolId)
    setToolView('single')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
        const prompt = prev.displayName.trim().length > 0
          ? `It is ${formatClock(now)}, ${prev.displayName.trim()}. Still on ${taskText}?`
          : `It is ${formatClock(now)}. Still on ${taskText}?`

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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((entryA, entryB) => entryB.intersectionRatio - entryA.intersectionRatio)

        if (visibleEntries.length > 0) {
          setActiveTool(visibleEntries[0].target.id as ToolId)
        }
      },
      {
        rootMargin: '-18% 0px -55% 0px',
        threshold: [0.2, 0.35, 0.5, 0.7],
      },
    )

    visibleToolLinks.forEach((tool) => {
      const element = document.getElementById(tool.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [visibleToolLinks])

  useEffect(() => {
    if (!visibleToolLinks.some((tool) => tool.id === activeTool)) {
      setActiveTool(visibleToolLinks[0]?.id ?? 'task-chunker')
    }
  }, [visibleToolLinks, activeTool])

  useEffect(() => {
    if (toolView === 'single' && !visibleToolLinks.some((tool) => tool.id === singleToolId)) {
      setSingleToolId(visibleToolLinks[0]?.id ?? 'task-chunker')
    }
  }, [toolView, visibleToolLinks, singleToolId])

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

  const pendingBrainDumpItems = data.brainDumpItems.filter((i) => i.triage === null)
  const todayBrainDumpItems = data.brainDumpItems.filter((i) => i.triage === 'today')
  const laterBrainDumpItems = data.brainDumpItems.filter((i) => i.triage === 'later')
  const releaseBrainDumpItems = data.brainDumpItems.filter((i) => i.triage === 'release')

  const bodyDoubleProgress = useMemo(() => {
    const total = Math.max(1, data.bodyDoubleMinutes * 60)
    const elapsed = total - data.bodyDoubleSecondsLeft
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  }, [data.bodyDoubleMinutes, data.bodyDoubleSecondsLeft])

  const bodyDoubleCompanionLine = useMemo(() => {
    if (!bodyDoubleRunning) {
      const baseLine = 'Press Start when ready. I will stay here with you.'
      return data.displayName.trim().length > 0
        ? `${data.displayName.trim()}, ${lowercaseFirst(baseLine)}`
        : baseLine
    }

    const elapsed = data.bodyDoubleMinutes * 60 - data.bodyDoubleSecondsLeft
    const index = Math.floor(Math.max(0, elapsed) / 90) % companionLines.length
    const baseLine = companionLines[index]
    return data.displayName.trim().length > 0
      ? `${data.displayName.trim()}, ${lowercaseFirst(baseLine)}`
      : baseLine
  }, [bodyDoubleRunning, data.bodyDoubleMinutes, data.bodyDoubleSecondsLeft, data.displayName])

  const selfCareReminder = getSelfCareReminder({
    lastFoodCheck: data.selfCare.lastFoodCheck,
    lastWaterCheck: data.selfCare.lastWaterCheck,
  })
  const todayDateKey = new Date().toISOString().slice(0, 10)
  const preferredName = data.displayName.trim()
  const reminderSnoozeUntil = selfCareReminder
    ? selfCareReminder.focus === 'food'
      ? data.selfCare.foodReminderSnoozeUntil
      : data.selfCare.waterReminderSnoozeUntil
    : null
  const isSelfCareReminderDue =
    Boolean(data.isWorking && selfCareReminder) &&
    (!reminderSnoozeUntil || Date.now() >= reminderSnoozeUntil)
  const selfCareModalText =
    selfCareModalFocus === 'food'
      ? 'Quick check-in. Have you had something to eat?'
      : 'Quick check-in. Have you had some water recently?'
  const selfCareStatus = formatLastCheck(data.selfCare.lastReset)

  useEffect(() => {
    if (!data.isWorking || !selfCareReminder) {
      setSelfCareModalFocus(null)
      return
    }

    if (isSelfCareReminderDue) {
      setSelfCareModalFocus(selfCareReminder.focus)
    }
  }, [
    data.isWorking,
    selfCareReminder?.focus,
    isSelfCareReminderDue,
    workElapsedSeconds,
    breakElapsedSeconds,
  ])

  const noteWrittenDate = data.windDown.noteWrittenDate
  const showFutureYouNote = noteWrittenDate
    ? data.windDown.notes.trim().length > 0 &&
      noteWrittenDate < todayDateKey &&
      !data.windDown.noteShown
    : false
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
  const hasBrainDumpContent = data.brainDumpInput.trim().length > 0 || data.brainDumpItems.length > 0
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
  const currentToolId = toolView === 'single' ? singleToolId : activeTool
  const activeToolLabel =
    visibleToolLinks.find((link) => link.id === currentToolId)?.label ?? visibleToolLinks[0].label
  const activeToolIndex = Math.max(
    0,
    visibleToolLinks.findIndex((link) => link.id === currentToolId),
  )
  const journeyPercent = ((activeToolIndex + 1) / Math.max(1, visibleToolLinks.length)) * 100
  const prevToolId = activeToolIndex > 0 ? visibleToolLinks[activeToolIndex - 1].id : null
  const nextToolId =
    activeToolIndex < visibleToolLinks.length - 1 ? visibleToolLinks[activeToolIndex + 1].id : null
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
    const actions = getRescueActions()
    const index = Math.floor(Math.random() * actions.length)
    const chosen = actions[index]

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
          noteWrittenDate: null,
          noteShown: false,
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
        brainDumpItems: [],
      }))
      setBrainDumpReviewing(false)
    })
  }

  const startBrainDumpTriage = () => {
    // Parse free-form text: handle newlines, bullet lists, and sentence boundaries
    const raw = data.brainDumpInput
    const segments = raw.split('\n').map((l) => l.trim()).filter(Boolean)

    const items: string[] = []
    for (const seg of segments) {
      // Strip common list markers: "- ", "* ", "• ", "1. ", "2) " etc.
      const stripped = seg.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '')
      // Split on sentence boundaries (. ! ? followed by a space and a letter)
      // This avoids splitting "e.g. " or "..." unnecessarily
      const sentences = stripped
        .split(/[.!?]\s+(?=[^\s])/)
        .map((s) => s.replace(/[.!?,;]+$/, '').trim())
        .filter((s) => s.length > 1)
      items.push(...(sentences.length > 1 ? sentences : [stripped.replace(/[.!?,;]+$/, '').trim()].filter((s) => s.length > 1)))
    }

    setData((prev) => ({
      ...prev,
      brainDumpItems: items.map((text) => ({
        id: `${Date.now()}-${Math.random()}`,
        text,
        triage: null,
      })),
    }))
    setBrainDumpReviewing(true)
  }

  const confirmBrainDumpReview = () => setBrainDumpReviewing(false)

  const removeBrainDumpReviewItem = (id: string) => {
    setData((prev) => ({
      ...prev,
      brainDumpItems: prev.brainDumpItems.filter((item) => item.id !== id),
    }))
  }

  const triageItem = (id: string, triage: 'today' | 'later' | 'release') => {
    setData((prev) => ({
      ...prev,
      brainDumpItems: prev.brainDumpItems.map((item) =>
        item.id === id ? { ...item, triage } : item,
      ),
    }))
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
        ...(field === 'food' ? { foodReminderSnoozeUntil: null } : {}),
        ...(field === 'water' ? { waterReminderSnoozeUntil: null } : {}),
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
        ...(focus === 'food'
          ? { lastFoodCheck: now, foodReminderSnoozeUntil: null }
          : { lastWaterCheck: now, waterReminderSnoozeUntil: null }),
        lastReset: now,
      },
    }))
    setSelfCareModalFocus(null)
  }

  const snoozeSelfCareReminder = (focus: 'food' | 'water') => {
    const now = Date.now()
    const snoozeUntil = now + 30 * 60 * 1000

    setData((prev) => ({
      ...prev,
      selfCare: {
        ...prev.selfCare,
        ...(focus === 'food'
          ? { foodReminderSnoozeUntil: snoozeUntil }
          : { waterReminderSnoozeUntil: snoozeUntil }),
        lastReset: now,
      },
    }))
    setSelfCareModalFocus(null)
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
          foodReminderSnoozeUntil: null,
          waterReminderSnoozeUntil: null,
          lastReset: Date.now(),
        },
      }))
    })
    setSelfCareModalFocus(null)
  }

  const dismissTip = (id: ToolId) => {
    setToolTips((prev) => ({ ...prev, [id]: false }))
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to tools
      </a>

      <section className="timer-info" aria-label="Work timer explanation">
        <p>
          {preferredName ? `Welcome, ${preferredName}. ` : 'Welcome. '}Take what helps and leave what does not. Calm Space is here to make your day feel a bit easier, one small step at a time.
        </p>
      </section>

      {selfCareModalFocus && isSelfCareReminderDue ? (
        <div className="self-care-modal-overlay" role="presentation">
          <section className="self-care-modal" role="dialog" aria-modal="true" aria-label="Self-care check-in">
            <p className="self-care-modal-title">
              {preferredName ? `${preferredName}, a gentle check-in` : 'A gentle check-in'}
            </p>
            <p className="self-care-modal-text">{selfCareModalText}</p>
            <p className="self-care-modal-note">
              {selfCareModalFocus === 'food'
                ? 'If not yet, that is okay. I will check again in about 30 minutes.'
                : 'If not yet, that is okay. I will check again in about 30 minutes while you are working.'}
            </p>
            <div className="self-care-modal-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (selfCareModalFocus) {
                    completeSelfCareReminder(selfCareModalFocus)
                  }
                }}
              >
                Yes, I have
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (selfCareModalFocus) {
                    snoozeSelfCareReminder(selfCareModalFocus)
                  }
                }}
              >
                Not yet
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showFutureYouNote ? (
        <section className="future-note-reminder" aria-label="Note for tomorrow" role="note">
          <p className="reminder-text">
            {preferredName ? `${preferredName}, this was your note for today:` : 'This was your note for today:'}
          </p>
          <p className="future-note-copy">{data.windDown.notes}</p>
          <div className="future-note-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setData((prev) => ({
                  ...prev,
                  windDown: { ...prev.windDown, noteShown: true },
                }))
              }
            >
              Got it
            </button>
          </div>
        </section>
      ) : null}

      <header className="hero" id="top">
        <img className="brand-logo" src="/calmspace-logo.svg" alt="Calm Space logo" />
        <div className="hero-layout">
          <div className="hero-copy">
            <p className="eyebrow">Calm Space Toolkit</p>
            <h1>Simple tools for work and daily life.</h1>
            <p className="intro">
              Built by a neurodivergent person for neurodivergent people. No jargon, no pressure,
              just simple tools to help you start, keep going, and switch off.
            </p>

            <label className="name-card">
              What should Calm Space call you?
              <input
                type="text"
                placeholder="Optional"
                value={data.displayName}
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    displayName: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </div>

        <section className="mode-and-theme" aria-label="Choose your setup for today">
          <details className="setup-details">
            <summary>Customise your setup (optional)</summary>
            <p className="setup-note">
              Default is <strong>Essentials only</strong> and <strong>One tool at a time</strong>.
              You can change that here whenever you like.
            </p>

            <div className="mode-picker">
              <p>Pick your day mode</p>
              <div className="chip-row">
                {dayModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`chip ${dayMode === mode.id ? 'active-chip' : ''}`}
                    onClick={() => applyDayMode(mode.id)}
                    aria-pressed={dayMode === mode.id}
                  >
                    <strong>{mode.title}</strong>
                    <span>{mode.summary}</span>
                  </button>
                ))}
              </div>
              <p className="mode-summary" aria-live="polite">
                {currentDayMode.title}: body doubling {currentDayMode.bodyDouble} min, pomodoro {currentDayMode.focus}/{currentDayMode.rest} min.
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
                    aria-pressed={theme === themeOption.id}
                  >
                    {themeOption.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="tool-set-picker">
              <p>Tool set</p>
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip ${essentialsOnly ? 'active-chip' : ''}`}
                  onClick={() => setEssentialsOnly(true)}
                  aria-pressed={essentialsOnly}
                >
                  <strong>Essentials only</strong>
                  <span>Show a smaller set to reduce overwhelm</span>
                </button>
                <button
                  type="button"
                  className={`chip ${essentialsOnly ? '' : 'active-chip'}`}
                  onClick={() => setEssentialsOnly(false)}
                  aria-pressed={!essentialsOnly}
                >
                  <strong>All tools</strong>
                  <span>Show the full toolkit</span>
                </button>
              </div>
            </div>

            <div className="view-picker">
              <p>How to view tools</p>
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip ${toolView === 'all' ? 'active-chip' : ''}`}
                  onClick={() => setToolView('all')}
                  aria-pressed={toolView === 'all'}
                >
                  <strong>All on one page</strong>
                  <span>Scroll through the full toolkit</span>
                </button>
                <button
                  type="button"
                  className={`chip ${toolView === 'single' ? 'active-chip' : ''}`}
                  onClick={() => openSingleTool(singleToolId)}
                  aria-pressed={toolView === 'single'}
                >
                  <strong>One tool at a time</strong>
                  <span>Use tools like separate pages</span>
                </button>
              </div>
            </div>
          </details>
        </section>
      </header>

      <section className="how-it-works" aria-label="How this works">
        <h2>How this works</h2>
        <ol>
          <li>
            <strong>Set up your day</strong>
            <span>Use the optional setup to pick your mode, tools, and view style.</span>
          </li>
          <li>
            <strong>Do one small thing</strong>
            <span>Start with What Next and choose one manageable step.</span>
          </li>
          <li>
            <strong>Protect your energy</strong>
            <span>Start the work boundary tracker and pause before you hit empty.</span>
          </li>
        </ol>
      </section>

      <section id="work-boundary" className="work-boundary" aria-label="Work boundary tracker">
        <h2>Work boundary tracker</h2>
        <p className="work-boundary-copy">
          It is easy to slip into overtime by accident. This tracks your full workday so you can
          spot when it is getting long and take a break.
        </p>

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
                Start work timer
              </button>
            ) : null}
            {data.isWorking ? (
              <>
                <button type="button" onClick={goOnBreak} className="btn-break">
                  Take a break
                </button>
                <button type="button" onClick={stopWork} className="btn-stop">
                  Stop work timer
                </button>
              </>
            ) : null}
            {data.breakStartTime ? (
              <>
                <button type="button" onClick={endBreak} className="btn-resume">
                  Resume work
                </button>
                <button type="button" onClick={stopWork} className="btn-stop">
                  Stop work timer
                </button>
              </>
            ) : null}
          </div>
        </section>
      </section>

      <nav className="jump-nav" aria-label="Jump to a tool">
        <div className="jump-nav-head">
          <p>
            {toolView === 'single'
              ? 'One tool view is on. Use the list below to switch tools.'
              : 'Choose a tool to start. If you are unsure, begin with What Next.'}
          </p>
          <span className="jump-status">Now viewing: {activeToolLabel}</span>
        </div>
        {toolView === 'single' ? (
          <p className="single-tool-reassure">You only need one small step right now.</p>
        ) : null}
        <ul>
          {visibleToolLinks.map((link) => (
            <li key={link.id}>
              {toolView === 'single' ? (
                <button
                  type="button"
                  className={`jump-tool-button ${singleToolId === link.id ? 'active-jump-link' : ''}`}
                  onClick={() => setSingleToolId(link.id)}
                  aria-current={singleToolId === link.id ? 'location' : undefined}
                >
                  {link.label}
                </button>
              ) : (
                <a
                  href={`#${link.id}`}
                  className={activeTool === link.id ? 'active-jump-link' : ''}
                  aria-current={activeTool === link.id ? 'location' : undefined}
                >
                  {link.label}
                </a>
              )}
            </li>
          ))}
        </ul>
        {toolView === 'single' ? (
          <div className="single-tool-controls" aria-label="Single tool navigation">
            <button
              type="button"
              className="btn-secondary"
              disabled={!prevToolId}
              onClick={() => prevToolId && openSingleTool(prevToolId)}
            >
              Previous tool
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setActiveTool(singleToolId)
                setToolView('all')
              }}
            >
              Back to all tools
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!nextToolId}
              onClick={() => nextToolId && openSingleTool(nextToolId)}
            >
              Next tool
            </button>
          </div>
        ) : (
          <div className="jump-progress" aria-hidden="true">
            <span className="progress-fill" style={{ width: `${journeyPercent}%` }}></span>
          </div>
        )}
      </nav>

      <main id="main-content" className="tool-stack">
        <section id="task-chunker" className={getToolPanelClass('task-chunker')} aria-labelledby="chunker-heading">
          <ToolHeading
            {...getHeadingControls('task-chunker')}
            id="chunker-heading"
            title="Task splitter"
            copy="Turn one big task into small, clear steps."
            icon="chunker"
            category="Plan"
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
            className="btn-primary"
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
            Clear this tool
          </button>
        </section>

        <section id="body-doubling" className={getToolPanelClass('body-doubling')} aria-labelledby="body-double-heading">
          <ToolHeading
            {...getHeadingControls('body-doubling')}
            id="body-double-heading"
            title="Body doubling timer"
            copy="Set a timer and work with a gentle companion."
            icon="double"
            category="Focus"
          />

          {toolTips['body-doubling'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['body-doubling']}</p>
              <button type="button" onClick={() => dismissTip('body-doubling')}>
                Got it
              </button>
            </div>
          ) : null}

          <p className="meta-line">
            Body doubling means doing a task alongside someone else so it feels easier to start.
            This timer gives you that same "someone is here with me" feeling.
          </p>

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
            <button type="button" className="btn-primary" onClick={() => setBodyDoubleRunning(true)}>
              Start
            </button>
            <button type="button" onClick={() => setBodyDoubleRunning(false)}>
              Pause
            </button>
            <button type="button" className="btn-clear" disabled={!hasBodyDoublingDeviation} onClick={resetBodyDoubling}>
              Clear this tool
            </button>
          </div>
        </section>

        <section id="next-task" className={getToolPanelClass('next-task')} aria-labelledby="next-task-heading">
          <ToolHeading
            {...getHeadingControls('next-task')}
            id="next-task-heading"
            title="Pick my next task"
            copy="Add your tasks, then let this pick one next step."
            icon="next"
            category="Plan"
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
            <button type="button" className="btn-secondary" disabled={!canAddTask} onClick={addTask}>
              Add task
            </button>
          </div>

          <div className="button-row">
            <button type="button" className="btn-primary" disabled={!hasOpenTasks} onClick={pickNextTask}>
              Pick my next task
            </button>
            <button type="button" className="btn-secondary" disabled={!hasCompletedTasks} onClick={clearDoneTasks}>
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
            <p className="empty-state">Add a few tasks, then let this pick one for you.</p>
          )}

          <p className="meta-line">Saved on this device only — won't follow you to a new browser or device.</p>

          <button type="button" className="btn-clear" disabled={!hasNextTaskContent} onClick={resetNextTask}>
            Clear this tool
          </button>
        </section>

        <section id="transition-helper" className={getToolPanelClass('transition-helper')} aria-labelledby="transition-heading">
          <ToolHeading
            {...getHeadingControls('transition-helper')}
            id="transition-heading"
            title="Transition helper"
            copy="A short checklist to help you switch tasks without losing your place."
            icon="transition"
            category="Switch"
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
            Clear this tool
          </button>
        </section>

        <section id="stuck-rescue" className={getToolPanelClass('stuck-rescue')} aria-labelledby="stuck-heading">
          <ToolHeading
            {...getHeadingControls('stuck-rescue')}
            id="stuck-heading"
            title="Stuck rescue"
            copy="If you freeze, choose one tiny move and try 10 minutes."
            icon="rescue"
            category="Recover"
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
            <button type="button" className="btn-primary" onClick={chooseRescueAction}>
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
              Try this: {data.stuckRescue.chosenAction}
            </p>
          ) : (
            <p className="empty-state">
              Add what you are stuck on, then press the button for a tiny next move.
            </p>
          )}

          {data.stuckRescue.startedAt ? (
            <p className="meta-line" aria-live="polite">
              10-minute commitment: {formatTime(stuckRescueSecondsLeft)} left
            </p>
          ) : null}

          <button type="button" className="btn-clear" disabled={!hasRescueContent} onClick={resetStuckRescue}>
            Clear this tool
          </button>
        </section>

        <section id="time-anchor" className={getToolPanelClass('time-anchor')} aria-labelledby="anchor-heading">
          <ToolHeading
            {...getHeadingControls('time-anchor')}
            id="anchor-heading"
            title="Time anchor"
            copy="Gentle time nudges while you work, so hours do not disappear."
            icon="anchor"
            category="Focus"
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
            <p className="empty-state">
              Start your work timer and add your task for better check-ins.
            </p>
          )}

          <button type="button" className="btn-clear" disabled={!hasAnchorContent} onClick={resetTimeAnchor}>
            Clear this tool
          </button>
        </section>

        <section id="money-tracker" className={getToolPanelClass('money-tracker')} aria-labelledby="finance-heading">
          <ToolHeading
            {...getHeadingControls('money-tracker')}
            id="finance-heading"
            title="Track invoices you sent"
            copy="Log who you billed, how much, and whether they have paid."
            icon="money"
            category="Admin"
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

          <button type="button" className="btn-primary" disabled={!canAddInvoice} onClick={addInvoice}>
            Save entry
          </button>

          <div className="finance-summary">
            <p>Total tracked: {formatCurrency(totals.total)}</p>
            <p>Paid: {formatCurrency(totals.paid)}</p>
            <p>Outstanding: {formatCurrency(totals.outstanding)}</p>
          </div>

          <p className="meta-line">
            Saved in this browser on this device. If you clear browser data or switch devices, it will not come with you.
          </p>

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
            Clear this tool
          </button>
        </section>

        <section id="brain-dump" className={getToolPanelClass('brain-dump')} aria-labelledby="brain-dump-heading">
          <ToolHeading
            {...getHeadingControls('brain-dump')}
            id="brain-dump-heading"
            title="Brain dump"
            copy="Get everything out of your head, then sort it one thought at a time."
            icon="dump"
            category="Clear"
          />

          {toolTips['brain-dump'] ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText['brain-dump']}</p>
              <button type="button" onClick={() => dismissTip('brain-dump')}>
                Got it
              </button>
            </div>
          ) : null}

          {data.brainDumpItems.length === 0 ? (
            /* Phase 1 — write freely */
            <>
              <label>
                What&apos;s on your mind?
                <textarea
                  rows={7}
                  placeholder={"Write freely. Sentences, lists, half-thoughts - all fine.\nGet it all out."}
                  value={data.brainDumpInput}
                  onChange={(event) =>
                    setData((prev) => ({ ...prev, brainDumpInput: event.target.value }))
                  }
                />
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={data.brainDumpInput.trim().length === 0}
                onClick={startBrainDumpTriage}
              >
                Sort my thoughts
              </button>
            </>
          ) : brainDumpReviewing ? (
            /* Phase 2 — review parsed items before triaging */
            <>
              <p className="meta-line">
                {data.brainDumpItems.length} thoughts found - tap x to remove anything that landed wrong
              </p>
              <ul className="review-list">
                {data.brainDumpItems.map((item) => (
                  <li key={item.id} className="review-item">
                    <span className="review-item-text">{item.text}</span>
                    <button
                      type="button"
                      className="review-remove"
                      aria-label={`Remove: ${item.text}`}
                      onClick={() => removeBrainDumpReviewItem(item.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="button-row">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={data.brainDumpItems.length === 0}
                  onClick={confirmBrainDumpReview}
                >
                  Start sorting
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setData((prev) => ({ ...prev, brainDumpItems: [] }))
                    setBrainDumpReviewing(false)
                  }}
                >
                  Back to writing
                </button>
              </div>
            </>
          ) : (
            /* Phase 3 — triage */
            <>
              {pendingBrainDumpItems.length > 0 ? (
                <>
                  <p className="meta-line">
                    {pendingBrainDumpItems.length} left to place — do it today, park it, or let it go
                  </p>
                  <ul className="triage-list">
                    {pendingBrainDumpItems.map((item) => (
                      <li key={item.id} className="triage-item">
                        <p className="triage-text">{item.text}</p>
                        <div className="triage-buttons">
                          <button
                            type="button"
                            className="btn-triage btn-triage--today"
                            onClick={() => triageItem(item.id, 'today')}
                          >
                            Do today
                          </button>
                          <button
                            type="button"
                            className="btn-triage btn-triage--later"
                            onClick={() => triageItem(item.id, 'later')}
                          >
                            Park it
                          </button>
                          <button
                            type="button"
                            className="btn-triage btn-triage--release"
                            onClick={() => triageItem(item.id, 'release')}
                          >
                            Let it go
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="meta-line">All sorted. Nice work.</p>
              )}

              {todayBrainDumpItems.length > 0 && (
                <div className="triage-bucket">
                  <h3 className="triage-bucket-label triage-bucket-label--today">Do today</h3>
                  <ul className="triage-bucket-list">
                    {todayBrainDumpItems.map((item) => (
                      <li key={item.id}>{item.text}</li>
                    ))}
                  </ul>
                </div>
              )}

              {laterBrainDumpItems.length > 0 && (
                <div className="triage-bucket">
                  <h3 className="triage-bucket-label triage-bucket-label--later">Parked</h3>
                  <ul className="triage-bucket-list">
                    {laterBrainDumpItems.map((item) => (
                      <li key={item.id}>{item.text}</li>
                    ))}
                  </ul>
                </div>
              )}

              {releaseBrainDumpItems.length > 0 && (
                <div className="triage-bucket">
                  <h3 className="triage-bucket-label triage-bucket-label--release">Let go</h3>
                  <ul className="triage-bucket-list">
                    {releaseBrainDumpItems.map((item) => (
                      <li key={item.id}>{item.text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <p className="meta-line">Saved on this device only — won't follow you to a new browser or device.</p>

          <button type="button" className="btn-clear" disabled={!hasBrainDumpContent} onClick={resetBrainDump}>
            Clear this tool
          </button>
        </section>

        <section id="weekly-review" className={getToolPanelClass('weekly-review')} aria-labelledby="weekly-heading">
          <ToolHeading
            {...getHeadingControls('weekly-review')}
            id="weekly-heading"
            title="Weekly review prompts"
            copy="Simple prompts to help you look back on your week."
            icon="review"
            category="Reflect"
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

          <p className="meta-line">Saved on this device only — won't follow you to a new browser or device.</p>

          <button type="button" className="btn-clear" disabled={!hasWeeklyReviewContent} onClick={resetWeeklyReview}>
            Clear this tool
          </button>
        </section>

        <section id="pomodoro" className={getToolPanelClass('pomodoro')} aria-labelledby="pomodoro-heading">
          <ToolHeading
            {...getHeadingControls('pomodoro')}
            id="pomodoro-heading"
            title="Flexible pomodoro"
            copy="A focus timer you can adjust to suit your day."
            icon="pomo"
            category="Focus"
          />

          {toolTips.pomodoro ? (
            <div className="tip-box" role="note">
              <p>{toolTipsText.pomodoro}</p>
              <button type="button" onClick={() => dismissTip('pomodoro')}>
                Got it
              </button>
            </div>
          ) : null}

          <p className="meta-line">
            Pomodoro is a simple focus rhythm: short work block, short break, repeat. You can
            change the timings to fit your energy.
          </p>

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
            <button type="button" className="btn-primary" onClick={() => setPomodoroRunning(true)}>
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
              Clear this tool
            </button>
          </div>
        </section>

        <section id="self-care" className={getToolPanelClass('self-care')} aria-labelledby="selfcare-heading">
          <ToolHeading
            {...getHeadingControls('self-care')}
            id="selfcare-heading"
            title="Body check-in"
            copy="A quick check for water, food, and posture during the day."
            icon="selfcare"
            category="Care"
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
            Clear this tool
          </button>
        </section>

        <section id="wind-down" className={getToolPanelClass('wind-down')} aria-labelledby="wind-down-heading">
          <ToolHeading
            {...getHeadingControls('wind-down')}
            id="wind-down-heading"
            title="End-of-day wind-down"
            copy="A short checklist to help you finish work and switch off."
            icon="winddown"
            category="Close"
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
              className="btn-secondary"
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
            <p className="empty-state">No items yet. Add one to start your checklist.</p>
          )}

          <label>
            Message for tomorrow
            <textarea
              rows={3}
              placeholder="Example: Start with invoice before opening chat."
              value={data.windDown.notes}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  windDown: {
                    ...prev.windDown,
                    notes: event.target.value,
                    noteWrittenDate:
                      event.target.value.trim().length > 0 ? todayDateKey : null,
                    noteShown: false,
                  },
                }))
              }
            />
          </label>

          <p className="meta-line">Saved on this device only — won't follow you to a new browser or device.</p>

          <button type="button" className="btn-clear" disabled={!hasWindDownContent} onClick={resetWindDown}>
            Clear this tool
          </button>
        </section>
      </main>

      <div className="page-ending">
        <section className="support-note" aria-label="Support this project">
          <p className="tool-category">Support</p>
          <h2>Keep Calm Space growing</h2>
          <p>
            Calm Space is made by one neurodivergent human for other neurodivergent humans.
            If it helps you, you can support it on Ko-fi. It helps cover hosting, updates,
            and new tools. No pressure, it'll be free for everyone forever.
          </p>
          <a className="donate" href="https://ko-fi.com/loismakeswebsites" target="_blank" rel="noreferrer">
            Support on Ko-fi
          </a>
        </section>

        <footer className="site-footer" aria-label="Site footer">
          <div>
            <p className="footer-kicker">Calm Space</p>
            <p className="footer-note">
              Calm Space stores your entries in this browser only. If you clear browser data or use another device, your saved data will not move with you.
            </p>
          </div>
          <div className="footer-links">
            <a href="/privacy.html">Privacy &amp; data</a>
            <a href="https://ko-fi.com/loismakeswebsites" target="_blank" rel="noreferrer">
              Support on Ko-fi
            </a>
            <a href="https://loismakeswebsites.co.uk" target="_blank" rel="noreferrer">
              Built by loismakeswebsites
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App
