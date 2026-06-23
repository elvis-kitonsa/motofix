// Dashboard.tsx — the main logged-in screen and the heart of the mechanic app. It hosts the
// bottom-tab area (Home / Jobs / Earnings / Profile via pages/tabs), listens on the WebSocket
// for incoming jobs (showing the IncomingRequestModal) and live job updates, and manages the
// provider's online/offline state and active-job flow. The biggest page in this app.

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { mechanicService, jobService, notificationService, reviewService, feesService, normalizeRequest } from '@/config/api'
import { useAuth } from '@/contexts/AuthContext'
import { useWS } from '@/contexts/WebSocketContext'
import { SIM_MINUTES } from '@/hooks/useJobSim'
import TopHeader from '@/components/TopHeader'
import BottomNav from '@/components/BottomNav'
import IncomingRequestModal from '@/components/IncomingRequestModal'
import BackLogoutGuard from '@/components/BackLogoutGuard'
import Home from './tabs/Home'
import Jobs from './tabs/Jobs'
import Earnings from './tabs/Earnings'
import Profile from './tabs/Profile'
import type { MechanicProfile, ServiceRequest } from '@/types'

type Tab = 'home' | 'jobs' | 'earnings' | 'profile'

// ── Handled-job stats ─────────────────────────────────────────────────────────
// Derived from the mechanic's handled jobs (every request picked up / accepted and
// not cancelled — stored in the DB). A job counts from when it was accepted, so
// "Today" tallies pickups today (resets at 00:00) and "This Week" tallies pickups
// since Monday 00:00 (resets Sunday-midnight into Monday). Cancelled jobs are
// excluded server-side, so cancelling a pickup drops it back out of the count.
function startOfWeekMonday(now: Date): number {
  const d = new Date(now)
  const day = d.getDay()                 // 0 = Sunday
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function jobTime(j: { accepted_at?: string; created_at?: string }): number {
  // Pickup time is what counts; fall back to created_at if accepted_at is missing.
  return new Date(j.accepted_at ?? j.created_at ?? 0).getTime()
}
function computeJobStats(jobs: { accepted_at?: string; created_at?: string }[]): { today: number; week: number } {
  const now = new Date()
  const todayStr = now.toDateString()
  const weekStart = startOfWeekMonday(now)
  return {
    today: jobs.filter(j => new Date(jobTime(j)).toDateString() === todayStr).length,
    week:  jobs.filter(j => jobTime(j) >= weekStart).length,
  }
}

// Hold a freshly-dispatched job's alert this long so it appears AS the driver's
// "Request Dispatched" animation finishes (~5s), rather than mid-animation.
const DISPATCH_FOLLOW_DELAY_MS = 4500

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { lastMessage, sendMessage } = useWS()

  useLayoutEffect(() => {
    document.body.style.background = 'var(--bg)'
    return () => { document.body.style.background = '' }
  }, [])

  const [activeTab,     setActiveTab]     = useState<Tab>(
    () => ((location.state as { tab?: string } | null)?.tab as Tab) ?? 'home'
  )
  const [isAvailable,   setIsAvailable]   = useState<boolean>(
    () => localStorage.getItem('sp_availability') !== 'false'
  )
  // Platform-fee gate: once a mechanic owes the 3-job cap (UGX 30,000) they can't go
  // online until they settle. Drives the "start offline + blocked toggle" behaviour.
  const [feeGated,      setFeeGated]      = useState(false)
  const [activeRequest, setActiveRequest] = useState<ServiceRequest | null>(null)
  const [pendingAlert,  setPendingAlert]  = useState<ServiceRequest | null>(null)
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [profile,       setProfile]       = useState<MechanicProfile | null>(null)
  const [pendingCount,  setPendingCount]  = useState(0)
  const [todayCount,    setTodayCount]    = useState(0)
  const [weekCount,     setWeekCount]     = useState(0)
  // Underlying data kept so the stat-explainer popups open instantly (no re-fetch).
  const [handledJobs,   setHandledJobs]   = useState<ServiceRequest[]>([])
  const [ratingRows,    setRatingRows]    = useState<{ rating: number; customer_name?: string }[]>([])
  const declinedIds      = useRef(new Set<string>())
  const seenPendingIds   = useRef(new Set<string>())
  // Latest active job, readable inside delayed timeouts without stale closures.
  const activeRequestRef = useRef<ServiceRequest | null>(null)
  const locWatchRef      = useRef<number | null>(null)
  const lastLocSentRef   = useRef<number>(0)
  const lastChatReqRef   = useRef<string | null>(null) // latest request with an unread driver message
  const LOC_THROTTLE_MS  = 60 * 1000   // send at most once per minute

  const mechIdRef = useRef<string | number | null>(null)

  // Load handled jobs → Today / This-Week counts, and reviews → Rating
  const loadHistoryStats = useCallback(async (mechanicId?: string | number | null) => {
    if (mechanicId == null || mechanicId === '') return
    const [jobsRes, reviewsRes] = await Promise.allSettled([
      jobService.getHandled(),
      reviewService.getByMechanic(),
    ])
    if (jobsRes.status === 'fulfilled') {
      const jobs = jobsRes.value.data ?? []
      setHandledJobs(jobs)
      const s = computeJobStats(jobs)
      setTodayCount(s.today)
      setWeekCount(s.week)
    }
    if (reviewsRes.status === 'fulfilled') {
      const body = reviewsRes.value.data as { average_rating?: number; reviews?: Array<{ rating?: number; customer_name?: string }> }
      setRatingRows((body?.reviews ?? []).map(r => ({ rating: Number(r.rating ?? 0), customer_name: r.customer_name })))
      if (body?.average_rating != null) setProfile(prev => prev ? { ...prev, average_rating: body.average_rating!, rating: body.average_rating! } : prev)
    }
  }, [])

  /* ── Boot fetch ──────────────────────────────────────────────────────────────
     Each request resolves INDEPENDENTLY so a slow one never blocks the others.
     The profile (name + rating) is a fast single call, so it renders immediately
     instead of waiting on the dispatch-proxied job/pending calls. */
  useEffect(() => {
    // 1) Profile first & on its own → name + rating + stats appear right away.
    mechanicService.getProfile().then(async res => {
      const p: MechanicProfile = res.data
      setProfile(p)
      mechIdRef.current = p.id
      loadHistoryStats(p.id)
      // Check the platform-fee gate before deciding availability: a gated mechanic
      // (3 unpaid jobs) ALWAYS logs in Offline and can't go online until they pay.
      let gated = false
      try { const fr = await feesService.getFees(p.id); gated = !!fr.data?.gated } catch {}
      setFeeGated(gated)
      const explicitlyOffline = localStorage.getItem('sp_availability') === 'false'
      if (gated || explicitlyOffline) {
        setIsAvailable(false)
        localStorage.setItem('sp_availability', 'false')
        if (p.is_available) mechanicService.updateAvailability(false).catch(() => {})
      } else {
        setIsAvailable(true)
        localStorage.setItem('sp_availability', 'true')
        if (!p.is_available) mechanicService.updateAvailability(true).catch(() => {})
      }
    }).catch(() => {})

    // 2) Notifications — independent.
    notificationService.getAll().then(res => {
      setUnreadCount((res.data ?? []).filter((n: { is_read: boolean }) => !n.is_read).length)
    }).catch(() => {})

    // 3) Active job + pending — fetched together because the pending alert depends
    //    on whether there's an active job, but kept off the profile's critical path.
    Promise.allSettled([jobService.getActive(), jobService.getPending()]).then(([jobsRes, pendingRes]) => {
      let active: ServiceRequest | null = null
      if (jobsRes.status === 'fulfilled') {
        const jobs = jobsRes.value.data ?? []
        active = jobs.find(j => ['accepted', 'en_route', 'arrived', 'in_progress'].includes(j.status)) ?? null
        setActiveRequest(active)
      }
      if (pendingRes.status === 'fulfilled') {
        const pendingJobs = pendingRes.value.data ?? []
        setPendingCount(pendingJobs.length)
        pendingJobs.forEach(j => seenPendingIds.current.add(j.id))
        if (pendingJobs.length > 0 && !active) {
          const first = pendingJobs.find(j => !declinedIds.current.has(j.id))
          if (first) setPendingAlert(first)
        }
      }
    })
  }, [])

  /* ── Reset the Today / This-Week counts exactly at local midnight ──────────
     If the app is left open across midnight (or Sunday→Monday), re-pull the
     handled jobs so Today rolls to 0 and the week recomputes precisely. */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const scheduleNextMidnight = () => {
      const now = new Date()
      const next = new Date(now)
      next.setHours(24, 0, 0, 0) // next local midnight
      timer = setTimeout(() => {
        loadHistoryStats(mechIdRef.current)
        scheduleNextMidnight()
      }, next.getTime() - now.getTime())
    }
    scheduleNextMidnight()
    return () => clearTimeout(timer)
  }, [loadHistoryStats])

  /* ── Re-sync unread count when tab regains focus ─────────── */
  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await notificationService.getAll()
      setUnreadCount((res.data ?? []).filter((n: { is_read: boolean }) => !n.is_read).length)
    } catch {}
  }, [])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refreshUnreadCount() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshUnreadCount])

  // Mirror the active job into a ref so delayed timeouts see the latest value.
  useEffect(() => { activeRequestRef.current = activeRequest }, [activeRequest])

  /* ── Re-check the fee gate whenever the Home tab is shown ───────────────────
     The online toggle lives on Home, so settling fees in the Fees tab and coming
     back must free the toggle immediately. */
  useEffect(() => {
    if (activeTab !== 'home' || mechIdRef.current == null) return
    feesService.getFees(mechIdRef.current)
      .then(fr => setFeeGated(!!fr.data?.gated))
      .catch(() => {})
  }, [activeTab])

  /* ── WebSocket message handler ───────────────────────────── */
  useEffect(() => {
    const msg = lastMessage as {
      type?: string; job?: Record<string, unknown>
      service_request_id?: string; job_id?: string | number; status?: string
      message?: string; sender_id?: string; cancelled_by?: string; cancel_reason?: string
      request?: Record<string, unknown>
    } | null
    if (!msg?.type) return

    if (msg.type === 'new_job' && msg.job) {
      const req = normalizeRequest(msg.job)
      if (seenPendingIds.current.has(req.id)) return
      seenPendingIds.current.add(req.id)
      setPendingCount(c => c + 1)
      if (!declinedIds.current.has(req.id)) {
        // Hold the alert briefly so it appears AS the driver's "Request Dispatched"
        // animation completes (~5s) — instead of popping while they're mid-dispatch.
        setTimeout(() => {
          if (declinedIds.current.has(req.id)) return       // declined in the meantime
          if (activeRequestRef.current) return              // already on another job
          setPendingAlert(prev => prev ?? req)              // don't override an open alert
        }, DISPATCH_FOLLOW_DELAY_MS)
      }
    }

    // A driver can cancel a request BEFORE any mechanic accepts it. If that job is
    // the one currently popped up (incoming-job countdown), dismiss it so the timer
    // doesn't keep running for a job that no longer exists. declinedIds also stops
    // it re-surfacing from a later poll of the pending list.
    if (msg.type === 'status_update' && msg.status === 'cancelled') {
      const cid = String(msg.job_id ?? msg.service_request_id ?? '')
      if (cid) {
        declinedIds.current.add(cid)
        // Close the incoming-job popup if it's this (now-cancelled) job. The pending
        // count self-corrects on the next poll (it re-sets to the live total).
        const reason = (msg.cancel_reason || '').trim()
        setPendingAlert(prev => {
          if (prev && String(prev.id) === cid) {
            const who = prev.driver_name ?? 'The driver'
            toast(reason ? `${who} cancelled this request — “${reason}”` : `${who} cancelled this request.`,
              { icon: 'ℹ️', duration: 7000 })
            return null
          }
          return prev
        })
      }
    }

    if (msg.type === 'status_update' && activeRequest && msg.status) {
      // The backend sends the id as `job_id`; match it (string-safe) to the active job
      const rid = String(msg.job_id ?? msg.service_request_id ?? '')
      if (rid && rid === String(activeRequest.id)) {
        // The backend bundles a full request snapshot with every status_update.
        // Merge its authoritative journey fields (en_route_at, eta_minutes, the
        // other timestamps + completion_by) so the mechanic's map sim has the SAME
        // journey clock the driver does — without this the pin/route never animate
        // like the driver's. We only overlay defined fields so the richer existing
        // job (issue_type, media_files, phone, …) is preserved.
        const snap = msg.request ? normalizeRequest(msg.request) : null
        setActiveRequest(prev => {
          if (!prev) return prev
          const merged: ServiceRequest = {
            ...prev,
            status: (snap?.status ?? msg.status) as ServiceRequest['status'],
          }
          if (snap) {
            if (snap.accepted_at)        merged.accepted_at        = snap.accepted_at
            if (snap.en_route_at)        merged.en_route_at        = snap.en_route_at
            if (snap.arrived_at)         merged.arrived_at         = snap.arrived_at
            if (snap.service_started_at) merged.service_started_at = snap.service_started_at
            if (snap.completed_at)       merged.completed_at       = snap.completed_at
            if (snap.eta_minutes != null) merged.eta_minutes       = snap.eta_minutes
            if (snap.actual_fee != null)  merged.actual_fee        = snap.actual_fee
            if (snap.service_note)        merged.service_note       = snap.service_note
            const cb = msg.request?.completion_by
            if (cb) (merged as unknown as Record<string, unknown>).completion_by = cb
          }
          return merged
        })
        // Any status change can affect the counts: a cancellation drops the job
        // back out of Today / This-Week; completion keeps it and refreshes rating.
        loadHistoryStats(mechIdRef.current)
        if (msg.status === 'cancelled') {
          // The driver pulled out → make sure the mechanic isn't left in the dark,
          // and tell them WHY (the reason the driver picked when cancelling).
          if (msg.cancelled_by !== 'mechanic') {
            const who = activeRequest.driver_name ?? 'The driver'
            const reason = (msg.cancel_reason || '').trim()
            toast.error(reason ? `${who} cancelled this job — “${reason}”` : `${who} cancelled this job.`, { duration: 8000 })
          }
          setActiveRequest(null)
          switchTab('home')
        }
      }
    }

    // Incoming chat message from a driver → bell notification
    if (msg.type === 'chat_message' && msg.service_request_id) {
      const myId = String(user?.id ?? (user as any)?.phone ?? '')
      if (String(msg.sender_id ?? '') !== myId && msg.sender_id !== 'system') {
        lastChatReqRef.current = String(msg.service_request_id)
        setUnreadCount(c => c + 1)
        toast('💬 New message from the driver', { duration: 5000 })
      }
    }
  }, [lastMessage, user])

  /* ── Polling fallback: alert for new pending jobs if WS missed them ── */
  useEffect(() => {
    if (!isAvailable || activeRequest) return

    const poll = async () => {
      try {
        const res = await jobService.getPending()
        const jobs: ServiceRequest[] = res.data ?? []
        const newJobs = jobs.filter(
          j => !seenPendingIds.current.has(j.id) && !declinedIds.current.has(j.id)
        )
        jobs.forEach(j => seenPendingIds.current.add(j.id))
        setPendingCount(jobs.length)
        if (newJobs.length > 0) {
          // Only show if no alert already visible
          setPendingAlert(prev => prev ?? newJobs[0])
        }
      } catch {}
    }

    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAvailable, !!activeRequest])

  /* ── Active-job cancellation watchdog ───────────────────────
     The live WS handler above already closes a job the instant the driver cancels.
     This is the BACKUP for when that event is missed (socket drop / app backgrounded):
     while the mechanic is on a still-running job, we poll their current job; if the
     server no longer lists it, the driver pulled out, so we close it and notify exactly
     like the WS path. Gated to pre-completion statuses so finishing a job never trips it
     (the driver can't cancel once it's awaiting confirmation anyway), and it needs two
     empty polls in a row to shrug off a transient network blip. */
  useEffect(() => {
    const LIVE = ['accepted', 'en_route', 'arrived', 'in_progress']
    if (!activeRequest || !LIVE.includes(activeRequest.status)) return
    const localId = String(activeRequest.id)
    const driverName = activeRequest.driver_name ?? 'The driver'
    let stop = false
    let emptyStreak = 0
    const check = async () => {
      try {
        const res = await jobService.getActive()
        if (stop) return
        const stillMine = (res.data ?? []).some(j => String(j.id) === localId)
        if (stillMine) { emptyStreak = 0; return }
        emptyStreak += 1
        if (emptyStreak < 2) return            // ignore a single transient blip
        // The server no longer lists this live job → the driver cancelled it.
        toast.error(`${driverName} cancelled this job.`, { duration: 8000 })
        setActiveRequest(null)
        switchTab('home')
        loadHistoryStats(mechIdRef.current)
      } catch {
        emptyStreak = 0                        // network error ≠ cancellation; retry next tick
      }
    }
    const interval = setInterval(check, 8000)
    return () => { stop = true; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRequest?.id, activeRequest?.status])

  /* ── Background location auto-update ────────────────────── */
  useEffect(() => {
    const secure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
    if (!isAvailable || !navigator.geolocation || !secure) return

    const onPosition = (pos: GeolocationPosition) => {
      const now = Date.now()
      if (now - lastLocSentRef.current < LOC_THROTTLE_MS) return
      lastLocSentRef.current = now
      mechanicService.updateLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {})
    }

    locWatchRef.current = navigator.geolocation.watchPosition(onPosition, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 20_000,
    })

    return () => {
      if (locWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locWatchRef.current)
        locWatchRef.current = null
      }
    }
  }, [isAvailable])

  const switchTab = (tab: Tab) => setActiveTab(tab)

  /* ── Availability toggle ─────────────────────────────────── */
  const handleToggleAvailable = async () => {
    // Safety net: a gated mechanic can never flip to online (TopHeader already
    // intercepts the tap to show the fee warning instead of calling this).
    if (!isAvailable && feeGated) return
    const next = !isAvailable
    setIsAvailable(next)
    try {
      await mechanicService.updateAvailability(next)
      localStorage.setItem('sp_availability', String(next))
      if (next) {
        localStorage.setItem('sp_last_online', String(Date.now()))
        // Immediately broadcast current position when going online (HTTPS only)
        const secure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
        if (navigator.geolocation && secure) {
          navigator.geolocation.getCurrentPosition(
            pos => {
              lastLocSentRef.current = Date.now()
              mechanicService.updateLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {})
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10_000 }
          )
        }
      }
      toast.success(next ? 'You are now Online' : 'You are now Offline')
    } catch {
      setIsAvailable(!next)
      toast.error('Failed to update availability')
    }
  }

  /* ── Auto-compute ETA via Google Directions on accept ────── */
  const computeEtaMinutes = (driverLat: number, driverLng: number): Promise<number | null> => {
    return new Promise(resolve => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      if (!apiKey || !navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => {
          const g = (window as any).google?.maps
          if (!g) { resolve(null); return }
          new g.DirectionsService().route(
            {
              origin: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              destination: { lat: driverLat, lng: driverLng },
              travelMode: g.TravelMode.DRIVING,
            },
            (result: any, status: string) => {
              if (status === 'OK') {
                const secs = result?.routes?.[0]?.legs?.[0]?.duration?.value ?? null
                resolve(secs != null ? Math.max(1, Math.ceil(secs / 60)) : null)
              } else {
                resolve(null)
              }
            }
          )
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      )
    })
  }

  /* ── Job actions ─────────────────────────────────────────── */
  const handleAlertAccept = async (request: ServiceRequest) => {
    try {
      // Compute ETA from current position to driver's location
      let etaMinutes: number | null = null
      if (request.location_lat && request.location_lng) {
        etaMinutes = await computeEtaMinutes(request.location_lat, request.location_lng)
      }
      // Accept ONLY — sets status 'accepted' and notifies the driver once.
      // The journey (en_route → "your mechanic is on the way") is a SEPARATE,
      // explicit step: the mechanic taps "🚗 I'm On My Way" in the active job.
      // (Previously this auto-advanced to en_route, so the driver got the
      //  "accepted" + "on the way" alerts together while accept was still in flight.)
      await jobService.accept(request.id, etaMinutes)
      const now = new Date().toISOString()
      const active = { ...request, status: 'accepted' as const, accepted_at: now, eta_minutes: etaMinutes ?? undefined }
      setActiveRequest(active)
      setPendingAlert(null)
      setPendingCount(c => Math.max(0, c - 1))
      // Picking up a job counts immediately toward Today / This-Week.
      loadHistoryStats(mechIdRef.current)
      switchTab('jobs')
      toast.success("Job accepted — the driver has been notified. Tap “I'm On My Way” when you set off.")
    } catch (err) {
      // Surface the server's reason — e.g. the 402 platform-fee gate ("settle your
      // fees to accept new jobs") or the 403 cancellation suspension — not a generic message.
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Failed to accept job', { duration: detail ? 8000 : 4000 })
    }
  }

  const handleAlertDecline = (request: ServiceRequest) => {
    declinedIds.current.add(request.id)
    setPendingAlert(null)
    toast.info('Job declined.')
    jobService.reject(request.id).catch(() => {})
  }

  const handleJobCompleted = () => {
    setActiveRequest(null)
    switchTab('earnings')
    toast.success('Job completed! Payment is being processed.')
  }

  const providerType = profile?.provider_type ?? user?.provider_type ?? 'mechanic'
  const providerName = profile?.full_name ?? user?.full_name ?? 'Provider'
  const spn = (profile as unknown as { spn?: string | null })?.spn
    ?? (user as unknown as { spn?: string | null })?.spn
    ?? null

  return (
    <>
      <BackLogoutGuard onLogout={() => { logout(); navigate('/login', { replace: true }) }} />
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', overflowX: 'hidden' }}>

        {activeTab === 'home' && (
          <TopHeader
            providerName={providerName}
            providerType={providerType}
            spn={spn}
            isAvailable={isAvailable}
            onToggleAvailable={handleToggleAvailable}
            feeGated={feeGated}
            onProceedToFees={() => switchTab('earnings')}
            unreadCount={unreadCount}
            onBellClick={() => {
              setUnreadCount(0)
              // If a driver messaged us, jump straight into that chat; otherwise the list
              if (lastChatReqRef.current) {
                const rid = lastChatReqRef.current
                lastChatReqRef.current = null
                navigate(`/chat/${rid}`)
              } else {
                navigate('/notifications')
              }
            }}
            onAvatarClick={() => switchTab('profile')}
          />
        )}

        <div style={{ paddingBottom: 112, minHeight: '100vh' }}>
          {activeTab === 'home' && (
            <Home
              isAvailable={isAvailable}
              profile={profile}
              pendingCount={pendingCount}
              activeRequest={activeRequest}
              todayCount={todayCount}
              weekCount={weekCount}
              handledJobs={handledJobs}
              ratingRows={ratingRows}
              onGoToJobs={() => switchTab('jobs')}
              onGoToEarnings={() => switchTab('earnings')}
            />
          )}
          {activeTab === 'jobs' && (
            <Jobs
              isAvailable={isAvailable}
              pendingAlert={pendingAlert}
              onAlertAccept={handleAlertAccept}
              onAlertDecline={handleAlertDecline}
              lastMessage={lastMessage}
              activeRequest={activeRequest}
              sendMessage={sendMessage}
              onJobCompleted={handleJobCompleted}
            />
          )}
          {activeTab === 'earnings' && <Earnings />}
          {activeTab === 'profile'  && <Profile />}
        </div>

        <BottomNav
          activeTab={activeTab}
          onChange={switchTab}
          hasActiveJob={!!activeRequest}
          hasPendingAlert={!!pendingAlert}
        />
      </div>

      {/* Incoming request modal — renders above everything regardless of active tab */}
      {pendingAlert && isAvailable && !activeRequest && (
        <IncomingRequestModal
          request={pendingAlert}
          onAccept={() => handleAlertAccept(pendingAlert)}
          onDecline={() => handleAlertDecline(pendingAlert)}
        />
      )}

    </>
  )
}
