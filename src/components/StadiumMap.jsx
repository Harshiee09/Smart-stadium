/**
 * StadiumMap.jsx
 * Interactive SVG stadium map with live heat overlays
 */

import React from 'react'
import { useState, useEffect } from 'react'
import { pct, loadColor } from '../utils/helpers'

const GATE_POSITIONS = {
  A: { x: 200, y: 15, rotate: 0 },
  B: { x: 310, y: 42, rotate: 35 },
  C: { x: 310, y: 305, rotate: -35 },
  D: { x: 200, y: 335, rotate: 0 },
  E: { x: 76, y: 305, rotate: 35 },
  F: { x: 76, y: 42, rotate: -35 },
}

export default function StadiumMap({ state, onZoneClick, showRoute }) {
  const [heatDots, setHeatDots] = useState([])

  useEffect(() => {
    const dots = []
    // North stand density
    const nPct = pct(state.zones[0]?.occ ?? 24800, state.zones[0]?.cap ?? 28400) / 100
    for (let i = 0; i < 10; i++)
      dots.push({ x: 155 + Math.random() * 90, y: 42 + Math.random() * 35, density: nPct })
    // South stand density
    const sPct = pct(state.zones[1]?.occ ?? 7100, state.zones[1]?.cap ?? 8200) / 100
    for (let i = 0; i < 6; i++)
      dots.push({ x: 148 + Math.random() * 94, y: 295 + Math.random() * 35, density: sPct })
    setHeatDots(dots)
  }, [state.zones])

  const gateColor = (g) => {
    if (g.disabled) return '#00ff9d'
    if (g.load > 90) return '#ff4444'
    if (g.load > 75) return '#ffb800'
    return '#00d4ff'
  }

  return (
    <svg
      viewBox="0 0 400 360"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-label="Stadium map"
      role="img"
    >
      <defs>
        <radialGradient id="pitchGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0a3020" />
          <stop offset="100%" stopColor="#051a10" />
        </radialGradient>
      </defs>

      {/* Stadium shells */}
      <ellipse cx="200" cy="180" rx="185" ry="165" fill="#0c1219" stroke="#1e3048" strokeWidth="1.5" />
      <ellipse cx="200" cy="180" rx="165" ry="145" fill="#111a24" stroke="#1e3048" strokeWidth="1" />
      <ellipse cx="200" cy="180" rx="118" ry="98" fill="url(#pitchGrad)" stroke="#0f4020" strokeWidth="1" />

      {/* Pitch markings */}
      <ellipse cx="200" cy="180" rx="55" ry="45" fill="none" stroke="#0f4020" strokeWidth="0.5" />
      <line x1="200" y1="82" x2="200" y2="278" stroke="#0f4020" strokeWidth="0.5" />
      <rect x="150" y="155" width="20" height="50" fill="none" stroke="#0f4020" strokeWidth="0.5" />
      <rect x="230" y="155" width="20" height="50" fill="none" stroke="#0f4020" strokeWidth="0.5" />
      <circle cx="200" cy="180" r="4" fill="#0f4020" />
      <rect x="187" y="78" width="26" height="8" fill="none" stroke="#1a5030" strokeWidth="1" />
      <rect x="187" y="274" width="26" height="8" fill="none" stroke="#1a5030" strokeWidth="1" />

      {/* Stand zones */}
      <path
        d="M 90,60 Q 200,20 310,60 L 295,80 Q 200,45 105,80 Z"
        fill="#0a2040" stroke="#1e3048" strokeWidth="0.5"
        style={{ cursor: 'pointer' }}
        onClick={() => onZoneClick('north')}
        aria-label="North Stand - Home zone"
      />
      <path
        d="M 90,300 Q 200,340 310,300 L 295,280 Q 200,315 105,280 Z"
        fill="#2a0a0a" stroke="#3a0a0a" strokeWidth="0.5"
        style={{ cursor: 'pointer' }}
        onClick={() => onZoneClick('south')}
        aria-label="South Stand - Away zone"
      />
      <path
        d="M 340,70 Q 385,180 340,290 L 320,275 Q 365,180 320,85 Z"
        fill="#0a1a0a" stroke="#1e3048" strokeWidth="0.5"
        style={{ cursor: 'pointer' }}
        onClick={() => onZoneClick('east')}
        aria-label="East Stand"
      />
      <path
        d="M 60,70 Q 15,180 60,290 L 80,275 Q 35,180 80,85 Z"
        fill="#0a1a0a" stroke="#1e3048" strokeWidth="0.5"
        style={{ cursor: 'pointer' }}
        onClick={() => onZoneClick('west')}
        aria-label="West Stand"
      />

      {/* Heat dots */}
      {heatDots.map((d, i) => (
        <circle
          key={i}
          cx={d.x} cy={d.y}
          r={3 + d.density * 4}
          fill={loadColor(d.density * 100)}
          opacity={0.3 + d.density * 0.4}
        />
      ))}

      {/* Gates */}
      {state.gates?.map(g => {
        const pos = GATE_POSITIONS[g.id]
        if (!pos) return null
        const col = gateColor(g)
        return (
          <g key={g.id} transform={`rotate(${pos.rotate},${pos.x},${pos.y})`}>
            <rect x={pos.x - 20} y={pos.y - 8} width="40" height="14" rx="2" fill={col} opacity="0.9" />
            <text
              x={pos.x} y={pos.y + 1}
              textAnchor="middle"
              fontFamily="Share Tech Mono"
              fontSize="8"
              fill="#000"
              fontWeight="700"
            >
              GATE {g.id}
            </text>
          </g>
        )
      })}

      {/* Food stall markers */}
      {[
        { id: 'F1', x: 155, y: 110 }, { id: 'F2', x: 245, y: 110 },
        { id: 'F3', x: 310, y: 170 }, { id: 'F4', x: 310, y: 210 },
        { id: 'F5', x: 90, y: 170 }, { id: 'F6', x: 90, y: 210 },
        { id: 'F7', x: 155, y: 260 }, { id: 'F8', x: 245, y: 260 },
      ].map(f => (
        <g key={f.id}>
          <circle cx={f.x} cy={f.y} r="6" fill="#ffb800" opacity="0.8" />
          <text x={f.x} y={f.y + 3} textAnchor="middle" fontSize="7" fill="#000" fontWeight="700">{f.id}</text>
        </g>
      ))}

      {/* Disabled access indicator */}
      <circle cx="76" cy="43" r="8" fill="none" stroke="#00ff9d" strokeWidth="1.5" />
      <text x="76" y="60" textAnchor="middle" fontFamily="Share Tech Mono" fontSize="7" fill="#00ff9d">♿</text>

      {/* Parking labels */}
      {[
        { label: 'P1', x: 200, y: 8, rotate: 0 },
        { label: 'P2', x: 370, y: 180, rotate: 90 },
        { label: 'P3', x: 200, y: 356, rotate: 0 },
        { label: 'P4', x: 28, y: 180, rotate: -90 },
      ].map(p => (
        <text
          key={p.label}
          x={p.x} y={p.y}
          textAnchor="middle"
          fontFamily="Share Tech Mono"
          fontSize="7"
          fill="#5a8aa8"
          transform={p.rotate ? `rotate(${p.rotate},${p.x},${p.y})` : undefined}
        >
          {p.label}
        </text>
      ))}

      {/* Zone labels */}
      <text x="200" y="50" textAnchor="middle" fontFamily="Rajdhani" fontSize="9" fill="#4a90d9" fontWeight="700">HOME</text>
      <text x="200" y="325" textAnchor="middle" fontFamily="Rajdhani" fontSize="9" fill="#d94a4a" fontWeight="700">AWAY</text>
      <text x="360" y="183" textAnchor="middle" fontFamily="Rajdhani" fontSize="8" fill="#2e7a2e" fontWeight="700">E</text>
      <text x="40" y="183" textAnchor="middle" fontFamily="Rajdhani" fontSize="8" fill="#2e7a2e" fontWeight="700">W</text>

      {/* Best view marker */}
      <circle cx="200" cy="120" r="10" fill="none" stroke="#ffb800" strokeWidth="1.5" strokeDasharray="3,3" />
      <text x="200" y="106" textAnchor="middle" fontFamily="Share Tech Mono" fontSize="7" fill="#ffb800">★ BEST</text>

      {/* Route overlay */}
      {showRoute && (
        <g>
          <path
            d="M200,344 L200,300 L200,260 L200,220"
            stroke="#00ff9d" strokeWidth="2" fill="none"
            strokeDasharray="6,4" opacity="0.9"
          />
          <circle cx="200" cy="344" r="5" fill="#00ff9d" />
          <circle cx="200" cy="220" r="5" fill="#00d4ff" />
        </g>
      )}
    </svg>
  )
}
