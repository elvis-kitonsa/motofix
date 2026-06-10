import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  SECTIONS,
  FIRED_KEY,
  loadSettings,
  loadChecked,
  isItemSatisfied,
  startOfDay,
  startOfWeekMonday,
  type Cadence,
} from '@/lib/reminders'
import { addNotification } from '@/lib/notifications'

// Foreground reminder scheduler.
//
// Browsers can't reliably run scheduled notifications when the tab is fully
// closed (that needs native push via Capacitor — already on the roadmap). So
// while the app is open or backgrounded, this checks once a minute (and on
// focus) whether a configured reminder time has passed for the current period
// and fires it once — recording which day/week already fired so it never spams.

interface FiredState {
  daily?: string  // 'YYYY-M-D'
  weekly?: string // ISO date of the week's Monday
}

function readFired(): FiredState {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}') as FiredState
  } catch {
    return {}
  }
}

function writeFired(f: FiredState) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify(f)) } catch { /* ignore */ }
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function weekKey(d: Date): string {
  return startOfWeekMonday(d).toISOString().slice(0, 10)
}

/** Parse 'HH:MM' onto the date `base`, returning the target Date. */
function atTime(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const t = startOfDay(base)
  t.setHours(h || 0, m || 0, 0, 0)
  return t
}

/** Count due (unsatisfied) items for the given cadences, honouring muted sections. */
function dueFor(cadences: Cadence[], mutedSections: string[], now: Date): number {
  const checks = loadChecked()
  let due = 0
  for (const section of SECTIONS) {
    if (!cadences.includes(section.cadence)) continue
    if (mutedSections.includes(section.key)) continue
    for (const item of section.items) {
      if (!isItemSatisfied(section.cadence, checks, item.id, now)) due++
    }
  }
  return due
}

function fire(title: string, body: string, link: string) {
  addNotification({ kind: 'reminder', title, body, link })
  // System notification when backgrounded & permitted; otherwise an in-app toast.
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
    try { new Notification(title, { body }) } catch { /* ignore */ }
  } else {
    toast(title, { description: body, duration: 6000 })
  }
}

function tick() {
  const s = loadSettings()
  if (!s.enabled) return
  const now = new Date()
  const fired = readFired()
  let changed = false

  // Daily pre-drive nudge
  if (s.daily.enabled && now >= atTime(now, s.daily.time) && fired.daily !== dayKey(now)) {
    const due = dueFor(['daily'], s.mutedSections, now)
    if (due > 0) {
      fire(
        '☀️ Pre-drive check',
        `${due} quick ${due === 1 ? 'check' : 'checks'} before you set off today.`,
        '/reminders',
      )
    }
    fired.daily = dayKey(now)
    changed = true
  }

  // Weekly check-in — only on the configured weekday
  const isoDow = ((now.getDay() + 6) % 7) + 1 // 1=Mon … 7=Sun
  if (
    s.weekly.enabled &&
    isoDow === s.weekly.day &&
    now >= atTime(now, s.weekly.time) &&
    fired.weekly !== weekKey(now)
  ) {
    const due = dueFor(['weekly', 'monthly'], s.mutedSections, now)
    if (due > 0) {
      fire(
        '📅 Weekly vehicle check-in',
        `${due} maintenance ${due === 1 ? 'item is' : 'items are'} still due. A few minutes keeps you road-ready.`,
        '/reminders',
      )
    }
    fired.weekly = weekKey(now)
    changed = true
  }

  if (changed) writeFired(fired)
}

export function useReminderScheduler(active: boolean) {
  useEffect(() => {
    if (!active) return
    tick() // catch up on mount
    const interval = setInterval(tick, 60_000)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active])
}
