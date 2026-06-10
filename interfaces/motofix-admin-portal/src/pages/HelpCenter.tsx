import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  HelpCircle, Search, ChevronDown,
  BookOpen, Users, Wrench, CreditCard, Settings2, ShieldCheck,
  CalendarClock, MessageSquare, Phone, Mail,
  Zap, Star, CheckCircle, AlertTriangle, X,
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

// ── Data ──────────────────────────────────────────────────────────────────────

const TOPICS = [
  {
    id: 'getting-started',
    icon: BookOpen,
    color: '#818cf8',
    title: 'Getting Started',
    desc: 'Learn the basics of the admin portal',
    articles: [
      'Logging in and navigating the dashboard',
      'Understanding the sidebar sections',
      'Reading dashboard stats and KPI cards',
      'Using dark mode and appearance settings',
    ],
  },
  {
    id: 'providers',
    icon: Users,
    color: '#f59e0b',
    title: 'Managing Providers',
    desc: 'Approve, suspend and manage service providers',
    articles: [
      'Reviewing and approving provider applications',
      'Banning or suspending a provider with a reason',
      'Understanding SPNs (Service Provider Numbers)',
      'Verifying identity documents and face scans',
    ],
  },
  {
    id: 'requests',
    icon: Wrench,
    color: '#34d399',
    title: 'Service Requests',
    desc: 'Monitor and manage active service requests',
    articles: [
      'Viewing real-time request status and location',
      'Filtering requests by type, status, or provider',
      'Understanding the request lifecycle states',
      'How auto-assignment works for mechanics',
    ],
  },
  {
    id: 'payments',
    icon: CreditCard,
    color: '#60a5fa',
    title: 'Payments & Fees',
    desc: 'Track collections and configure platform fees',
    articles: [
      'How platform fees and provider cuts are calculated',
      'Viewing payment history and transaction breakdowns',
      'Changing fee percentages and notifying providers',
      'Understanding payment statuses (pending, settled)',
    ],
  },
  {
    id: 'settings',
    icon: Settings2,
    color: '#a78bfa',
    title: 'Platform Settings',
    desc: 'Configure maintenance mode, fees and contacts',
    articles: [
      'Scheduling a maintenance window with SMS notifications',
      'Updating platform service fee percentages',
      'Configuring SMS and support contact details',
      'Managing notification preferences',
    ],
  },
  {
    id: 'security',
    icon: ShieldCheck,
    color: '#f87171',
    title: 'Account & Security',
    desc: 'Manage your admin profile and password',
    articles: [
      'Changing your admin password securely',
      'Updating your display name and email',
      'What to do if you are locked out',
      'Admin account deactivation',
    ],
  },
];

const FAQS = [
  {
    id: 'faq-1',
    q: 'How do I approve or reject a provider application?',
    a: 'Navigate to the Applications page from the sidebar. Each card shows the provider\'s details, documents, and face scan. Click "Review" to open the full application, then use the "Approve" or "Reject" button. Rejected applications require a reason, which is stored for auditing.',
  },
  {
    id: 'faq-2',
    q: 'What does Maintenance Mode do?',
    a: 'Enabling Maintenance Mode locks the platform for all drivers and service providers — they receive a "503 Under Maintenance" response on every request. Admins are always exempt. You schedule a start and end time plus an optional message. The system sends an SMS broadcast to all registered users and automatically restores the platform when the scheduled window ends, no manual action required.',
  },
  {
    id: 'faq-3',
    q: 'How do platform service fees work?',
    a: 'The Platform Service Fee (%) is the share MOTOFIX retains from each completed job. The Provider Revenue Cut (%) goes to the mechanic or towing provider. Both are configured in Settings → Platform Configuration. When fees are changed and saved, an SMS is automatically sent to all verified, active providers notifying them of the new rates.',
  },
  {
    id: 'faq-4',
    q: 'How do I ban or suspend a service provider?',
    a: 'Open the Providers page and select the mechanic or towing provider. Inside their profile, use the "Ban Provider" action and supply a ban reason. The reason is stored for audit purposes and sent to the provider via SMS along with your support contact details. Banned providers cannot log in until the ban is lifted by an admin.',
  },
  {
    id: 'faq-5',
    q: 'What is an SPN and how is it assigned?',
    a: 'SPN stands for Service Provider Number — a unique sequential identifier automatically assigned when a provider account is created. SPNs are used for internal tracking, audit logs, and provider communications. They cannot be changed or reassigned.',
  },
  {
    id: 'faq-6',
    q: 'Can I reset a provider\'s temporary password?',
    a: 'Yes. When a new provider account is created, a system-generated temporary password is sent via SMS. The provider is required to change it on first login (tracked via the password_changed flag). If they are locked out, an admin can regenerate their credentials from the provider\'s profile page.',
  },
  {
    id: 'faq-7',
    q: 'How do I change my own admin password?',
    a: 'Go to Settings → Change Password. Enter your current password, followed by your new password (minimum 8 characters) twice for confirmation. If your current password is wrong, the request will be rejected. Contact your system administrator if you are fully locked out.',
  },
  {
    id: 'faq-8',
    q: 'Why are some providers shown as "Not Verified"?',
    a: 'Providers who submitted an application but have not yet been reviewed are marked unverified. An admin must check their identity documents and approve them on the Applications page before they can accept jobs on the platform.',
  },
  {
    id: 'faq-9',
    q: 'How does auto-assignment work for mechanics?',
    a: 'When Auto-assign Mechanics is enabled in Platform Configuration, the system automatically assigns the nearest available and verified mechanic to every new service request. If disabled, requests stay unassigned until an admin or the mechanic manually accepts them.',
  },
  {
    id: 'faq-10',
    q: 'What happens when a maintenance window expires?',
    a: 'No admin action is needed. The maintenance middleware checks the scheduled end time on every incoming request. When that time passes, it automatically clears the maintenance state in the database and the platform goes live again for all users.',
  },
];

const CHANGELOG = [
  {
    version: 'v2.3',
    date: 'May 2026',
    badge: 'Latest',
    color: '#34d399',
    items: [
      'Help Center — searchable FAQ, topic guides, and changelog',
      'Settings page — admin profile, password, appearance and platform config',
      'Maintenance Mode — scheduled windows with automatic SMS broadcast to all users',
      'Fee change notifications — SMS sent to active providers when fees are updated',
      'Popup hover effects — all confirmation dialogs now have interactive button states',
    ],
  },
  {
    version: 'v2.2',
    date: 'April 2026',
    badge: null,
    color: '',
    items: [
      'Provider ban / unban with audit reason and SMS notification',
      'SPN (Service Provider Number) auto-assignment on account creation',
      'Provider applications — face scan and document upload workflow',
      'Platform config table — single-row DB record for fee settings',
    ],
  },
  {
    version: 'v2.1',
    date: 'March 2026',
    badge: null,
    color: '',
    items: [
      'Dark / Light theme toggle persisted to localStorage across sessions',
      'Real-time service request monitoring with status and type filters',
      'Payment breakdown showing platform fee vs. provider cut per transaction',
      'Driver registration, vehicle type management, and profile editing',
    ],
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--adm-divider)' }} />
    </div>
  );
}

function TopicCard({ topic }: { topic: typeof TOPICS[number] }) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  const Icon = topic.icon;

  return (
    <div
      style={{
        background: C.surface,
        border: `2px solid ${hov || open ? topic.color + '55' : 'var(--adm-card-border)'}`,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'border-color 0.18s, box-shadow 0.18s',
        boxShadow: hov || open ? `0 4px 18px ${topic.color}18` : 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => setOpen(v => !v)}
    >
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: topic.color + '18',
          border: `1.5px solid ${topic.color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={topic.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{topic.title}</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{topic.desc}</div>
        </div>
        <ChevronDown
          size={15}
          color={C.muted}
          style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </div>

      {open && (
        <div style={{
          borderTop: `1px solid var(--adm-divider)`,
          background: C.surface2,
          padding: '12px 18px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {topic.articles.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                background: topic.color,
              }} />
              <span style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>{a}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FaqItem({ item }: { item: typeof FAQS[number] }) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);

  return (
    <div
      style={{
        borderBottom: '1px solid var(--adm-divider)',
        transition: 'background 0.15s',
        background: open ? C.surface2 : hov ? 'rgba(255,179,0,0.03)' : 'transparent',
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 14, padding: '15px 22px', cursor: 'pointer',
          background: 'none', border: 'none', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.5 }}>
          {item.q}
        </span>
        <ChevronDown
          size={15}
          color={C.muted}
          style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <div style={{ padding: '0 22px 16px', paddingLeft: 22 }}>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.75, margin: 0 }}>
            {item.a}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HelpCenter() {
  const [search, setSearch] = useState('');
  const [searchHov, setSearchHov] = useState(false);

  const q = search.toLowerCase().trim();

  const filteredTopics = useMemo(() =>
    q
      ? TOPICS.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.desc.toLowerCase().includes(q) ||
          t.articles.some(a => a.toLowerCase().includes(q))
        )
      : TOPICS,
    [q]
  );

  const filteredFaqs = useMemo(() =>
    q
      ? FAQS.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
      : FAQS,
    [q]
  );

  const hasResults = filteredTopics.length > 0 || filteredFaqs.length > 0;

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Page header ── */}
        <div style={{
          background: C.surface,
          border: '2px solid var(--adm-card-border)',
          borderRadius: 16, padding: '28px 28px 24px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: C.amberDim,
              border: `2px solid ${C.amber}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HelpCircle size={22} color={C.amber} />
            </div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}>Help Center</h1>
              <p style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
                Guides, FAQs, and release notes for the MOTOFIX admin portal.
              </p>
            </div>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--adm-search-bg)',
            border: `1.5px solid ${searchHov ? C.amber + 'cc' : 'rgba(0,0,0,0.65)'}`,
            borderRadius: 12, padding: '0 14px',
            transition: 'border-color 0.15s',
          }}
            onMouseEnter={() => setSearchHov(true)}
            onMouseLeave={() => setSearchHov(false)}
          >
            <Search size={15} color={C.muted} style={{ flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search topics, FAQs, or articles…"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: C.text, fontSize: 13.5, padding: '12px 0',
                width: '100%', fontFamily: 'inherit',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: C.muted, display: 'flex', alignItems: 'center', padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick stats */}
          {!q && (
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { icon: BookOpen,       label: '6 Topic Guides',    color: '#818cf8' },
                { icon: MessageSquare,  label: '10 FAQs',           color: C.amber   },
                { icon: Zap,            label: '3 Release Notes',   color: '#34d399' },
              ].map(s => (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: C.surface2,
                  border: '1.5px solid var(--adm-card-border)',
                  borderRadius: 9, padding: '7px 14px',
                  fontSize: 12, fontWeight: 600, color: C.muted,
                }}>
                  <s.icon size={13} color={s.color} />
                  {s.label}
                </div>
              ))}
            </div>
          )}

          {/* Search result count */}
          {q && (
            <div style={{ fontSize: 12.5, color: C.muted }}>
              {hasResults
                ? `${filteredTopics.length} topic${filteredTopics.length !== 1 ? 's' : ''} and ${filteredFaqs.length} FAQ${filteredFaqs.length !== 1 ? 's' : ''} matching "${search}"`
                : `No results for "${search}"`
              }
            </div>
          )}
        </div>

        {/* ── No results ── */}
        {q && !hasResults && (
          <div style={{
            background: C.surface, border: '2px solid var(--adm-card-border)',
            borderRadius: 16, padding: '40px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center',
          }}>
            <AlertTriangle size={32} color={C.muted} />
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>No results found</div>
            <div style={{ fontSize: 13, color: C.muted, maxWidth: 340, lineHeight: 1.6 }}>
              Try different keywords, or contact support below if your question isn't answered here.
            </div>
          </div>
        )}

        {/* ── Topic guides ── */}
        {filteredTopics.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionLabel text="Topic Guides" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {filteredTopics.map(t => <TopicCard key={t.id} topic={t} />)}
            </div>
          </div>
        )}

        {/* ── FAQ ── */}
        {filteredFaqs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionLabel text="Frequently Asked Questions" />
            <div style={{
              background: C.surface,
              border: '2px solid var(--adm-card-border)',
              borderRadius: 16, overflow: 'hidden',
            }}>
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
                  <HelpCircle size={15} color={C.amber} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Frequently Asked Questions</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>Click a question to expand the answer</div>
                </div>
              </div>
              {filteredFaqs.map(f => <FaqItem key={f.id} item={f} />)}
            </div>
          </div>
        )}

        {/* ── Changelog ── */}
        {!q && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionLabel text="What's New" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {CHANGELOG.map((entry, idx) => (
                <div key={entry.version} style={{
                  background: C.surface,
                  border: `2px solid ${idx === 0 ? '#34d39935' : 'var(--adm-card-border)'}`,
                  borderRadius: 14, overflow: 'hidden',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--adm-divider)',
                    background: idx === 0 ? 'rgba(52,211,153,0.04)' : C.surface2,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                      background: idx === 0 ? 'rgba(52,211,153,0.12)' : C.surface,
                      border: `1.5px solid ${idx === 0 ? 'rgba(52,211,153,0.3)' : 'var(--adm-divider)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {idx === 0
                        ? <Star size={14} color="#34d399" />
                        : <Zap size={14} color={C.muted} />
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{entry.version}</span>
                        {entry.badge && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: 'rgba(52,211,153,0.15)', color: '#34d399',
                            border: '1px solid rgba(52,211,153,0.3)',
                          }}>
                            {entry.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{entry.date}</div>
                    </div>
                  </div>
                  <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {entry.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                        <CheckCircle size={13} color={idx === 0 ? '#34d399' : C.muted} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 13, color: idx === 0 ? C.text : C.muted, lineHeight: 1.55 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Contact Support ── */}
        {!q && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionLabel text="Contact Support" />
            <div style={{
              background: C.surface,
              border: '2px solid var(--adm-card-border)',
              borderRadius: 16, padding: '22px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: C.amberDim,
                  border: `2px solid ${C.amber}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MessageSquare size={19} color={C.amber} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Still need help?</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
                    Reach the MOTOFIX technical team directly.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <ContactChip icon={Mail} label="support@motofix.ug" />
                <ContactChip icon={Phone} label="+256 700 000000" />
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

function ContactChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: hov ? 'var(--adm-amber-dim)' : 'var(--adm-surface-2)',
        border: `1.5px solid ${hov ? 'var(--adm-amber)' : 'rgba(0,0,0,0.65)'}`,
        borderRadius: 10, padding: '9px 16px', cursor: 'default',
        transition: 'all 0.15s',
        transform: hov ? 'translateY(-1px)' : 'none',
        boxShadow: hov ? '0 3px 10px rgba(255,179,0,0.18)' : 'none',
      }}
    >
      <Icon size={13} color={hov ? 'var(--adm-amber)' : 'var(--adm-muted)'} style={{ flexShrink: 0, transition: 'color 0.15s' }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: hov ? 'var(--adm-amber)' : 'var(--adm-text)', transition: 'color 0.15s' }}>
        {label}
      </span>
    </div>
  );
}
