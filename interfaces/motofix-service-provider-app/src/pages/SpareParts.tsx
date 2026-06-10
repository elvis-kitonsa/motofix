import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api'
import {
  ArrowLeft, Phone, Star, MapPin, X, Navigation, ShoppingBag,
  Loader2, ChevronRight, MessageCircle, ReceiptText, Clock, Wrench,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { partsService, ProviderPartsOrder } from '@/config/api'
import { toast } from 'sonner'

const LIBS: ('places')[] = ['places']
const PURPLE = '#A78BFA'

function waDigits(raw?: string): string {
  if (!raw) return ''
  let d = raw.replace(/[^\d]/g, '')
  if (d.startsWith('0')) d = '256' + d.slice(1)
  else if (!d.startsWith('256') && d.length === 9) d = '256' + d
  return d
}

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  const filled = Math.round(rating)
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} style={{ color: '#F59E0B', fill: i <= filled ? '#F59E0B' : 'none' }} />
      ))}
    </span>
  )
}

type Phase = 'locating' | 'scanning' | 'results' | 'empty'

export default function SpareParts() {
  const navigate = useNavigate()
  const { isDark } = useTheme()

  const mapRef = useRef<google.maps.Map | null>(null)
  const svcRef = useRef<google.maps.places.PlacesService | null>(null)

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [phase, setPhase] = useState<Phase>('locating')
  const [dealers, setDealers] = useState<google.maps.places.PlaceResult[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<google.maps.places.PlaceResult | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [note, setNote] = useState('')
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [orders, setOrders] = useState<ProviderPartsOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    libraries: LIBS,
  })

  useEffect(() => {
    if (!('geolocation' in navigator)) { setPhase('empty'); return }
    navigator.geolocation.getCurrentPosition(
      p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => { toast.error('Enable location to find dealers near you'); setPhase('empty') },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    svcRef.current = new google.maps.places.PlacesService(map)
    if (!pos) return
    setPhase('scanning')
    svcRef.current.nearbySearch(
      { location: pos, radius: 6000, keyword: 'auto parts spares tools', type: 'auto_parts_store' },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
          setDealers(results); setPhase('results')
        } else { setPhase('empty') }
      },
    )
  }, [pos])

  const openDealer = useCallback((place: google.maps.places.PlaceResult) => {
    if (!place.place_id) return
    setSelectedId(place.place_id)
    setDetail(place)
    setNote('')
    setDetailLoading(true)
    setSheetOpen(true)
    svcRef.current?.getDetails(
      { placeId: place.place_id, fields: ['name', 'rating', 'user_ratings_total', 'formatted_address', 'formatted_phone_number', 'opening_hours', 'website', 'url', 'geometry'] },
      (result, status) => {
        setDetailLoading(false)
        if (status === google.maps.places.PlacesServiceStatus.OK && result) setDetail(result)
      },
    )
  }, [])

  const closeSheet = () => { setSheetOpen(false); setSelectedId(null); setDetail(null); setNote('') }

  const placeOrder = useCallback(() => {
    const phone = detail?.formatted_phone_number
    const lines = [
      `Hello${detail?.name ? ' ' + detail.name : ''}, I'm a MOTOFIX service provider. I'd like to order tools / spare parts:`,
      '',
      note.trim() ? note.trim() : '(items to confirm)',
    ]
    if (pos) lines.push('', `My location: https://maps.google.com/?q=${pos.lat},${pos.lng}`)
    lines.push('', 'Are these available, and what is the total cost?')
    const text = encodeURIComponent(lines.join('\n'))
    const digits = waDigits(phone)
    window.open(digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`, '_blank')

    partsService.createOrder({
      fault_label: note.trim() || 'Tools / spare parts',
      parts: [],
      dealer_name: detail?.name ?? null,
      dealer_phone: phone ?? null,
      dealer_place_id: detail?.place_id ?? selectedId ?? null,
    })
      .then(() => toast.success('Order saved to your history'))
      .catch(() => { /* non-fatal */ })
    closeSheet()
  }, [detail, note, pos, selectedId])

  const openOrders = () => {
    setOrdersOpen(true)
    setOrdersLoading(true)
    partsService.listOrders()
      .then(r => setOrders(r.data || []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false))
  }

  // ── theme ──
  const surface = isDark ? '#111827' : '#ffffff'
  const surface2 = isDark ? '#0b0f17' : '#f5f6fa'
  const textHi = isDark ? '#f9fafb' : '#111827'
  const textMd = isDark ? '#d1d5db' : '#374151'
  const textLo = isDark ? '#9ca3af' : '#6b7280'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
  const noApiKey = !import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  return (
    <div style={{ position: 'fixed', inset: 0, background: surface2, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40,
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: isDark ? 'rgba(17,24,39,0.9)' : 'rgba(255,255,255,0.93)',
        backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}`,
      }}>
        <button onClick={() => navigate(-1)} style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0, border: 'none', cursor: 'pointer',
          background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: textHi,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: textHi }}>Spare Parts & Tools</div>
          <div style={{ fontSize: 11, color: textLo }}>Order equipment from nearby dealers</div>
        </div>
        <button onClick={openOrders} title="My orders" style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0, border: 'none', cursor: 'pointer',
          background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: textHi,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><ReceiptText size={16} /></button>
      </div>

      {/* Map */}
      {loadError || noApiKey ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, marginTop: 60 }}>
          <ShoppingBag size={36} style={{ color: PURPLE, opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: textHi }}>Map unavailable</div>
        </div>
      ) : !isLoaded || !pos ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={32} style={{ color: PURPLE, animation: 'sp-spin 1s linear infinite' }} />
        </div>
      ) : (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={pos}
          zoom={14}
          options={{ disableDefaultUI: true, gestureHandling: 'greedy', clickableIcons: false }}
          onLoad={handleMapLoad}
        >
          <Marker position={pos} zIndex={100} />
          {dealers.map(d => {
            if (!d.geometry?.location) return null
            const p = { lat: d.geometry.location.lat(), lng: d.geometry.location.lng() }
            return <Marker key={d.place_id} position={p} onClick={() => openDealer(d)} />
          })}
        </GoogleMap>
      )}

      {/* Scanning overlay */}
      {(phase === 'scanning' || phase === 'locating') && (isLoaded || phase === 'locating') && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: surface, borderRadius: 20, padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <Loader2 size={28} style={{ color: PURPLE, animation: 'sp-spin 1s linear infinite' }} />
            <div style={{ fontSize: 13, color: textMd }}>{phase === 'locating' ? 'Finding your location…' : 'Scanning nearby dealers…'}</div>
          </div>
        </div>
      )}

      {/* Empty */}
      {phase === 'empty' && (
        <div style={{ position: 'absolute', bottom: 28, left: 16, right: 16, zIndex: 30, background: surface, borderRadius: 18, padding: '22px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', border: `1px solid ${border}` }}>
          <ShoppingBag size={30} style={{ color: textLo }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: textHi }}>No dealers found nearby</div>
          <button onClick={() => navigate(-1)} style={{ padding: '10px 26px', borderRadius: 12, background: PURPLE, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}>Go Back</button>
        </div>
      )}

      {/* Dealer list tray */}
      {phase === 'results' && !sheetOpen && !ordersOpen && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, background: surface, borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', maxHeight: '46vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 0 2px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: isDark ? '#374151' : '#e5e7eb' }} />
          </div>
          <div style={{ padding: '6px 16px 10px', fontSize: 13, fontWeight: 700, color: textHi }}>{dealers.length} Dealers Nearby</div>
          <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 20 }}>
            {dealers.map((d, idx) => (
              <button key={d.place_id} onClick={() => openDealer(d)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: idx < dealers.length - 1 ? `1px solid ${border}` : 'none' }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, flexShrink: 0, background: `${PURPLE}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingBag size={18} style={{ color: PURPLE }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  {d.rating != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <Stars rating={d.rating} size={11} />
                      <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>{d.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {d.vicinity && <div style={{ fontSize: 11, color: textLo, marginTop: 1 }}>{d.vicinity}</div>}
                </div>
                <ChevronRight size={16} style={{ color: textLo, flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dealer detail sheet */}
      {sheetOpen && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 45, background: surface, borderRadius: '24px 24px 0 0', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 -16px 56px rgba(0,0,0,0.32)' }}>
          <div style={{ position: 'relative', height: 92, background: `linear-gradient(135deg, ${PURPLE}60, #6D28D9)`, borderRadius: '24px 24px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={36} style={{ color: 'rgba(255,255,255,0.6)' }} />
            <button onClick={closeSheet} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
          </div>
          <div style={{ padding: '18px 16px 36px' }}>
            {detailLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Loader2 size={26} style={{ color: PURPLE, animation: 'sp-spin 1s linear infinite' }} /></div>
            ) : (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: textHi, margin: '0 0 6px' }}>{detail?.name ?? '—'}</h2>
                {detail?.rating != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Stars rating={detail.rating} size={13} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>{detail.rating.toFixed(1)}</span>
                    {detail.user_ratings_total != null && <span style={{ fontSize: 12, color: textLo }}>({detail.user_ratings_total} reviews)</span>}
                  </div>
                )}
                {detail?.formatted_address && (
                  <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 14 }}>
                    <MapPin size={14} style={{ color: PURPLE, flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: textMd, lineHeight: 1.5 }}>{detail.formatted_address}</span>
                  </div>
                )}

                {/* Order note */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: textHi, marginBottom: 6 }}>What do you need?</div>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Socket wrench set, 2L brake fluid, spark plugs ×4"
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'none', borderRadius: 12, padding: '10px 12px', fontSize: 13, color: textHi, background: surface2, border: `1.5px solid ${border}`, outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>

                <button onClick={placeOrder} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer', background: '#25D366', color: '#fff', fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
                  <MessageCircle size={17} /> Order via WhatsApp
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  {detail?.formatted_phone_number && (
                    <a href={`tel:${detail.formatted_phone_number.replace(/[\s\-()]/g, '')}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0', borderRadius: 12, background: `${PURPLE}15`, border: `1.5px solid ${PURPLE}55`, color: PURPLE, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                      <Phone size={15} /> Call
                    </a>
                  )}
                  {detail?.url && (
                    <a href={detail.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0', borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1.5px solid ${border}`, color: textMd, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                      <Navigation size={15} /> Directions
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Orders history sheet */}
      {ordersOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: surface2, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: surface, borderBottom: `1px solid ${border}` }}>
            <button onClick={() => setOrdersOpen(false)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: textHi, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={18} /></button>
            <div style={{ fontSize: 15, fontWeight: 700, color: textHi }}>My Orders</div>
          </div>
          {ordersLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={26} style={{ color: PURPLE, animation: 'sp-spin 1s linear infinite' }} /></div>
          ) : orders.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32, textAlign: 'center' }}>
              <ShoppingBag size={34} style={{ color: textLo, opacity: 0.6 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: textHi }}>No orders yet</div>
              <div style={{ fontSize: 12.5, color: textLo }}>Orders you send to dealers will appear here.</div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {orders.map(o => (
                <div key={o.id} style={{ background: surface, borderRadius: 14, padding: 14, border: `1px solid ${border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Wrench size={15} style={{ color: PURPLE, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: textHi }}>{o.fault_label || 'Tools / spare parts'}</span>
                  </div>
                  {o.dealer_name && <div style={{ fontSize: 12.5, color: textMd, marginBottom: 4 }}>Dealer: <strong>{o.dealer_name}</strong>{o.dealer_phone ? ` · ${o.dealer_phone}` : ''}</div>}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: textLo }}>
                    <Clock size={11} /> {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes sp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
