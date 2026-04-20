# ⬡ Stadium Nexus — Smart Crowd Intelligence Platform

> **Prompt Wars 2026 · Physical Event Experience Vertical**  
> Built with React + Vite · Powered by Google Cloud (Firebase + Gemini 1.5 Flash)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-stadium--nexus--447ab.web.app-blue?style=flat-square)](https://stadium-nexus-447ab.web.app)
[![GitHub](https://img.shields.io/badge/GitHub-Harshiee09%2FSmart--stadium-black?style=flat-square&logo=github)](https://github.com/Harshiee09/Smart-stadium)

---

## Chosen Vertical

**Physical Event Experience** — Solving real-time crowd movement, waiting times, and post-match exit chaos for 45,000+ attendees at large-scale sporting venues using AI, IoT simulation, and smart wave orchestration.

---

## Live Demo

> Deployed on Firebase Hosting (Google Cloud):  
> **https://stadium-nexus-447ab.web.app**

---

## What It Does

Stadium Nexus is a real-time crowd intelligence platform with five fully integrated modules. The app auto-generates a randomised fan profile on load (name, stand, seat, row, parking) so every demo session feels live and different.

| Module | What it solves |
|---|---|
| **My Route** | AI-optimised, crowd-weighted path from entry gate to your seat. Assigns the least-loaded gate serving your stand and re-routes if congestion spikes above 85%. |
| **Parking** | Real-time bay availability per lot, AI exit routing, and travel-time estimates to your specific parking zone including toll barrier wait. |
| **Food Stalls** | Live queue ETA per stall updated every 2.5 seconds. AI round-trip calculator: "how long to go to the burger stall and come back including the walk" — gives a full breakdown of walk there + queue + walk back + optional toilet detour. |
| **Ask AI** | Gemini 1.5 Flash powered assistant with full live stadium context. Answers prioritised: best answer shown first, tap "Show another option" for the next-best alternative. Travel time and parking journey detection built in. |
| **Exit Waves** | Smart post-match exit orchestration. Auto-activates at 80 minutes with live tunnel pressure meters, personal step-by-step exit route, and wave-based crowd release. Parking holders routed by lot proximity. No human staff needed. |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     DATA SOURCES                         │
│  QR/Wristband scan · CV cameras · BLE IoT sensors        │
│  Parking bay sensors · Food stall POS · Gate turnstiles  │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│              GOOGLE CLOUD (Primary)                      │
│  Firebase Realtime DB ── pub/sub sensor data bus         │
│  Gemini 1.5 Flash ────── AI assistant + crowd insights   │
│  Firebase Hosting ─────── CDN, HTTPS, SPA rewrites       │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│            REACT FRONTEND (Vite)                         │
│  5 tab modules · Gemini AI chat · Exit wave engine       │
│  useStadiumData hook · 2.5s live simulation engine       │
│  Auto-randomised fan profile on every load               │
└──────────────────────────────────────────────────────────┘
```

---

## Google Services Used

| Service | How it's used | File |
|---|---|---|
| **Firebase Realtime Database** | Primary real-time data bus for all sensor feeds (wristbands, gates, parking) | `src/services/cloudService.js` |
| **Firebase Hosting** | Production static site delivery with CDN, HTTPS, SPA rewrites | `firebase.json` |
| **Google Gemini 1.5 Flash** | AI stadium assistant — full live state context, travel-time awareness, parking journey detection, prioritised answer format | `src/services/geminiService.js` |
| **Google App Engine** | Alternative server deployment option | `app.yaml` |
| **Google Fonts** | Inter + Syne typography | `index.html` |

---

## Key Algorithms

### Crowd-Weighted Route Optimisation
Routes are **crowd-weighted, not distance-weighted**. A gate 50m further but 30% less loaded is preferred, because queuing time dominates total journey time at scale.

```
route_cost = base_walk_time + (gate_load / 100) × congestion_penalty_minutes
```

Gates are re-evaluated every 2.5 seconds. If load crosses 85% before the fan arrives, the system re-routes automatically. Disabled fans are always assigned Gate F (NW), held at low capacity.

### AI Travel-Time Detection
The Gemini service detects round-trip intent from natural language — phrases like "go to the burger stall and come back", "make it to the toilet and back", or "how long to reach my parking". It then builds a breakdown:

```
total_time = walk_to_destination + queue_wait + service_time + walk_back [+ toilet_detour]
```

Walk times are calculated per stand using a full distance matrix. Parking journeys include: walk seat → gate + gate queue + walk gate → lot + toll barrier wait.

### Smart Exit Wave System
Seven waves released post-match, ordered to prevent funnel congestion:

| Wave | Trigger | Who | Side |
|---|---|---|---|
| Priority | +0 min | Disabled / medical | Gate F |
| Wave 1 | +2 min | P2 East parking, lower rows | Left exits |
| Wave 2 | +6 min | P4 West parking, lower rows | Right exits |
| Wave 3 | +10 min | P1/P3 parking, lower rows | Left exits |
| Wave 4 | +14 min | P1 parking, upper rows | Centre tunnels |
| Wave 5 | +18 min | Non-parking, lower rows | All exits |
| Wave 6 | +22 min | Non-parking, upper rows | All exits |

Alternating left/right/centre prevents any single tunnel from being overwhelmed. Parking holders are released before non-parking to prevent cars blocking pedestrians at toll barriers.

### Auto-Tab Switching by Match Clock
The app reads the simulated match minute and switches the active tab automatically:

- **0–79 min** → My Route (getting to your seat, food, facilities)
- **80–89 min** → Exit tab activates (pre-exit warnings, wave assignment shown)
- **90+ min** → Exit tab moves to first position (full-time, wave system live)

User manual tab selection overrides the auto-switch.

---

## How to Run

### Prerequisites
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`

### 1. Clone & install
```bash
git clone https://github.com/Harshiee09/Smart-stadium.git
cd Smart-stadium
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Add your Firebase config and Gemini API key
# Leave VITE_DEMO_MODE=true to run fully without any keys
```

### 3. Run locally
```bash
npm run dev
# Open http://localhost:5173
```

### 4. Build & deploy
```bash
npm run build
firebase login
firebase use stadium-nexus-447ab
firebase deploy --only hosting
```

---

## Project Structure

```
Smart-stadium/
├── src/
│   ├── components/
│   │   ├── App.jsx              # Root component, routing, auto-random fan
│   │   ├── ExitTab.jsx          # Smart exit navigation + wave system
│   │   ├── Pages.jsx            # All tab page views
│   │   ├── AIAssistant.jsx      # Gemini chat bar
│   │   └── UI.jsx               # Reusable primitives, CustomSelect
│   ├── hooks/
│   │   └── useStadiumData.js    # Central state + cloud sync
│   ├── services/
│   │   ├── cloudService.js      # Firebase → local fallback
│   │   ├── geminiService.js     # Gemini AI + travel-time + parking detection
│   │   ├── exitWaveEngine.js    # Wave order, tunnel pressure, gate routing
│   │   └── mockDB.js            # Local fan/ticket store
│   └── data/
│       └── mockData.js          # Simulation engine + stadium config
├── public/
├── firebase.json
├── app.yaml
└── vite.config.js
```

---

## Assumptions

1. **Wristband hardware** — NFC/BLE wristbands issued at entry, linked to ticket QR codes. This project simulates the aggregated sensor data they would produce.
2. **CV cameras** — Fixed-lens IP cameras with edge inference (YOLO/MediaPipe) publishing person counts to Firebase every second. Simulated in the CV Monitor.
3. **Stadium layout** — A generic 45,200-seat oval stadium (North, South, East, West stands). In production, the SVG map would be replaced with the venue's exact CAD layout.
4. **Parking pre-allocation** — Parking bay assignment happens at ticket purchase. The wristband profile carries the lot assignment (P1–P4).
5. **Gemini API key** — App runs fully in demo mode without keys (`VITE_DEMO_MODE=true`). The local AI fallback in `geminiService.js` provides contextual responses using live simulation state.

---

## Evaluation Criteria

| Criteria | Implementation |
|---|---|
| **Code Quality** | Modular components, custom hooks, pure utility functions, no magic numbers |
| **Security** | Firebase security rules (read-only public), `.env` for secrets, no keys in source, HTTPS enforced |
| **Efficiency** | 2.5s batched state updates, single diffed state object per tick, CSS transitions over JS animations |
| **Accessibility** | ARIA roles on all interactive elements, `role="status"` on live regions, `aria-live="polite"` on AI responses, keyboard navigation, `prefers-reduced-motion` support |
| **Google Services** | Firebase Realtime DB · Firebase Hosting · Gemini 1.5 Flash · App Engine config · Google Fonts |

---

## Author

Built for **Prompt Wars 2026** — Physical Event Experience vertical.  
GitHub: [Harshiee09](https://github.com/Harshiee09) · Live: [stadium-nexus-447ab.web.app](https://stadium-nexus-447ab.web.app)