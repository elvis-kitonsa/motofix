import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, ChevronDown, RefreshCw, User, Settings, ShieldCheck, ActivitySquare, Sun, Moon } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { clearAuthToken, getAdminInfo } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function LiveDot() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 700, color: 'var(--adm-green)',
      background: 'var(--adm-green-dim)',
      border: '1px solid rgba(52,211,153,0.2)',
      padding: '3px 10px', borderRadius: 20,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'var(--adm-green)',
        boxShadow: '0 0 6px #34d399',
        animation: 'topbar-pulse 2s infinite',
        display: 'inline-block',
      }} />
      Live
    </span>
  );
}

interface TopBarProps {
  sidebarWidth: number;
}

export function TopBar({ sidebarWidth }: TopBarProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const admin = getAdminInfo();

  const initials     = admin?.full_name ? getInitials(admin.full_name) : 'A';
  const displayName  = admin?.full_name ?? 'Admin';
  const displayEmail = admin?.email ?? 'admin@motofix.ug';
  const displayRole  = admin?.role
    ? admin.role.charAt(0).toUpperCase() + admin.role.slice(1)
    : 'Super Admin';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleLogout = () => {
    setDropdownOpen(false);
    clearAuthToken();
    navigate('/login');
  };

  return (
    <>
      <style>{`
        @keyframes topbar-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #34d399; }
          50%       { opacity: 0.5; box-shadow: 0 0 2px #34d399; }
        }
        @keyframes topbar-drop {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>

      <header
        style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          height: 64, zIndex: 30,
          background: 'hsl(var(--background))',
          borderBottom: '2px solid var(--adm-amber)',
          display: 'flex', alignItems: 'center', gap: 0,
        }}
      >
        {/* Sidebar spacer */}
        <div
          className="hidden lg:block"
          style={{ width: sidebarWidth, flexShrink: 0, transition: 'width 0.3s ease', borderRight: '2px solid var(--adm-amber)' }}
        />

        {/* Live status */}
        <div style={{ padding: '0 20px', flexShrink: 0 }}>
          <LiveDot />
        </div>

        {/* Search */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: searchFocused ? 'var(--adm-search-focus)' : 'var(--adm-search-bg)',
            border: `1.5px solid ${searchFocused ? 'rgba(0,0,0,0.80)' : 'rgba(0,0,0,0.80)'}`,
            boxShadow: searchFocused ? '0 0 0 3px rgba(0,0,0,0.08)' : 'none',
            borderRadius: 10, padding: '0 14px',
            width: '100%', maxWidth: 640, height: 36,
            transition: 'border-color 0.15s, background 0.15s',
          }}>
            <Search
              size={14}
              style={{ flexShrink: 0, transition: 'color 0.15s', color: searchFocused ? 'var(--adm-amber)' : '#000000' }}
            />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search requests, mechanics, drivers..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--adm-text)', fontSize: 12.5, width: '100%',
                fontFamily: 'inherit',
              }}
            />
            <kbd style={{
              fontSize: 10,
              color: searchFocused ? 'var(--adm-amber)' : 'rgba(0,0,0,0.80)',
              background: searchFocused ? 'var(--adm-amber-dim)' : 'rgba(0,0,0,0.07)',
              border: `1.5px solid ${searchFocused ? 'var(--adm-amber)' : 'rgba(0,0,0,0.80)'}`,
              borderRadius: 4, padding: '1px 5px',
              flexShrink: 0, fontFamily: 'inherit', letterSpacing: 0,
            }}>
              /
            </kbd>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', flexShrink: 0 }}>

          {/* Refresh */}
          <IconBtn title="Refresh data" onClick={() => window.location.reload()}>
            <RefreshCw size={15} />
          </IconBtn>

          {/* Theme toggle — capsule with sliding knob */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              position: 'relative', width: 56, height: 28, borderRadius: 999,
              background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
              border: `1.5px solid rgba(0,0,0,0.80)`,
              cursor: 'pointer', padding: 0, flexShrink: 0,
              transition: 'background 0.25s ease, border-color 0.25s ease',
            }}
          >
            <Sun style={{
              position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)',
              width: 12, height: 12,
              color: theme === 'light' ? '#FFB300' : 'var(--adm-muted)',
              transition: 'color 0.25s ease',
            }} />
            <Moon style={{
              position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
              width: 12, height: 12,
              color: theme === 'dark' ? '#818cf8' : 'var(--adm-muted)',
              transition: 'color 0.25s ease',
            }} />
            <span style={{
              position: 'absolute', top: 3, bottom: 3, width: 22,
              borderRadius: 999,
              background: theme === 'dark' ? '#818cf8' : '#FFB300',
              left: theme === 'dark' ? 'calc(100% - 25px)' : '3px',
              transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.25s ease',
              boxShadow: 'none',
            }} />
          </button>

          {/* Notifications */}
          <NotificationCenter />

          {/* Divider */}
          <div style={{ width: 1, height: 22, background: 'var(--adm-divider)', margin: '0 4px' }} />

          {/* Profile dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'transparent', border: 'none',
                cursor: 'pointer', padding: '2px 4px', borderRadius: 10,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!dropdownOpen) e.currentTarget.style.background = 'var(--adm-search-bg)'; }}
              onMouseLeave={e => { if (!dropdownOpen) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, #FFB300, #e6a000)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 900, color: '#000',
                letterSpacing: '0.04em', flexShrink: 0,
                border: '1.5px solid rgba(0,0,0,0.80)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              }}>
                {initials}
              </div>
              <ChevronDown
                size={13}
                style={{
                  color: 'var(--adm-muted)',
                  transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s ease', flexShrink: 0,
                }}
              />
            </button>

            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: 50, right: 0, width: 250,
                background: 'var(--adm-popup-bg)',
                border: '1px solid var(--adm-popup-border)',
                borderRadius: 16,
                boxShadow: 'var(--adm-popup-shadow)',
                overflow: 'hidden',
                animation: 'topbar-drop 0.18s ease both',
                zIndex: 100,
              }}>
                {/* User header */}
                <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--adm-divider)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #FFB300, #e6a000)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 900, color: '#000',
                      border: '1.5px solid rgba(0,0,0,0.80)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                    }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--adm-text)' }}>{displayName}</div>
                      <div style={{ fontSize: 11, color: 'var(--adm-amber)', fontWeight: 600, marginTop: 1 }}>{displayRole}</div>
                    </div>
                  </div>
                  {displayEmail && (
                    <div style={{
                      marginTop: 10, fontSize: 11, color: 'var(--adm-muted)',
                      background: 'var(--adm-surface-3)',
                      border: '1px solid var(--adm-divider)',
                      borderRadius: 7, padding: '5px 10px', wordBreak: 'break-all',
                    }}>
                      {displayEmail}
                    </div>
                  )}
                </div>

                {/* Menu items */}
                <div style={{ padding: '6px 0' }}>
                  <DropdownItem icon={<User size={14} />}           label="My Profile"       onClick={() => { setDropdownOpen(false); navigate('/profile'); }} />
                  <DropdownItem icon={<ActivitySquare size={14} />} label="Activity Log"     onClick={() => { setDropdownOpen(false); navigate('/activity-log'); }} />
                  <DropdownItem icon={<ShieldCheck size={14} />}    label="Security"         onClick={() => { setDropdownOpen(false); navigate('/security'); }} />
                  <DropdownItem icon={<Settings size={14} />}       label="Account Settings" onClick={() => { setDropdownOpen(false); navigate('/account-settings'); }} />
                </div>

                {/* Sign out */}
                <div style={{ borderTop: '1px solid var(--adm-divider)', padding: '6px 0' }}>
                  <DropdownItem icon={<LogOut size={14} />} label="Sign out" danger onClick={handleLogout} />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title?: string; onClick?: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 34, height: 34, borderRadius: 9,
        background: hov ? 'var(--adm-icon-hover)' : 'transparent',
        border: `1px solid ${hov ? 'var(--adm-popup-border)' : 'transparent'}`,
        color: hov ? 'var(--adm-text)' : 'var(--adm-text-sub)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function DropdownItem({
  icon, label, danger, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 16px',
        background: hov ? (danger ? 'rgba(239,68,68,0.08)' : 'var(--adm-list-hover)') : 'transparent',
        border: 'none',
        color: hov
          ? (danger ? 'var(--adm-red)' : 'var(--adm-amber)')
          : (danger ? 'var(--adm-red)' : 'var(--adm-text-sub)'),
        fontSize: 13, fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 0.12s, color 0.12s',
        textAlign: 'left',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
