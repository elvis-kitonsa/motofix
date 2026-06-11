// ─────────────────────────────────────────────────────────────────────────────
//  Spare-parts dealer presentation layer (mirrors lib/simStations.ts)
//
//  Generates a believable set of nearby auto-parts dealers around the driver,
//  each with branded storefront artwork (always renders), contact details,
//  WhatsApp, directions and an online store link so drivers can view and order
//  parts online. Used as the data source for the Spare Parts dealer map/list.
// ─────────────────────────────────────────────────────────────────────────────

export interface DealerService { icon: string; label: string }

export interface SimDealer {
  place_id: string
  name: string
  brand: string
  color: string
  color2: string
  mark: string
  tagline: string
  specialization: string
  vicinity: string
  lat: number
  lng: number
  distance_km: number
  rating: number
  user_ratings_total: number
  hours: string
  is24h: boolean
  open_now: boolean
  phone: string
  whatsapp: string
  online_store_url: string
  services: DealerService[]
  art: string[]            // data-URI SVG artwork (always renders)
  photos: string[]         // optional real photos (none bundled → art is used)
  maps_url: string
  directions_url: string
}

const uri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

// ── Storefront artwork — a shop facade with a signboard + display windows ──────
function storefront(color: string, color2: string, mark: string): string {
  const box = (x: number, y: number, c: string) =>
    `<rect x="${x}" y="${y}" width="34" height="26" rx="3" fill="${c}"/>` +
    `<rect x="${x + 4}" y="${y + 4}" width="26" height="8" rx="2" fill="#ffffff" opacity="0.85"/>`
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec9ff"/><stop offset="1" stop-color="#e9f6ff"/></linearGradient>` +
    `<linearGradient id="sign" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color2}"/></linearGradient></defs>` +
    `<rect width="800" height="420" fill="url(#sky)"/>` +
    `<circle cx="670" cy="70" r="40" fill="#fff1a6"/>` +
    `<rect y="300" width="800" height="120" fill="#c9ced8"/><rect y="300" width="800" height="7" fill="#b3bac5"/>` +
    // building
    `<rect x="70" y="90" width="660" height="230" fill="#eef1f5"/>` +
    `<rect x="70" y="90" width="660" height="230" fill="#000" opacity="0.04"/>` +
    // signboard
    `<rect x="70" y="90" width="660" height="64" fill="url(#sign)"/>` +
    `<rect x="70" y="90" width="660" height="20" fill="#ffffff" opacity="0.18"/>` +
    `<text x="400" y="133" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" fill="#ffffff" letter-spacing="1">${mark}</text>` +
    // left display window with shelves of parts
    `<rect x="100" y="176" width="250" height="120" rx="6" fill="#dbe3ec" stroke="#b6c0cc" stroke-width="2"/>` +
    box(116, 188, color) + box(160, 188, '#6b7280') + box(204, 188, color2) + box(248, 188, '#6b7280') + box(292, 188, color) +
    box(116, 226, '#6b7280') + box(160, 226, color2) + box(204, 226, '#6b7280') + box(248, 226, color) + box(292, 226, color2) +
    `<circle cx="150" cy="276" r="14" fill="#1f2937"/><circle cx="150" cy="276" r="6" fill="#6b7280"/>` +
    `<circle cx="210" cy="276" r="14" fill="#1f2937"/><circle cx="210" cy="276" r="6" fill="#6b7280"/>` +
    // right window + door
    `<rect x="450" y="176" width="180" height="120" rx="6" fill="#dbe3ec" stroke="#b6c0cc" stroke-width="2"/>` +
    box(466, 188, color) + box(510, 188, '#6b7280') + box(554, 188, color2) +
    box(466, 226, color2) + box(510, 226, color) + box(554, 226, '#6b7280') +
    `<rect x="650" y="186" width="60" height="134" rx="4" fill="${color2}"/>` +
    `<rect x="658" y="196" width="44" height="60" rx="3" fill="#cdd6e0"/>` +
    `<circle cx="664" cy="256" r="3" fill="#fff"/>` +
    // sub label
    `<rect x="300" y="330" width="200" height="26" rx="13" fill="#0f172a" opacity="0.82"/>` +
    `<text x="400" y="348" text-anchor="middle" font-family="Segoe UI, Arial" font-size="13" font-weight="700" fill="#fff" letter-spacing="2">AUTO SPARE PARTS</text>` +
    `</svg>`,
  )
}

// ── Interior artwork — shelving + counter ──────────────────────────────────────
function interior(color: string, color2: string, mark: string): string {
  const shelfBox = (x: number, y: number, c: string) => `<rect x="${x}" y="${y}" width="58" height="40" rx="4" fill="${c}"/><rect x="${x + 6}" y="${y + 6}" width="46" height="12" rx="2" fill="#fff" opacity="0.85"/>`
  let shelves = ''
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) {
    const col = [color, color2, '#6b7280', '#475569'][(r + c) % 4]
    shelves += shelfBox(40 + c * 78, 70 + r * 64, col)
  }
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">` +
    `<rect width="800" height="420" fill="#e7ebf0"/>` +
    `<rect y="0" width="800" height="300" fill="#eef1f5"/>` +
    shelves +
    `<rect y="56" width="800" height="6" fill="#c2cad4"/><rect y="120" width="800" height="6" fill="#c2cad4"/><rect y="184" width="800" height="6" fill="#c2cad4"/>` +
    `<rect y="300" width="800" height="120" fill="#cfd6df"/>` +
    `<rect x="120" y="300" width="560" height="64" rx="8" fill="${color}"/>` +
    `<rect x="120" y="300" width="560" height="18" rx="8" fill="#ffffff" opacity="0.18"/>` +
    `<text x="400" y="342" text-anchor="middle" font-family="Segoe UI, Arial" font-size="24" font-weight="800" fill="#fff" letter-spacing="1">${mark} · PARTS COUNTER</text>` +
    `</svg>`,
  )
}

interface DealerBrand {
  brand: string; mark: string; color: string; color2: string
  tagline: string; specialization: string; photos: string[]
}

// Real bundled photos in /public/dealers (topical auto-parts shop imagery).
const DEALERS: DealerBrand[] = [
  { brand: 'Kisekka Market Auto Spares', mark: 'KISEKKA',  color: '#1D4ED8', color2: '#14328F', tagline: 'Genuine & OEM parts',        specialization: 'Engine, electrical & filters', photos: ['/dealers/engine.jpg', '/dealers/spares.jpg'] },
  { brand: 'Ndeeba Spare Parts Centre',  mark: 'NDEEBA',   color: '#0B6E4F', color2: '#0A5A41', tagline: 'Body & suspension experts',  specialization: 'Body panels & suspension',     photos: ['/dealers/spares.jpg', '/dealers/storefront.jpg'] },
  { brand: 'Nakawa Motor Spares',        mark: 'NAKAWA',   color: '#E2231A', color2: '#9C1410', tagline: 'Tyres, batteries & belts',   specialization: 'Tyres, batteries & belts',     photos: ['/dealers/tyres.jpg', '/dealers/spares.jpg'] },
  { brand: 'Bwaise Auto Parts & Tools',  mark: 'BWAISE',   color: '#F7941E', color2: '#B5651D', tagline: 'Tools & general spares',     specialization: 'Tools & general spares',       photos: ['/dealers/tools.jpg', '/dealers/storefront.jpg'] },
  { brand: 'Kireka Car Accessories',     mark: 'KIREKA',   color: '#7C3AED', color2: '#5B21B6', tagline: 'Accessories & lighting',     specialization: 'Accessories & lighting',       photos: ['/dealers/accessories.jpg', '/dealers/spares.jpg'] },
  { brand: 'Lubowa Genuine Parts',       mark: 'LUBOWA',   color: '#0E7490', color2: '#0A5666', tagline: 'Dealer-grade genuine parts', specialization: 'Genuine OEM parts',            photos: ['/dealers/spares.jpg', '/dealers/engine.jpg'] },
]

const AREAS = [
  'Kisekka Market, Central',
  'Ndeeba, off Masaka Rd',
  'Nakawa Motor Village',
  'Bwaise, Bombo Rd',
  'Kireka, Jinja Rd',
  '7th Street, Industrial Area',
  'Ntinda Stretcher Rd',
]

const SERVICE_POOL: DealerService[] = [
  { icon: '🚚', label: 'Same-day delivery in Kampala' },
  { icon: '🛒', label: 'Order online & pay on delivery' },
  { icon: '💳', label: 'Mobile Money & card accepted' },
  { icon: '✅', label: 'Genuine / OEM parts available' },
  { icon: '🔧', label: 'Free fitting advice' },
  { icon: '↩️', label: '7-day returns on wrong parts' },
  { icon: '🏍️', label: 'Boda, car & truck parts' },
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function generateSimDealers(driver: { lat: number; lng: number }): SimDealer[] {
  const seed = Math.abs(Math.round((driver.lat + driver.lng) * 1000))
  return DEALERS.map((d, i) => {
    const bearing = (((i * 67 + 25) % 360) * Math.PI) / 180
    const distKm = +(0.5 + i * 0.55 + ((seed + i * 7) % 4) * 0.2).toFixed(1)
    const dLat = (distKm / 111) * Math.cos(bearing)
    const dLng = (distKm / (111 * Math.cos((driver.lat * Math.PI) / 180))) * Math.sin(bearing)
    const lat = driver.lat + dLat
    const lng = driver.lng + dLng
    const h = hashStr(d.brand)
    const is24h = i === 2
    const phone = `+256 7${20 + (h % 9)} ${String(100000 + (h % 899999)).slice(0, 6)}`
    return {
      place_id: `simd-${i}`,
      name: d.brand,
      brand: d.brand,
      color: d.color,
      color2: d.color2,
      mark: d.mark,
      tagline: d.tagline,
      specialization: d.specialization,
      vicinity: AREAS[(seed + i * 3) % AREAS.length],
      lat, lng,
      distance_km: distKm,
      rating: +(4.1 + (h % 8) / 10).toFixed(1),
      user_ratings_total: 60 + (h % 480),
      hours: is24h ? 'Open 24 hours' : '8:00 AM – 7:00 PM (Mon–Sat)',
      is24h,
      open_now: is24h || i % 3 !== 0,
      phone,
      whatsapp: phone,
      online_store_url: `https://www.google.com/search?q=${encodeURIComponent(d.brand + ' Kampala spare parts online order')}`,
      services: [SERVICE_POOL[0], SERVICE_POOL[1], SERVICE_POOL[2], SERVICE_POOL[3 + (h % 4)]],
      art: [storefront(d.color, d.color2, d.mark), interior(d.color, d.color2, d.mark)],
      photos: [],   // use branded art unless a real shop photo is supplied (enrichDealer)
      maps_url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      directions_url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    }
  }).sort((a, b) => a.distance_km - b.distance_km)
}

// ── Real dealers (from the backend OSM lookup) → rich presentation layer ───────
//  The backend returns bare facts (name, coords, distance, category). We layer on
//  branded artwork, photos, a rating, hours, contact + online-store links so the
//  cards/profile look identical to the simulated ones — but the data is real and
//  centred on the driver's actual location.

interface RawDealerIn {
  place_id: string; name: string; vicinity: string
  lat: number; lng: number; distance_km: number
  phone: string | null; category: string
  rating?: number | null; reviews?: number | null
  hours?: string | null; photo?: string | null
}

const CAT_SPEC: Record<string, string> = {
  car_parts: 'Genuine & OEM spare parts',
  car_repair: 'Repairs, parts & servicing',
  tyres: 'Tyres, batteries & wheel alignment',
  motorcycle_repair: 'Boda & motorcycle parts',
}
const PALETTE: [string, string][] = [
  ['#1D4ED8', '#14328F'], ['#0B6E4F', '#0A5A41'], ['#E2231A', '#9C1410'],
  ['#F7941E', '#B5651D'], ['#7C3AED', '#5B21B6'], ['#0E7490', '#0A5666'],
]

export function enrichDealer(raw: RawDealerIn): SimDealer {
  const h = hashStr(raw.place_id || raw.name)
  const [color, color2] = PALETTE[h % PALETTE.length]
  const mark = (raw.name.split(/\s+/)[0] || 'AUTO').toUpperCase().slice(0, 7)
  const phone = raw.phone || `+256 7${20 + (h % 9)} ${String(100000 + (h % 899999)).slice(0, 6)}`
  const hours = raw.hours || (h % 4 === 0 ? 'Open 24 hours' : '8:00 AM – 7:00 PM (Mon–Sat)')
  const is24h = /24\s*hour/i.test(hours)
  // Real shop photo when the backend supplied one; otherwise the branded SVG art.
  const photos = raw.photo ? [`/dealers/${raw.photo}`] : []
  return {
    place_id: raw.place_id,
    name: raw.name,
    brand: raw.name,
    color, color2, mark,
    tagline: '',
    specialization: CAT_SPEC[raw.category] ?? 'Spare parts & accessories',
    vicinity: raw.vicinity || 'Near you',
    lat: raw.lat, lng: raw.lng,
    distance_km: raw.distance_km,
    rating: raw.rating ?? +(4.0 + (h % 9) / 10).toFixed(1),
    user_ratings_total: raw.reviews ?? 35 + (h % 280),
    hours,
    is24h,
    open_now: is24h || h % 5 !== 0,
    phone,
    whatsapp: phone,
    online_store_url: `https://www.google.com/search?q=${encodeURIComponent(raw.name + ' Kampala spare parts order')}`,
    services: [SERVICE_POOL[0], SERVICE_POOL[1], SERVICE_POOL[2], SERVICE_POOL[3 + (h % 4)]],
    art: [storefront(color, color2, mark), interior(color, color2, mark)],
    photos,
    maps_url: `https://www.google.com/maps/search/?api=1&query=${raw.lat},${raw.lng}`,
    directions_url: `https://www.google.com/maps/dir/?api=1&destination=${raw.lat},${raw.lng}&travelmode=driving`,
  }
}
