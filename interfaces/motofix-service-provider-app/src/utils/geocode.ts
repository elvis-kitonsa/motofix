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
        if (d.status === 'OK' && d.results?.[0]?.formatted_address) {
          const addr = shorten(d.results[0].formatted_address)
          _cache.set(key, addr)
          return addr
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
