import { saveEpisode as saveEpisodeFirestore } from './db.js';

// helpzone.js — BreatheSafe HelpZone v3
// Multi-select triggers + Groq step-by-step guided protocol

(function () {
  'use strict';

  const GROQ_URL   = '/api/groq';
  const GROQ_MODEL = 'llama-3.1-8b-instant';

  // ── FALLBACK steps if Groq fails ─────────────────────────
  const FALLBACK = {
    title: 'Breathing Recovery Protocol',
    intro: 'Follow these steps in order. Take your time with each one.',
    steps: [
      { action: 'Stop and sit down',           desc: 'Find the nearest seat or floor. Lower your centre of gravity immediately. Do not stay standing.',                    duration: 0  },
      { action: 'Loosen clothing',              desc: 'Unbutton collar, loosen belt or waistband. Remove anything tight around your chest or neck.',                       duration: 0  },
      { action: 'Pursed-lip breathing',         desc: 'Inhale slowly through your nose for 2 seconds. Pucker your lips and exhale for 4 seconds. Repeat 5 times.',        duration: 60 },
      { action: 'Tripod position',              desc: 'Lean forward, place hands on knees or a table. This opens your airways by reducing pressure on your diaphragm.',   duration: 0  },
      { action: 'Use rescue inhaler if you have one', desc: 'Take 1 puff, wait 30 seconds, take a second if needed. Shake well before each puff.',                         duration: 0  },
      { action: 'Drink water slowly',           desc: 'Small sips of room temperature water. Do not gulp. Hydration helps thin mucus and soothe airways.',                duration: 0  },
      { action: 'Monitor for 10 minutes',       desc: 'Stay seated. If symptoms worsen or you feel chest pain, call emergency services immediately.',                      duration: 600},
    ],
  };

  // ── PROFILE ─────────────────────────────────────────────
  function getProfile() {
    return {
      name:        localStorage.getItem('bs-name') || 'unknown',
      age:         localStorage.getItem('bs-age') || 'unknown',
      conditions:  localStorage.getItem('bs-conditions') || 'none',
      sensitivity: localStorage.getItem('bs-sensitivity') || 'medium',
      smoke:       localStorage.getItem('bs-smoke') || 'no',
      outdoors:    localStorage.getItem('bs-outdoors') || 'sometimes',
      concern:     localStorage.getItem('bs-concern') || 'general',
    };
  }

  function getRecentLog() {
    try {
      const logs = JSON.parse(localStorage.getItem('bs-logs') || '[]');
      return logs[logs.length - 1] || null;
    } catch { return null; }
  }

  // Load profile pill
  (function loadPill() {
    const p   = getProfile();
    const txt = document.getElementById('hz-profile-text');
    if (!txt) return;
    const parts = [];
    if (p.name !== 'unknown') parts.push(p.name);
    if (p.conditions !== 'none') parts.push(p.conditions);
    parts.push(`${p.sensitivity} sensitivity`);
    txt.textContent = parts.join(' · ');
  })();

  // ── DOM ─────────────────────────────────────────────────
  const goBtn       = document.getElementById('hz-go-btn');
  const resetBtn    = document.getElementById('hz-reset-btn');
  const nextBtn     = document.getElementById('hz-next-btn');
  const skipBtn     = document.getElementById('hz-skip-btn');
  const doneBtn     = document.getElementById('hz-done-btn');

  // ── TRIGGER MULTI-SELECT ─────────────────────────────────
  const selectedTriggers = new Set();

  document.querySelectorAll('.hz-trigger').forEach(card => {
    card.addEventListener('click', () => {
      const t = card.dataset.t;
      if (selectedTriggers.has(t)) {
        selectedTriggers.delete(t);
        card.classList.remove('selected');
      } else {
        selectedTriggers.add(t);
        card.classList.add('selected');
      }
      goBtn.disabled = selectedTriggers.size === 0;
    });
  });

  // ── STEP MANAGEMENT ─────────────────────────────────────
  function showLeftStep(id) {
    document.querySelectorAll('.hz-step').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function showRightPanel(id) {
    document.getElementById('hz-idle').style.display     = 'none';
    document.getElementById('hz-protocol').style.display = 'none';
    document.getElementById('hz-done').style.display     = 'none';
    document.getElementById('hz-protocol').classList.remove('active');
    document.getElementById('hz-done').classList.remove('active');

    const el = document.getElementById(id);
    el.style.display = 'flex';
    el.classList.add('active');
  }

  // ── LOADING ANIMATION ────────────────────────────────────
  function runLoadingAnim() {
    return new Promise(resolve => {
      const rows = ['hz-a0','hz-a1','hz-a2','hz-a3'];
      rows.forEach((id, i) => {
        setTimeout(() => document.getElementById(id).classList.add('lit'), i * 480);
        setTimeout(() => {
          document.getElementById(id).classList.remove('lit');
          document.getElementById(id).classList.add('done');
        }, i * 480 + 440);
      });
      setTimeout(resolve, rows.length * 480 + 200);
    });
  }

  // ── GROQ FETCH ───────────────────────────────────────────
  async function fetchProtocol(triggers, note) {
    const p   = getProfile();
    const log = getRecentLog();

    const triggerLabels = {
      asthma:    'Asthma episode (wheezing, tight chest)',
      panic:     "Breathing attack (can't catch breath, gasping)",
      anxiety:   'Anxiety / stress (shallow fast breathing)',
      pollution: 'Dust/smoke exposure (environmental irritant)',
      dizzy:     'Dizziness / hyperventilation (lightheaded)',
    };

    const triggerStr = [...triggers].map(t => triggerLabels[t] || t).join(', ');
    const logStr     = log
      ? `Last logged: comfort ${log.comfort}/10, symptoms: ${(log.symptoms||[]).map(s=>s.name).join(', ') || 'none'}, trigger: ${log.trigger || 'unknown'}`
      : 'No recent log.';

    const prompt = `You are an emergency breathing relief assistant for BreatheSafe. A user is having an episode RIGHT NOW and needs a real, physical, step-by-step action protocol.

User profile:
- Name: ${p.name}, Age: ${p.age}
- Respiratory conditions: ${p.conditions}
- Smoker: ${p.smoke}, Sensitivity: ${p.sensitivity}
- Recent episode data: ${logStr}

Current triggers: ${triggerStr}
User note: ${note || 'none'}

Generate a PRACTICAL step-by-step action protocol. Steps must be PHYSICAL ACTIONS — body positions, breathing techniques with exact counts, medication instructions, environmental changes, recovery monitoring. NOT motivational phrases or therapy. Think like a paramedic giving instructions.

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "title": "Short protocol name e.g. 'Asthma + Anxiety Recovery Protocol'",
  "intro": "One sentence personalised to their profile explaining the approach.",
  "steps": [
    {
      "action": "Short action title (4-7 words)",
      "desc": "Exact physical instruction. What to do with hands, body, breath. Be specific. 2-3 sentences.",
      "duration": 0
    }
  ]
}

Rules:
- 5 to 7 steps total
- duration is seconds for timed steps (e.g. 60 for 1 min breathing exercise), 0 for instant steps
- First step should always be immediate physical positioning (sit, stop, lie down)
- Include a medication step if they have asthma or conditions
- Last step should always be a monitoring/recovery step
- Be direct and calm. No fluff. Real actions only.`;

    const res  = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return JSON.parse(text);
  }

  // ── PROTOCOL RENDERING ───────────────────────────────────
  let protocol    = null;
  let currentStep = -1; // -1 = not started
  let timerInterval = null;

  function renderProtocol(data) {
    protocol    = data;
    currentStep = -1;

    document.getElementById('hz-proto-eyebrow').textContent = `${protocol.steps.length}-Step Action Plan`;
    document.getElementById('hz-proto-title').textContent   = protocol.title;
    document.getElementById('hz-proto-intro').textContent   = protocol.intro;
    document.getElementById('hz-progress-fill').style.width = '0%';
    nextBtn.textContent = 'Start →';

    const list = document.getElementById('hz-steps-list');
    list.innerHTML = '';

    protocol.steps.forEach((step, i) => {
      const card = document.createElement('div');
      card.className = 'hz-step-card';
      card.id = `hz-sc-${i}`;

      const hasDuration = step.duration > 0;

      card.innerHTML = `
        <div class="hz-step-num" id="hz-sn-${i}">${i + 1}</div>
        <div class="hz-step-body">
          <div class="hz-step-action">${step.action}</div>
          <div class="hz-step-desc">${step.desc}</div>
          ${hasDuration ? `
          <div class="hz-step-timer" id="hz-st-${i}">
            <span class="hz-timer-count" id="hz-tc-${i}">${formatTime(step.duration)}</span>
            <div class="hz-timer-bar">
              <div class="hz-timer-fill" id="hz-tf-${i}" style="width:100%"></div>
            </div>
          </div>` : ''}
        </div>`;

      list.appendChild(card);
    });

    showRightPanel('hz-protocol');
  }

  function formatTime(secs) {
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs/60)}m ${secs%60 > 0 ? (secs%60)+'s' : ''}`.trim();
  }

  function advanceStep() {
    clearTimer();

    // Mark previous as complete
    if (currentStep >= 0) {
      const prev = document.getElementById(`hz-sc-${currentStep}`);
      if (prev) {
        prev.classList.remove('current');
        prev.classList.add('completed');
        document.getElementById(`hz-sn-${currentStep}`).textContent = '✓';
      }
    }

    currentStep++;

    // All done
    if (currentStep >= protocol.steps.length) {
      showDone();
      return;
    }

    // Activate current
    const card = document.getElementById(`hz-sc-${currentStep}`);
    if (card) {
      card.classList.add('current');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Update progress
    const pct = (currentStep / protocol.steps.length) * 100;
    document.getElementById('hz-progress-fill').style.width = `${pct}%`;

    // Update button
    const isLast = currentStep === protocol.steps.length - 1;
    nextBtn.textContent = isLast ? 'Complete ✓' : 'Next step →';

    // Start timer if this step has duration
    const step = protocol.steps[currentStep];
    if (step.duration > 0) {
      startTimer(step.duration, currentStep);
    }
  }

  function startTimer(totalSecs, stepIndex) {
    let remaining = totalSecs;
    const countEl = document.getElementById(`hz-tc-${stepIndex}`);
    const fillEl  = document.getElementById(`hz-tf-${stepIndex}`);
    if (!countEl || !fillEl) return;

    timerInterval = setInterval(() => {
      remaining--;
      if (countEl) countEl.textContent = formatTime(remaining);
      if (fillEl)  fillEl.style.width  = `${(remaining / totalSecs) * 100}%`;

      if (remaining <= 0) {
        clearTimer();
        // Auto-pulse next button to draw attention
        nextBtn.style.animation = 'none';
        nextBtn.style.background = '#27ae60';
        setTimeout(() => { nextBtn.style.background = ''; }, 1500);
      }
    }, 1000);
  }

  function clearTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  async function showDone() {
    clearTimer();
    document.getElementById('hz-progress-fill').style.width = '100%';
    const triggers = [...selectedTriggers].join(', ');
    document.getElementById('hz-done-msg').textContent =
      `You completed all ${protocol.steps.length} steps for ${triggers}. Rest for a moment and consider logging this in Symptoms.`;

    // Save episode to localStorage
    await saveEpisode([...selectedTriggers], protocol.steps.length);

    // Hide protocol, show done
    document.getElementById('hz-protocol').classList.remove('active');
    document.getElementById('hz-protocol').style.display = 'none';
    document.getElementById('hz-done').style.display     = 'flex';
    document.getElementById('hz-done').classList.add('active');

    showLeftStep('hz-s2');
  }

  async function saveEpisode(triggers, stepsCompleted) {
    const episode = {
      date:           new Date().toISOString().split('T')[0],
      time:           new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      triggers,
      stepsCompleted,
    };
    await saveEpisodeFirestore(episode).catch(e => console.warn('Episode save:', e));
  }

  // ── GO BUTTON ────────────────────────────────────────────
  goBtn.addEventListener('click', async () => {
    if (selectedTriggers.size === 0) return;
    const note = document.getElementById('hz-note').value.trim();

    goBtn.classList.add('loading');
    goBtn.disabled = true;
    showLeftStep('hz-s1');

    const [animResult, groqResult] = await Promise.allSettled([
      runLoadingAnim(),
      fetchProtocol(selectedTriggers, note),
    ]);

    const data = groqResult.status === 'fulfilled' ? groqResult.value : FALLBACK;

    renderProtocol(data);
    goBtn.classList.remove('loading');
  });

  // ── NEXT / SKIP ──────────────────────────────────────────
  nextBtn.addEventListener('click', advanceStep);
  skipBtn.addEventListener('click', advanceStep);

  // ── RESET ────────────────────────────────────────────────
  async function doReset() {
    clearTimer();
    // Save partial episode if steps were started
    if (protocol && currentStep > 0) {
      await saveEpisode([...selectedTriggers], currentStep);
    }
    selectedTriggers.clear();
    protocol    = null;
    currentStep = -1;

    document.querySelectorAll('.hz-trigger').forEach(c => c.classList.remove('selected'));
    document.getElementById('hz-note').value = '';
    goBtn.disabled = true;
    goBtn.classList.remove('loading');

    ['hz-a0','hz-a1','hz-a2','hz-a3'].forEach(id =>
      document.getElementById(id).classList.remove('lit','done'));

    // Reset right panel
    document.getElementById('hz-protocol').classList.remove('active');
    document.getElementById('hz-done').classList.remove('active');
    document.getElementById('hz-protocol').style.display = 'none';
    document.getElementById('hz-done').style.display     = 'none';
    document.getElementById('hz-idle').style.display     = 'flex';

    showLeftStep('hz-s0');
  }

  if (resetBtn) resetBtn.addEventListener('click', () => doReset());
  if (doneBtn)  doneBtn.addEventListener('click',  () => doReset());

  // Back button from protocol to trigger selection
  const backBtn = document.getElementById('hz-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      clearTimer();
      document.getElementById('hz-protocol').classList.remove('active');
      document.getElementById('hz-protocol').style.display = 'none';
      document.getElementById('hz-idle').style.display = 'flex';
      // Reset loading animation rows
      ['hz-a0','hz-a1','hz-a2','hz-a3'].forEach(id =>
        document.getElementById(id).classList.remove('lit','done'));
      showLeftStep('hz-s0');
      protocol    = null;
      currentStep = -1;
      goBtn.disabled = selectedTriggers.size === 0;
      goBtn.classList.remove('loading');
    });
  }

})();