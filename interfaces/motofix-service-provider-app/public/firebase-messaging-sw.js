// Firebase Cloud Messaging service worker
// IMPORTANT: Update the firebaseConfig values below with your actual Firebase project config
// (same values as VITE_FIREBASE_* in your .env.local)

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyBdZQPvNrruVSNfvmy47LGdb0jsee_DlY8",
  authDomain:        "motofix-29be4.firebaseapp.com",
  projectId:         "motofix-29be4",
  storageBucket:     "motofix-29be4.firebasestorage.app",
  messagingSenderId: "383495074134",
  appId:             "1:383495074134:web:0397e340f0a8322fd866f7",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'MOTOFIX';
  const body  = payload.notification?.body  ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/motofix-logo.png',
    badge: '/motofix-logo.png',
    data: payload.data ?? {},
  });
});
