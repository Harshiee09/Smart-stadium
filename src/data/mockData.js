/**
 * mockData.js
 * Realistic stadium simulation engine
 * Simulates: CV feeds, wristband BLE, IoT sensors, parking, food POS
 */

export const STADIUM_CONFIG = {
  name: 'Nexus Arena',
  capacity: 45200,
  match: { home: 'City FC', away: 'United', homeColor: '#1e90ff', awayColor: '#ff4040' },
  gates: [
    { id: 'A', loc: 'North',     bearing: 0,   disabled: false, assignedStand: 'North'  },
    { id: 'B', loc: 'North-East',bearing: 45,  disabled: false, assignedStand: 'East'   },
    { id: 'C', loc: 'South-East',bearing: 135, disabled: false, assignedStand: 'South'  },
    { id: 'D', loc: 'South',     bearing: 180, disabled: false, assignedStand: 'South'  },
    { id: 'E', loc: 'South-West',bearing: 225, disabled: false, assignedStand: 'West'   },
    { id: 'F', loc: 'North-West',bearing: 315, disabled: true,  assignedStand: 'North'  },
  ],
  zones: [
    { id: 'north', name: 'North Stand', team: 'HOME',    cap: 28400, color: '#1e4a90' },
    { id: 'south', name: 'South Stand', team: 'AWAY',    cap: 8200,  color: '#902020' },
    { id: 'east',  name: 'East Stand',  team: 'NEUTRAL', cap: 4300,  color: '#1a5020' },
    { id: 'west',  name: 'West Stand',  team: 'NEUTRAL', cap: 4300,  color: '#1a5020' },
  ],
  foodStalls: [
    { id: 'F1', name: 'Burgers',    location: 'North NW', icon: '🍔', maxWait: 20 },
    { id: 'F2', name: 'Drinks Bar', location: 'North NE', icon: '🍺', maxWait: 20 },
    { id: 'F3', name: 'Pizza',      location: 'East Upper',icon: '🍕', maxWait: 20 },
    { id: 'F4', name: 'Snacks',     location: 'East Lower',icon: '🥨', maxWait: 20 },
    { id: 'F5', name: 'Hot Dogs',   location: 'West Upper',icon: '🌭', maxWait: 20 },
    { id: 'F6', name: 'Coffee',     location: 'West Lower',icon: '☕', maxWait: 20 },
    { id: 'F7', name: 'Kebabs',     location: 'South West',icon: '🥙', maxWait: 20 },
    { id: 'F8', name: 'Ice Cream',  location: 'South East',icon: '🍦', maxWait: 20 },
  ],
  parkingLots: [
    { lot: 'P1', name: 'North', total: 400 },
    { lot: 'P2', name: 'East',  total: 320 },
    { lot: 'P3', name: 'South', total: 380 },
    { lot: 'P4', name: 'West',  total: 350 },
  ],
  bestViewSpots: [
    { area: 'North Row 12–18 (Blocks A–C)', rating: 4.9, reviews: 1842 },
    { area: 'West Upper Tier Row 5–10',     rating: 4.7, reviews: 924  },
    { area: 'East Lower Row 8–15',          rating: 4.4, reviews: 631  },
    { area: 'South Block D Row 20+',        rating: 3.8, reviews: 290  },
  ],
  cvCameras: [
    { cam: 'CAM-T1', zone: 'Tunnel A',    type: 'tunnel' },
    { cam: 'CAM-T2', zone: 'Tunnel B',    type: 'tunnel' },
    { cam: 'CAM-T3', zone: 'Tunnel C',    type: 'tunnel' },
    { cam: 'CAM-T4', zone: 'Tunnel D',    type: 'tunnel' },
    { cam: 'CAM-S1', zone: 'North Seats', type: 'seats'  },
    { cam: 'CAM-S2', zone: 'South Seats', type: 'seats'  },
    { cam: 'CAM-S3', zone: 'East Seats',  type: 'seats'  },
    { cam: 'CAM-S4', zone: 'West Seats',  type: 'seats'  },
  ],
}

// ── Simulation state ──────────────────────────────────────────
let tick = 0

function jitter(val, range, min = 0, max = 99) {
  return Math.max(min, Math.min(max, val + (Math.random() - 0.48) * range))
}

function clampInt(val, min, max) {
  return Math.max(min, Math.min(max, Math.round(val)))
}

/**
 * Generate live stadium state snapshot
 * Called every N ms by the simulation hook
 */
export function generateLiveState(prev) {
  tick++
  const isHalftime = tick % 120 < 15 // simulate halftime rush period

  // Gates — C gets heavier over time as away fans cluster
  const gates = prev?.gates?.map((g, i) => {
    const halftimeSpike = isHalftime && (i === 0 || i === 2) ? 12 : 0
    return {
      ...g,
      load: clampInt(jitter(g.load, 2.5, 5, 99) + halftimeSpike, 5, 99),
      fans: clampInt(g.fans * (0.97 + Math.random() * 0.06), 50, 3000),
    }
  }) ?? STADIUM_CONFIG.gates.map((g, i) => ({
    ...g,
    load: [62, 78, 94, 51, 58, 18][i],
    fans: [842, 1204, 2180, 756, 934, 120][i],
  }))

  // Zones — gradual fill as match progresses
  const zones = prev?.zones?.map(z => ({
    ...z,
    occ: clampInt(jitter(z.occ, 15, z.cap * 0.3, z.cap), z.cap * 0.3, z.cap),
  })) ?? STADIUM_CONFIG.zones.map((z, i) => ({
    ...z,
    occ: [24800, 7100, 3200, 3118][i],
  }))

  // Wristbands — BLE sensor aggregation
  const totalSeated = zones.reduce((s, z) => s + z.occ, 0)
  const tunnelCount = clampInt(
    jitter(prev?.wristbands?.tunnel ?? 1842, 80, 200, 3000),
    200, 3000
  )
  const wristbands = {
    total:     34218 + Math.floor(tick * 0.3),
    tunnel:    tunnelCount,
    seated:    totalSeated,
    concourse: clampInt(34218 - totalSeated - tunnelCount, 0, 8000),
  }

  // Food stalls — halftime creates spike
  const food = prev?.food?.map(f => ({
    ...f,
    wait: clampInt(
      jitter(f.wait, isHalftime ? 2 : 1, 1, f.maxWait),
      1, f.maxWait
    ),
  })) ?? STADIUM_CONFIG.foodStalls.map((f, i) => ({
    ...f,
    wait: [12, 4, 8, 2, 6, 14, 5, 3][i],
  }))

  // Parking — slow drain
  const parking = prev?.parking?.map(p => ({
    ...p,
    free: clampInt(p.free - (Math.random() < 0.15 ? 1 : 0), 0, p.total),
  })) ?? STADIUM_CONFIG.parkingLots.map((p, i) => ({
    ...p,
    free: [142, 23, 88, 4][i],
  }))

  // CV camera feeds
  const cv = STADIUM_CONFIG.cvCameras.map((c, i) => {
    if (c.type === 'tunnel') {
      const base = [184, 92, 341, 67][i]
      return { ...c, count: clampInt(jitter(prev?.cv?.[i]?.count ?? base, 20, 0, 500), 0, 500) }
    } else {
      const baseFill = [87, 94, 74, 72][i - 4]
      return { ...c, fill: clampInt(jitter(prev?.cv?.[i]?.fill ?? baseFill, 1, 0, 100), 0, 100) }
    }
  })

  // Match minute
  const matchMin = Math.min(90, (prev?.matchMin ?? 67) + (tick % 10 === 0 ? 1 : 0))

  // Alerts (dynamic)
  const alerts = buildAlerts(gates, wristbands, food, cv)

  return { gates, zones, wristbands, food, parking, cv, matchMin, score: [2, 1], alerts }
}

function buildAlerts(gates, wristbands, food, cv) {
  const alerts = []
  const now = new Date()
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`

  gates.forEach(g => {
    if (g.load > 90 && !g.disabled)
      alerts.push({ level: 'danger', msg: `Gate ${g.id} queue critical — ${g.load.toFixed(0)}% load`, time: timeStr })
    else if (g.load > 80 && !g.disabled)
      alerts.push({ level: 'warn', msg: `Gate ${g.id} load elevated — ${g.load.toFixed(0)}%`, time: timeStr })
  })

  if (wristbands.tunnel > 2000)
    alerts.push({ level: 'danger', msg: `Tunnel density critical — ${wristbands.tunnel.toLocaleString()} persons`, time: timeStr })

  food.forEach(f => {
    if (f.wait >= f.maxWait - 2)
      alerts.push({ level: 'warn', msg: `${f.id} ${f.name} queue max — deploy extra staff`, time: timeStr })
  })

  cv.filter(c => c.type === 'tunnel' && c.count > 280).forEach(c => {
    alerts.push({ level: 'warn', msg: `${c.cam} ${c.zone} flow above threshold`, time: timeStr })
  })

  if (alerts.length === 0)
    alerts.push({ level: 'ok', msg: 'All systems nominal — crowd flow balanced', time: timeStr })

  return alerts.slice(0, 6)
}

/**
 * Generate AI route recommendation
 */
export function getOptimalRoute(fromGate, toStand, currentGates) {
  const gate = currentGates.find(g => g.id === fromGate)
  const altGates = currentGates
    .filter(g => !g.disabled && g.id !== fromGate && g.assignedStand === toStand)
    .sort((a, b) => a.load - b.load)

  return {
    recommended: fromGate,
    recommendedLoad: gate?.load ?? 0,
    alternatives: altGates.slice(0, 2).map(g => ({
      gate: g.id,
      load: g.load,
      extraMin: Math.ceil((g.load - (gate?.load ?? 0)) / 20) + 2,
    })),
    steps: [
      { n: 1, txt: `Enter via Gate ${fromGate} — ${gate?.load?.toFixed(0) ?? '?'}% capacity`, time: '0:00' },
      { n: 2, txt: 'Follow blue corridor signs, take escalator to Level 2', time: '0:45' },
      { n: 3, txt: `Turn right at Section ${toStand.charAt(0)}B-12 concourse`, time: '1:30' },
      { n: 4, txt: `Proceed through Tunnel ${fromGate}B — CV count nominal`, time: '2:15' },
      { n: 5, txt: `Find your row and seat — ${toStand} Stand`, time: '4:00' },
    ],
  }
}

/**
 * Generate parking bay grid for a lot
 */
export function generateParkingGrid(lotData, size = 64) {
  const freeRatio     = Math.max(0, lotData.free / lotData.total)
  const freeCount     = Math.floor(size * freeRatio)
  const reservedCount = freeCount > 0 ? Math.min(Math.floor(size * 0.05), size - freeCount) : 0
  const takenCount    = size - freeCount - reservedCount

  const bays = [
    ...Array(takenCount).fill('taken'),
    ...Array(reservedCount).fill('reserved'),
    ...Array(freeCount).fill('free'),
  ]

  // Fisher-Yates shuffle for realistic visual scatter
  for (let i = bays.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bays[i], bays[j]] = [bays[j], bays[i]]
  }
  return bays
}
