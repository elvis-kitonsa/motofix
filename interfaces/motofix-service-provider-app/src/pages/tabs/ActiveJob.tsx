import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigation2, Phone, MessageCircle, MapPin, Maximize2, Minimize2, Stethoscope, ChevronLeft, Wrench, Smartphone, Clock, User, Star, Ban } from 'lucide-react'
import { toast } from 'sonner'
import CancelJobModal from '@/components/CancelJobModal'
import { useLoadScript, GoogleMap, Marker, Polyline } from '@react-google-maps/api'
import { buildRouteMeta, projectToRoute, pointAtDist, remainingPath, type RouteMeta, type LL } from '@/utils/routeFollow'
import { useJobSim, SIM_MINUTES } from '@/hooks/useJobSim'
import { reverseGeocode } from '@/utils/geocode'
import { C } from '@/styles/tokens'
import { jobService, reviewService, chatService } from '@/config/api'
import { useLocation } from '@/hooks/useLocation'
import StatusBar from '@/components/StatusBar'
import EmptyState from '@/components/EmptyState'
import DiagnosticTool from '@/components/DiagnosticTool'
import { formatUGX } from '@/utils/formatters'
import type { ServiceRequest } from '@/types'

function initials(name?: string) {
  if (!name) return 'D'
  const p = name.trim().split(' ')
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

const MAP_CONTAINER_STYLE = { height: '100%', width: '100%' }
const KAMPALA_CENTER = { lat: 0.3476, lng: 32.5825 }

// Clean light map style — strips POI/transit clutter, keeps standard Google Maps look
const MAP_LIGHT_STYLES = [
  { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]


// Driver: blue map pin with person silhouette — anchor at bottom tip (22, 53)
// NOTE: static SVG only — Google Maps loads marker icons as plain images, where
// SMIL <animate> is disabled and (in Firefox) can make the whole icon fail to
// rasterize → invisible pin. Keep this a static teardrop like MECHANIC_CAR_SVG.
const DRIVER_PIN_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56">' +
  '<ellipse cx="22" cy="55" rx="5" ry="1.5" fill="rgba(0,0,0,0.18)"/>' +
  '<circle cx="22" cy="20" r="19" fill="none" stroke="#3B82F6" stroke-width="2" opacity="0.28"/>' +
  '<path d="M22 2C12.06 2 4 10.06 4 20C4 32 22 53 22 53C22 53 40 32 40 20C40 10.06 31.94 2 22 2Z" fill="#3B82F6" stroke="white" stroke-width="2.5"/>' +
  '<circle cx="22" cy="14" r="5" fill="white"/>' +
  '<path d="M12 30c0-5.52 4.48-10 10-10s10 4.48 10 10z" fill="white"/>' +
  '</svg>'
)}`

// Mechanic/provider: red teardrop pin with 👨‍🔧 emoji — anchor at pin tip (27, 63)
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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function parseEtaMinutes(text: string): number | null {
  const h = text.match(/(\d+)\s*h/i)
  const m = text.match(/(\d+)\s*m/i)
  if (!h && !m) return null
  return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0)
}

// ─── Shared traffic-aware ETA ─────────────────────────────────────────────────
// MUST stay identical to the driver app's estimateEta() (RequestDetail.tsx) so
// both screens always show the same time. Effective speed adapts to time of day.
function estimateEta(distanceKm: number, now: Date = new Date()): { minutes: number; durationText: string; distanceText: string } {
  const hour = now.getHours()
  let speed: number // average effective km/h including traffic
  if      (hour >= 7  && hour < 10) speed = 17 // morning rush — heavy jam
  else if (hour >= 10 && hour < 16) speed = 27 // midday — moderate
  else if (hour >= 16 && hour < 20) speed = 15 // evening rush — worst jam
  else if (hour >= 20 && hour < 23) speed = 33 // evening — light traffic
  else                              speed = 42 // late night / early morning — clear
  const roadKm = distanceKm * 1.35
  const minutes = Math.max(1, Math.round((roadKm / speed) * 60))
  const durationText = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
  const distanceText = roadKm < 1 ? `${Math.round(roadKm * 1000)} m` : `${roadKm.toFixed(1)} km`
  return { minutes, durationText, distanceText }
}

// Shared arrival-time window — MUST match the driver app's arrivalWindow().
function arrivalWindow(enRouteAt?: string, etaMinutes?: number | null): string | null {
  if (!enRouteAt || etaMinutes == null) return null
  const ts = /[Z+]/.test(enRouteAt) ? enRouteAt : enRouteAt + 'Z'
  const start = new Date(ts)
  if (isNaN(start.getTime())) return null
  const arrival = start.getTime() + etaMinutes * 60000
  const pad = Math.max(10, Math.round(etaMinutes * 0.4)) * 60000
  const round5 = (ms: number) => { const d = new Date(ms); d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0); return d }
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const loStr = fmt(round5(arrival)), hiStr = fmt(round5(arrival + pad))
  return loStr.slice(-2) === hiStr.slice(-2) ? `${loStr.replace(/\s?[AP]M$/i, '')} – ${hiStr}` : `${loStr} – ${hiStr}`
}

function resamplePath(path: { lat: number; lng: number }[], n: number): { lat: number; lng: number }[] {
  if (path.length === 0) return []
  if (path.length <= n) return path
  return Array.from({ length: n }, (_, i) => path[Math.round(i * (path.length - 1) / (n - 1))])
}

// Arrival threshold in metres
const ARRIVAL_THRESHOLD_M = 20

const JOB_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  accepted:               { label: 'Accepted',              color: '#3B82F6' },
  en_route:               { label: 'On the Way',            color: '#F59E0B' },
  arrived:                { label: 'Arrived',               color: '#8B5CF6' },
  in_progress:            { label: 'In Progress',           color: '#F97316' },
  awaiting_confirmation:  { label: 'Awaiting Confirmation', color: '#A78BFA' },
  completed:              { label: 'Completed',             color: '#22C55E' },
}

interface ActiveJobProps {
  activeRequest: ServiceRequest | null
  sendMessage: (data: object) => void
  lastMessage: unknown
  onJobCompleted: () => void
  onBack?: () => void
}

// Amber garage destination pin (a little house glyph)
const GARAGE_PIN_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54">' +
    '<path d="M22 2C11 2 2 11 2 22C2 36 22 52 22 52C22 52 42 36 42 22C42 11 33 2 22 2Z" fill="#F59E0B" stroke="#fff" stroke-width="2.5"/>' +
    '<path d="M13 27 v-8 l9 -6 9 6 v8 z" fill="#fff"/>' +
    '<rect x="19" y="22" width="6" height="5" fill="#F59E0B"/></svg>'
)}`

// Treat a naive timestamp as UTC so it renders correctly in EAT.
function normTs(ts: string): string {
  return /[Z+]/.test(ts) ? ts : ts + 'Z'
}

// Condense the driver's request description for the mechanic: keep the core issue,
// strip the verbose MOTOBOT photo-check parenthetical, and surface the AI verdict separately.
function splitDescription(desc: string): { main: string; aiNote: string } {
  const marker = 'MOTOBOT photo check:'
  const idx = desc.indexOf(marker)
  if (idx === -1) return { main: desc.trim(), aiNote: '' }
  const main = desc.slice(0, idx).trim()
  const aiNote = desc.slice(idx + marker.length).replace(/\s*\([^)]*\)\s*$/, '').trim() // drop the long parenthetical detail
  return { main, aiNote }
}

// Pull the driver's chosen tow-to garage out of the request description.
function parseGarageDest(desc?: string | null): { name: string; area: string; phone: string; lat?: number; lng?: number } | null {
  if (!desc || !/specified garage/i.test(desc)) return null
  const name  = desc.match(/Name:\s*(.+)/i)?.[1]?.trim() ?? ''
  const area  = desc.match(/Area:\s*(.+)/i)?.[1]?.trim() ?? ''
  const phone = desc.match(/Phone:\s*(.+)/i)?.[1]?.trim() ?? ''
  const m = desc.match(/Map:\s*([-\d.]+)\s*,\s*([-\d.]+)/i)
  if (!name && !area) return null
  return { name, area, phone, lat: m ? parseFloat(m[1]) : undefined, lng: m ? parseFloat(m[2]) : undefined }
}

export default function ActiveJob({ activeRequest, sendMessage, lastMessage, onJobCompleted, onBack }: ActiveJobProps) {
  const navigate = useNavigate()
  const [actionLoading, setActionLoading] = useState(false)
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null)
  const [locationText, setLocationText] = useState('Loading location…')
  const [showCompletion, setShowCompletion] = useState(false)
  const [actualFee, setActualFee] = useState('')
  const [serviceNote, setServiceNote] = useState('')

  // Quote state
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteDesc, setQuoteDesc] = useState('')
  const [quoteSent, setQuoteSent] = useState(false)

  // Diagnostic tool
  const [showDiagnostic, setShowDiagnostic] = useState(false)

  // Arrival detection
  const [arrivedToast, setArrivedToast] = useState(false)
  const [bdOutcome, setBdOutcome] = useState<'fixed' | 'towing' | null>(null)  // breakdown: fixed on-site vs towed
  const arrivedTriggeredRef = useRef(false)
  const fiveMinMsgSentRef  = useRef(false)

  // GPS Simulator (dev-only)
  const [simPos, setSimPos] = useState<{ lat: number; lng: number } | null>(null)
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeRequestRef = useRef(activeRequest)
  const driverPosRef = useRef<{ lat: number; lng: number } | null>(null)

  // Call options sheet
  const [showCallSheet, setShowCallSheet] = useState(false)

  // Driver rating prompt (shown when awaiting_confirmation or completed)
  const [driverRating, setDriverRating] = useState(0)
  const [driverComment, setDriverComment] = useState('')
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [ratingDismissed, setRatingDismissed] = useState(false)

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [mapExpanded, setMapExpanded] = useState(false)
  const lastLocationSentRef = useRef(0)
  const routeRequestedRef = useRef(false) // route fetched once, then fixed
  // Route-following: snap the mechanic pin onto the fixed road route and shrink
  // the drawn route to just the remaining road as the mechanic advances.
  const routeMetaRef    = useRef<RouteMeta | null>(null)
  const progressDistRef = useRef(0) // monotonic km travelled along the route
  const [mechSnapped, setMechSnapped] = useState<LL | null>(null)
  const [remaining,   setRemaining]   = useState<LL[] | null>(null)
  const mapRef    = useRef<google.maps.Map | null>(null)
  const mapRefExp = useRef<google.maps.Map | null>(null)
  // Refs for current position values — used inside intervals to avoid stale closures
  const effectiveLatRef = useRef<number | null>(null)
  const effectiveLngRef = useRef<number | null>(null)

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  })

  // Fallback: if Maps script hasn't loaded after 12 s, stop waiting
  const [mapTimedOut, setMapTimedOut] = useState(false)
  useEffect(() => {
    if (isLoaded) return
    const t = setTimeout(() => setMapTimedOut(true), 12000)
    return () => clearTimeout(t)
  }, [isLoaded])

  // Mechanic-initiated cancellation (with reason + suspension warning).
  const [cancelOpen, setCancelOpen] = useState(false)
  const handleCancelled = useCallback((outcome: { strikes: number; suspended: boolean; limit: number } | null) => {
    setCancelOpen(false)
    if (outcome?.suspended) {
      toast.error('Account suspended for repeated cancellations. Contact MOTOFIX support.', { duration: 8000 })
    } else {
      toast('Job cancelled — the driver has been notified.', { duration: 5000 })
    }
    onBack?.()  // the cancelled status also broadcasts over WS and clears the active job
  }, [onBack])

  // Unread chat count shown on the Chat button (driver messages not yet opened).
  const [chatUnread, setChatUnread] = useState(0)
  useEffect(() => {
    if (!activeRequest?.id) return
    chatService.unread(String(activeRequest.id), 'mechanic')
      .then(res => setChatUnread(res.data?.unread ?? 0))
      .catch(() => {})
  }, [activeRequest?.id])
  useEffect(() => {
    const m = lastMessage as { type?: string; service_request_id?: string; sender_role?: string } | null
    if (m?.type === 'chat_message' && String(m.service_request_id) === String(activeRequest?.id) && m.sender_role === 'driver') {
      setChatUnread(c => c + 1)
    }
  }, [lastMessage, activeRequest?.id])

  const { lat: myLat, lng: myLng } = useLocation(!!activeRequest && simPos === null)
  // In dev, fall back to Makerere University when the laptop has no real GPS
  const DEV_LAT = import.meta.env.DEV ? (Number(import.meta.env.VITE_DEV_MECH_LAT) || 0.3347) : null
  const DEV_LNG = import.meta.env.DEV ? (Number(import.meta.env.VITE_DEV_MECH_LNG) || 32.5679) : null
  const effectiveLat = simPos?.lat ?? myLat ?? DEV_LAT ?? undefined
  const effectiveLng = simPos?.lng ?? myLng ?? DEV_LNG ?? undefined
  // Keep refs in sync so interval callbacks always read the latest position
  useEffect(() => { effectiveLatRef.current = effectiveLat ?? null }, [effectiveLat])
  useEffect(() => { effectiveLngRef.current = effectiveLng ?? null }, [effectiveLng])

  useEffect(() => {
    // Only ever derive location text from real GPS coordinates — never from raw text fields
    // which may contain phone numbers, freeform notes, etc.
    if (activeRequest?.location_lat != null && activeRequest?.location_lng != null) {
      setDriverPos({ lat: activeRequest.location_lat, lng: activeRequest.location_lng })
      reverseGeocode(activeRequest.location_lat, activeRequest.location_lng).then(setLocationText)
    } else if (activeRequest?.location) {
      const parts = activeRequest.location.split(',').map(Number)
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setDriverPos({ lat: parts[0], lng: parts[1] })
        reverseGeocode(parts[0], parts[1]).then(setLocationText)
      } else {
        // Raw text field — ignore, wait for live GPS from WebSocket
        setLocationText('Locating driver…')
      }
    } else {
      setLocationText('Locating driver…')
    }
    arrivedTriggeredRef.current = false
    // Fresh job → drop the old route so it's re-fetched and progress restarts.
    routeRequestedRef.current = false
    routeMetaRef.current = null
    progressDistRef.current = 0
    setDirections(null)
    setMechSnapped(null)
    setRemaining(null)
  }, [activeRequest?.id])

  // Snap the mechanic pin onto the route and recompute the remaining road
  // whenever the mechanic's position (or the route) changes. Progress is
  // monotonic so the pin never slides backwards along the road.
  useEffect(() => {
    const meta = routeMetaRef.current
    if (!meta || effectiveLat == null || effectiveLng == null || activeRequest?.status !== 'en_route') {
      setMechSnapped(null)
      setRemaining(null)
      return
    }
    const proj = projectToRoute(meta, { lat: effectiveLat, lng: effectiveLng })
    const dist = Math.max(progressDistRef.current, proj.dist)
    progressDistRef.current = dist
    setMechSnapped(pointAtDist(meta, dist))
    setRemaining(remainingPath(meta, dist))
  }, [effectiveLat, effectiveLng, directions, activeRequest?.status])

  // Keep refs up-to-date (used inside intervals where closure would otherwise be stale)
  useEffect(() => { activeRequestRef.current = activeRequest }, [activeRequest])
  useEffect(() => { driverPosRef.current = driverPos }, [driverPos])

  // Update driver position + geocode address from live WS location updates
  useEffect(() => {
    const msg = lastMessage as { type?: string; role?: string; lat?: number; lng?: number } | null
    if (
      msg?.type === 'location_update' &&
      msg.lat != null && msg.lng != null &&
      msg.role !== 'mechanic'
    ) {
      setDriverPos({ lat: msg.lat, lng: msg.lng })
      reverseGeocode(msg.lat, msg.lng).then(setLocationText)
    }
  }, [lastMessage])

  const updateStatus = useCallback(async (status: string, extra?: Record<string, unknown>) => {
    if (!activeRequest) return
    setActionLoading(true)
    try {
      await jobService.updateStatus(activeRequest.id, status, extra)
      if (status === 'awaiting_confirmation') setShowCompletion(false)
      if (status === 'completed') onJobCompleted()
    } finally {
      setActionLoading(false)
    }
  }, [activeRequest, onJobCompleted])

  // Deterministic shared simulation — identical route/pin/ETA as the driver app.
  // Keyed off the STABLE request location (not the live-GPS driverPos, which the
  // driver may broadcast) so both apps compute exactly the same route.
  const enRoute = activeRequest?.status === 'en_route'
  const reqDriver: LL | null =
    activeRequest?.location_lat != null && activeRequest?.location_lng != null
      ? { lat: activeRequest.location_lat, lng: activeRequest.location_lng }
      : driverPos
  const sim = useJobSim({
    isLoaded,
    active: !!enRoute,
    driver: reqDriver,
    seed: String(activeRequest?.id ?? ''),
    enRouteAt: (activeRequest as any)?.en_route_at ?? null,
  })

  // The driver's pin = live GPS if they're broadcasting it, otherwise the request's
  // location (a waiting driver usually isn't broadcasting, so without this the blue
  // driver pin never appears and the map can't frame the destination).
  const driverMarkerPos: LL | null = driverPos ?? reqDriver

  // Auto-advance to "arrived" once the simulated journey completes.
  useEffect(() => {
    if (enRoute && sim.ready && sim.progress >= 1 && !arrivedTriggeredRef.current) {
      arrivedTriggeredRef.current = true
      updateStatus('arrived')
      setArrivedToast(true)
      setTimeout(() => setArrivedToast(false), 4000)
    }
  }, [enRoute, sim.ready, sim.progress, updateStatus])

  const submitDriverReview = useCallback(async () => {
    if (!activeRequest || driverRating === 0) return
    setIsSubmittingRating(true)
    try {
      await reviewService.submit(activeRequest.id, { rating: driverRating, comment: driverComment })
      setRatingSubmitted(true)
    } catch {
      // Non-blocking — just dismiss on failure
      setRatingSubmitted(true)
    } finally {
      setIsSubmittingRating(false)
    }
  }, [activeRequest, driverRating, driverComment])

  // Broadcast own location every 10s + auto-detect arrival when en_route
  // Skipped when GPS simulator is active (simulator handles its own broadcasts)
  useEffect(() => {
    if (!activeRequest || myLat == null || myLng == null || simPos !== null) return
    const now = Date.now()
    if (now - lastLocationSentRef.current < 10000) return
    lastLocationSentRef.current = now
    sendMessage({ type: 'location_update', role: 'mechanic', lat: myLat, lng: myLng, service_request_id: activeRequest.id })

    // Auto-detect arrival: when en_route and within threshold of driver
    if (
      activeRequest.status === 'en_route' &&
      !arrivedTriggeredRef.current &&
      driverPos
    ) {
      const distM = haversineKm(myLat, myLng, driverPos.lat, driverPos.lng) * 1000
      if (distM <= ARRIVAL_THRESHOLD_M) {
        arrivedTriggeredRef.current = true
        updateStatus('arrived')
        setArrivedToast(true)
        setTimeout(() => setArrivedToast(false), 4000)
      }
    }
  }, [myLat, myLng, simPos, activeRequest, sendMessage, driverPos, updateStatus])

  // Once the user zooms/pans, stop auto-fitting so the map stays where they put it
  const userInteractedRef    = useRef(false)
  const userInteractedExpRef = useRef(false)
  const initialFitDoneRef    = useRef(false)
  const initialFitDoneExpRef = useRef(false)

  const fitBounds = useCallback((map: google.maps.Map | null, force = false) => {
    if (!map || !isLoaded) return
    const isExp = map === mapRefExp.current
    if (!force && (isExp ? userInteractedExpRef.current : userInteractedRef.current)) return
    // Frame the driver + the (simulated) route start so the whole journey shows.
    const mechFrame: LL | null = sim.start ?? sim.mechPos ??
      (effectiveLat != null && effectiveLng != null ? { lat: effectiveLat, lng: effectiveLng } : null)
    let didFit = false
    if (driverMarkerPos && mechFrame) {
      const bounds = new (window as any).google.maps.LatLngBounds()
      bounds.extend(driverMarkerPos)
      bounds.extend(mechFrame)
      map.fitBounds(bounds, 60)
      didFit = true
    } else if (driverMarkerPos) {
      map.setCenter(driverMarkerPos)
      map.setZoom(16)
      didFit = true
    } else if (mechFrame) {
      map.setCenter(mechFrame)
      map.setZoom(16)
      didFit = true
    }
    // Only mark the initial fit "done" once we actually framed something. On a
    // phone over http the positions arrive AFTER the map loads, so marking it
    // done prematurely would leave the pins parked off-screen.
    if (!didFit) return
    if (isExp) initialFitDoneExpRef.current = true
    else       initialFitDoneRef.current    = true
  }, [driverMarkerPos, effectiveLat, effectiveLng, sim.start, sim.mechPos, isLoaded])

  // Re-frame as soon as the positions become available (the one-time onMapLoad
  // fit can run before geolocation / the driver position has arrived).
  useEffect(() => {
    if (!initialFitDoneRef.current) fitBounds(mapRef.current)
  }, [fitBounds])
  useEffect(() => {
    if (!initialFitDoneExpRef.current) fitBounds(mapRefExp.current)
  }, [fitBounds])

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    fitBounds(map, true)
    map.addListener('dragstart',    () => { userInteractedRef.current = true })
    map.addListener('zoom_changed', () => { userInteractedRef.current = true })
  }, [fitBounds])

  const onMapLoadExp = useCallback((map: google.maps.Map) => {
    mapRefExp.current = map
    fitBounds(map, true)
    map.addListener('dragstart',    () => { userInteractedExpRef.current = true })
    map.addListener('zoom_changed', () => { userInteractedExpRef.current = true })
  }, [fitBounds])

  // On arrival, re-frame the map tightly around the two pins (the journey route
  // is hidden once arrived, so fit to driver + mechanic which are now close).
  useEffect(() => {
    if (activeRequest?.status !== 'arrived') return
    const fit = (map: google.maps.Map | null) => {
      if (!map || !isLoaded || !driverMarkerPos || effectiveLat == null || effectiveLng == null) return
      const b = new (window as any).google.maps.LatLngBounds()
      b.extend(driverMarkerPos)
      b.extend({ lat: effectiveLat, lng: effectiveLng })
      map.fitBounds(b, 80)
      // Both pins are close on arrival — cap the zoom so it isn't street-microscopic
      const z = map.getZoom()
      if (z != null && z > 17) map.setZoom(17)
    }
    fit(mapRef.current)
    fit(mapRefExp.current)
  }, [activeRequest?.status, driverMarkerPos, effectiveLat, effectiveLng, isLoaded])

  // Only auto-fit when coords first become available (before user has interacted)
  useEffect(() => {
    if (!initialFitDoneRef.current) fitBounds(mapRef.current)
  }, [fitBounds])
  useEffect(() => {
    if (!initialFitDoneExpRef.current) fitBounds(mapRefExp.current)
  }, [fitBounds])

  // Re-fit once when driverPos first becomes known (initial positioning only)
  useEffect(() => {
    if (driverPos && mapRef.current && isLoaded && !userInteractedRef.current) fitBounds(mapRef.current)
  }, [driverPos, isLoaded, fitBounds])

  // Fetch the driving route ONCE at the start, then keep it fixed (shortest route
  // drawn from the mechanic's starting point to the driver — it does not redraw
  // as the mechanic moves).
  useEffect(() => {
    if (!isLoaded || !driverPos || effectiveLat == null || effectiveLng == null) return
    if (routeRequestedRef.current) return
    routeRequestedRef.current = true
    const g = (window as any).google.maps
    new g.DirectionsService().route({
      origin:      { lat: effectiveLat, lng: effectiveLng },
      destination: driverPos,
      travelMode:  g.TravelMode.DRIVING,
      provideRouteAlternatives: true, // pick the SHORTEST by distance
    }, (result: google.maps.DirectionsResult | null, status: string) => {
      if (status === 'OK' && result) {
        // Put the shortest-distance route first so the renderer draws it
        let best = 0, bestM = Infinity
        result.routes.forEach((r, i) => {
          const m = r.legs.reduce((s: number, leg: any) => s + (leg.distance?.value ?? 0), 0)
          if (m < bestM) { bestM = m; best = i }
        })
        if (best > 0) { const [r] = result.routes.splice(best, 1); result.routes.unshift(r) }
        setDirections(result) // fixed shortest road polyline; ETA comes from estimateEta()
        // Build the route metadata used to snap the pin + shrink the drawn route.
        const path: LL[] = (result.routes[0]?.overview_path ?? []).map((p: google.maps.LatLng) => ({ lat: p.lat(), lng: p.lng() }))
        routeMetaRef.current = buildRouteMeta(path)
        progressDistRef.current = 0
        const rb = result.routes[0]?.bounds
        if (rb && mapRef.current && !userInteractedRef.current) { mapRef.current.fitBounds(rb, 50); initialFitDoneRef.current = true }
        if (rb && mapRefExp.current && !userInteractedExpRef.current) { mapRefExp.current.fitBounds(rb, 50); initialFitDoneExpRef.current = true }
      } else {
        routeRequestedRef.current = false // allow a retry
      }
    })
  }, [isLoaded, driverPos, effectiveLat, effectiveLng])

  // Broadcast mechanic position every 15s when en_route — ensures driver map updates even if GPS hasn't moved
  useEffect(() => {
    if (!activeRequest || activeRequest.status !== 'en_route') return
    const tick = () => {
      const lat = effectiveLatRef.current
      const lng = effectiveLngRef.current
      if (lat == null || lng == null) return
      sendMessage({ type: 'location_update', role: 'mechanic', lat, lng, service_request_id: activeRequest.id })
      lastLocationSentRef.current = Date.now()
    }
    tick() // broadcast immediately on en_route
    const timer = setInterval(tick, 15000)
    return () => clearInterval(timer)
  }, [activeRequest?.status, activeRequest?.id, sendMessage])

  // Check the shared ETA every 15s when en_route and auto-chat "5 minutes away"
  // once. The route itself stays fixed — we only re-evaluate the time.
  useEffect(() => {
    if (activeRequest?.status !== 'en_route') return
    const check = () => {
      const lat = effectiveLatRef.current
      const lng = effectiveLngRef.current
      const dp  = driverPosRef.current
      if (lat == null || lng == null || !dp) return
      const etaMins = estimateEta(haversineKm(lat, lng, dp.lat, dp.lng)).minutes
      if (etaMins <= 5 && !fiveMinMsgSentRef.current) {
        fiveMinMsgSentRef.current = true
        const curReq = activeRequestRef.current
        if (curReq) {
          sendMessage({
            type: 'chat_message',
            service_request_id: String(curReq.id),
            message: `⏱ I'll be at your location in about ${etaMins > 1 ? `${etaMins} minutes` : '1 minute'}!`,
            sender_id: 'system',
          })
        }
      }
    }
    check()
    const timer = setInterval(check, 15000)
    return () => clearInterval(timer)
  }, [activeRequest?.status, activeRequest?.id, sendMessage])

  const sendQuote = () => {
    if (!activeRequest || !quoteAmount) return
    sendMessage({ type: 'price_quote', service_request_id: activeRequest.id, amount: Number(quoteAmount), description: quoteDesc })
    setQuoteSent(true)
    setTimeout(() => setQuoteSent(false), 3000)
  }

  const handleDiagnosisComplete = (
    _result: Record<string, unknown>,
    suggestedPrice: number,
    diagDescription: string
  ) => {
    setQuoteAmount(String(suggestedPrice))
    setQuoteDesc(diagDescription)
    setShowDiagnostic(false)
  }

  // Legacy broadcast simulation — superseded by the deterministic useJobSim,
  // which both apps render identically. Disabled to avoid double-driving the pin.
  useEffect(() => {
    if (true) return // eslint-disable-line no-constant-condition
    if (!import.meta.env.DEV || !isLoaded) return
    if (activeRequest?.status !== 'en_route') return
    if (simIntervalRef.current) return // already running

    fiveMinMsgSentRef.current = false
    const dp = driverPosRef.current
    if (!dp) return // driver position not yet known

    const startLat = dp.lat + 0.027   // ~3 km north
    const startLng = dp.lng + 0.027   // ~3 km east

    const g = (window as any).google.maps
    setSimPos({ lat: startLat, lng: startLng })

    const req = activeRequestRef.current
    if (req) {
      sendMessage({ type: 'location_update', role: 'mechanic', lat: startLat, lng: startLng, service_request_id: req.id })
      sendMessage({ type: 'chat_message', service_request_id: String(req.id), message: "🚗 I'm on my way to your location!", sender_id: 'system' })
    }

    let cancelled = false

    const launchInterval = (steps: { lat: number; lng: number }[]) => {
      let idx = 0
      // eslint-disable-next-line react-hooks/exhaustive-deps
      simIntervalRef.current = setInterval(() => {
        if (idx >= steps.length - 1) {
          clearInterval(simIntervalRef.current!)
          simIntervalRef.current = null
          setSimPos(null)
          return
        }
        idx++
        const pos = steps[idx]
        setSimPos(pos)
        const curReq = activeRequestRef.current
        if (!curReq) return
        sendMessage({ type: 'location_update', role: 'mechanic', lat: pos.lat, lng: pos.lng, service_request_id: curReq.id })
        if (curReq.status === 'en_route' && !arrivedTriggeredRef.current) {
          const distM = haversineKm(pos.lat, pos.lng, dp.lat, dp.lng) * 1000
          if (distM <= ARRIVAL_THRESHOLD_M) {
            arrivedTriggeredRef.current = true
            clearInterval(simIntervalRef.current!)
            simIntervalRef.current = null
            setSimPos(null)
            updateStatus('arrived')
            setArrivedToast(true)
            setTimeout(() => setArrivedToast(false), 4000)
          }
        }
      }, 4000) // 120 steps × 4 s ≈ 8 min journey
    }

    new g.DirectionsService().route(
      { origin: { lat: startLat, lng: startLng }, destination: dp, travelMode: g.TravelMode.DRIVING },
      (result: google.maps.DirectionsResult | null, status: string) => {
        if (cancelled) return
        let steps: { lat: number; lng: number }[]
        if (status === 'OK' && result) {
          const raw: { lat: number; lng: number }[] = []
          result.routes[0]?.overview_path?.forEach((pt: google.maps.LatLng) =>
            raw.push({ lat: pt.lat(), lng: pt.lng() })
          )
          steps = resamplePath(raw.length > 1 ? raw : [{ lat: startLat, lng: startLng }, dp], 120)
        } else {
          // Straight-line fallback if Directions API fails
          steps = Array.from({ length: 121 }, (_, i) => ({
            lat: startLat + (dp.lat - startLat) * (i / 120),
            lng: startLng + (dp.lng - startLng) * (i / 120),
          }))
        }
        launchInterval(steps)
      }
    )

    return () => {
      cancelled = true
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current)
        simIntervalRef.current = null
      }
      setSimPos(null)
    }
  // sendMessage and updateStatus are stable; driverPos read via ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRequest?.status, isLoaded])

  if (!activeRequest) {
    return <EmptyState icon={Navigation2} title="No Active Job" subtitle="Accept a request from the Jobs tab to see it here." />
  }

  const status = activeRequest.status
  const garageDest = parseGarageDest((activeRequest as { description?: string } | null)?.description)
  const driverPhotos = (activeRequest.media_files ?? []).filter(m => m.file_type === 'photo' || m.file_type === 'image').map(m => m.url)
  const myPos = effectiveLat != null && effectiveLng != null ? { lat: effectiveLat, lng: effectiveLng } : null

  // "I Have Arrived" is removed — only these manual transitions remain
  const actionConfig: Record<string, { label: string; next: string; disabled?: boolean }> = {
    accepted:    { label: "🚗 I'm On My Way",          next: 'en_route' },
    // en_route: handled automatically by proximity detection
    arrived:     { label: '🔧 Starting Work Now',      next: 'in_progress', disabled: !quoteSent },
    in_progress: { label: '✅ Service Provided – Done', next: 'awaiting_confirmation' },
  }
  const action = actionConfig[status]
  // Breakdown Rescue jobs resolve on-site as either a repair or a tow.
  const isBreakdown = /breakdown/i.test(`${activeRequest.issue_type ?? ''} ${activeRequest.service_type ?? ''}`)
  const needOutcome = isBreakdown && status === 'in_progress' && !bdOutcome
  const isAwaitingConfirmation = status === 'awaiting_confirmation'
  // Who started the completion handshake. If the DRIVER (or the system) did, the
  // mechanic is the one who needs to confirm; otherwise the mechanic is waiting.
  const completionBy = (activeRequest as any)?.completion_by as string | null | undefined
  const mechanicInitiated = !completionBy || completionBy === 'mechanic'
  const showRatingPrompt = (isAwaitingConfirmation || status === 'completed') && !ratingSubmitted && !ratingDismissed

  return (
    <>
      <style>{`
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes arrivedPop { 0%{transform:translateY(40px);opacity:0} 20%{transform:translateY(0);opacity:1} 80%{opacity:1} 100%{opacity:0} }
        .motofix-map .gm-style-cc,
        .motofix-map a[href^="https://maps.google.com/maps"],
        .motofix-map .gmnoscreen { display: none !important; }
      `}</style>

      {/* Arrived toast */}
      {arrivedToast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 500,
          background: C.green, color: '#000', fontWeight: 800, fontSize: 14,
          padding: '12px 24px', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          animation: 'arrivedPop 4s ease forwards', whiteSpace: 'nowrap',
        }}>
          📍 You've arrived — driver has been notified!
        </div>
      )}

      <div style={{ height: 'calc(100vh - 84px)', overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Sticky header — matches driver app style */}
        {(() => {
          const jobBadge = JOB_STATUS_BADGE[status] ?? { label: status.replace(/_/g, ' '), color: C.amber }
          const shortId = `#${String(activeRequest.id).padStart(6, '0')}`
          return (
            <div style={{
              position: 'sticky', top: 0, zIndex: 50,
              background: 'var(--header-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderBottom: `1px solid ${C.border}`,
              padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {onBack && (
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 6px 6px 0', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <ChevronLeft style={{ width: 20, height: 20, color: C.textHi }} />
                </button>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 15, fontWeight: 700, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                  {activeRequest.issue_type ?? activeRequest.service_type ?? 'Active Job'}
                </h1>
                <p style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{shortId}</p>
              </div>
              {/* Simple pill badge matching driver app */}
              <span style={{
                padding: '4px 12px', borderRadius: 9999,
                fontSize: 11, fontWeight: 700, flexShrink: 0,
                background: jobBadge.color + '22',
                color: jobBadge.color,
                border: `1px solid ${jobBadge.color}50`,
              }}>
                {jobBadge.label}
              </span>
            </div>
          )
        })()}

        {/* Content cards — map is the first card so it shares the same padding/alignment */}
        <div style={{ padding: '16px 16px 100px' }}>

        {/* Map */}
        {(() => {
          const mapCardStyle: React.CSSProperties = {
            height: 320, borderRadius: 16, overflow: 'hidden',
            border: `1px solid ${C.border}`,
            marginBottom: 12,
            position: 'relative',
          }

          if (loadError || mapTimedOut) return (
            <div style={{ ...mapCardStyle, background: C.surface2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 24px' }}>
              <MapPin style={{ width: 36, height: 36, color: C.amber, opacity: 0.8 }} />
              <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 1.5 }}>{locationText}</p>
              {(driverPos || (activeRequest.location_lat && activeRequest.location_lng)) && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${activeRequest.location_lat ?? driverPos?.lat},${activeRequest.location_lng ?? driverPos?.lng}`}
                  target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 20, background: C.amber, color: '#000', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                >
                  <Navigation2 style={{ width: 13, height: 13 }} /> Open in Maps
                </a>
              )}
            </div>
          )

          if (!isLoaded) return (
            <div style={{ ...mapCardStyle, background: C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: C.textFaint, fontSize: 13 }}>Loading map…</span>
            </div>
          )

          const driverIcon: google.maps.Icon   = { url: DRIVER_PIN_SVG,   scaledSize: new (window as any).google.maps.Size(44, 56), anchor: new (window as any).google.maps.Point(22, 53) }
          const providerIcon: google.maps.Icon = { url: MECHANIC_CAR_SVG, scaledSize: new (window as any).google.maps.Size(43, 53), anchor: new (window as any).google.maps.Point(21.5, 50.5) }

          // Monotonic ETA + distance from the shared simulation (no flicker).
          const etaText  = enRoute && sim.etaMinutes != null
            ? (sim.etaMinutes <= 0 ? 'Arriving' : `${sim.etaMinutes} min`)
            : null
          const distText = enRoute && sim.distanceKm != null
            ? (sim.distanceKm >= 1 ? `${sim.distanceKm.toFixed(1)} km` : `${Math.round(sim.distanceKm * 1000)} m`)
            : null
          // Shared arrival window — identical to what the driver sees
          const arrivalText = enRoute
            ? arrivalWindow((activeRequest as any).en_route_at, (activeRequest as any).eta_minutes)
            : null

          const mapOpts = {
            disableDefaultUI: true,
            gestureHandling: 'cooperative',
            clickableIcons: false,
            zoomControl: true,
            zoomControlOptions: { position: (window as any).google.maps.ControlPosition.RIGHT_BOTTOM },
            styles: MAP_LIGHT_STYLES,
          }

          // While en route the pin rides the SAME deterministic route the driver
          // sees; once arrived it sits with the driver. The route shrinks as he
          // advances and never changes underneath him.
          // While en route the pin is ONLY the simulated position (identical to the
          // driver app) — never a flash of real GPS before the route loads.
          const mechMarkerPos = activeRequest?.status === 'arrived'
            ? driverPos
            : (enRoute ? sim.mechPos : myPos)
          const simRemaining = enRoute ? sim.remaining : null
          const renderMapContent = (_ref: React.MutableRefObject<google.maps.Map | null>, onLoad: (m: google.maps.Map) => void) => (
            <GoogleMap mapContainerStyle={MAP_CONTAINER_STYLE} center={KAMPALA_CENTER} zoom={13} options={mapOpts} onLoad={onLoad}>
              {driverMarkerPos && <Marker position={driverMarkerPos} icon={driverIcon} title="Driver" />}
              {mechMarkerPos && <Marker position={mechMarkerPos} icon={providerIcon} title="You" />}
              {simRemaining && simRemaining.length >= 2 && (
                <Polyline path={simRemaining} options={{ strokeColor: '#F59E0B', strokeWeight: 6, strokeOpacity: 0.9, zIndex: 10 }} />
              )}
              {garageDest?.lat != null && garageDest?.lng != null && (
                <Marker position={{ lat: garageDest.lat, lng: garageDest.lng }} icon={{ url: GARAGE_PIN_SVG, scaledSize: new (window as any).google.maps.Size(40, 49), anchor: new (window as any).google.maps.Point(20, 48) }} title={`Tow to: ${garageDest.name}`} />
              )}
            </GoogleMap>
          )

          const mapOverlays = (full: boolean) => (
            <>
              <div style={{ position: 'absolute', bottom: full ? 28 : 10, left: 10, display: 'flex', gap: 5, pointerEvents: 'none', zIndex: 10 }}>
                {driverPos && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, background: 'rgba(10,14,30,0.82)', color: '#e2e8f0', borderRadius: 8, padding: '4px 9px', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, boxShadow: '0 0 5px #3B82F6' }} /> Driver
                  </span>
                )}
                {mechMarkerPos && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, background: 'rgba(10,14,30,0.82)', color: '#e2e8f0', borderRadius: 8, padding: '4px 9px', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0, boxShadow: '0 0 5px #EF4444' }} /> You
                  </span>
                )}
              </div>
              <div style={{ position: 'absolute', top: full ? 18 : 10, right: full ? 54 : 46, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, pointerEvents: 'none', zIndex: 10 }}>
                {(arrivalText || etaText) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F59E0B', color: '#000', fontSize: 12, fontWeight: 800, borderRadius: 10, padding: '5px 11px', boxShadow: '0 2px 12px rgba(245,158,11,0.45)' }}>
                    <span style={{ fontSize: 11 }}>🕐</span> {arrivalText ?? etaText}
                  </div>
                )}
                {distText && (
                  <div style={{ background: 'rgba(10,14,30,0.82)', color: '#cbd5e1', fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '4px 9px', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}>
                    {distText}
                  </div>
                )}
              </div>
              <button
                onClick={() => setMapExpanded(e => !e)}
                style={{ position: 'absolute', top: full ? 18 : 10, right: 10, zIndex: 20, width: 34, height: 34, borderRadius: 10, background: 'rgba(10,14,30,0.82)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {full ? <Minimize2 style={{ width: 14, height: 14, color: '#e2e8f0' }} /> : <Maximize2 style={{ width: 14, height: 14, color: '#e2e8f0' }} />}
              </button>
            </>
          )

          return (
            <>
              <div className="motofix-map" style={{ ...mapCardStyle, display: mapExpanded ? 'none' : 'block' }}>
                {renderMapContent(mapRef, onMapLoad)}
                {mapOverlays(false)}
              </div>
              {mapExpanded && (
                <div className="motofix-map" style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#000' }}>
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {renderMapContent(mapRefExp, onMapLoadExp)}
                    {mapOverlays(true)}
                  </div>
                </div>
              )}
            </>
          )
        })()}

          {/* Driver details card — matches driver app middle card layout */}
          <div style={{ marginBottom: 12, background: C.surface2, borderRadius: 20, border: `1px solid ${C.border}`, padding: 16 }}>

            {/* Driver name */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <User style={{ width: 20, height: 20, color: C.amber, flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 2 }}>Driver</p>
                <p style={{ fontSize: 14, color: C.textHi }}>{activeRequest.driver_name ?? '—'}</p>
              </div>
            </div>

            {/* Location */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <MapPin style={{ width: 20, height: 20, color: C.amber, flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 2 }}>Location</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.textHi }}>{locationText}</p>
              </div>
            </div>

            {/* Description (summarised) + driver's photo + MOTOBOT verdict */}
            {activeRequest.description && (() => {
              const { main, aiNote } = splitDescription(activeRequest.description)
              return (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <Wrench style={{ width: 20, height: 20, color: C.amber, flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 2 }}>Description</p>
                    {main && <p style={{ fontSize: 14, color: C.textHi, whiteSpace: 'pre-wrap' }}>{main}</p>}
                    {driverPhotos.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 8 }}>
                        {driverPhotos.map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                            <img src={u} alt="Reported damage" style={{ height: 110, borderRadius: 10, border: `1px solid ${C.border}`, objectFit: 'cover', display: 'block' }} />
                          </a>
                        ))}
                      </div>
                    )}
                    {aiNote && (
                      <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: `${C.amber}14`, border: `1px solid ${C.amber}33` }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: C.amber }}>🤖 MOTOBOT: </span>
                        <span style={{ fontSize: 12.5, color: C.textHi }}>{aiNote}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Requested at */}
            {activeRequest.created_at && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Clock style={{ width: 20, height: 20, color: C.amber, flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 2 }}>Requested at</p>
                  <p style={{ fontSize: 14, color: C.textHi }}>
                    {new Date(normTs(activeRequest.created_at)).toLocaleString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Progress card */}
          <div style={{ marginBottom: 12, background: C.surface2, borderRadius: 16, border: `1px solid ${C.border}`, padding: '14px 16px' }}>
            <StatusBar status={status} />
          </div>

          {/* Action buttons row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setShowCallSheet(true)}
              style={{ flex: 1, height: 44, borderRadius: 12, border: `1.5px solid ${C.amber}55`, background: C.amber + '10', color: C.amber, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Phone style={{ width: 14, height: 14 }} /> Call
            </button>
            <button onClick={() => { setChatUnread(0); navigate(`/chat/${activeRequest.id}`) }}
              style={{ position: 'relative', flex: 1, height: 44, borderRadius: 12, border: `1.5px solid ${C.blue}55`, background: C.blue + '10', color: C.blue, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <MessageCircle style={{ width: 14, height: 14 }} /> Chat
              {chatUnread > 0 && (
                <span style={{ position: 'absolute', top: -7, right: -7, minWidth: 19, height: 19, padding: '0 5px', borderRadius: 10, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg, #0b0e1a)' }}>
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => setMapExpanded(true)}
              style={{ flex: 1, height: 44, borderRadius: 12, border: `1.5px solid ${C.green}55`, background: C.green + '10', color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Navigation2 style={{ width: 14, height: 14 }} /> Navigate
            </button>
          </div>

          {/* Arrived status: diagnosis + quote flow */}
          {status === 'arrived' && (
            <div style={{ marginBottom: 12 }}>
              {/* Diagnose button */}
              <button
                onClick={() => setShowDiagnostic(true)}
                style={{
                  width: '100%', height: 48, borderRadius: 12, border: `1px solid ${C.amber}50`,
                  background: `${C.amber}12`, color: C.amber, fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginBottom: 10,
                }}>
                <Stethoscope style={{ width: 16, height: 16 }} />
                Diagnose Vehicle with AI
              </button>

              {/* Quote form */}
              <div style={{ background: C.surface2, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px' }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  💰 Price Quote
                  {!quoteSent && <span style={{ fontSize: 11, color: C.amber, fontWeight: 600, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>(required before starting work)</span>}
                </p>
                <input type="number" placeholder="UGX amount" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)}
                  style={{ width: '100%', height: 44, marginBottom: 8, borderRadius: 10, background: C.inputBg, border: `1px solid ${C.border}`, color: C.textHi, fontSize: 16, fontWeight: 700, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
                <textarea placeholder="What did you find? (e.g. flat rear tyre — nail puncture)" value={quoteDesc} onChange={e => setQuoteDesc(e.target.value)}
                  rows={2} style={{ width: '100%', borderRadius: 10, background: C.inputBg, border: `1px solid ${C.border}`, color: C.textHi, fontSize: 13, padding: '10px 12px', outline: 'none', resize: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
                <button onClick={sendQuote} disabled={!quoteAmount}
                  style={{ width: '100%', height: 42, borderRadius: 10, border: 'none', background: quoteAmount ? `linear-gradient(135deg, ${C.amber}, ${C.amberDark})` : C.surface3, color: quoteAmount ? '#000' : C.textFaint, fontWeight: 700, fontSize: 13, cursor: quoteAmount ? 'pointer' : 'not-allowed' }}>
                  {quoteSent ? '✓ Quote sent to driver' : 'Send Quote to Driver'}
                </button>
              </div>
            </div>
          )}

          {/* In-progress: still allow updated quotes */}
          {status === 'in_progress' && (
            <div style={{ marginBottom: 12, background: C.surface2, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <button onClick={() => { setQuoteAmount(''); setQuoteDesc('') }}
                style={{ width: '100%', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: C.textMuted, fontSize: 13, fontWeight: 600 }}>
                <span>💰 Send Updated Quote</span>
              </button>
              <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.border}` }}>
                <input type="number" placeholder="UGX amount" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)}
                  style={{ width: '100%', height: 44, marginTop: 10, marginBottom: 8, borderRadius: 10, background: C.inputBg, border: `1px solid ${C.border}`, color: C.textHi, fontSize: 16, fontWeight: 700, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
                <textarea placeholder="Description…" value={quoteDesc} onChange={e => setQuoteDesc(e.target.value)}
                  rows={2} style={{ width: '100%', borderRadius: 10, background: C.inputBg, border: `1px solid ${C.border}`, color: C.textHi, fontSize: 13, padding: '10px 12px', outline: 'none', resize: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
                <button onClick={sendQuote} disabled={!quoteAmount}
                  style={{ width: '100%', height: 40, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`, color: '#000', fontWeight: 700, fontSize: 13, cursor: quoteAmount ? 'pointer' : 'not-allowed' }}>
                  {quoteSent ? 'Quote sent ✓' : 'Send to Driver'}
                </button>
              </div>
            </div>
          )}

          {/* Awaiting confirmation — mechanic initiated → waiting on the driver */}
          {isAwaitingConfirmation && mechanicInitiated && (
            <div style={{
              borderRadius: 16,
              background: 'rgba(167,139,250,0.10)',
              border: '1.5px solid rgba(167,139,250,0.35)',
              padding: '20px 18px',
              textAlign: 'center',
              marginTop: 4,
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#A78BFA', marginBottom: 6 }}>
                Waiting for driver to confirm
              </p>
              <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.55 }}>
                The driver has been notified that you marked the job as done. It auto-completes if there's no response within 30 minutes.
              </p>
            </div>
          )}

          {/* Awaiting confirmation — driver/system initiated → mechanic confirms */}
          {isAwaitingConfirmation && !mechanicInitiated && (
            <div style={{
              borderRadius: 16,
              background: 'rgba(34,197,94,0.10)',
              border: '1.5px solid rgba(34,197,94,0.35)',
              padding: '18px', marginTop: 4,
            }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: C.green, marginBottom: 4, textAlign: 'center' }}>
                {completionBy === 'system' ? 'Is this job complete?' : 'The driver marked the job as done'}
              </p>
              <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.55, textAlign: 'center', marginBottom: 14 }}>
                Confirm the work is complete to finalise the job and proceed to payment.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => updateStatus('completed')}
                  disabled={actionLoading}
                  style={{
                    width: '100%', height: 50, borderRadius: 14, border: 'none',
                    background: `linear-gradient(135deg, ${C.green}, #16A34A)`,
                    color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                  }}
                >
                  ✓ Yes, the job is complete
                </button>
                <button
                  onClick={() => updateStatus('service_started')}
                  disabled={actionLoading}
                  style={{
                    width: '100%', height: 46, borderRadius: 12,
                    background: 'var(--surface-2)', border: '1px solid var(--border-3)',
                    color: C.textMuted, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  No, not done yet
                </button>
              </div>
            </div>
          )}

          {/* Rate the driver */}
          {showRatingPrompt && (
            <div style={{
              borderRadius: 16,
              background: 'rgba(245,158,11,0.06)',
              border: '1.5px solid rgba(245,158,11,0.28)',
              padding: '16px',
              marginTop: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Star style={{ width: 16, height: 16, color: C.amber }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.textHi }}>
                    Rate {activeRequest.driver_name?.split(' ')[0] ?? 'the driver'}
                  </p>
                </div>
                <button
                  onClick={() => setRatingDismissed(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textFaint, fontSize: 18, lineHeight: 1, padding: '2px 4px' }}
                >
                  ×
                </button>
              </div>

              {/* Star row */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setDriverRating(star)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  >
                    <Star
                      style={{
                        width: 28, height: 28,
                        color: star <= driverRating ? C.amber : C.textFaint,
                        fill: star <= driverRating ? C.amber : 'transparent',
                        transition: 'color 0.15s, fill 0.15s',
                      }}
                    />
                  </button>
                ))}
              </div>

              <textarea
                placeholder="Optional comment…"
                value={driverComment}
                onChange={(e) => setDriverComment(e.target.value)}
                rows={2}
                style={{
                  width: '100%', borderRadius: 10,
                  background: C.inputBg,
                  border: `1px solid ${C.border}`,
                  color: C.textHi, fontSize: 12,
                  padding: '10px 12px', outline: 'none',
                  resize: 'none', marginBottom: 10,
                  boxSizing: 'border-box',
                }}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setRatingDismissed(true)}
                  style={{
                    flex: 1, height: 38, borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: 'transparent',
                    color: C.textMuted, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Skip
                </button>
                <button
                  onClick={submitDriverReview}
                  disabled={driverRating === 0 || isSubmittingRating}
                  style={{
                    flex: 2, height: 38, borderRadius: 10, border: 'none',
                    background: driverRating > 0 ? `linear-gradient(135deg, ${C.amber}, ${C.amberDark})` : C.surface3,
                    color: driverRating > 0 ? '#000' : C.textFaint,
                    fontSize: 13, fontWeight: 700,
                    cursor: driverRating > 0 ? 'pointer' : 'not-allowed',
                  }}
                >
                  {isSubmittingRating ? '…' : 'Submit Rating'}
                </button>
              </div>
            </div>
          )}

          {/* (Driver's photo now shown inside the Description card above.) */}

          {/* Tow-to destination — driver specified their own garage */}
          {garageDest && (
            <div style={{ marginBottom: 12, padding: 14, borderRadius: 14, background: C.surface1, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Navigation2 style={{ width: 15, height: 15, color: C.amber }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: C.textHi, letterSpacing: '0.02em' }}>TOW TO THIS GARAGE</span>
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: C.textHi }}>{garageDest.name}</div>
              {garageDest.area && <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>📍 {garageDest.area}</div>}
              {garageDest.phone && <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>📞 {garageDest.phone}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                {garageDest.phone && (
                  <a href={`tel:${garageDest.phone.replace(/[\s\-()]/g, '')}`} style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 10, background: 'rgba(245,158,11,0.14)', border: `1px solid ${C.amber}55`, color: C.amber, textDecoration: 'none', fontSize: 12.5, fontWeight: 800 }}>Call garage</a>
                )}
                {garageDest.lat != null && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${garageDest.lat},${garageDest.lng}`} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 10, background: C.surface3, border: `1px solid ${C.border}`, color: C.textMuted, textDecoration: 'none', fontSize: 12.5, fontWeight: 800 }}>Directions</a>
                )}
              </div>
            </div>
          )}

          {/* Breakdown Rescue — resolve on-site as a repair or a tow */}
          {isBreakdown && status === 'in_progress' && (
            <div style={{ marginBottom: 12, padding: 14, borderRadius: 14, background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.35)' }}>
              <p style={{ fontSize: 12.5, fontWeight: 800, color: C.textHi, marginBottom: 4 }}>Breakdown outcome</p>
              <p style={{ fontSize: 11.5, color: C.textFaint, marginBottom: 10, lineHeight: 1.5 }}>Could you fix it on the spot, or does it need towing?</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setBdOutcome('fixed'); sendMessage({ type: 'chat_message', service_request_id: String(activeRequest.id), message: '✅ Good news — I fixed your vehicle on the spot.', sender_id: 'system' }) }}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 800, border: bdOutcome === 'fixed' ? `2px solid ${C.green}` : '1px solid rgba(255,255,255,0.15)', background: bdOutcome === 'fixed' ? 'rgba(34,197,94,0.16)' : C.surface3, color: bdOutcome === 'fixed' ? C.green : C.textMuted }}>
                  🔧 Fixed on-site
                </button>
                <button
                  onClick={() => { setBdOutcome('towing'); sendMessage({ type: 'chat_message', service_request_id: String(activeRequest.id), message: '🚛 It cannot be fixed here — I will tow your vehicle to a garage.', sender_id: 'system' }) }}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 800, border: bdOutcome === 'towing' ? `2px solid ${C.amber}` : '1px solid rgba(255,255,255,0.15)', background: bdOutcome === 'towing' ? 'rgba(251,146,60,0.18)' : C.surface3, color: bdOutcome === 'towing' ? C.amber : C.textMuted }}>
                  🚛 Needs towing
                </button>
              </div>
            </div>
          )}

          {/* Main status action */}
          {action && (
            <>
              {action.disabled && (
                <p style={{ fontSize: 12, color: C.amber, textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>
                  Send a price quote to the driver before starting work
                </p>
              )}
              {needOutcome && !action.disabled && (
                <p style={{ fontSize: 12, color: C.amber, textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>
                  Choose the outcome (fixed or towing) above before completing
                </p>
              )}
              <button
                onClick={() => {
                  if (action.next === 'awaiting_confirmation') { setShowCompletion(true); return; }
                  // Starting the journey → attach the compressed-demo ETA so both
                  // apps show the same arrival window, matching the SIM_MINUTES sim.
                  if (action.next === 'en_route') {
                    updateStatus('en_route', { eta_minutes: SIM_MINUTES })
                  } else {
                    updateStatus(action.next)
                  }
                }}
                disabled={actionLoading || !!action.disabled || needOutcome}
                style={{
                  width: '100%', height: 56, borderRadius: 14, border: 'none',
                  background: (action.disabled || needOutcome)
                    ? C.surface3
                    : `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`,
                  color: (action.disabled || needOutcome) ? C.textFaint : '#000',
                  fontWeight: 800, fontSize: 16,
                  cursor: actionLoading || action.disabled ? 'not-allowed' : 'pointer',
                  marginTop: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {actionLoading ? '…' : action.label}
              </button>
            </>
          )}

          {/* Cancel — only before the work has started. Opening this always shows
              the suspension warning. */}
          {['accepted', 'en_route', 'arrived'].includes(status) && (
            <button
              onClick={() => setCancelOpen(true)}
              style={{
                width: '100%', height: 44, borderRadius: 12, marginTop: 10,
                border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)',
                color: '#EF4444', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <Ban style={{ width: 15, height: 15 }} /> Cancel this job
            </button>
          )}
        </div>
      </div>

      {cancelOpen && activeRequest && (
        <CancelJobModal
          requestId={activeRequest.id}
          onClose={() => setCancelOpen(false)}
          onCancelled={handleCancelled}
        />
      )}

      {/* Call Options Sheet */}
      {showCallSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 250 }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowCallSheet(false)}
          />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'var(--surface-1)', borderRadius: '22px 22px 0 0',
            padding: '20px 20px 40px',
            animation: 'slideUp 0.28s ease',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 22px' }} />
            <p style={{ fontSize: 17, fontWeight: 800, color: C.textHi, marginBottom: 2 }}>
              Contact {activeRequest.driver_name?.split(' ')[0] ?? 'Driver'}
            </p>
            <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 22 }}>
              {activeRequest.driver_phone ?? 'Phone not available'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Phone call */}
              <a
                href={activeRequest.driver_phone ? `tel:${activeRequest.driver_phone}` : undefined}
                onClick={() => setShowCallSheet(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14,
                  background: C.surface2, border: `1.5px solid ${C.amber}50`,
                  textDecoration: 'none',
                  opacity: activeRequest.driver_phone ? 1 : 0.5,
                  pointerEvents: activeRequest.driver_phone ? 'auto' : 'none',
                }}
              >
                <div style={{ width: 46, height: 46, borderRadius: 13, background: C.amber + '20', border: `1px solid ${C.amber}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Phone style={{ width: 20, height: 20, color: C.amber }} />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.textHi }}>Phone Call</p>
                  <p style={{ fontSize: 12, color: C.textFaint }}>Dial from your phone's dialer</p>
                </div>
              </a>

              {/* In-app voice call (coming soon) */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 14,
                background: C.surface2, border: `1.5px solid ${C.blue}30`,
                opacity: 0.55,
              }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: C.blue + '15', border: `1px solid ${C.blue}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Smartphone style={{ width: 20, height: 20, color: C.blue }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.textHi }}>In-App Voice Call</p>
                  <p style={{ fontSize: 12, color: C.textFaint }}>VoIP calling — voice over internet</p>
                </div>
                <div style={{ background: C.surface3, borderRadius: 8, padding: '3px 9px', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, letterSpacing: '0.05em' }}>SOON</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completion modal */}
      {showCompletion && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: C.surface1, borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.amber, textAlign: 'center', marginBottom: 6 }}>Service Provided</h2>
            <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              Enter the final charge and a brief note. The driver will be asked to confirm before the job is marked complete.
            </p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Final service charge (UGX):</label>
            <input type="number" placeholder="e.g. 50000" value={actualFee} onChange={e => setActualFee(e.target.value)}
              style={{ width: '100%', height: 52, borderRadius: 12, background: C.inputBg, border: `1px solid ${C.border}`, color: C.textHi, fontSize: 20, fontWeight: 700, padding: '0 16px', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
            <textarea placeholder="What did you fix? (e.g. replaced rear tyre, cleaned battery terminals)" value={serviceNote} onChange={e => setServiceNote(e.target.value)}
              rows={3} style={{ width: '100%', borderRadius: 12, background: C.inputBg, border: `1px solid ${C.border}`, color: C.textHi, fontSize: 13, padding: '12px 16px', outline: 'none', resize: 'none', marginBottom: 16, boxSizing: 'border-box' }} />
            <button onClick={() => updateStatus('awaiting_confirmation', { actual_fee: Number(actualFee), note: serviceNote })} disabled={!actualFee || actionLoading}
              style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', background: actualFee ? `linear-gradient(135deg, ${C.amber}, ${C.amberDark})` : C.surface3, color: actualFee ? '#000' : C.textFaint, fontWeight: 700, fontSize: 15, cursor: actualFee ? 'pointer' : 'not-allowed', marginBottom: 8 }}>
              {actionLoading ? '…' : 'Notify Driver – Job Done'}
            </button>
            <button onClick={() => setShowCompletion(false)}
              style={{ width: '100%', height: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* AI Diagnostic Tool overlay */}
      {showDiagnostic && activeRequest && (
        <DiagnosticTool
          serviceType={activeRequest.issue_type ?? activeRequest.service_type ?? 'vehicle fault'}
          description={activeRequest.description ?? ''}
          onDiagnosisComplete={handleDiagnosisComplete}
          onClose={() => setShowDiagnostic(false)}
        />
      )}
    </>
  )
}
