/**
 * App.jsx — Stadium Nexus main application
 */

import React from 'react'
import { useState, useEffect } from 'react'
import StadiumMap from "./StadiumMap";
import AIAssistant from "./AIAssistant";
import { MapPage, RoutePage, MatchPage, ParkingPage, FoodPage, CVPage, StaffPage } from "./Pages";
import { useStadiumData } from '../hooks/useStadiumData'
import { STADIUM_CONFIG } from '../data/mockData'

const TABS = [
  { id: 'map', label: 'MAP' },
  { id: 'route', label: 'MY ROUTE' },
  { id: 'match', label: 'MATCH' },
  { id: 'parking', label: 'PARKING' },
  { id: 'food', label: 'FOOD STALLS' },
  { id: 'cv', label: 'CV MONITOR' },
  { id: 'staff', label: 'STAFF' },
]

const TICKER_BASE = [
  'GATE A: 842 fans/hr',
  'GATE B: 1,204 fans/hr',
  'GATE C: HIGH LOAD — queues building',
  'GATE D: 756 fans/hr',
  'GATE E: 934 fans/hr',
  'GATE F: DISABLED ACCESS CLEAR',
  'F1 Burgers: 12 min wait',
  'F6 Coffee: 14 min — HIGH QUEUE',
  'P4 WEST PARKING NEAR FULL',
  'AI ROUTING ACTIVE',
  'CV FEEDS NOMINAL',
  '34,218 WRISTBANDS ACTIVE',
]

function useClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-GB', { hour12: false }))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function App() {
  const [activeTab, setActiveTab] = useState('map')
  const [showRoute, setShowRoute] = useState(false)
  const [zoneInfo, setZoneInfo] = useState(null)
  const { state, crowdInsight, provider } = useStadiumData()
  const clock = useClock()

  const busyGate = state.gates?.filter(g => !g.disabled).reduce((a, b) => a.load > b.load ? a : b)
  const highLoad = busyGate?.load > 85

  function handleZoneClick(zoneId) {
    const zone = state.zones?.find(z => z.id === zoneId)
    if (!zone) return
    const info = {
      north: `🔵 HOME ZONE — City FC fans. ${zone.occ?.toLocaleString()} / ${zone.cap?.toLocaleString()} seated. Chanting active, low movement. Tunnel NB clear.`,
      south: `🔴 AWAY ZONE — United fans. ${zone.occ?.toLocaleString()} / ${zone.cap?.toLocaleString()} seated. Security perimeter active. Buffer zone Row J enforced.`,
      east: `⚪ NEUTRAL EAST — ${zone.occ?.toLocaleString()} / ${zone.cap?.toLocaleString()} seated. Relaxed crowd. Good visibility, mild queuing at East concourse.`,
      west: `⚪ NEUTRAL WEST — ${zone.occ?.toLocaleString()} / ${zone.cap?.toLocaleString()} seated. Best mix of atmosphere. ★ Best viewing angle per reviews.`,
    }
    setZoneInfo({ name: zone.name, text: info[zoneId] })
    if (activeTab !== 'map') setActiveTab('map')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Barlow', sans-serif", fontSize: 13 }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: 2 }}>
            ⬡ STADIUM NEXUS
          </div>
          <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 10, color: 'var(--text2)', marginTop: 1 }}>
            {STADIUM_CONFIG.name} · MATCH DAY ACTIVE · {provider}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} role="status" aria-label="Stadium status indicators">
          <StatusPill color="accent2" blink>CV FEEDS: {state.cv?.length ?? 0} ACTIVE</StatusPill>
          <StatusPill color="accent2" blink>BANDS: {(state.wristbands?.total ?? 0).toLocaleString()}</StatusPill>
          {highLoad && <StatusPill color="warn" blink>GATE {busyGate?.id}: HIGH LOAD</StatusPill>}
          <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 12, color: 'var(--accent)' }} aria-label={`Current time: ${clock}`}>{clock}</span>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ display: 'flex', gap: 2, padding: '6px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', flexShrink: 0 }} role="tablist" aria-label="Stadium sections">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: map (always visible) */}
        <div style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
          <div style={{ flex: 1, position: 'relative', background: 'var(--bg)', overflow: 'hidden' }}>
            <StadiumMap state={state} onZoneClick={handleZoneClick} showRoute={showRoute} />
          </div>
          {/* Map legend */}
          <div style={{ padding: '6px 10px', background: 'var(--bg2)', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', flexShrink: 0 }} aria-label="Map legend">
            {[
              ['var(--accent)', '■', 'Gate'],
              ['var(--warn)', '●', 'Food'],
              ['var(--accent2)', '♿', 'Disabled'],
              ['#4a90d9', '■', 'Home fans'],
              ['#d94a4a', '■', 'Away fans'],
              ['var(--warn)', '★', 'Best view'],
            ].map(([c, sym, label]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text2)' }}>
                <span style={{ color: c }}>{sym}</span>{label}
              </span>
            ))}
          </div>
          {/* Zone info popup */}
          {zoneInfo && (
            <div style={{ padding: '8px 10px', background: 'var(--panel)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 3 }}>{zoneInfo.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{zoneInfo.text}</div>
              <button onClick={() => setZoneInfo(null)} style={{ marginTop: 4, fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>dismiss</button>
            </div>
          )}
        </div>

        {/* Right: tab content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {TABS.map(t => (
            <div
              key={t.id}
              id={`panel-${t.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${t.id}`}
              style={{ display: activeTab === t.id ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}
            >
              {t.id === 'map' && <MapPage state={state} crowdInsight={crowdInsight} />}
              {t.id === 'route' && <RoutePage state={state} />}
              {t.id === 'match' && <MatchPage state={state} />}
              {t.id === 'parking' && <ParkingPage state={state} />}
              {t.id === 'food' && <FoodPage state={state} />}
              {t.id === 'cv' && <CVPage state={state} />}
              {t.id === 'staff' && <StaffPage state={state} />}
            </div>
          ))}

          {/* AI Assistant */}
          <AIAssistant state={state} />
        </div>
      </div>

      {/* Ticker */}
      <div style={{ background: 'var(--bg3)', borderTop: '1px solid var(--border)', padding: '4px 12px', fontFamily: "'Share Tech Mono'", fontSize: 10, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', flexShrink: 0 }} aria-hidden="true">
        <span style={{ display: 'inline-block', animation: 'scroll-left 40s linear infinite' }}>
          {[...TICKER_BASE, ...TICKER_BASE].map((item, i) => (
            <span key={i}> ⬡ {item} &nbsp;&nbsp;</span>
          ))}
        </span>
      </div>
    </div>
  )
}

function StatusPill({ children, color = 'accent2', blink = false }) {
  const colorMap = { accent2: 'var(--accent2)', warn: 'var(--warn)', danger: 'var(--danger)', accent: 'var(--accent)' }
  const c = colorMap[color] ?? colorMap.accent2
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Share Tech Mono'", fontSize: 10, padding: '3px 8px', borderRadius: 3, border: `1px solid ${c}`, color: c }} role="status">
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, animation: blink ? 'blink 1.2s infinite' : 'none' }} />
      {children}
    </div>
  )
}
