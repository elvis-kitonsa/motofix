// useFcmToken.ts — registers this device to receive push notifications.
//
// Once the user is logged in, it asks for notification permission and, if granted,
// gets a unique "FCM token" from Firebase that identifies this device. That token is
// sent to our backend so the server can push alerts (e.g. "your mechanic has arrived")
// straight to the phone. Does nothing if push isn't configured or permission is denied.

import { useEffect } from 'react'
import { getToken } from 'firebase/messaging'
import { getFirebaseMessaging, VAPID_KEY } from '@/lib/firebase'
import { authApi } from '@/config/api'

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

        const stored = localStorage.getItem('motofix_fcm_token')
        if (stored === token) return  // already registered this token

        await authApi.post('/users/me/fcm-token', { fcm_token: token })
        localStorage.setItem('motofix_fcm_token', token)
      } catch {
        // Non-fatal — push notifications are optional
      }
    }

    register()
    return () => { cancelled = true }
  }, [isAuthenticated])
}
