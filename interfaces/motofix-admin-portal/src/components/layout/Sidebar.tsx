import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { clearAuthToken } from '@/lib/api';
import {
  LayoutDashboard, Wrench, CreditCard,
  Car, ClipboardList, BadgeCheck, Package,
  Settings, HelpCircle, LogOut,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const S = {
  bg:        'hsl(var(--background))',
  border:    'var(--adm-divider)',
  amber:     'var(--adm-amber)',
  amberDark: 'var(--adm-invert-text)',
  navText:   'var(--adm-text)',
  navHov:    'var(--adm-text)',
  hover:     'var(--adm-row-hover)',
} as const;

const NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/requests',     icon: Wrench,          label: 'Requests' },
  { to: '/payments',     icon: CreditCard,      label: 'Payments' },
  { to: '/providers',    icon: BadgeCheck,      label: 'Service Providers' },
  { to: '/drivers',      icon: Car,             label: 'Drivers' },
  { to: '/applications', icon: ClipboardList,   label: 'Applications' },
  { to: '/spare-parts',  icon: Package,         label: 'Spare Parts' },
];

function NavItem({ item, collapsed, onClick }: {
  item: typeof NAV[number];
  collapsed: boolean;
  onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <NavLink
        to={item.to}
        end
        onClick={onClick}
        style={{ textDecoration: 'none', display: 'block' }}
      >
        {({ isActive }) => (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: collapsed ? '10px 0' : '9px 12px',
            borderRadius: 9,
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            background: isActive ? S.amber : hov ? S.hover : 'transparent',
            color: isActive ? S.amberDark : hov ? S.navHov : S.navText,
            border: isActive ? '1.5px solid rgba(0,0,0,0.55)' : '1.5px solid transparent',
          }}>
            <item.icon size={16} strokeWidth={isActive ? 2.5 : 1.75} style={{ flexShrink: 0 }} />
            {!collapsed && (
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label}
              </span>
            )}
          </div>
        )}
      </NavLink>

      {collapsed && hov && (
        <div style={{
          position: 'absolute', left: '100%', top: '50%',
          transform: 'translateY(-50%)', marginLeft: 10,
          background: 'var(--adm-popup-bg)', color: 'var(--adm-text)',
          padding: '6px 12px', borderRadius: 8,
          fontSize: 12, fontWeight: 600,
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999,
          border: '1px solid var(--adm-popup-border)',
          boxShadow: 'var(--adm-popup-shadow)',
        }}>
          {item.label}
        </div>
      )}
    </div>
  );
}

function BottomBtn({ icon: Icon, label, collapsed, danger, badge, onClick, to }: {
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
  danger?: boolean;
  badge?: string;
  onClick?: () => void;
  to?: string;
}) {
  const [hov, setHov] = useState(false);

  const inner = (isActive = false) => (
    <>
      <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} style={{ flexShrink: 0 }} />
      {!collapsed && (
        <>
          <span style={{ flex: 1 }}>{label}</span>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: 'var(--adm-amber-dim)',
              color: S.amber,
              padding: '2px 7px', borderRadius: 20,
            }}>
              {badge}
            </span>
          )}
        </>
      )}
    </>
  );

  const baseStyle = (isActive: boolean): React.CSSProperties => ({
    width: '100%', display: 'flex', alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    gap: 10,
    padding: collapsed ? '9px 0' : '9px 12px',
    borderRadius: 9,
    background: isActive ? S.amber : hov ? (danger ? 'rgba(220,38,38,0.14)' : S.hover) : 'transparent',
    border: isActive ? '1.5px solid rgba(0,0,0,0.55)' : hov && danger ? '1.5px solid rgba(180,0,0,0.3)' : '1.5px solid transparent',
    color: isActive ? S.amberDark : hov ? (danger ? '#e53e3e' : S.navHov) : (danger ? 'var(--adm-red)' : S.navText),
    fontSize: 13, fontWeight: isActive ? 600 : hov && danger ? 600 : 400,
    cursor: 'pointer', transition: 'all 0.15s',
    textAlign: 'left', textDecoration: 'none',
  });

  if (to) {
    return (
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        title={collapsed ? label : undefined}
      >
        <NavLink to={to} end style={{ display: 'block' }}>
          {({ isActive }) => (
            <div style={baseStyle(isActive)}>
              {inner(isActive)}
            </div>
          )}
        </NavLink>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={baseStyle(false)}
    >
      {inner(false)}
    </button>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const w = collapsed ? 68 : 280;

  const handleLogout = () => {
    clearAuthToken();
    navigate('/login');
  };

  return (
    <>
      <aside
        className="fixed top-0 left-0 z-40 h-screen flex flex-col transition-all duration-300"
        style={{ width: w, background: S.bg, borderRight: `2px solid var(--adm-amber)` }}
      >

        {/* ── Floating collapse/expand toggle ── */}
        <button
          onClick={onToggle}
          style={{
            position: 'absolute',
            top: 20,
            right: -14,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--adm-amber)',
            border: `2px solid ${S.bg}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--adm-invert-text)',
            boxShadow: '0 2px 12px rgba(255,179,0,0.35)',
            zIndex: 50,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {collapsed
            ? <ChevronRight size={14} strokeWidth={2.5} />
            : <ChevronLeft size={14} strokeWidth={2.5} />}
        </button>

        {/* ── Brand ── */}
        <div style={{
          height: 64, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 16px',
          gap: 10,
          borderBottom: `1px solid var(--adm-divider)`,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: 'var(--adm-amber)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid rgba(0,0,0,0.80)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }}>
            <img
              src="/favicon.png"
              alt="MOTOFIX"
              style={{ width: 36, height: 36, objectFit: 'contain', filter: 'brightness(0)' }}
            />
          </div>

          {!collapsed && (
            <span style={{
              fontSize: 15, fontWeight: 800,
              color: 'var(--adm-amber)',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
            }}>
              MOTOFIX
            </span>
          )}
        </div>

        {/* ── Amber separator ── */}
        <div style={{ height: 2, background: 'var(--adm-amber)', margin: '0 16px', borderRadius: 99 }} />

        {/* ── Main nav ── */}
        <nav style={{
          flex: 1, overflowY: 'auto',
          padding: collapsed ? '14px 8px 6px' : '14px 12px 6px',
          display: 'flex', flexDirection: 'column', gap: 2,
          scrollbarWidth: 'none',
        }}>
          {NAV.map(item => (
            <NavItem
              key={item.to}
              item={item}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* ── Bottom nav ── */}
        <div style={{
          flexShrink: 0,
          borderTop: `2px solid rgba(0,0,0,0.18)`,
          padding: collapsed ? '10px 8px' : '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <BottomBtn icon={Settings}   label="Settings"    collapsed={collapsed} to="/settings" />
          <BottomBtn icon={HelpCircle} label="Help Center" collapsed={collapsed} badge="New" to="/help" />
          <BottomBtn icon={LogOut}     label="Logout"      collapsed={collapsed} danger onClick={handleLogout} />
        </div>

      </aside>
    </>
  );
}
