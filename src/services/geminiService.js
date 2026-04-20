/**
 * geminiService.js
 * Google Gemini 1.5 Flash — with travel-time aware AI and exit wave logic
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

// ── Static data ───────────────────────────────────────────────

const FOOD_REVIEWS = {
  F1: { name: 'Burgers', rating: 4.2, reviews: 312, feedback: "Juicy smash burgers, good portions. Can get soggy if you wait — eat fresh. Queue moves fast once you're at the front.", tip: 'Order the double — worth the extra.' },
  F2: { name: 'Drinks Bar', rating: 4.5, reviews: 891, feedback: "Best drinks selection in the stadium. Cold beers, soft drinks, water. Staff are quick. Great for a match-day pint.", tip: 'Buy two at once to avoid coming back at halftime.' },
  F3: { name: 'Pizza', rating: 3.9, reviews: 204, feedback: "Decent slices but can be lukewarm. Better earlier in the match before the rush. Good variety of toppings.", tip: 'Ask for a fresh one from the oven — 3 min wait but worth it.' },
  F4: { name: 'Snacks', rating: 4.6, reviews: 567, feedback: "Fan favourite. Nachos, popcorn, hot pretzels. Super quick service. Great for kids.", tip: 'Nachos with cheese sauce are the go-to — best value stall.' },
  F5: { name: 'Hot Dogs', rating: 4.1, reviews: 445, feedback: "Classic stadium hot dogs. Proper bun, good mustard and ketchup. Consistent quality.", tip: 'Add the fried onions — makes a big difference.' },
  F6: { name: 'Coffee', rating: 3.7, reviews: 198, feedback: "Coffee is decent but queue is always long. Better before the match than halftime. Pastries are nice.", tip: 'Go 20 min before kickoff to avoid the rush.' },
  F7: { name: 'Kebabs', rating: 4.3, reviews: 156, feedback: "Hidden gem in the South end. Generous portions, fresh bread. Usually shorter queue.", tip: 'The chicken shawarma wrap is the best item.' },
  F8: { name: 'Ice Cream', rating: 4.7, reviews: 623, feedback: "Consistently top-rated. Soft serve, tubs, bars. Great for hot days. Queue always worth it.", tip: 'The mixed berry swirl is seasonal — sells out fast.' },
}

// Walk time in minutes from each stand to each stall
const WALK_TIMES = {
  north: { F1: 1, F2: 1, F3: 4, F4: 4, F5: 5, F6: 5, F7: 6, F8: 6 },
  south: { F1: 6, F2: 6, F3: 4, F4: 4, F5: 5, F6: 5, F7: 1, F8: 1 },
  east: { F1: 4, F2: 4, F3: 1, F4: 1, F5: 5, F6: 5, F7: 4, F8: 4 },
  west: { F1: 4, F2: 4, F3: 5, F4: 5, F5: 1, F6: 1, F7: 4, F8: 4 },
}

const TOILET_WALK = { north: 1, south: 1, east: 2, west: 2 }
const TOILET_USE = 2

const VIEW_DATA = {
  north: { rating: 4.9, reviews: 1842, description: "The best view in the stadium. You're looking directly down the pitch from behind the goal City FC attack in the second half. Rows 12–18 are the sweet spot.", atmosphere: 'Loudest section. Non-stop chanting, drums, flags. You will lose your voice.', sightlines: 'Clear view of both penalty areas. Slight angle on the far goal but excellent overall.', tip: 'Rows 12–18 are rated best. Avoid rows 1–3 — too low, hard to see over standing fans.' },
  south: { rating: 3.8, reviews: 290, description: "Away end — compact and passionate. Sightlines decent from the middle rows. Back rows can feel far.", atmosphere: 'Away support is loud and passionate.', sightlines: 'Direct view of the goal City FC defend in the second half.', tip: 'Rows 10–15 have the best views.' },
  east: { rating: 4.4, reviews: 631, description: "Side-on view — you see the full width of the pitch. Great for tactical appreciation. Upper tier has excellent elevated views.", atmosphere: 'Relaxed and mixed. Good for families.', sightlines: 'Full pitch visible. Both goals in view.', tip: 'Upper tier rows 5–12 offer the best panoramic view in the whole stadium.' },
  west: { rating: 4.7, reviews: 924, description: "The premium side. Full pitch view with the best balanced angle. Upper tier feels like watching from a broadcast angle.", atmosphere: 'Good mix of passionate home fans and neutrals.', sightlines: 'Arguably the best balanced view — full pitch, both goals clear.', tip: 'Row 5–10 upper tier is second best in the stadium.' },
}

const FAN_ATMOSPHERE = {
  north: { score: 98, label: 'Incredible', description: "The beating heart of the stadium. Ultras in blocks NB-1 to NB-4. Flags, drums, coordinated chants from kickoff." },
  south: { score: 87, label: 'Passionate', description: "Away end passion is unmatched. Compact crowd makes it deafeningly loud." },
  east: { score: 62, label: 'Relaxed', description: "Mixed neutral crowd. Quieter but enjoyable. Good for families and corporate guests." },
  west: { score: 78, label: 'Lively', description: "Mix of passionate home fans and neutrals. Great atmosphere without the intensity of the North end." },
}

// ── Travel time helpers ───────────────────────────────────────

const GATE_WALK = { north: 4, south: 4, east: 5, west: 4 }
const PARKING_WALK = { north: 6, south: 7, east: 8, west: 7 }
const PARKING_LOT_WAIT = { P1: 3, P2: 4, P3: 3, P4: 4 }
const STAND_LOT = { north: 'P1', south: 'P3', east: 'P2', west: 'P4' }
const STAND_GATE = { north: 'A', south: 'D', east: 'B', west: 'E' }

/**
 * Detect exit/leave intent — when someone plans to LEAVE the stadium.
 * @param {string} q - lowercased query
 * @returns {boolean}
 */
function detectExitIntent(q) {
  return (
    q.includes('leave the stadium') || q.includes('leaving the stadium') ||
    q.includes('leave after') || q.includes('head out') ||
    q.includes('head home') || q.includes('go home') ||
    q.includes('going home') || q.includes('on my way out') ||
    q.includes('on the way out') || q.includes('before i leave') ||
    q.includes('before leaving') || q.includes('then leave') ||
    q.includes('and leave') || q.includes('then exit') ||
    q.includes('and exit') || q.includes('walk out') ||
    q.includes('heading out')
  )
}

/**
 * Detect journey query type and return a journey object or null.
 * @param {string} query
 * @param {object} stadiumState
 * @param {object} fanContext
 * @returns {object|null}
 */
function detectJourneyQuery(query, stadiumState, fanContext) {
  const q = query.toLowerCase()
  const stand = fanContext?.stand || 'north'
  const hasParking = fanContext?.parking === 'yes'
  const liveFood = stadiumState?.food || []
  const matchMin = stadiumState?.matchMin || 67

  // EXIT INTENT — check first
  if (detectExitIntent(q)) {
    let stallId = null, stallName = null
    for (const [id, data] of Object.entries(FOOD_REVIEWS)) {
      if (q.includes(id.toLowerCase()) || q.includes(data.name.toLowerCase())) {
        stallId = id; stallName = data.name; break
      }
    }
    if (!stallId) {
      if (q.includes('burger')) { stallId = 'F1'; stallName = 'Burgers' }
      else if (q.includes('drink') || q.includes('beer') || q.includes('pint')) { stallId = 'F2'; stallName = 'Drinks Bar' }
      else if (q.includes('pizza')) { stallId = 'F3'; stallName = 'Pizza' }
      else if (q.includes('snack') || q.includes('nacho')) { stallId = 'F4'; stallName = 'Snacks' }
      else if (q.includes('hot dog')) { stallId = 'F5'; stallName = 'Hot Dogs' }
      else if (q.includes('coffee')) { stallId = 'F6'; stallName = 'Coffee' }
      else if (q.includes('kebab') || q.includes('shawarma')) { stallId = 'F7'; stallName = 'Kebabs' }
      else if (q.includes('ice cream')) { stallId = 'F8'; stallName = 'Ice Cream' }
    }
    return { type: 'exitWithStop', stand, hasParking, stallId, stallName, matchMin, stadiumState }
  }

  const travelIntent =
    q.includes('how long') || q.includes('how much time') ||
    q.includes('time will it take') || q.includes('time to get') ||
    q.includes('can i make it') || q.includes('will i make it') ||
    q.includes('how far') || q.includes('how quickly') ||
    q.includes('and back') || q.includes('come back') ||
    q.includes('back to my seat') || q.includes('back to seat') ||
    q.includes('return') || q.includes('get back') ||
    q.includes('go to') || q.includes('get to') ||
    q.includes('reach') || q.includes('leave for') ||
    q.includes('head to') || q.includes('go back') ||
    q.includes('walk to') || q.includes('exit to')

  const isParking =
    q.includes('parking') || q.includes('my car') ||
    q.includes('the car') || q.includes('parked') ||
    q.includes('lot') || q.includes('vehicle') ||
    q.includes('drive home') || q.includes('get my car') ||
    q.includes('car park') ||
    (q.includes('park') && (travelIntent || hasParking)) ||
    (q.includes('exit') && hasParking && travelIntent)

  const hasToilet =
    q.includes('toilet') || q.includes('bathroom') ||
    q.includes('loo') || q.includes('restroom') || q.includes('wc')

  let stallId = null, stallName = null
  for (const [id, data] of Object.entries(FOOD_REVIEWS)) {
    if (q.includes(id.toLowerCase()) || q.includes(data.name.toLowerCase())) {
      stallId = id; stallName = data.name; break
    }
  }
  if (!stallId) {
    if (q.includes('burger')) { stallId = 'F1'; stallName = 'Burgers' }
    else if (q.includes('drink') || q.includes('beer') || q.includes('pint')) { stallId = 'F2'; stallName = 'Drinks Bar' }
    else if (q.includes('pizza')) { stallId = 'F3'; stallName = 'Pizza' }
    else if (q.includes('snack') || q.includes('nacho')) { stallId = 'F4'; stallName = 'Snacks' }
    else if (q.includes('hot dog')) { stallId = 'F5'; stallName = 'Hot Dogs' }
    else if (q.includes('coffee')) { stallId = 'F6'; stallName = 'Coffee' }
    else if (q.includes('kebab') || q.includes('shawarma')) { stallId = 'F7'; stallName = 'Kebabs' }
    else if (q.includes('ice cream')) { stallId = 'F8'; stallName = 'Ice Cream' }
  }

  if (!stallId && !hasToilet && !isParking) return null
  if (!travelIntent && !hasToilet && !isParking) return null

  if (isParking) {
    const myGate = STAND_GATE[stand]
    const gateWalk = GATE_WALK[stand]
    const lot = STAND_LOT[stand]
    const lotWalk = PARKING_WALK[stand]
    const lotWait = PARKING_LOT_WAIT[lot] || 3
    const liveGates = stadiumState?.gates || []
    const gateLoad = liveGates.find(g => g.id === myGate)?.load || 65
    const gateQueue = Math.round((gateLoad / 100) * 5)
    const totalMin = gateWalk + gateQueue + lotWalk + lotWait
    return { type: 'parking', stand, lot, myGate, gateWalk, gateQueue, gateLoad, lotWalk, lotWait, totalMin, matchMin, hasParking }
  }

  const walkMin = stallId ? (WALK_TIMES[stand]?.[stallId] ?? 3) : 0
  const queueMin = stallId ? (liveFood.find(f => f.id === stallId)?.wait ?? 5) : 0
  const eatMin = stallId ? 2 : 0
  const toiletWalk = hasToilet ? TOILET_WALK[stand] : 0
  const toiletUse = hasToilet ? TOILET_USE : 0
  const totalMin = walkMin * 2 + queueMin + eatMin + toiletWalk * 2 + toiletUse

  return { type: 'food', stallId, stallName, walkMin, queueMin, eatMin, hasToilet, toiletWalk, toiletUse, totalMin, stand, matchMin }
}

/**
 * Format a journey object into a human-readable answer string.
 * @param {object} j - journey object from detectJourneyQuery
 * @param {object} fanContext
 * @returns {string}
 */
function formatJourneyAnswer(j, fanContext) {
  const standName = j.stand.charAt(0).toUpperCase() + j.stand.slice(1)
  const matchMin = j.matchMin || fanContext?.matchMin || 67
  const minsLeft = 90 - matchMin
  let lines = []

  if (j.type === 'exitWithStop') {
    const { stand, hasParking, stallId, stallName, stadiumState } = j
    const myGate = STAND_GATE[stand]
    const gateWalk = GATE_WALK[stand]
    const lot = STAND_LOT[stand]
    const lotWalk = PARKING_WALK[stand]
    const lotWait = PARKING_LOT_WAIT[lot] || 3
    const liveGates = stadiumState?.gates || []
    const gateLoad = liveGates.find(g => g.id === myGate)?.load || 65
    const gateQueue = Math.round((gateLoad / 100) * 5)
    const liveFood = stadiumState?.food || []

    if (stallId) {
      const stallWalk = WALK_TIMES[stand]?.[stallId] ?? 3
      const stallQueue = liveFood.find(f => f.id === stallId)?.wait ?? 5
      const totalToGate = stallWalk + stallQueue + 2 + gateWalk
      const totalWithParking = hasParking ? totalToGate + gateQueue + lotWalk + lotWait : totalToGate + gateQueue

      lines.push(`Here's your exit route from ${standName} Stand — stopping at ${stallName} on the way out:\n`)
      lines.push(`🍺 Walk to ${stallName} (${stallId}): ${stallWalk} min`)
      lines.push(`⏳ Queue: ${stallQueue} min`)
      lines.push(`🛍 Collect & walk to Gate ${myGate}: ${2 + gateWalk} min`)
      lines.push(`⏳ Gate ${myGate} queue (${Math.round(gateLoad)}% load): ~${gateQueue} min`)
      if (hasParking) {
        lines.push(`🚶 Walk Gate ${myGate} → ${lot} lot: ${lotWalk} min`)
        lines.push(`🚗 Toll barrier wait: ~${lotWait} min`)
        lines.push(`\n⏱ Total from seat to car: ~${totalWithParking} minutes`)
      } else {
        lines.push(`\n⏱ Total from seat to exit: ~${totalWithParking} minutes`)
      }
    } else {
      const totalToGate = gateWalk + gateQueue
      lines.push(`Here's your exit route from ${standName} Stand:\n`)
      lines.push(`🚶 Walk to Gate ${myGate}: ${gateWalk} min`)
      lines.push(`⏳ Gate ${myGate} queue (${Math.round(gateLoad)}% load): ~${gateQueue} min`)
      if (hasParking) {
        lines.push(`🚶 Walk Gate ${myGate} → ${lot} lot: ${lotWalk} min`)
        lines.push(`🚗 Toll barrier wait: ~${lotWait} min`)
        lines.push(`\n⏱ Total to your car: ~${totalToGate + lotWalk + lotWait} minutes`)
      } else {
        lines.push(`\n⏱ Total to exit: ~${totalToGate} minutes`)
      }
    }
    if (minsLeft > 0) {
      lines.push(`\n💡 ${minsLeft} min left in the match. Check the Exit tab at full time for your smart wave assignment.`)
    } else {
      lines.push(`\n✅ Full time — your wave is active. Follow exit signs to Gate ${myGate}.`)
    }
    return lines.join('\n')
  }

  if (j.type === 'parking') {
    if (!j.hasParking) {
      return `Your ticket doesn't include parking. Nearest bus stop is at Gate D (South), taxi rank at Gate D, and cycle parking at Gate B. Walk from your stand to Gate ${j.myGate} takes about ${j.gateWalk} min.`
    }
    lines.push(`Here's your journey from ${standName} Stand to your car (${j.lot} lot):\n`)
    lines.push(`🚶 Walk from seat to Gate ${j.myGate}: ${j.gateWalk} min`)
    lines.push(`⏳ Gate queue (currently ${j.gateLoad}% load): ~${j.gateQueue} min`)
    lines.push(`🚶 Walk Gate ${j.myGate} → ${j.lot} lot: ${j.lotWalk} min`)
    lines.push(`🚗 Toll barrier + lot exit wait: ~${j.lotWait} min`)
    lines.push(`\n⏱ Total to reach your car: ~${j.totalMin} minutes`)
    if (matchMin < 90) {
      lines.push(`\n💡 Best time to leave: at or just before full time to beat the rush.`)
      if (minsLeft > 0) lines.push(`Match has ~${minsLeft} min left.`)
    } else {
      lines.push(`\n✅ Full time. Follow exit signs to Gate ${j.myGate} then ${j.lot}.`)
    }
    lines.push(`\n📍 Gate ${j.myGate} is your exit. Follow ${j.lot} parking signs from the gate.`)
    return lines.join('\n')
  }

  if (j.stallId) {
    lines.push(`Here's your full round trip from ${standName} Stand to ${j.stallName} and back:\n`)
    lines.push(`🚶 Walk to ${j.stallName} (${j.stallId}): ${j.walkMin} min`)
    lines.push(`⏳ Current queue: ${j.queueMin} min`)
    lines.push(`🍽 Collect & start walking back: ~${j.eatMin} min`)
    if (j.hasToilet) lines.push(`🚻 Toilet detour: ${j.toiletWalk} min walk + ${j.toiletUse} min use`)
    lines.push(`🚶 Walk back to seat: ${j.walkMin} min`)
    lines.push(`\n⏱ Total time away: ~${j.totalMin} minutes`)
    if (minsLeft > 0) {
      lines.push(j.totalMin <= minsLeft
        ? `\n✅ ~${minsLeft} min left — you'll be back in time.`
        : `\n⚠️ Only ~${minsLeft} min left — you'll miss ~${j.totalMin - minsLeft} min of the match.`)
    }
    lines.push(`\nTip: ${FOOD_REVIEWS[j.stallId]?.tip}`)
    return lines.join('\n')
  }

  if (j.hasToilet) {
    lines.push(`Toilet round trip from ${standName} Stand:\n`)
    lines.push(`🚶 Walk to nearest toilet: ${j.toiletWalk} min`)
    lines.push(`🚻 Use + wash: ~${j.toiletUse} min`)
    lines.push(`🚶 Walk back: ${j.toiletWalk} min`)
    lines.push(`\n⏱ Total: ~${j.totalMin} minutes`)
    if (minsLeft > 0) {
      lines.push(j.totalMin <= minsLeft
        ? `\n✅ Plenty of time — you'll be back before the whistle.`
        : `\n⚠️ Only ~${minsLeft} min left — you'll miss some action.`)
    }
    return lines.join('\n')
  }

  return 'Journey information unavailable — please try asking more specifically.'
}

// ── System context builder ────────────────────────────────────

/**
 * Build Gemini system context string from live state and fan context.
 * @param {object} stadiumState
 * @param {object} fanContext
 * @returns {string}
 */
function buildSystemContext(stadiumState, fanContext) {
  const { gates, food, matchMin, score } = stadiumState
  const stand = fanContext?.stand || 'north'
  const v = VIEW_DATA[stand]
  const atm = FAN_ATMOSPHERE[stand]

  const walkCtx = Object.entries(WALK_TIMES[stand] || {})
    .map(([id, mins]) => {
      const liveWait = food?.find(f => f.id === id)?.wait ?? '?'
      const name = FOOD_REVIEWS[id]?.name || id
      return `${name}: ${mins}min walk, ${liveWait}min queue, ~${mins * 2 + Number(liveWait) + 2}min round trip`
    }).join(' | ')

  return `You are a smart stadium assistant at Nexus Arena. Be warm, specific, practical. Max 4 sentences.

Fan: ${fanContext?.name || 'Fan'} | Stand: ${stand} | Row: ${fanContext?.row || '?'} | Seat: ${fanContext?.seat || '?'}
Match: City FC ${score?.[0] ?? 2}–${score?.[1] ?? 1} United, minute ${matchMin}' (${90 - matchMin} min remaining)
Gates: ${gates?.map(g => 'Gate ' + g.id + ' ' + Math.round(g.load) + '%').join(', ')}
Food queues: ${food?.map(f => f.name + ' ' + f.wait + 'min wait').join(', ')}
Round-trip times from their stand: ${walkCtx}
Toilet: ${TOILET_WALK[stand]}min walk each way + ~2min use = ~${TOILET_WALK[stand] * 2 + 2}min total round trip
View: ${v.description} Rated ${v.rating} stars.
Atmosphere: ${atm.label} (${atm.score}/100) — ${atm.description}
Parking: fan has parking = ${fanContext?.parking === 'yes' ? 'YES' : 'NO'}. Lot: ${STAND_LOT[stand]}. Total ~${GATE_WALK[stand] + 2 + PARKING_WALK[stand] + PARKING_LOT_WAIT[STAND_LOT[stand]]}min to car.

If the fan wants to LEAVE (leave, leaving, head out, go home, on the way out, and leave, then exit), treat it as EXIT — give route TO gate/parking, NOT back to seat.`
}

// ── Local AI fallback ─────────────────────────────────────────

/**
 * Rule-based local AI — used when no Gemini API key is set.
 * @param {string} query
 * @param {object} stadiumState
 * @param {object} fanContext
 * @returns {string}
 */
function localAIFallback(query, stadiumState, fanContext) {
  const q = query.toLowerCase()
  const { gates, food, parking, matchMin, score } = stadiumState
  const stand = fanContext?.stand || 'north'
  const row = fanContext?.row || '?'
  const seat = fanContext?.seat || '?'
  const standName = stand.charAt(0).toUpperCase() + stand.slice(1)

  const liveFood = food?.length ? food : Object.keys(FOOD_REVIEWS).map((id, i) => ({ id, ...FOOD_REVIEWS[id], wait: [12, 4, 8, 2, 6, 14, 5, 3][i] }))
  const bestFood = liveFood.reduce((a, b) => a.wait < b.wait ? a : b)
  const worstFood = liveFood.reduce((a, b) => a.wait > b.wait ? a : b)
  const quietGate = gates?.length ? gates.filter(g => !g.disabled).reduce((a, b) => a.load < b.load ? a : b) : { id: 'A', load: 60 }
  const busyGate = gates?.length ? gates.filter(g => !g.disabled).reduce((a, b) => a.load > b.load ? a : b) : { id: 'C', load: 90 }
  const freeLot = parking?.length ? parking.reduce((a, b) => a.free > b.free ? a : b) : { lot: 'P1', free: 142 }

  // Journey / round-trip detection (highest priority)
  const journey = detectJourneyQuery(query, stadiumState, fanContext)
  if (journey) return formatJourneyAnswer(journey, { ...fanContext, matchMin })

  if (q.includes('toilet') || q.includes('bathroom') || q.includes('loo') || q.includes('restroom')) {
    const tw = TOILET_WALK[stand]
    return `Nearest toilet from ${standName} Stand: Level 2 concourse entry, ${tw} min walk.\nRound trip: ~${tw * 2 + TOILET_USE} minutes total.\nCurrent wait: ~2 min. Avoid halftime (45') — queues spike to 8–10 min.`
  }

  if (q.includes('review') || q.includes('feedback') || q.includes('rating') || (q.includes('food') && (q.includes('best') || q.includes('which') || q.includes('recommend') || q.includes('good')))) {
    const sorted = Object.values(FOOD_REVIEWS).sort((a, b) => b.rating - a.rating)
    return `Top rated stalls today:\n\n${sorted[0].name} ⭐${sorted[0].rating}: "${sorted[0].feedback}"\n\n${sorted[1].name} ⭐${sorted[1].rating}: "${sorted[1].feedback}"\n\nShortest queue now: ${bestFood.name} at ${bestFood.wait} min.`
  }

  for (const [id, data] of Object.entries(FOOD_REVIEWS)) {
    if (q.includes(id.toLowerCase()) || q.includes(data.name.toLowerCase())) {
      const liveWait = liveFood.find(f => f.id === id)?.wait || '?'
      const walk = WALK_TIMES[stand]?.[id] ?? 3
      return `${data.name} (${id}) — ⭐${data.rating} from ${data.reviews} reviews\n\n"${data.feedback}"\n\nTip: ${data.tip}\n\n📍 ${walk} min walk | ⏳ ${liveWait} min queue | 🔄 ~${walk * 2 + Number(liveWait) + 2} min round trip`
    }
  }

  if (q.includes('burger')) { const w = WALK_TIMES[stand].F1; const q2 = liveFood.find(f => f.id === 'F1')?.wait || 12; return `F1 Burgers — ⭐${FOOD_REVIEWS.F1.rating}: "${FOOD_REVIEWS.F1.feedback}"\nTip: ${FOOD_REVIEWS.F1.tip}\n📍 ${w}min walk | ⏳ ${q2}min queue` }
  if (q.includes('beer') || q.includes('drink') || q.includes('pint')) { const w = WALK_TIMES[stand].F2; const q2 = liveFood.find(f => f.id === 'F2')?.wait || 4; return `F2 Drinks Bar — ⭐${FOOD_REVIEWS.F2.rating}: "${FOOD_REVIEWS.F2.feedback}"\nTip: ${FOOD_REVIEWS.F2.tip}\n📍 ${w}min walk | ⏳ ${q2}min queue` }
  if (q.includes('pizza')) { const w = WALK_TIMES[stand].F3; const q2 = liveFood.find(f => f.id === 'F3')?.wait || 8; return `F3 Pizza — ⭐${FOOD_REVIEWS.F3.rating}: "${FOOD_REVIEWS.F3.feedback}"\nTip: ${FOOD_REVIEWS.F3.tip}\n📍 ${w}min walk | ⏳ ${q2}min queue` }
  if (q.includes('snack') || q.includes('nacho')) { const w = WALK_TIMES[stand].F4; const q2 = liveFood.find(f => f.id === 'F4')?.wait || 2; return `F4 Snacks — ⭐${FOOD_REVIEWS.F4.rating}: "${FOOD_REVIEWS.F4.feedback}"\nTip: ${FOOD_REVIEWS.F4.tip}\n📍 ${w}min walk | ⏳ ${q2}min queue` }
  if (q.includes('ice cream')) { const w = WALK_TIMES[stand].F8; const q2 = liveFood.find(f => f.id === 'F8')?.wait || 3; return `F8 Ice Cream — ⭐${FOOD_REVIEWS.F8.rating}: "${FOOD_REVIEWS.F8.feedback}"\nTip: ${FOOD_REVIEWS.F8.tip}\n📍 ${w}min walk | ⏳ ${q2}min queue` }
  if (q.includes('coffee')) { const w = WALK_TIMES[stand].F6; const q2 = liveFood.find(f => f.id === 'F6')?.wait || 14; return `F6 Coffee — ⭐${FOOD_REVIEWS.F6.rating}: "${FOOD_REVIEWS.F6.feedback}"\nTip: ${FOOD_REVIEWS.F6.tip}\n📍 ${w}min walk | ⏳ ${q2}min queue` }

  if (q.includes('view') || q.includes('sightline') || q.includes('see from') || q.includes('my seat') || q.includes('from here')) {
    const v = VIEW_DATA[stand]
    return `View from ${standName} Stand, Row ${row}, Seat ${seat}:\n\n${v.description}\n\n${v.sightlines}\n\n⭐${v.rating} from ${v.reviews} fans. Tip: ${v.tip}`
  }

  if (q.includes('atmosphere') || q.includes('vibe') || q.includes('loud') || q.includes('chant')) {
    const atm = FAN_ATMOSPHERE[stand]
    const v = VIEW_DATA[stand]
    return `${standName} Stand atmosphere: ${atm.label} — ${atm.score}/100\n\n${atm.description}\n\n${v.atmosphere}`
  }

  if (q.includes('best fan') || q.includes('best stand') || q.includes('where to sit') || q.includes('which stand')) {
    return `Best stands by atmosphere:\n\n1. North Stand (98/100)\n2. South Stand (87/100)\n3. West Stand (78/100)\n4. East Stand (62/100)\n\nYou're in ${standName} Stand — ${FAN_ATMOSPHERE[stand].description}`
  }

  if (q.includes('photo') || q.includes('picture') || q.includes('selfie') || q.includes('instagram')) {
    return `Best photo spots:\n\n📸 North concourse entry arch\n📸 Level 3 West walkway — full pitch panoramic\n📸 Your seat during warmups\n📸 Tunnel view Level 1 East concourse\n\nGolden hour hits West Stand roof around 7pm.`
  }

  if (q.includes('score') || q.includes('match') || q.includes('goal') || q.includes('result')) {
    return `City FC ${score?.[0] ?? 2}–${score?.[1] ?? 1} United, ${matchMin}' played. ${90 - matchMin} minutes remaining. ${matchMin > 85 ? 'Almost full time!' : matchMin > 70 ? 'Final stages — exciting finish ahead.' : 'Game in full swing!'}`
  }

  if (q.includes('gate') || q.includes('entry') || q.includes('enter')) {
    return `Recommended gate for ${standName} Stand: Gate ${quietGate.id} at ${Math.round(quietGate.load)}% load — lowest queue right now. Avoid Gate ${busyGate.id} (${Math.round(busyGate.load)}% — busiest). Gate F (NW) is dedicated accessible entry.`
  }

  if (q.includes('exit') || q.includes('leave') || q.includes('go home') || q.includes('after match')) {
    return `Best exit for ${standName} Stand: Gate ${quietGate.id} at ${Math.round(quietGate.load)}% load. Avoid Gate ${busyGate.id} (${Math.round(busyGate.load)}%). Check the Exit tab at full time for your personalised wave assignment.`
  }

  if (q.includes('park')) {
    return `${freeLot.lot} has the most free bays: ${freeLot.free}. ${parking?.find(p => p.free <= 5) ? parking.find(p => p.free <= 5).lot + ' is nearly full — avoid.' : 'All lots have space.'} Exit via Gate ${quietGate.id} after full time.`
  }

  if (q.includes('food') || q.includes('eat') || q.includes('hungry') || q.includes('queue')) {
    const w = WALK_TIMES[stand]?.[bestFood.id] ?? 3
    return `Shortest queue: ${bestFood.name} at ${bestFood.wait} min wait — ${w} min walk from your seat (~${w * 2 + bestFood.wait + 2} min round trip).\nAvoid ${worstFood.name} (${worstFood.wait} min queue). Ask "food reviews" for full ratings!`
  }

  if (q.includes('disabled') || q.includes('wheelchair') || q.includes('accessibility')) {
    return `Gate F (NW) is the dedicated accessible entry — priority lanes open. Lifts operational on all levels. Accessible seating in Rows A1-A3 on all stands. Staff steward at Gate F at all times.`
  }

  return `I can help with:\n\n• Food stalls — queue times, reviews, round-trip time\n• Toilets — nearest + time away\n• View from your seat\n• Fan atmosphere\n• Match score\n• Exit & parking\n\nJust ask anything!`
}

// ── Main exports ──────────────────────────────────────────────

/**
 * Main AI query function. Uses Gemini if API key set, otherwise local fallback.
 * @param {string} userQuery
 * @param {object} stadiumState
 * @param {object} fanContext
 * @returns {Promise<string>}
 */
export async function queryStadiumAI(userQuery, stadiumState, fanContext) {
  const journey = detectJourneyQuery(userQuery, stadiumState, fanContext)
  if (journey) return formatJourneyAnswer(journey, { ...fanContext, matchMin: stadiumState?.matchMin })

  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key') {
    try {
      const systemContext = buildSystemContext(stadiumState, fanContext)
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemContext }] },
            { role: 'model', parts: [{ text: 'Got it! Ready to help.' }] },
            { role: 'user', parts: [{ text: userQuery }] },
          ],
          generationConfig: { temperature: 0.5, maxOutputTokens: 250, topP: 0.9 },
        }),
      })
      if (!response.ok) throw new Error(`Gemini API ${response.status}`)
      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return text.trim()
      throw new Error('Empty response')
    } catch (err) {
      console.warn('[GeminiService] Falling back to local AI:', err.message)
    }
  }
  return localAIFallback(userQuery, stadiumState, fanContext)
}

/**
 * Generate a short crowd insight string for dashboard cards.
 * @param {object} stadiumState
 * @returns {string}
 */
export function generateCrowdInsight(stadiumState) {
  const { gates, zones, wristbands } = stadiumState
  if (!gates?.length || !zones?.length) return 'Crowd data loading...'
  const overloaded = gates.filter(g => g.load > 85 && !g.disabled)
  const denseZone = zones.reduce((a, b) => (b.occ / b.cap > a.occ / a.cap) ? b : a)
  const pct = Math.round(denseZone.occ / denseZone.cap * 100)
  if (overloaded.length)
    return `Gate${overloaded.length > 1 ? 's' : ''} ${overloaded.map(g => g.id).join(', ')} over threshold. ${denseZone.name} at ${pct}% — dispersal advisory active.`
  return `Crowd flow nominal. ${denseZone.name} densest at ${pct}%. ${wristbands?.tunnel?.toLocaleString() ?? 0} fans in transit — all tunnels clear.`
}