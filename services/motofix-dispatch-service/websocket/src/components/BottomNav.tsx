import { useLocation, useNavigate } from 'react-router-dom';
import { Home, History, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/history', icon: History, label: 'History' },
  { path: '/',        icon: Home,    label: 'Home'    },
  { path: '/profile', icon: User,    label: 'Profile' },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const isActive = pathname === path;
          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className={cn(
                'relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground active:text-foreground'
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full" />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
