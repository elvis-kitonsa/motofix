// utils/geocode.ts — turns GPS coordinates into a readable address ("reverse geocoding"),
// using Google Maps in the browser. Results are cached in memory (per page load) so we
// don't look up the same spot repeatedly. waitForGoogle() handles the case where the
// Google Maps script hasn't finished loading yet, giving up after a short timeout.

// Cleared on every page load — prevents stale cached junk addresses surviving across sessions
const geocodeCache = new Map<string, string | null>();

function coordCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

function waitForGoogle(timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.google?.maps?.Geocoder) { resolve(true); return; }
    const start = Date.now();
    const poll = setInterval(() => {
      if (window.google?.maps?.Geocoder) { clearInterval(poll); resolve(true); }
      else if (Date.now() - start >= timeoutMs) { clearInterval(poll); resolve(false); }
    }, 100);
  });
}

function getComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
): string | null {
  return components.find((c) => c.types.includes(type))?.long_name ?? null;
}

/**
 * Reverse geocode using the Google Maps Geocoding API.
 * Requires the Geocoding API to be enabled in Google Cloud Console
 * (same project as the Maps JS API key).
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const key = coordCacheKey(lat, lon);
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;

  const ready = await waitForGoogle(8000);
  if (!ready) { geocodeCache.set(key, null); return null; }

  return new Promise((resolve) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng: lon } }, (results, status) => {
      if (status !== 'OK' || !results || results.length === 0) {
        geocodeCache.set(key, null);
        resolve(null);
        return;
      }

      // Scan ALL results (Google returns most→least specific) to collect the
      // most granular component available for each type across every result.
      let premise: string | null = null;
      let route: string | null = null;
      let sub2: string | null = null;
      let neighborhood: string | null = null;
      let sub1: string | null = null;
      let locality: string | null = null;

      for (const result of results) {
        const c = result.address_components;
        premise      = premise      || getComponent(c, 'premise');   // no 'establishment' — business names can contain phone numbers
        route        = route        || getComponent(c, 'route');
        sub2         = sub2         || getComponent(c, 'sublocality_level_2');
        neighborhood = neighborhood || getComponent(c, 'neighborhood');
        sub1         = sub1         || getComponent(c, 'sublocality_level_1');
        locality     = locality     || getComponent(c, 'locality');
      }

      // Prefer the most specific area — sub2 (e.g. "Kawempe") over
      // sub1 (e.g. "Kawempe Division") over locality (e.g. "Kampala")
      const area = sub2 || neighborhood || sub1 || locality;

      let label: string | null = null;
      if (premise && route)     label = `${premise}, ${route}`;
      else if (premise && area) label = `${premise}, ${area}`;
      else if (premise)         label = premise;
      else if (route && area)   label = `${route}, ${area}`;
      else if (route)           label = route;
      else if (area)            label = area;
      else {
        // Fall back to formatted_address but skip any result with embedded phone numbers
        const clean = results.find(r => !/\d{8,}/.test(r.formatted_address ?? ''));
        label = (clean ?? results[0]).formatted_address?.split(',').slice(0, 2).join(',').trim() ?? null;
      }

      geocodeCache.set(key, label);
      resolve(label);
    });
  });
}

export function isCoordString(location: string): boolean {
  if (!location || typeof location !== 'string') return false;
  const parts = location.trim().split(',').map((p) => p.trim());
  if (parts.length !== 2) return false;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}

export function parseCoordString(location: string): { lat: number; lng: number } | null {
  if (!isCoordString(location)) return null;
  const parts = location.trim().split(',').map((p) => p.trim());
  return { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
}
