// Home-screen headline for the driver app. Curated, time-of-day aware copy that is
// picked ONCE per login and then stays fixed for the whole session — it only changes
// on the next login (login() clears the stored pick). Driver lines are warm, short
// questions reminding them help is one tap away (the first name is shown beneath).

import { useState } from 'react';

const POOLS: Record<string, string[]> = {
  latenight:    ['Car trouble this late?', 'Stuck after dark?', 'Stranded tonight?', 'Need help right now?'],
  earlymorning: ['Rough start this morning?', "Car won't cooperate?", 'Trouble before work?', 'Need a quick fix?'],
  morning:      ['Having a rough morning?', 'Car giving you trouble?', 'Stuck on the road?', 'Need a hand this morning?'],
  afternoon:    ['Having a rough afternoon?', 'Car acting up?', 'Stranded somewhere?', 'Need help right now?'],
  evening:      ['Having a rough evening?', 'Car trouble tonight?', 'Stuck after dark?', 'Need help tonight?'],
};

export const DRIVER_GREETING_KEY = 'motofix_driver_greeting';

function currentPeriod(): string {
  const h = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala', hour: 'numeric', hour12: false }), 10);
  if (h >= 22 || h < 5) return 'latenight';
  if (h < 9)  return 'earlymorning';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function pick(): string {
  try {
    const saved = sessionStorage.getItem(DRIVER_GREETING_KEY);
    if (saved) return saved;
  } catch { /* ignore */ }
  const pool = POOLS[currentPeriod()] ?? POOLS.evening;
  const text = pool[Math.floor(Math.random() * pool.length)];
  try { sessionStorage.setItem(DRIVER_GREETING_KEY, text); } catch { /* ignore */ }
  return text;
}

export function useRotatingGreeting(): string {
  const [text] = useState(() => pick());
  return text;
}
