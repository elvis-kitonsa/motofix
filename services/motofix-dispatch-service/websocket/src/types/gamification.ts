// ─── Levels ───────────────────────────────────────────────────────────────────

export interface Level {
  level: number;
  title: string;
  xpRequired: number;
}

export const LEVELS: Level[] = [
  { level: 1, title: 'Apprentice',       xpRequired: 0    },
  { level: 2, title: 'Journeyman',       xpRequired: 500  },
  { level: 3, title: 'Expert',           xpRequired: 1500 },
  { level: 4, title: 'Master Mechanic',  xpRequired: 3500 },
  { level: 5, title: 'Legend',           xpRequired: 7000 },
];

// ─── XP rules ─────────────────────────────────────────────────────────────────

export const XP_BASE = 100;
export const XP_SPEED_BONUS = 25;   // accept within 10 s
export const XP_STREAK_BONUS = 50;  // on a 3+ day streak
export const SPEED_ACCEPT_SECS = 10;
export const FAST_BADGE_SECS = 5;   // stricter threshold for Speed Demon badge

// ─── Badges ───────────────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
}

export const BADGES: Badge[] = [
  { id: 'first_fix',   name: 'First Fix',    description: 'Complete your first job',        icon: '🔧' },
  { id: 'speed_demon', name: 'Speed Demon',  description: 'Accept a job within 5 seconds',  icon: '⚡' },
  { id: 'hat_trick',   name: 'Hat Trick',    description: 'Complete 3 jobs in one day',     icon: '🎩' },
  { id: 'iron_streak', name: 'Iron Streak',  description: 'Maintain a 7-day streak',        icon: '🔥' },
  { id: 'veteran',     name: 'Veteran',      description: 'Complete 50 jobs',               icon: '🏆' },
  { id: 'century',     name: 'Century',      description: 'Complete 100 jobs',              icon: '💯' },
];

// ─── Persisted state ──────────────────────────────────────────────────────────

export interface GamificationStats {
  xp: number;
  level: number;
  levelTitle: string;
  streak: number;
  bestStreak: number;
  totalJobs: number;
  fastAccepts: number;        // jobs accepted within FAST_BADGE_SECS
  badges: string[];           // array of earned badge IDs
  dailyCounts: Record<string, number>; // 'YYYY-MM-DD' → count
  lastJobDate: string | null; // 'YYYY-MM-DD'
}

// ─── XP result (returned after completing a job) ──────────────────────────────

export interface XPBreakdown {
  base: number;
  speedBonus: number;
  streakBonus: number;
  total: number;
  levelBefore: number;
  levelAfter: number;
  newBadges: string[];
}
