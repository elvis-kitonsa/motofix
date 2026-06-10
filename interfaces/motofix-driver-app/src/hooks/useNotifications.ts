import { useEffect, useState, useCallback } from 'react'
import {
  getNotifications,
  unreadCount,
  subscribe,
  markRead,
  markAllRead,
  removeNotification,
  clearAll,
  type AppNotification,
} from '@/lib/notifications'

/** Reactive view of the notifications inbox. */
export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>(() => getNotifications())
  const [unread, setUnread] = useState<number>(() => unreadCount())

  useEffect(() => {
    const sync = () => {
      setItems(getNotifications())
      setUnread(unreadCount())
    }
    sync()
    return subscribe(sync)
  }, [])

  return {
    items,
    unread,
    markRead: useCallback((id: string) => markRead(id), []),
    markAllRead: useCallback(() => markAllRead(), []),
    remove: useCallback((id: string) => removeNotification(id), []),
    clearAll: useCallback(() => clearAll(), []),
  }
}
