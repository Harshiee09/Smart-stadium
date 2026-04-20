/**
 * UI.jsx — reusable primitive components
 * Optimised: React.memo, PropTypes on all exports
 */

import React, { memo } from 'react'
import PropTypes from 'prop-types'
import { loadColor, loadClass, pct as calcPct } from '../utils/helpers'

/**
 * Card — labelled region wrapper with optional header extra
 */
export const Card = memo(function Card({ title, children, extra }) {
  return (
    <div className="card" role="region" aria-label={title}>
      <div className="card-hdr">
        <span className="card-title">{title}</span>
        {extra && (
          <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 10, color: 'var(--text2)' }}>
            {extra}
          </span>
        )}
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
})

Card.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  extra: PropTypes.string,
}

/**
 * MetricRow — label + value row, optionally with children
 */
export const MetricRow = memo(function MetricRow({ label, value, valueClass, children }) {
  return (
    <div className="mrow">
      <span className="mlabel">{label}</span>
      <span className={`mval${valueClass ? ' ' + valueClass : ''}`}>{value}</span>
      {children}
    </div>
  )
})

MetricRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.node]).isRequired,
  valueClass: PropTypes.string,
  children: PropTypes.node,
}

/**
 * LoadBar — accessible progress bar driven by value / max
 * @param {number} value  - current value
 * @param {number} max    - maximum value (default 100)
 */
export const LoadBar = memo(function LoadBar({ value, max = 100 }) {
  const p = Math.min(100, Math.max(0, Math.round((value / max) * 100)))
  const cls = loadClass(p)
  return (
    <div
      className="bar-wrap"
      role="progressbar"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${p}%`}
    >
      <div className={`bar-inner ${cls}`} style={{ width: `${p}%` }} />
    </div>
  )
})

LoadBar.propTypes = {
  value: PropTypes.number.isRequired,
  max: PropTypes.number,
}

/**
 * Badge — status badge with animated dot for warn/danger states
 * @param {'ok'|'warn'|'danger'} level
 */
export const Badge = memo(function Badge({ children, level = 'ok' }) {
  const colors = Object.freeze({ ok: '#00ff9d', warn: '#ffb800', danger: '#ff4444' })
  const color = colors[level] || colors.ok
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 2,
      fontFamily: "'Share Tech Mono'", fontSize: 10,
      border: `1px solid ${color}`,
      color,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: color,
        animation: level !== 'ok' ? 'blink 1.2s infinite' : 'none',
      }} />
      {children}
    </span>
  )
})

Badge.propTypes = {
  children: PropTypes.node.isRequired,
  level: PropTypes.oneOf(['ok', 'warn', 'danger']),
}

/**
 * SectionHeader — styled h2 for section titles
 */
export const SectionHeader = memo(function SectionHeader({ children }) {
  return (
    <h2 style={{
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: 11, fontWeight: 700, letterSpacing: '1.5px',
      color: 'var(--accent)', textTransform: 'uppercase',
      marginBottom: 6,
    }}>
      {children}
    </h2>
  )
})

SectionHeader.propTypes = {
  children: PropTypes.node.isRequired,
}