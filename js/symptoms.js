/* ═══════════════════════════════════════════
   BREATHESAFE — symptoms.js
   Saves bs-logs: [{ date, comfort, symptoms:
   [{name, severity}], timeOfDay, trigger }]
═══════════════════════════════════════════ */

const name   = localStorage.getItem('bs-name') || null;
const avatar = document.getElementById('avatar');
const today  = new Date().toISOString().split('T')[0];

avatar.textContent = name ? name.charAt(0).toUpperCase() : '?';

document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

/* ── LOGS ── */
function getLogs() {
  try { return JSON.parse(localStorage.getItem('bs-logs')) || []; }
  catch { return []; }
}
function saveLogs(logs) { localStorage.setItem('bs-logs', JSON.stringify(logs)); }

/* ── CHECK TODAY ── */
const logs     = getLogs();
const todayLog = logs.find(l => l.date === today);

if (todayLog) {
  document.getElementById('logForm').style.display      = 'none';
  document.getElementById('alreadyLogged').style.display = 'flex';
  document.getElementById('updateBtn').addEventListener('click', () => {
    document.getElementById('alreadyLogged').style.display = 'none';
    document.getElementById('logForm').style.display       = 'flex';
    prefill(todayLog);
  });
}

/* ── PREFILL ── */
function prefill(log) {
  document.getElementById('comfortSlider').value  = log.comfort;
  document.getElementById('sliderVal').textContent = log.comfort;
  if (log.timeOfDay) {
    const btn = document.querySelector(`#timeOfDay [data-val="${log.timeOfDay}"]`);
    if (btn) btn.classList.add('selected');
  }
  if (log.trigger) {
    const btn = document.querySelector(`#trigger [data-val="${log.trigger}"]`);
    if (btn) btn.classList.add('selected');
  }
  log.symptoms.forEach(sym => {
    const row = document.querySelector(`[data-sym="${sym.name}"]`);
    if (!row) return;
    row.classList.add('active');
    row.querySelector('.severity-row').style.display = 'flex';
    const sevBtn = row.querySelector(`[data-sev="${sym.severity}"]`);
    if (sevBtn) sevBtn.classList.add('selected');
  });
}

/* ── SLIDER ── */
const slider    = document.getElementById('comfortSlider');
const sliderVal = document.getElementById('sliderVal');
slider.addEventListener('input', () => sliderVal.textContent = slider.value);

/* ── SINGLE SELECT PILLS ── */
function singleSelect(groupId) {
  document.querySelectorAll(`#${groupId} .pill-btn`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`#${groupId} .pill-btn`).forEach(b => b.classList.remove('selected'));
      btn.classList.toggle('selected');
    });
  });
}
singleSelect('timeOfDay');
singleSelect('trigger');

/* ── SYMPTOM TOGGLE + SEVERITY ── */
document.querySelectorAll('.sym-row').forEach(row => {
  const toggle   = row.querySelector('.sym-toggle');
  const sevRow   = row.querySelector('.severity-row');

  toggle.addEventListener('click', () => {
    const active = row.classList.toggle('active');
    sevRow.style.display = active ? 'flex' : 'none';
    if (!active) {
      sevRow.querySelectorAll('.sev-btn').forEach(b => b.classList.remove('selected'));
    }
  });

  sevRow.querySelectorAll('.sev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sevRow.querySelectorAll('.sev-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
});

/* ── SUBMIT ── */
document.getElementById('submitBtn').addEventListener('click', saveEntry);

function saveEntry() {
  const comfort = parseInt(slider.value);

  const symptoms = [...document.querySelectorAll('.sym-row.active')].map(row => ({
    name:     row.dataset.sym,
    severity: row.querySelector('.sev-btn.selected')?.dataset.sev || 'Mild'
  }));

  const timeOfDay = document.querySelector('#timeOfDay .pill-btn.selected')?.dataset.val || null;
  const trigger   = document.querySelector('#trigger .pill-btn.selected')?.dataset.val   || null;

  const entry = { date: today, comfort, symptoms, timeOfDay, trigger };

  const existing = getLogs().filter(l => l.date !== today);
  existing.push(entry);
  saveLogs(existing);

  showConfirm(comfort, symptoms, timeOfDay, trigger);
}

/* ── CONFIRM ── */
function showConfirm(comfort, symptoms, timeOfDay, trigger) {
  document.getElementById('confirmName').textContent = name || 'there';

  const tags = [`Comfort ${comfort}/10`];
  symptoms.forEach(s => tags.push(`${s.name} — ${s.severity}`));
  if (timeOfDay) tags.push(`Felt most: ${timeOfDay}`);
  if (trigger)   tags.push(`Trigger: ${trigger}`);

  document.getElementById('confirmTags').innerHTML =
    tags.map(t => `<span class="confirm-tag">${t}</span>`).join('');

  document.getElementById('confirmScreen').classList.add('active');
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 3500);
}