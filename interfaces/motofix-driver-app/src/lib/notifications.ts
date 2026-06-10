// Lightweight, localStorage-backed notifications inbox.
//
// This is the "real-time alerts" half of the split: time-sensitive events
// (mechanic accepted / en route / arrived / completed, rate-your-mechanic,
// and reminder nudges) land here so they don't compete with the passive
// maintenance checklist for the user's attention.
//
// No context/provider needed — components subscribe via the `motofix:notifications`
// window event. Anywhere in the app can call addNotification(...).

export type NotificationKind = 'job' | 'reminder' | 'system'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body?: string
  /** Deep-link target, e.g. `/requests/41`. */
  link?: string
  /** Used to suppress duplicates (e.g. the same job status arriving twice). */
  dedupeKey?: string
  createdAt: string
  read: boolean
}

const KEY = 'motofix_notifications'
const MAX = 100
const EVENT = 'motofix:notifications'

function read(): AppNotification[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AppNotification[]) : []
  } catch {
    return []
  }
}

function write(items: AppNotification[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
  } catch {
    /* storage full / unavailable — non-fatal */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function getNotifications(): AppNotification[] {
  return read()
}

export function unreadCount(): number {
  return read().filter(n => !n.read).length
}

/**
 * Add a notification to the inbox. Returns the created record, or null if it
 * was suppressed as a duplicate (same `dedupeKey` already present).
 */
export function addNotification(
  n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
): AppNotification | null {
  const items = read()
  if (n.dedupeKey && items.some(i => i.dedupeKey === n.dedupeKey)) return null

  const record: AppNotification = {
    ...n,
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    read: false,
  }
  write([record, ...items])
  return record
}

export function markRead(id: string) {
  write(read().map(n => (n.id === id ? { ...n, read: true } : n)))
}

export function markAllRead() {
  write(read().map(n => ({ ...n, read: true })))
}

export function removeNotification(id: string) {
  write(read().filter(n => n.id !== id))
}

export function clearAll() {
  write([])
}

/** Subscribe to inbox changes. Returns an unsubscribe function. */
export function subscribe(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  // `storage` fires for changes made in other tabs.
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}
