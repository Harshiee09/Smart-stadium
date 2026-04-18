# ⬡ Stadium Nexus — Smart Crowd Intelligence Platform

> **Prompt Wars 2026 · Physical Event Experience Vertical**
> Built with Google Antigravity · Powered by Google Cloud (Firebase + Gemini) · AWS fallback

[![CI/CD](https://github.com/YOUR_USERNAME/smart-stadium/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/smart-stadium/actions)

---

## Chosen Vertical

**Physical Event Experience** — Improving the stadium experience for 45,000+ attendees at large-scale sporting venues by solving crowd movement, waiting times, and real-time coordination through AI and IoT.

---

## Live Demo

> Deployed on Firebase Hosting (Google Cloud):
> **https://YOUR_PROJECT.web.app**
>
> AWS CloudFront fallback (if Firebase credits insufficient):
> **https://YOUR_CLOUDFRONT_ID.cloudfront.net**

---

## What It Does

Stadium Nexus is a real-time crowd intelligence dashboard with seven integrated modules:

| Module | What it solves |
|---|---|
| **Stadium Map** | Interactive SVG map — gates, food stalls, seating zones, parking, disabled access, live heat overlays |
| **My Route** | AI-optimised crowd-weighted path to your seat; time-aware, first-come-first-served gate assignment |
| **Match Info** | Home/away fan zones, best viewing spots by crowd-sourced reviews, live score + events |
| **Parking** | Real-time bay availability per lot, bay-level grid map, AI exit routing |
| **Food Stalls** | Live queue ETA per stall (POS-fed), AI recommendation for shortest wait near your seat |
| **CV Monitor** | Computer vision camera feeds — tunnel person count, seat fill %, crowd flow velocity |
| **Staff Dashboard** | Incident alerts, crowd density heatmap, dynamic staff deployment recommendations |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DATA SOURCES                         │
│  QR/Wristband scan · CV cameras · BLE IoT sensors      │
│  Parking bay sensors · Food stall POS systems           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              GOOGLE CLOUD (Primary)                     │
│  Firebase Realtime DB ── pub/sub sensor data bus        │
│  Gemini 1.5 Flash ────── AI assistant + crowd insight   │
│  Firebase Hosting ─────── static site delivery          │
└────────────────────┬────────────────────────────────────┘
                     │ fallback if credits insufficient
┌────────────────────▼────────────────────────────────────┐
│              AWS (Fallback)                             │
│  IoT Core WebSocket ── real-time sensor stream          │
│  S3 + CloudFront ────── static hosting CDN              │
│  Cognito Identity ────── browser-safe IoT auth          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│            REACT FRONTEND (Vite + Tailwind)             │
│  StadiumMap SVG · 7 tab pages · AI Assistant chat bar   │
│  useStadiumData hook · 2.5s live simulation engine      │
└─────────────────────────────────────────────────────────┘
```

---

## Google Services Used

| Service | How it's used | File |
|---|---|---|
| **Firebase Realtime Database** | Primary real-time data bus for all sensor feeds (wristbands, gates, parking) | `src/services/cloudService.js` |
| **Firebase Hosting** | Production static site delivery with CDN, HTTPS, SPA rewrites | `firebase.json` |
| **Google Gemini 1.5 Flash** | AI stadium assistant — contextual crowd advice using live state | `src/services/geminiService.js` |
| **Google App Engine** | Alternative server deployment option | `app.yaml` |
| **Google Fonts** | Rajdhani + Share Tech Mono + Barlow typography | `index.html` |

---

## Approach & Logic

### Crowd Flow Intelligence
Each gate is assigned a **load score (0–99%)** derived from wristband scan rate + CV camera counts. When a fan scans their QR code at entry, the system:
1. Reads current gate loads from Firebase
2. Selects the gate with the lowest load that serves their stand (FCFS — first come, first served)
3. Pushes the assigned gate back to Firebase for their device
4. Re-routes if the assigned gate crosses 85% before they arrive

Disabled fans are always routed to Gate F (NW) which is permanently reserved at low capacity.

### Route Optimisation
Routes are **crowd-weighted, not distance-weighted**. A gate 50m further away but with 30% less load is preferred because queuing time dominates total journey time at scale. Walk time is estimated as: `base_walk_time + (gate_load / 100) * congestion_penalty_minutes`.

### CV Simulation
The CV monitor simulates computer vision outputs:
- **Tunnel cameras** count persons in frame (0–500 range, danger threshold: 300)
- **Seat cameras** report fill percentage per block
- **Flow velocity** is calculated as persons-per-minute through each tunnel

In production, these would be outputs from a deployed YOLO/MediaPipe model on edge hardware at each camera point, publishing to Firebase via a lightweight Python agent.

### Food Queue Intelligence
Each stall's queue ETA is updated every 2.5 seconds from simulated POS data. The AI assistant identifies the nearest low-queue stall to the fan's seat, factoring in concourse walk distance. Halftime rush is modelled as a temporary spike pattern.

### Wristband Tracking
BLE wristbands given at entry are triangulated via fixed sensor nodes:
- **Tunnels** → count of bands entering/exiting
- **Concourse** → bands detected but not in seat zone
- **Seated** → band in seat zone (CV-confirmed)

This gives the real-time breakdown: total / tunnels / seated / concourse.

### Exit Orchestration
When the match enters the final 10 minutes, the AI switches to **exit mode**: it calculates the nearest uncrowded gate for each zone and pushes a notification via Firebase to all wristband-linked devices in that zone, staggering the departures to prevent funnel congestion.

---

## How to Run

### Prerequisites
- Node.js 20+
- Git
- Google Antigravity (for development)
- Firebase CLI: `npm install -g firebase-tools`

### 1. Clone & install
```bash
git clone https://github.com/YOUR_USERNAME/smart-stadium.git
cd smart-stadium
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local with your Firebase and Gemini API keys
# Leave VITE_DEMO_MODE=true to run without any keys
```

### 3. Run locally
```bash
npm run dev
# Open http://localhost:5173
```

### 4. Run tests
```bash
npm test
```

### 5. Build for production
```bash
npm run build
```

### 6. Deploy to Firebase (Google Cloud)
```bash
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy
```

### 7. Deploy to AWS (fallback)
```bash
# 1. Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file cloudformation.yaml \
  --stack-name stadium-nexus \
  --capabilities CAPABILITY_IAM

# 2. Sync dist to S3
aws s3 sync dist/ s3://YOUR_BUCKET_NAME --delete

# 3. Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

---

## Project Structure

```
smart-stadium/
├── src/
│   ├── components/
│   │   ├── StadiumMap.jsx      # Interactive SVG map
│   │   ├── AIAssistant.jsx     # Gemini-powered chat bar
│   │   ├── Pages.jsx           # All 7 tab page views
│   │   └── UI.jsx              # Reusable primitive components
│   ├── hooks/
│   │   └── useStadiumData.js   # Central state + cloud sync
│   ├── services/
│   │   ├── cloudService.js     # Firebase → AWS IoT fallback
│   │   └── geminiService.js    # Gemini AI → local fallback
│   ├── data/
│   │   └── mockData.js         # Simulation engine + stadium config
│   ├── utils/
│   │   └── helpers.js          # Pure utility functions
│   ├── tests/
│   │   ├── setup.js
│   │   ├── mockData.test.js    # 20+ unit tests
│   │   ├── geminiService.test.js
│   │   └── helpers.test.js
│   ├── App.jsx                 # Root component + routing
│   ├── main.jsx                # Entry point
│   └── index.css               # Global styles + design tokens
├── public/
│   └── favicon.svg
├── .github/
│   └── workflows/
│       └── ci.yml              # CI: test → build → Firebase → AWS fallback
├── firebase.json               # Firebase Hosting + DB rules
├── database.rules.json         # Firebase security rules
├── app.yaml                    # Google App Engine config
├── cloudformation.yaml         # AWS fallback infrastructure
├── .env.example                # Environment variable template
├── vite.config.js
├── tailwind.config.js
└── README.md
```

---

## Assumptions

1. **Wristband hardware**: NFC/BLE wristbands are issued at entry gates and associated with ticket QR codes. This project simulates the aggregated data these would produce.

2. **CV cameras**: Assumed to be fixed-lens IP cameras with an edge inference agent (Python + YOLO) publishing JSON counts to Firebase every second. The CV Monitor tab visualises this feed.

3. **Stadium layout**: A generic 45,200-seat oval stadium is modelled. In production, the SVG map would be replaced with an accurate stadium-specific layout.

4. **Parking tickets**: Fans who pre-purchased parking are identified by their wristband profile. Parking bay assignment is pre-allocated at ticket purchase time.

5. **Gemini API key**: The app runs fully in demo mode without any API keys (`VITE_DEMO_MODE=true`). The local AI fallback in `geminiService.js` provides contextual responses using the live simulation state.

6. **AWS fallback**: Triggered only when Firebase is unavailable or credits are exhausted. The `cloudService.js` auto-detects the active provider and switches transparently.

---

## Evaluation Criteria Addressed

| Criteria | Implementation |
|---|---|
| **Code Quality** | Modular components, custom hooks, pure utility functions, consistent naming, no magic numbers |
| **Security** | Firebase security rules (read-only public), `.env` for secrets, no keys in source, HTTPS enforced, CSP headers |
| **Efficiency** | 2.5s update batching (not per-field), single state object diffed per tick, CSS transitions instead of JS animations |
| **Testing** | 30+ unit tests across data engine, AI service, and helpers using Vitest |
| **Accessibility** | ARIA roles/labels on all interactive elements, `role="status"` on live regions, `aria-live="polite"` on AI responses, `prefers-reduced-motion` support, keyboard navigation, focus-visible styles |
| **Google Services** | Firebase Realtime DB, Firebase Hosting, Gemini 1.5 Flash, App Engine config, Google Fonts |

---

## Author

Built for **Prompt Wars 2026** — Physical Event Experience vertical.
