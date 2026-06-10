import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Car, MapPin, Clock, Home, Zap, Star } from 'lucide-react';
import type { Job } from '@/types/mechanic';
import type { XPBreakdown } from '@/types/gamification';
import { BADGES } from '@/types/gamification';
import { LevelUpModal } from '@/components/LevelUpModal';
import { loadStats } from '@/services/gamification';

interface CompletionState {
  job: Job;
  completedAt: string;
  xpBreakdown?: XPBreakdown | null;
}

const CompletionScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as CompletionState | null;
  const [showLevelUp, setShowLevelUp] = useState(false);

  useEffect(() => {
    if (!state?.job) {
      navigate('/', { replace: true });
      return;
    }
    // Show level-up modal if the mechanic just leveled up
    if (state.xpBreakdown && state.xpBreakdown.levelAfter > state.xpBreakdown.levelBefore) {
      setShowLevelUp(true);
    }
  }, [state, navigate]);

  if (!state?.job) return null;

  const { job, completedAt, xpBreakdown } = state;
  const stats = loadStats();

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top safe-area-bottom">
      {/* Level-up modal */}
      {showLevelUp && xpBreakdown && (
        <LevelUpModal
          level={xpBreakdown.levelAfter}
          title={stats.levelTitle}
          onDismiss={() => setShowLevelUp(false)}
        />
      )}

      {/* Success Header */}
      <div className="bg-success px-4 py-8 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">Job Complete!</h1>
        <p className="text-white/80 mt-1 text-sm">Great work — the customer has been helped.</p>
      </div>

      <main className="flex-1 p-4 space-y-3">

        {/* XP Earned Card */}
        {xpBreakdown && (
          <div className="card-industrial p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-warning" />
              <p className="text-sm font-semibold text-foreground">XP Earned</p>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-foreground">
                <span>Base XP</span>
                <span className="font-semibold">+{xpBreakdown.base}</span>
              </div>
              {xpBreakdown.speedBonus > 0 && (
                <div className="flex justify-between text-warning">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Speed bonus
                  </span>
                  <span className="font-semibold">+{xpBreakdown.speedBonus}</span>
                </div>
              )}
              {xpBreakdown.streakBonus > 0 && (
                <div className="flex justify-between text-accent">
                  <span>🔥 Streak bonus</span>
                  <span className="font-semibold">+{xpBreakdown.streakBonus}</span>
                </div>
              )}
              <div className="border-t border-border pt-1.5 flex justify-between font-bold text-primary">
                <span>Total</span>
                <span>+{xpBreakdown.total} XP</span>
              </div>
            </div>

            {/* New badges */}
            {xpBreakdown.newBadges.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">New Badges!</p>
                <div className="flex gap-2 flex-wrap">
                  {xpBreakdown.newBadges.map((id) => {
                    const badge = BADGES.find((b) => b.id === id);
                    return badge ? (
                      <div key={id} className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full text-xs font-semibold text-primary">
                        <span>{badge.icon}</span>
                        {badge.name}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Job Summary */}
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Summary
        </h2>

        <div className="card-industrial p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Car className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Vehicle</p>
              <p className="font-semibold text-foreground">{job.vehicle_type}</p>
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium text-foreground">{job.customer_location}</p>
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Completed at</p>
              <p className="font-medium text-foreground">{formatTime(completedAt)}</p>
            </div>
          </div>
        </div>

        <div className="card-industrial p-4">
          <p className="text-xs text-muted-foreground mb-1">Problem</p>
          <p className="text-foreground leading-relaxed">{job.problem_description}</p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="w-full btn-touch bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 mt-4"
        >
          <Home className="w-5 h-5" />
          Back to Home
        </button>
      </main>
    </div>
  );
};

export default CompletionScreen;
