import { useEffect, useState } from 'react'
import { X, TrendingUp, CheckCircle, Star, Loader2 } from 'lucide-react'
import { C } from '@/styles/tokens'
import { jobService, reviewService } from '@/config/api'
import type { ServiceRequest } from '@/types'

export type StatMetric = 'today' | 'week' | 'rating'

function startOfWeekMonday(now: Date): number {
  const d = new Date(now)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function acceptedMs(j: ServiceRequest): number {
  return new Date(j.accepted_at ?? j.created_at ?? 0).getTime()
}
function dayLabel(ms: number) {
  return new Date(ms).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })
}
function timeLabel(ms: number) {
  return new Date(ms).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })
}

interface RatingRow { rating: number; customer_name?: string }

export default function StatExplainerModal({
  metric, onClose, jobs: jobsProp, ratings: ratingsProp,
}: {
  metric: StatMetric
  onClose: () => void
  jobs?: ServiceRequest[]
  ratings?: RatingRow[]
}) {
  // The dashboard passes the already-loaded data, so the popup opens instantly.
  // Only fall back to fetching if nothing was provided.
  const preloaded = metric === 'rating' ? ratingsProp !== undefined : jobsProp !== undefined
  const [loading, setLoading] = useState(!preloaded)
  const [jobs, setJobs] = useState<ServiceRequest[]>(jobsProp ?? [])
  const [ratings, setRatings] = useState<RatingRow[]>(ratingsProp ?? [])

  useEffect(() => {
    if (preloaded) return
    const load = metric === 'rating'
      ? reviewService.getByMechanic().then(res => {
          const body = res.data as { reviews?: Array<{ rating?: number; customer_name?: string }> }
          setRatings((body?.reviews ?? []).map(r => ({ rating: Number(r.rating ?? 0), customer_name: r.customer_name })))
        })
      : jobService.getHandled().then(res => setJobs(res.data ?? []))
    load.catch(() => {}).finally(() => setLoading(false))
  }, [metric, preloaded])

  const meta = {
    today:  { icon: TrendingUp, color: '#60A5FA', title: "Today's jobs" },
    week:   { icon: CheckCircle, color: '#F59E0B', title: "This week's jobs" },
    rating: { icon: Star, color: '#4ADE80', title: 'Your rating' },
  }[metric]
  const Icon = meta.icon

  return (
    <>
      <style>{`@keyframes sem-in { from{opacity:0;transform:translate(-50%,-47%) scale(0.97)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }`}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1301,
        width: 'calc(100% - 28px)', maxWidth: 440, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        background: 'var(--surface-1)', borderRadius: 22, overflow: 'hidden',
        boxShadow: '0 24px 90px rgba(0,0,0,0.75)', animation: 'sem-in 0.26s cubic-bezier(0.34,1.4,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border-2)', flexShrink: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: `${meta.color}18`, border: `1.5px solid ${meta.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon style={{ width: 20, height: 20, color: meta.color }} />
          </div>
          <p style={{ flex: 1, fontSize: 17, fontWeight: 900, color: C.textHi }}>{meta.title}</p>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 16, height: 16, color: C.textFaint }} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 18px 20px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Loader2 style={{ width: 22, height: 22, color: C.textFaint, animation: 'spin 1s linear infinite' }} />
            </div>
          ) : metric === 'rating' ? (
            <RatingBody color={meta.color} ratings={ratings} />
          ) : (
            <JobsBody metric={metric} color={meta.color} jobs={jobs} />
          )}
        </div>
      </div>
    </>
  )
}

function Explain({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>{children}</p>
}
function CalcBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 14, padding: '14px 16px' }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>How it's calculated</p>
      {children}
    </div>
  )
}

function JobsBody({ metric, color, jobs }: { metric: 'today' | 'week'; color: string; jobs: ServiceRequest[] }) {
  const now = Date.now()
  const todayStr = new Date(now).toDateString()
  const weekStart = startOfWeekMonday(new Date(now))
  const inScope = jobs
    .filter(j => metric === 'today'
      ? new Date(acceptedMs(j)).toDateString() === todayStr
      : acceptedMs(j) >= weekStart)
    .sort((a, b) => acceptedMs(b) - acceptedMs(a))

  return (
    <>
      <Explain>
        {metric === 'today' ? (
          <>This is the number of jobs you've <strong>picked up (accepted) today</strong>. It counts from the moment you accept a request and <strong>resets at midnight (00:00)</strong> each night. Cancelled jobs don't count.</>
        ) : (
          <>This is the number of jobs you've <strong>picked up this week</strong>. The week runs <strong>Monday 00:00 to Sunday</strong> and <strong>resets every Monday</strong>. Cancelled jobs don't count.</>
        )}
      </Explain>
      <CalcBox>
        <p style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 10 }}>
          {metric === 'today'
            ? <>Counting jobs accepted on <strong style={{ color: C.textHi }}>{dayLabel(now)}</strong> (since 00:00):</>
            : <>Counting jobs accepted from <strong style={{ color: C.textHi }}>{dayLabel(weekStart)}</strong> (Mon 00:00) to now:</>}
        </p>
        {inScope.length === 0 ? (
          <p style={{ fontSize: 13, color: C.textFaint, padding: '4px 0' }}>No qualifying jobs in this window yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {inScope.map((j, i) => (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span style={{ width: 18, color: C.textFaint, flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ flex: 1, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {j.issue_type ?? j.service_type ?? 'Service'}{j.driver_name ? ` · ${j.driver_name}` : ''}
                </span>
                <span style={{ color: C.textFaint, flexShrink: 0 }}>
                  {metric === 'today' ? timeLabel(acceptedMs(j)) : dayLabel(acceptedMs(j))}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--border-2)', paddingTop: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.textHi }}>{metric === 'today' ? 'Today' : 'This Week'} =</span>
          <span style={{ fontSize: 22, fontWeight: 900, color }}>{inScope.length}</span>
        </div>
      </CalcBox>
    </>
  )
}

function RatingBody({ color, ratings }: { color: string; ratings: RatingRow[] }) {
  const count = ratings.length
  const sum = ratings.reduce((s, r) => s + (r.rating || 0), 0)
  const avg = count > 0 ? sum / count : 0

  return (
    <>
      <Explain>
        Your rating is the <strong>average of every star rating drivers have given you</strong> — the sum of all ratings divided by how many you've received. Drivers see this before accepting your quote, so it directly affects your work.
      </Explain>
      <CalcBox>
        {count === 0 ? (
          <p style={{ fontSize: 13, color: C.textFaint, padding: '4px 0' }}>No ratings yet — complete jobs to receive ratings from drivers.</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {ratings.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 18, color: C.textFaint, flexShrink: 0 }}>{i + 1}.</span>
                  <span style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                    {Array.from({ length: 5 }, (_, s) => (
                      <Star key={s} style={{ width: 12, height: 12, fill: s < r.rating ? color : 'transparent', color: s < r.rating ? color : C.textFaint }} />
                    ))}
                  </span>
                  <span style={{ flex: 1, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.rating}★{r.customer_name ? ` · ${r.customer_name}` : ''}
                  </span>
                </div>
              ))}
            </div>
            {/* The maths */}
            <div style={{ borderTop: '1px solid var(--border-2)', paddingTop: 12, fontSize: 13, color: C.textMuted, lineHeight: 1.9 }}>
              <div>Sum of ratings = {ratings.map(r => r.rating).join(' + ')} = <strong style={{ color: C.textHi }}>{sum}</strong></div>
              <div>Number of ratings = <strong style={{ color: C.textHi }}>{count}</strong></div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontWeight: 700, color: C.textHi }}>Average = {sum} ÷ {count} =</span>
                <span style={{ fontSize: 22, fontWeight: 900, color }}>{avg.toFixed(1)}</span>
              </div>
            </div>
          </>
        )}
      </CalcBox>
    </>
  )
}
