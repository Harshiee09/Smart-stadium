/**
 * exitWaveEngine.js
 * Smart exit wave system — releases fans in timed waves
 * to prevent tunnel/gate/parking congestion after match ends.
 *
 * Wave decision logic:
 * 1. Parking holders from congested lots exit FIRST (cars block roads)
 * 2. Disabled fans always Wave 1
 * 3. Sections alternate left/right/centre to balance tunnel flow
 * 4. Higher rows go later (they take longer to reach exits anyway)
 * 5. Non-parking fans exit last (no car to rush to)
 * 6. Each wave is 4 minutes wide with a 1-min buffer
 */

// ── Stand section map ─────────────────────────────────────────
// Each stand has sections. Sections map to a tunnel side.
const SECTION_MAP = {
  north: [
    { section: 'A1–A4', side: 'left', gate: 'A', rowRange: [1, 10], tunnelId: 'T-NA' },
    { section: 'A5–A8', side: 'right', gate: 'A', rowRange: [11, 20], tunnelId: 'T-NA' },
    { section: 'B1–B4', side: 'centre', gate: 'F', rowRange: [1, 10], tunnelId: 'T-NB' },
    { section: 'B5–B8', side: 'left', gate: 'A', rowRange: [11, 25], tunnelId: 'T-NB' },
  ],
  south: [
    { section: 'D1–D4', side: 'left', gate: 'D', rowRange: [1, 12], tunnelId: 'T-SD' },
    { section: 'D5–D8', side: 'right', gate: 'C', rowRange: [13, 25], tunnelId: 'T-SD' },
  ],
  east: [
    { section: 'E1–E4', side: 'left', gate: 'B', rowRange: [1, 15], tunnelId: 'T-EB' },
    { section: 'E5–E8', side: 'right', gate: 'C', rowRange: [16, 30], tunnelId: 'T-EB' },
  ],
  west: [
    { section: 'W1–W4', side: 'right', gate: 'E', rowRange: [1, 15], tunnelId: 'T-WE' },
    { section: 'W5–W8', side: 'left', gate: 'E', rowRange: [16, 30], tunnelId: 'T-WE' },
  ],
}

// Parking lot congestion order — which lot blocks roads most
const PARKING_PRIORITY = { P2: 1, P4: 2, P1: 3, P3: 4 }

// Gate → parking lot mapping
const GATE_LOT = { A: 'P1', B: 'P2', C: 'P3', D: 'P3', E: 'P4', F: 'P1' }

/**
 * Generate all waves for the full stadium on exit
 * Returns array of wave objects sorted by release order
 */
export function generateExitWaves(fanData, parkingState) {
  const stand = fanData?.stand || 'north'
  const row = parseInt(fanData?.row) || 10
  const hasParking = fanData?.parking === 'yes'
  const sections = SECTION_MAP[stand] || SECTION_MAP.north

  // Build a full stadium wave schedule (mock — represents ALL fans)
  const allWaves = [
    // Wave 0 — Disabled / medical priority (always first)
    {
      waveNum: 0,
      label: 'Priority Wave',
      sections: ['All disabled bays', 'Medical assistance zones'],
      gate: 'F',
      side: 'All',
      parking: true,
      startOffsetMin: 0,
      durationMin: 5,
      fans: 420,
      scannedOut: Math.floor(420 * 0.85),
      color: '#a78bfa',
      icon: '♿',
      description: 'Disabled access, mobility assistance, medical priority',
    },
    // Wave 1 — Parking holders from congested East lot (P2) — North-East & South-East
    {
      waveNum: 1,
      label: 'Wave 1',
      sections: ['East Stand E1–E8', 'North Block B5–B8 (P2 parking)'],
      gate: 'B',
      side: 'left',
      parking: true,
      lot: 'P2',
      startOffsetMin: 2,
      durationMin: 4,
      fans: 3100,
      scannedOut: 0,
      color: '#22c55e',
      icon: '🚗',
      description: 'P2 East parking holders — deepest lot exits first to clear roads',
    },
    // Wave 2 — Parking holders West lot (P4)
    {
      waveNum: 2,
      label: 'Wave 2',
      sections: ['West Stand W1–W8 (P4 parking)', 'South Block D5–D8 (P4 parking)'],
      gate: 'E',
      side: 'right',
      parking: true,
      lot: 'P4',
      startOffsetMin: 6,
      durationMin: 4,
      fans: 3400,
      scannedOut: 0,
      color: '#22c55e',
      icon: '🚗',
      description: 'P4 West parking holders — alternating right side to balance tunnel flow',
    },
    // Wave 3 — North parking holders (P1), lower rows
    {
      waveNum: 3,
      label: 'Wave 3',
      sections: ['North Stand A1–A4 rows 1–10 (P1 parking)', 'South D1–D4 (P3 parking)'],
      gate: 'A',
      side: 'left',
      parking: true,
      lot: 'P1',
      startOffsetMin: 10,
      durationMin: 4,
      fans: 4200,
      scannedOut: 0,
      color: '#f59e0b',
      icon: '🚗',
      description: 'P1 North and P3 South parking — left side exits, alternating flow',
    },
    // Wave 4 — North parking holders (P1), upper rows
    {
      waveNum: 4,
      label: 'Wave 4',
      sections: ['North Stand A5–A8 rows 11–20 (P1 parking)', 'North B1–B4 rows 1–10 (P1 parking)'],
      gate: 'A',
      side: 'centre',
      parking: true,
      lot: 'P1',
      startOffsetMin: 14,
      durationMin: 4,
      fans: 5100,
      scannedOut: 0,
      color: '#f59e0b',
      icon: '🚗',
      description: 'P1 parking upper rows — centre tunnel to balance previous left-side flow',
    },
    // Wave 5 — Non-parking, closest exits (all stands, lower rows)
    {
      waveNum: 5,
      label: 'Wave 5',
      sections: ['All stands — rows 1–10, no parking', 'Ground floor concourse fans'],
      gate: 'nearest',
      side: 'all',
      parking: false,
      startOffsetMin: 18,
      durationMin: 4,
      fans: 8200,
      scannedOut: 0,
      color: '#38bdf8',
      icon: '🚶',
      description: 'Non-parking fans, lower rows — roads now clear of most parking traffic',
    },
    // Wave 6 — Non-parking, upper rows
    {
      waveNum: 6,
      label: 'Wave 6',
      sections: ['All stands — rows 11–25, no parking', 'Upper tier all sections'],
      gate: 'nearest',
      side: 'all',
      parking: false,
      startOffsetMin: 22,
      durationMin: 5,
      fans: 10800,
      scannedOut: 0,
      color: '#38bdf8',
      icon: '🚶',
      description: 'Non-parking upper tier — last wave, exits now fully clear',
    },
  ]

  // ── Determine THIS fan's wave ─────────────────────────────
  let myWaveNum = 6  // default: last

  // Disabled check (simplified — use gate F)
  const section = sections.find(s => row >= s.rowRange[0] && row <= s.rowRange[1]) || sections[0]
  const lot = GATE_LOT[section.gate]
  const lotPriority = PARKING_PRIORITY[lot] || 4

  if (hasParking) {
    // Parking priority based on lot
    if (lot === 'P2') myWaveNum = 1
    else if (lot === 'P4') myWaveNum = 2
    else if (lot === 'P1' && row <= 10) myWaveNum = 3
    else if (lot === 'P1') myWaveNum = 4
    else if (lot === 'P3' && row <= 12) myWaveNum = 3
    else myWaveNum = 4
  } else {
    myWaveNum = row <= 10 ? 5 : 6
  }

  return { waves: allWaves, myWaveNum, section, lot: hasParking ? lot : null }
}

/**
 * Get the screen message for a specific wave
 * (what the stadium screens + speakers say)
 */
export function getScreenMessage(wave) {
  if (!wave) return null
  const startStr = wave.startOffsetMin === 0 ? 'NOW' : `in ${wave.startOffsetMin} min`
  return {
    headline: `${wave.label} — Exit ${startStr}`,
    sections: wave.sections.join(' · '),
    gate: wave.gate === 'nearest' ? 'Your nearest gate' : `Gate ${wave.gate}`,
    side: wave.side === 'all' ? 'All exits' : `${wave.side.charAt(0).toUpperCase() + wave.side.slice(1)} side exits`,
    duration: `${wave.durationMin} minute window`,
    parking: wave.parking ? `${wave.lot} parking holders` : 'No parking — public transport & walking',
    notification: `📣 ${wave.label}: ${wave.sections[0]} — please exit now via ${wave.gate === 'nearest' ? 'your nearest gate' : 'Gate ' + wave.gate}. ${wave.durationMin} minute window.`,
  }
}

/**
 * Simulate scan-out progress (mock BLE wristband data)
 */
export function simulateScanProgress(wave, elapsedSeconds) {
  if (!wave || elapsedSeconds <= 0) return 0
  const maxProgress = 0.92  // 92% scan-out is realistic
  const rate = maxProgress / (wave.durationMin * 60)
  return Math.min(Math.round(wave.fans * rate * elapsedSeconds), Math.round(wave.fans * maxProgress))
}