import { useEffect } from 'react'
import { getToken } from 'firebase/messaging'
import { getFirebaseMessaging, VAPID_KEY } from '@/lib/firebase'
import axios from 'axios'

const AUTH_URL = import.meta.env.VITE_API_AUTH_URL ?? ''

export function useFcmToken(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated || !VAPID_KEY) return

    let cancelled = false

    async function register() {
      const messaging = await getFirebaseMessaging()
      if (!messaging || cancelled) return

      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted' || cancelled) return

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: await navigator.serviceWorker.register(
            '/firebase-messaging-sw.js'
          ),
        })

        if (!token || cancelled) return

        const stored = localStorage.getItem('motofix_sp_fcm_token')
        if (stored === token) return

        const authToken = localStorage.getItem('motofix_sp_token')
        await axios.post(
          `${AUTH_URL}/auth/fcm-token`,
          { fcm_token: token },
          { headers: { Authorization: `Bearer ${authToken}` } }
        )
        localStorage.setItem('motofix_sp_fcm_token', token)
      } catch {
        // Non-fatal — push notifications are optional
      }
    }

    register()
    return () => { cancelled = true }
  }, [isAuthenticated])
}
