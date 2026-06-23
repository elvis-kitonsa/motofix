// Chat.tsx — the live two-way chat between the mechanic and the driver for a specific job
// (text, voice notes, photos). Messages are saved on the server and delivered in real time
// over the WebSocket. This is the mechanic's side of the same conversation as the driver app's DriverChat.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, Mic, Paperclip, Camera, Play, Pause, X, Check, Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useWS } from '@/contexts/WebSocketContext'
import { jobService, chatService, type JobChatMessage } from '@/config/api'
import type { ServiceRequest } from '@/types'

interface UIMsg {
  id: string
  body: string
  mediaType: 'none' | 'voice' | 'image'
  mediaUrl?: string
  isOwn: boolean
  createdAt: string
  pending?: boolean
  seen?: boolean
}

const QUICK_REPLIES = [
  "On my way 🚗",
  "I have arrived 📍",
  "Give me 10 minutes ⏱️",
  "What's your exact location? 📍",
]

function dateSeparator(date: Date): string {
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'Today'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (date.toDateString() === y.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })
}
function driverInitials(name?: string | null) {
  if (!name) return 'D'
  const p = name.trim().split(' ')
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
function toUI(m: JobChatMessage): UIMsg {
  return {
    id: String(m.id),
    body: m.body ?? '',
    mediaType: m.media_type ?? 'none',
    mediaUrl: m.media_url ?? undefined,
    isOwn: m.sender_role === 'mechanic',
    createdAt: m.created_at ?? new Date().toISOString(),
    seen: m.seen_by_driver,   // our (mechanic's) message has been read by the driver
  }
}

export default function Chat() {
  const navigate = useNavigate()
  const { requestId } = useParams<{ requestId: string }>()
  const { user } = useAuth()
  const { lastMessage, sendMessage } = useWS()
  const myId = String(user?.id ?? (user as any)?.phone ?? '')

  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [messages, setMessages] = useState<UIMsg[]>([])
  const [loading, setLoading]   = useState(true)
  const [inputText, setInputText] = useState('')
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl]   = useState('')
  const [playing, setPlaying]     = useState<string | null>(null)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachPreview, setAttachPreview] = useState<string | null>(null)
  const [sending, setSending]     = useState(false)

  const seenIds     = useRef<Set<string>>(new Set())
  const bottomRef   = useRef<HTMLDivElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)
  const cameraRef   = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const audioRefs   = useRef<Map<string, HTMLAudioElement>>(new Map())

  const [otherTyping, setOtherTyping] = useState(false)
  const typingStopRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingRef  = useRef(0)
  const otherTypingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sendTyping = useCallback((typing: boolean) => {
    if (!requestId) return
    sendMessage({ type: 'chat_typing', service_request_id: requestId, role: 'mechanic', typing })
  }, [requestId, sendMessage])

  const sendSeen = useCallback(() => {
    if (!requestId) return
    sendMessage({ type: 'chat_seen', service_request_id: requestId, seen_by: 'mechanic' })
  }, [requestId, sendMessage])

  const addMsg = useCallback((m: UIMsg) => {
    if (seenIds.current.has(m.id)) return
    seenIds.current.add(m.id)
    setMessages(prev => [...prev, m])
  }, [])

  useEffect(() => {
    jobService.getActive()
      .then(res => {
        const reqs: ServiceRequest[] = Array.isArray(res.data) ? res.data : [res.data]
        setRequest(reqs.find(r => String(r.id) === requestId) ?? reqs[0] ?? null)
      })
      .catch(() => {})
  }, [requestId])

  // Load history (and mark the driver's messages as seen)
  useEffect(() => {
    if (!requestId) return
    let cancelled = false
    chatService.list(requestId, 'mechanic', true)
      .then(res => {
        if (cancelled) return
        const list = (res.data?.messages ?? []).map(toUI)
        list.forEach(m => seenIds.current.add(m.id))
        setMessages(list)
        sendSeen()  // let the driver know we've opened & read the thread
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [requestId, sendSeen])

  // Live WebSocket events: new messages, the driver's typing state, and
  // read-receipts telling us the driver has seen our messages.
  useEffect(() => {
    const msg = lastMessage as {
      type?: string; service_request_id?: string; id?: number
      sender_role?: string; message?: string; media_type?: string; media_url?: string; created_at?: string
      role?: string; typing?: boolean; seen_by?: string
    } | null
    if (!msg || String(msg.service_request_id) !== String(requestId)) return

    if (msg.type === 'chat_message') {
      const id = msg.id != null ? String(msg.id) : `ws-${Date.now()}`
      addMsg({
        id,
        body: msg.message ?? '',
        mediaType: (msg.media_type as UIMsg['mediaType']) ?? 'none',
        mediaUrl: msg.media_url ?? undefined,
        isOwn: msg.sender_role === 'mechanic',
        createdAt: msg.created_at ?? new Date().toISOString(),
      })
      if (msg.sender_role === 'driver') {
        chatService.markSeen(requestId!, 'mechanic').catch(() => {})
        sendSeen()
      }
    } else if (msg.type === 'chat_typing' && msg.role === 'driver') {
      if (msg.typing) {
        setOtherTyping(true)
        if (otherTypingRef.current) clearTimeout(otherTypingRef.current)
        otherTypingRef.current = setTimeout(() => setOtherTyping(false), 4000)
      } else {
        setOtherTyping(false)
      }
    } else if (msg.type === 'chat_seen' && msg.seen_by === 'driver') {
      setMessages(prev => prev.map(m => (m.isOwn ? { ...m, seen: true } : m)))
    }
  }, [lastMessage, requestId, addMsg, sendSeen])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading, otherTyping])

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start(); recorderRef.current = mr; setRecording(true)
    } catch { /* mic denied */ }
  }
  function stopRec() { recorderRef.current?.stop(); setRecording(false) }
  function discardVoice() { setAudioBlob(null); setAudioUrl('') }

  function togglePlay(msgId: string) {
    const audio = audioRefs.current.get(msgId)
    if (!audio) return
    if (playing === msgId) { audio.pause(); setPlaying(null) }
    else {
      if (playing) audioRefs.current.get(playing)?.pause()
      audio.play(); setPlaying(msgId); audio.onended = () => setPlaying(null)
    }
  }

  function addAttachment(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    setAttachment(f)
    setAttachPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }
  function discardAttachment() { setAttachment(null); setAttachPreview(null) }

  // ── Typing indicator (throttled while typing, auto-stops after a pause) ──
  const handleTyping = () => {
    const now = Date.now()
    if (now - lastTypingRef.current > 1500) { sendTyping(true); lastTypingRef.current = now }
    if (typingStopRef.current) clearTimeout(typingStopRef.current)
    typingStopRef.current = setTimeout(() => { sendTyping(false); lastTypingRef.current = 0 }, 2500)
  }
  const stopTyping = () => {
    if (typingStopRef.current) clearTimeout(typingStopRef.current)
    if (lastTypingRef.current) { sendTyping(false); lastTypingRef.current = 0 }
  }

  const sendText = async (text?: string) => {
    const body = (text ?? inputText).trim()
    if (!body || !requestId) return
    stopTyping()
    setInputText('')
    const temp: UIMsg = { id: `t-${Date.now()}`, body, mediaType: 'none', isOwn: true, createdAt: new Date().toISOString(), pending: true }
    setMessages(prev => [...prev, temp])
    try {
      const res = await chatService.sendText(requestId, { sender_role: 'mechanic', sender_id: myId, body })
      const serverMsg = toUI(res.data)
      seenIds.current.add(serverMsg.id)
      // If the WS echo already landed, just drop the optimistic temp; else swap it in.
      setMessages(prev => prev.some(m => m.id === serverMsg.id)
        ? prev.filter(m => m.id !== temp.id)
        : prev.map(m => m.id === temp.id ? serverMsg : m))
    } catch {
      setMessages(prev => prev.filter(m => m.id !== temp.id))
      setInputText(body)
    }
  }

  const sendMedia = async () => {
    if (!requestId || (!audioBlob && !attachment)) return
    stopTyping()
    setSending(true)
    const isVoice = !!audioBlob
    const file = isVoice
      ? new File([audioBlob!], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
      : attachment!
    const temp: UIMsg = {
      id: `t-${Date.now()}`, body: inputText.trim(),
      mediaType: isVoice ? 'voice' : 'image',
      mediaUrl: isVoice ? audioUrl : (attachPreview ?? undefined),
      isOwn: true, createdAt: new Date().toISOString(), pending: true,
    }
    setMessages(prev => [...prev, temp])
    const form = new FormData()
    form.append('file', file)
    form.append('sender_role', 'mechanic')
    form.append('sender_id', myId)
    form.append('body', inputText.trim())
    setInputText(''); setAudioBlob(null); setAudioUrl(''); setAttachment(null); setAttachPreview(null)
    try {
      const res = await chatService.sendMedia(requestId, form)
      const serverMsg = toUI(res.data)
      seenIds.current.add(serverMsg.id)
      setMessages(prev => prev.some(m => m.id === serverMsg.id)
        ? prev.filter(m => m.id !== temp.id)
        : prev.map(m => m.id === temp.id ? serverMsg : m))
    } catch {
      setMessages(prev => prev.map(m => m.id === temp.id ? { ...m, pending: false, body: '⚠️ Failed to send' } : m))
    } finally {
      setSending(false)
    }
  }

  const onSendPress = () => { if (audioBlob || attachment) sendMedia(); else sendText() }

  const driverName = request?.driver_name ?? null
  const isActive = !!request && !['completed', 'cancelled'].includes(request?.status ?? '')
  const showQuickReplies = !loading && messages.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--page-bg)', maxWidth: 480, margin: '0 auto' }}>
      <style>{`
        @keyframes voice-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes msg-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes typing-dot { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-4px);opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: 'var(--overlay-bg)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-2)', flexShrink: 0,
        paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <ArrowLeft style={{ width: 20, height: 20, color: 'var(--text-md)' }} />
        </button>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F6, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff' }}>
            {driverInitials(driverName)}
          </div>
          {isActive && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: '50%', background: '#22C55E', border: '2px solid var(--page-bg)' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {driverName ?? 'Driver'}
          </p>
          <span style={{ fontSize: 11.5, color: otherTyping ? '#F59E0B' : (isActive ? '#22C55E' : 'var(--text-faint)'), fontWeight: 600 }}>
            {otherTyping ? 'typing…' : isActive ? 'Online · on this job' : 'Job ended'}
          </span>
        </div>
        {request && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: '3px 8px', textTransform: 'capitalize', flexShrink: 0 }}>
            {request.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Loader2 style={{ width: 22, height: 22, color: 'var(--text-faint)', animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {showQuickReplies && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 0 16px', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>💬</div>
            <p style={{ fontSize: 13.5, color: 'var(--text-md)', fontWeight: 600, textAlign: 'center', maxWidth: 240, lineHeight: 1.5 }}>
              Message {driverName?.split(' ')[0] ?? 'the driver'} to confirm the meeting point.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280, marginTop: 4 }}>
              {QUICK_REPLIES.map(qr => (
                <button key={qr} onClick={() => sendText(qr)} style={{ padding: '10px 14px', borderRadius: 20, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.07)', color: '#F59E0B', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  {qr}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const msgDate = new Date(msg.createdAt)
          const prevDate = i > 0 ? new Date(messages[i - 1].createdAt) : null
          const showSep = !prevDate || msgDate.toDateString() !== prevDate.toDateString()
          const prevOwn = i > 0 && messages[i - 1].isOwn === msg.isOwn
          return (
            <div key={msg.id} style={{ animation: 'msg-in 0.18s ease both' }}>
              {showSep && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', background: 'var(--surface-3)', borderRadius: 20, padding: '3px 12px', border: '1px solid var(--border-2)' }}>
                    {dateSeparator(msgDate)}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: msg.isOwn ? 'flex-end' : 'flex-start', marginBottom: prevOwn ? 2 : 8 }}>
                {!msg.isOwn && !prevOwn && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0, marginRight: 8, alignSelf: 'flex-end', marginBottom: 4 }}>
                    {driverInitials(driverName)}
                  </div>
                )}
                {!msg.isOwn && prevOwn && <div style={{ width: 36, flexShrink: 0 }} />}

                <div style={{ maxWidth: '74%' }}>
                  {msg.mediaType === 'image' && msg.mediaUrl && (
                    <div style={{ borderRadius: msg.isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px', overflow: 'hidden', marginBottom: msg.body ? 3 : 0, position: 'relative' }}>
                      <img src={msg.mediaUrl} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block', opacity: msg.pending ? 0.6 : 1 }} />
                      {msg.pending && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 style={{ width: 22, height: 22, color: '#fff', animation: 'spin 1s linear infinite' }} /></div>}
                    </div>
                  )}

                  {msg.mediaType === 'voice' && msg.mediaUrl && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderRadius: msg.isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: msg.isOwn ? 'rgba(245,158,11,0.18)' : 'var(--surface-3)',
                      border: `1px solid ${msg.isOwn ? 'rgba(245,158,11,0.35)' : 'var(--border-2)'}`, minWidth: 170,
                    }}>
                      <button onClick={() => togglePlay(msg.id)} disabled={msg.pending}
                        style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: msg.isOwn ? '#F59E0B' : 'var(--surface-5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {msg.pending ? <Loader2 style={{ width: 14, height: 14, color: '#000', animation: 'spin 1s linear infinite' }} />
                          : playing === msg.id ? <Pause style={{ width: 14, height: 14, color: msg.isOwn ? '#000' : 'var(--text-hi)' }} />
                          : <Play style={{ width: 14, height: 14, color: msg.isOwn ? '#000' : 'var(--text-hi)' }} />}
                      </button>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 3, borderRadius: 3, background: msg.isOwn ? 'rgba(245,158,11,0.35)' : 'var(--border-3)', marginBottom: 4 }}>
                          <div style={{ height: '100%', width: playing === msg.id ? '45%' : '0%', borderRadius: 3, background: msg.isOwn ? '#F59E0B' : 'var(--text-faint)', transition: 'width 0.3s' }} />
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--text-faint)' }}>Voice note</p>
                      </div>
                      <audio ref={el => { if (el) audioRefs.current.set(msg.id, el) }} src={msg.mediaUrl} style={{ display: 'none' }} />
                    </div>
                  )}

                  {msg.body && msg.mediaType !== 'voice' && (
                    <div style={{
                      padding: '9px 13px',
                      borderRadius: msg.isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: msg.isOwn ? 'rgba(245,158,11,0.18)' : 'var(--surface-3)',
                      border: `1px solid ${msg.isOwn ? 'rgba(245,158,11,0.30)' : 'var(--border-2)'}`,
                    }}>
                      <p style={{ fontSize: 14, color: 'var(--text-hi)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.body}</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: msg.isOwn ? 'flex-end' : 'flex-start', marginTop: 3, paddingRight: msg.isOwn ? 2 : 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{timeLabel(msg.createdAt)}</span>
                    {msg.isOwn && (
                      msg.pending
                        ? <Loader2 style={{ width: 10, height: 10, color: 'var(--text-faint)', animation: 'spin 1s linear infinite' }} />
                        : <span style={{ display: 'flex' }} title={msg.seen ? 'Seen' : 'Delivered'}>
                            <Check style={{ width: 11, height: 11, color: msg.seen ? '#3B82F6' : 'var(--text-faint)' }} />
                            <Check style={{ width: 11, height: 11, color: msg.seen ? '#3B82F6' : 'var(--text-faint)', marginLeft: -5 }} />
                          </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* WhatsApp-style "Seen" under the last sent message once the driver reads it */}
        {(() => {
          const last = messages[messages.length - 1]
          if (!last || !last.isOwn || !last.seen || last.pending) return null
          return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -2, marginBottom: 6, paddingRight: 2 }}>
              <span style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600 }}>Seen</span>
            </div>
          )
        })()}

        {/* Typing indicator */}
        {otherTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8, animation: 'msg-in 0.18s ease both' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0, marginRight: 8, alignSelf: 'flex-end' }}>
              {driverInitials(driverName)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: 'var(--surface-3)', border: '1px solid var(--border-2)' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-faint)', display: 'inline-block', animation: `typing-dot 1.2s ease-in-out ${i * 0.18}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Voice preview */}
      {audioUrl && (
        <div style={{ padding: '8px 16px', flexShrink: 0, borderTop: '1px solid var(--border-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', animation: 'voice-pulse 1.2s ease-in-out infinite' }} />
            <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600, flex: 1 }}>Voice note ready</span>
            <button onClick={discardVoice} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <Trash2 style={{ width: 14, height: 14, color: 'var(--text-faint)' }} />
            </button>
          </div>
        </div>
      )}

      {/* Attachment preview */}
      {attachment && (
        <div style={{ padding: '8px 16px', flexShrink: 0, borderTop: '1px solid var(--border-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border-3)' }}>
            {attachPreview
              ? <img src={attachPreview} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📎</div>}
            <span style={{ fontSize: 12, color: 'var(--text-md)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</span>
            <button onClick={discardAttachment} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X style={{ width: 14, height: 14, color: 'var(--text-faint)' }} />
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{
        flexShrink: 0, padding: '10px 16px',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)',
        background: 'var(--overlay-bg)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border-2)', display: 'flex', alignItems: 'flex-end', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, paddingBottom: 2 }}>
          <button onClick={() => cameraRef.current?.click()} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-3)', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Camera style={{ width: 15, height: 15, color: 'var(--text-md)' }} />
          </button>
          <button onClick={() => fileRef.current?.click()} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-3)', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paperclip style={{ width: 15, height: 15, color: 'var(--text-md)' }} />
          </button>
        </div>

        <textarea
          value={inputText}
          onChange={e => { setInputText(e.target.value); handleTyping() }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendPress() } }}
          placeholder="Message…"
          rows={1}
          style={{
            flex: 1, borderRadius: 22, background: 'var(--surface-3)', border: '1.5px solid var(--border-3)',
            color: 'var(--text-hi)', fontSize: 14, padding: '9px 14px', outline: 'none', resize: 'none',
            maxHeight: 88, lineHeight: 1.45, caretColor: '#F59E0B',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.45)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-3)' }}
        />

        {inputText.trim() || audioUrl || attachment ? (
          <button onClick={onSendPress} disabled={sending}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #F59E0B, #D97706)', cursor: sending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {sending ? <Loader2 style={{ width: 18, height: 18, color: '#000', animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 18, height: 18, color: '#000' }} />}
          </button>
        ) : (
          <button
            onPointerDown={startRec} onPointerUp={stopRec} onPointerLeave={() => { if (recording) stopRec() }}
            style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: recording ? 'rgba(239,68,68,0.15)' : 'var(--surface-3)',
              border: recording ? '2px solid rgba(239,68,68,0.5)' : '1px solid var(--border-3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: recording ? 'voice-pulse 0.8s ease-in-out infinite' : 'none',
            } as React.CSSProperties}
          >
            <Mic style={{ width: 18, height: 18, color: recording ? '#F87171' : 'var(--text-md)' }} />
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => addAttachment(e.target.files)} />
      <input ref={cameraRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => addAttachment(e.target.files)} />
    </div>
  )
}
