// MechanicAssignedCard.tsx — the card the driver sees once a mechanic takes the job.
// Shows the mechanic's public profile (photo, rating, reviews, specialty) and quick
// actions to call or chat. Falls back to a stock avatar when the mechanic hasn't
// uploaded a photo.

import { useState } from 'react'
import { X, MessageCircle, Phone, Star, Wrench, Briefcase, Store, BadgeCheck, ChevronDown } from 'lucide-react'
import type { MechanicPublicProfile, MechanicReview } from '@/config/api'

const AUTH_BASE_URL = import.meta.env.VITE_API_AUTH_URL ?? ''

// How many stock pictures live in /public/avatars (mechanic-1.jpg … mechanic-N.jpg).
// Used only when a mechanic has no uploaded profile_photo_url. See that folder's README.
const DEFAULT_AVATAR_COUNT = 6

interface Props {
  profile: MechanicPublicProfile
  mechanicPhone?: string | null
  requestId: string
  onDismiss: () => void
  onCall: () => void
  onMessage: () => void
  unreadCount?: number
}

// Build the ordered list of image URLs to try for this mechanic, best first:
//   1) their real uploaded photo  2) a stable stock photo picked by id
//   3) the bundled default.svg. If every one fails to load we fall back to initials.
function buildPhotoCandidates(profile: MechanicPublicProfile): string[] {
  const out: string[] = []
  if (profile.profile_photo_url) {
    out.push(
      profile.profile_photo_url.startsWith('http')
        ? profile.profile_photo_url
        : `${AUTH_BASE_URL}/${profile.profile_photo_url.replace(/^\//, '')}`,
    )
  }
  // Deterministic pick so the same mechanic always gets the same stock face.
  const seed = Number.isFinite(profile.id) ? profile.id : 0
  const idx = (Math.abs(seed) % DEFAULT_AVATAR_COUNT) + 1
  out.push(`/avatars/mechanic-${idx}.jpg`)
  out.push('/avatars/default.svg')
  return out
}

export default function MechanicAssignedCard({
  profile, mechanicPhone, onDismiss, onCall, onMessage, unreadCount = 0,
}: Props) {
  const [viewExpanded, setViewExpanded] = useState(false)
  // Walk the candidate photos on load error; once we run past the end, show initials.
  const candidates = buildPhotoCandidates(profile)
  const [photoIdx, setPhotoIdx] = useState(0)
  const photoSrc = photoIdx < candidates.length ? candidates[photoIdx] : null

  const initials = profile.full_name
    .split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  const garageName  = profile.garage_name ?? 'Independent Mechanic'
  const hasGarage   = !!profile.garage_name
  const specialty   = profile.specialty ?? profile.provider_type ?? 'General Mechanic'
  const rating      = profile.rating ?? 0
  const totalRatings = profile.total_ratings ?? 0
  const jobsDone    = profile.jobs_completed ?? 0
  const reviews     = profile.reviews ?? []

  return (
    <>
      <style>{`
        @keyframes mac-slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes mac-fade-in  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mac-detail-in{ from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .mac-action:active { filter: brightness(1.12); transform: translateY(1px); }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onDismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.66)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          animation: 'mac-fade-in 0.22s ease',
        }}
      />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1101,
        maxWidth: 480, margin: '0 auto',
        borderRadius: '26px 26px 0 0',
        background: 'var(--surface-1)',
        boxShadow: '0 -12px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
        overflow: 'hidden',
        animation: 'mac-slide-up 0.36s cubic-bezier(0.34,1.56,0.64,1)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)',
      }}>

        {/* Drag handle + close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 20px 0', position: 'relative' }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border-3)' }} />
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{
              position: 'absolute', top: 18, right: 18, width: 32, height: 32, borderRadius: '50%',
              background: 'var(--surface-3)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X style={{ width: 15, height: 15, color: 'var(--text-faint)' }} />
          </button>
        </div>

        {/* "Assigned" badge */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 14px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
            borderRadius: 20, padding: '5px 14px',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 6px #22C55E' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#22C55E', letterSpacing: '0.06em' }}>
              MECHANIC ASSIGNED
            </span>
          </div>
        </div>

        <div style={{ padding: '0 20px 6px' }}>
          {/* Hero: avatar + name + rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt={profile.full_name}
                  onError={() => setPhotoIdx(i => i + 1)}
                  style={{
                    width: 84, height: 84, borderRadius: '50%', objectFit: 'cover',
                    border: '2.5px solid rgba(245,158,11,0.5)',
                    boxShadow: '0 6px 22px rgba(0,0,0,0.35)',
                  }}
                />
              ) : (
                <div style={{
                  width: 84, height: 84, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 900, color: '#000',
                  border: '2.5px solid rgba(245,158,11,0.5)',
                  boxShadow: '0 6px 22px rgba(245,158,11,0.3)',
                }}>
                  {initials}
                </div>
              )}
              {/* Online dot */}
              <div style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 16, height: 16, borderRadius: '50%',
                background: '#22C55E', border: '3px solid var(--surface-1)',
              }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <p style={{ fontSize: 21, fontWeight: 900, color: 'var(--text-hi)', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                  {profile.full_name}
                </p>
                <BadgeCheck style={{ width: 17, height: 17, color: '#3B82F6', flexShrink: 0 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Star style={{ width: 13, height: 13, fill: '#F59E0B', color: '#F59E0B' }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-hi)' }}>
                    {rating > 0 ? rating.toFixed(1) : 'New'}
                  </span>
                  {totalRatings > 0 && (
                    <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>({totalRatings})</span>
                  )}
                </div>
                <span style={{ color: 'var(--border-3)', fontSize: 10 }}>•</span>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{jobsDone} jobs done</span>
              </div>
            </div>
          </div>

          {/* Garage / business — prominent banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: hasGarage
              ? 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.05))'
              : 'var(--surface-2)',
            border: `1px solid ${hasGarage ? 'rgba(245,158,11,0.30)' : 'var(--border-2)'}`,
            borderRadius: 14, padding: '12px 14px', marginBottom: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              background: hasGarage ? 'rgba(245,158,11,0.18)' : 'var(--surface-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Store style={{ width: 19, height: 19, color: hasGarage ? '#F59E0B' : 'var(--text-faint)' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                {hasGarage ? 'Works at' : 'Provider'}
              </p>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                {garageName}
              </p>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
              background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.22)',
              borderRadius: 16, padding: '4px 10px',
            }}>
              <Wrench style={{ width: 10, height: 10, color: '#F59E0B' }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#F59E0B', maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{specialty}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <button
              className="mac-action"
              onClick={onMessage}
              style={{
                position: 'relative', height: 54, borderRadius: 15, border: 'none',
                background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                boxShadow: '0 4px 16px rgba(59,130,246,0.32)',
              }}
            >
              <MessageCircle style={{ width: 19, height: 19 }} />
              <span style={{ fontSize: 14.5, fontWeight: 800 }}>Message</span>
              {unreadCount > 0 && (
                <div style={{
                  position: 'absolute', top: 7, right: 10,
                  minWidth: 19, height: 19, padding: '0 5px', borderRadius: 10,
                  background: '#EF4444', color: '#fff', fontSize: 10.5, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #2563EB',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </div>
              )}
            </button>
            <button
              className="mac-action"
              onClick={onCall}
              style={{
                height: 54, borderRadius: 15,
                border: '1.5px solid rgba(245,158,11,0.45)',
                background: 'rgba(245,158,11,0.12)', color: '#F59E0B', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              }}
            >
              <Phone style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 14.5, fontWeight: 800 }}>Call</span>
            </button>
          </div>

          {/* View full profile toggle */}
          <button
            onClick={() => setViewExpanded(v => !v)}
            style={{
              width: '100%', height: 42, borderRadius: 12,
              border: '1px solid var(--border-2)', background: 'var(--surface-2)',
              color: 'var(--text-md)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              marginBottom: viewExpanded ? 12 : 2,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>{viewExpanded ? 'Hide profile' : 'View full profile'}</span>
            <ChevronDown style={{ width: 15, height: 15, transition: 'transform 0.2s ease', transform: viewExpanded ? 'rotate(180deg)' : 'none' }} />
          </button>

          {/* Expanded profile details */}
          {viewExpanded && (
            <div style={{
              borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border-2)',
              padding: '14px 16px', marginBottom: 4, animation: 'mac-detail-in 0.22s ease',
            }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
                Provider Details
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <DetailRow icon={<Briefcase style={{ width: 13, height: 13, color: '#F59E0B' }} />} label="Workplace" value={garageName} />
                <DetailRow icon={<Wrench    style={{ width: 13, height: 13, color: '#F59E0B' }} />} label="Specialty" value={specialty} />
                <DetailRow
                  icon={<Star style={{ width: 13, height: 13, color: '#F59E0B' }} />}
                  label="Rating"
                  value={rating > 0 ? `${rating.toFixed(1)} / 5 (${totalRatings} reviews)` : 'No ratings yet'}
                />
                <DetailRow icon={<Briefcase style={{ width: 13, height: 13, color: '#F59E0B' }} />} label="Jobs Completed" value={`${jobsDone} completed jobs`} />
                {mechanicPhone && (
                  <DetailRow icon={<Phone style={{ width: 13, height: 13, color: '#F59E0B' }} />} label="Phone" value={mechanicPhone} />
                )}
              </div>

              {/* Recent customer reviews */}
              {reviews.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-2)' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
                    Recent Reviews
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {reviews.map((rev, i) => (
                      <ReviewRow key={i} review={rev} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Short relative time, e.g. "2d ago", "3w ago", "just now".
function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(/[Z+]/.test(iso) ? iso : iso + 'Z').getTime()
  if (isNaN(then)) return ''
  const s = Math.max(0, (Date.now() - then) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60; if (m < 60) return `${Math.floor(m)}m ago`
  const h = m / 60; if (h < 24) return `${Math.floor(h)}h ago`
  const d = h / 24; if (d < 7) return `${Math.floor(d)}d ago`
  const w = d / 7; if (w < 5) return `${Math.floor(w)}w ago`
  const mo = d / 30; if (mo < 12) return `${Math.floor(mo)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

function ReviewRow({ review }: { review: MechanicReview }) {
  const stars = Math.round(review.rating)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <Star
              key={n}
              style={{
                width: 12, height: 12,
                fill: n <= stars ? '#F59E0B' : 'transparent',
                color: n <= stars ? '#F59E0B' : 'var(--border-3)',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {review.reviewer_name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0, marginLeft: 'auto' }}>
          {relativeTime(review.created_at)}
        </span>
      </div>
      {review.comment && (
        <p style={{ fontSize: 12.5, color: 'var(--text-md)', lineHeight: 1.45, margin: 0 }}>
          "{review.comment}"
        </p>
      )}
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-hi)' }}>{value}</p>
      </div>
    </div>
  )
}
