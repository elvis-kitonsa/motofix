import { useState, useRef, useEffect } from 'react'
import { Send, Camera, X, Stethoscope, ChevronRight } from 'lucide-react'
import { C } from '@/styles/tokens'
import { diagnosisService, suggestPrice } from '@/config/api'
import type { ChatMsg } from '@/config/api'

interface DiagnosisResult {
  fault_category?: string
  severity?: string
  summary?: string
  recommended_actions?: string[]
}

interface Props {
  serviceType: string
  description: string
  onDiagnosisComplete: (result: DiagnosisResult, suggestedPrice: number, description: string) => void
  onClose: () => void
}

export default function DiagnosticTool({ serviceType, description, onDiagnosisComplete, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null)
  const [started, setStarted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startDiagnosis = async () => {
    setStarted(true)
    const opening: ChatMsg = {
      role: 'user',
      content: `I am a mechanic. The driver reported: "${serviceType}" — "${description}". I have arrived at the vehicle. Help me diagnose the actual fault.`,
    }
    setMessages([opening])
    setLoading(true)
    try {
      const res = await diagnosisService.chat([opening])
      const reply: ChatMsg = { role: 'assistant', content: res.data.reply }
      setMessages(prev => [...prev, reply])
      if (res.data.diagnosis_ready && res.data.diagnosis) {
        setDiagnosis(res.data.diagnosis as DiagnosisResult)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not connect to the diagnosis service. Please describe the fault manually.' }])
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMsg = { role: 'user', content: input.trim() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)
    try {
      const res = await diagnosisService.chat(updated)
      const reply: ChatMsg = { role: 'assistant', content: res.data.reply }
      setMessages(prev => [...prev, reply])
      if (res.data.diagnosis_ready && res.data.diagnosis) {
        setDiagnosis(res.data.diagnosis as DiagnosisResult)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error — please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const sendImage = async (file: File) => {
    const userMsg: ChatMsg = { role: 'user', content: '📷 [Photo of the vehicle fault]' }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('messages', JSON.stringify(messages))
      fd.append('user_text', 'Here is a photo of the fault.')
      const res = await diagnosisService.chatWithImage(fd)
      const reply: ChatMsg = { role: 'assistant', content: res.data.reply }
      setMessages(prev => [...prev, reply])
      if (res.data.diagnosis_ready && res.data.diagnosis) {
        setDiagnosis(res.data.diagnosis as DiagnosisResult)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not process image.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleUseDiagnosis = () => {
    if (!diagnosis) return
    const price = suggestPrice(diagnosis.fault_category ?? serviceType, diagnosis.severity)
    const desc = [
      diagnosis.summary ?? '',
      ...(diagnosis.recommended_actions ?? []).map(a => `• ${a}`),
    ].filter(Boolean).join('\n')
    onDiagnosisComplete(diagnosis, price.suggested, desc)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, background: C.surface1 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${C.amber}20`, border: `1px solid ${C.amber}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Stethoscope style={{ width: 18, height: 18, color: C.amber }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: C.textHi, margin: 0 }}>AI Diagnostic Tool</p>
          <p style={{ fontSize: 11, color: C.textFaint, margin: 0 }}>Describe or photograph the fault</p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X style={{ width: 20, height: 20, color: C.textFaint }} />
        </button>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, background: C.surface1 }}>
        {!started ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '40px 0' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${C.amber}14`, border: `2px solid ${C.amber}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Stethoscope style={{ width: 32, height: 32, color: C.amber }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.textHi, textAlign: 'center', margin: 0 }}>Ready to Diagnose</p>
            <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 1.5, maxWidth: 280, margin: 0 }}>
              The AI will help you identify the exact fault and suggest a fair price range.
            </p>
            <button onClick={startDiagnosis} style={{
              height: 48, paddingInline: 28, borderRadius: 14, border: 'none',
              background: `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`,
              color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              Start Diagnosis <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? `${C.amber}22` : C.surface2,
                  border: `1px solid ${m.role === 'user' ? C.amber + '40' : C.border}`,
                  fontSize: 13, color: C.textHi, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 16px', borderRadius: '14px 14px 14px 4px', background: C.surface2, border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 18, letterSpacing: 4 }}>···</span>
                </div>
              </div>
            )}

            {/* Diagnosis result card */}
            {diagnosis && (
              <div style={{ background: `${C.green}10`, border: `1px solid ${C.green}40`, borderRadius: 14, padding: '14px 16px', marginTop: 4 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Diagnosis Ready</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.textHi, marginBottom: 4 }}>
                  {diagnosis.fault_category?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  {diagnosis.severity && <span style={{ fontSize: 12, fontWeight: 600, color: C.textFaint, marginLeft: 8 }}>({diagnosis.severity} severity)</span>}
                </p>
                {(() => {
                  const p = suggestPrice(diagnosis.fault_category ?? '', diagnosis.severity)
                  return (
                    <p style={{ fontSize: 13, color: C.amber, fontWeight: 700, marginBottom: 12 }}>
                      Suggested price: UGX {p.min.toLocaleString()} – {p.max.toLocaleString()}
                      <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 600 }}> (recommended: UGX {p.suggested.toLocaleString()})</span>
                    </p>
                  )
                })()}
                <button onClick={handleUseDiagnosis} style={{
                  width: '100%', height: 44, borderRadius: 12, border: 'none',
                  background: `linear-gradient(135deg, ${C.green}, #22c55e)`,
                  color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                }}>
                  Use This Diagnosis & Set Price
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      {started && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.surface1, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <input
            ref={fileRef as unknown as React.RefObject<HTMLInputElement>}
            type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = '' }}
          />
          <button onClick={() => fileRef.current?.click()} style={{ width: 40, height: 40, borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Camera style={{ width: 16, height: 16, color: C.textFaint }} />
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Describe what you observe…"
            style={{ flex: 1, height: 40, borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}`, color: C.textHi, fontSize: 13, padding: '0 12px', outline: 'none' }}
          />
          <button onClick={sendMessage} disabled={!input.trim() || loading} style={{
            width: 40, height: 40, borderRadius: 10, border: 'none', flexShrink: 0,
            background: input.trim() && !loading ? `linear-gradient(135deg, ${C.amber}, ${C.amberDark})` : C.surface2,
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Send style={{ width: 16, height: 16, color: input.trim() && !loading ? '#000' : C.textFaint }} />
          </button>
        </div>
      )}
    </div>
  )
}
