import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Wrench, Car, Star, LogOut, Moon, Sun, Trophy, ChevronRight } from 'lucide-react';
import { useDarkMode } from '@/hooks/use-dark-mode';
import { loadStats, getLevelInfo } from '@/services/gamification';

const ProfileScreen: React.FC = () => {
  const { mechanic, logout } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (!mechanic) return null;

  const gamStats = loadStats();
  const { title: levelTitle } = getLevelInfo(gamStats.xp);

  const infoItems = [
    { icon: Phone, label: 'Phone', value: mechanic.phone },
    { icon: Wrench, label: 'Specialty', value: mechanic.specialty },
    { icon: Car, label: 'Vehicle Type', value: mechanic.vehicle_type },
    {
      icon: Star,
      label: 'Rating',
      value: `${mechanic.rating.toFixed(1)} (${mechanic.total_ratings} reviews)`,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="px-4 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Profile</h1>
          <button
            type="button"
            onClick={toggleDark}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-warning" />
            ) : (
              <Moon className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col p-4 pb-24">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center py-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <User className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">{mechanic.name}</h2>
          <p className="text-muted-foreground mt-1">{mechanic.location}</p>
        </div>

        {/* Stats & Achievements Card */}
        <button
          type="button"
          onClick={() => navigate('/stats')}
          className="w-full card-industrial p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Rank</p>
            <p className="text-foreground font-semibold mt-0.5">{levelTitle}</p>
            <p className="text-xs text-muted-foreground">{gamStats.totalJobs} jobs · {gamStats.badges.length} badges · {gamStats.xp} XP</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>

        {/* Info Cards */}
        <div className="space-y-3">
          {infoItems.map((item) => (
            <div key={item.label} className="card-industrial p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {item.label}
                  </p>
                  <p className="text-foreground font-medium mt-0.5">{item.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto mb-4 btn-touch flex items-center justify-center gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Contact your supervisor to update your profile
        </p>
      </main>
    </div>
  );
};

export default ProfileScreen;
