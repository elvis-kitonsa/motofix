import { useEffect, useRef, useState } from 'react';
import { diagnosisService } from '@/config/api';

// Home-screen headline that ROTATES every 10–20 minutes and refreshes on each login.
// Starts from a local time-of-day pool (instant, offline-safe), then swaps to a fresh
// AI-generated batch from the diagnosis service. The effect runs once per mount, so a
// logout→login (fresh mount) always pulls new copy.

const POOLS: Record<string, string[]> = {
  latenight:    ['Car trouble this late?', 'Stuck after dark?', 'Help is one tap away,', 'Stranded tonight?'],
  earlymorning: ['Rough start this morning?', "Car won't cooperate?", 'Trouble before work?', 'Need a quick fix?'],
  morning:      ['Having a rough morning?', 'Car giving you trouble?', 'Stuck on the road?', 'Need a hand this morning?'],
  afternoon:    ['Having a rough afternoon?', 'Car acting up?', 'Stranded somewhere?', 'Need help right now?'],
  evening:      ['Having a rough evening?', 'Car trouble tonight?', 'Stuck after dark?', 'Help is one tap away,'],
};

function currentPeriod(): string {
  const h = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala', hour: 'numeric', hour12: false }), 10);
  if (h >= 22 || h < 5) return 'latenight';
  if (h < 9)  return 'earlymorning';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export function useRotatingGreeting(): string {
  const period = currentPeriod();
  const pool = POOLS[period] ?? POOLS.evening;
  const [msgs, setMsgs] = useState<string[]>(pool);
  const [idx, setIdx]   = useState(() => Math.floor(Math.random() * pool.length));
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;

  useEffect(() => {
    let alive = true;
    diagnosisService.greeting(period)
      .then((list) => {
        if (!alive || !list.length) return;
        setMsgs(list);
        setIdx(Math.floor(Math.random() * list.length));
      })
      .catch(() => {});

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const ms = (10 + Math.random() * 10) * 60_000; // 10–20 minutes
      timer = setTimeout(() => {
        setIdx((i) => (i + 1) % Math.max(1, msgsRef.current.length));
        tick();
      }, ms);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return msgs[idx % Math.max(1, msgs.length)] ?? '';
}
