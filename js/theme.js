/* ═══════════════════════════════════════════
   BREATHESAFE — theme.js
   Include on every page.
   Handles: load saved theme, toggle, save, navbar bg update.

   Usage in HTML:
     <script src="../js/theme.js"></script>   (pages/)
     <script src="js/theme.js"></script>      (root index.html)
═══════════════════════════════════════════ */

(function () {

  /* ── APPLY SAVED THEME ON LOAD (before paint) ── */
  const saved = localStorage.getItem('bs-theme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
  }
  // light is default — no class needed

  /* ── UPDATE TOGGLE BUTTON ICON ── */
  function syncIcon() {
    const btn = document.getElementById('themeBtn');
    if (!btn) return;
    btn.textContent = document.body.classList.contains('dark') ? '🌙' : '☀️';
    btn.setAttribute('title', document.body.classList.contains('dark') ? 'Switch to light mode' : 'Switch to dark mode');
  }

  /* ── UPDATE NAVBAR BACKGROUND ── */
  function updateNavBg() {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    const dark    = document.body.classList.contains('dark');
    const scrolled = window.scrollY > 40;
    if (dark) {
      nav.style.background = scrolled ? 'rgba(17,16,16,0.97)' : 'rgba(17,16,16,0.72)';
    } else {
      nav.style.background = scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.82)';
    }
  }

  /* ── TOGGLE HANDLER ── */
  function attachToggle() {
    const btn = document.getElementById('themeBtn');
    if (!btn) return;

    syncIcon();

    btn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const isDark = document.body.classList.contains('dark');
      localStorage.setItem('bs-theme', isDark ? 'dark' : 'light');
      syncIcon();
      updateNavBg();
    });
  }

  /* ── SCROLL LISTENER ── */
  window.addEventListener('scroll', updateNavBg);

  /* ── INIT ── */
  // If DOM is already ready, attach now; otherwise wait.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      attachToggle();
      updateNavBg();
    });
  } else {
    attachToggle();
    updateNavBg();
  }

})();