import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// Only initialise if all required config values are present
const isConfigured = Object.values(firebaseConfig).every(v => v && v !== 'undefined')

export const firebaseApp = isConfigured
  ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null

export async function getFirebaseMessaging() {
  if (!firebaseApp) return null
  try {
    const supported = await isSupported()
    if (!supported) return null
    return getMessaging(firebaseApp)
  } catch {
    return null
  }
}

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? ''
