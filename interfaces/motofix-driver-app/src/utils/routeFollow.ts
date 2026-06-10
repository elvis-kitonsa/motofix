// Route-following helpers shared by the driver and mechanic maps so both show the
// SAME thing: the mechanic pin is snapped onto the fixed road route (never jumps
// off), and the drawn route shrinks to just the remaining road as the mechanic
// advances toward the driver.
//
// Keep this file identical in both apps.

export type LL = { lat: number; lng: number }

export type RouteMeta = {
  path: LL[]      // road polyline, mechanic-start → driver
  cum: number[]   // cumulative km at each vertex
  total: number   // total route length in km
}

function segKm(a: LL, b: LL): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function buildRouteMeta(path: LL[]): RouteMeta | null {
  if (!path || path.length < 2) return null
  const cum = [0]
  for (let i = 1; i < path.length; i++) cum[i] = cum[i - 1] + segKm(path[i - 1], path[i])
  return { path, cum, total: cum[cum.length - 1] }
}

// Distance (km) from the route start to the given fraction's point.
export function pointAtDist(meta: RouteMeta, distKm: number): LL {
  const target = Math.max(0, Math.min(meta.total, distKm))
  let i = 1
  while (i < meta.cum.length && meta.cum[i] < target) i++
  if (i >= meta.path.length) return meta.path[meta.path.length - 1]
  const segA = meta.cum[i - 1]
  const segB = meta.cum[i]
  const t = segB > segA ? (target - segA) / (segB - segA) : 0
  const a = meta.path[i - 1]
  const b = meta.path[i]
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
}

// Project a raw GPS point onto the route polyline (nearest point on the nearest
// segment) and return that on-road point plus how far along the route it sits.
// Uses a local equirectangular approximation — accurate at city scale.
export function projectToRoute(meta: RouteMeta, raw: LL): { point: LL; dist: number } {
  const mPerDegLat = 111320
  const mPerDegLng = 111320 * Math.cos((raw.lat * Math.PI) / 180)
  const toXY = (p: LL) => ({ x: p.lng * mPerDegLng, y: p.lat * mPerDegLat })
  const r = toXY(raw)

  let bestD2 = Infinity
  let bestPoint = meta.path[0]
  let bestDist = 0

  for (let i = 1; i < meta.path.length; i++) {
    const a = toXY(meta.path[i - 1])
    const b = toXY(meta.path[i])
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby
    let t = len2 > 0 ? ((r.x - a.x) * abx + (r.y - a.y) * aby) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    const px = a.x + abx * t
    const py = a.y + aby * t
    const dx = r.x - px
    const dy = r.y - py
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      bestPoint = {
        lat: meta.path[i - 1].lat + (meta.path[i].lat - meta.path[i - 1].lat) * t,
        lng: meta.path[i - 1].lng + (meta.path[i].lng - meta.path[i - 1].lng) * t,
      }
      bestDist = meta.cum[i - 1] + (meta.cum[i] - meta.cum[i - 1]) * t
    }
  }
  return { point: bestPoint, dist: bestDist }
}

// The remaining road from `distKm` along the route to the end (driver) — starts
// exactly at the snapped point so the line visibly shrinks as the mechanic moves.
export function remainingPath(meta: RouteMeta, distKm: number): LL[] {
  const target = Math.max(0, Math.min(meta.total, distKm))
  let i = 1
  while (i < meta.cum.length && meta.cum[i] < target) i++
  const head = pointAtDist(meta, target)
  return [head, ...meta.path.slice(i)]
}
