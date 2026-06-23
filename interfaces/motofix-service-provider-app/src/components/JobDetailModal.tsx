// JobDetailModal.tsx — the full-details popup for a job: customer, fault, location, any
// voice/photo, and the action buttons that move it through its stages (accept, start,
// complete, cancel, message the driver).

import { useEffect, useState } from 'react'
import { X, MapPin, Wrench, User, Ban, CheckCircle, MessageCircle, Play, Pause } from 'lucide-react'
import { C } from '@/styles/tokens'
import { chatService, type JobChatMessage } from '@/config/api'
import { useReadableLocation } from '@/utils/geocode'
import { formatUGX } from '@/utils/formatters'
import type { ServiceRequest } from '@/types'

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const ts = /[Z+]/.test(iso) ? iso : iso + 'Z'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-UG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface Props {
  request: ServiceRequest
  onClose: () => void
}

export default function JobDetailModal({ request, onClose }: Props) {
  const cancelled = request.status === 'cancelled'
  const accent = cancelled ? '#F87171' : '#4ADE80'
  const locationText = useReadableLocation(request)
  const [messages, setMessages] = useState<JobChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(true)
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => {
    // Read-only history view — don't mark anything seen.
    chatService.list(String(request.id), 'mechanic', false)
      .then(res => setMessages(res.data?.messages ?? []))
      .catch(() => {})
      .finally(() => setChatLoading(false))
  }, [request.id])

  const timeline: Array<[string, string | undefined]> = [
    ['Requested', request.created_at],
    ['Accepted', request.accepted_at],
    ['On the way', request.en_route_at],
    ['Arrived', request.arrived_at],
    ['Service started', request.service_started_at],
    [cancelled ? 'Cancelled' : 'Completed', cancelled ? undefined : (request.completed_at ?? request.completed_time)],
  ].filter(([, v]) => v) as Array<[string, string]>

  return (
    <>
      <style>{`@keyframes jdm-in { from{opacity:0;transform:translate(-50%,-48%) scale(0.97)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }`}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1301,
        width: 'calc(100% - 28px)', maxWidth: 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        background: 'var(--surface-1)', borderRadius: 22, overflow: 'hidden',
        boxShadow: '0 24px 90px rgba(0,0,0,0.75)', animation: 'jdm-in 0.26s cubic-bezier(0.34,1.4,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border-2)', flexShrink: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: `${accent}18`, border: `1.5px solid ${accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cancelled ? <Ban style={{ width: 20, height: 20, color: accent }} /> : <CheckCircle style={{ width: 20, height: 20, color: accent }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 900, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {request.issue_type ?? request.service_type ?? 'Service'}
            </p>
            <span style={{ fontSize: 11, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {cancelled ? 'Cancelled' : 'Completed'}
            </span>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 16, height: 16, color: C.textFaint }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '16px 18px 20px' }}>
          {/* Cancellation reason — prominent */}
          {cancelled && request.cancel_reason && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 14, marginBottom: 14, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.35)' }}>
              <Ban style={{ width: 16, height: 16, color: '#F87171', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, color: '#F87171', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                  Cancelled by {request.cancelled_by === 'mechanic' ? 'you' : (request.cancelled_by ?? 'driver')}
                </p>
                <p style={{ fontSize: 13, color: C.textHi, lineHeight: 1.45 }}>{request.cancel_reason}</p>
              </div>
            </div>
          )}

          {/* Info rows */}
          <Row icon={<User style={{ width: 15, height: 15, color: C.amber }} />} label="Driver" value={request.driver_name ?? 'Driver'} />
          <Row icon={<MapPin style={{ width: 15, height: 15, color: C.amber }} />} label="Location" value={locationText} />
          {request.description && (
            <Row icon={<Wrench style={{ width: 15, height: 15, color: C.amber }} />} label="Description" value={request.description} />
          )}
          {request.actual_fee != null && (
            <Row icon={<span style={{ fontSize: 13 }}>💰</span>} label="Fee" value={formatUGX(request.actual_fee)} />
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Timeline</p>
              {timeline.map(([label, ts]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ fontSize: 12.5, color: C.textMuted }}>{label}</span>
                  <span style={{ fontSize: 12, color: C.textHi, fontWeight: 600 }}>{fmtTime(ts)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Conversation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 18, marginBottom: 10 }}>
            <MessageCircle style={{ width: 14, height: 14, color: C.textFaint }} />
            <p style={{ fontSize: 11, fontWeight: 800, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Conversation</p>
          </div>

          {chatLoading ? (
            <p style={{ fontSize: 12.5, color: C.textFaint, textAlign: 'center', padding: '12px 0' }}>Loading messages…</p>
          ) : messages.length === 0 ? (
            <p style={{ fontSize: 12.5, color: C.textFaint, textAlign: 'center', padding: '12px 0' }}>No messages were exchanged on this job.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {messages.map(m => {
                const own = m.sender_role === 'mechanic'
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '78%' }}>
                      {m.media_type === 'image' && m.media_url && (
                        <img src={m.media_url} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12, display: 'block', marginBottom: m.body ? 3 : 0 }} />
                      )}
                      {m.media_type === 'voice' && m.media_url && (
                        <VoiceBubble id={String(m.id)} url={m.media_url} own={own} playing={playing} setPlaying={setPlaying} />
                      )}
                      {m.body && m.media_type !== 'voice' && (
                        <div style={{ padding: '8px 12px', borderRadius: own ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: own ? 'rgba(245,158,11,0.18)' : 'var(--surface-3)', border: `1px solid ${own ? 'rgba(245,158,11,0.3)' : 'var(--border-2)'}` }}>
                          <p style={{ fontSize: 13.5, color: C.textHi, lineHeight: 1.45, wordBreak: 'break-word' }}>{m.body}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '7px 0' }}>
      <div style={{ width: 18, display: 'flex', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 13.5, color: C.textHi, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{value}</p>
      </div>
    </div>
  )
}

function VoiceBubble({ id, url, own, playing, setPlaying }: { id: string; url: string; own: boolean; playing: string | null; setPlaying: (v: string | null) => void }) {
  const [audio] = useState(() => new Audio(url))
  const isPlaying = playing === id
  const toggle = () => {
    if (isPlaying) { audio.pause(); setPlaying(null) }
    else { audio.play(); setPlaying(id); audio.onended = () => setPlaying(null) }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: own ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: own ? 'rgba(245,158,11,0.18)' : 'var(--surface-3)', border: `1px solid ${own ? 'rgba(245,158,11,0.3)' : 'var(--border-2)'}`, minWidth: 150 }}>
      <button onClick={toggle} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: own ? '#F59E0B' : 'var(--surface-5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isPlaying ? <Pause style={{ width: 13, height: 13, color: own ? '#000' : C.textHi }} /> : <Play style={{ width: 13, height: 13, color: own ? '#000' : C.textHi }} />}
      </button>
      <span style={{ fontSize: 11.5, color: C.textMuted }}>Voice note</span>
    </div>
  )
}
