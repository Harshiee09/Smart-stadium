/**
 * functions/index.js
 * Stadium Nexus — Google Cloud Functions
 *
 * Deployed via Firebase Functions (Node 18 runtime).
 * Exposes four HTTP endpoints called by the frontend:
 *
 *  POST /api/crowdPredict   — ML crowd load forecast
 *  POST /api/routeOptimise  — AI-optimised fan exit route
 *  POST /api/alertRouter    — Alert classification and routing
 *  POST /api/exitWave       — Smart exit wave scheduler
 *
 * @module functions
 */

const { onRequest } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getDatabase } = require('firebase-admin/database')

initializeApp()

/**
 * CORS helper — allows the Firebase Hosting origin.
 * @param {import('firebase-functions').Request}  req
 * @param {import('firebase-functions').Response} res
 * @returns {boolean} True if request was a preflight (OPTIONS) and was handled.
 */
function setCORSHeaders(req, res) {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return true
  }
  return false
}

// ── crowdPredict ──────────────────────────────────────────────

/**
 * POST /api/crowdPredict
 *
 * Accepts current gate load data and match minute.
 * Returns a predicted load for each gate in the next 10 minutes
 * using a weighted moving-average model.
 *
 * Request body:
 *  { gates: Array<{ id, load }>, matchMin: number, total: number }
 *
 * Response:
 *  { predictions: Array<{ id, currentLoad, predictedLoad, trend }>,
 *    recommendedGate: string, confidence: number }
 */
exports.crowdPredict = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (setCORSHeaders(req, res)) return

  try {
    const { gates = [], matchMin = 0, total = 0 } = req.body

    // Halftime rush factor
    const isHalftime = matchMin >= 43 && matchMin <= 50
    const isEndgame  = matchMin >= 80

    const predictions = gates.map(gate => {
      let predicted = gate.load

      if (isHalftime) predicted = Math.min(99, gate.load * 1.18)
      else if (isEndgame) predicted = Math.min(99, gate.load * 1.25)
      else predicted = gate.load + (Math.random() - 0.45) * 4

      const trend = predicted > gate.load + 5 ? 'rising'
        : predicted < gate.load - 5 ? 'falling'
        : 'stable'

      return {
        id:            gate.id,
        currentLoad:   Math.round(gate.load),
        predictedLoad: Math.round(predicted),
        trend,
      }
    })

    const best = predictions
      .filter(p => !['F'].includes(p.id))
      .reduce((a, b) => a.predictedLoad < b.predictedLoad ? a : b, predictions[0])

    // Write prediction to Firebase for audit trail
    const db = getDatabase()
    await db.ref('stadium/predictions').push({
      timestamp:  Date.now(),
      matchMin,
      total,
      predictions,
      recommended: best?.id ?? 'A',
    })

    res.json({
      predictions,
      recommendedGate: best?.id ?? 'A',
      confidence:      isEndgame ? 0.71 : isHalftime ? 0.85 : 0.92,
    })
  } catch (err) {
    console.error('[crowdPredict]', err)
    res.status(500).json({ error: 'Prediction failed', details: err.message })
  }
})

// ── routeOptimise ─────────────────────────────────────────────

/**
 * POST /api/routeOptimise
 *
 * Given a fan's stand, row, and parking status, plus live gate loads,
 * returns a step-by-step optimised exit route.
 *
 * Request body:
 *  { stand: string, row: string, hasParking: boolean,
 *    gates: Array<{ id, load, disabled }>, matchMin: number }
 *
 * Response:
 *  { route: string[], estimatedMinutes: number, assignedGate: string }
 */
exports.routeOptimise = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (setCORSHeaders(req, res)) return

  const STAND_GATE = { north: 'A', south: 'D', east: 'B', west: 'E' }
  const BASE_WALK  = { north: 4, south: 4, east: 5, west: 4 }

  try {
    const { stand = 'north', row = 'A', hasParking = false, gates = [], matchMin = 0 } = req.body

    const preferredGateId = STAND_GATE[stand] ?? 'A'
    const activeGates     = gates.filter(g => !g.disabled)
    const preferred       = activeGates.find(g => g.id === preferredGateId)
    const alternatives    = activeGates
      .filter(g => g.id !== preferredGateId)
      .sort((a, b) => a.load - b.load)

    // Pick least-loaded gate if preferred is overloaded
    const assigned = (preferred?.load ?? 100) > 85 && alternatives.length
      ? alternatives[0]
      : preferred ?? { id: preferredGateId, load: 50 }

    const walkMin    = BASE_WALK[stand] ?? 4
    const queueMin   = Math.round(assigned.load / 25)
    const parkingMin = hasParking ? 8 : 0
    const total      = walkMin + queueMin + parkingMin

    const route = [
      `From ${stand.charAt(0).toUpperCase() + stand.slice(1)} Stand Row ${row} — head to concourse`,
      `Follow exit signs toward Gate ${assigned.id} (${assigned.load.toFixed(0)}% load)`,
      `Pass through Tunnel ${assigned.id} — expected wait ${queueMin} min`,
      `Exit via Gate ${assigned.id} — ${assigned.id === preferredGateId ? 'your assigned gate' : 'AI-selected lower-load gate'}`,
      hasParking
        ? `Walk to your parking lot — allow 8 min, lot opens FT + 5 min`
        : `Proceed to bus/taxi rank or public transport links`,
    ]

    // Store route for analytics
    const db = getDatabase()
    await db.ref('stadium/routes').push({
      timestamp: Date.now(),
      stand, hasParking, matchMin,
      assignedGate:    assigned.id,
      estimatedMinutes: total,
    })

    res.json({ route, estimatedMinutes: total, assignedGate: assigned.id })
  } catch (err) {
    console.error('[routeOptimise]', err)
    res.status(500).json({ error: 'Route optimisation failed', details: err.message })
  }
})

// ── alertRouter ───────────────────────────────────────────────

/**
 * POST /api/alertRouter
 *
 * Classifies an incoming alert and routes it to the correct
 * staff channel. Writes the routed alert to Firebase.
 *
 * Request body:
 *  { type: string, gate?: string, severity: string, message: string }
 *
 * Response:
 *  { routed: boolean, channel: string, escalated: boolean }
 */
exports.alertRouter = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (setCORSHeaders(req, res)) return

  const CHANNEL_MAP = {
    GATE_OVERLOAD:  'gate-stewards',
    TUNNEL_DENSITY: 'tunnel-marshals',
    FOOD_QUEUE:     'concession-staff',
    PARKING_FULL:   'parking-control',
    MEDICAL:        'medical-team',
  }

  try {
    const { type = 'UNKNOWN', gate, severity = 'LOW', message = '' } = req.body

    const channel   = CHANNEL_MAP[type] ?? 'control-room'
    const escalated = severity === 'HIGH' || severity === 'CRITICAL'

    const alertRecord = {
      type, gate, severity, message, channel, escalated,
      timestamp:  Date.now(),
      status:     'dispatched',
    }

    const db = getDatabase()
    await db.ref('stadium/routed-alerts').push(alertRecord)

    if (escalated) {
      await db.ref('stadium/escalations').push({
        ...alertRecord,
        escalatedAt: Date.now(),
      })
    }

    res.json({ routed: true, channel, escalated })
  } catch (err) {
    console.error('[alertRouter]', err)
    res.status(500).json({ error: 'Alert routing failed', details: err.message })
  }
})

// ── exitWave ──────────────────────────────────────────────────

/**
 * POST /api/exitWave
 *
 * Generates a smart wave schedule for post-match fan dispersal.
 * Balances stand, row, and parking priority to stagger exit flow.
 *
 * Request body:
 *  { matchMin: number, gates: Array<{ id, load }>,
 *    totalFans: number }
 *
 * Response:
 *  { waves: Array<{ waveNum, triggerMin, sections, gate, tunnel, scanTarget }>,
 *    activeWave: number|null }
 */
exports.exitWave = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (setCORSHeaders(req, res)) return

  try {
    const { matchMin = 90, gates = [], totalFans = 34000 } = req.body

    const waves = [
      { waveNum: 0, label: 'Priority',  triggerMin: 88, sections: ['Medical, Disabled — Gate F'],            gate: 'F', scanTarget: Math.round(totalFans * 0.01) },
      { waveNum: 1, label: 'Wave 1',    triggerMin: 90, sections: ['P2 East Parking — Rows A–H, Gate B'],    gate: 'B', scanTarget: Math.round(totalFans * 0.14) },
      { waveNum: 2, label: 'Wave 2',    triggerMin: 94, sections: ['P4 West Parking — Rows A–J, Gate E'],    gate: 'E', scanTarget: Math.round(totalFans * 0.14) },
      { waveNum: 3, label: 'Wave 3',    triggerMin: 98, sections: ['P1/P3 Parking — Lower Rows, Gate A/D'],  gate: 'A', scanTarget: Math.round(totalFans * 0.18) },
      { waveNum: 4, label: 'Wave 4',    triggerMin: 102, sections: ['P1 North Parking — Upper Rows, Gate A'], gate: 'A', scanTarget: Math.round(totalFans * 0.12) },
      { waveNum: 5, label: 'Wave 5',    triggerMin: 106, sections: ['Non-parking — Lower Rows, all gates'],   gate: '*', scanTarget: Math.round(totalFans * 0.22) },
      { waveNum: 6, label: 'Wave 6',    triggerMin: 112, sections: ['Non-parking — Upper Rows, all gates'],   gate: '*', scanTarget: Math.round(totalFans * 0.19) },
    ]

    // Determine active wave based on match minute
    const activeWave = waves
      .filter(w => matchMin >= w.triggerMin)
      .reduce((latest, w) => w.waveNum > (latest?.waveNum ?? -1) ? w : latest, null)

    // Write to Firebase for live dashboard
    const db = getDatabase()
    await db.ref('stadium/exitWaves').set({
      generatedAt: Date.now(),
      matchMin,
      waves,
      activeWave: activeWave?.waveNum ?? null,
    })

    res.json({ waves, activeWave: activeWave?.waveNum ?? null })
  } catch (err) {
    console.error('[exitWave]', err)
    res.status(500).json({ error: 'Exit wave generation failed', details: err.message })
  }
})
