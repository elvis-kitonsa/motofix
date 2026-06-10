import React from 'react';
import { loadStats } from '@/services/gamification';

interface StreakBadgeProps {
  className?: string;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({ className = '' }) => {
  const { streak } = loadStats();

  if (streak === 0) return null;

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded-full bg-accent/15 text-accent text-xs font-bold ${className}`}
      title={`${streak}-day streak`}
    >
      🔥 {streak}
    </div>
  );
};
