/* ═══════════════════════════════════════════
   BREATHESAFE — tour.js
═══════════════════════════════════════════ */

const TOUR_KEY = 'bs-tour-done';

const steps = [
  {
    target: '.panel-left',
    title: 'Your Live Respiratory Status',
    desc: 'Everything here is personalised to you — your health profile, sensitivity level, and today\'s live air quality. The AI insight below your status updates in real time as conditions change around you.',
    side: 'right'
  },
  {
    target: '.icon-btn',
    title: 'Your Alerts',
    desc: 'Live environmental warnings land here. Check these before heading out each day — they update with AQI shifts, wind, humidity and pollen levels in your area.'
  },
  {
    target: '.feature-card:nth-child(1)',
    title: 'Log Your Symptoms First',
    desc: 'Start here every day. Log how you feel — even if you feel fine. The more you log, the smarter your dashboard, insights and analytics become over time.'
  },
  {
    target: '.feature-card:nth-child(2)',
    title: 'Analytics',
    desc: 'Your daily symptom logs become patterns. See exactly when and why your breathing struggles — by time, location, weather or season.'
  },
  {
    target: '.feature-card:nth-child(3)',
    title: 'HelpZone',
    desc: 'Having a breathing emergency? HelpZone generates a real step-by-step action protocol tailored to your symptoms — like a paramedic in your pocket.'
  },
  {
    target: '.feature-card:nth-child(4)',
    title: 'SafeRoute',
    desc: 'Planning to go out? SafeRoute finds the cleanest, lowest-pollution path to your destination so you breathe easier on the way.'
  }
];

const DIMABLE = [
  '.particles', '.navbar', '.panel-left', '.panel-right',
  '.aqi-ring-wrap', '.stats-col',
  '.feature-card:nth-child(1)', '.feature-card:nth-child(2)',
  '.feature-card:nth-child(3)', '.feature-card:nth-child(4)',
  '.insight-box', '.alerts-row', '.env-grid', '.panel-top', '.icon-btn',
];

/* ── STYLES ── */
const style = document.createElement('style');
style.textContent = `
  .tour-dimmed {
    filter: brightness(0.35) !important;
    transition: filter 0.4s ease !important;
    pointer-events: none !important;
  }
  .tour-glow {
    box-shadow:
      0 0 0 3px rgba(198,93,7,0.8),
      0 0 0 8px rgba(198,93,7,0.15),
      0 0 40px rgba(198,93,7,0.35),
      0 0 80px rgba(198,93,7,0.15) !important;
    filter: brightness(1.08) !important;
    transition: box-shadow 0.4s ease, filter 0.4s ease !important;
  }
  .tour-card-el {
    position: fixed;
    width: 340px;
    max-width: calc(100vw - 40px);
    padding: 22px 26px;
    border-radius: 20px;
    background: var(--bg);
    border: 1px solid rgba(198,93,7,0.22);
    box-shadow: 0 12px 60px rgba(0,0,0,0.22), 0 0 0 1px rgba(198,93,7,0.08);
    z-index: 99999;
    opacity: 0;
    transition: opacity 0.3s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1), top 0.4s cubic-bezier(0.22,1,0.36,1), left 0.4s cubic-bezier(0.22,1,0.36,1);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    pointer-events: all;
  }
  .tour-card-el.visible { opacity: 1; }
  .tour-eyebrow {
    font-family: var(--font-sans);
    font-size: 10px; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--or); margin-bottom: 8px; opacity: 0.8;
  }
  .tour-title {
    font-family: var(--font-serif);
    font-size: 20px; font-weight: 300;
    color: var(--wm); margin-bottom: 8px; line-height: 1.2;
  }
  .tour-desc {
    font-family: var(--font-sans);
    font-size: 13px; color: var(--sa);
    font-weight: 300; line-height: 1.75;
    margin-bottom: 18px;
  }
  .tour-footer { display: flex; align-items: center; justify-content: space-between; }
  .tour-dots { display: flex; gap: 6px; align-items: center; }
  .tour-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--bd); transition: all 0.35s ease;
  }
  .tour-dot.active { background: var(--or); width: 20px; border-radius: 3px; }
  .tour-btns { display: flex; gap: 12px; align-items: center; }
  .tour-skip {
    font-size: 12px; color: var(--mu);
    background: none; border: none;
    cursor: pointer; font-family: var(--font-sans);
    transition: color 0.2s; padding: 0;
  }
  .tour-skip:hover { color: var(--sa); }
  .tour-next {
    padding: 8px 20px; border-radius: 100px;
    background: var(--or); color: #fff;
    font-family: var(--font-sans);
    font-size: 13px; font-weight: 500;
    cursor: pointer; border: none;
    transition: all 0.25s ease;
    box-shadow: 0 4px 16px rgba(198,93,7,0.3);
  }
  .tour-next:hover {
    background: #A84D00;
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(198,93,7,0.4);
  }
`;
document.head.appendChild(style);

/* ── BUILD CARD ── */
const card = document.createElement('div');
card.className = 'tour-card-el';
document.body.appendChild(card);

let current = 0;
let prevEl  = null;

/* ── SMART POSITION NEAR ELEMENT ── */
function positionCard(el, side) {
  const r   = el.getBoundingClientRect();
  const cw  = 340;
  const ch  = 220;
  const pad = 16;
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  let top, left;

  if (side === 'right') {
    left = r.right + pad;
    top  = r.top + r.height / 2 - ch / 2;
    top  = Math.max(pad, Math.min(top, vh - ch - pad));
    if (left + cw + pad > vw) left = r.left - cw - pad;
  } else if (side === 'left') {
    left = r.left - cw - pad;
    top  = r.top + r.height / 2 - ch / 2;
    top  = Math.max(pad, Math.min(top, vh - ch - pad));
    if (left < pad) left = r.right + pad;
  } else {
    if (r.bottom + ch + pad < vh) {
      top = r.bottom + pad;
    } else if (r.top - ch - pad > 0) {
      top = r.top - ch - pad;
    } else {
      top = vh / 2 - ch / 2;
    }
    left = r.left + r.width / 2 - cw / 2;
    left = Math.max(pad, Math.min(left, vw - cw - pad));
  }

  card.style.top  = top  + 'px';
  card.style.left = left + 'px';
}

/* ── DIM ── */
function applyDim(targetEl) {
  clearDim();
  DIMABLE.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (el !== targetEl && !el.contains(targetEl) && !targetEl.contains(el)) {
        el.classList.add('tour-dimmed');
      }
    });
  });
}
function clearDim() {
  document.querySelectorAll('.tour-dimmed').forEach(el => el.classList.remove('tour-dimmed'));
}

/* ── RENDER STEP ── */
function renderStep(index) {
  const step = steps[index];
  const el   = document.querySelector(step.target);

  if (prevEl) prevEl.classList.remove('tour-glow');
  if (!el) { advanceStep(); return; }

  el.classList.add('tour-glow');
  prevEl = el;
  applyDim(el);

  // position card near element
  positionCard(el, step.side);

  const dots   = steps.map((_, i) => `<div class="tour-dot ${i === index ? 'active' : ''}"></div>`).join('');
  const isLast = index === steps.length - 1;

  card.classList.remove('visible');
  setTimeout(() => {
    card.innerHTML = `
      <p class="tour-eyebrow">Step ${index + 1} of ${steps.length}</p>
      <h3 class="tour-title">${step.title}</h3>
      <p class="tour-desc">${step.desc}</p>
      <div class="tour-footer">
        <div class="tour-dots">${dots}</div>
        <div class="tour-btns">
          <button class="tour-skip" id="tSkip">Skip tour</button>
          <button class="tour-next" id="tNext">${isLast ? 'Done ✓' : 'Next →'}</button>
        </div>
      </div>
    `;
    card.classList.add('visible');
    document.getElementById('tNext').addEventListener('click', advanceStep);
    document.getElementById('tSkip').addEventListener('click', endTour);
  }, 160);
}

/* ── ADVANCE ── */
function advanceStep() {
  current++;
  if (current >= steps.length) { endTour(); return; }
  renderStep(current);
}

/* ── END ── */
function endTour() {
  if (prevEl) prevEl.classList.remove('tour-glow');
  clearDim();
  card.classList.remove('visible');
  setTimeout(() => card.remove(), 400);
  localStorage.setItem(TOUR_KEY, '1');
}

/* ── INIT ── */
if (!localStorage.getItem(TOUR_KEY)) {
  setTimeout(() => renderStep(0), 1200);
}