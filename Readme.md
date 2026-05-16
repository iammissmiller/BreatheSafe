<<<<<<< HEAD
# BreatheSafe 🫁

BreatheSafe is a full-stack respiratory health web app that helps people monitor air quality, track breathing symptoms, plan cleaner travel routes, and get AI-powered emergency guidance — in real time.

> **Status:** Active development

---

## Features

**Dashboard** — Live AQI, temperature, humidity, UV index from your GPS location. AI-generated daily breathing assessment personalised to your health profile.

**SafeRoute** — Real road routing via OSRM with live AQI sampled along each route. Three route alternatives, colour-coded by air quality. AI recommends the cleanest path with health warnings and best travel time.

**Symptoms** — Daily breathing log with comfort score, symptom tracking, severity, triggers, and time of day. Synced to Firestore.

**Analytics** — D3.js comfort trend chart, logging streak calendar, episode markers, and pattern insights — all from your real data.

**HelpZone** — AI-generated step-by-step emergency action protocol for asthma episodes, breathing attacks, dust exposure, and hyperventilation. Timed steps with countdowns. Episodes saved to Analytics.

---

## Tech Stack

- **Frontend** — HTML, CSS, Vanilla JavaScript
- **Auth** — Firebase Authentication (Google OAuth + Email/Password)
- **Database** — Cloud Firestore
- **AI** — Groq API (llama-3.1-8b-instant)
- **Routing** — OSRM + Leaflet.js
- **Charts** — D3.js
- **Weather & AQI** — OpenWeather API
- **Geocoding** — Google Maps Places & Geocoding API
- **Backend** — Vercel Serverless Functions
- **Hosting** — Vercel

---

## Architecture

All API keys are hidden behind Vercel serverless functions. The frontend calls `/api/weather`, `/api/groq`, and `/api/maps` — never the external APIs directly.

Firestore security rules ensure each user can only read and write their own data.

---

## Live Site

[breathe-safe-jet.vercel.app](https://breathe-safe-jet.vercel.app)

---

## Local Development

```bash
git clone https://github.com/iammissmiller/BreatheSafe.git
cd BreatheSafe
# Open with VS Code Live Server
```

Note: `/api/*` serverless functions only run on Vercel. Local dev falls back to localStorage.

---

## License

MIT
=======
# BreatheSafe 🫁

BreatheSafe is a full-stack respiratory health web app that helps people monitor air quality, track breathing symptoms, plan cleaner travel routes, and get AI-powered emergency guidance — in real time.

> **Status:** Active development

---

## Features

**Dashboard** — Live AQI, temperature, humidity, UV index from your GPS location. AI-generated daily breathing assessment personalised to your health profile.

**SafeRoute** — Real road routing via OSRM with live AQI sampled along each route. Three route alternatives, colour-coded by air quality. AI recommends the cleanest path with health warnings and best travel time.

**Symptoms** — Daily breathing log with comfort score, symptom tracking, severity, triggers, and time of day. Synced to Firestore.

**Analytics** — D3.js comfort trend chart, logging streak calendar, episode markers, and pattern insights — all from your real data.

**HelpZone** — AI-generated step-by-step emergency action protocol for asthma episodes, breathing attacks, dust exposure, and hyperventilation. Timed steps with countdowns. Episodes saved to Analytics.

---

## Tech Stack

- **Frontend** — HTML, CSS, Vanilla JavaScript
- **Auth** — Firebase Authentication (Google OAuth + Email/Password)
- **Database** — Cloud Firestore
- **AI** — Groq API (llama-3.1-8b-instant)
- **Routing** — OSRM + Leaflet.js
- **Charts** — D3.js
- **Weather & AQI** — OpenWeather API
- **Geocoding** — Google Maps Places & Geocoding API
- **Backend** — Vercel Serverless Functions
- **Hosting** — Vercel

---

## Architecture

All API keys are hidden behind Vercel serverless functions. The frontend calls `/api/weather`, `/api/groq`, and `/api/maps` — never the external APIs directly.

Firestore security rules ensure each user can only read and write their own data.

---

## Live Site

[breathe-safe-jet.vercel.app](https://breathe-safe-jet.vercel.app)

---

## Local Development

```bash
git clone https://github.com/iammissmiller/BreatheSafe.git
cd BreatheSafe
# Open with VS Code Live Server
```

Note: `/api/*` serverless functions only run on Vercel. Local dev falls back to localStorage.

---

## License

MIT






>>>>>>> fd3b84a (SafeRoute: switch back to OpenWeather geocoding, remove Google Maps dependency)
