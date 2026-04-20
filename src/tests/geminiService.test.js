import { describe, it, expect, beforeEach, vi } from 'vitest'
import { queryStadiumAI, generateCrowdInsight } from '../services/geminiService'

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
    food: [
        { id: 'F1', name: 'Burgers', wait: 12 },
        { id: 'F2', name: 'Drinks Bar', wait: 3 },
        { id: 'F3', name: 'Pizza', wait: 18 },
        { id: 'F4', name: 'Snacks', wait: 5 },
        { id: 'F5', name: 'Hot Dogs', wait: 7 },
        { id: 'F6', name: 'Coffee', wait: 14 },
        { id: 'F7', name: 'Kebabs', wait: 4 },
        { id: 'F8', name: 'Ice Cream', wait: 6 },
    ],
    parking: [
        { lot: 'P1', name: 'North Car Park', free: 240, total: 400 },
        { lot: 'P2', name: 'East Car Park', free: 12, total: 350 },
        { lot: 'P3', name: 'South Car Park', free: 80, total: 300 },
        { lot: 'P4', name: 'West Car Park', free: 0, total: 350 },
    ],
    matchMin: 75,
    score: [2, 1],
}

const mockFanContext = {
    name: 'Harshvardhan',
    stand: 'north',
    row: 'A',
    seat: '22',
    parking: 'yes',
}

describe('geminiService — generateCrowdInsight', () => {
    it('returns a non-empty string', () => {
        const insight = generateCrowdInsight(mockState)
        expect(typeof insight).toBe('string')
        expect(insight.length).toBeGreaterThan(10)
    })

    it('returns alert wording when a gate exceeds 85% load', () => {
        const insight = generateCrowdInsight(mockState)
        expect(insight).toMatch(/gate|Gate|threshold|dispersal/i)
    })

    it('returns nominal message when all gates are under 85%', () => {
        const quietState = {
            ...mockState,
            gates: mockState.gates.map(g => ({ ...g, load: 50, disabled: false })),
        }
        const insight = generateCrowdInsight(quietState)
        expect(insight).toMatch(/nominal|normal|safe|ok|balanced|clear/i)
    })

    it('mentions the densest zone', () => {
        const insight = generateCrowdInsight(mockState)
        expect(insight).toMatch(/north|stand/i)
    })

    it('handles empty gates array without throwing', () => {
        expect(() => generateCrowdInsight({ ...mockState, gates: [] })).not.toThrow()
    })

    it('handles empty zones array without throwing', () => {
        expect(() => generateCrowdInsight({ ...mockState, zones: [] })).not.toThrow()
    })

    it('includes tunnel fan count in nominal message', () => {
        const quietState = {
            ...mockState,
            gates: mockState.gates.map(g => ({ ...g, load: 40, disabled: false })),
        }
        const insight = generateCrowdInsight(quietState)
        expect(insight).toMatch(/1[,.]?842|tunnel|transit/i)
    })
})

describe('geminiService — queryStadiumAI (local fallback)', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_GEMINI_API_KEY', '')
    })

    it('returns a string for a general query', async () => {
        const result = await queryStadiumAI('hello', mockState, mockFanContext)
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(5)
    })

    it('exit query recommends a gate', async () => {
        const result = await queryStadiumAI('how do I exit?', mockState, mockFanContext)
        expect(result).toMatch(/gate|Gate/i)
    })

    it('food query returns queue or stall info', async () => {
        const result = await queryStadiumAI('where should I get food?', mockState, mockFanContext)
        expect(result).toMatch(/queue|wait|min|stall|food/i)
    })

    it('parking query returns lot information', async () => {
        const result = await queryStadiumAI('where can I park?', mockState, mockFanContext)
        expect(result).toMatch(/P1|lot|park|bays|free/i)
    })

    it('crowd query returns occupancy information', async () => {
        const result = await queryStadiumAI('how busy is it?', mockState, mockFanContext)
        expect(result).toMatch(/fan|crowd|gate|load|wristband/i)
    })

    it('score query mentions the scoreline', async () => {
        const result = await queryStadiumAI('what is the score?', mockState, mockFanContext)
        expect(result).toMatch(/2.{0,3}1|City|United|score/i)
    })

    it('gate query recommends a gate', async () => {
        const result = await queryStadiumAI('which gate should I use?', mockState, mockFanContext)
        expect(result).toMatch(/gate|Gate/i)
    })

    it('accessibility query mentions accessible entry', async () => {
        const result = await queryStadiumAI('I need wheelchair access', mockState, mockFanContext)
        expect(result).toMatch(/gate F|Gate F|accessible|disabled|wheelchair/i)
    })

    it('unknown query returns a helpful default message', async () => {
        const result = await queryStadiumAI('xyzzy undefined query 12345', mockState, mockFanContext)
        expect(result).toMatch(/food|exit|view|score|atmosphere|help/i)
    })
})