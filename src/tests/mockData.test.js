/**
 * mockData.test.js
 */
import { describe, it, expect } from 'vitest'
import {
  generateLiveState,
  getOptimalRoute,
  generateParkingGrid,
  STADIUM_CONFIG,
} from '../data/mockData'

describe('generateLiveState', () => {
  it('returns a valid initial state when called with null', () => {
    const state = generateLiveState(null)
    expect(state).toBeDefined()
    expect(state.gates).toHaveLength(6)
    expect(state.zones).toHaveLength(4)
    expect(state.food).toHaveLength(8)
    expect(state.parking).toHaveLength(4)
    expect(state.wristbands).toBeDefined()
    expect(state.cv).toHaveLength(8)
  })

  it('gate loads stay within 5–99 bounds', () => {
    let state = generateLiveState(null)
    for (let i = 0; i < 20; i++) state = generateLiveState(state)
    state.gates.forEach(g => {
      expect(g.load).toBeGreaterThanOrEqual(5)
      expect(g.load).toBeLessThanOrEqual(99)
    })
  })

  it('disabled gate F stays disabled', () => {
    let state = generateLiveState(null)
    for (let i = 0; i < 10; i++) state = generateLiveState(state)
    const gateF = state.gates.find(g => g.id === 'F')
    expect(gateF.disabled).toBe(true)
  })

  it('food wait times stay within 1–maxWait bounds', () => {
    let state = generateLiveState(null)
    for (let i = 0; i < 15; i++) state = generateLiveState(state)
    state.food.forEach(f => {
      expect(f.wait).toBeGreaterThanOrEqual(1)
      expect(f.wait).toBeLessThanOrEqual(f.maxWait)
    })
  })

  it('parking free bays never go below 0', () => {
    let state = generateLiveState(null)
    for (let i = 0; i < 50; i++) state = generateLiveState(state)
    state.parking.forEach(p => {
      expect(p.free).toBeGreaterThanOrEqual(0)
    })
  })

  it('wristband total increases monotonically', () => {
    const s1 = generateLiveState(null)
    const s2 = generateLiveState(s1)
    expect(s2.wristbands.total).toBeGreaterThanOrEqual(s1.wristbands.total)
  })

  it('match minute increments and caps at 90', () => {
    let state = generateLiveState(null)
    state.matchMin = 89
    for (let i = 0; i < 20; i++) state = generateLiveState(state)
    expect(state.matchMin).toBeLessThanOrEqual(90)
  })

  it('alerts array is always defined and non-empty', () => {
    const state = generateLiveState(null)
    expect(Array.isArray(state.alerts)).toBe(true)
    expect(state.alerts.length).toBeGreaterThan(0)
  })

  it('cv tunnel cameras have count property', () => {
    const state = generateLiveState(null)
    state.cv.filter(c => c.type === 'tunnel').forEach(c => {
      expect(typeof c.count).toBe('number')
      expect(c.count).toBeGreaterThanOrEqual(0)
    })
  })

  it('cv seat cameras have fill property 0–100', () => {
    const state = generateLiveState(null)
    state.cv.filter(c => c.type === 'seats').forEach(c => {
      expect(c.fill).toBeGreaterThanOrEqual(0)
      expect(c.fill).toBeLessThanOrEqual(100)
    })
  })
})

describe('getOptimalRoute', () => {
  it('returns steps array with 5 entries', () => {
    const state = generateLiveState(null)
    const route = getOptimalRoute('A', 'North', state.gates)
    expect(route.steps).toHaveLength(5)
  })

  it('recommended gate matches input', () => {
    const state = generateLiveState(null)
    const route = getOptimalRoute('A', 'North', state.gates)
    expect(route.recommended).toBe('A')
  })

  it('alternatives do not include the recommended gate', () => {
    const state = generateLiveState(null)
    const route = getOptimalRoute('A', 'North', state.gates)
    route.alternatives.forEach(a => expect(a.gate).not.toBe('A'))
  })

  it('each step has n, txt, and time fields', () => {
    const state = generateLiveState(null)
    const route = getOptimalRoute('A', 'North', state.gates)
    route.steps.forEach(s => {
      expect(s).toHaveProperty('n')
      expect(s).toHaveProperty('txt')
      expect(s).toHaveProperty('time')
    })
  })
})

describe('generateParkingGrid', () => {
  it('returns exactly size bays', () => {
    const lot = { free: 100, total: 400 }
    const grid = generateParkingGrid(lot, 64)
    expect(grid).toHaveLength(64)
  })

  it('each bay is free, taken, or reserved', () => {
    const lot = { free: 50, total: 400 }
    const grid = generateParkingGrid(lot)
    grid.forEach(b => expect(['free', 'taken', 'reserved']).toContain(b))
  })

  it('full lot has no free bays', () => {
    const lot = { free: 0, total: 100 }
    const grid = generateParkingGrid(lot, 100)
    const freeCount = grid.filter(b => b === 'free').length
    expect(freeCount).toBe(0)
  })
})

describe('STADIUM_CONFIG', () => {
  it('has 6 gates', () => expect(STADIUM_CONFIG.gates).toHaveLength(6))
  it('has 4 zones', () => expect(STADIUM_CONFIG.zones).toHaveLength(4))
  it('has 8 food stalls', () => expect(STADIUM_CONFIG.foodStalls).toHaveLength(8))
  it('has 4 parking lots', () => expect(STADIUM_CONFIG.parkingLots).toHaveLength(4))
  it('total capacity is 45200', () => expect(STADIUM_CONFIG.capacity).toBe(45200))
  it('has bestViewSpots', () => expect(STADIUM_CONFIG.bestViewSpots.length).toBeGreaterThan(0))
})
