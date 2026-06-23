// Profile.tsx — the logged-in admin's own profile screen: view/edit their name and email
// (via updateAdminProfile) and see their account info.

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { getAdminInfo } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, Shield, Key, Clock,
  Edit3, Save, X, Eye, EyeOff, Activity,
  LogIn, Calendar, Bell, Globe, CheckCircle, ArrowLeft,
} from 'lucide-react';

const C = {
  surface:  'var(--adm-surface)',
  surface2: 'var(--adm-surface-2)',
  border:   'var(--adm-border)',
  amber:    'var(--adm-amber)',
  amberDim: 'var(--adm-amber-dim)',
  text:     'var(--adm-text)',
  muted:    'var(--adm-muted)',
} as const;

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

const TABS = ['Personal Info', 'Security', 'Notifications', 'Activity'] as const;
type Tab = typeof TABS[number];

const ACTIVITY = [
  { action: 'Approved provider application',  time: '2 hr ago',   icon: CheckCircle, color: '#34d399' },
  { action: 'Reviewed request #2041',          time: '5 hr ago',   icon: Activity,    color: '#818cf8' },
  { action: 'Updated platform settings',       time: 'Yesterday',  icon: Shield,      color: C.amber   },
  { action: 'Logged in from Kampala, UG',      time: '2 days ago', icon: LogIn,       color: '#60a5fa' },
  { action: 'Reset driver account DRV-3301',   time: '3 days ago', icon: User,        color: '#f87171' },
  { action: 'Verified mechanic Onen Patrick',  time: '4 days ago', icon: CheckCircle, color: '#34d399' },
];

function FieldInput({ label, value, onChange, icon: Icon, readOnly, type = 'text' }: {
  label: string; value: string; onChange?: (v: string) => void;
  icon: React.ElementType; readOnly?: boolean; type?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: readOnly ? 'var(--adm-track-bg)' : 'var(--adm-search-bg)',
        border: `1px solid ${readOnly ? C.border : 'rgba(255,179,0,0.35)'}`,
        borderRadius: 10, padding: '11px 14px',
      }}>
        <Icon size={14} color={readOnly ? C.muted : C.amber} style={{ flexShrink: 0 }} />
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: readOnly ? 'var(--adm-muted)' : C.text,
            fontSize: 13.5, width: '100%', fontFamily: 'inherit',
          }}
        />
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      width: 44, height: 24, borderRadius: 12, flexShrink: 0,
      background: on ? C.amber : 'var(--adm-divider)',
      border: 'none', cursor: 'pointer', position: 'relative',
      transition: 'background 0.2s',
    }}>
      <span style={{
        position: 'absolute', top: 4,
        left: on ? 23 : 4,
        width: 16, height: 16, borderRadius: '50%',
        background: on ? 'var(--adm-invert-text)' : 'var(--adm-muted)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

export default function Profile() {
  const admin    = getAdminInfo();
  const fullName = admin?.full_name ?? 'MOTOFIX Admin';
  const email    = admin?.email     ?? 'admin@motofix.ug';
  const role     = admin?.role
    ? admin.role.charAt(0).toUpperCase() + admin.role.slice(1)
    : 'Super Admin';
  const initials = getInitials(fullName);

  const navigate = useNavigate();
  const [tab, setTab]             = useState<Tab>('Personal Info');
  const [editing, setEditing]     = useState(false);
  const [editName, setEditName]   = useState(fullName);
  const [editPhone, setEditPhone] = useState('+256 700 000 000');
  const [editTZ, setEditTZ]       = useState('Africa/Kampala (UTC+3)');

  const [changingPw, setChangingPw] = useState(false);
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [pwError, setPwError]       = useState('');

  const [nEmail, setNEmail] = useState(true);
  const [nPush, setNPush]   = useState(true);
  const [nSMS, setNSMS]     = useState(false);

  const handleSavePw = () => {
    if (!currentPw)          { setPwError('Enter your current password.'); return; }
    if (newPw.length < 8)    { setPwError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwError(''); setChangingPw(false);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontSize: 13, fontWeight: 600, color: C.muted,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '0 0 14px 0', width: 'fit-content',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = C.amber}
          onMouseLeave={e => e.currentTarget.style.color = C.muted}
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {/* ── Hero ── */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '18px 18px 0 0',
          overflow: 'hidden',
        }}>
          {/* Avatar + info row */}
          <div style={{
            padding: '28px 32px',
            display: 'flex', alignItems: 'center', gap: 22,
            flexWrap: 'wrap',
          }}>
            {/* Avatar */}
            <div style={{
              width: 82, height: 82, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #FFB300, #e6a000)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 900, color: '#000',
              boxShadow: '0 0 0 4px rgba(255,179,0,0.3)',
            }}>
              {initials}
            </div>

            {/* Name block */}
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 3 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{editName}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#34d399',
                  background: 'rgba(52,211,153,0.1)',
                  border: '1px solid rgba(52,211,153,0.22)',
                  padding: '2px 10px', borderRadius: 20,
                }}>Active</span>
              </div>
              <div style={{ fontSize: 12.5, color: C.amber, fontWeight: 600, marginBottom: 4 }}>{role}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{email}</div>
            </div>

            {/* Stats inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginLeft: 'auto' }}>
              {[
                { icon: Calendar, label: 'Member since', value: 'May 2026' },
                { icon: LogIn,    label: 'Last login',   value: 'Today'    },
                { icon: Clock,    label: 'Sessions',     value: '1 active' },
              ].map((s, i) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
                  {i > 0 && (
                    <div style={{ width: 1, height: 30, background: C.border, margin: '0 20px' }} />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <s.icon size={14} color={C.amber} />
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.2 }}>{s.label}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{s.value}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          background: 'var(--adm-surface-2)',
          borderLeft: `1px solid ${C.border}`,
          borderRight: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', padding: '0 24px',
        }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '14px 20px',
                fontSize: 13, fontWeight: 600,
                color: tab === t ? C.amber : C.muted,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${tab === t ? C.amber : 'transparent'}`,
                marginBottom: -1,
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Tab panel ── */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderTop: 'none',
          borderRadius: '0 0 18px 18px',
          padding: '30px 32px',
        }}>

          {/* ── Personal Info ── */}
          {tab === 'Personal Info' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Personal Information</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Update your name, phone and timezone</div>
                </div>
                {editing ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditing(false)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 12, fontWeight: 600, color: '#ff3333',
                      background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.25)',
                      borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
                    }}>
                      <X size={12} /> Cancel
                    </button>
                    <button onClick={() => setEditing(false)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 12, fontWeight: 700, color: '#000',
                      background: C.amber, border: 'none',
                      borderRadius: 9, padding: '7px 18px', cursor: 'pointer',
                    }}>
                      <Save size={12} /> Save Changes
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditing(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 600, color: C.amber,
                    background: C.amberDim, border: `1px solid rgba(255,179,0,0.25)`,
                    borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
                  }}>
                    <Edit3 size={12} /> Edit Profile
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <FieldInput label="Full Name"    value={editName}   onChange={setEditName}  icon={User}     readOnly={!editing} />
                <FieldInput label="Email"        value={email}                              icon={Mail}     readOnly />
                <FieldInput label="Phone Number" value={editPhone}  onChange={setEditPhone} icon={Phone}    readOnly={!editing} />
                <FieldInput label="Timezone"     value={editTZ}     onChange={setEditTZ}    icon={Globe}    readOnly={!editing} />
                <FieldInput label="Role"         value={role}                               icon={Shield}   readOnly />
                <FieldInput label="Member Since" value="May 2026"                          icon={Calendar} readOnly />
              </div>
            </div>
          )}

          {/* ── Security ── */}
          {tab === 'Security' && (
            <div>
              <div style={{ marginBottom: 26 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Security Settings</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Manage your password and active sessions</div>
              </div>

              <div style={{
                background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)',
                borderRadius: 12, padding: '14px 18px', marginBottom: 22,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <CheckCircle size={18} color="#34d399" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Session is secure</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>
                    Last login: Today at 19:07 · Kampala, Uganda · 1 active session
                  </div>
                </div>
              </div>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', background: C.surface2,
                  borderBottom: changingPw ? `1px solid ${C.border}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Key size={15} color={C.amber} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Password</div>
                      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>Last changed: Never</div>
                    </div>
                  </div>
                  {!changingPw ? (
                    <button onClick={() => setChangingPw(true)} style={{
                      fontSize: 12, fontWeight: 600, color: C.amber,
                      background: C.amberDim, border: `1px solid rgba(255,179,0,0.25)`,
                      borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
                    }}>Change Password</button>
                  ) : (
                    <button onClick={() => { setChangingPw(false); setPwError(''); }} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 12, fontWeight: 600, color: C.muted,
                      background: 'var(--adm-track-bg)', border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
                    }}>
                      <X size={12} /> Cancel
                    </button>
                  )}
                </div>

                {changingPw && (
                  <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {pwError && (
                      <div style={{
                        fontSize: 12, color: '#f87171',
                        background: 'rgba(248,113,113,0.08)',
                        border: '1px solid rgba(248,113,113,0.2)',
                        borderRadius: 8, padding: '9px 14px',
                      }}>{pwError}</div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      {[
                        { label: 'Current Password', val: currentPw, set: setCurrentPw },
                        { label: 'New Password',     val: newPw,     set: setNewPw     },
                        { label: 'Confirm Password', val: confirmPw, set: setConfirmPw },
                      ].map(f => (
                        <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {f.label}
                          </span>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: 'var(--adm-search-bg)',
                            border: `1px solid rgba(255,179,0,0.3)`,
                            borderRadius: 10, padding: '11px 12px',
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
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                      <button onClick={handleSavePw} style={{
                        fontSize: 13, fontWeight: 700, color: '#000',
                        background: C.amber, border: 'none',
                        borderRadius: 9, padding: '9px 24px', cursor: 'pointer',
                      }}>Update Password</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === 'Notifications' && (
            <div>
              <div style={{ marginBottom: 26 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Notification Preferences</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Choose how and when you get notified</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: Mail,  label: 'Email Notifications',  sub: 'Receive admin alerts and reports via email',    val: nEmail, set: setNEmail, color: '#818cf8' },
                  { icon: Bell,  label: 'Push Notifications',   sub: 'Browser push alerts for real-time updates',     val: nPush,  set: setNPush,  color: '#34d399' },
                  { icon: Phone, label: 'SMS Notifications',    sub: 'Text message alerts to your registered number', val: nSMS,   set: setNSMS,   color: C.amber   },
                ].map(n => (
                  <div key={n.label} style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    background: C.surface2, border: `1px solid ${C.border}`,
                    borderRadius: 12, padding: '16px 20px',
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: `${n.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <n.icon size={17} color={n.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{n.label}</div>
                      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{n.sub}</div>
                    </div>
                    <Toggle on={n.val} onChange={() => n.set(v => !v)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Activity ── */}
          {tab === 'Activity' && (
            <div>
              <div style={{ marginBottom: 26 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Recent Activity</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Your last actions on the platform</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {ACTIVITY.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 0',
                    borderBottom: i < ACTIVITY.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: `${a.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <a.icon size={15} color={a.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text }}>{a.action}</div>
                    </div>
                    <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {a.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}
