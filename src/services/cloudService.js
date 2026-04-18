/**
 * cloudService.js
 * Primary: Google Firebase Realtime Database
 * Fallback: AWS IoT Core via WebSocket (when VITE_USE_AWS_IOT_FALLBACK=true)
 * Demo: Mock data simulation (when VITE_DEMO_MODE=true)
 */

import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, set, off } from 'firebase/database'

// ── Firebase config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

let firebaseApp = null
let db = null

function initFirebase() {
  if (!firebaseApp && import.meta.env.VITE_USE_FIREBASE === 'true') {
    try {
      firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
      db = getDatabase(firebaseApp)
      console.info('[CloudService] Firebase Realtime DB connected')
      return true
    } catch (err) {
      console.warn('[CloudService] Firebase init failed, checking fallback:', err.message)
      return false
    }
  }
  return false
}

// ── AWS IoT Core WebSocket fallback ──────────────────────────
let awsSocket = null
const awsSubscribers = new Map()

function connectAWSIoT() {
  if (import.meta.env.VITE_USE_AWS_IOT_FALLBACK !== 'true') return false
  const endpoint = import.meta.env.VITE_AWS_IOT_ENDPOINT
  if (!endpoint) return false

  try {
    // AWS IoT Core WebSocket endpoint (Cognito auth for browser clients)
    const wsUrl = `wss://${endpoint}/mqtt`
    awsSocket = new WebSocket(wsUrl)

    awsSocket.onopen = () => console.info('[CloudService] AWS IoT WebSocket connected')
    awsSocket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const topic = payload.topic || 'stadium/sensors/all'
        awsSubscribers.forEach((cb, key) => {
          if (topic.startsWith(key)) cb(payload.data)
        })
      } catch (_) { /* ignore malformed */ }
    }
    awsSocket.onerror = (err) => console.warn('[CloudService] AWS IoT error:', err)
    awsSocket.onclose = () => {
      console.warn('[CloudService] AWS IoT disconnected, retrying in 5s')
      setTimeout(connectAWSIoT, 5000)
    }
    return true
  } catch (err) {
    console.warn('[CloudService] AWS IoT failed:', err.message)
    return false
  }
}

// ── Public API ────────────────────────────────────────────────
export const CloudService = {
  /**
   * Subscribe to a data path.
   * Tries Firebase → AWS IoT → Mock (in that order)
   */
  subscribe(path, callback) {
    const useFirebase = initFirebase()

    if (useFirebase && db) {
      const dbRef = ref(db, path)
      onValue(dbRef, (snapshot) => {
        if (snapshot.exists()) callback(snapshot.val())
      })
      return () => off(dbRef)
    }

    if (import.meta.env.VITE_USE_AWS_IOT_FALLBACK === 'true') {
      connectAWSIoT()
      awsSubscribers.set(path, callback)
      return () => awsSubscribers.delete(path)
    }

    // Demo mode — no real unsubscribe needed
    console.info(`[CloudService] Demo mode — mocking path: ${path}`)
    return () => {}
  },

  /**
   * Write data to Firebase (or no-op in demo mode)
   */
  async write(path, data) {
    const useFirebase = initFirebase()
    if (useFirebase && db) {
      await set(ref(db, path), data)
    }
    // In demo mode, writes are silently accepted (no-op)
  },

  /**
   * Returns current provider name for UI display
   */
  getProvider() {
    if (import.meta.env.VITE_USE_FIREBASE === 'true' && db) return 'Google Firebase'
    if (import.meta.env.VITE_USE_AWS_IOT_FALLBACK === 'true') return 'AWS IoT Core'
    return 'Demo Simulation'
  },
}
