/* ═══════════════════════════════════════════
   BREATHESAFE — analytics.js (v2)
   Symptom frequency bars + trigger donut.
   Warm minimal, animated.
═══════════════════════════════════════════ */

const COLORS = ['#C65D07','#E8820A','#FFB347','#4CAF50','#2196F3','#9C27B0'];

/* ── AVATAR ── */
const avatar = document.getElementById('avatar');
const name   = localStorage.getItem('bs-name') || null;
if (avatar) avatar.textContent = name ? name.charAt(0).toUpperCase() : '?';

/* ── LOGS ── */
function getLogs() {
  try { return JSON.parse(localStorage.getItem('bs-logs')) || []; }
  catch { return []; }
}

function filterLogs(logs, days) {
  if (!days) return logs;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return logs.filter(l => new Date(l.date) >= cutoff);
}

let currentDays = 7;

/* ── RANGE BUTTONS ── */
document.querySelectorAll('.range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDays = parseInt(btn.dataset.days);
    render();
  });
});

/* ── COUNT UP ANIMATION ── */
function countUp(el, target, isFloat, duration = 800) {
  const start = performance.now();
  const from  = 0;
  function tick(now) {
    const p   = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const val  = from + (target - from) * ease;
    el.textContent = isFloat ? val.toFixed(1) : Math.round(val);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ── STAT STRIP ── */
function drawStats(logs) {
  const avgComfort = logs.length
    ? logs.reduce((s, l) => s + (l.comfort || 5), 0) / logs.length
    : 0;

  const symCounts = {};
  logs.forEach(l => (l.symptoms || []).forEach(s => {
    const n = typeof s === 'object' ? s.name : s;
    symCounts[n] = (symCounts[n] || 0) + 1;
  }));
  const topSym = Object.entries(symCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';

  const trigCounts = {};
  logs.forEach(l => {
    if (l.trigger && l.trigger !== 'Nothing specific') {
      trigCounts[l.trigger] = (trigCounts[l.trigger] || 0) + 1;
    }
  });
  const topTrig = Object.entries(trigCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';

  const comfortEl = document.getElementById('st-comfort');
  const daysEl    = document.getElementById('st-days');
  const symEl     = document.getElementById('st-symptom');
  const trigEl    = document.getElementById('st-trigger');

  countUp(comfortEl, avgComfort, true);
  countUp(daysEl, logs.length, false);
  symEl.textContent  = topSym;
  trigEl.textContent = topTrig;
}

/* ── SYMPTOM FREQUENCY BARS ── */
function drawSymptomBars(logs) {
  const el = document.getElementById('symptomChart');
  const footer = document.getElementById('symptomDetail');
  const statEl = document.getElementById('totalLogs');
  el.innerHTML = '';
  if (footer) footer.textContent = '';

  // Count symptoms + severity breakdown
  const symData = {};
  logs.forEach(l => {
    (l.symptoms || []).forEach(s => {
      const name = typeof s === 'object' ? s.name : s;
      const sev  = typeof s === 'object' ? (s.severity || 'Mild') : 'Mild';
      if (!symData[name]) symData[name] = { total: 0, mild: 0, moderate: 0, severe: 0 };
      symData[name].total++;
      symData[name][sev.toLowerCase()]++;
    });
  });

  const data = Object.entries(symData)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a,b) => b.total - a.total);

  if (statEl) {
    statEl.innerHTML = `${logs.length}<div style="font-size:10px;color:var(--mu);margin-top:2px;letter-spacing:0.1em;text-transform:uppercase;">days logged</div>`;
  }

  if (!data.length) {
    el.innerHTML = '<div class="an-no-data">No symptoms logged in this period</div>';
    return;
  }

  const maxCount = Math.max(...data.map(d => d.total));
  const wrap = document.createElement('div');
  wrap.className = 'sym-bars';

  data.forEach((d, i) => {
    const pct = (d.total / maxCount) * 100;

    // Bar row
    const row = document.createElement('div');
    row.className = 'sym-bar-row';
    row.style.animationDelay = `${i * 0.08}s`;
    row.innerHTML = `
      <div class="sym-bar-label">${d.name}</div>
      <div class="sym-bar-track">
        <div class="sym-bar-fill" data-pct="${pct}"></div>
      </div>
      <div class="sym-bar-count">${d.total}</div>
    `;
    wrap.appendChild(row);

    // Severity pills
    const sevRow = document.createElement('div');
    sevRow.className = 'sym-sev-row';
    if (d.mild)     sevRow.innerHTML += `<span class="sym-sev-pill mild">Mild ×${d.mild}</span>`;
    if (d.moderate) sevRow.innerHTML += `<span class="sym-sev-pill moderate">Moderate ×${d.moderate}</span>`;
    if (d.severe)   sevRow.innerHTML += `<span class="sym-sev-pill severe">Severe ×${d.severe}</span>`;
    wrap.appendChild(sevRow);
  });

  el.appendChild(wrap);

  // Animate bars after a tick
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.querySelectorAll('.sym-bar-fill').forEach(fill => {
        fill.style.width = fill.dataset.pct + '%';
      });
    });
  });

  // Footer insight
  if (footer && data.length) {
    const top = data[0];
    const sevText = top.severe > 0 ? 'including severe episodes' : top.moderate > 0 ? 'mostly moderate' : 'mostly mild';
    footer.textContent = `${top.name} is your most frequent symptom — ${sevText}.`;
  }
}

/* ── TRIGGER DONUT ── */
function drawTriggerDonut(logs) {
  const chartEl  = document.getElementById('triggerChart');
  const legendEl = document.getElementById('triggerLegend');
  chartEl.innerHTML  = '';
  if (legendEl) legendEl.innerHTML = '';

  const counts = {};
  logs.forEach(l => {
    if (l.trigger && l.trigger !== 'Nothing specific') {
      counts[l.trigger] = (counts[l.trigger] || 0) + 1;
    }
  });

  const data  = Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  const total = data.reduce((s, d) => s + d.value, 0);

  if (!data.length) {
    chartEl.innerHTML = '<div class="an-no-data">No trigger data yet</div>';
    return;
  }

  const size   = 160;
  const radius = size / 2 - 4;
  const inner  = radius * 0.58;
  const color  = d3.scaleOrdinal().domain(data.map(d => d.name)).range(COLORS);

  const pie    = d3.pie().value(d => d.value).sort(null).padAngle(0.03);
  const arc    = d3.arc().innerRadius(inner).outerRadius(radius).cornerRadius(3);
  const arcBig = d3.arc().innerRadius(inner).outerRadius(radius + 6).cornerRadius(3);

  const svg = d3.select(chartEl).append('svg')
    .attr('width', size).attr('height', size);

  const g = svg.append('g').attr('transform', `translate(${size/2},${size/2})`);

  const paths = g.selectAll('path')
    .data(pie(data))
    .enter()
    .append('path')
    .attr('fill', d => color(d.data.name))
    .attr('d', arc)
    .style('cursor', 'pointer')
    .style('transition', 'transform 0.2s ease')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('d', arcBig);
    })
    .on('mouseout', function(event, d) {
      d3.select(this).attr('d', arc);
    });

  // Animate draw in
  paths.each(function(d) {
    const el   = d3.select(this);
    const end  = { startAngle: d.startAngle, endAngle: d.endAngle };
    const start = { startAngle: d.startAngle, endAngle: d.startAngle };
    el.attr('d', arc(start));
    el.transition().duration(700).delay((d, i) => i * 80).ease(d3.easeCubicOut)
      .attrTween('d', function() {
        const interpolate = d3.interpolate(start, end);
        return t => arc(interpolate(t));
      });
  });

  // Center label
  const center = document.createElement('div');
  center.className = 'donut-center';
  center.innerHTML = `
    <div class="donut-center-val">${total}</div>
    <div class="donut-center-lbl">episodes</div>
  `;
  chartEl.style.position = 'relative';
  chartEl.appendChild(center);

  // Legend
  if (legendEl) {
    data.forEach((d, i) => {
      const item = document.createElement('div');
      item.className = 'donut-leg-item';
      item.style.animationDelay = `${0.3 + i * 0.08}s`;
      const pct = Math.round((d.value / total) * 100);
      item.innerHTML = `
        <div class="donut-leg-dot" style="background:${COLORS[i]}"></div>
        <div class="donut-leg-name">${d.name}</div>
        <div class="donut-leg-pct">${pct}%</div>
      `;
      legendEl.appendChild(item);
    });
  }
}


/* ── STREAK TRACKER ── */
function drawStreakTracker(allLogs) {
  const dotsEl   = document.getElementById('streakDots');
  const footerEl = document.getElementById('streakFooter');
  if (!dotsEl) return;
  dotsEl.innerHTML = '';

  // Build a set of logged dates
  const loggedDates = new Set(allLogs.map(l => l.date));

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (loggedDates.has(key)) {
      currentStreak++;
    } else if (i > 0) {
      break;
    }
  }

  // Calculate best streak
  let bestStreak = 0, tempStreak = 0;
  const sortedDates = [...loggedDates].sort();
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prev = new Date(sortedDates[i-1]);
      const curr = new Date(sortedDates[i]);
      const diff = (curr - prev) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        tempStreak++;
      } else {
        bestStreak = Math.max(bestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    bestStreak = Math.max(bestStreak, tempStreak);
  }

  // This week count
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  let thisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    if (loggedDates.has(d.toISOString().split('T')[0])) thisWeek++;
  }

  // Update stat elements
  const currentEl = document.getElementById('st-current-streak');
  const bestEl    = document.getElementById('st-best-streak');
  const totalEl   = document.getElementById('st-total-days');
  const weekEl    = document.getElementById('st-this-week');

  if (currentEl) currentEl.innerHTML = `${currentStreak}<div style="font-size:10px;color:var(--mu);margin-top:2px;letter-spacing:0.1em;text-transform:uppercase;">day streak</div>`;
  if (bestEl)    bestEl.textContent    = `${bestStreak}d`;
  if (totalEl)   totalEl.textContent   = `${allLogs.length}d`;
  if (weekEl)    weekEl.textContent    = `${thisWeek}/7`;

  // Build 30-day dot grid
  for (let i = 29; i >= 0; i--) {
    const d   = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const isToday  = i === 0;
    const isFuture = d > today;
    const logged   = loggedDates.has(key);

    const dot = document.createElement('div');
    dot.className = 'streak-dot';
    dot.style.animationDelay = `${(29 - i) * 0.02}s`;

    if (isFuture)     dot.classList.add('future');
    else if (isToday && logged) dot.classList.add('today');
    else if (logged)  dot.classList.add('logged');
    else              dot.classList.add('missed');

    dot.title = `${key}${logged ? ' ✓' : ' —'}`;
    dotsEl.appendChild(dot);
  }

  // Footer message
  if (footerEl) {
    if (currentStreak >= 7) {
      footerEl.textContent = `🔥 ${currentStreak}-day streak! Keep it going.`;
    } else if (currentStreak > 0) {
      footerEl.textContent = `${currentStreak} day${currentStreak > 1 ? 's' : ''} in a row — best is ${bestStreak} days.`;
    } else {
      footerEl.textContent = `Log today to start a new streak. Your best was ${bestStreak} days.`;
    }
  }
}

/* ── MAIN RENDER ── */
function render() {
  const allLogs = getLogs();
  const logs    = filterLogs(allLogs, currentDays);

  if (allLogs.length === 0) {
    document.getElementById('emptyState').style.display   = 'flex';
    document.getElementById('analyticsWrap').style.display = 'none';
    return;
  }

  document.getElementById('emptyState').style.display   = 'none';
  document.getElementById('analyticsWrap').style.display = 'flex';

  drawStats(logs);
  drawSymptomBars(logs);
  drawStreakTracker(allLogs);
}

/* ── INIT ── */
render();
window.addEventListener('resize', render);