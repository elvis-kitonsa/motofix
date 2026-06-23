// utils/formatters.ts — small display helpers for turning raw values into nicely formatted
// text: formatUGX for shilling amounts, formatRelativeTime for "2 hours ago"-style times, etc.
// Pure formatting only — no data fetching.

export function formatUGX(amount: number): string {
  return 'UGX ' + amount.toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHrs < 6) return `${diffHrs}h ago`

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  if (isToday) {
    return 'Today ' + date.toLocaleTimeString('en-UG', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  if (isYesterday) return 'Yesterday'

  if (diffDays < 365) {
    return date.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDistance(km: number): string {
  return km.toFixed(1) + ' km'
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
