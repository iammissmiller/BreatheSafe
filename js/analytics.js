/* ═══════════════════════════════════════════
   BREATHESAFE — analytics.js (v3)
   Symptom progression + calendar streak tracker
═══════════════════════════════════════════ */

const SYM_COLORS = {
  'Breathlessness':  '#C65D07',
  'Chest Tightness': '#E8820A',
  'Coughing':        '#FFB347',
  'Wheezing':        '#2196F3',
};
const SEV_MAP   = { 'Mild': 1, 'Moderate': 2, 'Severe': 3 };
const SEV_LABEL = { 1: 'Mild', 2: 'Moderate', 3: 'Severe' };

/* ── TOOLTIP ── */
const tooltip = document.createElement('div');
tooltip.className = 'an-tooltip';
document.body.appendChild(tooltip);

function showTooltip(e, date, comfort, symptoms) {
  const symText = symptoms && symptoms.length
    ? symptoms.map(s => typeof s === 'object' ? `${s.name} (${s.severity})` : s).join(', ')
    : 'No symptoms';

  tooltip.innerHTML = `
    <div class="an-tooltip-date">${date}</div>
    <div class="an-tooltip-comfort">${comfort}<span style="font-size:11px;color:var(--mu)">/10</span></div>
    <div class="an-tooltip-syms">${symText}</div>
  `;
  tooltip.classList.add('visible');
  moveTooltip(e);
}

function moveTooltip(e) {
  const x = e.clientX + 14;
  const y = e.clientY - 10;
  const tw = 200;
  const th = 80;
  tooltip.style.left = (x + tw > window.innerWidth ? e.clientX - tw - 14 : x) + 'px';
  tooltip.style.top  = (y + th > window.innerHeight ? e.clientY - th - 10 : y) + 'px';
}

function hideTooltip() {
  tooltip.classList.remove('visible');
}

document.addEventListener('mousemove', e => {
  if (tooltip.classList.contains('visible')) moveTooltip(e);
});



/* ── AVATAR ── */
const avatar = document.getElementById('avatar');
const name   = localStorage.getItem('bs-name') || null;
if (avatar) avatar.textContent = name ? name.charAt(0).toUpperCase() : '?';

/* ── LOGS ── */
function getLogs() {
  try { return JSON.parse(localStorage.getItem('bs-logs')) || []; }
  catch { return []; }
}

function getEpisodes() {
  try { return JSON.parse(localStorage.getItem('bs-episodes') || '[]'); }
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

/* ── COUNT UP ── */
function countUp(el, target, isFloat, duration = 800) {
  if (!el) return;
  const start = performance.now();
  function tick(now) {
    const p    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const val  = target * ease;
    el.textContent = isFloat ? val.toFixed(1) : Math.round(val);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ── STAT STRIP ── */
function drawStats(logs) {
  const avgComfort = logs.length
    ? logs.reduce((s, l) => s + (l.comfort || 5), 0) / logs.length : 0;

  const symCounts = {};
  logs.forEach(l => (l.symptoms || []).forEach(s => {
    const n = typeof s === 'object' ? s.name : s;
    symCounts[n] = (symCounts[n] || 0) + 1;
  }));
  const topSym = Object.entries(symCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';

  const trigCounts = {};
  logs.forEach(l => {
    if (l.trigger && l.trigger !== 'Nothing specific')
      trigCounts[l.trigger] = (trigCounts[l.trigger] || 0) + 1;
  });
  const topTrig = Object.entries(trigCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';

  countUp(document.getElementById('st-comfort'), avgComfort, true);
  countUp(document.getElementById('st-days'), logs.length, false);
  const symEl  = document.getElementById('st-symptom');
  const trigEl = document.getElementById('st-trigger');
  if (symEl)  symEl.textContent  = topSym;
  if (trigEl) trigEl.textContent = topTrig;

  // Episode count
  const episodes = filterLogs(getEpisodes(), currentDays);
  const epEl = document.getElementById('st-episodes');
  if (epEl) {
    if (episodes.length === 0) epEl.textContent = '0';
    else countUp(epEl, episodes.length, false);
  }
}

/* ── COMFORT TREND ── */
function drawSymptomProgression(logs) {
  const el       = document.getElementById('symptomChart');
  const legendEl = document.getElementById('progLegend');
  const footerEl = document.getElementById('symptomDetail');
  const statEl   = document.getElementById('totalLogs');

  el.innerHTML = '';
  if (legendEl) legendEl.innerHTML = '';
  if (footerEl) footerEl.textContent = '';

  if (statEl) {
    statEl.innerHTML = `${logs.length}<div style="font-size:10px;color:var(--mu);margin-top:2px;letter-spacing:0.1em;text-transform:uppercase;">days logged</div>`;
  }

  if (!logs.length) {
    el.innerHTML = '<div class="an-no-data">No data for this period</div>';
    return;
  }

  const sorted = [...logs].sort((a,b) => new Date(a.date) - new Date(b.date));
  const data   = sorted.map(l => ({ date: new Date(l.date), value: l.comfort || 5 }));

  const rect = el.getBoundingClientRect();
  const W    = Math.max(rect.width  || 460, 200);
  const H    = Math.max(rect.height || 180, 120);
  const margin = { top: 16, right: 16, bottom: 28, left: 36 };
  const iW   = W - margin.left - margin.right;
  const iH   = H - margin.top  - margin.bottom;

  const x = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, iW]);
  const y = d3.scaleLinear().domain([0, 10]).range([iH, 0]);

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);

  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id','comfortGrad').attr('x1','0').attr('y1','0').attr('x2','0').attr('y2','1');
  grad.append('stop').attr('offset','0%').attr('stop-color','#C65D07').attr('stop-opacity', 0.18);
  grad.append('stop').attr('offset','100%').attr('stop-color','#C65D07').attr('stop-opacity', 0);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Grid
  g.append('g').attr('class','d3-grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-iW).tickFormat(''));

  // Reference lines
  [5, 7].forEach((val, i) => {
    g.append('line')
      .attr('x1', 0).attr('x2', iW)
      .attr('y1', y(val)).attr('y2', y(val))
      .attr('stroke', i === 0 ? 'rgba(198,93,7,0.15)' : 'rgba(39,174,96,0.2)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    g.append('text')
      .attr('x', iW + 4)
      .attr('y', y(val) + 4)
      .attr('font-size', 9)
      .attr('fill', i === 0 ? 'rgba(198,93,7,0.5)' : 'rgba(39,174,96,0.6)')
      .attr('font-family', 'var(--font-sans)')
      .text(i === 0 ? 'mid' : 'good');
  });

  // Area fill
  const area = d3.area().x(d => x(d.date)).y0(iH).y1(d => y(d.value)).curve(d3.curveCatmullRom);
  g.append('path').datum(data).attr('fill','url(#comfortGrad)').attr('d', area);

  // Line
  const line = d3.line().x(d => x(d.date)).y(d => y(d.value)).curve(d3.curveCatmullRom);
  const path = g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#C65D07')
    .attr('stroke-width', 2.5)
    .attr('stroke-linecap', 'round')
    .attr('d', line);

  // Animate line draw
  const totalLength = path.node().getTotalLength();
  path
    .attr('stroke-dasharray', totalLength)
    .attr('stroke-dashoffset', totalLength)
    .transition().duration(1000).ease(d3.easeCubicOut)
    .attr('stroke-dashoffset', 0);

  // Dots with tooltips
  g.selectAll('.comfort-dot')
    .data(data).enter()
    .append('circle')
    .attr('cx', d => x(d.date))
    .attr('cy', d => y(d.value))
    .attr('r', 5)
    .attr('fill', '#C65D07')
    .attr('stroke', 'var(--bg)')
    .attr('stroke-width', 2)
    .style('opacity', 0)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', 7);
      const log = sorted.find(l => new Date(l.date).toDateString() === d.date.toDateString());
      const dateStr = d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      showTooltip(event, dateStr, d.value, log?.symptoms || []);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('r', 5);
      hideTooltip();
    })
    .transition().duration(400).delay(900)
    .style('opacity', 1);

  // Axes
  g.append('g').attr('class','d3-axis')
    .call(d3.axisLeft(y).ticks(5));
  g.append('g').attr('class','d3-axis')
    .attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(x).ticks(Math.min(data.length, 6)).tickFormat(d3.timeFormat('%b %d')));

  // Episode markers
  const episodes = getEpisodes();
  const epMap = {};
  episodes.forEach(ep => { epMap[ep.date] = ep; });

  sorted.forEach(log => {
    const ep = epMap[log.date];
    if (!ep) return;
    const d = { date: new Date(log.date), value: log.comfort || 5 };
    g.append('circle')
      .attr('cx', x(d.date))
      .attr('cy', y(d.value))
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event) {
        const dateStr = d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        tooltip.innerHTML = `
          <div class="an-tooltip-date">⚠️ Episode — ${dateStr}</div>
          <div class="an-tooltip-syms" style="margin-top:4px">Triggers: ${ep.triggers.join(', ')}<br>${ep.stepsCompleted} steps completed</div>
        `;
        tooltip.classList.add('visible');
      })
      .on('mouseleave', hideTooltip);
  });

  // Footer
  if (footerEl && sorted.length >= 2) {
    const diff = (sorted[sorted.length-1].comfort || 5) - (sorted[0].comfort || 5);
    if (Math.abs(diff) < 1) footerEl.textContent = 'Your comfort has been stable during this period.';
    else if (diff > 0) footerEl.textContent = `Comfort improved by ${diff.toFixed(1)} points — trending better.`;
    else footerEl.textContent = `Comfort dropped by ${Math.abs(diff).toFixed(1)} points — consider reviewing your triggers.`;
  }
}

/* ── CALENDAR STREAK TRACKER ── */
function drawStreakTracker(allLogs) {
  const dotsEl   = document.getElementById('streakDots');
  const footerEl = document.getElementById('streakFooter');
  if (!dotsEl) return;
  dotsEl.innerHTML = '';

  const loggedMap = {};
  allLogs.forEach(l => { loggedMap[l.date] = l; });
  const loggedDates = new Set(Object.keys(loggedMap));
  const epMap = {};
  getEpisodes().forEach(ep => { epMap[ep.date] = ep; });
  const today    = new Date();
  const todayKey = today.toISOString().split('T')[0];

  // Current streak
  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (loggedDates.has(key)) currentStreak++;
    else if (i > 0) break;
  }

  // Best streak
  let bestStreak = 0, tempStreak = 0;
  const sortedDates = [...loggedDates].sort();
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) { tempStreak = 1; }
    else {
      const diff = (new Date(sortedDates[i]) - new Date(sortedDates[i-1])) / 86400000;
      if (diff === 1) tempStreak++;
      else { bestStreak = Math.max(bestStreak, tempStreak); tempStreak = 1; }
    }
    bestStreak = Math.max(bestStreak, tempStreak);
  }

  // This week
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  let thisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    if (loggedDates.has(d.toISOString().split('T')[0])) thisWeek++;
  }

  // Update stats
  const currentEl = document.getElementById('st-current-streak');
  const bestEl    = document.getElementById('st-best-streak');
  const totalEl   = document.getElementById('st-total-days');
  const weekEl    = document.getElementById('st-this-week');
  if (currentEl) currentEl.innerHTML = `${currentStreak}d<div style="font-size:10px;color:var(--mu);margin-top:2px;letter-spacing:0.1em;text-transform:uppercase;">streak</div>`;
  if (bestEl)    bestEl.textContent  = `${bestStreak}d`;
  if (totalEl)   totalEl.textContent = `${allLogs.length}d`;
  if (weekEl)    weekEl.textContent  = `${thisWeek}/7`;

  // Calendar grid — 5 weeks
  const gridStart = new Date(today);
  gridStart.setDate(today.getDate() - today.getDay() - 28);

  const labelRow = document.createElement('div');
  labelRow.className = 'cal-day-labels';
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
    const lbl = document.createElement('div');
    lbl.className = 'cal-day-label';
    lbl.textContent = d;
    labelRow.appendChild(lbl);
  });
  dotsEl.appendChild(labelRow);

  const weeksEl = document.createElement('div');
  weeksEl.className = 'cal-weeks';

  for (let w = 0; w < 5; w++) {
    const weekRow = document.createElement('div');
    weekRow.className = 'cal-week';

    for (let d = 0; d < 7; d++) {
      const date    = new Date(gridStart);
      date.setDate(gridStart.getDate() + w * 7 + d);
      const key     = date.toISOString().split('T')[0];
      const logged  = loggedMap[key];
      const isFuture = date > today;
      const isToday  = key === todayKey;

      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      cell.style.animationDelay = `${(w * 7 + d) * 0.015}s`;

      if (isFuture) {
        cell.classList.add('future');
      } else if (logged) {
        const comfort = logged.comfort || 5;
        if (comfort >= 7)      cell.classList.add('comfort-high');
        else if (comfort >= 4) cell.classList.add('comfort-mid');
        else                   cell.classList.add('comfort-low');
        if (isToday) cell.classList.add('today');
        cell.dataset.date    = key;
        cell.dataset.comfort  = comfort;
        cell.dataset.symptoms = JSON.stringify(logged.symptoms || []);
        if (epMap[key]) {
          cell.style.outline = '2px solid #e74c3c';
          cell.style.outlineOffset = '1px';
          cell.dataset.episode = JSON.stringify(epMap[key]);
        }
      } else {
        cell.classList.add('missed');
        cell.dataset.date = key;
      }

      weekRow.appendChild(cell);
    }
    weeksEl.appendChild(weekRow);
  }

  dotsEl.appendChild(weeksEl);

  // Tooltip events on calendar cells
  weeksEl.querySelectorAll('.cal-cell').forEach(cell => {
    cell.addEventListener('mouseenter', e => {
      const date     = cell.dataset.date;
      const comfort  = cell.dataset.comfort;
      const symptoms = cell.dataset.symptoms ? JSON.parse(cell.dataset.symptoms) : [];
      const episode  = cell.dataset.episode  ? JSON.parse(cell.dataset.episode)  : null;
      if (!date) return;
      const dateStr = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (comfort) {
        const symText = symptoms.length
          ? symptoms.map(s => typeof s === 'object' ? s.name : s).join(', ')
          : 'No symptoms';
        tooltip.innerHTML = `
          <div class="an-tooltip-date">${dateStr}</div>
          <div class="an-tooltip-comfort">${comfort}<span style="font-size:11px;color:var(--mu)">/10</span></div>
          <div class="an-tooltip-syms">${symText}</div>
          ${episode ? `<div class="an-tooltip-syms" style="color:#e74c3c;margin-top:4px">⚠️ Episode: ${episode.triggers.join(', ')}</div>` : ''}
        `;
        tooltip.classList.add('visible');
      } else {
        tooltip.innerHTML = `<div class="an-tooltip-date">${dateStr}</div><div class="an-tooltip-syms" style="margin-top:4px">Not logged</div>`;
        tooltip.classList.add('visible');
      }
    });
    cell.addEventListener('mouseleave', hideTooltip);
  });

  // Color legend
  const calLegend = document.createElement('div');
  calLegend.className = 'cal-legend';
  calLegend.innerHTML = `
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:#27ae60"></div>Good</div>
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:var(--or)"></div>Okay</div>
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:#e74c3c"></div>Rough</div>
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:var(--su);border:1px solid var(--bd)"></div>Missed</div>
  `;
  dotsEl.appendChild(calLegend);

  if (footerEl) {
    if (currentStreak >= 7) footerEl.textContent = `🔥 ${currentStreak}-day streak! You're on a roll.`;
    else if (currentStreak > 0) footerEl.textContent = `${currentStreak} day${currentStreak > 1 ? 's' : ''} in a row — best is ${bestStreak} days.`;
    else footerEl.textContent = `Log today to start a new streak. Your best was ${bestStreak} days.`;
  }
}

/* ── MAIN RENDER ── */
function render() {
  const allLogs = getLogs();
  const logs    = filterLogs(allLogs, currentDays);

  if (allLogs.length === 0) {
    document.getElementById('emptyState').style.display    = 'flex';
    document.getElementById('analyticsWrap').style.display = 'none';
    return;
  }

  document.getElementById('emptyState').style.display    = 'none';
  document.getElementById('analyticsWrap').style.display = 'flex';

  drawStats(logs);
  drawSymptomProgression(logs);
  drawStreakTracker(allLogs);
}

/* ── INIT ── */
render();
window.addEventListener('resize', render);