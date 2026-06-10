import type { GamificationStats, XPBreakdown } from '@/types/gamification';
import {
  LEVELS,
  BADGES,
  XP_BASE,
  XP_SPEED_BONUS,
  XP_STREAK_BONUS,
  SPEED_ACCEPT_SECS,
  FAST_BADGE_SECS,
} from '@/types/gamification';

const STORAGE_KEY = 'motofix_gamification';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function defaultStats(): GamificationStats {
  return {
    xp: 0,
    level: 1,
    levelTitle: 'Apprentice',
    streak: 0,
    bestStreak: 0,
    totalJobs: 0,
    fastAccepts: 0,
    badges: [],
    dailyCounts: {},
    lastJobDate: null,
  };
}

// ─── Public read ──────────────────────────────────────────────────────────────

export function loadStats(): GamificationStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultStats(), ...JSON.parse(raw) } : defaultStats();
  } catch {
    return defaultStats();
  }
}

// ─── Level helpers ────────────────────────────────────────────────────────────

function levelFromXP(xp: number): { level: number; title: string } {
  let cur = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.xpRequired) cur = l;
  }
  return { level: cur.level, title: cur.title };
}

export function getLevelInfo(xp: number) {
  const cur = levelFromXP(xp);
  const curEntry = LEVELS.find((l) => l.level === cur.level)!;
  const nextEntry = LEVELS.find((l) => l.level === cur.level + 1);
  const xpInLevel = xp - curEntry.xpRequired;
  const xpForNextLevel = nextEntry ? nextEntry.xpRequired - curEntry.xpRequired : null;
  return {
    level: cur.level,
    title: cur.title,
    xpInLevel,
    xpForNextLevel,
    progress: xpForNextLevel ? xpInLevel / xpForNextLevel : 1,
    nextTitle: nextEntry?.title ?? null,
  };
}

// ─── Badge checks ─────────────────────────────────────────────────────────────

function checkNewBadges(stats: GamificationStats): string[] {
  const earned = new Set(stats.badges);
  const earned_new: string[] = [];
  const today = todayStr();

  const check = (id: string, cond: boolean) => {
    if (!earned.has(id) && cond) earned_new.push(id);
  };

  check('first_fix',   stats.totalJobs >= 1);
  check('speed_demon', stats.fastAccepts >= 1);
  check('hat_trick',   (stats.dailyCounts[today] ?? 0) >= 3);
  check('iron_streak', stats.streak >= 7);
  check('veteran',     stats.totalJobs >= 50);
  check('century',     stats.totalJobs >= 100);

  return earned_new;
}

// ─── Main: award XP after a completed job ─────────────────────────────────────

/**
 * Call this once per completed job.
 * @param acceptedAt  epoch ms when the mechanic tapped "Accept", or null if unknown.
 * @returns XPBreakdown for the completion screen to display.
 */
export function addJobXP(acceptedAt: number | null): XPBreakdown {
  const stats = loadStats();
  const today = todayStr();
  const yesterday = yesterdayStr();

  // Speed bonus: accepted the job within SPEED_ACCEPT_SECS
  const elapsedSec = acceptedAt != null ? (Date.now() - acceptedAt) / 1000 : Infinity;
  const isSpeedBonus = elapsedSec <= SPEED_ACCEPT_SECS;
  // Badge threshold is stricter (5 s)
  const isFastBadge = elapsedSec <= FAST_BADGE_SECS;

  // Streak calculation
  let newStreak: number;
  if (stats.lastJobDate === today) {
    newStreak = stats.streak; // already got credit today
  } else if (stats.lastJobDate === yesterday) {
    newStreak = stats.streak + 1; // extending streak
  } else {
    newStreak = 1; // reset
  }

  const isStreakBonus = newStreak >= 3;

  // XP
  const base = XP_BASE;
  const speedBonus = isSpeedBonus ? XP_SPEED_BONUS : 0;
  const streakBonus = isStreakBonus ? XP_STREAK_BONUS : 0;
  const gained = base + speedBonus + streakBonus;

  const levelBefore = stats.level;
  const newXP = stats.xp + gained;
  const { level: levelAfter, title: levelTitle } = levelFromXP(newXP);

  const dailyCounts = {
    ...stats.dailyCounts,
    [today]: (stats.dailyCounts[today] ?? 0) + 1,
  };

  const updated: GamificationStats = {
    ...stats,
    xp: newXP,
    level: levelAfter,
    levelTitle,
    streak: newStreak,
    bestStreak: Math.max(stats.bestStreak, newStreak),
    totalJobs: stats.totalJobs + 1,
    fastAccepts: isFastBadge ? stats.fastAccepts + 1 : stats.fastAccepts,
    dailyCounts,
    lastJobDate: today,
    badges: [...stats.badges],
  };

  const newBadges = checkNewBadges(updated);
  updated.badges = [...updated.badges, ...newBadges];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}

  return { base, speedBonus, streakBonus, total: gained, levelBefore, levelAfter, newBadges };
}

// ─── Badge metadata lookup ────────────────────────────────────────────────────

export function getBadge(id: string) {
  return BADGES.find((b) => b.id === id);
}

export { BADGES, LEVELS };
