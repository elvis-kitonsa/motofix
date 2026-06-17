// 10-minute inactivity auto-logout.
//
// We record the last user-interaction time in localStorage. On every page load
// (`expireIfInactive`, called from main.tsx before React renders) we compare it to
// now — if the user has been away longer than the window, we clear the session and
// raise a flag so the app can show the "signed out for inactivity" notice.

const TIMEOUT_MS   = 10 * 60 * 1000 // 10 minutes
const TOKEN_KEY    = 'motofix_token'
const USER_KEY     = 'motofix_user'
const ACTIVITY_KEY = 'motofix_last_activity'
const FLAG_KEY     = 'motofix_inactivity_logout'

let lastWrite = 0

/** Stamp "now" as the last activity time (throttled, only while signed in). */
export function markActivity(): void {
  if (!localStorage.getItem(TOKEN_KEY)) return
  const now = Date.now()
  if (now - lastWrite < 10_000) return // throttle writes to ~once / 10s
  lastWrite = now
  localStorage.setItem(ACTIVITY_KEY, String(now))
}

/** Begin/refresh the activity clock immediately (e.g. right after login). */
export function startActivity(): void {
  if (!localStorage.getItem(TOKEN_KEY)) return
  lastWrite = Date.now()
  localStorage.setItem(ACTIVITY_KEY, String(lastWrite))
}

/**
 * If a session exists but the user has been inactive past the window, clear it and
 * set the inactivity flag. Run once at startup BEFORE anything reads the token.
 */
export function expireIfInactive(): void {
  if (!localStorage.getItem(TOKEN_KEY)) return
  const last = Number(localStorage.getItem(ACTIVITY_KEY) || 0)
  if (last && Date.now() - last > TIMEOUT_MS) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem('motofix_last_auth_check')
    localStorage.removeItem(ACTIVITY_KEY)
    localStorage.setItem(FLAG_KEY, '1')
  }
}

export function wasInactivityLogout(): boolean {
  return localStorage.getItem(FLAG_KEY) === '1'
}

/** Clear the inactivity flag + any stale activity stamp (login / acknowledge). */
export function clearInactivity(): void {
  localStorage.removeItem(FLAG_KEY)
  localStorage.removeItem(ACTIVITY_KEY)
}
