// Keeps this device in step with the SERVER's clock.
//
// The journey simulation is time-based: progress = (now − en_route_at) / duration.
// `en_route_at` is the server's time, but if we used this device's own clock to
// read "now", two devices with out-of-sync clocks (or even on different dates)
// would show the pin at different points with different ETAs. So we track the
// offset between the local clock and the server's, read for free from the `Date`
// response header that every API call already returns, and expose serverNow().
//
// Keep this file identical in both apps.

let _offsetMs = 0      // localClock − serverClock
let _haveOffset = false

// Call with the `Date` response header from any same-origin API response.
export function noteServerDate(dateHeader?: string | null) {
  if (!dateHeader) return
  const serverMs = new Date(dateHeader).getTime()
  if (isNaN(serverMs)) return
  // Date.now() here is slightly after the server generated the header (network
  // latency), but on a LAN that's a few ms — negligible against a multi-minute
  // journey, and it removes whole-minute/whole-day clock skew entirely.
  _offsetMs = Date.now() - serverMs
  _haveOffset = true
}

// "Now" expressed on the server's clock. Falls back to the local clock until the
// first API response has been seen.
export function serverNow(): number {
  return _haveOffset ? Date.now() - _offsetMs : Date.now()
}
