/**
 * helpers.test.js
 */
import { describe, it, expect } from 'vitest'
import { loadClass, loadColor, formatNum, pct } from '../utils/helpers'

describe('loadClass', () => {
    it('returns danger for >= 90', () => expect(loadClass(90)).toBe('danger'))
    it('returns danger for 95', () => expect(loadClass(95)).toBe('danger'))
    it('returns warn for 75', () => expect(loadClass(75)).toBe('warn'))
    it('returns warn for 85', () => expect(loadClass(85)).toBe('warn'))
    it('returns ok for 74', () => expect(loadClass(74)).toBe('ok'))
    it('returns ok for 0', () => expect(loadClass(0)).toBe('ok'))
})

describe('loadColor', () => {
    it('returns red hex for >= 90', () => expect(loadColor(90)).toBe('#ff4444'))
    it('returns amber hex for >= 75', () => expect(loadColor(75)).toBe('#ffb800'))
    it('returns green hex for < 75', () => expect(loadColor(50)).toBe('#00ff9d'))
})

describe('formatNum', () => {
    it('formats thousands with commas', () => expect(formatNum(34218)).toBe('34,218'))
    it('handles small numbers', () => expect(formatNum(4)).toBe('4'))
    it('passes through strings', () => expect(formatNum('N/A')).toBe('N/A'))
    it('handles zero', () => expect(formatNum(0)).toBe('0'))
})

describe('pct', () => {
    it('calculates percentage correctly', () => expect(pct(24800, 28400)).toBe(87))
    it('rounds correctly', () => expect(pct(1, 3)).toBe(33))
    it('handles full capacity', () => expect(pct(100, 100)).toBe(100))
    it('handles zero occupancy', () => expect(pct(0, 100)).toBe(0))
}) 
