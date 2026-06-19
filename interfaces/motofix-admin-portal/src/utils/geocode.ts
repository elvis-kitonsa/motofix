// Turns stored "lat,lng" location strings into readable place names for the admin
// portal — admins should never see raw coordinates. Results are cached and in-flight
// calls de-duplicated so a whole table doesn't hammer the geocoder. Mirrors the
// driver/mechanic apps' resolver (Google REST with key, OpenStreetMap fallback).

const _cache = new Map<string, string>();
const _inflight = new Map<string, Promise<string>>();

const FALLBACK = 'Pinned location';

export function parseCoords(s?: string | null): [number, number] | null {
  if (!s) return null;
  const parts = s.split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

export function isCoordLike(s?: string | null): boolean {
  return parseCoords(s) !== null;
}

function shorten(addr: string): string {
  return addr.split(',').slice(0, 3).join(',').trim();
}

type GComp = { long_name: string; types: string[] };
type GResult = { address_components?: GComp[]; formatted_address?: string };

function getComp(components: GComp[], type: string): string | null {
  return components.find((c) => c.types.includes(type))?.long_name ?? null;
}

function isPlusCode(s?: string | null): boolean {
  return !!s && /[A-Z0-9]{4,}\+[A-Z0-9]{2,}/i.test(s);
}

function buildLabelFromResults(results: GResult[]): string | null {
  let premise: string | null = null, route: string | null = null;
  let sub2: string | null = null, neighborhood: string | null = null;
  let sub1: string | null = null, locality: string | null = null;
  for (const res of results) {
    const c = res.address_components ?? [];
    premise      = premise      || getComp(c, 'premise');
    route        = route        || getComp(c, 'route');
    sub2         = sub2         || getComp(c, 'sublocality_level_2');
    neighborhood = neighborhood || getComp(c, 'neighborhood');
    sub1         = sub1         || getComp(c, 'sublocality_level_1');
    locality     = locality     || getComp(c, 'locality');
  }
  const area = sub2 || neighborhood || sub1 || locality;
  if (premise && route)  return `${premise}, ${route}`;
  if (premise && area)   return `${premise}, ${area}`;
  if (premise)           return premise;
  if (route && area)     return `${route}, ${area}`;
  if (route)             return route;
  if (area)              return area;
  const clean = results.find(r => r.formatted_address && !isPlusCode(r.formatted_address) && !/\d{8,}/.test(r.formatted_address));
  const fa = (clean ?? results[0])?.formatted_address;
  if (fa && !isPlusCode(fa)) return shorten(fa);
  return null;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = _cache.get(key);
  if (cached) return cached;
  const flight = _inflight.get(key);
  if (flight) return flight;

  const task = (async (): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      try {
        const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
        const d = await r.json();
        if (d.status === 'OK' && Array.isArray(d.results) && d.results.length) {
          const addr = buildLabelFromResults(d.results as GResult[]);
          if (addr) { _cache.set(key, addr); return addr; }
        }
      } catch { /* fall through to OSM */ }
    }
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'User-Agent': 'MOTOFIX-Admin/1.0' } },
      );
      const d = await r.json();
      if (d?.display_name) {
        const addr = shorten(d.display_name);
        _cache.set(key, addr);
        return addr;
      }
    } catch { /* ignore */ }
    return FALLBACK;
  })();

  _inflight.set(key, task);
  try {
    return await task;
  } finally {
    _inflight.delete(key);
  }
}
