// useLocation.ts — tracks the phone's live GPS position. Pass active=true to start watching
// and false to stop (saves battery). Returns the latest lat/lng, accuracy, any error, and
// whether it's watching — used to share the mechanic's position while travelling to a job.

import { useEffect, useRef, useState } from 'react'

interface LocationState {
  lat: number | null
  lng: number | null
  accuracy: number | null
  error: string | null
  isWatching: boolean
}

export function useLocation(active: boolean): LocationState {
  const watchIdRef = useRef<number | null>(null)
  const [state, setState] = useState<LocationState>({
    lat: null, lng: null, accuracy: null, error: null, isWatching: false,
  })

  useEffect(() => {
    if (!active) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
        setState(s => ({ ...s, isWatching: false }))
      }
      return
    }

    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation not supported', isWatching: false }))
      return
    }

    setState(s => ({ ...s, isWatching: true }))

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          error: null,
          isWatching: true,
        })
      },
      err => {
        setState(s => ({ ...s, error: err.message, isWatching: false }))
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [active])

  return state
}
