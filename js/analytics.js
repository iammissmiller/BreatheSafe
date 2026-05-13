/* ═══════════════════════════════════════════
   BREATHESAFE — analytics.js
   Reads bs-logs, renders D3 charts.
═══════════════════════════════════════════ */

const avatar = document.getElementById('avatar');
const name   = localStorage.getItem('bs-name') || null;
avatar.textContent = name ? name.charAt(0).toUpperCase() : '?';

/* ── LOAD LOGS ── */
function getLogs() {
  try { return JSON.parse(localStorage.getItem('bs-logs')) || []; }
  catch { return []; }
}

/* ── FILTER BY DAYS ── */
function filterLogs(logs, days) {
  if (!days) return logs;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return logs.filter(l => new Date(l.date) >= cutoff);
}

/* ── COLORS ── */
const COLORS = ['#C65D07','#FFB347','#4CAF50','#2196F3','#9C27B0','#F44336'];

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

/* ── MAIN RENDER ── */
function render() {
  const allLogs = getLogs();
  const logs    = filterLogs(allLogs, currentDays);

  if (allLogs.length === 0) {
    document.getElementById('emptyState').style.display  = 'flex';
    document.getElementById('analyticsWrap').style.display = 'none';
    return;
  }

  document.getElementById('emptyState').style.display   = 'none';
  document.getElementById('analyticsWrap').style.display = 'flex';

  drawComfortTrend(logs);
  drawSymptomFrequency(logs);
  drawTriggerDonut(logs);
  drawSummary(logs);
}

/* ══════════════════════════════════════════
   COMFORT TREND — Line Chart
══════════════════════════════════════════ */
function drawComfortTrend(logs) {
  const el = document.getElementById('comfortChart');
  el.innerHTML = '';

  if (logs.length === 0) { el.innerHTML = '<p style="color:var(--mu);font-size:13px;">No data for this period</p>'; return; }

  const rect   = el.getBoundingClientRect();
  const W      = rect.width  || 400;
  const H      = rect.height || 160;
  const margin = { top: 10, right: 16, bottom: 28, left: 28 };
  const iW     = W - margin.left - margin.right;
  const iH     = H - margin.top  - margin.bottom;

  const data = logs.map(l => ({ date: new Date(l.date), comfort: l.comfort || 5 }))
                   .sort((a,b) => a.date - b.date);

  const x = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, iW]);
  const y = d3.scaleLinear().domain([0, 10]).range([iH, 0]);

  const svg = d3.select(el).append('svg')
    .attr('width', W).attr('height', H);

  const defs = svg.append('defs');
  const grad = defs.append('linearGradient')
    .attr('id', 'areaGrad').attr('x1','0').attr('y1','0').attr('x2','0').attr('y2','1');
  grad.append('stop').attr('offset','0%').attr('stop-color','#C65D07').attr('stop-opacity', 0.25);
  grad.append('stop').attr('offset','100%').attr('stop-color','#C65D07').attr('stop-opacity', 0);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // grid
  g.append('g').attr('class','d3-grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-iW).tickFormat(''));

  // area
  const area = d3.area().x(d => x(d.date)).y0(iH).y1(d => y(d.comfort)).curve(d3.curveCatmullRom);
  g.append('path').datum(data).attr('class','d3-area').attr('d', area);

  // line
  const line = d3.line().x(d => x(d.date)).y(d => y(d.comfort)).curve(d3.curveCatmullRom);
  g.append('path').datum(data).attr('class','d3-line').attr('d', line);

  // dots
  g.selectAll('.d3-dot').data(data).enter().append('circle')
    .attr('class','d3-dot').attr('r', 3)
    .attr('cx', d => x(d.date)).attr('cy', d => y(d.comfort));

  // axes
  g.append('g').attr('class','d3-axis').attr('transform',`translate(0,${iH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%b %d')));
  g.append('g').attr('class','d3-axis').call(d3.axisLeft(y).ticks(5));

  // avg
  const avg = d3.mean(data, d => d.comfort).toFixed(1);
  document.getElementById('avgComfort').innerHTML = `${avg}<div class="chart-stat-label">avg comfort</div>`;
}

/* ══════════════════════════════════════════
   SYMPTOM FREQUENCY — Bar Chart
══════════════════════════════════════════ */
function drawSymptomFrequency(logs) {
  const el = document.getElementById('symptomChart');
  el.innerHTML = '';

  const counts = {};
  logs.forEach(l => {
    (l.symptoms || []).forEach(s => {
      const name = typeof s === 'object' ? s.name : s;
      counts[name] = (counts[name] || 0) + 1;
    });
  });

  const data = Object.entries(counts).map(([name, count]) => ({ name, count }))
                     .sort((a,b) => b.count - a.count);

  if (data.length === 0) { el.innerHTML = '<p style="color:var(--mu);font-size:13px;">No symptoms logged</p>'; return; }

  const rect   = el.getBoundingClientRect();
  const W      = rect.width  || 400;
  const H      = rect.height || 160;
  const margin = { top: 10, right: 16, bottom: 28, left: 90 };
  const iW     = W - margin.left - margin.right;
  const iH     = H - margin.top  - margin.bottom;

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.count)]).range([0, iW]);
  const y = d3.scaleBand().domain(data.map(d => d.name)).range([0, iH]).padding(0.3);

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
  const g   = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  g.selectAll('.d3-bar').data(data).enter().append('rect')
    .attr('class','d3-bar')
    .attr('x', 0).attr('y', d => y(d.name))
    .attr('width', d => x(d.count))
    .attr('height', y.bandwidth())
    .attr('rx', 4).attr('fill', '#C65D07').attr('opacity', 0.8);

  g.selectAll('.bar-label').data(data).enter().append('text')
    .attr('x', d => x(d.count) + 6).attr('y', d => y(d.name) + y.bandwidth() / 2 + 4)
    .attr('fill', 'var(--sa)').attr('font-size', 11).text(d => d.count);

  g.append('g').attr('class','d3-axis').attr('transform',`translate(0,${iH})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d => Math.round(d)));
  g.append('g').attr('class','d3-axis').call(d3.axisLeft(y));

  document.getElementById('totalLogs').innerHTML = `${logs.length}<div class="chart-stat-label">days logged</div>`;
}

/* ══════════════════════════════════════════
   TRIGGER DONUT
══════════════════════════════════════════ */
function drawTriggerDonut(logs) {
  const el = document.getElementById('triggerChart');
  el.innerHTML = '';

  const counts = {};
  logs.forEach(l => {
    if (l.trigger && l.trigger !== 'Nothing specific') {
      counts[l.trigger] = (counts[l.trigger] || 0) + 1;
    }
  });

  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    el.innerHTML = '<p style="color:var(--mu);font-size:13px;text-align:center;">No trigger data yet</p>';
    return;
  }

  const size   = Math.min(el.getBoundingClientRect().height || 140, 140);
  const radius = size / 2;
  const inner  = radius * 0.55;

  const pie   = d3.pie().value(d => d.value).sort(null);
  const arc   = d3.arc().innerRadius(inner).outerRadius(radius);
  const color = d3.scaleOrdinal().domain(data.map(d => d.name)).range(COLORS);

  const svgWrap = document.createElement('div');
  const svg = d3.select(svgWrap).append('svg')
    .attr('width', size).attr('height', size);

  const g = svg.append('g').attr('transform', `translate(${radius},${radius})`);

  g.selectAll('path').data(pie(data)).enter().append('path')
    .attr('d', arc).attr('fill', d => color(d.data.name))
    .attr('stroke', 'var(--bg)').attr('stroke-width', 2);

  el.appendChild(svgWrap);

  // legend
  const legend = document.createElement('div');
  legend.className = 'donut-legend';
  data.forEach((d, i) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<div class="legend-dot" style="background:${COLORS[i]}"></div>${d.name} (${d.value})`;
    legend.appendChild(item);
  });
  el.appendChild(legend);
}

/* ══════════════════════════════════════════
   SUMMARY
══════════════════════════════════════════ */
function drawSummary(logs) {
  const grid = document.getElementById('summaryGrid');
  grid.innerHTML = '';

  if (logs.length === 0) { grid.innerHTML = '<p style="color:var(--mu);font-size:13px;">No data</p>'; return; }

  const avgComfort   = (logs.reduce((s,l) => s + (l.comfort||5), 0) / logs.length).toFixed(1);
  const totalSymDays = logs.filter(l => l.symptoms?.length > 0).length;
  const worstDay     = logs.reduce((a,b) => (a.comfort||5) < (b.comfort||5) ? a : b);
  const bestDay      = logs.reduce((a,b) => (a.comfort||5) > (b.comfort||5) ? a : b);

  const allSyms = {};
  logs.forEach(l => (l.symptoms||[]).forEach(s => {
    const n = typeof s === 'object' ? s.name : s;
    allSyms[n] = (allSyms[n]||0) + 1;
  }));
  const topSym = Object.entries(allSyms).sort((a,b) => b[1]-a[1])[0]?.[0] || 'None';

  const items = [
    { val: avgComfort,                    lbl: 'Avg Comfort Score' },
    { val: `${totalSymDays}d`,            lbl: 'Days With Symptoms' },
    { val: worstDay.date.slice(5),        lbl: 'Toughest Day' },
    { val: topSym,                        lbl: 'Most Common Symptom' },
  ];

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'summary-item';
    div.innerHTML = `<span class="summary-val">${item.val}</span><span class="summary-lbl">${item.lbl}</span>`;
    grid.appendChild(div);
  });
}

/* ── INIT ── */
render();

// re-render on resize
window.addEventListener('resize', render);