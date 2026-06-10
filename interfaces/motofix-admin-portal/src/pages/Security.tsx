import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ArrowLeft, Shield, Key, Smartphone, Monitor, LogIn,
  CheckCircle, AlertTriangle, X, Eye, EyeOff,
  Lock, Unlock, MapPin, Clock, Trash2,
} from 'lucide-react';

const C = {
  surface:  'var(--adm-surface)',
  surface2: 'var(--adm-surface-2)',
  border:   'var(--adm-border)',
  amber:    'var(--adm-amber)',
  amberDim: 'var(--adm-amber-dim)',
  text:     'var(--adm-text)',
  muted:    'var(--adm-muted)',
  green:    'var(--adm-green)',
  red:      'var(--adm-red)',
} as const;

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  time: string;
  current: boolean;
}

const SESSIONS: Session[] = [
  { id: '1', device: 'Windows PC',    browser: 'Chrome 124',  location: 'Kampala, Uganda', ip: '41.210.10.5',  time: 'Active now',    current: true  },
  { id: '2', device: 'Android Phone', browser: 'Chrome Mobile', location: 'Kampala, Uganda', ip: '41.210.12.8', time: '2 hr ago',      current: false },
  { id: '3', device: 'MacBook Pro',   browser: 'Safari 17',   location: 'Entebbe, Uganda', ip: '41.210.11.3',  time: 'Yesterday',     current: false },
];

const LOGIN_HISTORY = [
  { status: 'success', location: 'Kampala, Uganda', ip: '41.210.10.5',  browser: 'Chrome 124',    time: 'Today, 20:25'        },
  { status: 'success', location: 'Kampala, Uganda', ip: '41.210.10.5',  browser: 'Chrome 124',    time: 'Today, 08:10'        },
  { status: 'failed',  location: 'Unknown',         ip: '197.239.5.12', browser: 'Firefox 125',   time: 'Yesterday, 23:11'    },
  { status: 'success', location: 'Entebbe, Uganda', ip: '41.210.11.3',  browser: 'Safari 17',     time: '17 May 2026, 14:30'  },
  { status: 'success', location: 'Kampala, Uganda', ip: '41.210.10.5',  browser: 'Chrome 124',    time: '16 May 2026, 09:05'  },
];

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 16, overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, action }: {
  icon: React.ElementType; title: string; subtitle: string; action?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 22px',
      borderBottom: `1px solid ${C.border}`,
      background: C.surface2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: C.amberDim,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={15} color={C.amber} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      {action}
    </div>
  );
}

export default function Security() {
  const navigate = useNavigate();

  const [sessions, setSessions]     = useState<Session[]>(SESSIONS);
  const [twoFA, setTwoFA]           = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [pwError, setPwError]       = useState('');
  const [pwSuccess, setPwSuccess]   = useState(false);

  const revokeSession = (id: string) =>
    setSessions(s => s.filter(s => s.id !== id));

  const handleSavePw = () => {
    setPwSuccess(false);
    if (!currentPw)          { setPwError('Enter your current password.'); return; }
    if (newPw.length < 8)    { setPwError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwError('');
    setPwSuccess(true);
    setShowPwForm(false);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
  };

  // Security score
  const score = 60 + (twoFA ? 30 : 0) + (pwSuccess ? 10 : 0);
  const scoreColor = score >= 90 ? C.green : score >= 60 ? C.amber : C.red;

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: C.muted,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.amber}
            onMouseLeave={e => e.currentTarget.style.color = C.muted}
          >
            <ArrowLeft size={15} /> Back
          </button>
          <div style={{ width: 1, height: 18, background: C.border }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Security</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>Manage your account security settings</div>
          </div>
        </div>

        {/* Security score banner */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: '22px 26px',
          display: 'flex', alignItems: 'center', gap: 24,
        }}>
          {/* Score ring */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={40} cy={40} r={34} fill="none" stroke="var(--adm-track-bg)" strokeWidth={7} />
              <circle
                cx={40} cy={40} r={34}
                fill="none" stroke={scoreColor} strokeWidth={7}
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - score / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</span>
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>/ 100</span>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              Security Score: <span style={{ color: scoreColor }}>{score >= 90 ? 'Strong' : score >= 60 ? 'Moderate' : 'Weak'}</span>
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
              {score < 90
                ? 'Enable two-factor authentication and update your password to strengthen your account.'
                : 'Your account is well protected. Keep your credentials safe.'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            {[
              { label: 'Strong password',        done: pwSuccess || true },
              { label: 'Two-factor auth',         done: twoFA            },
              { label: 'Recent password change',  done: pwSuccess        },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {item.done
                  ? <CheckCircle size={13} color={C.green} />
                  : <AlertTriangle size={13} color={C.amber} />}
                <span style={{ fontSize: 12, color: item.done ? C.text : C.muted }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start' }}>

          {/* Password */}
          <SectionCard>
            <SectionHeader
              icon={Key}
              title="Password"
              subtitle={pwSuccess ? 'Updated successfully' : 'Last changed: Never'}
              action={
                !showPwForm ? (
                  <button onClick={() => setShowPwForm(true)} style={{
                    fontSize: 12, fontWeight: 600, color: C.amber,
                    background: C.amberDim, border: `1px solid rgba(255,179,0,0.25)`,
                    borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  }}>Change</button>
                ) : (
                  <button onClick={() => { setShowPwForm(false); setPwError(''); }} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 600, color: '#ff3333',
                    background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.22)',
                    borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  }}>
                    <X size={12} /> Cancel
                  </button>
                )
              }
            />
            <div style={{ padding: '20px 22px' }}>
              {!showPwForm ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '14px 16px',
                }}>
                  <Lock size={16} color={C.muted} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>••••••••••••</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Click Change to update your password</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {pwError && (
                    <div style={{
                      fontSize: 12, color: C.red,
                      background: 'rgba(248,113,113,0.08)',
                      border: '1px solid rgba(248,113,113,0.2)',
                      borderRadius: 8, padding: '8px 12px',
                    }}>{pwError}</div>
                  )}
                  {[
                    { label: 'Current Password', val: currentPw, set: setCurrentPw },
                    { label: 'New Password',     val: newPw,     set: setNewPw     },
                    { label: 'Confirm Password', val: confirmPw, set: setConfirmPw },
                  ].map(f => (
                    <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</span>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'var(--adm-search-bg)', border: `1px solid rgba(255,179,0,0.3)`,
                        borderRadius: 9, padding: '10px 12px',
                      }}>
                        <Key size={13} color={C.amber} style={{ flexShrink: 0 }} />
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={f.val}
                          onChange={e => f.set(e.target.value)}
                          style={{
                            background: 'transparent', border: 'none', outline: 'none',
                            color: C.text, fontSize: 13, width: '100%', fontFamily: 'inherit',
                          }}
                        />
                        <button onClick={() => setShowPw(s => !s)} style={{
                          background: 'none', border: 'none', color: C.muted,
                          cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0,
                        }}>
                          {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={handleSavePw} style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--adm-invert-text)',
                    background: C.amber, border: 'none',
                    borderRadius: 9, padding: '10px', cursor: 'pointer',
                    marginTop: 4,
                  }}>Update Password</button>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Two-Factor Auth */}
          <SectionCard>
            <SectionHeader
              icon={Smartphone}
              title="Two-Factor Authentication"
              subtitle={twoFA ? 'Enabled — your account is protected' : 'Not enabled — recommended'}
            />
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: twoFA ? 'rgba(52,211,153,0.06)' : 'rgba(255,179,0,0.06)',
                border: `1px solid ${twoFA ? 'rgba(52,211,153,0.2)' : 'rgba(255,179,0,0.2)'}`,
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {twoFA
                    ? <CheckCircle size={18} color={C.green} />
                    : <AlertTriangle size={18} color={C.amber} />}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {twoFA ? '2FA is active' : '2FA is not enabled'}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>
                      {twoFA ? 'Authenticator app linked' : 'Add an extra layer of security'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setTwoFA(v => !v)}
                  style={{
                    fontSize: 12, fontWeight: 700,
                    color: twoFA ? '#ff3333' : 'var(--adm-invert-text)',
                    background: twoFA ? 'rgba(255,51,51,0.1)' : C.amber,
                    border: twoFA ? '1px solid rgba(255,51,51,0.3)' : 'none',
                    borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
                  }}
                >
                  {twoFA ? 'Disable' : 'Enable 2FA'}
                </button>
              </div>

              {twoFA && (
                <div style={{
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {[
                    { icon: Smartphone, label: 'Method',    value: 'Authenticator App' },
                    { icon: Clock,      label: 'Enabled',   value: 'Today'             },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <r.icon size={13} color={C.muted} />
                      <span style={{ fontSize: 12, color: C.muted, minWidth: 64 }}>{r.label}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Active Sessions */}
        <SectionCard>
          <SectionHeader
            icon={Monitor}
            title="Active Sessions"
            subtitle={`${sessions.length} session${sessions.length !== 1 ? 's' : ''} currently active`}
            action={
              sessions.filter(s => !s.current).length > 0 && (
                <button
                  onClick={() => setSessions(s => s.filter(s => s.current))}
                  style={{
                    fontSize: 12, fontWeight: 600, color: '#ff3333',
                    background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.22)',
                    borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  }}
                >
                  Revoke all others
                </button>
              )
            }
          />
          <div>
            {sessions.map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 22px',
                borderBottom: i < sessions.length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: s.current ? 'rgba(52,211,153,0.1)' : C.surface2,
                  border: `1px solid ${s.current ? 'rgba(52,211,153,0.2)' : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.device.includes('Phone')
                    ? <Smartphone size={16} color={s.current ? C.green : C.muted} />
                    : <Monitor size={16} color={s.current ? C.green : C.muted} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{s.device}</span>
                    {s.current && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: C.green,
                        background: 'rgba(52,211,153,0.1)',
                        border: '1px solid rgba(52,211,153,0.2)',
                        padding: '1px 8px', borderRadius: 20,
                      }}>Current</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: C.muted }}>{s.browser}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} color={C.muted} />
                      <span style={{ fontSize: 11.5, color: C.muted }}>{s.location}</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: C.muted, fontFamily: 'monospace' }}>{s.ip}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} color={C.muted} />
                      <span style={{ fontSize: 11.5, color: C.muted }}>{s.time}</span>
                    </div>
                  </div>
                </div>
                {!s.current && (
                  <button
                    onClick={() => revokeSession(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 11.5, fontWeight: 600, color: '#ff3333',
                      background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.2)',
                      borderRadius: 8, padding: '6px 12px', cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    <Trash2 size={12} /> Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Login History */}
        <SectionCard>
          <SectionHeader icon={LogIn} title="Login History" subtitle="Recent sign-in attempts" />
          <div>
            {LOGIN_HISTORY.map((l, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 22px',
                borderBottom: i < LOGIN_HISTORY.length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: l.status === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {l.status === 'success'
                    ? <Unlock size={14} color={C.green} />
                    : <Lock size={14} color={C.red} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {l.status === 'success' ? 'Successful login' : 'Failed login attempt'}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: l.status === 'success' ? C.green : C.red,
                      background: l.status === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                      padding: '1px 8px', borderRadius: 20,
                    }}>
                      {l.status === 'success' ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: C.muted }}>{l.browser}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} color={C.muted} />
                      <span style={{ fontSize: 11.5, color: C.muted }}>{l.location}</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: C.muted, fontFamily: 'monospace' }}>{l.ip}</span>
                  </div>
                </div>
                <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>{l.time}</span>
              </div>
            ))}
          </div>
        </SectionCard>

      </div>
    </DashboardLayout>
  );
}
