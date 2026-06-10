import { LayoutDashboard, ClipboardList, Crown, User } from 'lucide-react'

type Tab = 'home' | 'jobs' | 'earnings' | 'profile'

interface Props {
  activeTab: Tab
  onChange: (tab: Tab) => void
  hasActiveJob: boolean
  hasPendingAlert: boolean
}

const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: 'home',     icon: LayoutDashboard, label: 'Home'     },
  { id: 'jobs',     icon: ClipboardList,   label: 'Jobs'     },
  { id: 'earnings', icon: Crown,           label: 'Subscription' },
  { id: 'profile',  icon: User,            label: 'Profile'  },
]

export default function BottomNav({ activeTab, onChange, hasActiveJob, hasPendingAlert }: Props) {
  return (
    <>
      <style>{`
        @keyframes bnavRing {
          0%   { transform: scale(1);   opacity: 0.65; }
          70%  { transform: scale(2.0); opacity: 0;    }
          100% { transform: scale(2.0); opacity: 0;    }
        }
        .bnav-ring {
          animation: bnavRing 2.2s ease-out infinite;
          transform-origin: center center;
        }
        @keyframes bnavPop {
          0%   { transform: scale(0.88); }
          55%  { transform: scale(1.10); }
          100% { transform: scale(1);    }
        }
        .bnav-active { animation: bnavPop 0.3s cubic-bezier(0.34,1.4,0.64,1) both; }
      `}</style>

      <nav style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        left: 20,
        right: 20,
        zIndex: 50,
        borderRadius: 9999,
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--border-3)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 10px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.08)',
        /* Equal top & bottom breathing room inside the pill */
        padding: '12px 6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {TABS.map(({ id, icon: Icon, label }) => {
            const active         = activeTab === id
            const showRedBadge   = id === 'jobs' && hasActiveJob
            const showAmberBadge = id === 'jobs' && hasPendingAlert && !hasActiveJob

            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                style={{
                  flex: 1,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 5,
                  padding: '0 8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  minHeight: 54,
                }}
              >
                {/* Icon + ring wrapper — everything centered here */}
                <div style={{
                  position: 'relative',
                  width: 38, height: 38,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* Pulsing ring starts at exactly the circle's size and scales out from dead center */}
                  {active && (
                    <div className="bnav-ring" style={{
                      position: 'absolute',
                      inset: 0,               /* same 38×38 as the circle */
                      borderRadius: '50%',
                      background: 'rgba(245,158,11,0.22)',
                      pointerEvents: 'none',
                    }} />
                  )}

                  {/* Filled circle — perfectly centered via flex parent */}
                  <div
                    className={active ? 'bnav-active' : undefined}
                    style={{
                      width: 38, height: 38,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: active
                        ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                        : 'var(--surface-3)',
                      border: active ? 'none' : '1px solid var(--border-2)',
                      boxShadow: active ? '0 0 18px rgba(245,158,11,0.45)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.28s ease, box-shadow 0.28s ease',
                    }}
                  >
                    <Icon style={{
                      width: 18, height: 18,
                      color: active ? '#ffffff' : 'var(--text-dim)',
                      transition: 'color 0.22s ease',
                    }} />
                  </div>

                  {/* Badge dot */}
                  {(showRedBadge || showAmberBadge) && (
                    <div style={{
                      position: 'absolute', top: 0, right: 0, zIndex: 2,
                      width: 9, height: 9, borderRadius: '50%',
                      background: showRedBadge ? '#F87171' : '#F59E0B',
                      border: '2px solid var(--nav-solid)',
                    }} />
                  )}
                </div>

                {/* Label */}
                <span style={{
                  fontSize: 10,
                  fontWeight: active ? 800 : 500,
                  color: active ? '#F59E0B' : 'var(--text-faint)',
                  letterSpacing: active ? '0.02em' : '0',
                  transition: 'color 0.22s ease',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
