import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Send, Mic, MicOff, Paperclip, Camera,
  Zap, Battery, Disc3, Fuel, Truck, HelpCircle,
  Loader2, ChevronRight, AlertTriangle, X, Play, Pause,
  Wrench, Shield, History, Plus, Trash2, MessageSquare,
} from 'lucide-react';
import { diagnosisService, ChatMessage, DiagnosisResult } from '@/config/api';

/* LocalMessage extends ChatMessage with an optional image blob URL for display.
   imageUrl is never sent to the API or stored in localStorage. */
interface LocalMessage extends ChatMessage {
  imageUrl?: string;
}
import { toast } from 'sonner';

/* ── Storage keys ─────────────────────────────────────────────────────────── */
const CHAT_CURRENT_KEY = 'motofix_chat_current';
const CHAT_HISTORY_KEY = 'motofix_chat_history';

/* ── Session model ────────────────────────────────────────────────────────── */
interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  diagnosis: DiagnosisResult | null;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── Evolving title logic ──────────────────────────────────────────────────
   Phase 1 — first user message (raw, truncated)
   Phase 2 — keyword extraction: fault label + vehicle type detected in msgs
   Phase 3 — diagnosis confirmed: structured "Fault Category · Severity"
   ──────────────────────────────────────────────────────────────────────── */
const _FAULT_TERMS: [string, string][] = [
  ["won't start", "Won't Start"], ["not starting", "Won't Start"],
  ["smoke",    "Smoke / Fire"],  ["fire",       "Fire Emergency"],
  ["accident", "Accident"],      ["bleeding",   "Medical Emergency"],
  ["puncture", "Puncture"],      ["flat tyre",  "Flat Tyre"],
  ["flat tire","Flat Tyre"],     ["tyre",       "Tyre Problem"],
  ["tire",     "Tyre Problem"],  ["battery",    "Battery Issue"],
  ["overheating","Overheating"], ["overheat",   "Overheating"],
  ["brake",    "Brake Issue"],   ["engine",     "Engine Issue"],
  ["fuel",     "Fuel Problem"],  ["oil",        "Oil Issue"],
  ["electrical","Electrical Fault"], ["transmission","Transmission"],
  ["suspension","Suspension"],   ["exhaust",    "Exhaust Problem"],
  ["radiator", "Radiator Issue"],["clutch",     "Clutch Problem"],
  ["gearbox",  "Gearbox Issue"], ["starter",    "Starter Problem"],
  ["coolant",  "Coolant Issue"], ["noise",      "Strange Noise"],
  ["knocking", "Knocking Noise"],["stalling",   "Stalling Issue"],
  ["stall",    "Stalling Issue"],["leaking",    "Fluid Leak"],
];

const _VEHICLE_TERMS: [string, string][] = [
  ["boda-boda","Boda-boda"], ["boda","Boda-boda"], ["motorcycle","Motorcycle"],
  ["matatu",   "Matatu"],    ["minibus","Minibus"], ["lorry","Lorry"],
  ["truck",    "Truck"],     ["saloon","Car"],      ["van","Van"],
  ["car",      "Car"],
];

function sessionTitle(messages: ChatMessage[], diag?: DiagnosisResult | null): string {
  // Phase 3 — diagnosis confirmed
  if (diag) {
    const cat = diag.fault_category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const sev = diag.severity.charAt(0).toUpperCase() + diag.severity.slice(1);
    return `${cat} · ${sev}`;
  }

  const userMsgs = messages.filter(m => m.role === 'user');
  if (userMsgs.length === 0) return 'New conversation';

  const combined = userMsgs.map(m => m.content.toLowerCase()).join(' ');

  // Phase 2 — keyword extraction once there are 2+ user messages or a fault keyword is found
  let faultLabel = '';
  for (const [term, label] of _FAULT_TERMS) {
    if (combined.includes(term)) { faultLabel = label; break; }
  }

  let vehicleLabel = '';
  for (const [term, label] of _VEHICLE_TERMS) {
    if (combined.includes(term)) { vehicleLabel = label; break; }
  }

  if (faultLabel && vehicleLabel) return `${faultLabel} — ${vehicleLabel}`;
  if (faultLabel) return faultLabel;

  // Phase 1 — raw first message, truncated
  const raw = userMsgs[0].content;
  return raw.length > 42 ? raw.slice(0, 42) + '…' : raw;
}

function loadHistory(): ChatSession[] {
  try { return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveHistory(sessions: ChatSession[]) {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(sessions.slice(0, 50)));
}

/* ── Quick issue chips ──────────────────────────────────────────────────────── */
const CHIPS = [
  { label: 'Flat Tyre',   icon: Disc3,       hint: "My tyre is flat",                    color: '#F59E0B' },
  { label: 'Engine',      icon: Zap,         hint: "Engine problem, car won't start",    color: '#EF4444' },
  { label: 'Battery',     icon: Battery,     hint: "Battery dead, car won't start",      color: '#60A5FA' },
  { label: 'Out of Fuel', icon: Fuel,        hint: "I've run out of fuel",               color: '#34D399' },
  { label: 'Need Towing', icon: Truck,       hint: "My car needs to be towed",           color: '#A78BFA' },
  { label: 'Other issue', icon: HelpCircle,  hint: "I have another vehicle problem",     color: '#F59E0B' },
];

const SEVERITY_COLOR: Record<string, string> = {
  low: '#34D399', medium: '#F59E0B', high: '#F87171', critical: '#EF4444',
};
const SEVERITY_BG: Record<string, string> = {
  low: 'rgba(52,211,153,0.1)', medium: 'rgba(245,158,11,0.1)', high: 'rgba(248,113,113,0.1)', critical: 'rgba(239,68,68,0.1)',
};
const PROVIDER_LABEL: Record<string, string> = {
  mechanic: 'Mechanic', towing_provider: 'Towing Service',
  spare_parts_dealer: 'Spare Parts', ambulance: '🚨 Ambulance — Emergency',
};

interface RouteState { issueType?: string; prefillLocation?: string; prefillLat?: number; prefillLng?: number; }

export default function FaultChat() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const routeState = location.state as RouteState | null;

  const isOtherIssue = routeState?.issueType === 'other';

  const defaultGreeting: LocalMessage = {
    role: 'assistant',
    content: isOtherIssue
      ? "I'm MOTOFIX AI. You've flagged an unspecified vehicle issue — let's figure it out together.\n\nDescribe what you're experiencing — any unusual sounds, smells, warning lights, loss of power, or strange behaviour — and I'll help classify it and find the right help."
      : "Hi, I'm MOTOFIX AI. Tell me what's wrong with your vehicle — type it, use voice, or tap a quick option below. I'll help classify the issue and find the right help for you.",
  };

  /* ── Session ID ─────────────────────────────────────────────────────────── */
  const sessionIdRef = useRef<string>(makeId());

  /* ── Core state ─────────────────────────────────────────────────────────── */
  const [messages,     setMessages]     = useState<LocalMessage[]>([defaultGreeting]);
  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [diagnosis,    setDiagnosis]    = useState<DiagnosisResult | null>(null);
  const [recording,    setRecording]    = useState(false);
  const [audioBlob,    setAudioBlob]    = useState<Blob | null>(null);
  const [audioUrl,     setAudioUrl]     = useState('');
  const [playing,      setPlaying]      = useState(false);
  const [attachments,  setAttachments]  = useState<File[]>([]);

  /* ── History drawer state ───────────────────────────────────────────────── */
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<ChatSession[]>([]);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const cameraRef   = useRef<HTMLInputElement>(null);
  const audioRef    = useRef<HTMLAudioElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);

  /* ── Restore current session on mount ──────────────────────────────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_CURRENT_KEY);
      if (raw) {
        const saved: ChatSession = JSON.parse(raw);
        if (saved.messages && saved.messages.length > 1) {
          sessionIdRef.current = saved.id;
          setMessages(saved.messages);
          setDiagnosis(saved.diagnosis ?? null);
        }
      }
    } catch { /* ignore corrupt storage */ }
  }, []);

  /* ── Auto-save current session whenever messages or diagnosis change ────── */
  useEffect(() => {
    const hasUserMessages = messages.some(m => m.role === 'user');
    if (!hasUserMessages) return;
    // Strip imageUrl (blob URLs don't survive a reload)
    const storable = messages.map(({ role, content }) => ({ role, content }));
    const session: ChatSession = {
      id: sessionIdRef.current,
      title: sessionTitle(messages, diagnosis),
      createdAt: sessionIdRef.current,
      updatedAt: new Date().toISOString(),
      messages: storable,
      diagnosis,
    };
    localStorage.setItem(CHAT_CURRENT_KEY, JSON.stringify(session));
  }, [messages, diagnosis]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, diagnosis]);

  /* ── New Chat ────────────────────────────────────────────────────────────── */
  function newChat() {
    const hasUserMessages = messages.some(m => m.role === 'user');
    if (hasUserMessages) {
      const storable = messages.map(({ role, content }) => ({ role, content }));
      const session: ChatSession = {
        id: sessionIdRef.current,
        title: sessionTitle(messages, diagnosis),
        createdAt: sessionIdRef.current,
        updatedAt: new Date().toISOString(),
        messages: storable,
        diagnosis,
      };
      const history = loadHistory();
      const filtered = history.filter(s => s.id !== session.id);
      saveHistory([session, ...filtered]);
    }
    localStorage.removeItem(CHAT_CURRENT_KEY);
    sessionIdRef.current = makeId();
    setMessages([defaultGreeting]);
    setDiagnosis(null);
    setInput('');
    setAudioBlob(null);
    setAudioUrl('');
    setAttachments([]);
  }

  /* ── Open history drawer ─────────────────────────────────────────────────── */
  function openHistory() {
    setHistoryList(loadHistory());
    setShowHistory(true);
  }

  /* ── Load a history session as the active chat ───────────────────────────── */
  function openSession(s: ChatSession) {
    // Save current chat to history first (if it has messages and isn't the same session)
    const hasUserMessages = messages.some(m => m.role === 'user');
    if (hasUserMessages && sessionIdRef.current !== s.id) {
      const current: ChatSession = {
        id: sessionIdRef.current,
        title: sessionTitle(messages, diagnosis),
        createdAt: sessionIdRef.current,
        updatedAt: new Date().toISOString(),
        messages,
        diagnosis,
      };
      const history = loadHistory();
      const filtered = history.filter(h => h.id !== current.id && h.id !== s.id);
      saveHistory([s, current, ...filtered]);
    }

    // Load the selected session as the active chat
    sessionIdRef.current = s.id;
    setMessages(s.messages);
    setDiagnosis(s.diagnosis ?? null);
    localStorage.setItem(CHAT_CURRENT_KEY, JSON.stringify(s));
    setShowHistory(false);
  }

  /* ── Delete a history session ────────────────────────────────────────────── */
  function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = historyList.filter(s => s.id !== id);
    setHistoryList(updated);
    saveHistory(updated);
  }

  /* ── Voice recording ─────────────────────────────────────────────────────── */
  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        toast.success('Voice note ready — tap Send to analyse');
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch { toast.error('Microphone access denied'); }
  }

  function stopRec() { recorderRef.current?.stop(); setRecording(false); }

  function togglePlay() {
    if (!audioRef.current) return;
    if (audioRef.current.paused) { audioRef.current.play(); setPlaying(true); }
    else { audioRef.current.pause(); setPlaying(false); }
  }

  /* ── File attach ─────────────────────────────────────────────────────────── */
  function addFile(files: FileList | null) {
    if (!files) return;
    setAttachments(a => [...a, ...Array.from(files)]);
  }

  /* ── Send message ────────────────────────────────────────────────────────── */
  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text && !audioBlob && attachments.length === 0) return;
    // Block image-only sends — require a description to help the AI
    if (attachments.some(f => f.type.startsWith('image/')) && !text && !audioBlob) {
      toast.error('Please describe the issue in the photo so the AI can analyse it correctly.');
      return;
    }

    const imageFile = attachments.find(f => f.type.startsWith('image/'));
    const userContent = imageFile
      ? (text ? `📷 Photo — ${text}` : '📷 Photo')
      : text || (audioBlob ? '[Voice note recorded]' : `[${attachments.length} file(s) attached]`);

    const newUserMsg: LocalMessage = {
      role: 'user',
      content: userContent,
      imageUrl: imageFile ? URL.createObjectURL(imageFile) : undefined,
    };
    const newMessages: LocalMessage[] = [...messages, newUserMsg];
    setMessages(newMessages);
    setInput('');
    setSending(true);

    try {
      if (imageFile) {
        // Vision-aware chat: model reads the photo, asks questions, then diagnoses
        const priorMessages = messages.slice(1).map(({ role, content }) => ({ role, content }));
        const res = await diagnosisService.chatWithImage(imageFile, priorMessages, text);
        setMessages(m => [...m, { role: 'assistant', content: res.data.reply }]);
        if (res.data.diagnosis_ready && res.data.diagnosis) setDiagnosis(res.data.diagnosis);
        setAttachments([]);
        setSending(false);
        return;
      }

      const chatHistory = newMessages.slice(1).map(({ role, content }) => ({ role, content }));
      const res = await diagnosisService.chat(chatHistory);
      setMessages(m => [...m, { role: 'assistant', content: res.data.reply }]);
      if (res.data.diagnosis_ready && res.data.diagnosis) setDiagnosis(res.data.diagnosis);
      setAudioBlob(null); setAudioUrl(''); setAttachments([]);
    } catch (err: any) {
      const status  = err?.response?.status;
      const detail  = err?.response?.data?.detail ?? err?.message ?? 'Unknown error';
      console.error('Chat error', status, detail, err);

      let userMsg = "I couldn't connect right now. Please try again in a moment.";
      if (status === 401) userMsg = "Session expired — please log out and log back in, then try again.";
      else if (status === 503) userMsg = "The AI service is not configured on this server yet.";
      else if (!navigator.onLine) userMsg = "You appear to be offline. Check your internet connection and try again.";

      setMessages(m => [...m, { role: 'assistant', content: userMsg }]);
      toast.error(`Chat error ${status ?? ''}: ${detail}`.trim());
    } finally { setSending(false); }
  }

  function sendChip(chip: typeof CHIPS[0]) { setInput(''); send(chip.hint); }

  function faultCategoryToIssueType(category: string, providerType: string): string {
    const c = category.toLowerCase();
    if (c.includes('tyre') || c.includes('tire') || c.includes('puncture')) return 'flat_tire';
    if (c.includes('battery'))                                               return 'battery';
    if (c.includes('fuel') || c.includes('gas'))                            return 'fuel';
    if (c.includes('engine') || c.includes('overheat') || c.includes('transmission')) return 'engine';
    if (providerType === 'towing_provider')                                  return 'towing';
    return 'other';
  }

  function findHelp() {
    // Parts-fixable fault → route to the self-fix "parts you'll need" screen.
    if (diagnosis?.provider_type === 'spare_parts_dealer') {
      navigate('/parts-needed', {
        state: {
          diagnosis,
          lat:     routeState?.prefillLat,
          lng:     routeState?.prefillLng,
          address: routeState?.prefillLocation,
        },
      });
      return;
    }
    const issueType = diagnosis
      ? faultCategoryToIssueType(diagnosis.fault_category, diagnosis.provider_type)
      : 'other';
    navigate('/create-request', {
      state: {
        issueType,
        prefillLocation: routeState?.prefillLocation,
        prefillLat:      routeState?.prefillLat,
        prefillLng:      routeState?.prefillLng,
      },
    });
  }

  const showChips = messages.length <= 2 && !diagnosis;

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
            paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)',
            paddingBottom: 12,
            borderBottom: '1px solid rgba(245,158,11,0.12)',
            background: 'var(--overlay-bg)',
            backdropFilter: 'blur(20px)',
          }}>

          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <ArrowLeft className="w-4 h-4" style={{ color: '#F59E0B' }} />
          </button>

          {/* AI badge */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                boxShadow: '0 0 18px rgba(245,158,11,0.45)',
              }}>
              <Wrench className="w-4 h-4 text-black" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 animate-pulse"
              style={{ background: '#34D399', borderColor: 'var(--page-bg)' }} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-black text-sm" style={{ color: '#F59E0B', letterSpacing: '-0.02em' }}>MOTOFIX AI</p>
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Fault diagnosis &amp; assistance</p>
          </div>

          {/* New chat button */}
          <button onClick={newChat}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
            title="New chat"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <Plus className="w-4 h-4" style={{ color: '#34D399' }} />
          </button>

          {/* History button */}
          <button onClick={openHistory}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
            title="Chat history"
            style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <History className="w-4 h-4" style={{ color: '#A78BFA' }} />
          </button>

          {/* Insurance hint */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
            style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <Shield className="w-3 h-3" style={{ color: '#A78BFA' }} />
            <span className="text-[10px] font-semibold" style={{ color: '#A78BFA' }}>Claims</span>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3" style={{ scrollbarWidth: 'none' }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              style={{ animation: 'msg-in 0.2s ease both' }}>

              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 0 10px rgba(245,158,11,0.35)' }}>
                  <Wrench className="w-3.5 h-3.5 text-black" />
                </div>
              )}

              <div className="max-w-[80%] overflow-hidden"
                style={{
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                    : 'var(--surface-3)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border-3)',
                  boxShadow: msg.role === 'user' ? '0 4px 14px rgba(245,158,11,0.25)' : 'none',
                }}>
                {/* Uploaded image shown above the text */}
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="uploaded"
                    style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
                  />
                )}
                {/* Only show text if there's content beyond the bare "📷 Photo" placeholder */}
                {(msg.content && !(msg.imageUrl && msg.content === '📷 Photo')) && (
                  <div className="px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                    style={{
                      color: msg.role === 'user' ? '#000' : 'hsl(var(--foreground))',
                      fontWeight: msg.role === 'user' ? 600 : 400,
                    }}>
                    {msg.imageUrl ? msg.content.replace('📷 Photo — ', '') : msg.content}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex justify-start items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                <Wrench className="w-3.5 h-3.5 text-black" />
              </div>
              <div className="px-4 py-3 rounded-2xl flex items-center gap-1.5"
                style={{ background: 'var(--surface-3)', border: '1px solid rgba(245,158,11,0.12)' }}>
                {[0, 1, 2].map(j => (
                  <div key={j} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#F59E0B', animation: `bounce 1s ease-in-out ${j * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── Quick chips ── */}
          {showChips && (
            <div className="pt-1" style={{ animation: 'msg-in 0.3s ease 0.15s both' }}>
              <p className="text-[10px] mb-2.5 text-center uppercase tracking-widest font-semibold"
                style={{ color: 'rgba(245,158,11,0.5)' }}>Quick options</p>
              <div className="grid grid-cols-3 gap-1.5">
                {CHIPS.map(chip => (
                  <button key={chip.label} onClick={() => sendChip(chip)}
                    className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl transition-all active:scale-95"
                    style={{
                      background: `${chip.color}0D`,
                      border: `1.5px solid ${chip.color}30`,
                    }}>
                    <chip.icon className="w-4 h-4 flex-shrink-0" style={{ color: chip.color }} />
                    <span className="text-[11px] font-semibold text-center leading-tight"
                      style={{ color: 'var(--text-md)' }}>{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Diagnosis result card ── */}
          {diagnosis && (
            <div className="rounded-2xl overflow-hidden mt-2"
              style={{
                border: `1.5px solid ${SEVERITY_COLOR[diagnosis.severity]}50`,
                background: 'var(--surface-1)',
                boxShadow: `0 0 24px ${SEVERITY_COLOR[diagnosis.severity]}15`,
                animation: 'msg-in 0.3s ease both',
              }}>
              {/* Severity header */}
              <div className="px-3.5 py-2.5 flex items-center gap-2"
                style={{ background: SEVERITY_BG[diagnosis.severity] }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0"
                  style={{ color: SEVERITY_COLOR[diagnosis.severity] }} />
                <span className="text-sm font-black tracking-tight"
                  style={{ color: SEVERITY_COLOR[diagnosis.severity] }}>
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

              <div className="px-3.5 py-3 space-y-2.5">
                <p className="text-sm" style={{ color: 'var(--text-md)' }}>
                  {diagnosis.fault_description}
                </p>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1.5"
                    style={{ color: 'rgba(245,158,11,0.6)' }}>Recommended actions</p>
                  <ul className="space-y-1">
                    {diagnosis.recommended_actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs"
                        style={{ color: 'var(--text-md)' }}>
                        <span className="mt-0.5 flex-shrink-0 font-bold" style={{ color: '#F59E0B' }}>→</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>
                    {PROVIDER_LABEL[diagnosis.provider_type]}
                  </span>
                  <button onClick={findHelp}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-black transition-all active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                      boxShadow: '0 0 14px rgba(245,158,11,0.4)',
                    }}>
                    Find Nearby Help <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Voice note preview ── */}
        {audioUrl && (
          <div className="px-3 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <button onClick={togglePlay}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                {playing
                  ? <Pause className="w-3.5 h-3.5 text-black" />
                  : <Play className="w-3.5 h-3.5 text-black" />}
              </button>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--surface-5)' }}>
                <div className="h-full w-1/3 rounded-full animate-pulse" style={{ background: '#F59E0B' }} />
              </div>
              <span className="text-xs font-semibold" style={{ color: 'rgba(245,158,11,0.7)' }}>Voice note</span>
              <button onClick={() => { setAudioBlob(null); setAudioUrl(''); setPlaying(false); }}>
                <X className="w-3.5 h-3.5" style={{ color: 'var(--text-dim)' }} />
              </button>
              <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
            </div>
          </div>
        )}

        {/* ── Attachments preview ── */}
        {attachments.length > 0 && (
          <div className="px-3 pb-2 flex-shrink-0">
            <div className="flex gap-2 overflow-x-auto mb-2" style={{ scrollbarWidth: 'none' }}>
              {attachments.map((f, i) => (
                <div key={i} className="relative flex-shrink-0">
                  {f.type.startsWith('image/')
                    ? <img src={URL.createObjectURL(f)} alt="" className="w-14 h-14 rounded-xl object-cover"
                        style={{ border: '1.5px solid rgba(245,158,11,0.3)' }} />
                    : <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl"
                        style={{ background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.2)' }}>
                        📎
                      </div>
                  }
                  <button onClick={() => setAttachments(a => a.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: '#EF4444' }}>
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
            {/* Shown only when a photo is attached but no text typed yet */}
            {attachments.some(f => f.type.startsWith('image/')) && !input.trim() && (
              <div className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}>
                <span className="text-xs" style={{ color: 'var(--text-lo)' }}>
                  Add a description, or…
                </span>
                <button
                  onClick={() => setInput("I'm not sure what's wrong — please look at my photo and tell me what you see.")}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg transition-all active:scale-95"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                  I don't know — let AI analyse
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Input bar ── */}
        <div className="flex-shrink-0 px-3 pt-2"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
            borderTop: '1px solid rgba(245,158,11,0.1)',
            background: 'var(--overlay-bg)',
            backdropFilter: 'blur(20px)',
          }}>

          {/* Action row */}
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', color: 'rgba(245,158,11,0.75)' }}>
              <Camera className="w-3.5 h-3.5" /> Photo / Camera
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', color: 'rgba(245,158,11,0.75)' }}>
              <Paperclip className="w-3.5 h-3.5" /> File
            </button>
            <button
              onClick={recording ? stopRec : startRec}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold ml-auto transition-all active:scale-95"
              style={{
                background: recording ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.08)',
                border: recording ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(245,158,11,0.18)',
                color: recording ? '#f87171' : 'rgba(245,158,11,0.75)',
                animation: recording ? 'pulse-rec 1.2s ease-in-out infinite' : 'none',
              }}>
              {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {recording ? 'Stop' : 'Voice'}
            </button>
          </div>

          {/* Text + send */}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={attachments.length > 0 ? "Describe what's wrong so the AI can read your photo…" : "Describe your vehicle issue…"}
              rows={1}
              className="flex-1 resize-none rounded-2xl px-3.5 py-2.5 outline-none"
              style={{
                background: 'var(--surface-3)',
                border: '1.5px solid rgba(245,158,11,0.18)',
                color: 'hsl(var(--foreground))',
                maxHeight: 88,
                caretColor: '#F59E0B',
                fontSize: 16,
              }}
            />
            <button
              onClick={() => send()}
              disabled={sending || (!input.trim() && !audioBlob && attachments.length === 0) || (attachments.length > 0 && !input.trim() && !audioBlob)}
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-35"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                boxShadow: '0 0 16px rgba(245,158,11,0.45)',
              }}>
              {sending
                ? <Loader2 className="w-4 h-4 text-black animate-spin" />
                : <Send className="w-4 h-4 text-black" />}
            </button>
          </div>
        </div>

        <input ref={fileRef} type="file" multiple className="hidden" onChange={e => addFile(e.target.files)} />
        <input ref={cameraRef} type="file" accept="image/*" className="hidden" onChange={e => addFile(e.target.files)} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          History Drawer
         ══════════════════════════════════════════════════════════════════════ */}
      {showHistory && (
        <div className="fixed inset-0 z-[60] flex"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowHistory(false)}>

          <div className="ml-auto h-full flex flex-col"
            style={{
              width: 'min(92vw, 420px)',
              background: 'var(--surface-1)',
              borderLeft: '1px solid rgba(245,158,11,0.15)',
              boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
              animation: 'slide-in-right 0.25s ease',
            }}
            onClick={e => e.stopPropagation()}>

            {/* Drawer header */}
            <div className="flex items-center gap-3 px-4 flex-shrink-0"
              style={{
                paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
                paddingBottom: 14,
                borderBottom: '1px solid rgba(245,158,11,0.12)',
                background: 'var(--overlay-bg)',
              }}>

              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)' }}>
                <History className="w-4 h-4" style={{ color: '#A78BFA' }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-black text-sm" style={{ color: '#A78BFA' }}>Chat History</p>
                <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  {historyList.length} conversation{historyList.length !== 1 ? 's' : ''}
                </p>
              </div>

              <button onClick={() => setShowHistory(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border-3)' }}>
                <X className="w-4 h-4" style={{ color: 'var(--text-md)' }} />
              </button>
            </div>

            {/* ── Session list ── */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

              {historyList.length === 0 ? (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)' }}>
                      <MessageSquare className="w-6 h-6" style={{ color: 'rgba(167,139,250,0.5)' }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-dim)' }}>No previous chats</p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      Conversations are saved automatically and will appear here.
                    </p>
                  </div>
                ) : (
                  /* Session list */
                  <div className="p-3 space-y-2">
                    {historyList.map(s => (
                      <button key={s.id}
                        onClick={() => openSession(s)}
                        className="w-full flex items-start gap-3 p-3.5 rounded-2xl text-left transition-all active:scale-[0.98]"
                        style={{
                          background: 'var(--surface-1)',
                          border: '1px solid rgba(245,158,11,0.1)',
                        }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: 'linear-gradient(135deg, #F59E0B22, #D9770622)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <MessageSquare className="w-4 h-4" style={{ color: '#F59E0B' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate"
                            style={{ color: 'var(--text-hi)' }}>{s.title}</p>
                          <p className="text-[11px] mt-0.5"
                            style={{ color: 'var(--text-dim)' }}>
                            {new Date(s.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {' · '}
                            {s.messages.filter(m => m.role === 'user').length} message{s.messages.filter(m => m.role === 'user').length !== 1 ? 's' : ''}
                          </p>
                          {s.diagnosis && (
                            <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: `${SEVERITY_COLOR[s.diagnosis.severity]}15`,
                                color: SEVERITY_COLOR[s.diagnosis.severity],
                                border: `1px solid ${SEVERITY_COLOR[s.diagnosis.severity]}30`,
                              }}>
                              {s.diagnosis.severity.toUpperCase()} · {s.diagnosis.fault_category.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={e => deleteSession(s.id, e)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                          <Trash2 className="w-3.5 h-3.5" style={{ color: '#F87171' }} />
                        </button>
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%,80%,100% { transform: translateY(0); }
          40%          { transform: translateY(-5px); }
        }
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-rec {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.6; }
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
