/**
 * helpers.js
 * Shared utility functions for Stadium Nexus
 *
 * Pure, side-effect-free functions used across components and services.
 * All functions validate their inputs and return safe defaults.
 *
 * @module helpers
 */

// ── Load classification ───────────────────────────────────────

/**
 * Classify a percentage load value into a CSS-ready severity class.
 *
 * @param {number} pct - Percentage value (0–100).
 * @returns {'danger'|'warn'|'ok'} Severity class name.
 *
 * @example
 * loadClass(95) // 'danger'
 * loadClass(80) // 'warn'
 * loadClass(50) // 'ok'
 */
export function loadClass(pct) {
  if (typeof pct !== 'number' || isNaN(pct)) return 'ok'
  if (pct >= 90) return 'danger'
  if (pct >= 75) return 'warn'
  return 'ok'
}

/**
 * Map a percentage load value to its corresponding colour hex string.
 *
 * @param {number} pct - Percentage value (0–100).
 * @returns {string} Hex colour string.
 *
 * @example
 * loadColor(95) // '#ff4444'
 * loadColor(80) // '#ffb800'
 * loadColor(50) // '#00ff9d'
 */
export function loadColor(pct) {
  if (typeof pct !== 'number' || isNaN(pct)) return '#00ff9d'
  if (pct >= 90) return '#ff4444'
  if (pct >= 75) return '#ffb800'
  return '#00ff9d'
}

// ── Number formatting ─────────────────────────────────────────

/**
 * Format a number with locale-specific thousands separators.
 * Non-numeric values are returned as-is.
 *
 * @param {number|string} n - Value to format.
 * @returns {string} Formatted string.
 *
 * @example
 * formatNum(45200) // '45,200'
 * formatNum('N/A') // 'N/A'
 */
export function formatNum(n) {
  return typeof n === 'number' && !isNaN(n) ? n.toLocaleString() : String(n ?? '')
}

/**
 * Calculate the occupancy percentage from a count and capacity.
 * Returns 0 if capacity is zero or inputs are invalid.
 *
 * @param {number} occ - Current occupancy count.
 * @param {number} cap - Maximum capacity.
 * @returns {number} Integer percentage (0–100).
 *
 * @example
 * pct(36160, 45200) // 80
 * pct(0, 0)         // 0
 */
export function pct(occ, cap) {
  if (typeof occ !== 'number' || typeof cap !== 'number' || cap === 0) return 0
  return Math.min(100, Math.round((occ / cap) * 100))
}

// ── Time helpers ──────────────────────────────────────────────

/**
 * Format a duration in seconds into a compact MM:SS string.
 *
 * @param {number} totalSeconds - Duration in seconds (non-negative).
 * @returns {string} Formatted time string e.g. "4:30".
 *
 * @example
 * formatTime(270) // '4:30'
 * formatTime(60)  // '1:00'
 */
export function formatTime(totalSeconds) {
  if (typeof totalSeconds !== 'number' || totalSeconds < 0) return '0:00'
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Return a human-readable "X min ago" or "just now" label
 * relative to the current time.
 *
 * @param {number} timestampMs - Unix timestamp in milliseconds.
 * @returns {string} Relative time label.
 *
 * @example
 * timeAgo(Date.now() - 90000) // '1 min ago'
 */
export function timeAgo(timestampMs) {
  if (typeof timestampMs !== 'number') return 'unknown'
  const diffSec = Math.floor((Date.now() - timestampMs) / 1000)
  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  return `${Math.floor(diffMin / 60)}h ago`
}

// ── Crowd & gate logic ────────────────────────────────────────

/**
 * Given an array of gates, return the gate with the lowest load
 * that is not disabled.
 *
 * @param {Array<{ id: string, load: number, disabled?: boolean }>} gates
 * @returns {{ id: string, load: number }|null} Quietest gate, or null.
 */
export function quietestGate(gates) {
  if (!Array.isArray(gates) || gates.length === 0) return null
  const active = gates.filter(g => !g.disabled)
  if (active.length === 0) return null
  return active.reduce((best, g) => (g.load < best.load ? g : best))
}

/**
 * Given an array of gates, return the gate with the highest load.
 *
 * @param {Array<{ id: string, load: number }>} gates
 * @returns {{ id: string, load: number }|null} Busiest gate, or null.
 */
export function busiestGate(gates) {
  if (!Array.isArray(gates) || gates.length === 0) return null
  return gates.reduce((worst, g) => (g.load > worst.load ? g : worst))
}

/**
 * Given an array of food stalls, return the one with the shortest wait.
 *
 * @param {Array<{ id: string, wait: number }>} stalls
 * @returns {{ id: string, wait: number }|null} Best stall, or null.
 */
export function bestFoodStall(stalls) {
  if (!Array.isArray(stalls) || stalls.length === 0) return null
  return stalls.reduce((best, s) => (s.wait < best.wait ? s : best))
}

// ── Input validation ──────────────────────────────────────────

/**
 * Validate a ticket form submission.
 * Returns an object with `valid` boolean and `errors` map.
 *
 * @param {{ name: string, bookingId: string, row: string, seat: string, stand: string }} fields
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateTicket(fields) {
  /** @type {Record<string, string>} */
  const errors = {}

  if (!fields.name?.trim())
    errors.name = 'Name is required'

  if (!fields.bookingId?.trim())
    errors.bookingId = 'Booking ID is required'
  else if (!/^[A-Za-z0-9-]{4,}$/.test(fields.bookingId.trim()))
    errors.bookingId = 'Booking ID must be at least 4 alphanumeric characters'

  if (!fields.row?.trim())
    errors.row = 'Row is required'

  const seatNum = parseInt(fields.seat, 10)
  if (isNaN(seatNum) || seatNum < 1 || seatNum > 999)
    errors.seat = 'Seat must be a number between 1 and 999'

  if (!fields.stand)
    errors.stand = 'Stand selection is required'

  return { valid: Object.keys(errors).length === 0, errors }
}

// ── Misc ──────────────────────────────────────────────────────

/**
 * Clamp a number between a minimum and maximum value.
 *
 * @param {number} value - Input value.
 * @param {number} min   - Lower bound.
 * @param {number} max   - Upper bound.
 * @returns {number} Clamped value.
 *
 * @example
 * clamp(150, 0, 100) // 100
 * clamp(-5,  0, 100) // 0
 */
export function clamp(value, min, max) {
  if (typeof value !== 'number') return min
  return Math.min(max, Math.max(min, value))
}

/**
 * Generate a random integer in the range [min, max] (inclusive).
 *
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 * @returns {number} Random integer.
 */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Pick a random element from an array.
 * Returns undefined for empty arrays.
 *
 * @template T
 * @param {T[]} arr - Source array.
 * @returns {T|undefined}
 */
export function pick(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return undefined
  return arr[Math.floor(Math.random() * arr.length)]
}