// 15-minute inactivity auto-logout.
//
// We record the last user-interaction time in localStorage. On every page load
// (`expireIfInactive`, called from main.tsx before React renders) we compare it to
// now — if the user has been away longer than the window, we clear the session and
// raise a flag so the app can show the "signed out for inactivity" notice.

const TIMEOUT_MS   = 15 * 60 * 1000 // 15 minutes
const TOKEN_KEY    = 'motofix_sp_token'
const USER_KEY     = 'motofix_sp_user'
const ACTIVITY_KEY = 'motofix_sp_last_activity'
const FLAG_KEY     = 'motofix_sp_inactivity_logout'

// Storage-safe wrappers — Safari with cookies/storage blocked (or Lockdown/private
// mode) throws on localStorage access; never let that crash the app at boot.
function lsGet(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function lsSet(k: string, v: string): void { try { localStorage.setItem(k, v) } catch { /* ignore */ } }
function lsDel(k: string): void { try { localStorage.removeItem(k) } catch { /* ignore */ } }

let lastWrite = 0

/** Stamp "now" as the last activity time (throttled, only while signed in). */
export function markActivity(): void {
  if (!lsGet(TOKEN_KEY)) return
  const now = Date.now()
  if (now - lastWrite < 10_000) return // throttle writes to ~once / 10s
  lastWrite = now
  lsSet(ACTIVITY_KEY, String(now))
}

/** Begin/refresh the activity clock immediately (e.g. right after login). */
export function startActivity(): void {
  if (!lsGet(TOKEN_KEY)) return
  lastWrite = Date.now()
  lsSet(ACTIVITY_KEY, String(lastWrite))
}

/**
 * If a session exists but the user has been inactive past the window, clear it and
 * set the inactivity flag. Run once at startup BEFORE anything reads the token.
 */
export function expireIfInactive(): void {
  if (!lsGet(TOKEN_KEY)) return
  const last = Number(lsGet(ACTIVITY_KEY) || 0)
  if (last && Date.now() - last > TIMEOUT_MS) {
    lsDel(TOKEN_KEY)
    lsDel(USER_KEY)
    lsDel(ACTIVITY_KEY)
    lsSet(FLAG_KEY, '1')
  }
}

export function wasInactivityLogout(): boolean {
  return lsGet(FLAG_KEY) === '1'
}

/** Clear the inactivity flag + any stale activity stamp (login / acknowledge). */
export function clearInactivity(): void {
  lsDel(FLAG_KEY)
  lsDel(ACTIVITY_KEY)
}
