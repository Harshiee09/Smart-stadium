/**
 * useStadiumData.js
 * Central state manager for all live stadium data.
 *
 * Data flow:
 *  1. Generates a new simulation tick every 2.5 s via `generateLiveState`
 *  2. Writes the state to Google Firebase Realtime DB (via CloudService)
 *  3. Listens for Firebase updates to merge cloud-sourced overrides
 *  4. Every 30 s: calls Google Cloud Functions for crowd prediction
 *  5. Every 30 s: calls Vertex AI for a natural-language crowd forecast
 *  6. Derives a crowd insight string for the dashboard header
 *
 * @module useStadiumData
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { generateLiveState } from '../data/mockData'
import { CloudService } from '../services/cloudService'
import { generateCrowdInsight } from '../services/geminiService'

/** Simulation tick interval in milliseconds. */
const UPDATE_INTERVAL_MS = 2_500

/** How often to call Cloud Functions / Vertex AI (ms). */
const ML_REFRESH_INTERVAL_MS = 30_000

/**
 * Custom hook that drives all live stadium data.
 *
 * @returns {{
 *   state:            object,
 *   crowdInsight:     string,
 *   vertexForecast:   string|null,
 *   crowdPrediction:  object|null,
 *   provider:         string,
 * }}
 */
export function useStadiumData() {
  const [state, setState] = useState(() => generateLiveState(null))
  const [crowdInsight, setCrowdInsight] = useState('')
  const [vertexForecast, setVertexForecast] = useState(null)
  const [crowdPrediction, setCrowdPrediction] = useState(null)
  const [provider, setProvider] = useState('Initialising...')

  /** Ref keeps the interval callback from closing over stale state. */
  const stateRef = useRef(state)
  const intervalRef = useRef(null)
  const mlTimerRef = useRef(null)

  stateRef.current = state

  // ── Simulation tick ─────────────────────────────────────────

  /** Advance the simulation by one tick and push to Firebase. */
  const tick = useCallback(() => {
    setState(prev => {
      const next = generateLiveState(prev)

      // Fire-and-forget: push to Firebase Realtime DB
      CloudService.pushLiveState(next).catch(() => { })

      // Log high-load gate events to Firebase Analytics
      const overloaded = (next.gates ?? []).filter(g => g.load > 90 && !g.disabled)
      if (overloaded.length > 0) {
        CloudService.logEvent('gate_overload', {
          gates: overloaded.map(g => g.id).join(','),
          matchMin: next.matchMin,
        })
        // Also route alert via Cloud Function
        overloaded.forEach(g => {
          CloudService.routeAlert({
            type: 'GATE_OVERLOAD',
            gate: g.id,
            severity: 'HIGH',
            message: `Gate ${g.id} at ${g.load.toFixed(0)}% — crowd dispersal recommended`,
          }).catch(() => { })
        })
      }

      return next
    })
  }, [])

  // ── ML / Cloud Function refresh ─────────────────────────────

  /** Fetch Cloud Function crowd prediction + Vertex AI forecast. */
  const refreshMLInsights = useCallback(async () => {
    const current = stateRef.current

    // 1. Google Cloud Function — structured crowd prediction
    const prediction = await CloudService.getCrowdPrediction(current)
    if (prediction) setCrowdPrediction(prediction)

    // 2. Vertex AI / Gemini — natural-language crowd forecast
    const forecast = await CloudService.getVertexCrowdForecast(current)
    if (forecast) setVertexForecast(forecast)
  }, [])

  // ── Effects ─────────────────────────────────────────────────

  useEffect(() => {
    // Set provider label
    setProvider(CloudService.getProvider())

    // Subscribe to Firebase for real-time overrides
    const unsub = CloudService.subscribe('stadium/live', cloudData => {
      if (cloudData) {
        setState(prev => ({ ...prev, ...cloudData }))
      }
    })

    // Log session start to Analytics
    CloudService.logEvent('session_start', { platform: 'stadium_nexus' })

    // Start simulation tick
    intervalRef.current = setInterval(tick, UPDATE_INTERVAL_MS)

    // Start ML refresh loop
    refreshMLInsights()
    mlTimerRef.current = setInterval(refreshMLInsights, ML_REFRESH_INTERVAL_MS)

    return () => {
      unsub()
      clearInterval(intervalRef.current)
      clearInterval(mlTimerRef.current)
    }
  }, [tick, refreshMLInsights])

  // ── Crowd insight string (derived from state) ────────────────

  useEffect(() => {
    // Only recompute when tunnel count or gate data changes
    setCrowdInsight(generateCrowdInsight(state))
  }, [state.wristbands?.tunnel, state.gates])

  return { state, crowdInsight, vertexForecast, crowdPrediction, provider }
}