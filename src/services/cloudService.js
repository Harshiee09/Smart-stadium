/**
 * cloudService.js
 * Google Cloud integration layer for Stadium Nexus
 *
 * Services used:
 *  - Firebase Realtime Database  (live state reads/writes)
 *  - Firebase Analytics          (event tracking)
 *  - Google Cloud Functions      (crowd prediction, alert routing)
 *  - Vertex AI / Gemini API      (ML-based crowd density forecast)
 *  - AWS IoT Core WebSocket      (fallback sensor feed)
 *
 * @module cloudService
 */

import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, set, get, off } from 'firebase/database'
import { getAnalytics, logEvent } from 'firebase/analytics'

// ── Firebase configuration ────────────────────────────────────

/** @type {import('firebase/app').FirebaseOptions} */
const FIREBASE_CONFIG = Object.freeze({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: 'https://stadium-nexus-447ab-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'stadium-nexus-447ab',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'stadium-nexus-447ab.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
})

/**
 * Google Cloud Functions base URL (Firebase Hosting rewrites or direct Cloud Run).
 * Falls back to a mock endpoint so the code path still executes in demo mode.
 * @type {string}
 */
const CLOUD_FUNCTIONS_BASE =
  import.meta.env.VITE_CLOUD_FUNCTIONS_URL ||
  `https://us-central1-${FIREBASE_CONFIG.projectId}.cloudfunctions.net`

/**
 * Vertex AI / Gemini REST endpoint for crowd prediction model.
 * @type {string}
 */
const VERTEX_AI_ENDPOINT =
  import.meta.env.VITE_VERTEX_AI_ENDPOINT ||
  `https://us-central1-aiplatform.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/locations/us-central1/publishers/google/models/gemini-1.5-flash:generateContent`

// ── Module-level singletons ───────────────────────────────────

/** @type {import('firebase/app').FirebaseApp|null} */
let firebaseApp = null

/** @type {import('firebase/database').Database|null} */
let db = null

/** @type {import('firebase/analytics').Analytics|null} */
let analytics = null

/** @type {boolean} */
let firebaseReady = false

// ── AWS IoT WebSocket (fallback) ──────────────────────────────

/** @type {WebSocket|null} */
let awsSocket = null

/** @type {Map<string, Function>} */
const awsSubscribers = new Map()

// ── Internal helpers ──────────────────────────────────────────

/**
 * Initialise Firebase once and cache the result.
 * @returns {boolean} Whether Firebase is available.
 */
function initFirebase() {
  if (firebaseReady) return true
  try {
    firebaseApp = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
    db = getDatabase(firebaseApp)

    // Analytics — optional, requires measurementId
    if (FIREBASE_CONFIG.measurementId) {
      try {
        analytics = getAnalytics(firebaseApp)
        logEvent(analytics, 'app_open', { platform: 'stadium_nexus', version: '2.0' })
      } catch (_) { /* non-fatal */ }
    }

    firebaseReady = true
    console.info('[CloudService] ✅ Firebase connected:', FIREBASE_CONFIG.databaseURL)
    return true
  } catch (err) {
    console.warn('[CloudService] Firebase init failed:', err.message)
    return false
  }
}

/**
 * Connect to AWS IoT Core via WebSocket (fallback path).
 * Reconnects automatically after 5 s on disconnect.
 * @returns {boolean} Whether the connection was attempted.
 */
function connectAWSIoT() {
  if (import.meta.env.VITE_USE_AWS_IOT_FALLBACK !== 'true') return false
  const endpoint = import.meta.env.VITE_AWS_IOT_ENDPOINT
  if (!endpoint) return false

  try {
    awsSocket = new WebSocket(`wss://${endpoint}/mqtt`)
    awsSocket.onopen = () =>
      console.info('[CloudService] AWS IoT WebSocket connected')
    awsSocket.onmessage = ({ data }) => {
      try {
        const payload = JSON.parse(data)
        const topic = payload.topic ?? 'stadium/sensors/all'
        awsSubscribers.forEach((cb, key) => {
          if (topic.startsWith(key)) cb(payload.data)
        })
      } catch (_) { /* malformed frame — ignore */ }
    }
    awsSocket.onerror = err => console.warn('[CloudService] AWS IoT error:', err)
    awsSocket.onclose = () => setTimeout(connectAWSIoT, 5_000)
    return true
  } catch (err) {
    console.warn('[CloudService] AWS IoT connection failed:', err.message)
    return false
  }
}

/**
 * POST to a Google Cloud Function with JSON body.
 * Resolves to null on any error so callers degrade gracefully.
 *
 * @template T
 * @param {string} fnName - Cloud Function name (appended to base URL).
 * @param {object} body   - JSON-serialisable request body.
 * @returns {Promise<T|null>}
 */
async function callCloudFunction(fnName, body) {
  try {
    const res = await fetch(`${CLOUD_FUNCTIONS_BASE}/${fnName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    // In demo / local mode the endpoint won't exist — this is expected.
    console.info(`[CloudService] Cloud Function ${fnName} unavailable:`, err.message)
    return null
  }
}

/**
 * Call Vertex AI / Gemini to generate a crowd density forecast.
 * Returns a plain-text prediction string, or null on failure.
 *
 * @param {object} stadiumState - Current live stadium state snapshot.
 * @returns {Promise<string|null>}
 */
async function callVertexAICrowdForecast(stadiumState) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) return null

  const prompt =
    `You are a crowd safety AI for a 45,200-seat stadium. ` +
    `Given: ${stadiumState.wristbands?.total ?? 0} fans, ` +
    `gate loads ${(stadiumState.gates ?? []).map(g => `${g.id}:${g.load}%`).join(', ')}, ` +
    `match minute ${stadiumState.matchMin ?? 0}. ` +
    `Provide a 1-sentence crowd movement forecast for the next 10 minutes.`

  try {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 80 },
      }),
    })
    if (!res.ok) throw new Error(`Vertex AI HTTP ${res.status}`)
    const json = await res.json()
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch (err) {
    console.info('[CloudService] Vertex AI forecast unavailable:', err.message)
    return null
  }
}

// ── Public API ────────────────────────────────────────────────

export const CloudService = {

  // ── Firebase Realtime Database ──────────────────────────────

  /**
   * Write the full live stadium state to Firebase Realtime DB.
   * Called every 2.5 s by the simulation hook.
   *
   * @param {object} state - Serialisable stadium state snapshot.
   * @returns {Promise<void>}
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
   * Write a fan session record (ticket + assigned gate) to Firebase.
   *
   * @param {string} fanId   - Unique fan identifier.
   * @param {object} fanData - Ticket and routing data.
   * @returns {Promise<void>}
   */
  async writeFanSession(fanId, fanData) {
    if (!fanId || !fanData) return
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
   * Write an alert event to Firebase for the staff dashboard.
   *
   * @param {{ type: string, message: string, severity: string }} alert
   * @returns {Promise<void>}
   */
  async writeAlert(alert) {
    if (!alert?.type) return
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
   * Subscribe to a Firebase Realtime DB path.
   * Falls back to AWS IoT WebSocket or demo no-op.
   *
   * @param {string}   path     - Firebase database path.
   * @param {Function} callback - Called with the snapshot value.
   * @returns {Function} Unsubscribe function.
   */
  subscribe(path, callback) {
    if (typeof callback !== 'function') return () => { }

    if (initFirebase() && db) {
      const dbRef = ref(db, path)
      onValue(dbRef, snapshot => {
        if (snapshot.exists()) callback(snapshot.val())
      }, err => {
        console.warn('[CloudService] subscribe error:', err.message)
      })
      return () => off(dbRef)
    }

    if (import.meta.env.VITE_USE_AWS_IOT_FALLBACK === 'true') {
      connectAWSIoT()
      awsSubscribers.set(path, callback)
      return () => awsSubscribers.delete(path)
    }

    console.info(`[CloudService] Demo mode — subscribing to path: ${path}`)
    return () => { }
  },

  /**
   * One-time read from a Firebase path.
   *
   * @param {string} path - Firebase database path.
   * @returns {Promise<*>} Value at that path, or null.
   */
  async read(path) {
    if (!path) return null
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
   * Generic write to any Firebase path.
   *
   * @param {string} path - Firebase database path.
   * @param {*}      data - JSON-serialisable value.
   * @returns {Promise<void>}
   */
  async write(path, data) {
    if (!path) return
    if (!initFirebase() || !db) return
    try {
      await set(ref(db, path), data)
    } catch (err) {
      console.warn('[CloudService] write failed:', err.message)
    }
  },

  // ── Google Cloud Functions ──────────────────────────────────

  /**
   * Invoke the `crowdPredict` Cloud Function to get a congestion
   * forecast for the next wave of fans.
   *
   * @param {object} state - Current stadium state.
   * @returns {Promise<{ predictedLoad: number, recommendedGate: string }|null>}
   */
  async getCrowdPrediction(state) {
    const result = await callCloudFunction('crowdPredict', {
      gates: state.gates ?? [],
      matchMin: state.matchMin ?? 0,
      total: state.wristbands?.total ?? 0,
    })
    return result
  },

  /**
   * Invoke the `routeOptimise` Cloud Function to get an AI-optimised
   * exit route for a specific fan.
   *
   * @param {{ stand: string, row: string, hasParking: boolean }} fanData
   * @param {object} liveState - Current live stadium state.
   * @returns {Promise<{ route: string[], estimatedMinutes: number }|null>}
   */
  async getOptimisedRoute(fanData, liveState) {
    if (!fanData?.stand) return null
    const result = await callCloudFunction('routeOptimise', {
      stand: fanData.stand,
      row: fanData.row ?? 'A',
      hasParking: fanData.hasParking ?? false,
      gates: liveState.gates ?? [],
      matchMin: liveState.matchMin ?? 0,
    })
    return result
  },

  /**
   * Invoke the `alertRouter` Cloud Function to distribute a stadium
   * alert to the correct staff channels.
   *
   * @param {{ type: string, gate?: string, severity: string, message: string }} alertPayload
   * @returns {Promise<{ routed: boolean }|null>}
   */
  async routeAlert(alertPayload) {
    if (!alertPayload?.type) return null
    return callCloudFunction('alertRouter', alertPayload)
  },

  // ── Vertex AI / Gemini ML ───────────────────────────────────

  /**
   * Request a Vertex AI crowd density forecast for the next 10 minutes.
   * Uses the Gemini 1.5 Flash model via the Generative Language API.
   *
   * @param {object} stadiumState - Current live stadium state.
   * @returns {Promise<string|null>} Natural-language forecast, or null.
   */
  async getVertexCrowdForecast(stadiumState) {
    return callVertexAICrowdForecast(stadiumState)
  },

  // ── Firebase Analytics ──────────────────────────────────────

  /**
   * Log a named event to Google Analytics (via Firebase).
   *
   * @param {string} eventName        - GA4 event name.
   * @param {object} [params={}]      - Additional event parameters.
   * @returns {void}
   */
  logEvent(eventName, params = {}) {
    if (!eventName) return
    if (analytics) {
      try { logEvent(analytics, eventName, params) } catch (_) { /* non-fatal */ }
    }
  },

  // ── Utility ─────────────────────────────────────────────────

  /**
   * Returns a human-readable label for the active data provider.
   * Displayed in the app footer / debug overlay.
   *
   * @returns {string}
   */
  getProvider() {
    if (firebaseReady && db) return 'Google Firebase + Cloud'
    if (import.meta.env.VITE_USE_AWS_IOT_FALLBACK === 'true') return 'AWS IoT Core'
    return 'Demo Simulation'
  },
}