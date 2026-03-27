import { useEffect, useMemo, useState } from 'react'
import './App.css'

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

type WeeklyReview = {
  win: string
  friction: string
  support: string
  nextWeek: string
  boundaries: string
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
  pomodoroWork: number
  pomodoroRest: number
  pomodoroSecondsLeft: number
  workStartTime: number | null
  breakStartTime: number | null
  isWorking: boolean
}

type TipsState = Record<string, boolean>
type DayMode = 'gentle' | 'focus' | 'recovery'
type ThemeName = 'dawn' | 'moss' | 'ocean' | 'night'

type ToolId =
  | 'task-chunker'
  | 'body-doubling'
  | 'next-task'
  | 'wind-down'
  | 'money-tracker'
  | 'brain-dump'
  | 'weekly-review'
  | 'pomodoro'

type ToolIconName =
  | 'chunker'
  | 'double'
  | 'next'
  | 'winddown'
  | 'money'
  | 'dump'
  | 'review'
  | 'pomo'

const STORAGE_PREFIX = 'calm-space'
const THEME_KEY = `${STORAGE_PREFIX}:theme`
const DAY_MODE_KEY = `${STORAGE_PREFIX}:day-mode`

const toolLinks: Array<{ id: ToolId; label: string }> = [
  { id: 'task-chunker', label: 'Task Chunker' },
  { id: 'body-doubling', label: 'Body Doubling' },
  { id: 'next-task', label: 'What Next' },
  { id: 'wind-down', label: 'Wind-down' },
  { id: 'money-tracker', label: 'Money' },
  { id: 'brain-dump', label: 'Brain Dump' },
  { id: 'weekly-review', label: 'Weekly Review' },
  { id: 'pomodoro', label: 'Pomodoro' },
]

const toolTipsText: Record<ToolId, string> = {
  'task-chunker':
    'Write the task in plain words. Keep it rough. We will split it into small actions.',
  'body-doubling':
    'Set a short session and begin. You can pause any time.',
  'next-task': 'Keep this list short. The button picks one next action.',
  'wind-down':
    'This helps you close the day. Done is better than perfect.',
  'money-tracker':
    'Add invoices as they come in so you can see what is paid and unpaid.',
  'brain-dump': 'One thought per line. Then sort.',
  'weekly-review':
    'Short answers are fine. You are only looking for what helped and what did not.',
  pomodoro: 'Adjust focus and rest times to match your energy.',
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

const emptyBrainDump = (): SortedBrainDump => ({
  work: [],
  life: [],
  health: [],
  admin: [],
  money: [],
  creative: [],
  misc: [],
})

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
  pomodoroWork: 35,
  pomodoroRest: 12,
  pomodoroSecondsLeft: 35 * 60,
  workStartTime: null,
  breakStartTime: null,
  isWorking: false,
})

const profileStorageKey = (profileId: string) => `${STORAGE_PREFIX}:profile:${profileId}`
const profileTipsKey = (profileId: string) => `${STORAGE_PREFIX}:tips:${profileId}`

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
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
  'Breathe once. Then continue for 2 more minutes.',
  'Quiet progress still counts.',
]

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

const chunkTask = (input: string) => {
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

const sortBrainDump = (text: string): SortedBrainDump => {
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

function ToolIcon({ name }: { name: ToolIconName }) {
  const paths: Record<ToolIconName, string> = {
    chunker: 'M4 6h16M4 12h10M4 18h8M16 12l2 2 3-4',
    double: 'M8 6a6 6 0 1 0 0.01 0M16 6a6 6 0 1 0 0.01 0',
    next: 'M5 12h14M13 8l4 4-4 4',
    winddown: 'M12 4a8 8 0 1 0 8 8 6 6 0 0 1-8-8',
    money: 'M4 9h16v10H4zM8 13h8M9 9V6h6v3',
    dump: 'M5 5h14v14H5zM8 9h8M8 13h5',
    review: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h4',
    pomo: 'M12 7a5 5 0 1 0 5 5h-5zM10 3h4',
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
  const [theme, setTheme] = useState<ThemeName>('dawn')
  const [dayMode, setDayMode] = useState<DayMode>('gentle')
  const [data, setData] = useState<ProfileData>(defaultData())
  const [toolTips, setToolTips] = useState<TipsState>(defaultTips())
  const [bodyDoubleRunning, setBodyDoubleRunning] = useState(false)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroMode, setPomodoroMode] = useState<'focus' | 'rest'>('focus')
  const [workElapsedSeconds, setWorkElapsedSeconds] = useState(0)
  const [breakElapsedSeconds, setBreakElapsedSeconds] = useState(0)

  useEffect(() => {
    try {
      const rawTheme = localStorage.getItem(THEME_KEY)
      if (rawTheme && themes.some((item) => item.id === rawTheme)) {
        setTheme(rawTheme as ThemeName)
      }

      const rawDayMode = localStorage.getItem(DAY_MODE_KEY)
      if (rawDayMode && dayModes.some((item) => item.id === rawDayMode)) {
        setDayMode(rawDayMode as DayMode)
      }
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(DAY_MODE_KEY, dayMode)
  }, [dayMode])

  useEffect(() => {
    const key = profileStorageKey(profileId)
    const tipsKey = profileTipsKey(profileId)
    const empty = defaultData()
    const freshTips = defaultTips()

    setBodyDoubleRunning(false)
    setPomodoroRunning(false)
    setPomodoroMode('focus')

    try {
      const raw = localStorage.getItem(key)
      if (!raw) {
        setData(empty)
      } else {
        const parsed = JSON.parse(raw) as Partial<ProfileData>
        const loadedData = {
          ...empty,
          ...parsed,
          windDown: { ...empty.windDown, ...parsed.windDown },
          weeklyReview: { ...empty.weeklyReview, ...parsed.weeklyReview },
          sortedBrainDump: { ...emptyBrainDump(), ...parsed.sortedBrainDump },
          tasks: parsed.tasks ?? [],
          chunkedSteps: parsed.chunkedSteps ?? [],
          invoices: parsed.invoices ?? [],
        }
        setData(loadedData)

        // Recalculate elapsed time if a session was in progress
        if (loadedData.workStartTime) {
          const elapsed = Math.floor((Date.now() - loadedData.workStartTime) / 1000)
          setWorkElapsedSeconds(elapsed)
        }
        if (loadedData.breakStartTime) {
          const elapsed = Math.floor((Date.now() - loadedData.breakStartTime) / 1000)
          setBreakElapsedSeconds(elapsed)
        }
      }

      const rawTips = localStorage.getItem(tipsKey)
      if (!rawTips) {
        setToolTips(freshTips)
      } else {
        const parsedTips = JSON.parse(rawTips) as Partial<TipsState>
        const normalizedTips = Object.keys(freshTips).reduce((acc, keyName) => {
          acc[keyName] =
            typeof parsedTips[keyName] === 'boolean' ? parsedTips[keyName] : freshTips[keyName]
          return acc
        }, {} as TipsState)
        setToolTips(normalizedTips)
      }
    } catch {
      setData(empty)
      setToolTips(freshTips)
    }
  }, [])

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
          const elapsed = Math.floor((Date.now() - prev.workStartTime) / 1000)
          setWorkElapsedSeconds(elapsed)
        }

        if (!prev.isWorking && prev.breakStartTime) {
          const elapsed = Math.floor((Date.now() - prev.breakStartTime) / 1000)
          setBreakElapsedSeconds(elapsed)
        }

        return prev
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

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
    setData((prev) => ({
      ...prev,
      workStartTime: Date.now(),
      breakStartTime: null,
      isWorking: true,
    }))
    setWorkElapsedSeconds(0)
  }

  const goOnBreak = () => {
    setData((prev) => ({
      ...prev,
      workStartTime: null,
      breakStartTime: Date.now(),
      isWorking: false,
    }))
    setBreakElapsedSeconds(0)
  }

  const endBreak = () => {
    setData((prev) => ({
      ...prev,
      workStartTime: Date.now(),
      breakStartTime: null,
      isWorking: true,
    }))
    setWorkElapsedSeconds(0)
  }

  const stopWork = () => {
    setData((prev) => ({
      ...prev,
      workStartTime: null,
      breakStartTime: null,
      isWorking: false,
    }))
    setWorkElapsedSeconds(0)
    setBreakElapsedSeconds(0)
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
              <p className="timer-label">Working:</p>
              <p className="timer-time">{formatTime(workElapsedSeconds)}</p>
            </>
          ) : data.breakStartTime ? (
            <>
              <p className="timer-label">On break:</p>
              <p className="timer-time">{formatTime(breakElapsedSeconds)}</p>
            </>
          ) : (
            <p className="timer-label">Ready to work</p>
          )}
        </div>
        <div className="timer-controls">
          {!data.isWorking && !data.breakStartTime ? (
            <button type="button" onClick={startWork} className="btn-start">
              Start work
            </button>
          ) : null}
          {data.isWorking ? (
            <>
              <button type="button" onClick={goOnBreak} className="btn-break">
                Go on break
              </button>
              <button type="button" onClick={stopWork} className="btn-stop">
                Stop work
              </button>
            </>
          ) : null}
          {data.breakStartTime ? (
            <>
              <button type="button" onClick={endBreak} className="btn-resume">
                Back to work
              </button>
              <button type="button" onClick={stopWork} className="btn-stop">
                End session
              </button>
            </>
          ) : null}
        </div>
      </section>

      <header className="hero" id="top">
        <div className="hero-glow" aria-hidden="true"></div>
        <p className="eyebrow">Calm Space Toolkit</p>
        <h1>Simple tools for work and daily life.</h1>
        <p className="intro">
          Built for neurodivergent people. Clear steps, calm layouts, and practical tools.
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
            title="Task chunker"
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
                  const next = Number(event.target.value)
                  if (Number.isNaN(next)) {
                    return
                  }

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
            <button
              type="button"
              onClick={() => {
                setBodyDoubleRunning(false)
                setData((prev) => ({
                  ...prev,
                  bodyDoubleSecondsLeft: prev.bodyDoubleMinutes * 60,
                }))
              }}
            >
              Reset
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
                onChange={(event) =>
                  setData((prev) => ({ ...prev, taskInput: event.target.value }))
                }
              />
            </label>
            <button type="button" onClick={addTask}>
              Add task
            </button>
          </div>

          <div className="button-row">
            <button type="button" onClick={pickNextTask}>
              Pick my next task
            </button>
            <button type="button" onClick={clearDoneTasks}>
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
                    const text = event.currentTarget.value.trim()
                    if (text) {
                      setData((prev) => ({
                        ...prev,
                        windDown: {
                          ...prev.windDown,
                          items: [
                            ...prev.windDown.items,
                            { id: Date.now(), text, done: false },
                          ],
                        },
                      }))
                      event.currentTarget.value = ''
                    }
                  }
                }}
              />
            </label>
          </div>

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
        </section>

        <section id="money-tracker" className="tool-panel fade-in" aria-labelledby="finance-heading">
          <ToolHeading
            id="finance-heading"
            title="Simple money tracker"
            copy="Track invoices quickly."
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
                onChange={(event) =>
                  setData((prev) => ({ ...prev, invoiceDate: event.target.value }))
                }
              />
            </label>
          </div>

          <button type="button" onClick={addInvoice}>
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
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No entries yet. Add one to start tracking.</p>
          )}
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
                  const next = Number(event.target.value)
                  if (Number.isNaN(next)) {
                    return
                  }

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
                  const next = Number(event.target.value)
                  if (Number.isNaN(next)) {
                    return
                  }

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
              onClick={() => {
                setPomodoroRunning(false)
                setPomodoroMode('focus')
                setData((prev) => ({
                  ...prev,
                  pomodoroSecondsLeft: prev.pomodoroWork * 60,
                }))
              }}
            >
              Reset
            </button>
          </div>
        </section>
      </main>

      <section className="support-note" aria-label="Support this project">
        <h2>Support This Project</h2>
        <p>
          If this toolkit helps you, you can support it on Ko-fi. Donations help cover hosting,
          updates, and new tools. No pressure at all. Use it freely either way.
        </p>
        <a className="donate" href="https://ko-fi.com/" target="_blank" rel="noreferrer">
          Support on Ko-fi
        </a>
      </section>
    </div>
  )
}

export default App
