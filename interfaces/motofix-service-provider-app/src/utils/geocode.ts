import { useEffect, useState } from 'react'

// Shared driver-location resolver for the mechanic app. Turns coordinates into a
// readable place name and — importantly — NEVER shows raw "lat,lng" to the
// mechanic. Results are cached (and in-flight calls de-duplicated) so rendering
// a whole list of job cards doesn't hammer the geocoder.

const _cache = new Map<string, string>()
const _inflight = new Map<string, Promise<string>>()

const FALLBACK = "Driver's pinned location"

export function parseCoords(s?: string | null): [number, number] | null {
  if (!s) return null
  const parts = s.split(',')
  if (parts.length !== 2) return null
  const lat = parseFloat(parts[0].trim())
  const lng = parseFloat(parts[1].trim())
  if (isNaN(lat) || isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lat, lng]
}

// A stored "address" that is really just "lat,lng" should never be shown verbatim.
export function isCoordLike(s?: string | null): boolean {
  return parseCoords(s) !== null
}

function shorten(addr: string): string {
  // Keep the first few comma-parts — enough to be recognisable, not a full essay.
  return addr.split(',').slice(0, 3).join(',').trim()
}

// ── Human-readable label from Google address components (mirrors the driver app) ──
// Building the label from components (route/premise/area) — rather than taking
// results[0].formatted_address — means we NEVER surface a Google Plus Code like
// "9H37+H92" when a coordinate has no exact street address.
type GComp = { long_name: string; types: string[] }
type GResult = { address_components?: GComp[]; formatted_address?: string }

function getComp(components: GComp[], type: string): string | null {
  return components.find((c) => c.types.includes(type))?.long_name ?? null
}

// Reject Google Plus Codes (e.g. "9H37+H92", "QH7V+2X Kampala") so they're never shown.
function isPlusCode(s?: string | null): boolean {
  return !!s && /[A-Z0-9]{4,}\+[A-Z0-9]{2,}/i.test(s)
}

function buildLabelFromResults(results: GResult[]): string | null {
  let premise: string | null = null, route: string | null = null
  let sub2: string | null = null, neighborhood: string | null = null
  let sub1: string | null = null, locality: string | null = null
  for (const res of results) {
    const c = res.address_components ?? []
    premise      = premise      || getComp(c, 'premise')
    route        = route        || getComp(c, 'route')
    sub2         = sub2         || getComp(c, 'sublocality_level_2')
    neighborhood = neighborhood || getComp(c, 'neighborhood')
    sub1         = sub1         || getComp(c, 'sublocality_level_1')
    locality     = locality     || getComp(c, 'locality')
  }
  const area = sub2 || neighborhood || sub1 || locality
  if (premise && route)     return `${premise}, ${route}`
  if (premise && area)      return `${premise}, ${area}`
  if (premise)              return premise
  if (route && area)        return `${route}, ${area}`
  if (route)                return route
  if (area)                 return area
  // Last resort: a formatted_address that is NOT a plus code and has no phone digits.
  const clean = results.find(r => r.formatted_address && !isPlusCode(r.formatted_address) && !/\d{8,}/.test(r.formatted_address))
  const fa = (clean ?? results[0])?.formatted_address
  if (fa && !isPlusCode(fa)) return shorten(fa)
  return null
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
  const cached = _cache.get(key)
  if (cached) return cached
  const flight = _inflight.get(key)
  if (flight) return flight

  const task = (async (): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    // Primary: Google (higher rate limits with a key — fine for job lists).
    if (apiKey) {
      try {
        const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
        const d = await r.json()
        if (d.status === 'OK' && Array.isArray(d.results) && d.results.length) {
          // Build from address components so a Plus Code is never shown.
          const addr = buildLabelFromResults(d.results as GResult[])
          if (addr) { _cache.set(key, addr); return addr }
        }
      } catch { /* fall through to OSM */ }
    }
    // Fallback: OpenStreetMap / Nominatim.
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'User-Agent': 'MOTOFIX-ServiceProvider/1.0' } },
      )
      const d = await r.json()
      if (d?.display_name) {
        const addr = shorten(d.display_name)
        _cache.set(key, addr)
        return addr
      }
    } catch { /* ignore */ }
    // Never expose raw coordinates — a friendly label is better than numbers.
    return FALLBACK
  })()

  _inflight.set(key, task)
  try {
    return await task
  } finally {
    _inflight.delete(key)
  }
}

interface LocatableRequest {
  id?: string | number
  location_address?: string | null
  location?: string | null
  location_lat?: number | null
  location_lng?: number | null
}

function initialText(req: LocatableRequest): string {
  if (req.location_address && !isCoordLike(req.location_address)) return req.location_address
  if ((req.location_lat != null && req.location_lng != null) || isCoordLike(req.location)) return 'Locating…'
  return req.location ?? 'Location unavailable'
}

// React hook: returns a readable place name for a request's driver location,
// resolving coordinates in the background. Shows "Locating…" until ready.
export function useReadableLocation(req: LocatableRequest): string {
  const [text, setText] = useState<string>(() => initialText(req))

  useEffect(() => {
    let cancelled = false
    const set = (s: string) => { if (!cancelled) setText(s) }

    if (req.location_address && !isCoordLike(req.location_address)) {
      set(req.location_address)
    } else if (req.location_lat != null && req.location_lng != null) {
      reverseGeocode(req.location_lat, req.location_lng).then(set)
    } else {
      const coords = parseCoords(req.location)
      if (coords) reverseGeocode(coords[0], coords[1]).then(set)
      else set(req.location ?? 'Location unavailable')
    }
    return () => { cancelled = true }
  }, [req.id, req.location_address, req.location, req.location_lat, req.location_lng])

  return text
}
