/* ═══════════════════════════════════════════
   BREATHESAFE — navbar.js
   Injects a consistent navbar on every page.
   Include BEFORE theme.js so the toggle button exists.

   Usage:
     1. Add <div id="navbar-placeholder"></div> at top of <body>
     2. <script src="../js/navbar.js"></script>   (pages/)
        <script src="js/navbar.js"></script>      (root index.html)

   The script detects whether it's running from root or /pages/
   and sets paths accordingly.
═══════════════════════════════════════════ */

(function () {

  /* ── PATH DETECTION ── */
  // If the current page is inside /pages/, prefix with ../
  const inPages = window.location.pathname.includes('/pages/');
  const root    = inPages ? '../' : '';

  /* ── NAVBAR HTML ── */
  const navHTML = `
  <nav class="navbar" id="navbar">
    <a href="${root}index.html" class="nav-logo">BreatheSafe</a>

    <div class="nav-links">
      <a href="${root}index.html#features">Features</a>
      <a href="${root}index.html#hackathon">About</a>
      <a href="${root}index.html#vision">Vision</a>

      <!-- internal page links -->
      <a href="${root}pages/dashboard.html" class="nav-link-dash">Dashboard</a>

      <a href="${root}pages/login.html" class="nav-cta">Sign In</a>

      <!-- theme toggle -->
      <button class="theme-toggle" id="themeBtn" aria-label="Toggle theme">☀️</button>
    </div>
  </nav>`;

  /* ── INJECT ── */
  const placeholder = document.getElementById('navbar-placeholder');
  if (placeholder) {
    placeholder.outerHTML = navHTML;
  } else {
    // fallback: prepend to body
    document.body.insertAdjacentHTML('afterbegin', navHTML);
  }

  /* ── ACTIVE LINK HIGHLIGHT ── */
  const currentPath = window.location.pathname;
  document.querySelectorAll('.navbar a').forEach(link => {
    if (link.href && currentPath.endsWith(link.getAttribute('href'))) {
      link.style.color = 'var(--or)';
    }
  });

})();