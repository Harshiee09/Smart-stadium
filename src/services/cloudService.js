/**
 * cloudService.js
 * Primary: Google Firebase Realtime Database
 * Writes live simulation state every 2.5s, reads it back in real time
 * Fallback: AWS IoT Core via WebSocket (when VITE_USE_AWS_IOT_FALLBACK=true)
 * Demo: Mock data simulation (when neither configured)
 */

import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, set, get, off, serverTimestamp } from 'firebase/database'
import { getAnalytics, logEvent } from 'firebase/analytics'

// ── Firebase config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: 'https://stadium-nexus-447ab-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'stadium-nexus-447ab',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'stadium-nexus-447ab.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

let firebaseApp = null
let db = null
let analytics = null
let firebaseReady = false

function initFirebase() {
  if (firebaseReady) return true
  try {
    firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
    db = getDatabase(firebaseApp)

    // Init Analytics if measurementId available
    try {
      if (firebaseConfig.measurementId) {
        analytics = getAnalytics(firebaseApp)
        logEvent(analytics, 'app_open', { platform: 'stadium_nexus' })
      }
    } catch (_) { /* analytics optional */ }

    firebaseReady = true
    console.info('[CloudService] ✅ Firebase Realtime DB connected:', firebaseConfig.databaseURL)
    return true
  } catch (err) {
    console.warn('[CloudService] Firebase init failed:', err.message)
    return false
  }
}

// ── AWS IoT Core WebSocket fallback ──────────────────────────
let awsSocket = null
const awsSubscribers = new Map()

function connectAWSIoT() {
  if (import.meta.env.VITE_USE_AWS_IOT_FALLBACK !== 'true') return false
  const endpoint = import.meta.env.VITE_AWS_IOT_ENDPOINT
  if (!endpoint) return false
  try {
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
      } catch (_) { }
    }
    awsSocket.onerror = (err) => console.warn('[CloudService] AWS IoT error:', err)
    awsSocket.onclose = () => { setTimeout(connectAWSIoT, 5000) }
    return true
  } catch (err) {
    console.warn('[CloudService] AWS IoT failed:', err.message)
    return false
  }
}

// ── Public API ────────────────────────────────────────────────
export const CloudService = {

  /**
   * Write the full live stadium state to Firebase Realtime DB.
   * Called every 2.5s by the simulation hook.
   */
  async pushLiveState(state) {
    if (!initFirebase() || !db) return
    try {
      await set(ref(db, 'stadium/live'), {
        ...state,
        _updatedAt: Date.now(),
      })
    } catch (err) {
      console.warn('[CloudService] pushLiveState failed:', err.message)
    }
  },

  /**
   * Write a fan's session data (ticket + assigned gate) to Firebase.
   */
  async writeFanSession(fanId, fanData) {
    if (!initFirebase() || !db) return
    try {
      await set(ref(db, `stadium/fans/${fanId}`), {
        ...fanData,
        _joinedAt: Date.now(),
      })
    } catch (err) {
      console.warn('[CloudService] writeFanSession failed:', err.message)
    }
  },

  /**
   * Write an alert event to Firebase for staff dashboard.
   */
  async writeAlert(alert) {
    if (!initFirebase() || !db) return
    try {
      const alertId = `alert_${Date.now()}`
      await set(ref(db, `stadium/alerts/${alertId}`), {
        ...alert,
        timestamp: Date.now(),
      })
    } catch (err) {
      console.warn('[CloudService] writeAlert failed:', err.message)
    }
  },

  /**
   * Subscribe to a Firebase path for real-time updates.
   * Falls back to AWS IoT or demo mode.
   */
  subscribe(path, callback) {
    if (initFirebase() && db) {
      const dbRef = ref(db, path)
      onValue(dbRef, (snapshot) => {
        if (snapshot.exists()) callback(snapshot.val())
      }, (err) => {
        console.warn('[CloudService] subscribe error:', err.message)
      })
      return () => off(dbRef)
    }

    if (import.meta.env.VITE_USE_AWS_IOT_FALLBACK === 'true') {
      connectAWSIoT()
      awsSubscribers.set(path, callback)
      return () => awsSubscribers.delete(path)
    }

    console.info(`[CloudService] Demo mode — path: ${path}`)
    return () => { }
  },

  /**
   * One-time read from Firebase.
   */
  async read(path) {
    if (!initFirebase() || !db) return null
    try {
      const snapshot = await get(ref(db, path))
      return snapshot.exists() ? snapshot.val() : null
    } catch (err) {
      console.warn('[CloudService] read failed:', err.message)
      return null
    }
  },

  /**
   * Generic write — used for any path.
   */
  async write(path, data) {
    if (!initFirebase() || !db) return
    try {
      await set(ref(db, path), data)
    } catch (err) {
      console.warn('[CloudService] write failed:', err.message)
    }
  },

  /**
   * Log an analytics event (Google Analytics via Firebase).
   */
  logEvent(eventName, params = {}) {
    if (analytics) {
      try { logEvent(analytics, eventName, params) } catch (_) { }
    }
  },

  /**
   * Returns current provider name for UI display.
   */
  getProvider() {
    if (firebaseReady && db) return 'Google Firebase'
    if (import.meta.env.VITE_USE_AWS_IOT_FALLBACK === 'true') return 'AWS IoT Core'
    return 'Demo Simulation'
  },
}