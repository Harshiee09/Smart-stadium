/**
 * useStadiumData.js
 * Central state manager for all live stadium data
 * Connects to CloudService (Firebase/AWS/Mock) and runs simulation
 */

import React from 'react'
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

  stateRef.current = state

  // Tick function — merges cloud data with simulation
  const tick = useCallback(() => {
    setState(prev => {
      const next = generateLiveState(prev)
      return next
    })
  }, [])

  useEffect(() => {
    setProvider(CloudService.getProvider())

    // Subscribe to cloud path (no-op in demo, real data in prod)
    const unsub = CloudService.subscribe('stadium/live', (cloudData) => {
      if (cloudData) {
        setState(prev => ({ ...prev, ...cloudData }))
      }
    })

    // Start simulation interval
    intervalRef.current = setInterval(tick, UPDATE_INTERVAL_MS)

    return () => {
      unsub()
      clearInterval(intervalRef.current)
    }
  }, [tick])

  // Update crowd insight every 10 seconds
  useEffect(() => {
    const insight = generateCrowdInsight(state)
    setCrowdInsight(insight)
  }, [state.wristbands?.tunnel, state.gates])

  return { state, crowdInsight, provider }
}
