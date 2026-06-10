import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin, Mic, Camera, Paperclip, Loader2, X, Play, Pause, Eye,
  ArrowLeft, Disc3, Zap, Battery, Fuel, Truck, HelpCircle, Send,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRequests } from '@/contexts/RequestContext';
import { requestsService } from '@/config/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LocationPicker } from '@/components/LocationPicker';
import { isProfileRequired, REQUEST_COUNT_KEY } from './Onboarding';
import OutOfFuelFlow from './OutOfFuelFlow';

interface MediaFileWithPreview extends File {
  preview?: string;
}

const ISSUE_TYPES = [
  { id: 'flat_tire', label: 'Flat Tyre',    icon: Disc3,       color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/35', activeBorder: 'border-orange-400', activeBg: 'bg-orange-500/20' },
  { id: 'engine',    label: 'Engine',        icon: Zap,         color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/35', activeBorder: 'border-yellow-400', activeBg: 'bg-yellow-500/20' },
  { id: 'battery',   label: 'Battery',       icon: Battery,     color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/35',   activeBorder: 'border-blue-400',   activeBg: 'bg-blue-500/20'   },
  { id: 'fuel',      label: 'Out of Fuel',   icon: Fuel,        color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/35',  activeBorder: 'border-green-400',  activeBg: 'bg-green-500/20'  },
  { id: 'towing',    label: 'Towing',        icon: Truck,       color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/35', activeBorder: 'border-purple-400', activeBg: 'bg-purple-500/20' },
  { id: 'other',     label: 'Other',         icon: HelpCircle,  color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/35',  activeBorder: 'border-slate-300',  activeBg: 'bg-slate-500/20'  },
];

export default function CreateRequest() {
  const { user }    = useAuth();
  const { requests } = useRequests();
  const navigate    = useNavigate();
  const routeState  = useLocation().state as {
    issueType?: string;
    prefillLocation?: string;
    prefillLat?: number;
    prefillLng?: number;
  } | null;

  // Prefer "lat,lng" format when prefill coords exist — enables map + provider geocoding
  const [location, setLocation] = useState(() => {
    if (routeState?.prefillLat != null && routeState?.prefillLng != null) {
      return `${routeState.prefillLat},${routeState.prefillLng}`;
    }
    return routeState?.prefillLocation ?? '';
  });
  const [issue, setIssue]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [mediaFiles, setMediaFiles]   = useState<MediaFileWithPreview[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Pre-select issue type if navigated from dashboard / locating screen
  const [issueType, setIssueType] = useState<string | null>(routeState?.issueType ?? null);
  const [showFuelFlow, setShowFuelFlow] = useState(routeState?.issueType === 'fuel');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const cameraInputRef   = useRef<HTMLInputElement>(null);
  const audioPlayersRef  = useRef<HTMLAudioElement[]>([]);

  const canSubmit = !!issue.trim() && !!location.trim() && !isLoading;

  // Gate: profile required after 3 requests; only 1 active request allowed at a time
  useEffect(() => {
    if (isProfileRequired()) {
      navigate('/onboarding?required=true', { replace: true });
      return;
    }
    const active = requests.filter(r => !['completed', 'cancelled'].includes(r.status));
    if (active.length > 0) {
      toast.info('You already have an active request.');
      navigate(`/requests/${active[0].id}`, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests]);

  /* ── Recording ─────────────────────────────────────────────────────────── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const f    = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' }) as MediaFileWithPreview;
        f.preview  = URL.createObjectURL(blob);
        setMediaFiles(prev => [...prev, f]);
        toast.success('Voice note recorded');
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.info('Recording… speak clearly');
    } catch { toast.error('Microphone access denied'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); }
  };

  /* ── File handling ──────────────────────────────────────────────────────── */
  const addFiles = (files: FileList | null, isCamera = false) => {
    if (!files) return;
    const arr = Array.from(files).map(f => {
      const fw = f as MediaFileWithPreview;
      if (f.type.startsWith('image/')) fw.preview = URL.createObjectURL(f);
      return fw;
    });
    setMediaFiles(prev => [...prev, ...arr]);
    toast.success(isCamera ? 'Photo added' : `${arr.length} file(s) added`);
  };

  const removeMedia = (idx: number) => {
    const f = mediaFiles[idx];
    if (f.preview) URL.revokeObjectURL(f.preview);
    audioPlayersRef.current[idx]?.pause();
    setMediaFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const playAudio = (idx: number) => {
    const el = audioPlayersRef.current[idx];
    if (!el) return;
    if (el.paused) { el.play(); setPlayingAudio(idx); }
    else           { el.pause(); setPlayingAudio(null); }
  };

  /* ── Submit ─────────────────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue.trim())    { toast.error('Describe your issue'); return; }
    if (!location.trim()) { toast.error('Set your location'); return; }

    setIsLoading(true);
    try {
      const selectedType = issueType
        ? ISSUE_TYPES.find(t => t.id === issueType)?.label ?? 'Other'
        : 'Other';

      let newId: string | undefined;
      if (mediaFiles.length > 0) {
        const fd = new FormData();
        fd.append('customer_name', user?.full_name || 'Driver');
        fd.append('service_type', selectedType);
        fd.append('location', location.trim());
        fd.append('description', issue.trim());
        mediaFiles.forEach(f => fd.append('media_files', f));
        const res = await requestsService.createWithMedia(fd);
        newId = String(res.data?.id ?? '');
      } else {
        const res = await requestsService.create({
          customer_name: user?.full_name || 'Driver',
          service_type: selectedType,
          location: location.trim(),
          description: issue.trim(),
        });
        newId = String(res.data?.id ?? '');
      }

      toast.success('Request sent! A mechanic will respond soon.');
      const prevCount = parseInt(localStorage.getItem(REQUEST_COUNT_KEY) ?? '0', 10);
      localStorage.setItem(REQUEST_COUNT_KEY, String(prevCount + 1));
      navigate(newId ? `/requests/${newId}` : '/requests', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to send request');
    } finally { setIsLoading(false); }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-background pb-28 overflow-x-hidden relative">

      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-blue-500/6 blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-60 h-60 rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      {/* ── Sticky top bar ── */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/6">
        <div className="flex items-center gap-3 px-4 py-3 max-w-md mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-foreground">New Request</h1>
            <p className="text-xs text-muted-foreground">Tell us what's wrong</p>
          </div>
          {user?.full_name && (
            <span className="text-xs text-muted-foreground/70 max-w-[100px] truncate">{user.full_name}</span>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="relative z-10 px-4 pt-5 max-w-md mx-auto space-y-5">

        {/* ── Section 1: Issue type ── */}
        <section>
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">
            What's the problem?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ISSUE_TYPES.map(({ id, label, icon: Icon, color, bg, border, activeBorder, activeBg }) => {
              const active = issueType === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => id === 'fuel' ? setShowFuelFlow(true) : setIssueType(active ? null : id)}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-3 px-2 transition-all duration-200',
                    active
                      ? cn(activeBg, activeBorder, 'shadow-lg')
                      : cn(bg, border, 'hover:brightness-110')
                  )}
                >
                  {active && (
                    <CheckCircle2 className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-white/80" />
                  )}
                  <Icon className={cn('w-5 h-5', color)} />
                  <span className="text-[11px] font-medium text-foreground/80 text-center leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Section 2: Description ── */}
        <section
          style={{
            background: 'var(--surface-1)',
            border: '1.5px solid rgba(59,130,246,0.15)',
            borderRadius: '1rem',
            padding: '1rem',
          }}
        >
          <label className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3 block">
            Describe the issue
          </label>
          <textarea
            placeholder={
              issueType
                ? `Tell us more about the ${ISSUE_TYPES.find(t => t.id === issueType)?.label.toLowerCase()} issue…`
                : 'e.g. tyre is completely flat, engine making knocking noise…'
            }
            value={issue}
            onChange={e => setIssue(e.target.value)}
            rows={3}
            className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-white/25 resize-none focus:outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
        </section>

        {/* ── Section 3: Location ── */}
        <section
          style={{
            background: 'var(--surface-1)',
            border: '1.5px solid rgba(59,130,246,0.15)',
            borderRadius: '1rem',
            padding: '1rem',
          }}
        >
          <label className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            Your Location
          </label>
          <LocationPicker onLocationChange={(lat, lng, addr) => {
            // LocationPicker uses DEFAULT_LAT=0.3476, DEFAULT_LNG=32.5825 for manual text input.
            // When real GPS fires, store as "lat,lng" so the map and service-provider geocoding work.
            const isGps = !(Math.abs(lat - 0.3476) < 0.0001 && Math.abs(lng - 32.5825) < 0.0001);
            setLocation(isGps ? `${lat},${lng}` : addr);
          }} />
        </section>

        {/* ── Section 4: Media (optional) ── */}
        <section
          style={{
            background: 'var(--surface-1)',
            border: '1.5px solid var(--border-2)',
            borderRadius: '1rem',
            padding: '1rem',
          }}
        >
          <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest mb-3">
            Add details <span className="normal-case font-normal text-muted-foreground/40">(optional)</span>
          </p>

          <div className="flex gap-2">
            {/* Voice */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-all',
                isRecording
                  ? 'border-red-500 bg-red-500/10 text-red-400 animate-pulse'
                  : 'border-white/10 bg-white/4 text-muted-foreground hover:border-white/20 hover:text-foreground'
              )}
            >
              <Mic className="w-4 h-4" />
              {isRecording ? 'Stop' : 'Voice'}
            </button>

            {/* Camera */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/4 py-2.5 text-xs font-medium text-muted-foreground hover:border-white/20 hover:text-foreground transition-all"
            >
              <Camera className="w-4 h-4" />
              Photo
            </button>

            {/* Files */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/4 py-2.5 text-xs font-medium text-muted-foreground hover:border-white/20 hover:text-foreground transition-all"
            >
              <Paperclip className="w-4 h-4" />
              Files
            </button>
          </div>

          {/* Hidden inputs */}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
          <input ref={cameraInputRef} type="file" accept="image/*" className="hidden" onChange={e => addFiles(e.target.files, true)} />

          {/* Attached files */}
          {mediaFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground/60">{mediaFiles.length} item{mediaFiles.length !== 1 ? 's' : ''} attached</p>
              {mediaFiles.map((file, idx) => {
                const isImg   = file.type.startsWith('image/');
                const isAudio = file.type.startsWith('audio/');
                return (
                  <div key={idx} className="rounded-xl bg-white/4 border border-white/8 overflow-hidden">
                    {isImg && file.preview && (
                      <div className="relative">
                        <img src={file.preview} alt={file.name} className="w-full h-28 object-cover" />
                        <div className="absolute top-2 right-2 flex gap-1">
                          <button type="button" onClick={() => setPreviewImage(file.preview!)}
                            className="bg-black/50 hover:bg-black/70 rounded-lg p-1.5 transition-all">
                            <Eye className="w-3.5 h-3.5 text-white" />
                          </button>
                          <button type="button" onClick={() => removeMedia(idx)}
                            className="bg-red-500/80 hover:bg-red-600 rounded-lg p-1.5 transition-all">
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      </div>
                    )}
                    {isAudio && (
                      <div className="p-3 flex items-center gap-2">
                        <button type="button" onClick={() => playAudio(idx)}
                          className="bg-blue-600 hover:bg-blue-500 rounded-full p-2 transition-all flex-shrink-0">
                          {playingAudio === idx ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground truncate">Voice note</p>
                          <p className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button type="button" onClick={() => removeMedia(idx)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                        <audio ref={el => { if (el) audioPlayersRef.current[idx] = el; }}
                          src={file.preview} onEnded={() => setPlayingAudio(null)} />
                      </div>
                    )}
                    {!isImg && !isAudio && (
                      <div className="p-3 flex items-center gap-2">
                        <span className="text-lg flex-shrink-0">📎</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground truncate">{file.name}</p>
                          <p className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button type="button" onClick={() => removeMedia(idx)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Contact line ── */}
        {user?.phone && (
          <p className="text-xs text-muted-foreground/50 text-center">
            Mechanic will contact <span className="text-foreground/70 font-medium">{user.phone}</span>
          </p>
        )}

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            'w-full h-13 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200',
            canSubmit
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-white/5 border border-white/10 text-muted-foreground/50 cursor-not-allowed'
          )}
          style={canSubmit ? { boxShadow: '0 0 24px rgba(59,130,246,0.35)' } : undefined}
        >
          {isLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending request…</>
            : <><Send className="w-4 h-4" /> Send Request</>
          }
        </button>

      </form>

      {/* ── Full-screen image preview ── */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-lg w-full">
            <img src={previewImage} alt="Preview" className="w-full h-full object-contain rounded-xl" />
            <button onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showFuelFlow && <OutOfFuelFlow onClose={() => setShowFuelFlow(false)} />}

      <style>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        form > section, form > button[type="submit"] {
          animation: fade-up 0.35s ease both;
        }
        form > section:nth-child(1) { animation-delay: 0.05s; }
        form > section:nth-child(2) { animation-delay: 0.10s; }
        form > section:nth-child(3) { animation-delay: 0.15s; }
        form > section:nth-child(4) { animation-delay: 0.20s; }
        form > button[type="submit"] { animation-delay: 0.25s; }
        .h-13 { height: 3.25rem; }
      `}</style>
    </div>
  );
}
