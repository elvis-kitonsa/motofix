import { useEffect, useRef, useState } from 'react'
import { buildRouteMeta, pointAtDist, remainingPath, type LL, type RouteMeta } from '@/utils/routeFollow'
import { serverNow } from '@/utils/serverClock'

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic, time-based "mechanic on the way" simulation.
//
// We don't have real mechanic GPS, so instead of streaming jittery positions we
// derive everything from three values BOTH apps already share for a request:
//   • the driver's location (the request's pinned coordinates)
//   • the request id  (seeds a fixed, believable start point)
//   • en_route_at     (the moment the journey began)
//
// Because the inputs are identical on both sides, the driver app and the
// mechanic app independently compute the SAME shortest road route, the SAME pin
// position, and the SAME monotonically-decreasing ETA — no broadcast needed.
// The whole journey is compressed into SIM_MINUTES so a demo never drags on.
// ─────────────────────────────────────────────────────────────────────────────

export const SIM_MINUTES = 4              // total journey length (≤ 5 min for demos)
const SIM_MS = SIM_MINUTES * 60 * 1000

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// A fixed, believable start ~4–5 km from the driver. Seeded by the request id so
// every device computes the identical point (and therefore the identical route).
export function simMechStart(driver: LL, seed: string): LL {
  const h = hashSeed(seed || 'x')
  const angle = ((h % 360) * Math.PI) / 180
  const distKm = 4 + (h % 1000) / 1000        // 4.0 – 5.0 km
  const dLat = (distKm / 111) * Math.cos(angle)
  const dLng = (distKm / (111 * Math.cos((driver.lat * Math.PI) / 180))) * Math.sin(angle)
  return { lat: driver.lat + dLat, lng: driver.lng + dLng }
}

function parseTs(ts?: string | null): number {
  if (!ts) return Date.now()
  const t = new Date(/[Z+]/.test(ts) ? ts : ts + 'Z').getTime()
  return isNaN(t) ? Date.now() : t
}

export interface JobSim {
  ready: boolean
  routeMeta: RouteMeta | null
  start: LL | null
  mechPos: LL | null
  remaining: LL[] | null
  progress: number          // 0 → 1
  etaMinutes: number | null // monotonically decreasing
  distanceKm: number | null
}

export function useJobSim(opts: {
  isLoaded: boolean
  active: boolean                 // status === 'en_route'
  driver: LL | null               // the request's pinned location (canonical on both apps)
  seed: string                    // request id
  enRouteAt?: string | null
}): JobSim {
  const { isLoaded, active, driver, seed, enRouteAt } = opts

  const metaRef = useRef<RouteMeta | null>(null)
  const startRef = useRef<LL | null>(null)
  const reqRef = useRef(false)
  const seedRef = useRef('')
  const [, setTick] = useState(0)

  // New job → discard the old fixed route so it's rebuilt for this request.
  useEffect(() => {
    if (seed !== seedRef.current) {
      seedRef.current = seed
      reqRef.current = false
      metaRef.current = null
      startRef.current = null
      setTick(x => x + 1)
    }
  }, [seed])

  // Fetch the fixed shortest road route ONCE, from the deterministic start to
  // the driver. It does not change as the pin advances.
  useEffect(() => {
    if (!isLoaded || !active || !driver || reqRef.current) return
    reqRef.current = true
    const start = simMechStart(driver, seed)
    startRef.current = start
    const g = (window as any).google?.maps
    if (!g) { reqRef.current = false; return }

    const fallback = () => {
      metaRef.current = buildRouteMeta([start, driver])
      setTick(x => x + 1)
    }
    try {
      new g.DirectionsService().route(
        { origin: start, destination: driver, travelMode: g.TravelMode.DRIVING, provideRouteAlternatives: true },
        (result: google.maps.DirectionsResult | null, status: string) => {
          if (status === 'OK' && result?.routes?.length) {
            let best = 0, bestM = Infinity
            result.routes.forEach((r, i) => {
              const m = r.legs.reduce((s, leg) => s + (leg.distance?.value ?? 0), 0)
              if (m < bestM) { bestM = m; best = i }
            })
            const path: LL[] = (result.routes[best]?.overview_path ?? []).map(
              (p: google.maps.LatLng) => ({ lat: p.lat(), lng: p.lng() }),
            )
            metaRef.current = path.length >= 2 ? buildRouteMeta(path) : buildRouteMeta([start, driver])
            setTick(x => x + 1)
          } else {
            fallback()
          }
        },
      )
    } catch {
      fallback()
    }
  }, [isLoaded, active, driver, seed])

  // Animation clock — re-render a few times a second while the journey is live.
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setTick(x => x + 1), 400)
    return () => clearInterval(t)
  }, [active])

  const meta = metaRef.current
  // serverNow() (not the device clock) so every device shows the same point.
  const progress = active
    ? Math.max(0, Math.min(1, (serverNow() - parseTs(enRouteAt)) / SIM_MS))
    : 0

  let mechPos: LL | null = null
  let remaining: LL[] | null = null
  let distanceKm: number | null = null
  if (meta && meta.total > 0) {
    const dist = progress * meta.total
    mechPos = pointAtDist(meta, dist)
    remaining = remainingPath(meta, dist)
    distanceKm = meta.total * (1 - progress)
  }
  const etaMinutes = meta ? Math.max(0, Math.ceil((1 - progress) * SIM_MINUTES)) : null

  return {
    ready: !!meta,
    routeMeta: meta,
    start: startRef.current,
    mechPos,
    remaining,
    progress,
    etaMinutes,
    distanceKm,
  }
}
