// Maintenance-checklist model + reminder settings.
//
// The checklist used to be a flat list of 33 items whose "checked" state was
// permanent — so the Home badge was stuck at a meaningless number forever.
// Now each section has a *cadence*: daily / weekly / monthly checks become
// "due" again once their period rolls over, while Do's/Don'ts are evergreen
// reference (never counted as due). The badge counts only what is due *now*,
// so it's small, clearable, and resets on its own.
//
// Week boundaries start Monday 00:00 (Sun→Mon rollover), matching the rest of
// the product.

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'reference'

export interface ChecklistItem {
  id: string
  text: string
}

export interface ChecklistSection {
  key: string
  label: string
  subtitle: string
  emoji: string
  accent: string
  bg: string
  border: string
  cadence: Cadence
  items: ChecklistItem[]
}

/* ─── Maintenance checklist ─── */
export const SECTIONS: ChecklistSection[] = [
  {
    key: 'daily',
    label: 'Daily Checks',
    subtitle: 'Before you start your engine',
    emoji: '☀️',
    accent: '#F59E0B',
    bg: 'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.18)',
    cadence: 'daily',
    items: [
      { id: 'd1', text: 'Check tyre pressure (including spare)' },
      { id: 'd2', text: 'Inspect tyres for visible damage or nails' },
      { id: 'd3', text: 'Check fuel level before setting off' },
      { id: 'd4', text: 'Verify all exterior lights are working' },
      { id: 'd5', text: 'Check mirrors and adjust before driving' },
      { id: 'd6', text: 'Ensure seatbelts are in working order' },
    ],
  },
  {
    key: 'weekly',
    label: 'Weekly Checks',
    subtitle: 'Once a week keeps breakdowns away',
    emoji: '📅',
    accent: '#60A5FA',
    bg: 'rgba(96,165,250,0.07)',
    border: 'rgba(96,165,250,0.18)',
    cadence: 'weekly',
    items: [
      { id: 'w1', text: 'Top up engine oil if below the minimum mark' },
      { id: 'w2', text: 'Check coolant / radiator water level' },
      { id: 'w3', text: 'Inspect brake fluid reservoir' },
      { id: 'w4', text: 'Test windscreen washer fluid and wipers' },
      { id: 'w5', text: 'Listen for unusual sounds when braking' },
      { id: 'w6', text: 'Check battery terminals for corrosion' },
    ],
  },
  {
    key: 'monthly',
    label: 'Monthly Checks',
    subtitle: 'Deeper checks to stay road-legal',
    emoji: '🗓️',
    accent: '#34D399',
    bg: 'rgba(52,211,153,0.07)',
    border: 'rgba(52,211,153,0.18)',
    cadence: 'monthly',
    items: [
      { id: 'm1', text: 'Measure tyre tread depth (min 1.6 mm)' },
      { id: 'm2', text: 'Inspect brake pads for wear' },
      { id: 'm3', text: 'Check all belts and hoses for cracks' },
      { id: 'm4', text: 'Clean or replace air filter if dusty' },
      { id: 'm5', text: 'Inspect under-carriage for leaks or rust' },
      { id: 'm6', text: 'Verify spare tyre is properly inflated' },
      { id: 'm7', text: 'Renew insurance or confirm it is active' },
    ],
  },
  {
    key: 'dos',
    label: "Do's — Good Habits",
    subtitle: 'Practices that keep you and others safe',
    emoji: '✅',
    accent: '#4ADE80',
    bg: 'rgba(74,222,128,0.07)',
    border: 'rgba(74,222,128,0.18)',
    cadence: 'reference',
    items: [
      { id: 'do1', text: 'Always carry a spare tyre and a jack' },
      { id: 'do2', text: 'Keep jumper cables in the boot' },
      { id: 'do3', text: 'Carry a basic tool kit and reflective triangles' },
      { id: 'do4', text: 'Have a first-aid kit accessible in the car' },
      { id: 'do5', text: 'Save MOTOFIX and emergency contacts in your phone' },
      { id: 'do6', text: 'Drive within the recommended speed for road conditions' },
      { id: 'do7', text: 'Allow the engine to warm up briefly in cold mornings' },
    ],
  },
  {
    key: 'donts',
    label: "Don'ts — Avoid These",
    subtitle: 'Common mistakes that cause breakdowns',
    emoji: '🚫',
    accent: '#F87171',
    bg: 'rgba(248,113,113,0.07)',
    border: 'rgba(248,113,113,0.18)',
    cadence: 'reference',
    items: [
      { id: 'dn1', text: "Don't ignore dashboard warning lights" },
      { id: 'dn2', text: "Don't skip scheduled oil changes" },
      { id: 'dn3', text: "Don't drive on a visibly flat or worn tyre" },
      { id: 'dn4', text: "Don't overload the vehicle beyond its rated capacity" },
      { id: 'dn5', text: "Don't ignore unusual sounds from the engine or brakes" },
      { id: 'dn6', text: "Don't let fuel consistently drop below a quarter tank" },
      { id: 'dn7', text: "Don't leave the vehicle running in an enclosed space" },
    ],
  },
]

/* ─── Storage keys ─── */
export const CHECKED_KEY = 'motofix_reminders_checked'
export const CUSTOM_KEY = 'motofix_custom_reminders'
export const SETTINGS_KEY = 'motofix_reminder_settings'
export const FIRED_KEY = 'motofix_reminder_fired'
export const PROMPT_SEEN_KEY = 'motofix_reminder_prompt_seen'

/* ─── First-run opt-in prompt ─── */
export function hasSeenReminderPrompt(): boolean {
  try {
    return localStorage.getItem(PROMPT_SEEN_KEY) === '1'
  } catch {
    return true // if storage is unavailable, don't nag
  }
}

export function markReminderPromptSeen() {
  try { localStorage.setItem(PROMPT_SEEN_KEY, '1') } catch { /* ignore */ }
}

/* ─── Date helpers (local time; Monday-start weeks) ─── */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function startOfWeekMonday(d: Date): Date {
  const s = startOfDay(d)
  const dow = (s.getDay() + 6) % 7 // Mon=0 … Sun=6
  s.setDate(s.getDate() - dow)
  return s
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/* ─── Checked state (timestamp-based, supports recurring reset) ─── */
// Stored as { [itemId]: ISO-timestamp-of-last-check }. Legacy data stored
// boolean `true`; we treat that as "checked at epoch" so recurring items
// correctly become due again, while reference items stay acknowledged.
export type CheckedMap = Record<string, string | boolean>

export function loadChecked(): CheckedMap {
  try {
    return JSON.parse(localStorage.getItem(CHECKED_KEY) ?? '{}') as CheckedMap
  } catch {
    return {}
  }
}

export function lastCheckedAt(checks: CheckedMap, id: string): Date | null {
  const v = checks[id]
  if (!v) return null
  if (v === true) return new Date(0) // legacy: counts as "long ago"
  const t = new Date(v as string)
  return isNaN(t.getTime()) ? null : t
}

/** Has this item been satisfied for its current cadence period? */
export function isItemSatisfied(
  cadence: Cadence,
  checks: CheckedMap,
  id: string,
  now: Date = new Date(),
): boolean {
  const at = lastCheckedAt(checks, id)
  if (!at) return false
  switch (cadence) {
    case 'daily':
      return at >= startOfDay(now)
    case 'weekly':
      return at >= startOfWeekMonday(now)
    case 'monthly':
      return at >= startOfMonth(now)
    case 'reference':
      return true // acknowledged once, stays acknowledged
  }
}

/** Count of recurring items that are due right now (+ unchecked custom tasks). */
export function dueCount(now: Date = new Date()): number {
  const checks = loadChecked()
  let due = 0
  for (const section of SECTIONS) {
    if (section.cadence === 'reference') continue
    for (const item of section.items) {
      if (!isItemSatisfied(section.cadence, checks, item.id, now)) due++
    }
  }
  // Once-off personal reminders the driver added and hasn't ticked.
  try {
    const custom: { checked: boolean }[] = JSON.parse(
      localStorage.getItem(CUSTOM_KEY) ?? '[]',
    )
    due += custom.filter(r => !r.checked).length
  } catch {
    /* ignore */
  }
  return due
}

/* ─── Reminder settings (configurable push) ─── */
export interface ReminderSettings {
  /** Master switch — when off, no nudges fire at all. */
  enabled: boolean
  /** Morning pre-drive nudge. */
  daily: { enabled: boolean; time: string } // 'HH:MM'
  /** End-of-week vehicle check-in. day: 1=Mon … 7=Sun. */
  weekly: { enabled: boolean; day: number; time: string }
  /** Section keys the driver muted (hidden from checklist + not nudged). */
  mutedSections: string[]
}

export const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false, // opt-in: never nudge without consent
  daily: { enabled: true, time: '07:00' },
  weekly: { enabled: true, day: 7, time: '18:00' }, // Sunday evening, before the new week
  mutedSections: [],
}

export function loadSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      daily: { ...DEFAULT_SETTINGS.daily, ...(parsed.daily ?? {}) },
      weekly: { ...DEFAULT_SETTINGS.weekly, ...(parsed.weekly ?? {}) },
      mutedSections: parsed.mutedSections ?? [],
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: ReminderSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('motofix:reminder-settings'))
}

export const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
]

/** Ask the browser for notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}
