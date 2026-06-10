import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, MapPin, MessageCircle, Share2,
  Copy, CheckCircle2, X, AlertTriangle, HeartPulse,
} from 'lucide-react';

/* ── Palette ── */
const R  = '#ff2d2d';
const RD = '#cc1515';

/* ── Emergency numbers for Uganda ── */
const EMERGENCY_NUMBERS = [
  { label: 'Ambulance / Police', number: '999',  color: R,         bg: R,         textColor: '#fff' },
  { label: 'International SOS',  number: '112',  color: '#f97316', bg: '#f97316', textColor: '#fff' },
  { label: 'Red Cross Uganda',   number: '0800199699', color: '#ef4444', bg: '#ef4444', textColor: '#ef4444' },
];

/* ── Countdown seconds ── */
const COUNTDOWN = 5;

/* ── Build the SOS share message ── */
function buildMessage(address: string, lat: number, lng: number) {
  const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
  return `🚨 MEDICAL EMERGENCY — URGENT HELP NEEDED

A driver is in critical condition and needs immediate assistance.

📍 Location: ${address}
🗺️ GPS Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}
📌 Google Maps: ${mapsLink}

⚠️ Please call an ambulance or emergency services immediately.

Sent via MOTOFIX Emergency System`;
}

type Phase = 'confirming' | 'locating' | 'active';

export default function EmergencyAlert() {
  const navigate  = useNavigate();
  const [phase,     setPhase]     = useState<Phase>('confirming');
  const [seconds,   setSeconds]   = useState(COUNTDOWN);
  const [lat,       setLat]       = useState<number | null>(null);
  const [lng,       setLng]       = useState<number | null>(null);
  const [address,   setAddress]   = useState('Location being captured…');
  const [copied,    setCopied]    = useState(false);
  const [alertTick, setAlertTick] = useState(0);
  const [hoveredCallNumber, setHoveredCallNumber] = useState<string | null>(null);
  const confirmedRef = useRef(false);

  /* ── Countdown to auto-confirm ── */
  useEffect(() => {
    if (phase !== 'confirming') return;
    if (seconds <= 0) {
      if (!confirmedRef.current) confirm();
      return;
    }
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, seconds]);

  /* ── Pulsing alert tick ── */
  useEffect(() => {
    if (phase !== 'active') return;
    const t = setInterval(() => setAlertTick(n => n + 1), 900);
    return () => clearInterval(t);
  }, [phase]);

  /* ── Confirm: capture GPS then go active ── */
  const confirm = () => {
    confirmedRef.current = true;
    setPhase('locating');
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        reverseGeocode(latitude, longitude);
      },
      () => {
        // Fallback coords (Kampala centre)
        setLat(0.3476);
        setLng(32.5825);
        setAddress('Kampala, Uganda (approximate)');
      },
      { timeout: 6000, enableHighAccuracy: true },
    );
    setTimeout(() => setPhase('active'), 1200);
  };

  /* ── Reverse geocode via browser (no API key needed) ── */
  const reverseGeocode = async (la: number, lo: number) => {
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json`);
      const data = await res.json();
      const road   = data.address?.road ?? data.address?.suburb ?? '';
      const city   = data.address?.city ?? data.address?.town ?? data.address?.county ?? 'Kampala';
      setAddress(`${road}${road ? ', ' : ''}${city}`);
    } catch {
      setAddress(`${la.toFixed(5)}, ${lo.toFixed(5)}`);
    }
  };

  /* ── Copy location ── */
  const handleCopy = () => {
    const text = lat && lng ? buildMessage(address, lat, lng) : address;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  /* ── WhatsApp share ── */
  const handleWhatsApp = () => {
    const msg = buildMessage(address, lat ?? 0.3476, lng ?? 32.5825);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  /* ── SMS share ── */
  const handleSMS = () => {
    const msg = buildMessage(address, lat ?? 0.3476, lng ?? 32.5825);
    window.open(`sms:?&body=${encodeURIComponent(msg)}`);
  };

  /* ── SVG countdown ring ──
     Circle r=40, circumference ≈ 251.3
     Animate dashoffset from 251.3 → 0 over COUNTDOWN seconds
  ── */
  const CIRC = 2 * Math.PI * 40; // ≈ 251.3
  const progress = seconds / COUNTDOWN;            // 1→0 as it counts down
  const dashOffset = CIRC * (1 - progress);        // 0→CIRC (ring fills as time runs out)

  /* ════════════════════════════════════════════════════════════
     PHASE: CONFIRMING
  ════════════════════════════════════════════════════════════ */
  if (phase === 'confirming') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'var(--page-bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 24px',
        overflow: 'hidden',
      }}>
        {/* Ambient red glow */}
        <div style={{ position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, borderRadius: '50%', background: `${R}0e`, filter: 'blur(80px)', pointerEvents: 'none' }} />

        {/* Cancel — top left */}
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute', top: 'max(env(safe-area-inset-top,0px),18px)', left: 18,
            width: 38, height: 38, borderRadius: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-3)', border: '1px solid var(--border-3)',
            cursor: 'pointer',
          }}
        >
          <X style={{ width: 17, height: 17, color: 'var(--text-lo)' }} />
        </button>

        {/* Warning icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 22, marginBottom: 24,
          background: `${R}18`, border: `2px solid ${R}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 40px ${R}25`,
        }}>
          <AlertTriangle style={{ width: 36, height: 36, color: R }} />
        </div>

        {/* Heading */}
        <p style={{
          color: 'var(--text-hi)', fontWeight: 900, fontSize: 26,
          textAlign: 'center', lineHeight: 1.15, marginBottom: 12,
          letterSpacing: '-0.02em',
        }}>
          Medical Emergency?
        </p>
        <p style={{
          color: 'var(--text-lo)', fontSize: 14, textAlign: 'center',
          lineHeight: 1.6, maxWidth: 300, marginBottom: 40,
        }}>
          This will capture your location and prepare an emergency alert to share with services and contacts.
        </p>

        {/* Countdown ring */}
        <div style={{ position: 'relative', width: 130, height: 130, marginBottom: 36 }}>
          {/* Track */}
          <svg width="130" height="130" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="65" cy="65" r="40" fill="none" stroke="var(--border-2)" strokeWidth="6" />
            <circle
              cx="65" cy="65" r="40" fill="none"
              stroke={R} strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          {/* Centre content */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: R, fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{seconds}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 3 }}>seconds</span>
          </div>
        </div>

        {/* Auto-confirm notice */}
        <p style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', marginBottom: 28 }}>
          Alert will activate automatically in {seconds}s
        </p>

        {/* Confirm button */}
        <button
          onClick={confirm}
          style={{
            width: '100%', maxWidth: 340, height: 58, borderRadius: 16,
            background: `linear-gradient(135deg, ${R}, ${RD})`,
            border: 'none', cursor: 'pointer',
            color: 'var(--text-hi)', fontWeight: 900, fontSize: 17,
            letterSpacing: '0.04em',
            boxShadow: `0 0 0 3px ${R}22, 0 8px 32px ${R}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            marginBottom: 14,
          }}
        >
          <HeartPulse style={{ width: 20, height: 20 }} />
          Activate Emergency Alert
        </button>

        {/* Cancel */}
        <button
          onClick={() => navigate(-1)}
          style={{
            width: '100%', maxWidth: 340, height: 48, borderRadius: 14,
            background: 'none', border: '1px solid var(--border-3)',
            cursor: 'pointer', color: 'var(--text-dim)',
            fontWeight: 700, fontSize: 14,
          }}
        >
          Cancel — I am not in danger
        </button>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     PHASE: LOCATING
  ════════════════════════════════════════════════════════════ */
  if (phase === 'locating') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'var(--page-bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <div style={{ position: 'relative', width: 100, height: 100 }}>
          {[100, 72, 44].map((s, i) => (
            <div key={s} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: s, height: s, borderRadius: '50%',
              border: `1.5px solid ${R}${['22','44','88'][i]}`,
              transform: 'translate(-50%,-50%)',
              animation: `em-ring ${1.6 + i * 0.5}s ease-out ${i * 0.3}s infinite`,
            }} />
          ))}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 38, height: 38, borderRadius: 12, background: R, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 24px ${R}66` }}>
            <MapPin style={{ width: 20, height: 20, color: 'var(--text-hi)' }} />
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Capturing your location…</p>
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Preparing emergency alert</p>
        </div>
        <style>{`
          @keyframes em-ring {
            0%   { transform:translate(-50%,-50%) scale(0.7); opacity:0.8; }
            80%  { transform:translate(-50%,-50%) scale(2);   opacity:0;   }
            100% { opacity:0; }
          }
        `}</style>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     PHASE: ACTIVE
  ════════════════════════════════════════════════════════════ */
  const mapsLink  = `https://www.google.com/maps?q=${lat},${lng}`;
  const alertMsg  = buildMessage(address, lat ?? 0.3476, lng ?? 32.5825);
  const alertSize = alertTick % 2 === 0;           // drives pulsing ring size

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'var(--page-bg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Ambient glow ── */}
      <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 360, height: 360, borderRadius: '50%', background: `${R}0a`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>

        {/* ── Top status banner ── */}
        <div style={{
          paddingTop: 'max(env(safe-area-inset-top,0px),20px)',
          padding: 'max(env(safe-area-inset-top,0px),20px) 18px 0',
          position: 'relative', zIndex: 2,
        }}>
          {/* Pulsing ring + icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, paddingTop: 16 }}>
            <div style={{ position: 'relative', width: 90, height: 90 }}>
              {/* Pulsing outer ring */}
              <div style={{
                position: 'absolute', inset: alertSize ? -12 : -6,
                borderRadius: '50%', background: `${R}${alertSize ? '10' : '18'}`,
                transition: 'inset 0.7s ease, background 0.7s ease',
              }} />
              <div style={{
                position: 'absolute', inset: alertSize ? -4 : 0,
                borderRadius: '50%', border: `1.5px solid ${R}${alertSize ? '40' : '70'}`,
                transition: 'inset 0.7s ease, border-color 0.7s ease',
              }} />
              {/* Core */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: `linear-gradient(135deg, ${R}, ${RD})`,
                boxShadow: `0 0 32px ${R}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <HeartPulse style={{ width: 36, height: 36, color: 'var(--text-hi)' }} />
              </div>
            </div>
          </div>

          {/* Status text */}
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 20, marginBottom: 12, background: `${R}18`, border: `1px solid ${R}40` }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: R, animation: 'em-blink 1s ease-in-out infinite' }} />
              <span style={{ color: R, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Emergency Alert Active</span>
            </div>
            <p style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em', marginBottom: 6 }}>
              Help has been requested
            </p>
            <p style={{ color: 'var(--text-lo)', fontSize: 13, lineHeight: 1.55, maxWidth: 280, margin: '0 auto' }}>
              Use the options below to contact emergency services or share your location with someone who can help.
            </p>
          </div>

          {/* Location chip */}
          <a
            href={mapsLink}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              margin: '14px 0',
              padding: '12px 14px', borderRadius: 14,
              background: 'var(--surface-2)', border: '1px solid var(--border-3)',
              textDecoration: 'none',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin style={{ width: 17, height: 17, color: '#60A5FA' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'var(--text-lo)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 2 }}>Your Location</p>
              <p style={{ color: 'var(--text-hi)', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</p>
              {lat && lng && (
                <p style={{ color: 'var(--text-dim)', fontSize: 10.5, marginTop: 1 }}>{lat.toFixed(5)}, {lng.toFixed(5)} · tap to open map</p>
              )}
            </div>
          </a>
        </div>

        {/* ── Call buttons ── */}
        <div style={{ padding: '0 18px' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 10 }}>
            Call Emergency Services
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {EMERGENCY_NUMBERS.map(({ label, number, color, bg }) => {
              const isActive = (hoveredCallNumber ?? '999') === number;

              return (
                <a
                  key={number}
                  href={`tel:${number}`}
                  onPointerEnter={() => setHoveredCallNumber(number)}
                  onPointerLeave={() => setHoveredCallNumber(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '15px 18px', borderRadius: 16,
                    background: isActive ? `linear-gradient(135deg, ${R}, ${RD})` : `${bg}15`,
                    border: isActive ? 'none' : `1.5px solid ${color}35`,
                    textDecoration: 'none',
                    boxShadow: isActive ? `0 0 0 3px ${R}18, 0 8px 28px ${R}35` : 'none',
                    transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
                    transform: isActive ? 'translateY(-1px)' : 'none',
                  }}
                >
                  <div style={{
                    width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                    background: isActive ? 'rgba(0,0,0,0.2)' : `${color}18`,
                    border: isActive ? '1.5px solid rgba(255,255,255,0.2)' : `1.5px solid ${color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Phone style={{ width: 22, height: 22, color: isActive ? '#fff' : color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: isActive ? '#fff' : 'var(--text-hi)', fontWeight: 900, fontSize: isActive ? 20 : 15 }}>
                      Call {number}
                    </p>
                    <p style={{ color: isActive ? 'rgba(255,255,255,0.78)' : 'var(--text-dim)', fontSize: 11, marginTop: 1 }}>{label}</p>
                  </div>
                  {isActive && (
                    <div style={{
                      padding: '5px 11px',
                      borderRadius: 9,
                      background: 'rgba(0,0,0,0.38)',
                      border: '1px solid rgba(255,255,255,0.28)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                    }}>
                      <span style={{
                        color: '#ffffff',
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: '0.04em',
                        textShadow: '0 1px 3px rgba(0,0,0,0.55)',
                      }}>CALL NOW</span>
                    </div>
                  )}
                </a>
              );
            })}
          </div>

          {/* ── Share location ── */}
          <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 10 }}>
            Share Your Location
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {/* WhatsApp */}
            <button
              onClick={handleWhatsApp}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '16px 12px', borderRadius: 16, cursor: 'pointer',
                background: 'rgba(37,211,102,0.08)', border: '1.5px solid rgba(37,211,102,0.25)',
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(37,211,102,0.12)', border: '1.5px solid rgba(37,211,102,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle style={{ width: 20, height: 20, color: '#25D366' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#25D366', fontWeight: 800, fontSize: 13 }}>WhatsApp</p>
                <p style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 1 }}>Share SOS message</p>
              </div>
            </button>
            {/* SMS */}
            <button
              onClick={handleSMS}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '16px 12px', borderRadius: 16, cursor: 'pointer',
                background: 'rgba(96,165,250,0.08)', border: '1.5px solid rgba(96,165,250,0.25)',
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(96,165,250,0.12)', border: '1.5px solid rgba(96,165,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Share2 style={{ width: 20, height: 20, color: '#60A5FA' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#60A5FA', fontWeight: 800, fontSize: 13 }}>SMS</p>
                <p style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 1 }}>Text your location</p>
              </div>
            </button>
          </div>

          {/* Copy full message */}
          <button
            onClick={handleCopy}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px', borderRadius: 14, cursor: 'pointer',
              marginBottom: 24,
              background: copied ? 'rgba(74,222,128,0.08)' : 'var(--surface-2)',
              border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'var(--border-3)'}`,
              transition: 'background 0.3s, border-color 0.3s',
            }}
          >
            {copied
              ? <CheckCircle2 style={{ width: 18, height: 18, color: '#4ade80', flexShrink: 0 }} />
              : <Copy style={{ width: 18, height: 18, color: 'var(--text-lo)', flexShrink: 0 }} />
            }
            <div style={{ flex: 1, textAlign: 'left' }}>
              <p style={{ color: copied ? '#4ade80' : 'var(--text-md)', fontWeight: 700, fontSize: 13 }}>
                {copied ? 'Copied to clipboard!' : 'Copy emergency message'}
              </p>
              <p style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 1 }}>
                Includes location, GPS coords & Google Maps link
              </p>
            </div>
          </button>

          {/* ── Message preview ── */}
          <div style={{
            marginBottom: 24, padding: '14px 16px', borderRadius: 14,
            background: 'var(--surface-1)', border: '1px solid var(--border-2)',
          }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Message Preview</p>
            <pre style={{ color: 'var(--text-lo)', fontSize: 11, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit' }}>
              {alertMsg}
            </pre>
          </div>
        </div>
      </div>

      {/* ── Sticky footer — I'm Safe button ── */}
      <div style={{
        flexShrink: 0, padding: '14px 18px',
        paddingBottom: 'max(env(safe-area-inset-bottom,0px),20px)',
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(20px)',
        borderTop: '1.5px solid rgba(74,222,128,0.22)',
      }}>
        <button
          onClick={() => navigate('/requests', { replace: true })}
          style={{
            width: '100%', height: 52, borderRadius: 14, cursor: 'pointer',
            background: 'rgba(74,222,128,0.12)',
            border: '2px solid rgba(34,197,94,0.72)',
            boxShadow: '0 0 0 3px rgba(34,197,94,0.16), inset 0 0 0 1px rgba(255,255,255,0.18), 0 10px 24px rgba(22,163,74,0.16)',
            color: '#4ade80', fontWeight: 800, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <CheckCircle2 style={{ width: 18, height: 18 }} />
          I'm Safe — Close Emergency Alert
        </button>
      </div>

      <style>{`
        @keyframes em-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes em-ring {
          0%   { transform:translate(-50%,-50%) scale(0.7); opacity:0.8; }
          80%  { transform:translate(-50%,-50%) scale(2.2); opacity:0;   }
          100% { opacity:0; }
        }
      `}</style>
    </div>
  );
}
