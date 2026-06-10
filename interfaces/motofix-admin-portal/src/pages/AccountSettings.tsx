import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ArrowLeft, Globe, Clock, DollarSign, Percent,
  Bell, Moon, Sun, Monitor, Save, AlertTriangle,
  Trash2, PowerOff, Languages, Hash, RefreshCw,
  CheckCircle,
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

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '18px 22px',
      borderBottom: `1px solid ${C.border}`,
      background: C.surface2,
    }}>
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
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--adm-search-bg)',
          border: `1px solid rgba(255,179,0,0.3)`,
          borderRadius: 10, padding: '11px 14px',
          color: C.text, fontSize: 13.5,
          fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b6b82' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 14px center',
          paddingRight: 36,
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: 'var(--adm-surface)' }}>{o.label}</option>
        ))}
      </select>
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
        background: on ? 'var(--adm-invert-text)' : C.muted,
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

function InputField({ label, value, onChange, prefix }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--adm-search-bg)', border: `1px solid rgba(255,179,0,0.3)`,
        borderRadius: 10, overflow: 'hidden',
      }}>
        {prefix && (
          <span style={{
            padding: '11px 14px', fontSize: 13.5, color: C.amber, fontWeight: 700,
            borderRight: `1px solid rgba(255,179,0,0.2)`, flexShrink: 0,
          }}>{prefix}</span>
        )}
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: C.text, fontSize: 13.5, padding: '11px 14px',
            width: '100%', fontFamily: 'inherit',
          }}
        />
      </div>
    </div>
  );
}

export default function AccountSettings() {
  const navigate = useNavigate();

  // General
  const [language, setLanguage]     = useState('en');
  const [timezone, setTimezone]     = useState('africa-kampala');
  const [dateFormat, setDateFormat] = useState('dd-mm-yyyy');
  const [currency, setCurrency]     = useState('ugx');

  // Platform
  const [serviceFee, setServiceFee]       = useState('10');
  const [providerCut, setProviderCut]     = useState('80');
  const [autoAssign, setAutoAssign]       = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  const [maintenanceMode, setMaintenance] = useState(false);

  // Notifications
  const [newRequest, setNewRequest]     = useState(true);
  const [newPayment, setNewPayment]     = useState(true);
  const [newProvider, setNewProvider]   = useState(true);
  const [newDriver, setNewDriver]       = useState(false);
  const [systemAlerts, setSystemAlerts] = useState(true);

  // Save state
  const [saved, setSaved] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Back + title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Account Settings</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>Manage platform preferences and configurations</div>
            </div>
          </div>

          <button
            onClick={handleSave}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 13, fontWeight: 700,
              color: saved ? C.green : 'var(--adm-invert-text)',
              background: saved ? 'rgba(52,211,153,0.15)' : C.amber,
              border: saved ? '1px solid rgba(52,211,153,0.3)' : 'none',
              borderRadius: 10, padding: '9px 20px', cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {saved ? <CheckCircle size={14} /> : <Save size={14} />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* General Settings */}
        <SectionCard>
          <SectionHeader icon={Globe} title="General Settings" subtitle="Language, timezone, date format and currency" />
          <div style={{ padding: '22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <SelectField
              label="Language"
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'en', label: 'English (US)' },
                { value: 'en-gb', label: 'English (UK)' },
                { value: 'sw', label: 'Swahili' },
              ]}
            />
            <SelectField
              label="Timezone"
              value={timezone}
              onChange={setTimezone}
              options={[
                { value: 'africa-kampala',  label: 'Africa/Kampala (UTC+3)' },
                { value: 'africa-nairobi',  label: 'Africa/Nairobi (UTC+3)' },
                { value: 'africa-lagos',    label: 'Africa/Lagos (UTC+1)'   },
                { value: 'europe-london',   label: 'Europe/London (UTC+0)'  },
              ]}
            />
            <SelectField
              label="Date Format"
              value={dateFormat}
              onChange={setDateFormat}
              options={[
                { value: 'dd-mm-yyyy', label: 'DD/MM/YYYY' },
                { value: 'mm-dd-yyyy', label: 'MM/DD/YYYY' },
                { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD' },
              ]}
            />
            <SelectField
              label="Currency Display"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: 'ugx', label: 'UGX — Ugandan Shilling' },
                { value: 'usd', label: 'USD — US Dollar'         },
                { value: 'kes', label: 'KES — Kenyan Shilling'   },
              ]}
            />
          </div>
        </SectionCard>

        {/* Platform Settings */}
        <SectionCard>
          <SectionHeader icon={Percent} title="Platform Settings" subtitle="Service fees, auto-assignment and approval rules" />
          <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <InputField label="Platform Service Fee (%)" value={serviceFee} onChange={setServiceFee} prefix="%" />
              <InputField label="Provider Revenue Cut (%)" value={providerCut} onChange={setProviderCut} prefix="%" />
            </div>

            {[
              { label: 'Auto-assign Mechanics',     sub: 'Automatically assign the nearest available mechanic to new requests', val: autoAssign,      set: setAutoAssign      },
              { label: 'Require Provider Approval', sub: 'New provider applications must be manually approved before activation', val: requireApproval, set: setRequireApproval },
              { label: 'Maintenance Mode',          sub: 'Temporarily disable the platform for all users except admins',         val: maintenanceMode, set: setMaintenance,    danger: true },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                background: (item as any).danger && maintenanceMode ? 'rgba(248,113,113,0.05)' : C.surface2,
                border: `1px solid ${(item as any).danger && maintenanceMode ? 'rgba(248,113,113,0.2)' : C.border}`,
                borderRadius: 12, padding: '14px 18px',
                transition: 'background 0.2s, border-color 0.2s',
              }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: (item as any).danger ? C.red : C.text }}>{item.label}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{item.sub}</div>
                </div>
                <Toggle on={item.val} onChange={() => item.set((v: boolean) => !v)} />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Notification Triggers */}
        <SectionCard>
          <SectionHeader icon={Bell} title="Notification Triggers" subtitle="Choose which events send admin notifications" />
          <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'New Service Request',     sub: 'Notify when a driver submits a new request',           val: newRequest,  set: setNewRequest,  color: '#818cf8' },
              { label: 'Payment Received',        sub: 'Notify on every successful payment collected',         val: newPayment,  set: setNewPayment,  color: C.green },
              { label: 'Provider Application',    sub: 'Notify when a new provider applies to join',           val: newProvider, set: setNewProvider, color: C.amber },
              { label: 'New Driver Registration', sub: 'Notify when a driver completes registration',          val: newDriver,   set: setNewDriver,   color: '#60a5fa' },
              { label: 'System Alerts',           sub: 'Notify on service restarts, errors and outages',       val: systemAlerts,set: setSystemAlerts,color: C.red   },
            ].map(n => (
              <div key={n.label} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: C.surface2, border: `1px solid ${C.border}`,
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
          </div>
        </SectionCard>

        {/* Danger Zone */}
        <div style={{
          background: 'rgba(248,113,113,0.04)',
          border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '18px 22px',
            borderBottom: '1px solid rgba(248,113,113,0.15)',
            background: 'rgba(248,113,113,0.06)',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'rgba(248,113,113,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={15} color={C.red} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.red }}>Danger Zone</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>These actions are irreversible — proceed with caution</div>
            </div>
          </div>

          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Reset platform data */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              background: C.surface2, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <RefreshCw size={16} color={C.muted} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>Reset Notification Settings</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>Restore all notification preferences to defaults</div>
                </div>
              </div>
              <button style={{
                fontSize: 12, fontWeight: 600, color: C.amber,
                background: C.amberDim, border: `1px solid rgba(255,179,0,0.25)`,
                borderRadius: 8, padding: '7px 16px', cursor: 'pointer', flexShrink: 0,
              }}>
                Reset
              </button>
            </div>

            {/* Deactivate account */}
            <div style={{
              background: C.surface2, border: `1px solid ${C.border}`,
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                padding: '16px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <PowerOff size={16} color={C.red} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>Deactivate Admin Account</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>Disable this admin account — you will be signed out immediately</div>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmDeactivate(v => !v)}
                  style={{
                    fontSize: 12, fontWeight: 600, color: '#ff3333',
                    background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.25)',
                    borderRadius: 8, padding: '7px 16px', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Deactivate
                </button>
              </div>
              {confirmDeactivate && (
                <div style={{
                  borderTop: '1px solid rgba(255,51,51,0.15)',
                  padding: '14px 18px',
                  background: 'rgba(255,51,51,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <span style={{ fontSize: 12.5, color: C.red, fontWeight: 500 }}>
                    Are you sure? This will sign you out and disable your account.
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => setConfirmDeactivate(false)} style={{
                      fontSize: 12, fontWeight: 600, color: C.muted,
                      background: 'var(--adm-track-bg)', border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                    }}>Cancel</button>
                    <button style={{
                      fontSize: 12, fontWeight: 700, color: '#fff',
                      background: '#ff3333', border: 'none',
                      borderRadius: 8, padding: '6px 16px', cursor: 'pointer',
                    }}>Confirm Deactivate</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
