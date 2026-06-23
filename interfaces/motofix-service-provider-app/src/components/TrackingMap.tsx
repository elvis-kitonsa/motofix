// TrackingMap.tsx — the Google Map on the mechanic's side of an active job, drawing the route
// to the customer and the mechanic's moving position along it (using the shared routeFollow +
// useJobSim logic) so both apps show the same journey. Supports expanding to full screen.

import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLoadScript, GoogleMap, useGoogleMap } from '@react-google-maps/api'
import { Minimize2, Maximize2 } from 'lucide-react'
import { useJobSim } from '@/hooks/useJobSim'

// ─────────────────────────────────────────────────────────────────────────────
// Live dispatch map — PORTED VERBATIM from the driver app so the mechanic sees the
// EXACT same thing the driver does: blue driver pin at the route's end, red
// mechanic pin riding the fixed road route, and the orange route SHRINKING toward
// the driver as the mechanic advances. Both apps feed the SAME deterministic
// useJobSim (driver location + request id + en_route_at) so the pins/route/ETA
// stay in lock-step across the two screens.
// ─────────────────────────────────────────────────────────────────────────────

type LL = { lat: number; lng: number }
const FALLBACK_CENTER: LL = { lat: 0.3476, lng: 32.5825 } // Kampala

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' }

const MAP_LIGHT_STYLES = [
  { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  gestureHandling: 'cooperative',
  clickableIcons: false,
  zoomControl: true,
  styles: MAP_LIGHT_STYLES as google.maps.MapTypeStyle[],
}
const MAP_OPTIONS_FULL: google.maps.MapOptions = {
  ...MAP_OPTIONS,
  zoomControl: true,
  fullscreenControl: false,
}

// Driver: blue teardrop pin with person silhouette (STATIC — no SMIL <animate>,
// which iOS Safari can refuse to paint on an image-based map marker).
const DRIVER_PIN_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56">' +
  '<ellipse cx="22" cy="55" rx="5" ry="1.5" fill="rgba(0,0,0,0.18)"/>' +
  '<circle cx="22" cy="20" r="19" fill="none" stroke="#3B82F6" stroke-width="2" opacity="0.28"/>' +
  '<path d="M22 2C12.06 2 4 10.06 4 20C4 32 22 53 22 53C22 53 40 32 40 20C40 10.06 31.94 2 22 2Z" fill="#3B82F6" stroke="white" stroke-width="2.5"/>' +
  '<circle cx="22" cy="14" r="5" fill="white"/>' +
  '<path d="M12 30c0-5.52 4.48-10 10-10s10 4.48 10 10z" fill="white"/>' +
  '</svg>'
)}`

// Mechanic: red teardrop pin with 👨‍🔧 emoji
const MECHANIC_CAR_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="54" height="66" viewBox="0 0 54 66">' +
  '<defs>' +
  '<radialGradient id="pg" cx="38%" cy="28%" r="68%">' +
  '<stop offset="0%" stop-color="#F87171"/>' +
  '<stop offset="100%" stop-color="#B91C1C"/>' +
  '</radialGradient>' +
  '<filter id="sh" x="-30%" y="-10%" width="160%" height="160%">' +
  '<feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.35)"/>' +
  '</filter>' +
  '</defs>' +
  '<ellipse cx="27" cy="64" rx="9" ry="3" fill="rgba(0,0,0,0.22)"/>' +
  '<path filter="url(#sh)" d="M27 2C15.4 2 6 11.4 6 23C6 38.5 27 63 27 63C27 63 48 38.5 48 23C48 11.4 38.6 2 27 2Z" fill="url(#pg)" stroke="white" stroke-width="2.5"/>' +
  '<path d="M17 11C19.5 7 23 5 27 5C31 5 34.5 7 37 11" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="3" stroke-linecap="round"/>' +
  '<circle cx="27" cy="23" r="15.5" fill="white"/>' +
  '<circle cx="27" cy="23" r="15.5" fill="none" stroke="rgba(185,28,28,0.15)" stroke-width="1.5"/>' +
  '<text x="27" y="31" text-anchor="middle" font-size="19" font-family="Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji,sans-serif">&#x1F468;&#x200D;&#x1F527;</text>' +
  '</svg>'
)}`

const GLASS_BADGE: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 10, fontWeight: 700,
  background: 'rgba(10,14,30,0.82)', color: '#e2e8f0',
  borderRadius: 8, padding: '4px 9px',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(4px)',
}

function MapOverlays({
  expanded, distText, driverPos, mechPos, onToggle,
}: {
  expanded: boolean
  distText: string | null
  driverPos: LL | null
  mechPos: LL | null
  onToggle: () => void
}) {
  return (
    <>
      <div style={{ position: 'absolute', bottom: expanded ? 28 : 10, left: 10, display: 'flex', gap: 5, pointerEvents: 'none', zIndex: 10 }}>
        {driverPos && (
          <span style={GLASS_BADGE}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, boxShadow: '0 0 5px #3B82F6' }} /> Driver
          </span>
        )}
        {mechPos && (
          <span style={GLASS_BADGE}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, boxShadow: '0 0 5px #F59E0B' }} /> You
          </span>
        )}
      </div>

      <div style={{ position: 'absolute', top: expanded ? 18 : 10, right: expanded ? 54 : 46, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, pointerEvents: 'none', zIndex: 10 }}>
        {distText && <div style={{ ...GLASS_BADGE, pointerEvents: 'none' }}>{distText}</div>}
      </div>

      <button
        onClick={onToggle}
        style={{ position: 'absolute', top: expanded ? 18 : 10, right: 10, zIndex: 20, width: 34, height: 34, borderRadius: 10, background: 'rgba(10,14,30,0.82)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        {expanded
          ? <Minimize2 style={{ width: 14, height: 14, color: '#e2e8f0' }} />
          : <Maximize2 style={{ width: 14, height: 14, color: '#e2e8f0' }} />}
      </button>
    </>
  )
}

// Imperative polyline: ONE native google.maps.Polyline whose path is updated via
// setPath as the route shrinks. Avoids the @react-google-maps remount-on-key trick
// that can leave a stale full-length line on iOS Safari (the "pin slides over a
// route that never shrinks" bug). Renders nothing in React's tree.
function ShrinkRoute({ path }: { path: LL[] }) {
  const map = useGoogleMap()
  const lineRef = useRef<google.maps.Polyline | null>(null)
  useEffect(() => {
    if (!map) return
    if (!lineRef.current) {
      lineRef.current = new google.maps.Polyline({
        strokeColor: '#F59E0B', strokeWeight: 6, strokeOpacity: 0.9, zIndex: 10,
      })
    }
    lineRef.current.setPath(path)
    lineRef.current.setMap(map)   // re-attach every run so it draws on the expanded map too
  }, [map, path])
  useEffect(() => () => { lineRef.current?.setMap(null); lineRef.current = null }, [])
  return null
}

// Both map markers managed in a SINGLE effect on the SAME native map instance —
// blue teardrop = driver, red teardrop = mechanic. Created together so neither can
// be dropped (the earlier missing-blue-pin bug came from @react-google-maps
// reconciling two separate conditional <Marker> siblings on iOS Safari).
function MapMarkers({ driverPos, mechDisplay }: { driverPos: LL | null; mechDisplay: LL | null }) {
  const map = useGoogleMap()
  const dRef = useRef<google.maps.Marker | null>(null)
  const mRef = useRef<google.maps.Marker | null>(null)
  useEffect(() => {
    if (!map) return
    const pin = (url: string, w: number, h: number, ax: number, ay: number, z: number): google.maps.Marker =>
      new google.maps.Marker({
        map, zIndex: z,
        icon: { url, scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(ax, ay) },
      })
    if (driverPos) {
      if (!dRef.current) dRef.current = pin(DRIVER_PIN_SVG, 35, 45, 17.5, 42.5, 1000)
      dRef.current.setPosition(driverPos)
      dRef.current.setMap(map)
    } else if (dRef.current) { dRef.current.setMap(null) }
    if (mechDisplay) {
      if (!mRef.current) mRef.current = pin(MECHANIC_CAR_SVG, 43, 53, 21.5, 50.5, 1001)
      mRef.current.setPosition(mechDisplay)
      mRef.current.setMap(map)
    } else if (mRef.current) { mRef.current.setMap(null) }
  }, [map, driverPos?.lat, driverPos?.lng, mechDisplay?.lat, mechDisplay?.lng])
  useEffect(() => () => { dRef.current?.setMap(null); mRef.current?.setMap(null); dRef.current = null; mRef.current = null }, [])
  return null
}

export default function TrackingMap({
  driverLat, driverLng,
  arrived, assigned, simActive, requestId, enRouteAt,
  onRouteUpdate, onProgress,
}: {
  driverLat?: number | null; driverLng?: number | null
  arrived?: boolean
  assigned?: boolean         // mechanic accepted (accepted/en_route) → draw the full route + both pins
  simActive?: boolean        // en_route → advance the mechanic pin along it
  requestId?: string | number | null
  enRouteAt?: string | null
  onRouteUpdate?: (info: { duration: string; distance: string } | null) => void
  onProgress?: (fraction: number) => void
}) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  })
  const mapRef    = useRef<google.maps.Map | null>(null)
  const mapRefExp = useRef<google.maps.Map | null>(null)
  const userInteractedRef    = useRef(false)
  const userInteractedExpRef = useRef(false)
  const initialFitDoneRef    = useRef(false)
  const initialFitDoneExpRef = useRef(false)

  const [expanded, setExpanded] = useState(false)
  const initialCenterRef = useRef<LL | null>(null)

  const hasDriver = driverLat != null && driverLng != null
  const driverPos = hasDriver ? { lat: driverLat as number, lng: driverLng as number } : null
  const enRoute     = !!simActive && !arrived            // pin advances
  // `assigned` defaults to simActive so existing en_route-only callers still work.
  const showJourney = !!(assigned ?? simActive) && !arrived // route + both pins drawn

  const sim = useJobSim({
    isLoaded,
    active: showJourney,   // build + show the route as soon as the job is accepted
    advancing: enRoute,    // only move the pin once en route
    driver: driverPos,
    seed: String(requestId ?? ''),
    enRouteAt: enRouteAt ?? null,
  })

  // Mechanic pin: parked at the route start while accepted, riding it while en route,
  // and sitting with the driver once arrived.
  const mechDisplay = arrived ? driverPos : (sim.mechPos ?? null)
  // Draw the route ONLY during the journey. sim.remaining stays populated from the
  // cached route after arrival, so without this gate the line lingers once arrived.
  const remainingRoute = showJourney ? sim.remaining : null

  useEffect(() => { if (enRoute) onProgress?.(sim.progress) }, [sim.progress, enRoute, onProgress])
  useEffect(() => {
    if (!enRoute || sim.etaMinutes == null || sim.distanceKm == null) { onRouteUpdate?.(null); return }
    const km = sim.distanceKm
    onRouteUpdate?.({
      duration: sim.etaMinutes <= 0 ? 'Arriving' : `${sim.etaMinutes} min`,
      distance: km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`,
    })
  }, [enRoute, sim.etaMinutes, sim.distanceKm, onRouteUpdate])

  const fitBounds = useCallback((map: google.maps.Map | null, force = false) => {
    if (!map || !isLoaded) return
    const isExp = map === mapRefExp.current
    if (!force && (isExp ? userInteractedExpRef.current : userInteractedRef.current)) return
    const pts: LL[] = []
    if (driverPos) pts.push(driverPos)
    if (sim.start) pts.push(sim.start)
    else if (sim.mechPos) pts.push(sim.mechPos)
    if (pts.length === 0) return
    if (pts.length === 1) { map.setCenter(pts[0]); map.setZoom(16) }
    else {
      const b = new window.google.maps.LatLngBounds()
      pts.forEach(p => b.extend(p))
      map.fitBounds(b, 60)
    }
    // Only consider the initial framing "done" once BOTH ends are in view. On first
    // load the route/mechanic aren't ready yet (only the driver), so marking it done
    // there would lock the map zoomed on the driver and never re-fit to show both.
    if (pts.length >= 2) {
      if (isExp) initialFitDoneExpRef.current = true
      else       initialFitDoneRef.current    = true
    }
  }, [driverPos, sim.start, sim.mechPos, isLoaded])

  useEffect(() => { if (!initialFitDoneRef.current) fitBounds(mapRef.current) }, [fitBounds, sim.ready])
  useEffect(() => { if (!initialFitDoneExpRef.current) fitBounds(mapRefExp.current) }, [fitBounds, sim.ready])

  useEffect(() => {
    if (!arrived || !isLoaded || !driverPos) return
    const fit = (map: google.maps.Map | null) => { if (map) { map.setCenter(driverPos); map.setZoom(16) } }
    fit(mapRef.current); fit(mapRefExp.current)
  }, [arrived, isLoaded, driverPos])

  if (!isLoaded) {
    return <div style={{ height: 320, borderRadius: 16, background: 'var(--surface-2)' }} className="animate-pulse" />
  }

  if (initialCenterRef.current == null && driverPos) initialCenterRef.current = driverPos
  const center = initialCenterRef.current ?? FALLBACK_CENTER

  const distText = (enRoute && sim.distanceKm != null)
    ? (sim.distanceKm >= 1 ? `${sim.distanceKm.toFixed(1)} km` : `${Math.round(sim.distanceKm * 1000)} m`)
    : null

  // Both pins are created in MapMarkers' single effect (blue=driver, red=mechanic);
  // the route is the imperative ShrinkRoute. All drawn natively so iOS Safari can't
  // drop the blue driver pin.
  const mapChildren = (
    <>
      <MapMarkers key="pins" driverPos={driverPos} mechDisplay={mechDisplay} />
      {remainingRoute && remainingRoute.length >= 2 && <ShrinkRoute key="route-line" path={remainingRoute} />}
    </>
  )

  const overlayProps = { expanded, distText, driverPos, mechPos: mechDisplay, onToggle: () => setExpanded(e => !e) }

  return (
    <>
      <style>{`
        .motofix-map .gm-style-cc,
        .motofix-map a[href^="https://maps.google.com/maps"],
        .motofix-map .gmnoscreen { display: none !important; }
      `}</style>
      <div
        className="motofix-map"
        style={{ height: 320, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-2, rgba(0,0,0,0.1))', position: 'relative', visibility: expanded ? 'hidden' : 'visible' }}
      >
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={center}
          zoom={15}
          options={MAP_OPTIONS}
          onLoad={m => {
            mapRef.current = m
            fitBounds(m, true)
            m.addListener('dragstart',    () => { userInteractedRef.current = true })
            m.addListener('zoom_changed', () => { userInteractedRef.current = true })
          }}
        >
          {mapChildren}
        </GoogleMap>
        <MapOverlays {...overlayProps} />
      </div>

      {expanded && createPortal(
        <div className="motofix-map" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000' }}>
          <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
            <GoogleMap
              mapContainerStyle={{ width: '100vw', height: '100vh' }}
              center={center}
              zoom={15}
              options={MAP_OPTIONS_FULL}
              onLoad={m => {
                mapRefExp.current = m
                fitBounds(m, true)
                m.addListener('dragstart',    () => { userInteractedExpRef.current = true })
                m.addListener('zoom_changed', () => { userInteractedExpRef.current = true })
              }}
            >
              {mapChildren}
            </GoogleMap>
            <MapOverlays {...overlayProps} expanded={true} />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
