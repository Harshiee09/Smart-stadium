/**
 * UI.jsx — reusable primitive components
 */

import React from 'react'
import { loadColor, loadClass, pct as calcPct } from '../utils/helpers'

export function Card({ title, children, extra }) {
  return (
    <div className="card" role="region" aria-label={title}>
      <div className="card-hdr">
        <span className="card-title">{title}</span>
        {extra && <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 10, color: 'var(--text2)' }}>{extra}</span>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}

export function MetricRow({ label, value, valueClass, children }) {
  return (
    <div className="mrow">
      <span className="mlabel">{label}</span>
      <span className={`mval${valueClass ? ' ' + valueClass : ''}`}>{value}</span>
      {children}
    </div>
  )
}

export function LoadBar({ value, max = 100 }) {
  const p = Math.min(100, Math.round((value / max) * 100))
  const cls = loadClass(p)
  return (
    <div className="bar-wrap" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={`${p}%`}>
      <div className={`bar-inner ${cls}`} style={{ width: `${p}%` }} />
    </div>
  )
}

export function Badge({ children, level = 'ok' }) {
  const colors = { ok: '#00ff9d', warn: '#ffb800', danger: '#ff4444' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 2,
      fontFamily: "'Share Tech Mono'", fontSize: 10,
      border: `1px solid ${colors[level]}`,
      color: colors[level],
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: colors[level],
        animation: level !== 'ok' ? 'blink 1.2s infinite' : 'none',
      }} />
      {children}
    </span>
  )
}

export function SectionHeader({ children }) {
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
}
