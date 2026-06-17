import { useEffect, useRef, useState } from 'react'
import { greetingService } from '@/config/api'

// Home-screen headline that ROTATES every 10–20 minutes and refreshes on each login.
// It starts from a local time-of-day pool (instant, offline-safe), then swaps to a
// fresh AI-generated batch from the diagnosis service when it arrives. Because the
// effect runs once per mount, a logout→login (fresh mount) always pulls new copy.

const POOLS: Record<string, string[]> = {
  latenight:    ['Beat the competition tonight,', 'Night shifts pay the most,', 'Stranded drivers need you now,', 'Catch a late-night hustle,'],
  earlymorning: ['Pick up an early request,', 'Rise and claim those jobs,', 'Early birds earn the most,', 'Beat the morning rush,'],
  morning:      ['Morning jobs are rolling in,', "Catch the day's best jobs,", 'Cars need fixing this morning,', 'Make the most of your morning,'],
  afternoon:    ['Afternoon hustle mode on,', 'Midday jobs are waiting,', 'Keep the grind going,', 'Peak hours are starting,'],
  evening:      ['Evening rush is starting,', 'Best hours to be online,', 'Catch the evening wave,', "Breakdowns don't stop at night,"],
}

function currentPeriod(): string {
  const h = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala', hour: 'numeric', hour12: false }), 10)
  if (h >= 22 || h < 5) return 'latenight'
  if (h < 9)  return 'earlymorning'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export function useRotatingGreeting(): string {
  const period = currentPeriod()
  const pool = POOLS[period] ?? POOLS.evening
  const [msgs, setMsgs] = useState<string[]>(pool)
  const [idx, setIdx]   = useState(() => Math.floor(Math.random() * pool.length))
  const msgsRef = useRef(msgs)
  msgsRef.current = msgs

  useEffect(() => {
    let alive = true
    greetingService.get('mechanic', period)
      .then((list) => {
        if (!alive || !list.length) return
        setMsgs(list)
        setIdx(Math.floor(Math.random() * list.length))
      })
      .catch(() => {})

    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const ms = (10 + Math.random() * 10) * 60_000 // 10–20 minutes
      timer = setTimeout(() => {
        setIdx((i) => (i + 1) % Math.max(1, msgsRef.current.length))
        tick()
      }, ms)
    }
    tick()
    return () => { alive = false; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return msgs[idx % Math.max(1, msgs.length)] ?? ''
}
