/* ═══════════════════════════════════════════
   BREATHESAFE — navbar.js
   Landing page → marketing navbar
   App pages (/pages/) → app navbar with all feature links
═══════════════════════════════════════════ */

(function () {

  const inPages = window.location.pathname.includes('/pages/');
  const root    = inPages ? '../' : '';
  const page    = window.location.pathname.split('/').pop();

  /* ── APP NAVBAR (saferoute, helpzone, symptoms, analytics) ── */
  const appNavHTML = `
  <nav class="navbar" id="navbar">
    <a href="${root}index.html" class="nav-logo">BreatheSafe</a>

    <div class="nav-links">
      <a href="${root}pages/dashboard.html"  class="nav-app-link" data-page="dashboard.html">Dashboard</a>
      <a href="${root}pages/saferoute.html"  class="nav-app-link" data-page="saferoute.html">SafeRoute</a>
      <a href="${root}pages/symptoms.html"   class="nav-app-link" data-page="symptoms.html">Symptoms</a>
      <a href="${root}pages/analytics.html"  class="nav-app-link" data-page="analytics.html">Analytics</a>
      <a href="${root}pages/helpzone.html"   class="nav-app-link" data-page="helpzone.html">HelpZone</a>
      <button class="theme-toggle" id="themeBtn" aria-label="Toggle theme">☀️</button>
    </div>
  </nav>`;

  /* ── LANDING NAVBAR ── */
  const landingNavHTML = `
  <nav class="navbar" id="navbar">
    <a href="${root}index.html" class="nav-logo">BreatheSafe</a>

    <div class="nav-links">
      <a href="${root}index.html#features">Features</a>
      <a href="${root}index.html#hackathon">About</a>
      <a href="${root}index.html#vision">Vision</a>
      <a href="${root}pages/login.html" class="nav-cta">Get Started</a>
      <button class="theme-toggle" id="themeBtn" aria-label="Toggle theme">☀️</button>
    </div>
  </nav>`;

  const navHTML = inPages ? appNavHTML : landingNavHTML;

  /* ── INJECT ── */
  const placeholder = document.getElementById('navbar-placeholder');
  if (placeholder) {
    placeholder.outerHTML = navHTML;
  } else {
    document.body.insertAdjacentHTML('afterbegin', navHTML);
  }

  /* ── ACTIVE LINK HIGHLIGHT ── */
  document.querySelectorAll('.nav-app-link').forEach(link => {
    if (link.dataset.page === page) {
      link.style.color     = 'var(--or)';
      link.style.fontWeight = '600';
    }
  });

})();