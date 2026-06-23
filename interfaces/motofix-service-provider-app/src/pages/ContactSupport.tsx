// ContactSupport.tsx — the help/support screen for providers: ways to reach the MOTOFIX team
// (phone, WhatsApp, email) and common questions, for when a mechanic needs assistance.

import { useState } from 'react'
import type { ElementType } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
  Send,
  ShieldAlert,
  Smartphone,
  Wrench,
} from 'lucide-react'

const G = '#34D399'
const Y = '#F59E0B'
const R = '#ff2d2d'
const SUPPORT_EMAIL = 'admin@motofix.ug'
const SUPPORT_PHONE = '+256 700 000 000'
const WHATSAPP_PHONE = '+256700000000'

const TOPICS = [
  { id: 'payment',     label: 'Payment / payout', Icon: CreditCard,   accent: Y  },
  { id: 'job_request', label: 'Job request issue', Icon: Wrench,       accent: R  },
  { id: 'account',     label: 'Account & verify',  Icon: Smartphone,   accent: '#A78BFA' },
  { id: 'technical',   label: 'Technical issue',   Icon: Phone,        accent: '#60A5FA' },
  { id: 'safety',      label: 'Safety concern',    Icon: ShieldAlert,  accent: R  },
  { id: 'other',       label: 'Something else',    Icon: MessageCircle, accent: G },
]

function ActionButton({
  icon: Icon, label, sub, accent, onClick,
}: {
  icon: ElementType; label: string; sub: string; accent: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', border: '1px solid var(--border-2)',
        background: 'var(--surface-1)', borderRadius: 18, padding: 14,
        display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 14, flexShrink: 0,
        background: `${accent}14`, border: `1.5px solid ${accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon style={{ width: 18, height: 18, color: accent }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ color: 'var(--text-hi)', fontSize: 14, fontWeight: 900, marginBottom: 3 }}>{label}</p>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.35 }}>{sub}</p>
      </div>
    </button>
  )
}

export default function ContactSupport() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTab = (location.state as { returnTab?: string } | null)?.returnTab ?? 'home'
  const [topic,   setTopic]   = useState('payment')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [copied,  setCopied]  = useState(false)
  const [sent,    setSent]    = useState(false)

  const selectedTopic = TOPICS.find(t => t.id === topic) ?? TOPICS[0]
  const canSend = message.trim().length >= 8

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const submit = () => {
    if (!canSend) return
    localStorage.setItem('motofix_sp_support_draft', JSON.stringify({
      topic,
      message: message.trim(),
      contact: contact.trim(),
      email: SUPPORT_EMAIL,
      created_at: new Date().toISOString(),
    }))
    setSent(true)
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--page-bg)', color: 'var(--text-hi)', paddingBottom: 44 }}>

      {/* ── Sticky header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--overlay-bg)', borderBottom: '1px solid var(--border-2)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      }}>
        <div style={{
          maxWidth: 720, margin: '0 auto',
          padding: 'max(env(safe-area-inset-top, 0px), 14px) 16px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => navigate('/dashboard', { state: { tab: returnTab } })}
            aria-label="Back"
            style={{
              width: 38, height: 38, borderRadius: 12,
              border: '1px solid var(--border-3)', background: 'var(--surface-3)',
              color: 'var(--text-md)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <ArrowLeft style={{ width: 18, height: 18 }} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ color: `${G}d9`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 800, marginBottom: 3 }}>
              MOTOFIX Support
            </p>
            <h1 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 19, lineHeight: 1.1 }}>
              Contact Support
            </h1>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '22px 16px 0' }}>

        <section style={{
          borderRadius: 22, background: 'var(--surface-1)',
          border: '1px solid var(--border-2)', overflow: 'hidden', marginBottom: 18,
        }}>
          {/* ── Hero ── */}
          <div style={{
            padding: '24px 20px',
            background: `linear-gradient(135deg, ${G}16, transparent 66%)`,
            borderBottom: '1px solid var(--border-1)',
          }}>
            <div style={{
              width: 58, height: 58, borderRadius: 18,
              background: `${G}18`, border: `1.5px solid ${G}3d`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, boxShadow: `0 0 28px ${G}16`,
            }}>
              {sent
                ? <CheckCircle2 style={{ width: 28, height: 28, color: G }} />
                : <Headphones   style={{ width: 28, height: 28, color: G }} />}
            </div>
            <h2 style={{ color: 'var(--text-hi)', fontSize: 24, lineHeight: 1.15, fontWeight: 900, marginBottom: 10 }}>
              {sent ? 'Support note saved' : 'How can we help?'}
            </h2>
            <p style={{ color: 'var(--text-md)', fontSize: 13, lineHeight: 1.65, maxWidth: 580 }}>
              {sent
                ? `Your support note is saved on this device. You can also email ${SUPPORT_EMAIL} directly if the issue is urgent.`
                : 'Reach the MOTOFIX team for payout issues, job request problems, account or verification questions, technical faults, safety concerns, or general feedback.'}
            </p>
          </div>

          <div style={{ padding: '20px' }}>

            {/* ── Channel buttons ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 20 }}>
              <ActionButton
                icon={Mail}
                label="Email support"
                sub={SUPPORT_EMAIL}
                accent={G}
                onClick={() => { window.location.href = `mailto:${SUPPORT_EMAIL}?subject=MOTOFIX%20Provider%20Support` }}
              />
              <ActionButton
                icon={Phone}
                label="Call support"
                sub={SUPPORT_PHONE}
                accent="#60A5FA"
                onClick={() => { window.location.href = `tel:${SUPPORT_PHONE.replace(/\s/g, '')}` }}
              />
              <ActionButton
                icon={MessageCircle}
                label="WhatsApp"
                sub="Chat with support"
                accent="#22C55E"
                onClick={() => { window.location.href = `https://wa.me/${WHATSAPP_PHONE.replace('+', '')}?text=Hello%20MOTOFIX%20support%20(Provider)` }}
              />
            </div>

            {/* ── Copy email ── */}
            <button
              onClick={copyEmail}
              style={{
                width: '100%', minHeight: 44, borderRadius: 14,
                border: `1px solid ${G}35`, background: `${G}10`, color: G,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, fontSize: 13, fontWeight: 900, cursor: 'pointer', marginBottom: 22,
              }}
            >
              {copied ? <CheckCircle2 style={{ width: 16, height: 16 }} /> : <Copy style={{ width: 16, height: 16 }} />}
              {copied ? 'Email copied' : `Copy ${SUPPORT_EMAIL}`}
            </button>

            {/* ── Topic selector ── */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ color: 'var(--text-hi)', fontSize: 13, fontWeight: 900, marginBottom: 10 }}>
                What do you need help with?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8 }}>
                {TOPICS.map(({ id, label, Icon, accent }) => {
                  const active = topic === id
                  return (
                    <button
                      key={id}
                      onClick={() => setTopic(id)}
                      style={{
                        minHeight: 46, borderRadius: 15,
                        border: active ? `1.5px solid ${accent}66` : '1px solid var(--border-2)',
                        background: active ? `${accent}14` : 'var(--surface-2)',
                        color: active ? accent : 'var(--text-md)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                      }}
                    >
                      <Icon style={{ width: 15, height: 15 }} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Contact detail ── */}
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', color: 'var(--text-hi)', fontSize: 13, fontWeight: 900, marginBottom: 9 }}>
                Contact detail
              </span>
              <input
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder="Phone number or email we can reply to"
                style={{
                  width: '100%', height: 48, borderRadius: 15,
                  border: '1px solid var(--border-3)', background: 'var(--input-bg)',
                  color: 'var(--text-hi)', padding: '0 14px',
                  outline: 'none', fontSize: 13, fontFamily: 'inherit',
                }}
              />
            </label>

            {/* ── Message ── */}
            <label style={{ display: 'block', marginBottom: 18 }}>
              <span style={{ display: 'block', color: 'var(--text-hi)', fontSize: 13, fontWeight: 900, marginBottom: 9 }}>
                Message
              </span>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={`Tell us about your ${selectedTopic.label.toLowerCase()}...`}
                rows={5}
                style={{
                  width: '100%', resize: 'vertical', minHeight: 122,
                  borderRadius: 16, border: '1px solid var(--border-3)',
                  background: 'var(--input-bg)', color: 'var(--text-hi)',
                  padding: '13px 14px', outline: 'none',
                  fontSize: 13, lineHeight: 1.55, fontFamily: 'inherit',
                }}
              />
            </label>

            {/* ── Submit ── */}
            <button
              onClick={submit}
              disabled={!canSend}
              style={{
                width: '100%', height: 52, borderRadius: 16,
                border: canSend ? `1px solid ${G}70` : '1px solid var(--border-3)',
                background: canSend ? `linear-gradient(135deg, ${G}, #16A34A)` : 'var(--surface-3)',
                color: canSend ? '#06130d' : 'var(--text-dim)',
                fontSize: 14, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 9, cursor: canSend ? 'pointer' : 'not-allowed',
                boxShadow: canSend ? `0 10px 34px ${G}28` : 'none',
              }}
            >
              <Send style={{ width: 17, height: 17 }} />
              Save Support Note
            </button>
          </div>
        </section>

        {/* ── Info chips ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {[
            { Icon: AlertTriangle, title: 'Urgent safety issue', sub: 'Call public emergency services first.', accent: R },
            { Icon: Clock3,        title: 'Support hours',       sub: 'Daily, 7:00 AM – 10:00 PM EAT.',      accent: Y },
            { Icon: Mail,          title: 'Official email',      sub: SUPPORT_EMAIL,                          accent: G },
          ].map(({ Icon, title, sub, accent }) => (
            <div key={title} style={{
              borderRadius: 16, background: 'var(--surface-1)',
              border: '1px solid var(--border-2)', padding: 14,
            }}>
              <Icon style={{ width: 18, height: 18, color: accent, marginBottom: 8 }} />
              <p style={{ color: 'var(--text-hi)', fontSize: 12, fontWeight: 900, marginBottom: 4 }}>{title}</p>
              <p style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.45 }}>{sub}</p>
            </div>
          ))}
        </div>

      </main>
    </div>
  )
}
