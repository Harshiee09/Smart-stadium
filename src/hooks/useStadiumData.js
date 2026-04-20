/**
 * useStadiumData.js
 * Central state manager for all live stadium data
 * Connects to Firebase Realtime DB — pushes state every 2.5s and reads it back live
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { generateLiveState } from '../data/mockData'
import { CloudService } from '../services/cloudService'
import { generateCrowdInsight } from '../services/geminiService'

const UPDATE_INTERVAL_MS = 2500

export function useStadiumData() {
  const [state, setState] = useState(() => generateLiveState(null))
  const [crowdInsight, setCrowdInsight] = useState('')
  const [provider, setProvider] = useState('Initialising...')
  const stateRef = useRef(state)
  const intervalRef = useRef(null)
  const pushIntervalRef = useRef(null)

  stateRef.current = state

  // Tick — generate next simulation frame
  const tick = useCallback(() => {
    setState(prev => {
      const next = generateLiveState(prev)
      return next
    })
  }, [])

  useEffect(() => {
    // Init provider label
    setProvider(CloudService.getProvider())

    // Subscribe to Firebase live path — merges cloud updates into local state
    const unsub = CloudService.subscribe('stadium/live', (cloudData) => {
      if (cloudData) {
        setState(prev => ({
          ...prev,
          // Only merge specific live fields to avoid overwriting simulation logic
          gates: cloudData.gates || prev.gates,
          food: cloudData.food || prev.food,
          parking: cloudData.parking || prev.parking,
          wristbands: cloudData.wristbands || prev.wristbands,
          alerts: cloudData.alerts || prev.alerts,
        }))
      }
    })

    // Push initial config to Firebase
    CloudService.write('stadium/config', {
      name: 'Nexus Arena',
      capacity: 45200,
      match: { home: 'City FC', away: 'United' },
      _initializedAt: Date.now(),
    })

    // Start simulation tick
    intervalRef.current = setInterval(tick, UPDATE_INTERVAL_MS)

    // Push live state to Firebase every 2.5s
    pushIntervalRef.current = setInterval(() => {
      const current = stateRef.current
      if (current) {
        CloudService.pushLiveState({
          gates: current.gates,
          zones: current.zones,
          wristbands: current.wristbands,
          food: current.food,
          parking: current.parking,
          matchMin: current.matchMin,
          score: current.score,
          alerts: current.alerts,
        })
      }
    }, UPDATE_INTERVAL_MS)

    // Log app open event to Firebase Analytics
    CloudService.logEvent('stadium_app_open', {
      timestamp: Date.now(),
      platform: 'web',
    })

    return () => {
      unsub()
      clearInterval(intervalRef.current)
      clearInterval(pushIntervalRef.current)
    }
  }, [tick])

  // Update crowd insight every time gates or tunnel count changes
  useEffect(() => {
    const insight = generateCrowdInsight(state)
    setCrowdInsight(insight)

    // Log crowd alerts to Firebase when danger level
    if (state.alerts?.some(a => a.level === 'danger')) {
      state.alerts
        .filter(a => a.level === 'danger')
        .forEach(alert => CloudService.writeAlert(alert))
    }
  }, [state.wristbands?.tunnel, state.gates])

  // Update provider label after init
  useEffect(() => {
    const timer = setTimeout(() => setProvider(CloudService.getProvider()), 1000)
    return () => clearTimeout(timer)
  }, [])

  return { state, crowdInsight, provider }
}