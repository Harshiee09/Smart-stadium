import React, { useEffect, useRef, useState } from 'react'

// Stadium geometry constants
const CX = 220  // center x of pitch
const CY = 190  // center y of pitch

// Gate positions on the stadium oval (for animation path)
const GATE_POSITIONS = {
    A: { x: 220, y: 18, label: 'North' },
    B: { x: 370, y: 55, label: 'NE' },
    C: { x: 390, y: 295, label: 'SE' },
    D: { x: 220, y: 355, label: 'South' },
    E: { x: 60, y: 295, label: 'SW' },
    F: { x: 50, y: 55, label: 'NW' },
}

// Stand seat zone centers
const STAND_SEATS = {
    north: { x: 220, y: 65 },
    south: { x: 220, y: 310 },
    east: { x: 355, y: 185 },
    west: { x: 82, y: 185 },
}

// Concourse midpoints (tunnel entry)
const CONCOURSE = {
    north: { x: 220, y: 105 },
    south: { x: 220, y: 270 },
    east: { x: 325, y: 185 },
    west: { x: 115, y: 185 },
}

function loadColor(load) {
    if (load >= 85) return '#ef4444'
    if (load >= 70) return '#f59e0b'
    return '#22c55e'
}

function loadOpacity(load) {
    return 0.15 + (load / 100) * 0.5
}

// Build animated SVG path: gate → concourse → seat
function buildPath(gateId, stand) {
    const g = GATE_POSITIONS[gateId]
    const c = CONCOURSE[stand]
    const s = STAND_SEATS[stand]
    if (!g || !c || !s) return ''
    return `M${g.x},${g.y} Q${(g.x + c.x) / 2},${(g.y + c.y) / 2} ${c.x},${c.y} L${s.x},${s.y}`
}

export default function IndoorMap({ fanData, gates, stand, bestGate }) {
    const [progress, setProgress] = useState(0)
    const [pathLen, setPathLen] = useState(0)
    const pathRef = useRef(null)
    const animRef = useRef(null)
    const startRef = useRef(null)

    const gateId = bestGate || 'A'
    const pathD = buildPath(gateId, stand || 'north')
    const gatePos = GATE_POSITIONS[gateId] || GATE_POSITIONS.A
    const seatPos = STAND_SEATS[stand || 'north']

    // Animate dot along path
    useEffect(() => {
        if (!pathRef.current) return
        const len = pathRef.current.getTotalLength()
        setPathLen(len)
        setProgress(0)
        startRef.current = null

        const duration = 2800

        function step(ts) {
            if (!startRef.current) startRef.current = ts
            const elapsed = ts - startRef.current
            const p = Math.min(elapsed / duration, 1)
            // ease in-out
            const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p
            setProgress(eased)
            if (p < 1) animRef.current = requestAnimationFrame(step)
        }

        animRef.current = requestAnimationFrame(step)
        return () => cancelAnimationFrame(animRef.current)
    }, [gateId, stand])

    // Dot position along path
    const dotPt = pathLen > 0 && pathRef.current
        ? pathRef.current.getPointAtLength(progress * pathLen)
        : gatePos

    return (
        <div style={{ position: 'relative', width: '100%', borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
            {/* Legend */}
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[['#22c55e', 'Clear'], ['#f59e0b', 'Moderate'], ['#ef4444', 'Busy']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                        {l}
                    </div>
                ))}
            </div>

            {/* Label */}
            <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase', zIndex: 10 }}>
                Live Stadium Map
            </div>

            <svg width="100%" viewBox="0 0 440 390" style={{ display: 'block' }}>
                <defs>
                    <radialGradient id="pitchGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#1a4a2e" />
                        <stop offset="100%" stopColor="#0f3020" />
                    </radialGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                {/* Outer stadium shell */}
                <ellipse cx={CX} cy={CY} rx={200} ry={175} fill="rgba(15,32,68,0.9)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

                {/* Stand zones with crowd heatmap */}
                {(gates || []).map(g => {
                    const stand_ = g.assignedStand?.toLowerCase()
                    const zones = {
                        north: <ellipse key="nz" cx={220} cy={80} rx={145} ry={38} fill={loadColor(g.load)} fillOpacity={loadOpacity(g.load)} />,
                        south: <ellipse key="sz" cx={220} cy={298} rx={145} ry={38} fill={loadColor(g.load)} fillOpacity={loadOpacity(g.load)} />,
                        east: <ellipse key="ez" cx={338} cy={190} rx={38} ry={100} fill={loadColor(g.load)} fillOpacity={loadOpacity(g.load)} />,
                        west: <ellipse key="wz" cx={102} cy={190} rx={38} ry={100} fill={loadColor(g.load)} fillOpacity={loadOpacity(g.load)} />,
                    }
                    return zones[stand_] || null
                })}

                {/* Pitch */}
                <ellipse cx={CX} cy={CY} rx={130} ry={110} fill="url(#pitchGrad)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                {/* Pitch lines */}
                <ellipse cx={CX} cy={CY} rx={100} ry={82} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
                <line x1={CX} y1={CY - 110} x2={CX} y2={CY + 110} stroke="rgba(255,255,255,0.10)" strokeWidth="0.8" />
                <circle cx={CX} cy={CY} r={22} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
                <circle cx={CX} cy={CY} r={2} fill="rgba(255,255,255,0.3)" />
                {/* Goal boxes */}
                <rect x={188} y={80} width={64} height={22} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" rx="1" />
                <rect x={188} y={278} width={64} height={22} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" rx="1" />

                {/* Gates */}
                {Object.entries(GATE_POSITIONS).map(([id, pos]) => {
                    const liveGate = (gates || []).find(g => g.id === id)
                    const load = liveGate?.load || 50
                    const col = loadColor(load)
                    const isBest = id === gateId
                    const isDisabled = id === 'F'
                    return (
                        <g key={id}>
                            <circle
                                cx={pos.x} cy={pos.y} r={isBest ? 9 : 7}
                                fill={isDisabled ? 'rgba(255,255,255,0.1)' : isBest ? col : 'rgba(255,255,255,0.06)'}
                                stroke={isBest ? col : 'rgba(255,255,255,0.2)'}
                                strokeWidth={isBest ? 2 : 1}
                                filter={isBest ? 'url(#glow)' : undefined}
                            />
                            <text
                                x={pos.x} y={pos.y + 4}
                                textAnchor="middle"
                                fontSize="8"
                                fontWeight="700"
                                fill={isDisabled ? 'rgba(255,255,255,0.25)' : isBest ? '#fff' : 'rgba(255,255,255,0.55)'}
                            >{id}</text>
                            {isBest && (
                                <circle cx={pos.x} cy={pos.y} r={14} fill="none" stroke={col} strokeWidth="1" strokeDasharray="3 2" opacity="0.5">
                                    <animateTransform attributeName="transform" type="rotate" from={`0 ${pos.x} ${pos.y}`} to={`360 ${pos.x} ${pos.y}`} dur="4s" repeatCount="indefinite" />
                                </circle>
                            )}
                        </g>
                    )
                })}

                {/* Animated route path */}
                {pathD && (
                    <>
                        {/* Full path trace (faint) */}
                        <path d={pathD} fill="none" stroke="rgba(34,197,94,0.2)" strokeWidth="2" strokeDasharray="4 4" />
                        {/* Measured path for dot position */}
                        <path ref={pathRef} d={pathD} fill="none" stroke="rgba(34,197,94,0.7)" strokeWidth="2.5" strokeLinecap="round"
                            strokeDasharray={pathLen}
                            strokeDashoffset={pathLen - progress * pathLen}
                            style={{ transition: 'none' }}
                        />
                    </>
                )}

                {/* Moving dot */}
                {dotPt && (
                    <g filter="url(#glow)">
                        <circle cx={dotPt.x} cy={dotPt.y} r={6} fill="#22c55e" opacity="0.3" />
                        <circle cx={dotPt.x} cy={dotPt.y} r={4} fill="#22c55e" />
                    </g>
                )}

                {/* Seat destination marker */}
                {seatPos && (
                    <g>
                        <circle cx={seatPos.x} cy={seatPos.y} r={8} fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="2 2" />
                        <text x={seatPos.x} y={seatPos.y + 4} textAnchor="middle" fontSize="7" fill="#22c55e" fontWeight="700">YOU</text>
                    </g>
                )}

                {/* Compass */}
                <g transform="translate(408,360)">
                    <circle cx={0} cy={0} r={12} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                    <text x={0} y={-4} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.5)" fontWeight="600">N</text>
                    <text x={0} y={10} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.3)">S</text>
                </g>
            </svg>

            {/* Bottom info bar */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    Gate <span style={{ color: '#22c55e', fontWeight: 600 }}>{gateId}</span> → {stand ? stand.charAt(0).toUpperCase() + stand.slice(1) : ''} Stand
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    {progress >= 0.99 ? '✓ Route traced' : 'Tracing route...'}
                </div>
            </div>
        </div>
    )
}