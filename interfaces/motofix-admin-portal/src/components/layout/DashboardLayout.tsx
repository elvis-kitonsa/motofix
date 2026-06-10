import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { isAuthenticated } from '@/lib/api';

interface DashboardLayoutProps {
  children: ReactNode;
}

function useIsDesktop() {
  const [is, setIs] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  useEffect(() => {
    const fn = () => setIs(window.innerWidth >= 1024);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return is;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const isDesktop = useIsDesktop();
  const sidebarWidth = collapsed ? 68 : 280;

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <TopBar sidebarWidth={sidebarWidth} />
      <main
        style={{
          marginLeft: isDesktop ? sidebarWidth : 0,
          minHeight: '100vh',
          paddingTop: 64,
          transition: 'margin-left 0.3s ease',
        }}
      >
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
