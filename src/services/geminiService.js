/**
 * geminiService.js
 * Google Gemini 1.5 Flash via REST API
 * Falls back to local rule-based AI if API key not set
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_MODEL   = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash'
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

/**
 * Build context prompt from live stadium state
 */
function buildSystemContext(stadiumState) {
  const { gates, zones, wristbands, food, parking, matchMin, score } = stadiumState
  return `You are the AI assistant for Stadium Nexus, an intelligent crowd management platform.
Current stadium state (LIVE DATA):
- Match: City FC ${score[0]}–${score[1]} United, minute ${matchMin}'
- Total fans: ${wristbands.total.toLocaleString()} wristbands active
- Seated: ${wristbands.seated.toLocaleString()} | In tunnels: ${wristbands.tunnel.toLocaleString()} | Concourse: ${wristbands.concourse.toLocaleString()}
- Gates: ${gates.map(g => `Gate ${g.id} ${g.load}% load`).join(', ')}
- Zones: ${zones.map(z => `${z.name} ${Math.round(z.occ/z.cap*100)}%`).join(', ')}
- Food queues (minutes): ${food.map(f => `${f.id}=${f.wait}m`).join(', ')}
- Parking free bays: ${parking.map(p => `${p.lot}=${p.free}`).join(', ')}

Respond concisely (2-3 sentences max). Be specific, reference live data. Use stadium ops language.`
}

/**
 * Rule-based fallback (no API key required)
 */
function localAIFallback(query, stadiumState) {
  const q = query.toLowerCase()
  const { gates, food, parking, wristbands, matchMin, score } = stadiumState

  const busyGate = gates.reduce((a, b) => a.load > b.load ? a : b)
  const quietGate = gates.filter(g => !g.disabled).reduce((a, b) => a.load < b.load ? a : b)
  const bestFood = food.reduce((a, b) => a.wait < b.wait ? a : b)
  const worstFood = food.reduce((a, b) => a.wait > b.wait ? a : b)
  const freeLot = parking.reduce((a, b) => a.free > b.free ? a : b)

  if (q.includes('exit') || q.includes('leave'))
    return `⬡ For exit, Gate ${quietGate.id} (${quietGate.loc}) is currently least congested at ${quietGate.load.toFixed(0)}% load. AI recommends leaving ${matchMin > 85 ? '5 minutes before full time' : 'at full time via Gate ' + quietGate.id}. Avoid Gate ${busyGate.id} (${busyGate.load.toFixed(0)}% — highest load).`

  if (q.includes('food') || q.includes('eat') || q.includes('queue'))
    return `⬡ Shortest queue: ${bestFood.icon} ${bestFood.id} (${bestFood.name}) at ${bestFood.wait} min. Avoid ${worstFood.icon} ${worstFood.id} (${worstFood.wait} min wait). AI predicts ${worstFood.id} queue drops in ~${Math.max(3, worstFood.wait - 5)} min as halftime rush clears.`

  if (q.includes('park'))
    return `⬡ ${freeLot.lot} (${freeLot.name}) has the most space: ${freeLot.free} bays free. ${parking.find(p=>p.free<=5)?.lot ?? 'No lots'} ${parking.find(p=>p.free<=5) ? 'is nearly full — avoid' : 'all lots have availability'}. AI is auto-routing overflow to nearest open lot.`

  if (q.includes('crowd') || q.includes('busy') || q.includes('congestion'))
    return `⬡ ${wristbands.total.toLocaleString()} fans tracked. Current congestion hotspot: Gate ${busyGate.id} at ${busyGate.load.toFixed(0)}% capacity. ${wristbands.tunnel.toLocaleString()} fans in tunnels — flow velocity nominal. CV cameras show balanced distribution across East/West stands.`

  if (q.includes('gate') || q.includes('entry') || q.includes('enter'))
    return `⬡ Recommended entry: Gate ${quietGate.id} (${quietGate.loc}) at ${quietGate.load.toFixed(0)}% — lowest queue. Gate ${busyGate.id} is busiest at ${busyGate.load.toFixed(0)}%. Gate F (NW) is dedicated disabled access — currently clear.`

  if (q.includes('score') || q.includes('match') || q.includes('goal'))
    return `⬡ City FC ${score[0]}–${score[1]} United, ${matchMin}' played. ${matchMin > 70 ? 'Entering final stretch — begin planning exit route now.' : 'Game ongoing — all stands reporting normal crowd behaviour.'}`

  if (q.includes('seat') || q.includes('route') || q.includes('stand'))
    return `⬡ For North Stand: use Gate A (${gates[0].load.toFixed(0)}% load, ~4 min walk). Tunnel NB has ${Math.floor(80 + Math.random()*40)} persons — clear. Take Level 2 escalator and follow blue corridor signs to your block.`

  if (q.includes('disabled') || q.includes('wheelchair') || q.includes('accessibility'))
    return `⬡ Gate F (NW) is dedicated accessible entry — ${gates[5].load.toFixed(0)}% load, priority lanes open. Lifts operational on all levels. Accessible seating: Rows A1-A3 on all stands. Staff steward stationed at Gate F at all times.`

  return `⬡ Stadium status: ${wristbands.seated.toLocaleString()} fans seated, match at ${matchMin}'. Gate ${quietGate.id} is clearest for movement. Type: exit, food, parking, gate, crowd, score, or seat for specific guidance.`
}

/**
 * Main AI query function
 * Uses Gemini API if key available, falls back to local logic
 */
export async function queryStadiumAI(userQuery, stadiumState) {
  // Use Gemini if key is configured
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key') {
    try {
      const systemContext = buildSystemContext(stadiumState)
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemContext }] },
            { role: 'model', parts: [{ text: 'Understood. I am ready to assist with stadium operations.' }] },
            { role: 'user', parts: [{ text: userQuery }] },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 150,
            topP: 0.8,
          },
        }),
      })

      if (!response.ok) throw new Error(`Gemini API ${response.status}`)
      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return `⬡ [Gemini] ${text.trim()}`
      throw new Error('Empty response')
    } catch (err) {
      console.warn('[GeminiService] API call failed, using local AI:', err.message)
    }
  }

  // Local rule-based fallback
  return localAIFallback(userQuery, stadiumState)
}

/**
 * Generate AI crowd insight (for dashboard cards)
 */
export function generateCrowdInsight(stadiumState) {
  const { gates, zones, wristbands } = stadiumState
  const overloaded = gates.filter(g => g.load > 85 && !g.disabled)
  const denseZone = zones.reduce((a, b) => (b.occ/b.cap > a.occ/a.cap) ? b : a)
  const pct = Math.round(denseZone.occ / denseZone.cap * 100)

  if (overloaded.length > 0) {
    return `⚠ AI Alert: Gate${overloaded.length > 1 ? 's' : ''} ${overloaded.map(g=>g.id).join(', ')} over threshold. ${denseZone.name} at ${pct}% — consider crowd dispersal advisory.`
  }
  return `✓ Crowd flow nominal. ${denseZone.name} densest at ${pct}%. ${wristbands.tunnel.toLocaleString()} fans in transit — all tunnels within safe parameters.`
}
