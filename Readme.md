BreatheSafe

BreatheSafe is a web-based platform focused on improving respiratory health awareness and safety through accessible digital tools, educational resources, and smart health-focused features.

Whether it is air quality awareness, breathing health education, emergency support, or preventive wellness tracking, BreatheSafe aims to create a cleaner, healthier, and safer environment for everyone.


---

Features

Real-time health and safety focused interface

Clean and responsive UI

Mobile-friendly design

Fast and lightweight frontend

Educational and awareness-based sections

Accessibility-focused experience

Beginner-friendly code structure



---

Tech Stack

Frontend

HTML5

CSS3

JavaScript


Deployment

GitHub Pages / Vercel / Netlify



---

Project Structure

BreatheSafe/
│
├── index.html
├── style.css
├── script.js
├── assets/
│   ├── images/
│   └── icons/
├── pages/
└── README.md


---

Getting Started

1. Clone the Repository

git clone https://github.com/iammissmiller/BreatheSafe.git

2. Navigate to the Project Folder

cd BreatheSafe

3. Open the Project

Simply open index.html in your browser.

Or use VS Code Live Server for a better development experience.


---

Screenshots

Add screenshots of your project here.

Example:

![Home Page](assets/images/homepage.png)


---

Future Improvements

Real-time AQI integration

Emergency SOS support

AI-powered respiratory health insights

Health dashboard and analytics

Nearby hospital and pharmacy integration

Multi-language support

User authentication system



---

Contribution Guidelines

Contributions are welcome.

If you would like to contribute:

1. Fork the repository


2. Create a new branch


3. Make your changes


4. Commit your changes


5. Push to your branch


6. Open a Pull Request



git checkout -b feature-name


---

Open Source Programs

This project is beginner-friendly and open for contributions through programs like:

GirlScript Summer of Code (GSSoC)

Hacktoberfest

Open Source Connect



---

License

This project is licensed under the MIT License.


---

Author

Made with dedication by Praptee Miller


---

Support

If you found this project useful:

Star the repository

Fork the project

Share feedback

Contribute improvements



---

Repository Link

BreatheSafe Repository

I made a professional README draft for your  with:

Project overview

Features section

Tech stack

Installation steps

Contribution guide

Future improvements

Open source friendliness

License + author section

Clean GitHub formatting


You can now directly edit/customize it with your actual project details and screenshots.
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
