// ─────────────────────────────────────────────────────────────────────────────
//  Fuel-station presentation layer
//
//  Real stations come from the backend (OpenStreetMap / Overpass). They carry a
//  name, brand, coordinates and address but no artwork, prices or amenities.
//  `enrichStation` layers on brand colours, generated forecourt artwork, typical
//  UGX pump prices and amenities so each real station reads like a proper
//  listing. `generateSimStations` is a last-resort fallback that fabricates a
//  believable set around the driver if the backend returns nothing at all.
// ─────────────────────────────────────────────────────────────────────────────

import type { NearbyStation } from '@/config/api'

export interface StationService { icon: string; label: string }

export interface SimStation extends NearbyStation {
  brand: string
  color: string          // primary brand colour
  color2: string         // secondary brand colour (gradient / accent)
  mark: string           // short wordmark shown on the canopy / badge
  tagline: string
  petrol: number         // UGX per litre
  diesel: number
  superPetrol: number
  hours: string
  is24h: boolean
  services: StationService[]
  phone: string
  art: string[]          // data-URI SVG artwork (always renders)
  photos: string[]       // optional real photos, overlaid with art as fallback
}

// ── Branded forecourt artwork (SVG → data URI). Always renders, on-brand. ──────
const uri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

function pump(x: number, color: string): string {
  return (
    `<g transform="translate(${x},232)">` +
    `<rect width="46" height="90" rx="7" fill="#3a3f4b"/>` +
    `<rect width="46" height="90" rx="7" fill="#000" opacity="0.12"/>` +
    `<rect x="8" y="10" width="30" height="20" rx="3" fill="${color}"/>` +
    `<rect x="11" y="14" width="24" height="12" rx="2" fill="#fff" opacity="0.85"/>` +
    `<rect x="10" y="40" width="26" height="7" rx="2" fill="#6b7280"/>` +
    `<rect x="10" y="52" width="26" height="7" rx="2" fill="#6b7280"/>` +
    `<path d="M46 26 h12 a6 6 0 0 1 6 6 v22" fill="none" stroke="#4b5563" stroke-width="4" stroke-linecap="round"/>` +
    `</g>`
  )
}

function forecourt(color: string, color2: string, mark: string, night = false): string {
  const skyTop = night ? '#0a0f26' : '#8ec9ff'
  const skyBot = night ? '#19224d' : '#e9f6ff'
  const ground = night ? '#161a27' : '#c9ced8'
  const edge   = night ? '#0e1019' : '#b3bac5'
  const sky = night
    ? `<circle cx="660" cy="74" r="30" fill="#eef1ff" opacity="0.92"/>` +
      `<g fill="#fff" opacity="0.85"><circle cx="120" cy="60" r="2"/><circle cx="220" cy="40" r="1.6"/><circle cx="320" cy="70" r="2"/><circle cx="500" cy="48" r="1.6"/><circle cx="580" cy="90" r="2"/><circle cx="700" cy="130" r="1.6"/></g>`
    : `<circle cx="660" cy="72" r="42" fill="#fff1a6"/><circle cx="660" cy="72" r="42" fill="#ffd84d" opacity="0.45"/>` +
      `<ellipse cx="180" cy="92" rx="54" ry="20" fill="#ffffff" opacity="0.85"/><ellipse cx="230" cy="80" rx="40" ry="16" fill="#ffffff" opacity="0.8"/>`
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">` +
    `<defs>` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBot}"/></linearGradient>` +
    `<linearGradient id="can" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color2}"/></linearGradient>` +
    `</defs>` +
    `<rect width="800" height="420" fill="url(#sky)"/>` +
    sky +
    `<rect y="300" width="800" height="120" fill="${ground}"/>` +
    `<rect y="300" width="800" height="7" fill="${edge}"/>` +
    `<rect x="60" y="356" width="240" height="6" rx="3" fill="#ffffff" opacity="0.5"/>` +
    `<rect x="360" y="356" width="160" height="6" rx="3" fill="#ffffff" opacity="0.5"/>` +
    `<rect x="110" y="250" width="34" height="72" rx="4" fill="#aeb6c2"/>` +
    `<rect x="656" y="250" width="34" height="72" rx="4" fill="#aeb6c2"/>` +
    pump(300, color) + pump(452, color) +
    `<rect x="78" y="150" width="644" height="78" rx="12" fill="url(#can)"/>` +
    `<rect x="78" y="150" width="644" height="26" rx="12" fill="#ffffff" opacity="0.20"/>` +
    `<rect x="78" y="214" width="644" height="14" fill="#000000" opacity="0.14"/>` +
    `<text x="400" y="203" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="800" fill="#ffffff" letter-spacing="1">${mark}</text>` +
    `<rect x="40" y="214" width="9" height="108" fill="#aeb6c2"/>` +
    `<rect x="16" y="196" width="58" height="74" rx="9" fill="url(#can)"/>` +
    `<rect x="24" y="232" width="42" height="30" rx="5" fill="#0f172a"/>` +
    `<text x="45" y="222" text-anchor="middle" font-family="Segoe UI, Arial" font-size="13" font-weight="800" fill="#fff">FUEL</text>` +
    `<text x="45" y="253" text-anchor="middle" font-family="Segoe UI, Arial" font-size="12" font-weight="700" fill="#7CFFB2">5,490</text>` +
    `</svg>`,
  )
}

function pumpCloseup(color: string, color2: string, mark: string): string {
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color2}"/></linearGradient></defs>` +
    `<rect width="800" height="420" fill="url(#bg)"/>` +
    `<rect width="800" height="420" fill="#000" opacity="0.10"/>` +
    `<g transform="translate(300,70)">` +
    `<rect width="200" height="300" rx="22" fill="#2b2f3a"/>` +
    `<rect width="200" height="300" rx="22" fill="#000" opacity="0.12"/>` +
    `<rect x="26" y="30" width="148" height="90" rx="10" fill="#0f172a"/>` +
    `<text x="100" y="74" text-anchor="middle" font-family="Segoe UI, Arial" font-size="22" font-weight="800" fill="#7CFFB2">UGX 5,490</text>` +
    `<text x="100" y="100" text-anchor="middle" font-family="Segoe UI, Arial" font-size="13" font-weight="700" fill="#9ca3af">per litre</text>` +
    `<rect x="34" y="150" width="132" height="16" rx="4" fill="${color}"/>` +
    `<rect x="34" y="178" width="100" height="12" rx="3" fill="#4b5563"/>` +
    `<rect x="34" y="200" width="120" height="12" rx="3" fill="#4b5563"/>` +
    `<path d="M200 120 h40 a14 14 0 0 1 14 14 v70 a18 18 0 0 1 -18 18 h-6" fill="none" stroke="#1f2937" stroke-width="9" stroke-linecap="round"/>` +
    `<rect x="150" y="250" width="60" height="34" rx="8" fill="${color}"/>` +
    `</g>` +
    `<text x="400" y="392" text-anchor="middle" font-family="Segoe UI, Arial" font-size="26" font-weight="800" fill="#ffffff" opacity="0.95">${mark}</text>` +
    `</svg>`,
  )
}

// ── Brand styling, keyed by terms found in the OSM brand/name ─────────────────
interface BrandStyle {
  name: string; color: string; color2: string; mark: string; tagline: string
  petrol: number; diesel: number; superPetrol: number
}

const STYLES: Record<string, BrandStyle> = {
  totalenergies:  { name: 'TotalEnergies',  color: '#E2001A', color2: '#1B2A6B', mark: 'TOTAL',  tagline: 'More energy, fewer emissions',   petrol: 5520, diesel: 5380, superPetrol: 5890 },
  total:          { name: 'Total',          color: '#E2001A', color2: '#1B2A6B', mark: 'TOTAL',  tagline: 'More energy, fewer emissions',   petrol: 5520, diesel: 5380, superPetrol: 5890 },
  shell:          { name: 'Shell',          color: '#ED1C24', color2: '#C8102E', mark: 'Shell',  tagline: 'Together anything is possible',  petrol: 5490, diesel: 5350, superPetrol: 5860 },
  vivo:           { name: 'Shell (Vivo)',   color: '#ED1C24', color2: '#C8102E', mark: 'Shell',  tagline: 'Together anything is possible',  petrol: 5490, diesel: 5350, superPetrol: 5860 },
  stabex:         { name: 'Stabex',         color: '#00A651', color2: '#008542', mark: 'Stabex', tagline: 'Fuelling the nation',            petrol: 5440, diesel: 5290, superPetrol: 5790 },
  'city oil':     { name: 'City Oil',       color: '#0B6E4F', color2: '#0A5A41', mark: 'City',   tagline: 'Quality fuels, friendly service', petrol: 5470, diesel: 5320, superPetrol: 5810 },
  cityoil:        { name: 'City Oil',       color: '#0B6E4F', color2: '#0A5A41', mark: 'City',   tagline: 'Quality fuels, friendly service', petrol: 5470, diesel: 5320, superPetrol: 5810 },
  hass:           { name: 'Hass Petroleum', color: '#F7941E', color2: '#D2691E', mark: 'Hass',   tagline: 'Energising East Africa',         petrol: 5500, diesel: 5360, superPetrol: 5840 },
  rubis:          { name: 'Rubis',          color: '#0033A0', color2: '#001E60', mark: 'Rubis',  tagline: 'Driven by service',              petrol: 5510, diesel: 5370, superPetrol: 5870 },
  kobil:          { name: 'Rubis Kobil',    color: '#0033A0', color2: '#E4002B', mark: 'Kobil',  tagline: 'Driven by service',              petrol: 5510, diesel: 5370, superPetrol: 5870 },
  kenol:          { name: 'Rubis Kobil',    color: '#0033A0', color2: '#E4002B', mark: 'Kobil',  tagline: 'Driven by service',              petrol: 5510, diesel: 5370, superPetrol: 5870 },
  mogas:          { name: 'Mogas',          color: '#E30613', color2: '#1A1A1A', mark: 'Mogas',  tagline: 'Powering your journey',          petrol: 5480, diesel: 5340, superPetrol: 5820 },
  gapco:          { name: 'Gapco',          color: '#0061A8', color2: '#003E6B', mark: 'Gapco',  tagline: 'Fuelling progress',              petrol: 5470, diesel: 5330, superPetrol: 5810 },
  gaz:            { name: 'Gaz',            color: '#1577C2', color2: '#0E4E84', mark: 'Gaz',    tagline: 'Cooking gas & fuels',            petrol: 5460, diesel: 5320, superPetrol: 5800 },
  petrocity:      { name: 'PetroCity',      color: '#C0102E', color2: '#7A0A1F', mark: 'Petro',  tagline: 'Your city fuel partner',         petrol: 5460, diesel: 5310, superPetrol: 5800 },
  delta:          { name: 'Delta',          color: '#0A8A3C', color2: '#076128', mark: 'Delta',  tagline: 'Reliable fuel, everywhere',      petrol: 5470, diesel: 5320, superPetrol: 5810 },
  oryx:           { name: 'Oryx',           color: '#E2231A', color2: '#9C1410', mark: 'Oryx',   tagline: 'Energy for life',                petrol: 5490, diesel: 5350, superPetrol: 5850 },
  hashi:          { name: 'Hashi Energy',   color: '#F7941E', color2: '#B5651D', mark: 'Hashi',  tagline: 'Energising East Africa',         petrol: 5500, diesel: 5360, superPetrol: 5840 },
  ola:            { name: 'Ola Energy',     color: '#00843D', color2: '#005A29', mark: 'Ola',    tagline: 'Proudly African energy',         petrol: 5480, diesel: 5340, superPetrol: 5830 },
  fuelex:         { name: 'Fuelex',         color: '#1D4ED8', color2: '#14328F', mark: 'Fuelex', tagline: 'Fuelling your every mile',        petrol: 5460, diesel: 5310, superPetrol: 5800 },
  nile:           { name: 'Nile Energy',    color: '#0E7490', color2: '#0A5666', mark: 'Nile',   tagline: 'From the source',                petrol: 5470, diesel: 5320, superPetrol: 5810 },
}

const DEFAULT_STYLE: BrandStyle = {
  name: 'Independent Station', color: '#0EA05A', color2: '#0A7D45', mark: 'FUEL',
  tagline: 'Your local fuel stop', petrol: 5450, diesel: 5300, superPetrol: 5800,
}

const SERVICE_POOL: StationService[] = [
  { icon: '⛽', label: 'Petrol, Diesel & Super' },
  { icon: '💳', label: 'Card & Mobile Money' },
  { icon: '🏪', label: 'Convenience store' },
  { icon: '💧', label: 'Free air & water' },
  { icon: '🧼', label: 'Car wash' },
  { icon: '🛢️', label: 'Engine oil & lubricants' },
  { icon: '🔧', label: 'Quick tyre service' },
  { icon: '🏧', label: 'ATM on site' },
  { icon: '☕', label: 'Café / fast food' },
  { icon: '🔥', label: 'LPG cooking gas' },
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function pick<T>(arr: T[], seed: number, count: number): T[] {
  const out: T[] = []
  const used = new Set<number>()
  // Math.imul keeps the LCG inside 32-bit range — a plain `*` overflows JS's
  // safe-integer range and can collapse to a constant, looping forever.
  let s = (seed | 0) || 1
  const want = Math.min(count, arr.length)
  let guard = 0
  while (out.length < want && guard++ < 200) {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff
    const i = s % arr.length
    if (!used.has(i)) { used.add(i); out.push(arr[i]) }
  }
  return out
}

function matchStyle(brand?: string, name?: string): BrandStyle {
  const hay = `${brand ?? ''} ${name ?? ''}`.toLowerCase()
  // Longest keys first so "totalenergies"/"city oil" beat "total"/"city".
  const keys = Object.keys(STYLES).sort((a, b) => b.length - a.length)
  for (const k of keys) if (hay.includes(k)) return STYLES[k]
  return DEFAULT_STYLE
}

// Real, freely-licensed forecourt photos bundled in /public/stations.
// Brand-specific sets keep the photos aligned with the station (a Shell shows
// Shell, a Total shows Total). Everything else uses neutral forecourts that
// carry no competitor branding. To add a brand: drop JPGs in /public/stations
// and add an entry to BRAND_PHOTOS (key = a term found in the brand name).
// Accuracy over filler: a station only ever shows photos that are GENUINELY its
// brand. Brands without a verified photo set show none (the detail page renders
// a clean branded header instead of a misleading forecourt).
const BRAND_PHOTOS: Record<string, string[]> = {
  shell: ['/stations/shell-uganda.jpg', '/stations/shell-2.jpg', '/stations/shell-3.jpg'],
  total: ['/stations/total-ghana.jpg', '/stations/total-douala.jpg', '/stations/total-bienvenue.jpg'],
  kobil: ['/stations/kobil-1.jpg', '/stations/kobil-2.jpg'],
  mogas: ['/stations/mogas-1.png'],
  hass:  ['/stations/hass-1.jpg'],
  ola:   ['/stations/ola-1.jpg'],
}

function photosFor(brand: string): string[] {
  const b = brand.toLowerCase()
  const key = Object.keys(BRAND_PHOTOS).find(k => b.includes(k))
  return key ? BRAND_PHOTOS[key] : []   // no verified brand photos → show none
}

/** Layer brand styling, artwork, prices and amenities onto a real OSM station. */
export function enrichStation(raw: NearbyStation): SimStation {
  const st = matchStyle(raw.brand, raw.name)
  const seed = hashStr(raw.place_id || raw.name || 'x')
  const is24h = raw.opening_hours === '24/7'
  const services = [SERVICE_POOL[0], SERVICE_POOL[1], ...pick(SERVICE_POOL.slice(2), seed, 4)]
  if (is24h) services.push({ icon: '🕒', label: 'Open 24 hours' })

  const displayName = raw.name && raw.name !== 'Fuel Station'
    ? raw.name
    : `${st.name} Station`

  return {
    ...raw,
    name: displayName,
    brand: st.name,
    color: st.color,
    color2: st.color2,
    mark: st.mark,
    tagline: st.tagline,
    petrol: st.petrol,
    diesel: st.diesel,
    superPetrol: st.superPetrol,
    hours: raw.opening_hours || (is24h ? 'Open 24 hours' : '6:00 AM – 11:00 PM'),
    is24h,
    services,
    phone: `+256 7${20 + (seed % 9)} ${String(100000 + (seed % 899999)).slice(0, 6)}`,
    art: [
      forecourt(st.color, st.color2, st.mark, false),
      pumpCloseup(st.color, st.color2, st.mark),
      forecourt(st.color, st.color2, st.mark, true),
    ],
    photos: photosFor(st.name),
    rating: raw.rating ?? +(4.0 + (seed % 8) / 10).toFixed(1),
    user_ratings_total: raw.user_ratings_total ?? (60 + (seed % 500)),
    open_now: raw.open_now ?? ((seed % 5) !== 0),
  }
}

// ── Last-resort fallback (only if the backend returns nothing at all) ─────────
const FALLBACK_BRANDS = ['Shell', 'TotalEnergies', 'Stabex', 'City Oil', 'Hass Petroleum', 'Rubis']
const AREAS = [
  { name: 'Kampala Road',  addr: 'Plot 42, Kampala Road, Central' },
  { name: 'Jinja Road',    addr: 'Jinja Road, near Nakawa' },
  { name: 'Ntinda',        addr: 'Ntinda Stretcher Rd, Ntinda' },
  { name: 'Bukoto',        addr: 'Bukoto Street, Kamwokya' },
  { name: 'Entebbe Road',  addr: 'Entebbe Road, Kibuye' },
  { name: 'Lugogo Bypass', addr: 'Lugogo Bypass, opp. Forest Mall' },
]

export function generateSimStations(driver: { lat: number; lng: number }): SimStation[] {
  const seed = Math.abs(Math.round((driver.lat + driver.lng) * 1000))
  return FALLBACK_BRANDS.map((brand, i) => {
    const bearing = (((i * 67 + 25) % 360) * Math.PI) / 180
    const distKm = +(0.4 + i * 0.5 + ((seed + i * 7) % 4) * 0.15).toFixed(1)
    const dLat = (distKm / 111) * Math.cos(bearing)
    const dLng = (distKm / (111 * Math.cos((driver.lat * Math.PI) / 180))) * Math.sin(bearing)
    const lat = driver.lat + dLat
    const lng = driver.lng + dLng
    const area = AREAS[(seed + i * 3) % AREAS.length]
    const raw: NearbyStation = {
      place_id: `sim-${i}`,
      name: `${brand} — ${area.name}`,
      brand,
      vicinity: area.addr,
      lat, lng,
      distance_km: distKm,
      open_now: i % 2 === 0,
      opening_hours: i % 2 === 0 ? '24/7' : undefined,
      maps_url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      directions_url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    }
    return enrichStation(raw)
  }).sort((a, b) => a.distance_km - b.distance_km)
}

export const fmtUGX = (n: number) => `UGX ${n.toLocaleString('en-US')}`
