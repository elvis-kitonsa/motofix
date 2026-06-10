import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Sun, Moon, User, LogOut, RefreshCw, Zap } from 'lucide-react'
import { C } from '@/styles/tokens'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  providerName: string
  providerType: 'mechanic' | 'towing_provider'
  spn: string | null
  isAvailable: boolean
  onToggleAvailable: () => void
  unreadCount: number
  onBellClick: () => void
  onAvatarClick: () => void
}

function initials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TopHeader({
  providerName, providerType, spn, isAvailable,
  onToggleAvailable, unreadCount, onBellClick, onAvatarClick,
}: Props) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const navBtnBorder = '1px solid var(--border-3)'
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleToggleClick = () => {
    if (!isAvailable) setShowConfirm(true)
    else onToggleAvailable()
  }

  const handleConfirmYes = () => { setShowConfirm(false); onToggleAvailable() }
  const handleConfirmNo  = () => setShowConfirm(false)

  const handleLogout = () => {
    setDropdownOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <style>{`
        @keyframes hdr-dot  { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes hdr-sheet-in {
          from { transform: translateX(-50%) translateY(100%); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
        @keyframes hdr-ring  { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(2.2);opacity:0} }
        @keyframes hdr-fade  { from{opacity:0} to{opacity:1} }
        @keyframes hdr-drop  {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div style={{
        width: '100%', height: 64,
        background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
      }}>

        {/* ── Left: SPN chip + Online/Offline toggle ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* SPN / type chip */}
          {spn ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 0,
              padding: '4px 9px', borderRadius: 8,
              background: '#F59E0B', color: '#000',
              fontSize: 11, fontWeight: 900, letterSpacing: '0.06em',
              cursor: 'default',
            }}>
              {spn.toUpperCase()}
            </div>
          ) : (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 9px', borderRadius: 8,
              background: '#F59E0B', color: '#000',
              fontSize: 10, fontWeight: 900, letterSpacing: '0.05em',
            }}>
              MOTOFIX
            </div>
          )}

          {/* Online / Offline toggle */}
          <button
            onClick={handleToggleClick}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 11px', borderRadius: 20,
              background: isAvailable ? 'var(--status-online-bg)' : 'var(--status-offline-bg)',
              border: `1px solid ${isAvailable ? 'var(--status-online-border)' : 'var(--status-offline-border)'}`,
              cursor: 'pointer',
              transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = isAvailable
                ? '0 0 10px rgba(34,197,94,0.2)'
                : '0 0 10px rgba(245,158,11,0.15)'
            }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isAvailable ? 'var(--status-online-dot)' : 'var(--status-offline-dot)',
              transition: 'background 0.3s',
              animation: isAvailable ? 'hdr-dot 2s ease-in-out infinite' : 'none',
            }} />
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: isAvailable ? 'var(--status-online-color)' : 'var(--status-offline-color)',
              transition: 'color 0.3s',
            }}>
              {isAvailable ? 'Online' : 'Offline'}
            </span>
          </button>
        </div>

        {/* ── Right: Theme capsule + Bell + Avatar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Theme capsule — sliding knob */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              position: 'relative', width: 56, height: 28, borderRadius: 999,
              background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
              border: navBtnBorder,
              cursor: 'pointer', padding: 0, flexShrink: 0,
              transition: 'background 0.25s ease, border-color 0.25s ease',
            }}
          >
            <Sun style={{
              position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)',
              width: 12, height: 12,
              color: theme === 'light' ? '#F59E0B' : 'var(--text-md)',
              transition: 'color 0.25s ease',
            }} />
            <Moon style={{
              position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
              width: 12, height: 12,
              color: theme === 'dark' ? '#818cf8' : 'var(--text-md)',
              transition: 'color 0.25s ease',
            }} />
            <span style={{
              position: 'absolute', top: 3, bottom: 3, width: 22,
              borderRadius: 999,
              background: theme === 'dark' ? '#818cf8' : '#F59E0B',
              left: theme === 'dark' ? 'calc(100% - 25px)' : '3px',
              transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.25s ease',
              boxShadow: theme === 'dark' ? '0 0 8px rgba(129,140,248,0.5)' : '0 0 8px rgba(245,158,11,0.5)',
            }} />
          </button>

          {/* Bell */}
          <button
            onClick={onBellClick}
            style={{
              position: 'relative', width: 34, height: 34, borderRadius: 10,
              background: 'var(--surface-2)',
              border: navBtnBorder,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s ease',
            }}
          >
            <Bell style={{ width: 15, height: 15, color: 'var(--text-lo)' }} />
            {unreadCount > 0 && (
              <div style={{
                position: 'absolute', top: -5, right: -5,
                minWidth: 18, height: 18, borderRadius: 9,
                padding: '0 4px',
                background: '#DC2626',
                border: '2px solid var(--nav-solid)',
                boxShadow: '0 1px 4px rgba(220,38,38,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </div>
            )}
          </button>

          {/* Avatar + dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              style={{
                width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                border: isDark ? '2px solid rgba(245,158,11,0.4)' : '2px solid rgba(245,158,11,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isDark ? '0 0 0 3px rgba(245,158,11,0.12)' : 'none',
                fontSize: 11, fontWeight: 900, color: '#000', letterSpacing: '0.04em',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.08)'
                e.currentTarget.style.boxShadow = '0 0 0 4px rgba(251,191,36,0.25), 0 0 18px rgba(245,158,11,0.4)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = isDark ? '0 0 0 3px rgba(245,158,11,0.12)' : 'none'
              }}
            >
              {initials(providerName || 'SP')}
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 110 }} onClick={() => setDropdownOpen(false)} />
                <div style={{
                  position: 'absolute', top: 42, right: 0, zIndex: 120,
                  width: 200,
                  background: 'var(--overlay-bg)',
                  border: '1px solid var(--border-3)',
                  borderRadius: 16,
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                  animation: 'hdr-drop 0.2s ease both',
                }}>
                  {/* Provider info header */}
                  <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-2)' }}>
                    <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 14, lineHeight: 1 }}>
                      {providerName || 'Provider'}
                    </p>
                    <p style={{ color: 'rgba(245,158,11,0.7)', fontSize: 11, marginTop: 3 }}>
                      {spn ?? (providerType === 'towing_provider' ? 'Towing Provider' : 'Mechanic')}
                    </p>
                  </div>

                  {/* Menu items */}
                  {[
                    { label: 'My Profile', icon: User, action: () => { setDropdownOpen(false); onAvatarClick() } },
                    { label: 'Refresh',    icon: RefreshCw, action: () => { setDropdownOpen(false); window.location.reload() } },
                  ].map(({ label, icon: Icon, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 16px', cursor: 'pointer', border: 'none',
                        background: 'transparent', textAlign: 'left',
                        borderBottom: '1px solid var(--border-1)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Icon style={{ width: 14, height: 14, color: 'var(--text-lo)', flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-md)', fontSize: 13, fontWeight: 600 }}>{label}</span>
                    </button>
                  ))}

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '11px 16px', cursor: 'pointer', border: 'none',
                      background: 'transparent', textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut style={{ width: 14, height: 14, color: '#f87171', flexShrink: 0 }} />
                    <span style={{ color: '#f87171', fontSize: 13, fontWeight: 600 }}>Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Go-online confirmation sheet ────────────────────────── */}
      {showConfirm && (
        <>
          <div
            onClick={handleConfirmNo}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(10px)',
              zIndex: 200,
              animation: 'hdr-fade 0.2s ease both',
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%',
            width: '100%', maxWidth: 480,
            background: 'var(--sheet-bg)',
            border: '1px solid var(--border-3)',
            borderBottom: 'none',
            borderRadius: '28px 28px 0 0',
            padding: '32px 24px 44px',
            zIndex: 201,
            animation: 'hdr-sheet-in 0.35s cubic-bezier(0.34,1.3,0.64,1) both',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-4)', margin: '0 auto 28px' }} />

            <div style={{ position: 'relative', width: 72, height: 72, margin: '0 auto 24px' }}>
              <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: '1.5px solid rgba(74,222,128,0.20)', animation: 'hdr-ring 2s ease-out infinite' }} />
              <div style={{ position: 'absolute', inset: -7, borderRadius: '50%', border: '1.5px solid rgba(74,222,128,0.28)', animation: 'hdr-ring 2s ease-out 0.5s infinite' }} />
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(74,222,128,0.14)', border: '1.5px solid rgba(74,222,128,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap style={{ width: 30, height: 30, color: C.green }} />
              </div>
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-hi)', textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 10 }}>
              Ready to Work?
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-md)', textAlign: 'center', lineHeight: 1.65, marginBottom: 32, padding: '0 8px' }}>
              Going online means you'll start receiving job requests from drivers nearby who need{' '}
              {providerType === 'towing_provider' ? 'towing' : 'mechanical'} assistance.
            </p>

            <button
              onClick={handleConfirmYes}
              style={{
                width: '100%', padding: '16px', borderRadius: 18, marginBottom: 12,
                background: `linear-gradient(135deg, ${C.green}, #22c55e)`,
                border: 'none', cursor: 'pointer',
                fontSize: 15, fontWeight: 800, color: '#000',
                boxShadow: '0 4px 24px rgba(74,222,128,0.30)',
                transition: 'transform 0.15s ease',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Yes, I'm Ready
            </button>
            <button
              onClick={handleConfirmNo}
              style={{
                width: '100%', padding: '15px', borderRadius: 18,
                background: 'var(--surface-2)',
                border: '1px solid var(--border-2)',
                cursor: 'pointer',
                fontSize: 14, fontWeight: 700, color: 'var(--text-md)',
                transition: 'background 0.2s ease',
              }}
            >
              Maybe Later
            </button>
          </div>
        </>
      )}
    </>
  )
}
