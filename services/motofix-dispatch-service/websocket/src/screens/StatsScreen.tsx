import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Flame, Briefcase, Zap } from 'lucide-react';
import { loadStats, getLevelInfo, BADGES } from '@/services/gamification';
import { LEVELS } from '@/types/gamification';

const StatsScreen: React.FC = () => {
  const navigate = useNavigate();
  const stats = loadStats();
  const levelInfo = getLevelInfo(stats.xp);

  const progressPct = Math.round(levelInfo.progress * 100);

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="px-4 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Stats & Achievements</h1>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 overflow-y-auto">

        {/* Level / XP Card */}
        <div className="card-industrial p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Rank</p>
              <h2 className="text-xl font-black text-foreground">{levelInfo.title}</h2>
            </div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex flex-col items-center justify-center">
              <span className="text-xs text-muted-foreground leading-none">Lvl</span>
              <span className="text-2xl font-black text-primary leading-none">{levelInfo.level}</span>
            </div>
          </div>

          {/* XP bar */}
          {levelInfo.xpForNextLevel !== null ? (
            <>
              <progress
                className="xp-progress"
                value={progressPct}
                max={100}
                aria-label={`${progressPct}% progress to next level`}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{stats.xp.toLocaleString()} XP</span>
                <span>{levelInfo.nextTitle} at {(LEVELS.find(l => l.level === levelInfo.level + 1)?.xpRequired ?? 0).toLocaleString()} XP</span>
              </div>
            </>
          ) : (
            <div className="text-sm text-accent font-semibold mt-1">
              🏆 Maximum rank reached — {stats.xp.toLocaleString()} XP total
            </div>
          )}
        </div>

        {/* Streak Card */}
        <div className="card-industrial p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Streaks</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center p-3 bg-accent/10 rounded-xl">
              <Flame className="w-6 h-6 text-accent mb-1" />
              <span className="text-3xl font-black text-foreground">{stats.streak}</span>
              <span className="text-xs text-muted-foreground">Current</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted rounded-xl">
              <Flame className="w-6 h-6 text-muted-foreground mb-1" />
              <span className="text-3xl font-black text-foreground">{stats.bestStreak}</span>
              <span className="text-xs text-muted-foreground">Best</span>
            </div>
          </div>
        </div>

        {/* Job Stats Card */}
        <div className="card-industrial p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Performance</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground">{stats.totalJobs}</p>
                <p className="text-xs text-muted-foreground">Total Jobs</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground">{stats.fastAccepts}</p>
                <p className="text-xs text-muted-foreground">Fast Accepts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Badges Grid */}
        <div className="card-industrial p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Badges</p>
          <div className="grid grid-cols-3 gap-3">
            {BADGES.map((badge) => {
              const earned = stats.badges.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 transition-colors ${
                    earned
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border bg-muted/50 opacity-40'
                  }`}
                >
                  <span className="text-3xl mb-1">{badge.icon}</span>
                  <span className="text-xs font-semibold text-foreground text-center leading-tight">
                    {badge.name}
                  </span>
                  {!earned && (
                    <span className="text-[10px] text-muted-foreground text-center mt-1 leading-tight">
                      {badge.description}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
};

export default StatsScreen;
