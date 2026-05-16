/* ═══════════════════════════════════════════
   BREATHESAFE — dashboard.js
═══════════════════════════════════════════ */

/* ── PROFILE ── */
const profile = {
  name:        localStorage.getItem('bs-name')                  || null,
  comfort:     parseInt(localStorage.getItem('bs-comfort'))     || 5,
  conditions:  localStorage.getItem('bs-conditions')            || 'None',
  smoke:       localStorage.getItem('bs-smoke')                 || 'No',
  sensitivity: parseInt(localStorage.getItem('bs-sensitivity')) || 5,
  outdoors:    localStorage.getItem('bs-outdoors')              || 'Under 1 hour',
  concern:     localStorage.getItem('bs-concern')               || null
};

const quizDone = !!localStorage.getItem('bs-name');

/* ── LOGS ── */
function getLogs() {
  try { return JSON.parse(localStorage.getItem('bs-logs')) || []; }
  catch { return []; }
}
function getLatestLog() {
  const logs = getLogs();
  return logs.length ? logs[logs.length - 1] : null;
}
function symNames(log) {
  if (!log || !log.symptoms) return [];
  return log.symptoms.map(s => typeof s === 'object' ? s.name : s);
}
function symSeverity(log, name) {
  if (!log || !log.symptoms) return null;
  const sym = log.symptoms.find(s => (typeof s === 'object' ? s.name : s) === name);
  return sym?.severity || null;
}

/* ── ELEMENTS ── */
const greeting       = document.getElementById('greeting');
const avatar         = document.getElementById('avatar');
const riskStatus     = document.getElementById('risk-status');
const heroDesc       = document.getElementById('hero-description');
const locationName   = document.getElementById('location-name');
const aqiPill        = document.getElementById('aqi-pill');
const aqiNumber      = document.getElementById('aqi-number');
const aqiLabel       = document.getElementById('aqi-label');
const ringFill       = document.getElementById('ringFill');
const tempValue      = document.getElementById('temp-value');
const humidityValue  = document.getElementById('humidity-value');
const windValue      = document.getElementById('wind-value');
const uvValue        = document.getElementById('uv-value');
const breathingScore = document.getElementById('breathing-score');
const lungStress     = document.getElementById('lung-stress');
const outdoorSafety  = document.getElementById('outdoor-safety');
const aiInsight      = document.getElementById('ai-insight');
const alert1         = document.getElementById('alert-1');
const alert2         = document.getElementById('alert-2');

/* ── GREETING ── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

const nameStr = profile.name ? `, ${profile.name}` : '';
greeting.textContent = `${getGreeting()}${nameStr}`;
avatar.textContent   = profile.name ? profile.name.charAt(0).toUpperCase() : '?';

/* ── EMPTY STATE ── */
if (!quizDone) {
  heroDesc.textContent  = 'Complete your respiratory profile to get personalised insights. Tap to set it up.';
  heroDesc.style.cursor = 'pointer';
  heroDesc.style.color  = 'var(--or)';
  heroDesc.addEventListener('click', () => window.location.href = 'quiz.html');
}

/* ── BASE SCORE ── */
function computeBaseScore() {
  let score = 80;
  if (profile.conditions === 'Asthma' || profile.conditions === 'COPD') score -= 20;
  if (profile.conditions === 'Allergies') score -= 10;
  if (profile.sensitivity >= 7) score -= 10;
  if (profile.smoke === 'Yes') score -= 10;
  if (profile.smoke === 'Sometimes') score -= 5;
  if (profile.comfort <= 3) score -= 12;
  if (profile.outdoors === '3 hours+') score -= 8;
  return Math.max(10, Math.min(100, score));
}

/* ── AQI META ── */
function aqiMeta(aqi) {
  if (aqi === 1) return { label: 'Good',      risk: 'Low Respiratory Risk',      color: '#4CAF50', offset: 100 };
  if (aqi === 2) return { label: 'Fair',       risk: 'Moderate Respiratory Risk', color: '#FFC107', offset: 200 };
  if (aqi === 3) return { label: 'Moderate',   risk: 'Elevated Respiratory Risk', color: '#FF9800', offset: 320 };
  if (aqi === 4) return { label: 'Poor',       risk: 'High Respiratory Risk',     color: '#F44336', offset: 420 };
  return               { label: 'Very Poor',   risk: 'Critical Respiratory Risk', color: '#9C27B0', offset: 490 };
}

/* ── ANIMATE RING ── */
function animateRing(offset, color) {
  ringFill.style.stroke = color;
  ringFill.style.strokeDashoffset = 502 - offset;
}

/* ── AI INSIGHT — Groq powered ── */
async function buildInsight(aqi, aqiText, weatherData) {
  const log         = getLatestLog();
  const names       = symNames(log);
  const today       = new Date().toISOString().split('T')[0];
  const loggedToday = log?.date === today;

  const prompt = `You are a respiratory health AI assistant inside an app called BreatheSafe.
Write a 2-3 sentence personalised respiratory insight for this user. Be warm, direct, and specific. No generic advice.

User Profile:
- Name: ${profile.name || 'User'}
- Conditions: ${profile.conditions}
- Smoke exposure: ${profile.smoke}
- Air sensitivity: ${profile.sensitivity}/10
- Time outdoors daily: ${profile.outdoors}
- Personal concern: ${profile.concern || 'General air quality'}

Live Environment:
- AQI: ${aqi} (${aqiText})
- Temperature: ${Math.round(weatherData.main.temp)}°C
- Humidity: ${weatherData.main.humidity}%
- Wind: ${Math.round(weatherData.wind.speed)} km/h

${loggedToday && names.length > 0
  ? `Today's Symptom Log:
- Overall comfort: ${log.comfort}/10
- Symptoms: ${names.map(n => n + ' (' + (log.symptoms.find(s => s.name === n)?.severity || 'Mild') + ')').join(', ')}
- Time felt worst: ${log.timeOfDay || 'Not specified'}
- Trigger: ${log.trigger || 'Not specified'}`
  : 'No symptoms logged today yet.'}

Write the insight now. 2-3 sentences only. No bullet points. No markdown.`;

  try {
    aiInsight.textContent = 'Generating insight...';

    const res  = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    aiInsight.textContent = text || 'Unable to generate insight right now.';

  } catch (err) {
    console.error('Groq error:', err);
    aiInsight.textContent = 'AI insight unavailable. Check your connection.';
  }
}

/* ── STAT COLOR ── */
function scoreColor(score) {
  if (score >= 70) return 'stat-green';
  if (score >= 50) return 'stat-amber';
  if (score >= 35) return 'stat-orange';
  return 'stat-red';
}

/* ── BUILD STATS ── */
function buildStats(aqi) {
  let score = computeBaseScore();
  if (aqi === 3) score -= 8;
  if (aqi === 4) score -= 18;
  if (aqi === 5) score -= 28;

  const log   = getLatestLog();
  const names = symNames(log);
  const today = new Date().toISOString().split('T')[0];

  if (log && log.date === today) {
    if (log.comfort <= 3)                  score -= 15;
    else if (log.comfort <= 5)             score -= 8;
    if (names.includes('Breathlessness'))  score -= 10;
    if (names.includes('Chest Tightness')) score -= 8;
    if (names.includes('Wheezing'))        score -= 6;
    if (names.includes('Coughing'))        score -= 4;
    names.forEach(n => {
      if (symSeverity(log, n) === 'Severe')   score -= 5;
      if (symSeverity(log, n) === 'Moderate') score -= 2;
    });
  }

  score = Math.max(5, Math.min(100, score));

  let stress, safety, stressColor, safetyColor;
  if (score >= 70) {
    stress = 'Low';      stressColor = 'stat-green';
    safety = 'Safe';     safetyColor = 'stat-green';
  } else if (score >= 50) {
    stress = 'Moderate'; stressColor = 'stat-amber';
    safety = 'Caution';  safetyColor = 'stat-amber';
  } else if (score >= 35) {
    stress = 'Elevated';       stressColor = 'stat-orange';
    safety = 'Limit Exposure'; safetyColor = 'stat-orange';
  } else {
    stress = 'High';   stressColor = 'stat-red';
    safety = 'Unsafe'; safetyColor = 'stat-red';
  }

  breathingScore.textContent = score;
  breathingScore.className   = `stat-val ${scoreColor(score)}`;
  lungStress.textContent     = stress;
  lungStress.className       = `stat-val ${stressColor}`;
  outdoorSafety.textContent  = safety;
  outdoorSafety.className    = `stat-val ${safetyColor}`;
}

/* ── ALERTS ── */
function buildAlerts(aqi, weatherData) {
  const humidity    = weatherData.main.humidity;
  const wind        = weatherData.wind.speed;
  const log         = getLatestLog();
  const names       = symNames(log);
  const today       = new Date().toISOString().split('T')[0];
  const loggedToday = log?.date === today;

  alert1.textContent = aqi >= 3
    ? `AQI is ${aqi >= 4 ? 'dangerously' : 'moderately'} elevated in your area`
    : '✓ Air quality is acceptable right now';

  if (loggedToday && names.some(n => symSeverity(log, n) === 'Severe')) {
    alert2.textContent = 'Severe symptoms logged today — rest and avoid outdoor exposure';
  } else if (profile.conditions === 'Asthma' && humidity > 70) {
    alert2.textContent = 'High humidity may trigger asthma symptoms';
  } else if (wind > 20) {
    alert2.textContent = 'Strong winds — pollen and dust dispersal elevated';
  } else if (aqi >= 4) {
    alert2.textContent = 'Reduce prolonged outdoor exposure today';
  } else if (!loggedToday) {
    alert2.textContent = '📋 You haven\'t logged your symptoms today yet';
  } else {
    alert2.textContent = '✓ Symptoms logged — dashboard is up to date';
  }
}

/* ── LOCATING PULSE ── */
locationName.classList.add('locating');

/* ── FETCH ── */
navigator.geolocation.getCurrentPosition(async (position) => {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;

  try {
    const wRes  = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
    const wData = await wRes.json();

    locationName.classList.remove('locating');
    locationName.textContent  = `📍 ${wData.name}`;
    tempValue.textContent     = `${Math.round(wData.main.temp)}°C`;
    humidityValue.textContent = `${wData.main.humidity}%`;
    windValue.textContent     = `${Math.round(wData.wind.speed)} km/h`;

    const uvRes  = await fetch(`https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
    const uvData = await uvRes.json();
    uvValue.textContent = uvData.value !== undefined ? uvData.value.toFixed(1) : '—';

    const aRes  = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
    const aData = await aRes.json();
    const aqi   = aData.list[0].main.aqi;
    const meta  = aqiMeta(aqi);

    aqiPill.textContent    = `AQI ${aqi} • ${meta.label}`;
    aqiNumber.textContent  = aqi;
    aqiLabel.textContent   = meta.label;
    riskStatus.textContent = meta.risk;

    // Trigger AQI alert if needed
    if (window._addAQIAlert) window._addAQIAlert(aqi, meta.label);

    if (quizDone) await buildInsight(aqi, meta.label, wData);

    animateRing(meta.offset, meta.color);
    buildStats(aqi);
    buildAlerts(aqi, wData);

  } catch (err) {
    console.error('BreatheSafe API error:', err);
    locationName.classList.remove('locating');
    heroDesc.textContent = 'Could not fetch environmental data. Check your connection.';
  }

}, () => {
  locationName.classList.remove('locating');
  locationName.textContent = '📍 Location unavailable';
  heroDesc.textContent     = 'Enable location access to see your live air quality data.';
});
/* ── ALERT BELL ── */
(function initAlerts() {
  const alertBtn      = document.getElementById('alertBtn');
  const alertDropdown = document.getElementById('alertDropdown');
  const alertBadge    = document.getElementById('alertBadge');
  const alertList     = document.getElementById('alertList');
  const alertClearBtn = document.getElementById('alertClearBtn');

  if (!alertBtn) return;

  const today    = new Date().toISOString().split('T')[0];
  const alerts   = [];

  // 1. Profile incomplete
  if (!localStorage.getItem('bs-name')) {
    alerts.push({
      ico: '👤', type: 'remind',
      title: 'Complete your profile',
      desc: 'Take the health quiz to get personalised insights and accurate scores.'
    });
  }

  // 2. Log reminder
  function getLogs() { try { return JSON.parse(localStorage.getItem('bs-logs') || '[]'); } catch { return []; } }
  const logs     = getLogs();
  const todayLog = logs.find(l => l.date === today);
  if (!todayLog) {
    alerts.push({
      ico: '📋', type: 'remind',
      title: 'Log your symptoms',
      desc: "You haven't logged your breathing today. Daily logs make your analytics more accurate."
    });
  }

  // 3. Streak broken
  if (logs.length > 0 && !todayLog) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.toISOString().split('T')[0];
    const hadYesterday = logs.some(l => l.date === yKey);
    if (hadYesterday) {
      alerts.push({
        ico: '🔥', type: 'remind',
        title: 'Streak at risk',
        desc: "Log today to keep your streak alive. You logged yesterday — don't break the chain!"
      });
    }
  }

  // 4. Episode recovery (from HelpZone)
  function getEpisodes() { try { return JSON.parse(localStorage.getItem('bs-episodes') || '[]'); } catch { return []; } }
  const episodes    = getEpisodes();
  const todayEp     = episodes.find(e => e.date === today);
  if (todayEp) {
    alerts.push({
      ico: '🫁', type: 'warning',
      title: 'Episode logged today',
      desc: `You had a breathing episode (${todayEp.triggers.join(', ')}) today. Rest, stay hydrated, and monitor your symptoms.`
    });
  }

  // 5. High AQI — injected after AQI fetch (see below)
  window._addAQIAlert = function(aqi, label) {
    if (aqi > 100) {
      alerts.push({
        ico: '🌫️', type: 'warning',
        title: `Poor air quality — AQI ${aqi}`,
        desc: `Current AQI is ${aqi} (${label}). Limit outdoor exposure, wear a mask if going out.`
      });
      renderAlerts();
    }
  };

  function renderAlerts() {
    alertList.innerHTML = '';
    if (!alerts.length) {
      alertList.innerHTML = '<div class="alert-empty">No alerts right now ✓</div>';
      alertBadge.style.display = 'none';
      return;
    }

    alertBadge.textContent     = alerts.length;
    alertBadge.style.display   = 'flex';

    alerts.forEach(a => {
      const item = document.createElement('div');
      item.className = 'alert-item';
      item.innerHTML = `
        <div class="alert-item-ico">${a.ico}</div>
        <div class="alert-item-body">
          <div class="alert-item-title">${a.title}</div>
          <div class="alert-item-desc">${a.desc}</div>
        </div>
        <span class="alert-item-type ${a.type}">${a.type}</span>
      `;
      alertList.appendChild(item);
    });
  }

  renderAlerts();

  // Toggle dropdown
  alertBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    alertDropdown.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!alertBtn.contains(e.target) && !alertDropdown.contains(e.target)) {
      alertDropdown.classList.remove('open');
    }
  });

  // Clear all
  alertClearBtn.addEventListener('click', () => {
    alerts.length = 0;
    renderAlerts();
    alertDropdown.classList.remove('open');
  });
})();

/* ── AVATAR DROPDOWN ── */
(function initAvatarDropdown() {
  const wrap     = document.getElementById('avatarWrap');
  const dropdown = document.getElementById('avatarDropdown');
  const avatarBig = document.getElementById('avatarBig');
  const avatarName = document.getElementById('avatarName');
  const avatarDetail = document.getElementById('avatarDetail');
  const editBtn  = document.getElementById('avatarEditBtn');
  const logoutBtn = document.getElementById('avatarLogoutBtn');

  if (!wrap) return;

  // Populate profile info
  const name       = localStorage.getItem('bs-name') || 'User';
  const conditions = localStorage.getItem('bs-conditions') || 'No conditions';
  const age        = localStorage.getItem('bs-age') || '';
  const sensitivity = localStorage.getItem('bs-sensitivity') || '';

  avatarBig.textContent    = name.charAt(0).toUpperCase();
  avatarName.textContent   = name;
  avatarDetail.textContent = [conditions, age, sensitivity ? `Sensitivity ${sensitivity}/10` : '']
    .filter(Boolean).join(' · ');

  // Toggle dropdown
  wrap.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) dropdown.classList.remove('open');
  });

  // Edit profile — go to quiz
  editBtn.addEventListener('click', () => {
    window.location.href = 'quiz.html';
  });

  // Sign out — clear localStorage and redirect to login
  logoutBtn.addEventListener('click', async () => {
    try {
      // Try Firebase signout if available
      const { auth } = await import('../js/firebase.js');
      const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      await signOut(auth);
    } catch {}
    localStorage.clear();
    window.location.href = 'login.html';
  });
})();