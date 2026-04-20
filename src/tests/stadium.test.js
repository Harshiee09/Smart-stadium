/**
 * Stadium Nexus — comprehensive test suite
 * Covers: helpers, mockData simulation engine, geminiService AI logic
 *
 * Run with: npm test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── helpers.js ────────────────────────────────────────────────

import {
  loadClass, loadColor, formatNum, pct,
  quietestGate, busiestGate, bestFoodStall,
  validateTicket, formatTime, timeAgo, clamp, randInt, pick,
} from '../utils/helpers'

describe('helpers — loadClass', () => {
  it('returns "danger" for load >= 90', () => {
    expect(loadClass(90)).toBe('danger')
    expect(loadClass(99)).toBe('danger')
    expect(loadClass(100)).toBe('danger')
  })
  it('returns "warn" for load 75–89', () => {
    expect(loadClass(75)).toBe('warn')
    expect(loadClass(89)).toBe('warn')
  })
  it('returns "ok" for load < 75', () => {
    expect(loadClass(0)).toBe('ok')
    expect(loadClass(74)).toBe('ok')
  })
  it('returns "ok" for non-numeric input', () => {
    expect(loadClass(NaN)).toBe('ok')
    expect(loadClass(undefined)).toBe('ok')
  })
})

describe('helpers — loadColor', () => {
  it('returns red for danger loads', () => {
    expect(loadColor(90)).toBe('#ff4444')
    expect(loadColor(95)).toBe('#ff4444')
  })
  it('returns amber for warn loads', () => {
    expect(loadColor(75)).toBe('#ffb800')
    expect(loadColor(80)).toBe('#ffb800')
  })
  it('returns green for ok loads', () => {
    expect(loadColor(50)).toBe('#00ff9d')
    expect(loadColor(0)).toBe('#00ff9d')
  })
  it('returns green for invalid input', () => {
    expect(loadColor(NaN)).toBe('#00ff9d')
  })
})

describe('helpers — formatNum', () => {
  it('formats integers with thousands separators', () => {
    expect(formatNum(45200)).toMatch(/45[,.]?200/)
  })
  it('returns string values as-is', () => {
    expect(formatNum('N/A')).toBe('N/A')
  })
  it('handles zero', () => {
    expect(formatNum(0)).toBe('0')
  })
  it('handles null/undefined gracefully', () => {
    expect(formatNum(null)).toBe('')
    expect(formatNum(undefined)).toBe('')
  })
})

describe('helpers — pct', () => {
  it('calculates percentage correctly', () => {
    expect(pct(36160, 45200)).toBe(80)
    expect(pct(45200, 45200)).toBe(100)
    expect(pct(0, 45200)).toBe(0)
  })
  it('returns 0 for zero capacity', () => {
    expect(pct(100, 0)).toBe(0)
  })
  it('caps at 100', () => {
    expect(pct(50000, 45200)).toBe(100)
  })
  it('handles non-numeric inputs', () => {
    expect(pct('a', 100)).toBe(0)
    expect(pct(50, 'b')).toBe(0)
  })
})

describe('helpers — quietestGate', () => {
  const gates = [
    { id: 'A', load: 62, disabled: false },
    { id: 'B', load: 78, disabled: false },
    { id: 'C', load: 94, disabled: false },
    { id: 'F', load: 18, disabled: true },
  ]

  it('returns gate with lowest load excluding disabled', () => {
    expect(quietestGate(gates).id).toBe('A')
  })
  it('returns null for empty array', () => {
    expect(quietestGate([])).toBeNull()
  })
  it('returns null when all gates disabled', () => {
    expect(quietestGate([{ id: 'F', load: 5, disabled: true }])).toBeNull()
  })
  it('returns null for non-array input', () => {
    expect(quietestGate(null)).toBeNull()
    expect(quietestGate(undefined)).toBeNull()
  })
})

describe('helpers — busiestGate', () => {
  const gates = [
    { id: 'A', load: 62 },
    { id: 'C', load: 94 },
    { id: 'E', load: 58 },
  ]
  it('returns gate with highest load', () => {
    expect(busiestGate(gates).id).toBe('C')
  })
  it('returns null for empty array', () => {
    expect(busiestGate([])).toBeNull()
  })
})

describe('helpers — bestFoodStall', () => {
  const stalls = [
    { id: 'F1', wait: 12 },
    { id: 'F4', wait: 2 },
    { id: 'F6', wait: 14 },
  ]
  it('returns stall with shortest wait', () => {
    expect(bestFoodStall(stalls).id).toBe('F4')
  })
  it('returns null for empty array', () => {
    expect(bestFoodStall([])).toBeNull()
  })
})

describe('helpers — validateTicket', () => {
  const valid = { name: 'Harshvardhan', bookingId: 'TKT-1234', row: 'A', seat: '22', stand: 'north' }

  it('accepts a valid ticket', () => {
    expect(validateTicket(valid).valid).toBe(true)
    expect(Object.keys(validateTicket(valid).errors)).toHaveLength(0)
  })
  it('rejects missing name', () => {
    const r = validateTicket({ ...valid, name: '' })
    expect(r.valid).toBe(false)
    expect(r.errors.name).toBeDefined()
  })
  it('rejects missing bookingId', () => {
    const r = validateTicket({ ...valid, bookingId: '' })
    expect(r.valid).toBe(false)
    expect(r.errors.bookingId).toBeDefined()
  })
  it('rejects short bookingId', () => {
    const r = validateTicket({ ...valid, bookingId: 'AB' })
    expect(r.valid).toBe(false)
    expect(r.errors.bookingId).toBeDefined()
  })
  it('rejects invalid seat number', () => {
    const r = validateTicket({ ...valid, seat: 'abc' })
    expect(r.valid).toBe(false)
    expect(r.errors.seat).toBeDefined()
  })
  it('rejects seat out of range', () => {
    const r = validateTicket({ ...valid, seat: '1000' })
    expect(r.valid).toBe(false)
    expect(r.errors.seat).toBeDefined()
  })
  it('rejects missing stand', () => {
    const r = validateTicket({ ...valid, stand: '' })
    expect(r.valid).toBe(false)
    expect(r.errors.stand).toBeDefined()
  })
})

describe('helpers — formatTime', () => {
  it('formats seconds correctly', () => {
    expect(formatTime(270)).toBe('4:30')
    expect(formatTime(60)).toBe('1:00')
    expect(formatTime(0)).toBe('0:00')
  })
  it('pads seconds below 10', () => {
    expect(formatTime(65)).toBe('1:05')
  })
  it('handles negative input', () => {
    expect(formatTime(-10)).toBe('0:00')
  })
})

describe('helpers — clamp', () => {
  it('clamps below min', () => expect(clamp(-5, 0, 100)).toBe(0))
  it('clamps above max', () => expect(clamp(150, 0, 100)).toBe(100))
  it('passes through in-range', () => expect(clamp(50, 0, 100)).toBe(50))
  it('handles non-numeric', () => expect(clamp('x', 0, 100)).toBe(0))
})

describe('helpers — randInt', () => {
  it('returns values within range', () => {
    for (let i = 0; i < 50; i++) {
      const v = randInt(1, 10)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(10)
    }
  })
  it('returns the same value when min === max', () => {
    expect(randInt(5, 5)).toBe(5)
  })
})

describe('helpers — pick', () => {
  it('returns an element from the array', () => {
    const arr = ['a', 'b', 'c']
    expect(arr).toContain(pick(arr))
  })
  it('returns undefined for empty array', () => {
    expect(pick([])).toBeUndefined()
  })
  it('returns undefined for non-array', () => {
    expect(pick(null)).toBeUndefined()
  })
})

// ── mockData.js ───────────────────────────────────────────────

import { generateLiveState, getOptimalRoute, generateParkingGrid, STADIUM_CONFIG } from '../data/mockData'

describe('mockData — STADIUM_CONFIG', () => {
  it('has required top-level keys', () => {
    expect(STADIUM_CONFIG).toHaveProperty('name')
    expect(STADIUM_CONFIG).toHaveProperty('capacity')
    expect(STADIUM_CONFIG).toHaveProperty('gates')
    expect(STADIUM_CONFIG).toHaveProperty('zones')
    expect(STADIUM_CONFIG).toHaveProperty('foodStalls')
    expect(STADIUM_CONFIG).toHaveProperty('parkingLots')
  })
  it('capacity is a positive number', () => {
    expect(STADIUM_CONFIG.capacity).toBeGreaterThan(0)
  })
  it('has exactly 6 gates', () => {
    expect(STADIUM_CONFIG.gates).toHaveLength(6)
  })
  it('has exactly 4 zones', () => {
    expect(STADIUM_CONFIG.zones).toHaveLength(4)
  })
})

describe('mockData — generateLiveState', () => {
  it('generates valid state from null (cold start)', () => {
    const state = generateLiveState(null)
    expect(state).toHaveProperty('gates')
    expect(state).toHaveProperty('zones')
    expect(state).toHaveProperty('wristbands')
    expect(state).toHaveProperty('food')
    expect(state).toHaveProperty('parking')
    expect(state).toHaveProperty('matchMin')
    expect(state).toHaveProperty('score')
    expect(state).toHaveProperty('alerts')
  })
  it('gate loads are within 0–99', () => {
    const state = generateLiveState(null)
    state.gates.forEach(g => {
      expect(g.load).toBeGreaterThanOrEqual(0)
      expect(g.load).toBeLessThanOrEqual(99)
    })
  })
  it('food wait times are positive', () => {
    const state = generateLiveState(null)
    state.food.forEach(f => {
      expect(f.wait).toBeGreaterThanOrEqual(1)
    })
  })
  it('wristbands.total is positive', () => {
    const state = generateLiveState(null)
    expect(state.wristbands.total).toBeGreaterThan(0)
  })
  it('generates state from previous state (warm start)', () => {
    const first = generateLiveState(null)
    const second = generateLiveState(first)
    expect(second.gates).toHaveLength(first.gates.length)
    expect(second.food).toHaveLength(first.food.length)
  })
  it('alerts array is non-empty', () => {
    const state = generateLiveState(null)
    expect(state.alerts.length).toBeGreaterThan(0)
  })
  it('score is a 2-element array', () => {
    const state = generateLiveState(null)
    expect(state.score).toHaveLength(2)
  })
})

describe('mockData — getOptimalRoute', () => {
  const gates = [
    { id: 'A', load: 62, disabled: false, assignedStand: 'North' },
    { id: 'B', load: 78, disabled: false, assignedStand: 'East' },
    { id: 'C', load: 94, disabled: false, assignedStand: 'South' },
  ]
  it('returns a route with steps', () => {
    const route = getOptimalRoute('A', 'North', gates)
    expect(route).toHaveProperty('steps')
    expect(route.steps.length).toBeGreaterThan(0)
  })
  it('each step has n and txt', () => {
    const route = getOptimalRoute('A', 'North', gates)
    route.steps.forEach(s => {
      expect(s).toHaveProperty('n')
      expect(s).toHaveProperty('txt')
    })
  })
  it('returns alternatives array', () => {
    const route = getOptimalRoute('A', 'North', gates)
    expect(Array.isArray(route.alternatives)).toBe(true)
  })
})

describe('mockData — generateParkingGrid', () => {
  it('returns an array of the correct size', () => {
    const grid = generateParkingGrid({ lot: 'P1', free: 100, total: 400 }, 64)
    expect(grid).toHaveLength(64)
  })
  it('contains only valid bay states', () => {
    const grid = generateParkingGrid({ lot: 'P1', free: 50, total: 400 }, 64)
    grid.forEach(b => expect(['free', 'taken', 'reserved']).toContain(b))
  })
  it('produces mostly "taken" bays when lot is full', () => {
    const grid = generateParkingGrid({ lot: 'P4', free: 0, total: 350 }, 64)
    const taken = grid.filter(b => b === 'taken').length
    expect(taken).toBeGreaterThan(50)
  })
})

// ── geminiService.js ──────────────────────────────────────────

import { generateCrowdInsight } from '../services/geminiService'

const mockState = {
  gates: [
    { id: 'A', load: 62, disabled: false, loc: 'North' },
    { id: 'B', load: 78, disabled: false, loc: 'North-East' },
    { id: 'C', load: 94, disabled: false, loc: 'South-East' },
    { id: 'D', load: 51, disabled: false, loc: 'South' },
    { id: 'E', load: 58, disabled: false, loc: 'South-West' },
    { id: 'F', load: 18, disabled: true, loc: 'North-West' },
  ],
  zones: [
    { id: 'north', name: 'North Stand', occ: 24800, cap: 28400 },
    { id: 'south', name: 'South Stand', occ: 7100, cap: 8200 },
    { id: 'east', name: 'East Stand', occ: 3200, cap: 4300 },
    { id: 'west', name: 'West Stand', occ: 3118, cap: 4300 },
  ],
  wristbands: { total: 34218, tunnel: 1842, seated: 28400, concourse: 3976 },
  matchMin: 75,
  score: [2, 1],
}

describe('geminiService — generateCrowdInsight', () => {
  it('returns a non-empty string', () => {
    const insight = generateCrowdInsight(mockState)
    expect(typeof insight).toBe('string')
    expect(insight.length).toBeGreaterThan(10)
  })
  it('returns a danger alert when a gate is overloaded', () => {
    const insight = generateCrowdInsight(mockState)
    // Gate C is at 94% — should trigger alert wording
    expect(insight).toMatch(/gate|Gate|alert|Alert|threshold|overload/i)
  })
  it('returns nominal status when all gates are fine', () => {
    const quietState = {
      ...mockState,
      gates: mockState.gates.map(g => ({ ...g, load: 50, disabled: false })),
    }
    const insight = generateCrowdInsight(quietState)
    expect(insight).toMatch(/nominal|normal|safe|ok|balanced/i)
  })
  it('handles missing gates array gracefully', () => {
    expect(() => generateCrowdInsight({ ...mockState, gates: [] })).not.toThrow()
  })
  it('mentions the densest zone', () => {
    const insight = generateCrowdInsight(mockState)
    // North Stand is densest at ~87%
    expect(insight).toMatch(/north|stand/i)
  })
})