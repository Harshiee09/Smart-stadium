import React, { useState, useRef, useEffect } from 'react'
import { useStadiumData } from '../hooks/useStadiumData'
import { queryStadiumAI } from '../services/geminiService'
import ExitTab from './ExitTab'

const STAND_DATA = {
  north: { gate: 'A', gateLoc: 'North', baseLoad: 62, tunnelCount: 92, concourse: 'NB-12', parkLot: 'P1 North', walkMin: 4 },
  south: { gate: 'D', gateLoc: 'South', baseLoad: 51, tunnelCount: 67, concourse: 'SB-8', parkLot: 'P3 South', walkMin: 4 },
  east: { gate: 'B', gateLoc: 'North-East', baseLoad: 78, tunnelCount: 184, concourse: 'EB-5', parkLot: 'P2 East', walkMin: 5 },
  west: { gate: 'E', gateLoc: 'South-West', baseLoad: 58, tunnelCount: 92, concourse: 'WB-3', parkLot: 'P4 West', walkMin: 4 },
}

const ALL_GATES = [
  { id: 'A', loc: 'North', extraWalk: { north: 0, east: 3, west: 3, south: 6 } },
  { id: 'B', loc: 'North-East', extraWalk: { north: 2, east: 0, west: 5, south: 4 } },
  { id: 'C', loc: 'South-East', extraWalk: { north: 7, east: 2, west: 5, south: 1 } },
  { id: 'D', loc: 'South', extraWalk: { north: 6, east: 4, west: 4, south: 0 } },
  { id: 'E', loc: 'South-West', extraWalk: { north: 5, east: 4, west: 0, south: 2 } },
]

const NEARBY_STALLS = {
  north: ['F1', 'F2'], south: ['F7', 'F8'], east: ['F3', 'F4'], west: ['F5', 'F6'],
}

const STANDS = [
  { value: 'north', label: 'North Stand — Home (City FC)' },
  { value: 'south', label: 'South Stand — Away (United)' },
  { value: 'east', label: 'East Stand — Neutral' },
  { value: 'west', label: 'West Stand — Neutral' },
]

const PARKING_OPTS = [
  { value: 'no', label: 'No parking' },
  { value: 'yes', label: 'Yes — parking included' },
]

const QUICK_QS = ['food reviews', 'view from my seat', 'best fan atmosphere', 'snack recommendation', 'beer queue', 'best photo spots']

const RANDOM_NAMES = ['Harshvardhan', 'Priya Sharma', 'Rahul Mehta', 'Aisha Khan', 'Dev Patel', 'Sonia Gupta', 'Arjun Nair', 'Meera Iyer', 'Rohan Das', 'Kavya Reddy', 'James Chen', 'Sofia Russo', 'Luca Bianchi', 'Emma Torres', 'Noah Williams']
const STAND_KEYS = ['north', 'south', 'east', 'west']
function randomTicket() {
  const stand = STAND_KEYS[Math.floor(Math.random() * STAND_KEYS.length)]
  const row = String(Math.floor(Math.random() * 28) + 1)
  const seat = String(Math.floor(Math.random() * 40) + 1)
  const name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
  const parking = Math.random() > 0.5 ? 'yes' : 'no'
  const ticketId = 'TKT-2026-' + Math.floor(10000 + Math.random() * 89999)
  return { name, ticketId, stand, row, seat, parking }
}

function getBestRoute(stand, liveGates) {
  const base = STAND_DATA[stand] || STAND_DATA.north
  const options = ALL_GATES.map(g => {
    const live = liveGates?.find(lg => lg.id === g.id)
    const load = live ? Math.round(live.load) : 60
    const extra = g.extraWalk[stand] ?? 5
    const eta = Math.round((load / 100) * 8) + base.walkMin + extra
    return { ...g, load, extra, eta }
  }).sort((a, b) => a.eta - b.eta)
  const best = options[0]
  const assigned = options.find(g => g.id === base.gate) || options[0]
  return { best, assigned, options, isDifferent: best.id !== base.gate }
}

const css = {
  page: { maxWidth: 460, margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Inter,sans-serif', color: '#fff', background: '#0a1628', minHeight: '100vh' },
  card: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '1rem 1.2rem', marginBottom: 12 },
  cardHi: { background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.30)', borderRadius: 16, padding: '1rem 1.2rem', marginBottom: 12 },
  lbl: { fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 },
  val: { fontSize: 20, fontWeight: 600, fontFamily: 'Syne,sans-serif' },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3 },
  input: { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 14, color: '#fff', outline: 'none', marginTop: 6, boxSizing: 'border-box' },
  btn: { width: '100%', padding: 13, background: '#fff', color: '#0a1628', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 12, fontFamily: 'Syne,sans-serif' },
  btnBlue: { width: '100%', padding: 13, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
  tab: { flexShrink: 0, padding: '8px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)', background: 'transparent', fontFamily: 'Inter,sans-serif' },
  tabOn: { background: '#fff', color: '#0a1628', borderColor: '#fff', fontWeight: 600 },
  step: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  stepN: { width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 },
  metric: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1rem', textAlign: 'center' },
  mnum: { fontSize: 26, fontWeight: 700, fontFamily: 'Syne,sans-serif' },
  mlbl: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3, letterSpacing: '0.05em' },
  badge: { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' },
  dot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 5 },
  ilbl: { fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginTop: 14, marginBottom: 2 },
}

// Fixed custom dropdown — no white background flash
function CustomSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function outside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...css.input, marginTop: 0, textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: selected ? '#fff' : 'rgba(255,255,255,0.32)',
          background: open ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.07)',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 14 }}>{selected ? selected.label : placeholder}</span>
        <span style={{ fontSize: 9, opacity: 0.45, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: '#0d1e3d', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        }}>
          {options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '12px 14px', fontSize: 13, cursor: 'pointer', border: 'none',
                background: value === o.value ? 'rgba(34,197,94,0.10)' : 'transparent',
                color: value === o.value ? '#4ade80' : 'rgba(255,255,255,0.88)',
                borderBottom: i < options.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
              onMouseEnter={e => { if (value !== o.value) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (value !== o.value) e.currentTarget.style.background = 'transparent' }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState('home')  // skip entry — go straight to home
  const [fanData, setFanData] = useState(() => randomTicket())  // auto-random on load
  const [form, setForm] = useState(() => randomTicket())
  const [tab, setTab] = useState('route')
  const [aiAns, setAiAns] = useState('')
  const [aiQ, setAiQ] = useState('')
  const [aiLoad, setAiLoad] = useState(false)
  const [tabLockedByUser, setTabLockedByUser] = useState(false)
  const { state } = useStadiumData()

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function enter() {
    if (!form.stand) { alert('Please select your stand.'); return }
    const ticket = { ...form }
    setFanData(ticket)
    setAiAns('')
    setTabLockedByUser(false)
    setTab('route')
    setScreen('home')
  }

  function handleTabClick(id) {
    setTab(id)
    setTabLockedByUser(true)  // user manually picked — don't auto-switch away
  }

  function goToEntry() {
    const fresh = randomTicket()   // new random ticket each time
    setForm(fresh)
    setTabLockedByUser(false)
    setScreen('entry')
  }

  const stand = fanData.stand || 'north'
  const sd = STAND_DATA[stand]
  const food = state.food || []
  const bestFood = food.length ? food.reduce((a, b) => a.wait < b.wait ? a : b) : null
  const matchMin = state.matchMin || 67
  const nearby = NEARBY_STALLS[stand] || []
  const { best, assigned, options, isDifferent } = getBestRoute(stand, state.gates)

  // ── Auto-switch tab based on match minute (only if user hasn't manually picked) ──
  useEffect(() => {
    if (screen !== 'home' || tabLockedByUser) return
    if (matchMin >= 90) {
      setTab('exit')       // full time → show exit first
    } else if (matchMin >= 80) {
      setTab('exit')       // final 10 min → nudge to exit tab
    } else {
      setTab('route')      // rest of match → stay on route
    }
  }, [matchMin, screen, tabLockedByUser])

  const alertList = [
    { ok: true, msg: `Gate ${best.id} — fastest route to your seat (${best.eta} min)` },
    { ok: best.load <= 80, msg: `Gate ${best.id} at ${best.load}% load — ${best.load <= 80 ? 'flowing well' : 'getting busy'}` },
    ...(['north', 'east'].includes(stand) ? [{ ok: false, msg: 'Gate C area is congested — not on your route' }] : []),
    { ok: true, msg: `${bestFood ? bestFood.name : 'Snacks'} has the shortest queue right now` },
  ]

  async function ask(q) {
    const query = (q || aiQ).trim(); if (!query) return
    setAiQ(''); setAiLoad(true); setAiAns('...')
    try { setAiAns(await queryStadiumAI(query, state, fanData)) }
    catch { setAiAns('Something went wrong. Try again!') }
    finally { setAiLoad(false) }
  }

  // ── Entry screen ──────────────────────────────────────────
  if (screen === 'entry') return (
    <div style={css.page}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
          Stadium<span style={{ color: 'rgba(255,255,255,0.35)' }}>Nexus</span>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Your personal match day companion</div>
      </div>

      <div style={{ ...css.card, padding: '1.4rem' }}>
        <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Enter your ticket details</div>

        {[
          ['Your name', 'name', 'e.g. Harshvardhan'],
          ['Booking ID', 'ticketId', 'e.g. TKT-2026-84291'],
          ['Row', 'row', 'e.g. 14'],
          ['Seat', 'seat', 'e.g. 22'],
        ].map(([l, k, p]) => (
          <div key={k}>
            <label style={css.ilbl}>{l}</label>
            <input style={css.input} placeholder={p} value={form[k]}
              onChange={e => set(k, e.target.value)}
              onKeyDown={e => e.key === 'Enter' && k === 'seat' && enter()} />
          </div>
        ))}

        <label style={css.ilbl}>Stand</label>
        <CustomSelect value={form.stand} onChange={v => set('stand', v)}
          placeholder="Select your stand" options={STANDS} />

        <label style={css.ilbl}>Parking included?</label>
        <CustomSelect value={form.parking} onChange={v => set('parking', v)}
          placeholder="Select..." options={PARKING_OPTS} />
      </div>

      <button style={css.btn} onClick={enter}>Get my match day guide →</button>

      <div style={{ marginTop: '1rem', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.07)', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', lineHeight: 1.7 }}>
          Google Maps live navigation · turn-by-turn from your location · coming soon
        </div>
      </div>
    </div>
  )

  // ── Home ──────────────────────────────────────────────────
  const TABS = [
    { id: 'route', label: 'My route' },
    { id: 'food', label: 'Food' },
    ...(fanData.parking === 'yes' ? [{ id: 'parking', label: 'Parking' }] : []),
    { id: 'alerts', label: 'Alerts' },
    { id: 'exit', label: '🚪 Exit' },
    { id: 'ask', label: 'Ask AI' },
  ]

  return (
    <div style={css.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
        <div>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
            Hey {fanData.name?.split(' ')[0] || 'Fan'} 👋
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
            {stand.charAt(0).toUpperCase() + stand.slice(1)} Stand · Row {fanData.row || '—'} · Seat {fanData.seat || '—'}
          </div>
        </div>
        <span style={{
          ...css.badge,
          background: matchMin < 90 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
          color: matchMin < 90 ? '#4ade80' : 'rgba(255,255,255,0.5)',
          border: matchMin < 90 ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)',
        }}>
          {matchMin < 90 ? `⚡ Live · ${matchMin}'` : '• Full time'}
        </span>
      </div>

      {/* Score */}
      <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 20, padding: '1.2rem 1.4rem', marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.08em' }}>HOME</div>
            <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 17, fontWeight: 700 }}>City FC</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 1rem' }}>
            <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 36, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>
              {state.score?.[0] ?? 2}<span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 6px' }}>–</span>{state.score?.[1] ?? 1}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{matchMin}' · Nexus Arena</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.08em' }}>AWAY</div>
            <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 17, fontWeight: 700 }}>United</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.2rem', overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => handleTabClick(t.id)}
            style={{ ...css.tab, ...(tab === t.id ? css.tabOn : {}) }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ROUTE */}
      {tab === 'route' && (
        <div className="fade-in">
          {isDifferent ? (
            <div style={css.cardHi}>
              <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, marginBottom: 6 }}>AI found a faster route</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                Gate {assigned.id} (assigned) at <b style={{ color: '#fbbf24' }}>{assigned.load}%</b> — {assigned.eta} min.<br />
                Gate {best.id} ({best.loc}) at <b style={{ color: '#4ade80' }}>{best.load}%</b> — saves ~{assigned.eta - best.eta} min.
              </div>
            </div>
          ) : (
            <div style={css.cardHi}>
              <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, marginBottom: 4 }}>Your assigned gate is the fastest</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Gate {best.id} has the lowest wait for your stand.</div>
            </div>
          )}

          <div style={css.grid2}>
            <div style={css.metric}>
              <div style={{ ...css.mnum, color: best.load > 85 ? '#ef4444' : best.load > 70 ? '#fbbf24' : '#4ade80' }}>{best.load}%</div>
              <div style={css.mlbl}>Gate {best.id} load</div>
            </div>
            <div style={css.metric}>
              <div style={{ ...css.mnum, color: '#4ade80' }}>{best.eta} min</div>
              <div style={css.mlbl}>Est. arrival</div>
            </div>
          </div>

          <div style={css.card}>
            <div style={{ ...css.lbl, marginBottom: 10 }}>Steps to your seat</div>
            {[
              [`Enter Gate ${best.id} — ${best.load}% load`, '0:00'],
              ['Follow signs to Level 2 escalator', '+45s'],
              [`Head to ${stand.charAt(0).toUpperCase() + stand.slice(1)} Stand concourse`, '+1:30'],
              ['Through your tunnel — clear flow confirmed', '+2:30'],
              [`Row ${fanData.row || '?'}, Seat ${fanData.seat || '?'}`, `+${best.eta} min`],
            ].map(([txt, time], i) => (
              <div key={i} style={{ ...css.step, ...(i === 4 ? { borderBottom: 'none' } : {}) }}>
                <div style={css.stepN}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>{txt}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{time}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={css.card}>
            <div style={{ ...css.lbl, marginBottom: 10 }}>All gates — live comparison</div>
            {options.map((g, i) => {
              const isBest = g.id === best.id
              const isAssigned = g.id === sd.gate
              const col = g.load > 85 ? '#ef4444' : g.load > 70 ? '#fbbf24' : '#4ade80'
              return (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < options.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: isBest ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', border: isBest ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: isBest ? '#4ade80' : 'rgba(255,255,255,0.6)', flexShrink: 0 }}>{g.id}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isBest ? 600 : 400 }}>
                      {g.loc}
                      {isBest && <span style={{ fontSize: 10, color: '#4ade80', marginLeft: 6, background: 'rgba(34,197,94,0.1)', padding: '1px 6px', borderRadius: 10 }}>fastest</span>}
                      {isAssigned && !isBest && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>assigned</span>}
                    </div>
                    <div style={{ marginTop: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${g.load}%`, height: '100%', background: col, borderRadius: 3, transition: 'width .7s' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: col }}>{g.load}%</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{g.eta}m total</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ ...css.card, background: 'rgba(255,255,255,0.03)' }}>
            <div style={css.lbl}>Accessible entry</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Gate F (NW) — priority lanes open · lifts on all levels · steward stationed</div>
          </div>
        </div>
      )}

      {/* FOOD */}
      {tab === 'food' && (
        <div className="fade-in">
          {bestFood && (
            <div style={css.cardHi}>
              <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginBottom: 4, letterSpacing: '0.06em' }}>SHORTEST QUEUE NOW</div>
              <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 600 }}>{bestFood.icon} {bestFood.name}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{bestFood.wait} min wait · {bestFood.location}</div>
            </div>
          )}
          <div style={css.card}>
            <div style={{ ...css.lbl, marginBottom: 12 }}>All stalls — live queues</div>
            {food.map((f, i) => {
              const pct = Math.round(f.wait / 20 * 100)
              const col = f.wait >= 12 ? '#ef4444' : f.wait >= 7 ? '#fbbf24' : '#4ade80'
              const isNear = nearby.includes(f.id)
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < food.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{f.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isNear ? 600 : 400 }}>
                      {f.name}
                      {isNear && <span style={{ fontSize: 10, color: '#4ade80', marginLeft: 6, background: 'rgba(34,197,94,0.1)', padding: '1px 6px', borderRadius: 10 }}>near you</span>}
                    </div>
                    <div style={{ marginTop: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 3, transition: 'width .7s' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: col, whiteSpace: 'nowrap', minWidth: 40, textAlign: 'right' }}>{f.wait}m</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* PARKING */}
      {tab === 'parking' && (
        <div className="fade-in">
          <div style={css.grid2}>
            <div style={css.metric}>
              <div style={{ ...css.mnum, color: '#4ade80' }}>{state.parking?.find(p => p.lot === 'P1')?.free ?? 142}</div>
              <div style={css.mlbl}>P1 North free</div>
            </div>
            <div style={css.metric}>
              <div style={{ ...css.mnum, color: (state.parking?.find(p => p.lot === 'P4')?.free ?? 4) <= 10 ? '#ef4444' : '#fbbf24' }}>
                {state.parking?.find(p => p.lot === 'P4')?.free ?? 4}
              </div>
              <div style={css.mlbl}>P4 West free</div>
            </div>
          </div>
          <div style={css.card}>
            <div style={css.lbl}>Your lot</div>
            <div style={css.val}>{sd?.parkLot}</div>
            <div style={css.sub}>Exit via Gate {best.id} · opens at full time</div>
          </div>
          <div style={css.card}>
            <div style={{ ...css.lbl, marginBottom: 10 }}>All lots — availability</div>
            {(state.parking || [{ lot: 'P1', free: 142, total: 400 }, { lot: 'P2', free: 23, total: 320 }, { lot: 'P3', free: 88, total: 380 }, { lot: 'P4', free: 4, total: 350 }]).map((p, i, arr) => {
              const pct = Math.round((1 - p.free / p.total) * 100)
              const col = p.free <= 10 ? '#ef4444' : p.free <= 40 ? '#fbbf24' : '#4ade80'
              return (
                <div key={p.lot} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, width: 28 }}>{p.lot}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 3, transition: 'width .7s' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: col, minWidth: 50, textAlign: 'right' }}>{p.free} free</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ALERTS */}
      {tab === 'alerts' && (
        <div className="fade-in">
          <div style={css.card}>
            <div style={{ ...css.lbl, marginBottom: 12 }}>Your alerts</div>
            {alertList.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: i < alertList.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ ...css.dot, background: a.ok ? '#4ade80' : '#ef4444', animation: !a.ok ? 'blink 1.4s infinite' : 'none' }} />
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{a.msg}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXIT */}
      {tab === 'exit' && (
        <ExitTab fanData={fanData} state={state} />
      )}

      {/* ASK AI */}
      {tab === 'ask' && (
        <AskAITab
          state={state}
          fanData={fanData}
          aiQ={aiQ} setAiQ={setAiQ}
          aiAns={aiAns} setAiAns={setAiAns}
          aiLoad={aiLoad}
          ask={ask}
        />
      )}

      <button style={{ ...css.btnBlue, marginTop: '1.5rem' }} onClick={goToEntry}>
        ← Change ticket details
      </button>
    </div>
  )
}

// ── Ask AI tab — one answer at a time with "show another" ─────
function AskAITab({ state, fanData, aiQ, setAiQ, aiAns, setAiAns, aiLoad, ask }) {
  const [answers, setAnswers] = useState([])
  const [loadingMore, setLoadingMore] = useState(false)

  // When a fresh answer arrives, reset to showing just that one
  React.useEffect(() => {
    if (aiAns && aiAns !== '...') {
      setAnswers([aiAns])
    }
  }, [aiAns])

  async function askAnother() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const followUp = answers.length === 1
        ? `Give me a different, second-best alternative for my last question. Don't repeat what you just said.`
        : `Give me a third option — a different approach from the previous two answers. Keep it brief.`
      const ans = await queryStadiumAI(followUp, state, fanData)
      setAnswers(prev => [...prev, ans])
    } catch {
      setAnswers(prev => [...prev, 'No more alternatives right now — try asking differently!'])
    }
    setLoadingMore(false)
  }

  function freshAsk(q) {
    setAnswers([])
    ask(q)
  }

  return (
    <div className="fade-in">
      <div style={css.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✦</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Gemini AI Assistant</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Powered by Google Gemini 1.5 Flash</div>
          </div>
        </div>

        <input style={css.input} value={aiQ}
          onChange={e => { setAiQ(e.target.value); setAnswers([]) }}
          onKeyDown={e => e.key === 'Enter' && !aiLoad && freshAsk()}
          placeholder="Ask about food, travel time, view, atmosphere..."
          disabled={aiLoad} />
        <button style={{ ...css.btn, opacity: aiLoad ? .7 : 1 }} onClick={() => freshAsk()} disabled={aiLoad}>
          {aiLoad ? 'Thinking...' : 'Ask'}
        </button>

        {/* Answers — one revealed at a time */}
        {answers.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
            {answers.map((ans, i) => (
              <div key={i}>
                {i > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 12px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.07em' }}>
                      {i === 1 ? 'ALTERNATIVE' : 'ANOTHER OPTION'}
                    </div>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                  </div>
                )}
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                  {ans}
                </div>
              </div>
            ))}

            {/* Show another — up to 3 total */}
            {answers.length < 3 && (
              <button
                onClick={askAnother}
                disabled={loadingMore}
                style={{
                  marginTop: 14, width: '100%', padding: '11px 14px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 10, fontSize: 13, color: 'rgba(255,255,255,0.5)',
                  cursor: loadingMore ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif',
                  opacity: loadingMore ? 0.6 : 1,
                }}>
                {loadingMore ? 'Finding another option...' : `↓ Show ${answers.length === 1 ? 'another option' : 'one more'}`}
              </button>
            )}
            {answers.length >= 3 && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.28)', textAlign: 'center' }}>
                All top options shown · ask something else to explore more
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ ...css.lbl, marginBottom: 8 }}>Suggested questions</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {QUICK_QS.map(q => (
          <button key={q}
            onClick={() => freshAsk(q)}
            disabled={aiLoad}
            style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer' }}>
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}