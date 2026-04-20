import React, { useState, useEffect, useRef } from 'react'
import { generateExitWaves, simulateScanProgress } from '../services/exitWaveEngine'

// ── Tunnel pressure data per stand/gate ───────────────────────
function getTunnelData(stand, gates) {
  const base = {
    north: [
      { id: 'T-NA', label: 'Tunnel A (North Left)', gate: 'A', pressure: 0 },
      { id: 'T-NF', label: 'Tunnel F (North Right)', gate: 'F', pressure: 0 },
    ],
    south: [
      { id: 'T-SD', label: 'Tunnel D (South Main)', gate: 'D', pressure: 0 },
      { id: 'T-SC', label: 'Tunnel C (South-East)', gate: 'C', pressure: 0 },
    ],
    east: [
      { id: 'T-EB', label: 'Tunnel B (East Upper)', gate: 'B', pressure: 0 },
      { id: 'T-EC', label: 'Tunnel C (East Lower)', gate: 'C', pressure: 0 },
    ],
    west: [
      { id: 'T-WE', label: 'Tunnel E (West Main)', gate: 'E', pressure: 0 },
      { id: 'T-WA', label: 'Tunnel A (West-North)', gate: 'A', pressure: 0 },
    ],
  }
  const tunnels = base[stand] || base.north
  return tunnels.map(t => {
    const g = gates?.find(g => g.id === t.gate)
    const pressure = g ? Math.round(g.load) : Math.floor(50 + Math.random() * 40)
    return { ...t, pressure }
  }).sort((a, b) => a.pressure - b.pressure)  // sorted: clearest first
}

// Gate alternatives for this stand when main is busy
function getGateAlternatives(stand, gates) {
  const gateMap = {
    north: ['A', 'F', 'B'],
    south: ['D', 'C', 'E'],
    east: ['B', 'C', 'A'],
    west: ['E', 'D', 'F'],
  }
  const order = gateMap[stand] || gateMap.north
  return order.map(id => {
    const g = gates?.find(g => g.id === id)
    const load = g ? Math.round(g.load) : Math.floor(40 + Math.random() * 50)
    return { id, load, loc: g?.loc || id }
  }).sort((a, b) => a.load - b.load)
}

// Build the personal exit steps
function buildExitSteps(fanData, bestGate, tunnels) {
  const stand = fanData?.stand || 'north'
  const row = fanData?.row || '?'
  const seat = fanData?.seat || '?'
  const sName = stand.charAt(0).toUpperCase() + stand.slice(1)
  const bestTunnel = tunnels[0]

  return [
    { n: 1, icon: '💺', txt: `Stay seated — Row ${row}, Seat ${seat}`, detail: 'Wait for your wave call before standing. Rows exit one at a time.', status: 'wait' },
    { n: 2, icon: '🚶', txt: `Move to ${sName} Stand concourse exit`, detail: `Follow green exit signs to ${bestTunnel?.label || 'your tunnel'}. Walk on the left side.`, status: 'walk' },
    { n: 3, icon: '🚇', txt: `Enter ${bestTunnel?.label || 'Tunnel'}`, detail: `Pressure: ${bestTunnel?.pressure || 60}% — ${bestTunnel?.pressure < 70 ? 'flowing well, good to go' : 'moderate flow, stay calm and keep moving'}`, status: bestTunnel?.pressure > 85 ? 'warn' : 'ok' },
    { n: 4, icon: '🚪', txt: `Exit via Gate ${bestGate?.id || 'A'}`, detail: `${bestGate?.load || 60}% load · ${bestGate?.load < 70 ? 'clear — head straight through' : 'moderate — steward directing traffic'}`, status: bestGate?.load > 85 ? 'warn' : 'ok' },
    ...(fanData?.parking === 'yes' ? [
      { n: 5, icon: '🅿', txt: `Head to your parking lot`, detail: 'Follow coloured parking signs. Your toll barrier opens as your wave clears.', status: 'ok' },
    ] : [
      { n: 5, icon: '🚉', txt: 'Proceed to transport links', detail: 'Bus stops north and south. Taxi rank at Gate D. Cycle parking at Gate B.', status: 'ok' },
    ]),
  ]
}

function pressureColor(p) {
  if (p >= 85) return '#ef4444'
  if (p >= 65) return '#f59e0b'
  return '#22c55e'
}
function pressureLabel(p) {
  if (p >= 85) return 'Heavy'
  if (p >= 65) return 'Moderate'
  return 'Clear'
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return '255,255,255'
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`
}

const css = {
  card: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '1rem 1.2rem', marginBottom: 12 },
  lbl: { fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 },
}

// ── Notification banner ───────────────────────────────────────
function NotifBanner({ icon, col, title, body, pulse }) {
  const rgb = hexToRgb(col)
  return (
    <div style={{ borderRadius: 16, border: `1px solid rgba(${rgb},0.35)`, background: `rgba(${rgb},0.07)`, padding: '1rem 1.2rem', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {pulse && <div style={{ width: 7, height: 7, borderRadius: '50%', background: col, animation: 'blink 1.2s infinite', flexShrink: 0 }} />}
        <div style={{ fontSize: 11, color: col, fontWeight: 600, letterSpacing: '0.07em' }}>LIVE NOTIFICATION</div>
      </div>
      <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 15, fontWeight: 700, marginBottom: 5 }}>{icon} {title}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7 }}>{body}</div>
    </div>
  )
}

// ── Tunnel pressure meter ─────────────────────────────────────
function TunnelMeter({ tunnel, isRecommended }) {
  const col = pressureColor(tunnel.pressure)
  return (
    <div style={{ borderRadius: 12, border: isRecommended ? `1.5px solid ${col}` : '1px solid rgba(255,255,255,0.08)', background: isRecommended ? `rgba(${hexToRgb(col)},0.07)` : 'rgba(255,255,255,0.03)', padding: '10px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: isRecommended ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
            {tunnel.label}
            {isRecommended && <span style={{ fontSize: 10, color: col, background: `rgba(${hexToRgb(col)},0.15)`, padding: '2px 7px', borderRadius: 8 }}>RECOMMENDED</span>}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>via Gate {tunnel.gate}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Syne,sans-serif', color: col }}>{tunnel.pressure}%</div>
          <div style={{ fontSize: 10, color: col }}>{pressureLabel(tunnel.pressure)}</div>
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${tunnel.pressure}%`, height: '100%', background: col, borderRadius: 4, transition: 'width 1s' }} />
      </div>
    </div>
  )
}

// ── Gate alternatives ─────────────────────────────────────────
function GateRow({ gate, rank }) {
  const col = pressureColor(gate.load)
  const isBest = rank === 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: isBest ? `rgba(${hexToRgb(col)},0.15)` : 'rgba(255,255,255,0.05)', border: `1px solid ${isBest ? col : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: isBest ? col : 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
        {gate.id}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: isBest ? 600 : 400 }}>
          Gate {gate.id} — {gate.loc}
          {isBest && <span style={{ fontSize: 10, marginLeft: 6, color: col, background: `rgba(${hexToRgb(col)},0.12)`, padding: '2px 7px', borderRadius: 8 }}>best exit now</span>}
        </div>
        <div style={{ marginTop: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
          <div style={{ width: `${gate.load}%`, height: '100%', background: col, borderRadius: 3, transition: 'width 1s' }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: col }}>{gate.load}%</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{pressureLabel(gate.load)}</div>
      </div>
    </div>
  )
}

// ── Step card ─────────────────────────────────────────────────
function ExitStep({ step, active }) {
  const statusColor = step.status === 'warn' ? '#f59e0b' : step.status === 'wait' ? '#38bdf8' : '#22c55e'
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: active ? `rgba(${hexToRgb(statusColor)},0.15)` : 'rgba(255,255,255,0.05)', border: `1.5px solid ${active ? statusColor : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 1 }}>
        {step.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#fff' : 'rgba(255,255,255,0.6)' }}>{step.txt}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3, lineHeight: 1.5 }}>{step.detail}</div>
      </div>
      {active && (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0, marginTop: 6, animation: 'blink 1.2s infinite' }} />
      )}
    </div>
  )
}

// ── Accordion for all waves ───────────────────────────────────
function WaveAccordion({ waves, myWaveNum }) {
  const [open, setOpen] = useState(null)
  return (
    <div>
      {waves.map(w => (
        <div key={w.waveNum} style={{ borderRadius: 12, border: w.waveNum === myWaveNum ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', marginBottom: 8, overflow: 'hidden' }}>
          <button onClick={() => setOpen(open === w.waveNum ? null : w.waveNum)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>{w.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: w.waveNum === myWaveNum ? w.color : '#fff' }}>
                  {w.label} {w.waveNum === myWaveNum && <span style={{ fontSize: 10, color: w.color }}>← yours</span>}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{w.sections[0]}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: w.color, fontWeight: 600 }}>+{w.startOffsetMin}m</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', display: 'inline-block', transform: open === w.waveNum ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </div>
          </button>
          {open === w.waveNum && (
            <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginTop: 10 }}>{w.description}</div>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {w.sections.map((s, i) => (
                  <span key={i} style={{ fontSize: 10, color: w.color, background: `rgba(${hexToRgb(w.color)},0.1)`, borderRadius: 6, padding: '3px 8px' }}>{s}</span>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Gate {w.gate === 'nearest' ? 'nearest to you' : w.gate} · {w.side === 'all' ? 'Any exit' : w.side + ' side'} · {w.durationMin} min window</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────
export default function ExitTab({ fanData, state }) {
  const matchMin = state?.matchMin || 67
  const isNearEnd = matchMin >= 80
  const isFullTime = matchMin >= 90

  const { waves, myWaveNum } = generateExitWaves(fanData, state?.parking)
  const myWave = waves.find(w => w.waveNum === myWaveNum)

  // Live tunnel & gate data driven by state.gates
  const tunnels = getTunnelData(fanData?.stand || 'north', state?.gates)
  const gateAlts = getGateAlternatives(fanData?.stand || 'north', state?.gates)
  const bestGate = gateAlts[0]

  // Exit step progress (auto-advances post full-time)
  const [activeStep, setActiveStep] = useState(1)
  const [timeSinceFT, setTimeSinceFT] = useState(0)

  useEffect(() => {
    if (!isFullTime) { setActiveStep(1); setTimeSinceFT(0); return }
    const t = setInterval(() => {
      setTimeSinceFT(s => {
        const next = s + 1
        // Step advances every ~15 real seconds for demo
        if (next > 60) setActiveStep(5)
        else if (next > 45) setActiveStep(4)
        else if (next > 30) setActiveStep(3)
        else if (next > 15) setActiveStep(2)
        return next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [isFullTime])

  const simulatedMin = timeSinceFT / 6
  const activeWave = waves.reduce((found, w) => simulatedMin >= w.startOffsetMin ? w : found, waves[0])
  const scanCount = isFullTime ? simulateScanProgress(activeWave, Math.max(0, (simulatedMin - activeWave.startOffsetMin) * 60)) : 0
  const scanPct = Math.round((scanCount / (activeWave?.fans || 1)) * 100)

  // Build steps with live data
  const exitSteps = buildExitSteps(fanData, bestGate, tunnels)

  const standName = (fanData?.stand || 'north').charAt(0).toUpperCase() + (fanData?.stand || 'north').slice(1)

  // ── Pre-80 min ────────────────────────────────────────────
  if (!isNearEnd) {
    return (
      <div className="fade-in">
        <div style={{ ...css.card, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10, letterSpacing: '0.07em' }}>EXIT PLANNING</div>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            {90 - matchMin} minutes until exit guidance activates
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
            Live exit route, tunnel pressure, and personalised gate recommendations appear at the 80th minute. Enjoy the match.
          </div>
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, borderLeft: `3px solid ${myWave?.color}` }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>YOUR ASSIGNED WAVE</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: myWave?.color }}>{myWave?.icon} {myWave?.label}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              Departs +{myWave?.startOffsetMin} min after full time · Gate {myWave?.gate === 'nearest' ? 'nearest to you' : myWave?.gate}
              {fanData?.parking === 'yes' ? ' · 🅿 Parking priority' : ' · 🚶 No parking'}
            </div>
          </div>
        </div>

        {/* Preview tunnel pressures */}
        <div style={css.lbl}>Live tunnel pressure (pre-exit)</div>
        {tunnels.map((t, i) => <TunnelMeter key={t.id} tunnel={t} isRecommended={i === 0} />)}

        <div style={{ ...css.lbl, marginTop: 12, marginBottom: 8 }}>All exit waves</div>
        <WaveAccordion waves={waves} myWaveNum={myWaveNum} />
      </div>
    )
  }

  // ── 80–89 min — pre-exit warning ─────────────────────────
  if (isNearEnd && !isFullTime) {
    return (
      <div className="fade-in">
        <NotifBanner
          icon="⚠️" col="#f59e0b" pulse
          title={`Final ${90 - matchMin} minutes — start planning your exit`}
          body={`Your wave is ${myWave?.label}. You'll be directed to Gate ${myWave?.gate === 'nearest' ? 'your nearest exit' : myWave?.gate} via ${tunnels[0]?.label}. Tunnel pressure is ${pressureLabel(tunnels[0]?.pressure)} right now — expect it to rise at full time.`}
        />

        {/* Personal exit route preview */}
        <div style={{ ...css.card, border: `1.5px solid ${myWave?.color}`, background: `rgba(${hexToRgb(myWave?.color)},0.06)` }}>
          <div style={{ fontSize: 11, color: myWave?.color, fontWeight: 600, letterSpacing: '0.07em', marginBottom: 8 }}>YOUR EXIT ROUTE</div>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            {myWave?.icon} {myWave?.label} · Gate {myWave?.gate === 'nearest' ? 'nearest to you' : myWave?.gate}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 12 }}>
            {myWave?.description}
          </div>
          {exitSteps.map((s, i) => <ExitStep key={i} step={s} active={false} />)}
        </div>

        {/* Live tunnel pressure */}
        <div style={{ ...css.lbl, marginBottom: 8 }}>Tunnel pressure — live</div>
        {tunnels.map((t, i) => <TunnelMeter key={t.id} tunnel={t} isRecommended={i === 0} />)}

        {/* Gate alternatives */}
        <div style={{ ...css.card }}>
          <div style={{ ...css.lbl, marginBottom: 10 }}>Gate comparison — use the clearest</div>
          {gateAlts.map((g, i) => <GateRow key={g.id} gate={g} rank={i} />)}
        </div>

        <div style={{ ...css.lbl, marginBottom: 8 }}>All waves</div>
        <WaveAccordion waves={waves} myWaveNum={myWaveNum} />
      </div>
    )
  }

  // ── Full time — live exit navigation ──────────────────────
  const myWaveActive = activeWave?.waveNum === myWaveNum
  const myWaveStarted = simulatedMin >= (myWave?.startOffsetMin || 0)
  const notifCol = myWaveActive ? '#22c55e' : myWaveStarted ? '#38bdf8' : '#f59e0b'
  const notifTitle = myWaveActive
    ? `${myWave?.label} — Move now`
    : myWaveStarted
      ? 'Your wave has passed — use any clear gate'
      : `Wait for ${myWave?.label} — departs in ~${(myWave?.startOffsetMin || 0) - Math.round(simulatedMin)} min`
  const notifBody = myWaveActive
    ? `Head to ${tunnels[0]?.label} now — ${tunnels[0]?.pressure}% pressure (${pressureLabel(tunnels[0]?.pressure)}). Exit via Gate ${bestGate?.id} — clearest gate right now at ${bestGate?.load}% load.`
    : myWaveStarted
      ? `You missed your wave window but all gates are still open. Gate ${bestGate?.id} is clearest at ${bestGate?.load}% — proceed via ${tunnels[0]?.label}.`
      : `Current active wave: ${activeWave?.label}. Stay seated or wait near your concourse exit. Gate ${bestGate?.id} is clearest at ${bestGate?.load}%.`

  return (
    <div className="fade-in">
      {/* Live notification */}
      <NotifBanner icon={myWaveActive ? '📢' : myWaveStarted ? '✅' : '⏳'} col={notifCol} pulse={myWaveActive} title={notifTitle} body={notifBody} />

      {/* Step-by-step personal route */}
      <div style={{ ...css.card, border: `1.5px solid ${notifCol}`, background: `rgba(${hexToRgb(notifCol)},0.05)` }}>
        <div style={{ fontSize: 11, color: notifCol, fontWeight: 600, letterSpacing: '0.07em', marginBottom: 10 }}>YOUR PERSONAL EXIT ROUTE</div>
        {exitSteps.map((s, i) => (
          <ExitStep key={i} step={s} active={activeStep === s.n} />
        ))}
      </div>

      {/* Live tunnel pressure */}
      <div style={{ ...css.lbl, marginBottom: 8 }}>Tunnel pressure — live</div>
      {tunnels.map((t, i) => <TunnelMeter key={t.id} tunnel={t} isRecommended={i === 0} />)}

      {/* Gate alternatives with live load */}
      <div style={css.card}>
        <div style={{ ...css.lbl, marginBottom: 10 }}>Gate comparison — use the clearest</div>
        {gateAlts.map((g, i) => <GateRow key={g.id} gate={g} rank={i} />)}
      </div>

      {/* Stadium-wide active wave */}
      {activeWave && (
        <div style={{ ...css.card, background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, letterSpacing: '0.07em' }}>STADIUM-WIDE NOW</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>{activeWave.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: activeWave.color }}>{activeWave.label} in progress</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{activeWave.sections[0]}</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: activeWave.color, fontWeight: 600 }}>{scanPct}%</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>scanned out</div>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
            <div style={{ width: `${scanPct}%`, height: '100%', background: activeWave.color, borderRadius: 4, transition: 'width 0.8s' }} />
          </div>
        </div>
      )}

      {fanData?.parking === 'yes' && (
        <div style={{ ...css.card, border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
          <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 5 }}>🅿 Parking exit</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
            Your toll barrier opens as your wave clears. Follow coloured parking signs after Gate {bestGate?.id}. Deeper lots exit first to keep roads clear.
          </div>
        </div>
      )}

      <div style={{ ...css.lbl, marginBottom: 8, marginTop: 4 }}>All exit waves</div>
      <WaveAccordion waves={waves} myWaveNum={myWaveNum} />

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '10px 0', lineHeight: 1.7 }}>
        Instructions broadcast on all stadium screens · PA system · pushed to your phone
      </div>
    </div>
  )
}