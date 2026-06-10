import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, Loader2, ChevronRight, AlertTriangle,
  Wrench, RotateCcw, Send,
} from 'lucide-react';
import { diagnosisService, type GuidedAnswer, type DiagnosisResult } from '@/config/api';
import { toast } from 'sonner';

/* First question is fixed for an instant first render; the AI takes over after. */
const FIRST_QUESTION = "What's the main thing you've noticed with your vehicle?";
const FIRST_OPTIONS = [
  "It won't start",
  'Strange noise',
  'Smoke or steam',
  'Warning light is on',
  'Losing power / stalling',
  'Flat or damaged tyre',
  'Fluid is leaking',
];

const SEVERITY_COLOR: Record<string, string> = {
  low: '#34D399', medium: '#F59E0B', high: '#F87171', critical: '#EF4444',
};
const SEVERITY_BG: Record<string, string> = {
  low: 'rgba(52,211,153,0.1)', medium: 'rgba(245,158,11,0.1)', high: 'rgba(248,113,113,0.1)', critical: 'rgba(239,68,68,0.1)',
};
const PROVIDER_LABEL: Record<string, string> = {
  mechanic: 'Mechanic', towing_provider: 'Towing Service',
  spare_parts_dealer: 'Spare Parts Dealer', ambulance: '🚨 Ambulance — Emergency',
};

function faultCategoryToIssueType(category: string, providerType: string): string {
  const c = category.toLowerCase();
  if (c.includes('tyre') || c.includes('tire') || c.includes('puncture')) return 'flat_tire';
  if (c.includes('battery'))                                               return 'battery';
  if (c.includes('fuel') || c.includes('gas'))                            return 'fuel';
  if (c.includes('engine') || c.includes('overheat') || c.includes('transmission')) return 'engine';
  if (providerType === 'towing_provider')                                  return 'towing';
  return 'other';
}

interface Step { question: string; options: string[]; }
interface RouteState { prefillLocation?: string; prefillLat?: number; prefillLng?: number; }

export default function GuidedDiagnosis() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const routeState = location.state as RouteState | null;

  const [current, setCurrent]     = useState<Step>({ question: FIRST_QUESTION, options: FIRST_OPTIONS });
  const [answers, setAnswers]     = useState<GuidedAnswer[]>([]);
  const [pastSteps, setPastSteps] = useState<Step[]>([]);
  const [loading, setLoading]     = useState(false);
  const [freeText, setFreeText]   = useState('');
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);

  const questionNumber = answers.length + 1;

  async function answer(answerText: string) {
    const text = answerText.trim();
    if (!text || loading) return;

    const qa: GuidedAnswer = { question: current.question, answer: text };
    const nextAnswers = [...answers, qa];
    setPastSteps(s => [...s, current]);
    setAnswers(nextAnswers);
    setFreeText('');
    setLoading(true);

    try {
      const res = await diagnosisService.guidedDiagnose(nextAnswers);
      if (res.data.done) {
        setDiagnosis(res.data.diagnosis);
      } else {
        setCurrent({ question: res.data.question, options: res.data.options });
      }
    } catch (err: any) {
      const status = err?.response?.status;
      toast.error(status === 503
        ? 'AI service is not configured on the server.'
        : 'Could not reach the AI. Please try again.');
      // Roll back this answer so the user can retry
      setAnswers(answers);
      setPastSteps(s => s.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    if (loading) return;
    if (diagnosis) { setDiagnosis(null); return; }
    if (pastSteps.length === 0) { navigate(-1); return; }
    const prev = pastSteps[pastSteps.length - 1];
    setPastSteps(s => s.slice(0, -1));
    setAnswers(a => a.slice(0, -1));
    setCurrent(prev);
    setFreeText('');
  }

  function restart() {
    setCurrent({ question: FIRST_QUESTION, options: FIRST_OPTIONS });
    setAnswers([]);
    setPastSteps([]);
    setDiagnosis(null);
    setFreeText('');
  }

  function buildSummary(): string {
    if (!diagnosis) return '';
    const cat = diagnosis.fault_category.replace(/_/g, ' ');
    const provider = PROVIDER_LABEL[diagnosis.provider_type] ?? diagnosis.provider_type;
    const lines: string[] = [];
    lines.push(`AI Diagnosis: ${diagnosis.fault_description}`);
    lines.push(`Likely issue: ${cat} • Severity: ${diagnosis.severity} • Recommended: ${provider}`);
    if (answers.length) {
      lines.push('');
      lines.push("Driver's answers to AI questions:");
      answers.forEach(a => lines.push(`• ${a.question} → ${a.answer}`));
    }
    return lines.join('\n');
  }

  function findHelp() {
    // Parts-fixable fault → route to the self-fix "parts you'll need" screen.
    if (diagnosis?.provider_type === 'spare_parts_dealer') {
      navigate('/parts-needed', { state: { diagnosis } });
      return;
    }
    const issueType = diagnosis
      ? faultCategoryToIssueType(diagnosis.fault_category, diagnosis.provider_type)
      : 'other';
    navigate('/locating', {
      state: {
        issueType,
        aiSummary: buildSummary(),
        aiDiagnosis: diagnosis,
      },
    });
  }

  return (
    <div className="fixed inset-0 flex items-stretch justify-center"
      style={{ background: 'var(--page-bg)', zIndex: 50 }}>

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)' }} />
      </div>

      <div className="w-full flex flex-col relative" style={{ maxWidth: 480 }}>

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 flex-shrink-0 relative z-10"
          style={{
            paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
            paddingBottom: 14,
            borderBottom: '1px solid var(--border-2)',
            background: 'var(--overlay-bg)',
            backdropFilter: 'blur(20px)',
          }}>
          <button onClick={goBack}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--border-3)' }}>
            <ArrowLeft className="w-[18px] h-[18px]" style={{ color: 'var(--text-md)' }} />
          </button>

          {/* AI avatar — brand logo in a glowing ring */}
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #1a1f2e, #0c0f17)',
                border: '1.5px solid rgba(245,158,11,0.55)',
                boxShadow: '0 0 0 3px rgba(245,158,11,0.10), 0 4px 14px rgba(245,158,11,0.30)',
              }}>
              <img src="/motofix-logo.png" alt="MOTOFIX"
                style={{ width: 30, height: 30, objectFit: 'contain' }}
                onError={e => {
                  const t = e.target as HTMLImageElement; t.style.display = 'none';
                  (t.parentElement as HTMLElement).innerHTML = '<span style="font-size:18px">🤖</span>';
                }} />
            </div>
            {/* sparkle accent */}
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 0 8px rgba(245,158,11,0.6)' }}>
              <Sparkles className="w-2.5 h-2.5 text-black" />
            </div>
            {/* online dot */}
            <span className="absolute -bottom-0.5 right-0 w-3 h-3 rounded-full border-2 animate-pulse"
              style={{ background: '#34D399', borderColor: 'var(--page-bg)' }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-black text-[15px]" style={{ color: 'var(--text-hi)', letterSpacing: '-0.02em' }}>MOTOFIX</p>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md tracking-wide"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#000' }}>AI</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34D399' }} />
              <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Online · guided diagnosis</p>
            </div>
          </div>

          {(answers.length > 0 || diagnosis) && (
            <button onClick={restart}
              className="flex items-center gap-1.5 h-9 px-3 rounded-full transition-all active:scale-90"
              title="Start over"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border-3)' }}>
              <RotateCcw className="w-3.5 h-3.5" style={{ color: 'var(--text-md)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-md)' }}>Restart</span>
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-5" style={{ scrollbarWidth: 'none' }}>

          {/* Progress dots (only while questioning) */}
          {!diagnosis && (
            <div className="flex items-center gap-1.5 mb-5">
              {Array.from({ length: Math.max(6, questionNumber) }).map((_, i) => (
                <div key={i} className="h-1.5 rounded-full flex-1 transition-all"
                  style={{ background: i < answers.length ? '#34D399' : i === answers.length ? '#F59E0B' : 'var(--surface-4)' }} />
              ))}
            </div>
          )}

          {/* Answered summary (collapsed trail) */}
          {!diagnosis && answers.length > 0 && (
            <div className="mb-5 space-y-1.5">
              {answers.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs"
                  style={{ color: 'var(--text-dim)' }}>
                  <span className="font-bold flex-shrink-0" style={{ color: '#34D399' }}>✓</span>
                  <span className="flex-1">{a.question}</span>
                  <span className="font-semibold flex-shrink-0" style={{ color: 'var(--text-md)' }}>{a.answer}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Current question ── */}
          {!diagnosis && !loading && (
            <div style={{ animation: 'gd-in 0.25s ease both' }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 0 10px rgba(245,158,11,0.35)' }}>
                  <Sparkles className="w-4 h-4 text-black" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(245,158,11,0.6)' }}>
                    Question {questionNumber}
                  </p>
                  <p className="text-base font-bold leading-snug" style={{ color: 'var(--text-hi)' }}>
                    {current.question}
                  </p>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2 mb-5">
                {current.options.map((opt, i) => (
                  <button key={i} onClick={() => answer(opt)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[0.98]"
                    style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-3)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'; e.currentTarget.style.background = 'rgba(245,158,11,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-3)'; e.currentTarget.style.background = 'var(--surface-2)'; }}>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-hi)' }}>{opt}</span>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(245,158,11,0.6)' }} />
                  </button>
                ))}
              </div>

              {/* Free text — describe it yourself */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className="flex-1 h-px" style={{ background: 'var(--border-2)' }} />
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-faint)' }}>
                  or describe it yourself
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-2)' }} />
              </div>

              <div className="flex items-end gap-2">
                <textarea
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); answer(freeText); } }}
                  placeholder="Type what you're noticing in your own words…"
                  rows={1}
                  className="flex-1 resize-none rounded-2xl px-3.5 py-2.5 outline-none"
                  style={{
                    background: 'var(--surface-3)', border: '1.5px solid rgba(245,158,11,0.18)',
                    color: 'hsl(var(--foreground))', maxHeight: 88, caretColor: '#F59E0B', fontSize: 16,
                  }} />
                <button onClick={() => answer(freeText)} disabled={!freeText.trim()}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-35"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 0 16px rgba(245,158,11,0.45)' }}>
                  <Send className="w-4 h-4 text-black" />
                </button>
              </div>
            </div>
          )}

          {/* ── Loading next question / diagnosis ── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', border: '3px solid rgba(245,158,11,0.3)' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#F59E0B' }} />
                </div>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-md)' }}>
                {answers.length >= 3 ? 'Working out the likely cause…' : 'Thinking of the next question…'}
              </p>
            </div>
          )}

          {/* ── Diagnosis result ── */}
          {diagnosis && (
            <div style={{ animation: 'gd-in 0.3s ease both' }}>
              <div className="rounded-2xl overflow-hidden"
                style={{
                  border: `1.5px solid ${SEVERITY_COLOR[diagnosis.severity]}50`,
                  background: 'var(--surface-1)',
                  boxShadow: `0 0 24px ${SEVERITY_COLOR[diagnosis.severity]}15`,
                }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: SEVERITY_BG[diagnosis.severity] }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: SEVERITY_COLOR[diagnosis.severity] }} />
                  <span className="text-sm font-black tracking-tight" style={{ color: SEVERITY_COLOR[diagnosis.severity] }}>
                    {diagnosis.severity.toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-md)' }}>
                    · {diagnosis.fault_category.replace(/_/g, ' ')}
                  </span>
                  <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--surface-4)', color: 'var(--text-lo)' }}>
                    {Math.round(diagnosis.confidence * 100)}% confident
                  </span>
                </div>

                <div className="px-4 py-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'rgba(245,158,11,0.6)' }}>
                      What we think is wrong
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-md)' }}>{diagnosis.fault_description}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'rgba(245,158,11,0.6)' }}>
                      What to do now
                    </p>
                    <ul className="space-y-1.5">
                      {diagnosis.recommended_actions.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-md)' }}>
                          <span className="mt-0.5 flex-shrink-0 font-bold" style={{ color: '#F59E0B' }}>→</span>
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>
                      Recommended: {PROVIDER_LABEL[diagnosis.provider_type] ?? diagnosis.provider_type}
                    </span>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <button onClick={findHelp}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-black transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 4px 20px rgba(245,158,11,0.4)' }}>
                <Wrench className="w-4 h-4" /> Find Nearby Help
                <ChevronRight className="w-4 h-4" />
              </button>

              <button onClick={restart}
                className="w-full mt-2.5 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold transition-all active:scale-[0.98]"
                style={{ background: 'transparent', border: '1.5px solid var(--border-3)', color: 'var(--text-md)' }}>
                <RotateCcw className="w-3.5 h-3.5" /> Start over
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes gd-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
