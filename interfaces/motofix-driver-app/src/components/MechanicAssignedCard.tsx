import { useState } from 'react'
import { X, MessageCircle, Phone, User, Star, Wrench, Briefcase } from 'lucide-react'
import type { MechanicPublicProfile } from '@/config/api'

const AUTH_BASE_URL = import.meta.env.VITE_API_AUTH_URL ?? ''

interface Props {
  profile: MechanicPublicProfile
  mechanicPhone?: string | null
  requestId: string
  onDismiss: () => void
  onCall: () => void
  onMessage: () => void
  unreadCount?: number
}

export default function MechanicAssignedCard({
  profile, mechanicPhone, onDismiss, onCall, onMessage, unreadCount = 0,
}: Props) {
  const [viewExpanded, setViewExpanded] = useState(false)

  const initials = profile.full_name
    .split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  const photoUrl = profile.profile_photo_url
    ? (profile.profile_photo_url.startsWith('http')
        ? profile.profile_photo_url
        : `${AUTH_BASE_URL}/${profile.profile_photo_url.replace(/^\//, '')}`)
    : null

  const garageName = profile.garage_name ?? 'Independent Mechanic'
  const specialty   = profile.specialty ?? profile.provider_type ?? 'General Mechanic'
  const rating      = profile.rating ?? 0
  const totalRatings = profile.total_ratings ?? 0
  const jobsDone    = profile.jobs_completed ?? 0

  return (
    <>
      <style>{`
        @keyframes mac-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes mac-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes mac-detail-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onDismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'mac-fade-in 0.22s ease',
        }}
      />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1101,
        maxWidth: 480, margin: '0 auto',
        borderRadius: '24px 24px 0 0',
        background: 'var(--surface-1)',
        boxShadow: '0 -12px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.10)',
        overflow: 'hidden',
        animation: 'mac-slide-up 0.36s cubic-bezier(0.34,1.56,0.64,1)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)',
      }}>

        {/* Green shimmer line */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #22C55E, transparent)' }} />

        {/* Drag handle + close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 20px 0', position: 'relative' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-3)' }} />
          <button
            onClick={onDismiss}
            style={{
              position: 'absolute', right: 16,
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--surface-3)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X style={{ width: 15, height: 15, color: 'var(--text-faint)' }} />
          </button>
        </div>

        {/* "Assigned" badge */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 16px' }}>
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

        {/* Profile section */}
        <div style={{ padding: '0 20px 4px' }}>
          {/* Photo + name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={profile.full_name}
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid rgba(245,158,11,0.45)' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 900, color: '#000',
                  border: '2.5px solid rgba(245,158,11,0.45)',
                  boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
                }}>
                  {initials}
                </div>
              )}
              {/* Online dot */}
              <div style={{
                position: 'absolute', bottom: 3, right: 3,
                width: 14, height: 14, borderRadius: '50%',
                background: '#22C55E', border: '2px solid var(--surface-1)',
              }} />
            </div>

            {/* Name + garage + rating */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-hi)', lineHeight: 1.2, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.full_name}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {garageName}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Star style={{ width: 12, height: 12, fill: '#F59E0B', color: '#F59E0B' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-hi)' }}>
                    {rating > 0 ? rating.toFixed(1) : 'New'}
                  </span>
                  {totalRatings > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>({totalRatings})</span>
                  )}
                </div>
                <span style={{ color: 'var(--border-3)', fontSize: 10 }}>•</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{jobsDone} jobs</span>
              </div>
            </div>
          </div>

          {/* Specialty tag */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 20, padding: '4px 12px',
            }}>
              <Wrench style={{ width: 11, height: 11, color: '#F59E0B' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>{specialty}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: viewExpanded ? 14 : 4 }}>
            <ActionBtn
              icon={<MessageCircle style={{ width: 18, height: 18, color: '#3B82F6' }} />}
              label="Message"
              color="#3B82F6"
              border="rgba(59,130,246,0.35)"
              bg="rgba(59,130,246,0.10)"
              onClick={onMessage}
              badge={unreadCount}
            />
            <ActionBtn
              icon={<Phone style={{ width: 18, height: 18, color: '#F59E0B' }} />}
              label="Call"
              color="#F59E0B"
              border="rgba(245,158,11,0.35)"
              bg="rgba(245,158,11,0.10)"
              onClick={onCall}
            />
            <ActionBtn
              icon={<User style={{ width: 18, height: 18, color: '#8B5CF6' }} />}
              label="View"
              color="#8B5CF6"
              border={`rgba(139,92,246,${viewExpanded ? '0.6' : '0.35'})`}
              bg={`rgba(139,92,246,${viewExpanded ? '0.18' : '0.10'})`}
              onClick={() => setViewExpanded(v => !v)}
            />
          </div>

          {/* Expanded profile details */}
          {viewExpanded && (
            <div style={{
              borderRadius: 14,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-2)',
              padding: '14px 16px',
              marginBottom: 4,
              animation: 'mac-detail-in 0.22s ease',
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
                <DetailRow
                  icon={<Briefcase style={{ width: 13, height: 13, color: '#F59E0B' }} />}
                  label="Jobs Completed"
                  value={`${jobsDone} completed jobs`}
                />
                {mechanicPhone && (
                  <DetailRow icon={<Phone style={{ width: 13, height: 13, color: '#F59E0B' }} />} label="Phone" value={mechanicPhone} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function ActionBtn({
  icon, label, color, border, bg, onClick, badge = 0,
}: {
  icon: React.ReactNode
  label: string
  color: string
  border: string
  bg: string
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        height: 52, borderRadius: 14,
        border: `1.5px solid ${border}`,
        background: bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 4,
        cursor: 'pointer',
        transition: 'filter 0.15s ease',
      }}
    >
      {icon}
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
      {badge > 0 && (
        <div style={{
          position: 'absolute', top: 6, right: 8,
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
          background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {badge > 9 ? '9+' : badge}
        </div>
      )}
    </button>
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
