/**
 * Pages.jsx — all tab page views
 */

import React from 'react'
import { useState, useEffect } from 'react'
import { Card, MetricRow, LoadBar, Badge } from './UI'
import { loadClass, loadColor, formatNum, pct } from '../utils/helpers'
import { getOptimalRoute, generateParkingGrid, STADIUM_CONFIG } from '../data/mockData'

// ── MAP page ─────────────────────────────────────────────────
export function MapPage({ state, crowdInsight }) {
  const now = new Date().toLocaleTimeString('en-GB', { hour12: false })
  return (
    <div className="rpanel">
      <Card title="LIVE GATE STATUS" extra={`UPDATED ${now}`}>
        {state.gates?.map(g => {
          const cls = loadClass(g.load)
          return (
            <div key={g.id}>
              <div className="mrow">
                <span className="mlabel">
                  GATE {g.id} — {g.loc}{g.disabled ? ' ♿' : ''}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 10, color: 'var(--text2)' }}>
                    {formatNum(g.fans)}/hr
                  </span>
                  <span className={`mval ${cls}`}>{g.load.toFixed(0)}%</span>
                </span>
              </div>
              <LoadBar value={g.load} />
            </div>
          )
        })}
      </Card>

      <Card title="ZONE OCCUPANCY">
        {state.zones?.map(z => {
          const p = pct(z.occ, z.cap)
          const cls = loadClass(p)
          const teamColor = z.team === 'HOME' ? '#4a90d9' : z.team === 'AWAY' ? '#d94a4a' : '#4a9a4a'
          return (
            <div key={z.id}>
              <div className="mrow">
                <span className="mlabel">
                  {z.name}{' '}
                  <span style={{ color: teamColor, fontSize: 10 }}>{z.team}</span>
                </span>
                <span className={`mval ${cls}`}>{p}%</span>
              </div>
              <LoadBar value={p} />
            </div>
          )
        })}
      </Card>

      <Card title="WRISTBAND COUNTERS">
        <div className="mrow"><span className="mlabel">Total scanned</span><span className="mval">{formatNum(state.wristbands?.total)}</span></div>
        <div className="mrow"><span className="mlabel">In tunnels now</span><span className="mval warn">{formatNum(state.wristbands?.tunnel)}</span></div>
        <div className="mrow"><span className="mlabel">Seated</span><span className="mval ok">{formatNum(state.wristbands?.seated)}</span></div>
        <div className="mrow"><span className="mlabel">Concourse</span><span className="mval">{formatNum(state.wristbands?.concourse)}</span></div>
        <LoadBar value={state.wristbands?.seated} max={state.wristbands?.total} />
      </Card>

      <Card title="AI CROWD INSIGHT">
        <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, fontFamily: "'Share Tech Mono'" }}>
          {crowdInsight}
        </p>
      </Card>
    </div>
  )
}

// ── ROUTE page ───────────────────────────────────────────────
export function RoutePage({ state }) {
  const [showRoute, setShowRoute] = useState(false)
  const route = getOptimalRoute('A', 'North', state.gates ?? [])
  const quietGate = state.gates?.filter(g => !g.disabled).reduce((a, b) => a.load < b.load ? a : b)

  return (
    <div className="rpanel">
      <Card title="YOUR TICKET">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['STAND', 'NORTH B'],
            ['ROW / SEAT', '14 / 22'],
            ['ASSIGNED ENTRY', <span style={{ color: 'var(--accent2)', fontFamily: "'Share Tech Mono'", fontSize: 14 }}>GATE A</span>],
            ['EST. WALK', <span style={{ color: 'var(--warn)', fontFamily: "'Share Tech Mono'", fontSize: 14 }}>4 MIN</span>],
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: 'var(--text2)' }}>{label}</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{val}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="AI OPTIMAL ROUTE">
        {route.steps.map(s => (
          <div className="route-step" key={s.n}>
            <div className="step-num">{s.n}</div>
            <div>
              <div className="step-txt">{s.txt}</div>
              <div className="step-time">ETA +{s.time}</div>
            </div>
          </div>
        ))}
      </Card>

      <Card title="ALTERNATIVE ROUTES">
        {route.alternatives.map(a => (
          <div className="mrow" key={a.gate}>
            <span className="mlabel">Via Gate {a.gate} — {a.load.toFixed(0)}% load</span>
            <span className="mval warn">+{a.extraMin} min</span>
          </div>
        ))}
        <div className="mrow">
          <span className="mlabel">Gate F (NW) — disabled route</span>
          <span className="mval ok">♿ Priority</span>
        </div>
        {quietGate && (
          <div className="mrow">
            <span className="mlabel">AI best gate right now</span>
            <span className="mval ok">Gate {quietGate.id} ({quietGate.load.toFixed(0)}%)</span>
          </div>
        )}
      </Card>

      <button
        onClick={() => setShowRoute(v => !v)}
        style={{ margin: '0 10px 10px', background: 'var(--accent)', color: '#000', border: 'none', padding: 8, width: 'calc(100% - 20px)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 1, borderRadius: 3, cursor: 'pointer' }}
        aria-pressed={showRoute}
      >
        {showRoute ? 'HIDE ROUTE ON MAP' : 'SHOW ROUTE ON MAP'}
      </button>
    </div>
  )
}

// ── MATCH page ───────────────────────────────────────────────
export function MatchPage({ state }) {
  const { home, away, homeColor, awayColor } = STADIUM_CONFIG.match
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="match-banner" role="banner" aria-label="Live match score">
        <div className="team-row">
          <span className="team-name team-home">{home}</span>
          <span className="score" aria-label={`Score: ${state.score?.[0]} to ${state.score?.[1]}`}>
            {state.score?.[0]} — {state.score?.[1]}
          </span>
          <span className="team-name team-away">{away}</span>
        </div>
        <div className="match-meta">
          <span>⏱ {state.matchMin}'</span>
          <span>📍 {STADIUM_CONFIG.name}</span>
          <span>🎟 Sold out · {formatNum(STADIUM_CONFIG.capacity)}</span>
          <span>🌡 24°C</span>
        </div>
      </div>

      <div className="rpanel">
        <Card title="FAN ZONE SUMMARY">
          {STADIUM_CONFIG.zones.map((z, i) => {
            const occ = state.zones?.[i]?.occ ?? z.cap * 0.87
            return (
              <div className="mrow" key={z.id}>
                <span className="mlabel">{z.name} <span style={{ color: z.team === 'HOME' ? '#4a90d9' : z.team === 'AWAY' ? '#d94a4a' : '#4a9a4a', fontSize: 10 }}>{z.team}</span></span>
                <span className="mval">{formatNum(Math.round(occ))} seats</span>
              </div>
            )
          })}
          <div className="mrow"><span className="mlabel">Separated by</span><span className="mval ok">Buffer Zone Row J</span></div>
        </Card>

        <Card title="★ BEST VIEWING SPOTS">
          {STADIUM_CONFIG.bestViewSpots.map(s => (
            <div className="mrow" key={s.area}>
              <span className="mlabel" style={{ fontSize: 11 }}>{s.area}</span>
              <span className="mval" style={{ color: s.rating >= 4.5 ? 'var(--accent2)' : s.rating >= 4 ? 'var(--warn)' : 'var(--text2)' }}>
                ⭐ {s.rating} <span style={{ fontSize: 10, color: 'var(--text3)' }}>({s.reviews})</span>
              </span>
            </div>
          ))}
        </Card>

        <Card title="LIVE MATCH EVENTS">
          <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 11, lineHeight: 1.8, color: 'var(--text2)' }}>
            {[
              [`${state.matchMin}'`, '⚽ City FC penalty — 2:1'],
              ['63\'', '🟡 Yellow card — United #8'],
              ['58\'', '↔️ Sub — United #11 → #22'],
              ['45\'', '⏱ HT: City 1 — United 1'],
              ['34\'', '⚽ United equaliser — 1:1'],
              ['12\'', '⚽ City free kick — 1:0'],
            ].map(([t, e]) => (
              <div key={t}>{t} {e}</div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── PARKING page ─────────────────────────────────────────────
export function ParkingPage({ state }) {
  const [grid, setGrid] = useState([])
  const activeLot = state.parking?.[0] ?? { lot: 'P1', name: 'North', free: 142, total: 400 }

  useEffect(() => {
    setGrid(generateParkingGrid(activeLot))
  }, [state.parking?.[0]?.free])

  return (
    <div className="rpanel">
      <Card title="PARKING OVERVIEW">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          {state.parking?.map(p => {
            const cls = p.free <= 5 ? 'danger' : p.free <= 30 ? 'warn' : 'ok'
            return (
              <div className="cv-cell" key={p.lot}>
                <div className="cv-label">{p.lot} {p.name.toUpperCase()}</div>
                <div className={`cv-val ${cls}`}>{p.free} free</div>
                <LoadBar value={p.total - p.free} max={p.total} />
              </div>
            )
          })}
        </div>
      </Card>

      <Card title={`${activeLot.lot} ${activeLot.name.toUpperCase()} — BAY MAP`} extra="FREE / TAKEN / RESERVED">
        <div className="park-grid" aria-label="Parking bay map" role="grid">
          {grid.map((bay, i) => (
            <div
              key={i}
              className={`park-bay ${bay}`}
              role="gridcell"
              aria-label={`Bay ${i + 1}: ${bay}`}
              title={`Bay ${i + 1}: ${bay}`}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {[['free', '#0a2a18', 'Free'], ['taken', '#2a0a0a', 'Taken'], ['reserved', '#1a1a0a', 'Reserved']].map(([k, c, l]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text2)' }}>
              <span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: 'inline-block' }} />
              {l}
            </span>
          ))}
        </div>
      </Card>

      <Card title="EXIT ROUTING">
        <div className="mrow"><span className="mlabel">Your exit gate</span><span className="mval ok">GATE A</span></div>
        <div className="mrow"><span className="mlabel">Lot exit opens</span><span className="mval">FT + 8 min</span></div>
        <div className="mrow"><span className="mlabel">AI suggestion</span><span className="mval warn">Leave 10 min early</span></div>
      </Card>
    </div>
  )
}

// ── FOOD page ────────────────────────────────────────────────
export function FoodPage({ state }) {
  const food = state.food ?? []
  const best = food.length ? food.reduce((a, b) => a.wait < b.wait ? a : b) : null

  return (
    <div className="rpanel">
      <Card title="FOOD STALL QUEUE TRACKER">
        {food.map(f => {
          const p = Math.round(f.wait / f.maxWait * 100)
          const col = loadColor(p)
          return (
            <div className="stall-row" key={f.id} role="listitem" aria-label={`${f.name}: ${f.wait} minute wait`}>
              <span style={{ fontSize: 14 }}>{f.icon}</span>
              <div className="stall-name">{f.id} — {f.name} · {f.location}</div>
              <div className="stall-bar">
                <div className="stall-fill" style={{ width: `${p}%`, background: col }} />
              </div>
              <div className={`stall-queue ${loadClass(p)}`} aria-label={`${f.wait} minutes`}>{f.wait}m</div>
            </div>
          )
        })}
      </Card>

      {best && (
        <Card title="AI RECOMMENDATION">
          <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, fontFamily: "'Share Tech Mono'" }}>
            ⬡ Nearest low-queue: <strong style={{ color: 'var(--accent2)' }}>{best.id} — {best.name}</strong> ({best.wait} min wait, ~120m from your seat via concourse).<br /><br />
            ⚠ Stalls with 12+ min wait: avoid next 20 min. AI predicts queue relief when second-half crowd settles.
          </p>
        </Card>
      )}
    </div>
  )
}

// ── CV MONITOR page ──────────────────────────────────────────
export function CVPage({ state }) {
  const tunnelFeeds = state.cv?.filter(c => c.type === 'tunnel') ?? []
  const seatFeeds = state.cv?.filter(c => c.type === 'seats') ?? []
  const flowData = [
    { zone: 'Gate A Tunnel', flow: 420 },
    { zone: 'Gate B Tunnel', flow: 680 },
    { zone: 'Gate C Tunnel', flow: 1240 },
    { zone: 'Gate D Tunnel', flow: 310 },
    { zone: 'Gate E Tunnel', flow: 490 },
  ]

  return (
    <div className="rpanel">
      <Card title="CV TUNNEL CAMERA FEEDS">
        <div className="cv-grid">
          {tunnelFeeds.map(c => {
            const cls = c.count > 300 ? 'danger' : c.count > 200 ? 'warn' : 'ok'
            return (
              <div className="cv-cell" key={c.cam} role="region" aria-label={`${c.cam} ${c.zone}: ${c.count} persons`}>
                <div className="cv-label">{c.cam} · {c.zone}</div>
                <div className={`cv-val ${cls}`}>{c.count}</div>
                <div style={{ fontSize: 9, color: 'var(--text2)' }}>persons detected</div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="SEAT OCCUPANCY BY BLOCK">
        {seatFeeds.map(c => {
          const cls = loadClass(c.fill)
          return (
            <div key={c.cam}>
              <div className="mrow">
                <span className="mlabel">{c.zone}</span>
                <span className={`mval ${cls}`}>{c.fill}%</span>
              </div>
              <LoadBar value={c.fill} />
            </div>
          )
        })}
      </Card>

      <Card title="CROWD FLOW VELOCITY">
        {flowData.map(f => {
          const cls = f.flow > 1000 ? 'danger' : f.flow > 600 ? 'warn' : 'ok'
          return (
            <div className="mrow" key={f.zone}>
              <span className="mlabel">{f.zone}</span>
              <span className={`mval ${cls}`}>{f.flow} p/min</span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

// ── STAFF page ───────────────────────────────────────────────
export function StaffPage({ state }) {
  const densityZones = [
    { zone: 'North Stand', density: pct(state.zones?.[0]?.occ ?? 24800, state.zones?.[0]?.cap ?? 28400) },
    { zone: 'South Stand', density: pct(state.zones?.[1]?.occ ?? 7100, state.zones?.[1]?.cap ?? 8200) },
    { zone: 'East Stand', density: pct(state.zones?.[2]?.occ ?? 3200, state.zones?.[2]?.cap ?? 4300) },
    { zone: 'West Stand', density: pct(state.zones?.[3]?.occ ?? 3118, state.zones?.[3]?.cap ?? 4300) },
    { zone: 'Concourse N', density: 62 },
    { zone: 'Concourse S', density: 81 },
  ]

  return (
    <div className="rpanel">
      <Card title="INCIDENT ALERTS">
        {(state.alerts ?? []).map((a, i) => (
          <div className="mrow" key={i} role="alert" aria-label={`${a.level}: ${a.msg}`}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: a.level === 'danger' ? 'var(--danger)' : a.level === 'warn' ? 'var(--warn)' : 'var(--accent2)',
                flexShrink: 0,
                animation: a.level !== 'ok' ? 'blink 1.2s infinite' : 'none',
              }} />
              <span className="mlabel">{a.msg}</span>
            </span>
            <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 10, color: 'var(--text2)' }}>{a.time}</span>
          </div>
        ))}
      </Card>

      <Card title="CROWD DENSITY HEATMAP">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--accent2)' }}>LOW</span>
          <div style={{ flex: 1, margin: '0 8px', height: 8, borderRadius: 2, background: 'linear-gradient(to right,#00ff9d,#ffb800,#ff4444)' }} aria-hidden="true" />
          <span style={{ fontSize: 10, color: 'var(--danger)' }}>HIGH</span>
        </div>
        {densityZones.map(d => (
          <div key={d.zone}>
            <div className="mrow">
              <span className="mlabel">{d.zone}</span>
              <span className={`mval ${loadClass(d.density)}`}>{d.density}%</span>
            </div>
            <LoadBar value={d.density} />
          </div>
        ))}
      </Card>

      <Card title="STAFF DEPLOYMENTS">
        {[
          ['Gate C — extra stewards', '+4 deployed', 'warn'],
          ['F6 Coffee — extra cashier', '1 dispatched', 'warn'],
          ['Tunnel C — flow marshal', 'URGENT', 'danger'],
          ['P4 Overflow → P3', 'Auto ON', 'ok'],
          ['Disabled Gate F — steward', 'On duty', 'ok'],
        ].map(([label, val, cls]) => (
          <div className="mrow" key={label}>
            <span className="mlabel">{label}</span>
            <span className={`mval ${cls}`}>{val}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}
