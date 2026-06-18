// Home-screen headline. Curated, time-of-day + provider-type aware copy that is
// picked ONCE per login and then stays fixed for the whole session — it only
// changes on the next login (login() clears the stored pick). Each line is built
// to read naturally with the provider's FIRST NAME appended right after, so every
// line ends with a comma (e.g. "Evening rush is starting, BBOSA.").

import { useEffect, useState } from 'react'

export type GreetingAudience = 'mechanic' | 'towing'

const POOLS: Record<GreetingAudience, Record<string, string[]>> = {
  mechanic: {
    latenight:    ['Night jobs pay the best,', 'Stranded drivers need you,', 'Beat the competition tonight,', 'A late hustle awaits,'],
    earlymorning: ['Start earning early,', 'Claim the first jobs,', 'Beat the morning rush,', 'Early repairs, easy money,'],
    morning:      ['Repair jobs are rolling in,', 'Make the most of your morning,', 'Cars need fixing today,', "Catch the day's best jobs,"],
    afternoon:    ['Midday jobs are waiting,', 'Keep the wrenches turning,', 'Peak repair hours ahead,', 'Stay online, stay earning,'],
    evening:      ['Evening breakdowns are common,', 'Best hours to be online,', 'Catch the evening rush,', "Breakdowns don't stop at night,"],
  },
  towing: {
    latenight:    ['Night recoveries pay well,', 'Stranded drivers need a tow,', 'Beat the competition tonight,', 'A late-night tow awaits,'],
    earlymorning: ['Start towing early,', 'Claim the first recoveries,', 'Beat the morning rush,', 'Early tows, steady pay,'],
    morning:      ['Recovery jobs are rolling in,', 'Make the most of your morning,', 'Drivers need a tow today,', "Catch the day's best jobs,"],
    afternoon:    ['Midday recoveries are waiting,', 'Keep the truck rolling,', 'Peak towing hours ahead,', 'Stay online, stay earning,'],
    evening:      ['Evening breakdowns need a tow,', 'Best hours to be online,', 'Catch the evening rush,', "Recoveries don't stop at night,"],
  },
}

export const SP_GREETING_KEY = 'motofix_sp_greeting'

function currentPeriod(): string {
  const h = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala', hour: 'numeric', hour12: false }), 10)
  if (h >= 22 || h < 5) return 'latenight'
  if (h < 9)  return 'earlymorning'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function pick(audience: GreetingAudience): string {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SP_GREETING_KEY) || 'null')
    if (saved && saved.audience === audience && saved.text) return saved.text
  } catch { /* ignore */ }
  const pool = POOLS[audience][currentPeriod()] ?? POOLS[audience].evening
  const text = pool[Math.floor(Math.random() * pool.length)]
  try { sessionStorage.setItem(SP_GREETING_KEY, JSON.stringify({ audience, text })) } catch { /* ignore */ }
  return text
}

export function useRotatingGreeting(audience: GreetingAudience = 'mechanic'): string {
  const [text, setText] = useState(() => pick(audience))
  // The very first paint may happen before the profile (and provider_type) loads,
  // so re-pick once if the stored greeting was chosen for the wrong audience. After
  // that it stays fixed until the next login.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SP_GREETING_KEY) || 'null')
      if (!saved || saved.audience !== audience) setText(pick(audience))
    } catch { setText(pick(audience)) }
  }, [audience])
  return text
}
