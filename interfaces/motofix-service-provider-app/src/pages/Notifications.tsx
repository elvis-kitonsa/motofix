// Notifications.tsx — the mechanic's notifications inbox: job offers, payments, ratings and
// system messages, with read/unread state and clear actions.

import { useState, useEffect, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Bell, Briefcase, CheckCircle, Wallet, Star, ShieldCheck,
  MoreVertical, Trash2, MailOpen, Mail, CheckCheck,
} from 'lucide-react'
import { C } from '@/styles/tokens'
import { notificationService } from '@/config/api'
import SkeletonCard from '@/components/SkeletonCard'
import EmptyState from '@/components/EmptyState'
import { formatRelativeTime } from '@/utils/formatters'
import type { Notification } from '@/types'

// ── localStorage helpers for deleted IDs ─────────────────────────────────────
const DELETED_KEY = 'motofix_sp_notif_deleted'
const READ_KEY    = 'motofix_sp_notif_read'

function getDeletedIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DELETED_KEY) ?? '[]')) } catch { return new Set() }
}
function saveDeletedIds(ids: Set<string>) {
  try { localStorage.setItem(DELETED_KEY, JSON.stringify([...ids])) } catch {}
}
function removeFromReadStore(id: string) {
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(READ_KEY) ?? '[]')
    localStorage.setItem(READ_KEY, JSON.stringify(ids.filter(i => i !== id)))
  } catch {}
}

// ── Icon map ──────────────────────────────────────────────────────────────────
function notifIcon(type: string): { icon: React.ElementType; color: string; bg: string } {
  switch (type) {
    case 'new_job':       return { icon: Briefcase,   color: C.amber, bg: `${C.amber}22` }
    case 'job_completed': return { icon: CheckCircle, color: C.green, bg: `${C.green}22` }
    case 'job_accepted':  return { icon: CheckCircle, color: C.green, bg: `${C.green}22` }
    case 'payment':       return { icon: Wallet,      color: C.green, bg: `${C.green}22` }
    case 'review':        return { icon: Star,        color: C.amber, bg: `${C.amber}22` }
    case 'account':       return { icon: ShieldCheck, color: C.blue,  bg: `${C.blue}22`  }
    default:              return { icon: Bell,        color: C.blue,  bg: `${C.blue}22`  }
  }
}

type Tab = 'all' | 'unread' | 'read'

export default function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [deletedIds, setDeletedIds] = useState<Set<string>>(getDeletedIds)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  useLayoutEffect(() => {
    document.body.style.background = 'var(--bg)'
    return () => { document.body.style.background = '' }
  }, [])

  useEffect(() => {
    notificationService.getAll()
      .then(res => setNotifications(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ── Derived lists ───────────────────────────────────────────────────────────
  const visible = [...notifications]
    .filter(n => !deletedIds.has(n.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const unread = visible.filter(n => !n.is_read)
  const read   = visible.filter(n =>  n.is_read)

  // ── Actions ─────────────────────────────────────────────────────────────────
  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    notificationService.markRead(id).catch(() => {})
  }

  const markUnread = (id: string) => {
    removeFromReadStore(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n))
  }

  const markAllRead = () => {
    const ids = unread.map(n => n.id)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    notificationService.markAllRead(ids).catch(() => {})
  }

  const deleteNotif = (id: string) => {
    const next = new Set(deletedIds)
    next.add(id)
    setDeletedIds(next)
    saveDeletedIds(next)
    setOpenMenu(null)
  }

  const clearRead = () => {
    const next = new Set(deletedIds)
    read.forEach(n => next.add(n.id))
    setDeletedIds(next)
    saveDeletedIds(next)
  }

  // ── Render helpers ──────────────────────────────────────────────────────────
  const renderItem = (n: Notification) => {
    const { icon: Icon, color, bg } = notifIcon(n.type)
    const isOpen = openMenu === n.id

    return (
      <div key={n.id} style={{ position: 'relative' }}>
        <div
          onClick={() => { setOpenMenu(null); if (!n.is_read) markRead(n.id) }}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '14px 12px 14px 0',
            marginLeft: 16,
            borderBottom: `1px solid ${C.border}`,
            cursor: 'pointer',
            background: n.is_read ? 'transparent' : `${C.amber}07`,
            borderLeft: 'none',
            position: 'relative',
          }}
        >
          {/* Unread left accent bar */}
          {!n.is_read && (
            <div style={{
              position: 'absolute', left: -16, top: 0, bottom: 0,
              width: 3, background: C.amber, borderRadius: '0 2px 2px 0',
            }} />
          )}

          {/* Icon */}
          <div style={{
            width: 42, height: 42, borderRadius: '50%', background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, opacity: n.is_read ? 0.55 : 1,
            transition: 'opacity 0.2s',
          }}>
            <Icon style={{ width: 19, height: 19, color }} />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <p style={{
                fontSize: 13,
                fontWeight: n.is_read ? 500 : 700,
                color: n.is_read ? C.textMuted : C.textHi,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1,
              }}>{n.title}</p>
              {!n.is_read && (
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.amber, flexShrink: 0 }} />
              )}
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.55 }}>{n.message}</p>
            <p style={{ fontSize: 11, color: C.textFaint, marginTop: 5 }}>{formatRelativeTime(n.created_at)}</p>
          </div>

          {/* Menu trigger */}
          <button
            onClick={e => { e.stopPropagation(); setOpenMenu(isOpen ? null : n.id) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px 4px', color: C.textFaint, flexShrink: 0,
              borderRadius: 4,
            }}
          >
            <MoreVertical style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 8, right: 8, zIndex: 50,
              background: C.surface1,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
              overflow: 'hidden', minWidth: 172,
            }}
          >
            <MenuItem
              icon={n.is_read ? Mail : MailOpen}
              label={n.is_read ? 'Mark as unread' : 'Mark as read'}
              color={C.textHi}
              onClick={() => { n.is_read ? markUnread(n.id) : markRead(n.id); setOpenMenu(null) }}
            />
            <div style={{ height: 1, background: C.border }} />
            <MenuItem
              icon={Trash2}
              label="Delete notification"
              color="#EF4444"
              onClick={() => deleteNotif(n.id)}
            />
          </div>
        )}
      </div>
    )
  }

  const renderAll = () => {
    if (visible.length === 0) {
      return <EmptyState icon={Bell} title="No notifications" subtitle="Job alerts and updates appear here." />
    }
    return (
      <>
        {unread.length > 0 && (
          <>
            <SectionHeader label="Unread" count={unread.length} accent />
            {unread.map(renderItem)}
          </>
        )}
        {read.length > 0 && (
          <>
            <SectionHeader label="Read" />
            {read.map(renderItem)}
          </>
        )}
      </>
    )
  }

  const renderFiltered = (items: Notification[], emptyTitle: string, emptySub: string) => {
    if (items.length === 0) {
      return <EmptyState icon={Bell} title={emptyTitle} subtitle={emptySub} />
    }
    return items.map(renderItem)
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.bg }}
      onClick={() => setOpenMenu(null)}
    >
      {/* ── Header ── */}
      <div style={{
        height: 56, background: C.surface1, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <ArrowLeft style={{ width: 20, height: 20, color: C.textMuted }} />
        </button>

        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: C.textHi }}>
          Notifications
        </span>

        {tab === 'read' && read.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); clearRead() }}
            style={{ fontSize: 12, fontWeight: 600, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Clear all
          </button>
        )}

        {unread.length > 0 && tab !== 'read' && (
          <button
            onClick={e => { e.stopPropagation(); markAllRead() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, color: C.amber,
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <CheckCheck style={{ width: 13, height: 13 }} />
            Mark all read
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', background: C.surface1,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        {([ ['all', visible.length], ['unread', unread.length], ['read', read.length] ] as [Tab, number][]).map(([t, count]) => {
          const active = tab === t
          return (
            <button
              key={t}
              onClick={e => { e.stopPropagation(); setTab(t) }}
              style={{
                flex: 1, padding: '10px 6px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? C.amber : C.textMuted,
                borderBottom: active ? `2px solid ${C.amber}` : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'color 0.15s',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, lineHeight: 1,
                  padding: '2px 6px', borderRadius: 99,
                  background: active
                    ? (t === 'unread' ? '#DC2626' : C.amber)
                    : `${C.textFaint}28`,
                  color: active ? '#fff' : C.textMuted,
                  transition: 'background 0.15s',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── List ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2, 3, 4].map(i => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : tab === 'all'
          ? renderAll()
          : tab === 'unread'
            ? renderFiltered(unread, 'All caught up', 'No unread notifications right now.')
            : renderFiltered(read,   'Nothing here',  'Read notifications will appear here.')
        }
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label, count, accent }: { label: string; count?: number; accent?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px 8px',
      position: 'sticky', top: 0, zIndex: 10,
      background: 'var(--bg)',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.09em',
        color: C.textFaint,
      }}>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 800,
          padding: '2px 6px', borderRadius: 99,
          background: accent ? '#DC2626' : `${C.textFaint}28`,
          color: accent ? '#fff' : C.textMuted,
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon, label, color, onClick,
}: {
  icon: React.ElementType
  label: string
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '11px 14px',
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 13, color, textAlign: 'left',
      }}
    >
      <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
      {label}
    </button>
  )
}
