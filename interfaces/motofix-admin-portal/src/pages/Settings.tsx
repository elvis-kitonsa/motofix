import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getAdminInfo, setAdminInfo, updateAdminProfile, changeAdminPassword,
  fetchPlatformFees, updatePlatformFees, setMaintenanceMode,
  listAdmins, createAdmin, deleteAdmin,
} from '@/lib/api';
import { toast } from 'sonner';
import {
  User, Lock, Palette, Sliders, Bell, Phone,
  Moon, Sun, Eye, EyeOff, Save, CheckCircle, AlertTriangle, MessageSquare,
  CalendarClock, WrenchIcon, ShieldAlert, UserPlus, Shield,
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

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: C.surface,
      border: '2px solid var(--adm-card-border)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '16px 22px',
      borderBottom: '2px solid var(--adm-card-border)',
      background: C.surface2,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: C.amberDim,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={15} color={C.amber} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: 'var(--adm-search-bg)',
        border: '1.5px solid rgba(0,0,0,0.65)',
        borderRadius: 10, padding: '10px 14px',
        color: C.text, fontSize: 13.5,
        fontFamily: 'inherit', outline: 'none', width: '100%',
        transition: 'border-color 0.15s',
      }}
      onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,179,0,0.8)'}
      onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.65)'}
    />
  );
}

function PasswordInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: 'var(--adm-search-bg)',
      border: '1.5px solid rgba(0,0,0,0.65)',
      borderRadius: 10, overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}
      onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,179,0,0.8)'}
      onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.65)'}
    >
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          color: C.text, fontSize: 13.5, padding: '10px 14px',
          width: '100%', fontFamily: 'inherit',
        }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.muted, padding: '0 14px', flexShrink: 0,
          display: 'flex', alignItems: 'center',
        }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 44, height: 24, borderRadius: 12, flexShrink: 0,
        background: on ? C.amber : 'var(--adm-divider)',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 4,
        left: on ? 23 : 4,
        width: 16, height: 16, borderRadius: '50%',
        background: on ? 'var(--adm-invert-text)' : C.muted,
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

function SaveBtn({ onClick, loading, saved }: { onClick: () => void; loading?: boolean; saved?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        fontSize: 12.5, fontWeight: 700,
        color: saved ? C.green : 'var(--adm-invert-text)',
        background: saved
          ? 'rgba(52,211,153,0.12)'
          : hov ? 'rgba(230,160,0,1)' : C.amber,
        border: saved ? `1px solid rgba(52,211,153,0.3)` : 'none',
        borderRadius: 9, padding: '8px 18px', cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1, transition: 'all 0.15s',
        flexShrink: 0,
        transform: hov && !loading && !saved ? 'translateY(-1px)' : 'none',
        boxShadow: hov && !loading && !saved ? '0 4px 12px rgba(255,179,0,0.35)' : 'none',
      }}
    >
      {saved ? <CheckCircle size={13} /> : <Save size={13} />}
      {loading ? 'Saving…' : saved ? 'Saved!' : 'Save'}
    </button>
  );
}

// ── Persistent platform config stored in localStorage ────────────────────────

const PLATFORM_KEY = 'motofix_platform_config';

function loadPlatformConfig() {
  try {
    const raw = localStorage.getItem(PLATFORM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePlatformConfig(cfg: object) {
  try { localStorage.setItem(PLATFORM_KEY, JSON.stringify(cfg)); } catch {}
}

const NOTIF_KEY = 'motofix_notif_config';
function loadNotifConfig() {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveNotifConfig(cfg: object) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(cfg)); } catch {}
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const admin = getAdminInfo();
  const queryClient = useQueryClient();

  // ── Profile state ──────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState(admin?.full_name ?? '');
  const [email,    setEmail]    = useState(admin?.email ?? '');
  const [profileSaved, setProfileSaved] = useState(false);

  // ── Password state ─────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // ── Platform config ────────────────────────────────────────────────────────
  const pc = loadPlatformConfig();
  const [serviceFee,      setServiceFee]      = useState<string>(pc?.serviceFee      ?? '10');
  const [providerCut,     setProviderCut]      = useState<string>(pc?.providerCut     ?? '80');
  const [autoAssign,      setAutoAssign]       = useState<boolean>(pc?.autoAssign      ?? true);
  const [requireApproval, setRequireApproval]  = useState<boolean>(pc?.requireApproval ?? true);
  const [maintenance,     setMaintenance]      = useState<boolean>(pc?.maintenance     ?? false);
  const [platformSaved,   setPlatformSaved]    = useState(false);
  const [feeConfirmOpen,       setFeeConfirmOpen]       = useState(false);
  const [maintPopupOpen,       setMaintPopupOpen]       = useState(false);
  const [maintStart,           setMaintStart]           = useState('');
  const [maintEnd,             setMaintEnd]             = useState('');
  const [maintMessage,         setMaintMessage]         = useState('');
  const [deactivateConfirm,    setDeactivateConfirm]    = useState(false);

  // ── Admin registration state ───────────────────────────────────────────────
  const [adminRegOpen,      setAdminRegOpen]      = useState(false);
  const [newAdminName,      setNewAdminName]      = useState('');
  const [newAdminEmail,     setNewAdminEmail]     = useState('');
  const [newAdminPw,        setNewAdminPw]        = useState('');
  const [newAdminConfirmPw, setNewAdminConfirmPw] = useState('');
  const [hovRegCancel,      setHovRegCancel]      = useState(false);
  const [hovRegCreate,      setHovRegCreate]      = useState(false);

  // ── Popup button hover states ──────────────────────────────────────────────
  const [hovMaintCancel,   setHovMaintCancel]   = useState(false);
  const [hovMaintSchedule, setHovMaintSchedule] = useState(false);
  const [hovDeactCancel,   setHovDeactCancel]   = useState(false);
  const [hovGoLive,        setHovGoLive]        = useState(false);
  const [hovFeeCancel,     setHovFeeCancel]     = useState(false);
  const [hovFeeConfirm,    setHovFeeConfirm]    = useState(false);

  useQuery({
    queryKey: ['platform-fees'],
    queryFn: async () => {
      const [fees, maint] = await Promise.all([
        fetchPlatformFees(),
        fetch(`${import.meta.env.VITE_API_AUTH_URL || 'http://localhost:8000'}/auth/maintenance-status`)
          .then(r => r.json()).catch(() => ({ maintenance: false })),
      ]);
      return { fees, maint };
    },
    onSuccess: (data: any) => {
      setServiceFee(String(data.fees.service_fee_pct));
      setProviderCut(String(data.fees.provider_cut_pct));
      // Sync maintenance toggle with actual backend state
      setMaintenance(data.maint.maintenance === true);
    },
  } as any);

  // ── Notification config ────────────────────────────────────────────────────
  const nc = loadNotifConfig();
  const [nNewRequest,  setNNewRequest]  = useState<boolean>(nc?.newRequest  ?? true);
  const [nPayment,     setNPayment]     = useState<boolean>(nc?.payment     ?? true);
  const [nApplication, setNApplication] = useState<boolean>(nc?.application ?? true);
  const [nNewDriver,   setNNewDriver]   = useState<boolean>(nc?.newDriver   ?? false);
  const [nSystemAlert, setNSystemAlert] = useState<boolean>(nc?.systemAlert ?? true);
  const [notifSaved,   setNotifSaved]   = useState(false);

  // ── Support contacts ───────────────────────────────────────────────────────
  const [supportEmail, setSupportEmail] = useState(pc?.supportEmail ?? 'support@motofix.ug');
  const [supportPhone, setSupportPhone] = useState(pc?.supportPhone ?? '+256 700 000000');

  // ── Mutations ──────────────────────────────────────────────────────────────
  const profileMut = useMutation({
    mutationFn: () => updateAdminProfile({ full_name: fullName, email }),
    onSuccess: (updated) => {
      setAdminInfo(updated);
      setProfileSaved(true);
      toast.success('Profile updated.');
      setTimeout(() => setProfileSaved(false), 3000);
    },
    onError: () => toast.error('Failed to update profile.'),
  });

  const passwordMut = useMutation({
    mutationFn: () => changeAdminPassword({ current_password: currentPw, new_password: newPw }),
    onSuccess: () => {
      toast.success('Password changed successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to change password.';
      toast.error(msg);
    },
  });

  const handlePasswordSave = () => {
    if (newPw.length < 8) return toast.error('New password must be at least 8 characters.');
    if (newPw !== confirmPw) return toast.error('New passwords do not match.');
    passwordMut.mutate();
  };

  const feesMut = useMutation({
    mutationFn: () => updatePlatformFees({
      service_fee_pct: parseFloat(serviceFee),
      provider_cut_pct: parseFloat(providerCut),
    }),
    onSuccess: (result) => {
      setFeeConfirmOpen(false);
      savePlatformConfig({ serviceFee, providerCut, autoAssign, requireApproval, maintenance, supportEmail, supportPhone });
      setPlatformSaved(true);
      toast.success(result.notified > 0
        ? `Fees updated. ${result.notified} provider${result.notified !== 1 ? 's' : ''} notified via SMS.`
        : 'Fees saved — no change detected, providers not notified.'
      );
      setTimeout(() => setPlatformSaved(false), 3000);
    },
    onError: () => toast.error('Failed to save fee configuration.'),
  });

  const maintActivateMut = useMutation({
    mutationFn: () => setMaintenanceMode({
      active: true,
      start_time: maintStart,
      end_time: maintEnd,
      message: maintMessage || undefined,
    }),
    onSuccess: (result) => {
      setMaintPopupOpen(false);
      setMaintenance(true);
      savePlatformConfig({ serviceFee, providerCut, autoAssign, requireApproval, maintenance: true, supportEmail, supportPhone });
      toast.success(`Maintenance scheduled. ${result.notified} users notified via SMS.`);
    },
    onError: () => toast.error('Failed to schedule maintenance.'),
  });

  const maintDeactivateMut = useMutation({
    mutationFn: () => setMaintenanceMode({ active: false }),
    onSuccess: () => {
      setDeactivateConfirm(false);
      setMaintenance(false);
      savePlatformConfig({ serviceFee, providerCut, autoAssign, requireApproval, maintenance: false, supportEmail, supportPhone });
      toast.success('Maintenance mode deactivated. Platform is live again.');
    },
    onError: () => toast.error('Failed to deactivate maintenance mode.'),
  });

  const adminsQuery = useQuery({
    queryKey: ['admins-list'],
    queryFn: listAdmins,
  } as any);

  const adminRegMut = useMutation({
    mutationFn: () => createAdmin({ full_name: newAdminName, email: newAdminEmail, password: newAdminPw }),
    onSuccess: (created: any) => {
      setAdminRegOpen(false);
      setNewAdminName(''); setNewAdminEmail(''); setNewAdminPw(''); setNewAdminConfirmPw('');
      queryClient.invalidateQueries({ queryKey: ['admins-list'] });
      toast.success(`Admin account created for ${created.full_name}.`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to create admin account.';
      toast.error(msg);
    },
  });

  const handleAdminReg = () => {
    if (!newAdminName.trim()) return toast.error('Full name is required.');
    if (!newAdminEmail.trim()) return toast.error('Email address is required.');
    if (newAdminPw.length < 8) return toast.error('Password must be at least 8 characters.');
    if (newAdminPw !== newAdminConfirmPw) return toast.error('Passwords do not match.');
    adminRegMut.mutate();
  };

  const handleMaintenanceToggle = () => {
    if (!maintenance) {
      // Turning ON — open scheduling popup
      setMaintStart('');
      setMaintEnd('');
      setMaintMessage('');
      setMaintPopupOpen(true);
    } else {
      // Turning OFF — confirm deactivation
      setDeactivateConfirm(true);
    }
  };

  const handlePlatformSave = () => {
    // Non-fee settings save immediately to localStorage
    savePlatformConfig({ serviceFee, providerCut, autoAssign, requireApproval, maintenance, supportEmail, supportPhone });
    // Fee changes go to backend and may trigger SMS — show confirmation first
    setFeeConfirmOpen(true);
  };

  const handleNotifSave = () => {
    saveNotifConfig({ newRequest: nNewRequest, payment: nPayment, application: nApplication, newDriver: nNewDriver, systemAlert: nSystemAlert });
    setNotifSaved(true);
    toast.success('Notification preferences saved.');
    setTimeout(() => setNotifSaved(false), 3000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Page header */}
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>Settings</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Manage your account, platform configuration, and preferences.
          </p>
        </div>

        {/* ── 1. Admin Profile ── */}
        <SectionCard>
          <SectionHeader icon={User} title="Admin Profile" subtitle="Your name and email shown in the portal" />
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Full Name">
                <TextInput value={fullName} onChange={setFullName} placeholder="Your full name" />
              </Field>
              <Field label="Email Address">
                <TextInput value={email} onChange={setEmail} placeholder="you@example.com" />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <SaveBtn
                onClick={() => profileMut.mutate()}
                loading={profileMut.isPending}
                saved={profileSaved}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── 2. Change Password ── */}
        <SectionCard>
          <SectionHeader icon={Lock} title="Change Password" subtitle="Use a strong password of at least 8 characters" />
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Current Password">
              <PasswordInput value={currentPw} onChange={setCurrentPw} placeholder="Enter current password" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="New Password">
                <PasswordInput value={newPw} onChange={setNewPw} placeholder="Min. 8 characters" />
              </Field>
              <Field label="Confirm New Password">
                <PasswordInput value={confirmPw} onChange={setConfirmPw} placeholder="Repeat new password" />
              </Field>
            </div>
            {newPw && confirmPw && newPw !== confirmPw && (
              <p style={{ fontSize: 12, color: C.red, margin: 0 }}>Passwords do not match.</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <SaveBtn
                onClick={handlePasswordSave}
                loading={passwordMut.isPending}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── 3. Admin Accounts ── */}
        <SectionCard>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: '2px solid var(--adm-card-border)',
            background: C.surface2,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: C.amberDim,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Shield size={15} color={C.amber} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Admin Accounts</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>Manage portal administrators</div>
              </div>
            </div>
            <NewAdminBtn onClick={() => {
              setNewAdminName(''); setNewAdminEmail(''); setNewAdminPw(''); setNewAdminConfirmPw('');
              setAdminRegOpen(true);
            }} />
          </div>
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {adminsQuery.isLoading && (
              <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '16px 0' }}>Loading admins…</div>
            )}
            {(adminsQuery.data as any[] | undefined)?.map((a: any) => (
              <AdminRow
                key={a.id}
                record={a}
                isMe={a.id === admin?.id}
                onDeleted={() => queryClient.invalidateQueries({ queryKey: ['admins-list'] })}
              />
            ))}
          </div>
        </SectionCard>

        {/* ── 4. Appearance ── */}
        <SectionCard>
          <SectionHeader icon={Palette} title="Appearance" subtitle="Choose the admin portal theme" />
          <div style={{ padding: 22, display: 'flex', gap: 14 }}>
            {(['light', 'dark'] as const).map(t => {
              const active = theme === t;
              return (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    padding: '14px 0',
                    borderRadius: 12,
                    border: `2px solid ${active ? C.amber : C.border}`,
                    background: active ? C.amberDim : C.surface2,
                    color: active ? C.amber : C.muted,
                    fontWeight: 700, fontSize: 13.5,
                    cursor: 'pointer', transition: 'all 0.18s',
                  }}
                >
                  {t === 'light' ? <Sun size={16} /> : <Moon size={16} />}
                  {t === 'light' ? 'Light Mode' : 'Dark Mode'}
                  {active && (
                    <CheckCircle size={14} style={{ marginLeft: 2 }} />
                  )}
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* ── 4. Platform Configuration ── */}
        <SectionCard>
          <SectionHeader icon={Sliders} title="Platform Configuration" subtitle="Service fees, auto-assignment and operational rules" />
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Platform Service Fee (%)">
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'var(--adm-search-bg)',
                  border: '1.5px solid rgba(0,0,0,0.65)', borderRadius: 10, overflow: 'hidden',
                }}>
                  <span style={{ padding: '10px 14px', fontSize: 13.5, color: C.amber, fontWeight: 700, borderRight: `1px solid rgba(255,179,0,0.2)`, flexShrink: 0 }}>%</span>
                  <input
                    type="number" min="0" max="100"
                    value={serviceFee}
                    onChange={e => setServiceFee(e.target.value)}
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 13.5, padding: '10px 14px', width: '100%', fontFamily: 'inherit' }}
                  />
                </div>
              </Field>
              <Field label="Provider Revenue Cut (%)">
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'var(--adm-search-bg)',
                  border: '1.5px solid rgba(0,0,0,0.65)', borderRadius: 10, overflow: 'hidden',
                }}>
                  <span style={{ padding: '10px 14px', fontSize: 13.5, color: C.amber, fontWeight: 700, borderRight: `1px solid rgba(255,179,0,0.2)`, flexShrink: 0 }}>%</span>
                  <input
                    type="number" min="0" max="100"
                    value={providerCut}
                    onChange={e => setProviderCut(e.target.value)}
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 13.5, padding: '10px 14px', width: '100%', fontFamily: 'inherit' }}
                  />
                </div>
              </Field>
            </div>

            {[
              { label: 'Auto-assign Mechanics',     sub: 'Automatically assign the nearest available mechanic to new requests', val: autoAssign,      set: setAutoAssign },
              { label: 'Require Provider Approval', sub: 'New provider applications must be manually approved before activation', val: requireApproval, set: setRequireApproval },
              { label: 'Maintenance Mode',          sub: 'Temporarily disable the platform for all users except admins',         val: maintenance,     set: handleMaintenanceToggle, danger: true, noToggle: true },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                background: (item as any).danger && maintenance ? 'rgba(248,113,113,0.05)' : C.surface2,
                border: `1.5px solid ${(item as any).danger && maintenance ? 'rgba(248,113,113,0.4)' : 'rgba(0,0,0,0.65)'}`,
                borderRadius: 12, padding: '14px 18px',
                transition: 'background 0.2s, border-color 0.2s',
              }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: (item as any).danger ? C.red : C.text }}>{item.label}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{item.sub}</div>
                </div>
                <Toggle on={item.val} onChange={(item as any).noToggle ? item.set as any : () => item.set((v: boolean) => !v)} />
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <SaveBtn onClick={handlePlatformSave} saved={platformSaved} />
            </div>
          </div>
        </SectionCard>

        {/* ── 5. SMS & Support Contacts ── */}
        <SectionCard>
          <SectionHeader icon={Phone} title="SMS & Support Contacts" subtitle="Contact details sent to providers in automated SMS messages" />
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Support Email">
                <TextInput value={supportEmail} onChange={setSupportEmail} placeholder="support@motofix.ug" />
              </Field>
              <Field label="Support Phone">
                <TextInput value={supportPhone} onChange={setSupportPhone} placeholder="+256 700 000000" />
              </Field>
            </div>
            <p style={{ fontSize: 11.5, color: C.muted, margin: 0 }}>
              These appear in ban notifications and other automated SMS messages sent to service providers.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <SaveBtn onClick={handlePlatformSave} saved={platformSaved} />
            </div>
          </div>
        </SectionCard>

        {/* ── 6. Notification Preferences ── */}
        <SectionCard>
          <SectionHeader icon={Bell} title="Notification Preferences" subtitle="Choose which events send you alerts in the portal" />
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'New Service Request',     sub: 'Alert when a driver submits a new request',        val: nNewRequest,  set: setNNewRequest,  color: '#818cf8' },
              { label: 'Payment Received',        sub: 'Alert on every successful payment collected',      val: nPayment,     set: setNPayment,     color: C.green   },
              { label: 'Provider Application',    sub: 'Alert when a new provider submits an application', val: nApplication, set: setNApplication, color: C.amber   },
              { label: 'New Driver Registration', sub: 'Alert when a driver completes registration',       val: nNewDriver,   set: setNNewDriver,   color: '#60a5fa' },
              { label: 'System Alerts',           sub: 'Alert on service errors and critical outages',     val: nSystemAlert, set: setNSystemAlert, color: C.red     },
            ].map(n => (
              <div key={n.label} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: C.surface2, border: '1.5px solid rgba(0,0,0,0.65)',
                borderRadius: 12, padding: '13px 16px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: `${n.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bell size={14} color={n.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{n.label}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{n.sub}</div>
                </div>
                <Toggle on={n.val} onChange={() => n.set((v: boolean) => !v)} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <SaveBtn onClick={handleNotifSave} saved={notifSaved} />
            </div>
          </div>
        </SectionCard>

        {/* ── Danger Zone ── */}
        <div style={{
          background: 'rgba(248,113,113,0.04)',
          border: '2px solid rgba(180,0,0,0.75)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 22px',
            borderBottom: '2px solid rgba(180,0,0,0.75)',
            background: 'rgba(248,113,113,0.06)',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'rgba(248,113,113,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <AlertTriangle size={15} color={C.red} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.red }}>Danger Zone</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>These actions are irreversible — proceed with caution</div>
            </div>
          </div>
          <div style={{ padding: '20px 22px' }}>
            <DangerRow />
          </div>
        </div>

      </div>

      {/* ── Register new admin popup ── */}
      {adminRegOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: C.surface, borderRadius: 18,
            border: '2px solid var(--adm-card-border)',
            width: '100%', maxWidth: 480,
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              background: C.amberDim,
              borderBottom: '2px solid var(--adm-card-border)',
              padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: 'rgba(255,179,0,0.25)', border: '1.5px solid rgba(255,179,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <UserPlus size={18} color={C.amber} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Register New Admin</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
                  The new admin can log in immediately with these credentials
                </div>
              </div>
            </div>

            {/* Form */}
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Full Name">
                <TextInput value={newAdminName} onChange={setNewAdminName} placeholder="e.g. Jane Nakato" />
              </Field>
              <Field label="Email Address">
                <TextInput value={newAdminEmail} onChange={setNewAdminEmail} placeholder="admin@motofix.ug" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Password">
                  <PasswordInput value={newAdminPw} onChange={setNewAdminPw} placeholder="Min. 8 characters" />
                </Field>
                <Field label="Confirm Password">
                  <PasswordInput value={newAdminConfirmPw} onChange={setNewAdminConfirmPw} placeholder="Repeat password" />
                </Field>
              </div>
              {newAdminPw && newAdminConfirmPw && newAdminPw !== newAdminConfirmPw && (
                <p style={{ fontSize: 12, color: C.red, margin: 0 }}>Passwords do not match.</p>
              )}
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end',
              padding: '16px 24px',
              borderTop: '2px solid var(--adm-card-border)',
              background: C.surface2,
            }}>
              <button
                onClick={() => setAdminRegOpen(false)}
                onMouseEnter={() => setHovRegCancel(true)}
                onMouseLeave={() => setHovRegCancel(false)}
                style={{
                  fontSize: 13, fontWeight: 600, color: hovRegCancel ? C.text : C.muted,
                  background: C.surface,
                  border: `1.5px solid ${hovRegCancel ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.65)'}`,
                  borderRadius: 9, padding: '9px 20px', cursor: 'pointer',
                  transform: hovRegCancel ? 'translateY(-1px)' : 'none',
                  boxShadow: hovRegCancel ? '0 3px 8px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdminReg}
                disabled={adminRegMut.isPending}
                onMouseEnter={() => setHovRegCreate(true)}
                onMouseLeave={() => setHovRegCreate(false)}
                style={{
                  fontSize: 13, fontWeight: 700,
                  color: 'var(--adm-invert-text)',
                  background: hovRegCreate && !adminRegMut.isPending ? 'rgba(230,160,0,1)' : C.amber,
                  border: 'none', borderRadius: 9, padding: '9px 22px',
                  cursor: adminRegMut.isPending ? 'not-allowed' : 'pointer',
                  opacity: adminRegMut.isPending ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: 7,
                  transform: hovRegCreate && !adminRegMut.isPending ? 'translateY(-1px)' : 'none',
                  boxShadow: hovRegCreate && !adminRegMut.isPending ? '0 4px 12px rgba(255,179,0,0.35)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <UserPlus size={14} />
                {adminRegMut.isPending ? 'Creating…' : 'Create Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Maintenance scheduling popup ── */}
      {maintPopupOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: C.surface, borderRadius: 18,
            border: '2px solid var(--adm-card-border)',
            width: '100%', maxWidth: 520,
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              background: 'rgba(248,113,113,0.06)',
              borderBottom: '2px solid var(--adm-card-border)',
              padding: '18px 24px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: 'rgba(248,113,113,0.12)',
                border: '1.5px solid rgba(248,113,113,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <CalendarClock size={18} color={C.red} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Schedule Maintenance Window</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>All drivers and service providers will be notified via SMS</div>
              </div>
            </div>

            {/* Form */}
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Start Date & Time">
                  <input
                    type="datetime-local"
                    value={maintStart}
                    onChange={e => setMaintStart(e.target.value)}
                    style={{
                      background: 'var(--adm-search-bg)',
                      border: '1.5px solid rgba(0,0,0,0.65)',
                      borderRadius: 10, padding: '10px 14px',
                      color: C.text, fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', width: '100%',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,179,0,0.8)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.65)'}
                  />
                </Field>
                <Field label="Estimated End Date & Time">
                  <input
                    type="datetime-local"
                    value={maintEnd}
                    onChange={e => setMaintEnd(e.target.value)}
                    style={{
                      background: 'var(--adm-search-bg)',
                      border: '1.5px solid rgba(0,0,0,0.65)',
                      borderRadius: 10, padding: '10px 14px',
                      color: C.text, fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', width: '100%',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,179,0,0.8)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.65)'}
                  />
                </Field>
              </div>

              <Field label="Message to Users (optional)">
                <textarea
                  value={maintMessage}
                  onChange={e => setMaintMessage(e.target.value)}
                  placeholder="e.g. We are upgrading our servers to improve service reliability."
                  rows={3}
                  style={{
                    background: 'var(--adm-search-bg)',
                    border: '1.5px solid rgba(0,0,0,0.65)',
                    borderRadius: 10, padding: '10px 14px',
                    color: C.text, fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', width: '100%', resize: 'vertical',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,179,0,0.8)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.65)'}
                />
              </Field>

              {/* SMS preview */}
              {(maintStart || maintEnd) && (
                <div style={{
                  background: C.surface2, border: '1.5px solid rgba(0,0,0,0.65)',
                  borderRadius: 12, padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    SMS Preview
                  </div>
                  <p style={{ fontSize: 12.5, color: C.text, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
                    {`MOTOFIX: Scheduled Maintenance Notice\n\nOur platform will be temporarily unavailable:\nFrom: ${maintStart ? new Date(maintStart).toLocaleString('en-UG', { dateStyle: 'full', timeStyle: 'short' }) : 'TBD'}\nTo:   ${maintEnd ? new Date(maintEnd).toLocaleString('en-UG', { dateStyle: 'full', timeStyle: 'short' }) : 'TBD'}${maintMessage ? `\n\n${maintMessage}` : ''}\n\nWe apologise for the inconvenience.\nsupport@motofix.ug | +256 700 000000`}
                  </p>
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(248,113,113,0.06)',
                border: '1.5px solid rgba(248,113,113,0.25)',
              }}>
                <ShieldAlert size={14} color={C.red} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.red }}>
                  The platform will be locked for all drivers and service providers once activated.
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end',
              padding: '16px 24px',
              borderTop: '2px solid var(--adm-card-border)',
              background: C.surface2,
            }}>
              <button
                onClick={() => setMaintPopupOpen(false)}
                onMouseEnter={() => setHovMaintCancel(true)}
                onMouseLeave={() => setHovMaintCancel(false)}
                style={{
                  fontSize: 13, fontWeight: 600, color: hovMaintCancel ? C.text : C.muted,
                  background: C.surface,
                  border: `1.5px solid ${hovMaintCancel ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.65)'}`,
                  borderRadius: 9, padding: '9px 20px', cursor: 'pointer',
                  transform: hovMaintCancel ? 'translateY(-1px)' : 'none',
                  boxShadow: hovMaintCancel ? '0 3px 8px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => maintActivateMut.mutate()}
                disabled={!maintStart || !maintEnd || maintActivateMut.isPending}
                onMouseEnter={() => setHovMaintSchedule(true)}
                onMouseLeave={() => setHovMaintSchedule(false)}
                style={{
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  background: !maintStart || !maintEnd ? 'rgba(248,113,113,0.4)' : hovMaintSchedule ? 'rgba(200,0,0,0.9)' : C.red,
                  border: 'none', borderRadius: 9, padding: '9px 22px',
                  cursor: (!maintStart || !maintEnd || maintActivateMut.isPending) ? 'not-allowed' : 'pointer',
                  opacity: maintActivateMut.isPending ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: 7,
                  transform: hovMaintSchedule && maintStart && maintEnd && !maintActivateMut.isPending ? 'translateY(-1px)' : 'none',
                  boxShadow: hovMaintSchedule && maintStart && maintEnd && !maintActivateMut.isPending ? '0 4px 12px rgba(248,113,113,0.4)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <CalendarClock size={14} />
                {maintActivateMut.isPending ? 'Scheduling…' : 'Schedule & Notify All Users'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Maintenance deactivation confirm ── */}
      {deactivateConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: C.surface, borderRadius: 18,
            border: '2px solid var(--adm-card-border)',
            width: '100%', maxWidth: 420,
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)', overflow: 'hidden',
          }}>
            <div style={{
              background: 'rgba(52,211,153,0.06)',
              borderBottom: '2px solid var(--adm-card-border)',
              padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: 'rgba(52,211,153,0.12)', border: '1.5px solid rgba(52,211,153,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <WrenchIcon size={18} color={C.green} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>End Maintenance Mode?</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>The platform will go live immediately for all users</div>
              </div>
            </div>
            <div style={{ padding: '20px 24px 0' }}>
              <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.6 }}>
                Deactivating maintenance mode will restore full access for drivers and service providers right away.
              </p>
            </div>
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end',
              padding: '20px 24px',
              borderTop: '2px solid var(--adm-card-border)',
              background: C.surface2, marginTop: 20,
            }}>
              <button
                onClick={() => setDeactivateConfirm(false)}
                onMouseEnter={() => setHovDeactCancel(true)}
                onMouseLeave={() => setHovDeactCancel(false)}
                style={{
                  fontSize: 13, fontWeight: 600, color: hovDeactCancel ? C.text : C.muted,
                  background: C.surface,
                  border: `1.5px solid ${hovDeactCancel ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.65)'}`,
                  borderRadius: 9, padding: '9px 20px', cursor: 'pointer',
                  transform: hovDeactCancel ? 'translateY(-1px)' : 'none',
                  boxShadow: hovDeactCancel ? '0 3px 8px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => maintDeactivateMut.mutate()}
                disabled={maintDeactivateMut.isPending}
                onMouseEnter={() => setHovGoLive(true)}
                onMouseLeave={() => setHovGoLive(false)}
                style={{
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  background: hovGoLive && !maintDeactivateMut.isPending ? 'rgba(16,185,129,1)' : C.green,
                  border: 'none', borderRadius: 9, padding: '9px 22px',
                  cursor: maintDeactivateMut.isPending ? 'not-allowed' : 'pointer',
                  opacity: maintDeactivateMut.isPending ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: 7,
                  transform: hovGoLive && !maintDeactivateMut.isPending ? 'translateY(-1px)' : 'none',
                  boxShadow: hovGoLive && !maintDeactivateMut.isPending ? '0 4px 12px rgba(52,211,153,0.4)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <WrenchIcon size={14} />
                {maintDeactivateMut.isPending ? 'Deactivating…' : 'Go Live Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fee change confirmation dialog ── */}
      {feeConfirmOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: C.surface, borderRadius: 18,
            border: '2px solid var(--adm-card-border)',
            width: '100%', maxWidth: 480,
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}>
            {/* Header strip */}
            <div style={{
              background: C.amberDim,
              borderBottom: '2px solid var(--adm-card-border)',
              padding: '18px 24px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: 'rgba(255,179,0,0.25)',
                border: '1.5px solid rgba(255,179,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <MessageSquare size={18} color={C.amber} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Confirm Fee Update</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
                  Active service providers will be notified via SMS
                </div>
              </div>
            </div>

            {/* Fee cards */}
            <div style={{ padding: '20px 24px', display: 'flex', gap: 12 }}>
              <div style={{
                flex: 1, borderRadius: 12, padding: '16px 18px',
                background: 'rgba(255,179,0,0.06)',
                border: '2px solid rgba(255,179,0,0.35)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Platform Fee
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: C.amber, lineHeight: 1 }}>
                  {serviceFee}<span style={{ fontSize: 18 }}>%</span>
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5 }}>
                  MOTOFIX takes from each job
                </div>
              </div>

              <div style={{
                flex: 1, borderRadius: 12, padding: '16px 18px',
                background: C.surface2,
                border: '2px solid var(--adm-card-border)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Provider Cut
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: C.text, lineHeight: 1 }}>
                  {providerCut}<span style={{ fontSize: 18 }}>%</span>
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5 }}>
                  Paid to the service provider
                </div>
              </div>
            </div>

            {/* Info line */}
            <div style={{
              margin: '0 24px 20px',
              padding: '12px 16px',
              borderRadius: 10,
              background: C.surface2,
              border: '1.5px solid rgba(0,0,0,0.65)',
              fontSize: 12.5, color: C.muted, lineHeight: 1.6,
            }}>
              An SMS will be sent to every verified, active mechanic and towing provider on the platform as soon as you confirm.
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end',
              padding: '16px 24px',
              borderTop: '2px solid var(--adm-card-border)',
              background: C.surface2,
            }}>
              <button
                onClick={() => setFeeConfirmOpen(false)}
                onMouseEnter={() => setHovFeeCancel(true)}
                onMouseLeave={() => setHovFeeCancel(false)}
                style={{
                  fontSize: 13, fontWeight: 600, color: hovFeeCancel ? C.text : C.muted,
                  background: C.surface,
                  border: `1.5px solid ${hovFeeCancel ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.65)'}`,
                  borderRadius: 9, padding: '9px 20px', cursor: 'pointer',
                  transform: hovFeeCancel ? 'translateY(-1px)' : 'none',
                  boxShadow: hovFeeCancel ? '0 3px 8px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => feesMut.mutate()}
                disabled={feesMut.isPending}
                onMouseEnter={() => setHovFeeConfirm(true)}
                onMouseLeave={() => setHovFeeConfirm(false)}
                style={{
                  fontSize: 13, fontWeight: 700,
                  color: 'var(--adm-invert-text)',
                  background: hovFeeConfirm && !feesMut.isPending ? 'rgba(230,160,0,1)' : C.amber,
                  border: 'none', borderRadius: 9, padding: '9px 22px',
                  cursor: feesMut.isPending ? 'not-allowed' : 'pointer',
                  opacity: feesMut.isPending ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: 7,
                  transform: hovFeeConfirm && !feesMut.isPending ? 'translateY(-1px)' : 'none',
                  boxShadow: hovFeeConfirm && !feesMut.isPending ? '0 4px 12px rgba(255,179,0,0.35)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <MessageSquare size={14} />
                {feesMut.isPending ? 'Saving & Sending…' : 'Confirm & Notify Providers'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function AdminRow({ record, isMe, onDeleted }: {
  record: { id: number; full_name: string; email: string; role: string; created_at: string | null };
  isMe: boolean;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [hovRemove,  setHovRemove]  = useState(false);
  const [hovCancel,  setHovCancel]  = useState(false);
  const [hovConfirm, setHovConfirm] = useState(false);

  const deleteMut = useMutation({
    mutationFn: () => deleteAdmin(record.id),
    onSuccess: () => {
      onDeleted();
      toast.success(`Admin account for ${record.full_name} has been removed.`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to remove admin.';
      toast.error(msg);
      setConfirming(false);
    },
  });

  const initials = (record.full_name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{
      background: 'var(--adm-surface-2)',
      border: `1.5px solid ${confirming ? 'rgba(180,0,0,0.45)' : isMe ? 'rgba(255,179,0,0.4)' : 'rgba(0,0,0,0.65)'}`,
      borderRadius: 12, overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: isMe ? 'var(--adm-amber-dim)' : 'var(--adm-divider)',
          border: `1.5px solid ${isMe ? 'rgba(255,179,0,0.4)' : 'rgba(0,0,0,0.12)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800,
          color: isMe ? 'var(--adm-amber)' : 'var(--adm-muted)',
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)' }}>{record.full_name}</span>
            {isMe && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: 'var(--adm-amber-dim)', color: 'var(--adm-amber)' }}>
                You
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--adm-muted)', marginTop: 1 }}>{record.email}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--adm-amber-dim)', color: 'var(--adm-amber)', border: '1px solid rgba(255,179,0,0.3)' }}>
            {record.role ?? 'admin'}
          </span>
          {record.created_at && (
            <span style={{ fontSize: 11, color: 'var(--adm-muted)' }}>
              {new Date(record.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          {!isMe && (
            <button
              onClick={() => setConfirming(v => !v)}
              onMouseEnter={() => setHovRemove(true)}
              onMouseLeave={() => setHovRemove(false)}
              style={{
                fontSize: 11.5, fontWeight: 700,
                color: hovRemove ? '#fff' : '#ff3333',
                background: hovRemove ? 'rgba(180,0,0,0.85)' : 'rgba(255,51,51,0.08)',
                border: '1.5px solid rgba(180,0,0,0.55)',
                borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
                transform: hovRemove ? 'translateY(-1px)' : 'none',
                boxShadow: hovRemove ? '0 3px 8px rgba(180,0,0,0.25)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Inline confirm strip */}
      {confirming && (
        <div style={{
          borderTop: '1px solid rgba(180,0,0,0.2)',
          padding: '12px 16px',
          background: 'rgba(248,113,113,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 12.5, color: '#cc2222', fontWeight: 500 }}>
            Remove <strong>{record.full_name}</strong>? They will lose portal access immediately.
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setConfirming(false)}
              onMouseEnter={() => setHovCancel(true)}
              onMouseLeave={() => setHovCancel(false)}
              style={{
                fontSize: 12, fontWeight: 600,
                color: hovCancel ? 'var(--adm-text)' : 'var(--adm-muted)',
                background: 'var(--adm-surface)',
                border: `1.5px solid ${hovCancel ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.65)'}`,
                borderRadius: 7, padding: '5px 14px', cursor: 'pointer',
                transform: hovCancel ? 'translateY(-1px)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              onMouseEnter={() => setHovConfirm(true)}
              onMouseLeave={() => setHovConfirm(false)}
              style={{
                fontSize: 12, fontWeight: 700, color: '#fff',
                background: hovConfirm && !deleteMut.isPending ? 'rgba(180,0,0,0.9)' : '#e53e3e',
                border: 'none', borderRadius: 7, padding: '5px 16px',
                cursor: deleteMut.isPending ? 'not-allowed' : 'pointer',
                opacity: deleteMut.isPending ? 0.7 : 1,
                transform: hovConfirm && !deleteMut.isPending ? 'translateY(-1px)' : 'none',
                boxShadow: hovConfirm && !deleteMut.isPending ? '0 3px 8px rgba(180,0,0,0.3)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {deleteMut.isPending ? 'Removing…' : 'Yes, Remove'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewAdminBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        fontSize: 12.5, fontWeight: 700,
        color: hov ? 'var(--adm-invert-text)' : 'var(--adm-amber)',
        background: hov ? 'var(--adm-amber)' : 'var(--adm-amber-dim)',
        border: '1.5px solid var(--adm-amber)',
        borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
        transform: hov ? 'translateY(-1px)' : 'none',
        boxShadow: hov ? '0 4px 12px rgba(255,179,0,0.3)' : 'none',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      <UserPlus size={13} />
      New Admin
    </button>
  );
}

function DangerRow() {
  const [confirm, setConfirm] = useState(false);
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      background: 'var(--adm-surface-2)',
      border: '1.5px solid rgba(0,0,0,0.65)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 18px' }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)' }}>Deactivate Admin Account</div>
          <div style={{ fontSize: 11.5, color: 'var(--adm-muted)', marginTop: 2 }}>
            Disable this admin account — you will be signed out immediately
          </div>
        </div>
        <button
          onClick={() => setConfirm(v => !v)}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          style={{
            fontSize: 12, fontWeight: 700, color: hov ? '#fff' : '#ff3333',
            background: hov ? 'rgba(180,0,0,0.85)' : 'rgba(255,51,51,0.08)',
            border: '2px solid rgba(180,0,0,0.75)',
            borderRadius: 8, padding: '7px 16px', cursor: 'pointer', flexShrink: 0,
            transition: 'all 0.15s',
            transform: hov ? 'translateY(-1px)' : 'none',
            boxShadow: hov ? '0 4px 12px rgba(180,0,0,0.3)' : 'none',
          }}
        >
          Deactivate
        </button>
      </div>
      {confirm && (
        <div style={{
          borderTop: '1px solid rgba(255,51,51,0.15)',
          padding: '14px 18px',
          background: 'rgba(255,51,51,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 12.5, color: '#ff3333', fontWeight: 500 }}>
            Are you sure? This will sign you out and disable your account.
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setConfirm(false)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--adm-muted)', background: 'var(--adm-track-bg)', border: '1.5px solid var(--adm-border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>Cancel</button>
            <button style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#ff3333', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer' }}>Confirm</button>
          </div>
        </div>
      )}
    </div>
  );
}
