// saferoute.js — v3
// Real OSRM routing + AQI sampling + color-coded route + Groq insight

(function () {
  'use strict';

  const OW_BASE    = 'https://api.openweathermap.org/data/2.5/air_pollution';
  const OW_GEO     = 'https://api.openweathermap.org/geo/1.0/direct';
  const OW_REVERSE = 'https://api.openweathermap.org/geo/1.0/reverse';
  const OSRM_BASE  = 'https://router.project-osrm.org/route/v1/driving';
  const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL = 'llama-3.1-8b-instant';

  const ZONE_OFFSETS = [
    { label: 'City Park North',  dlat:  0.015, dlng:  0.005 },
    { label: 'Riverside Walk',   dlat: -0.010, dlng:  0.018 },
    { label: 'Green Belt East',  dlat:  0.008, dlng: -0.020 },
    { label: 'West Commons',     dlat: -0.018, dlng: -0.008 },
    { label: 'Hillside Reserve', dlat:  0.022, dlng:  0.003 },
  ];

  // ── DOM ──
  const originInput = document.getElementById('sr-origin');
  const destInput   = document.getElementById('sr-dest');
  const goBtn       = document.getElementById('sr-go-btn');
  const errorBox    = document.getElementById('sr-error');
  const resultsBox  = document.getElementById('sr-results');
  const idleBox     = document.getElementById('sr-idle');

  // ── MAP ──
  const map = L.map('saferoute-map', { zoomControl: false }).setView([20.5937, 78.9629], 5);

  const lightTile = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
    attribution: '© Stadia Maps © OpenStreetMap', maxZoom: 20
  });
  const darkTile = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
    attribution: '© Stadia Maps © OpenStreetMap', maxZoom: 20
  });

  (document.body.classList.contains('dark') ? darkTile : lightTile).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);

  let markerLayer    = L.layerGroup().addTo(map);
  let routeLayer     = L.layerGroup().addTo(map);
  let userCoords     = null;

  // ── HELPERS ──
  function aqiCategory(raw) {
    const m = { 1: 25, 2: 65, 3: 110, 4: 160, 5: 220 };
    return m[raw] || raw * 40;
  }

  function aqiInfo(val) {
    if (val <= 50)  return { label: 'Good',     color: '#27ae60', cls: 'good'     };
    if (val <= 100) return { label: 'Moderate', color: '#f39c12', cls: 'moderate' };
    if (val <= 150) return { label: 'Poor',     color: '#e74c3c', cls: 'poor'     };
    return              { label: 'Very Poor', color: '#8e44ad', cls: 'poor'     };
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('visible');
    setTimeout(() => errorBox.classList.remove('visible'), 6000);
  }

  function setLoading(on) {
    goBtn.classList.toggle('loading', on);
    goBtn.disabled = on;
  }

  function clearMap() {
    markerLayer.clearLayers();
    routeLayer.clearLayers();
  }

  function formatDistance(meters) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  }

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
  }

  // ── GEOCODE ──
  async function geocode(query) {
    const url  = `${OW_GEO}?q=${encodeURIComponent(query)}&limit=1&appid=${API_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.length) throw new Error(`Could not find "${query}". Try "City, State" e.g. "Indore, MP".`);
    return { lat: data[0].lat, lng: data[0].lon, name: data[0].name };
  }

  // ── FETCH AQI ──
  async function fetchAQI(lat, lng) {
    const url  = `${OW_BASE}?lat=${lat}&lon=${lng}&appid=${API_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    return aqiCategory(data?.list?.[0]?.main?.aqi ?? 2);
  }

  // ── OSRM ROUTING ──
  async function fetchRoute(origin, dest) {
    const url  = `${OSRM_BASE}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=false`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes.length) throw new Error('Could not find a route between these locations.');
    const route = data.routes[0];
    return {
      coords:   route.geometry.coordinates.map(c => [c[1], c[0]]), // [lat, lng]
      distance: route.distance,
      duration: route.duration,
    };
  }

  // ── SAMPLE AQI ALONG ROUTE ──
  async function sampleAQIAlongRoute(coords) {
    // Pick ~6 evenly spaced points along the route
    const count  = Math.min(6, coords.length);
    const step   = Math.floor(coords.length / count);
    const points = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.min(i * step, coords.length - 1);
      points.push(coords[idx]);
    }

    const aqis = await Promise.all(
      points.map(pt => fetchAQI(pt[0], pt[1]))
    );

    return points.map((pt, i) => ({ lat: pt[0], lng: pt[1], aqi: aqis[i] }));
  }

  // ── COLOR-CODED ROUTE ──
  function drawColoredRoute(coords, aqiPoints) {
    routeLayer.clearLayers();

    if (aqiPoints.length < 2) {
      // Single color fallback
      const aqi  = aqiPoints[0]?.aqi || 65;
      const info = aqiInfo(aqi);
      L.polyline(coords, { color: info.color, weight: 5, opacity: 0.85 }).addTo(routeLayer);
      return;
    }

    // Split route into segments, color each by nearest AQI point
    const segmentSize = Math.floor(coords.length / aqiPoints.length);

    aqiPoints.forEach((pt, i) => {
      const start = i * segmentSize;
      const end   = i === aqiPoints.length - 1 ? coords.length : (i + 1) * segmentSize + 1;
      const seg   = coords.slice(start, end);
      const info  = aqiInfo(pt.aqi);

      if (seg.length >= 2) {
        L.polyline(seg, {
          color:   info.color,
          weight:  5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeLayer);
      }
    });
  }

  // ── RENDER AQI STRIP ──
  function renderAQIStrip(aqiPoints) {
    const strip = document.getElementById('sr-aqi-strip');
    strip.innerHTML = '';
    const maxAqi = Math.max(...aqiPoints.map(p => p.aqi), 1);

    aqiPoints.forEach((pt, i) => {
      const info   = aqiInfo(pt.aqi);
      const height = Math.max(20, (pt.aqi / Math.max(maxAqi, 220)) * 36);
      const bar    = document.createElement('div');
      bar.className = 'sr-aqi-bar';
      bar.style.cssText = `height:${height}px;background:${info.color};opacity:0.85;`;
      bar.title = `Point ${i+1}: AQI ${pt.aqi} — ${info.label}`;

      // Animate in
      bar.style.transform = 'scaleY(0)';
      bar.style.transformOrigin = 'bottom';
      bar.style.transition = `transform 0.4s ease ${i * 0.08}s`;
      strip.appendChild(bar);
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transform = 'scaleY(1)'; }));
    });
  }

  // ── RENDER ZONE LIST ──
  function renderZoneList(zones) {
    const list = document.getElementById('sr-zone-list');
    list.innerHTML = '';
    if (!zones.length) {
      list.innerHTML = '<div class="sr-empty">No clean zones found nearby right now.</div>';
      return;
    }
    zones.slice(0, 4).forEach(z => {
      const info = aqiInfo(z.aqi);
      const item = document.createElement('div');
      item.className = 'sr-zone-item';
      item.innerHTML = `
        <span class="sr-zone-dot ${info.cls}"></span>
        <span class="sr-zone-name">${z.label}</span>
        <span class="sr-zone-aqi">AQI ${z.aqi}</span>
      `;
      item.addEventListener('click', () => map.flyTo([z.lat, z.lng], 13));
      list.appendChild(item);
    });
  }

  // ── GROQ INSIGHT ──
  async function fetchGroqInsight(originName, destName, distance, duration, avgAqi, aqiPoints) {
    const profile = {
      name:        localStorage.getItem('bs-name') || 'there',
      conditions:  localStorage.getItem('bs-conditions') || 'none',
      sensitivity: localStorage.getItem('bs-sensitivity') || 'medium',
    };

    const aqiWorst = Math.max(...aqiPoints.map(p => p.aqi));
    const aqiBest  = Math.min(...aqiPoints.map(p => p.aqi));

    const prompt = `You are a respiratory health assistant in the BreatheSafe app.

User: ${profile.name}, conditions: ${profile.conditions}, sensitivity: ${profile.sensitivity}.
Route: ${originName} to ${destName}, ${formatDistance(distance)}, ~${formatDuration(duration)}.
Air quality: avg AQI ${avgAqi}, worst point ${aqiWorst}, best point ${aqiBest}.

Give 2-3 sentences of personalised, actionable advice for this specific journey. Include:
1. Whether it's safe to travel and any precautions (mask, inhaler, windows up)
2. The best time to travel based on typical AQI patterns (morning is usually cleaner)
Be direct, warm, specific. No generic advice. No bullet points.`;

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: GROQ_MODEL, max_tokens: 150, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  }

  // ── BEST TIME ──
  function getBestTime(avgAqi) {
    if (avgAqi <= 50)  return 'Any time is fine — air quality is good on this route.';
    if (avgAqi <= 100) return 'Early morning (6–9 AM) is best when traffic and pollution are lower.';
    return 'Travel early morning (before 8 AM) or after 8 PM to avoid peak pollution hours.';
  }

  // ── MAIN FLOW ──
  async function findRoute() {
    const originQ = originInput.value.trim();
    const destQ   = destInput.value.trim();
    if (!originQ || !destQ) { showError('Please enter both origin and destination.'); return; }

    errorBox.classList.remove('visible');
    setLoading(true);
    clearMap();
    resultsBox.classList.remove('visible');
    idleBox.style.display = 'none';

    // Reset insight
    document.getElementById('sr-insight-text').textContent = 'Generating personalised advice…';
    document.getElementById('sr-insight-spinner').classList.add('active');
    document.getElementById('sr-warning').classList.add('hidden');
    document.getElementById('sr-best-time').classList.remove('visible');

    try {
      // 1. Geocode
      let origin, dest;
      if (originInput._coords) origin = originInput._coords;
      else origin = await geocode(originQ);

      if (destInput._coords) dest = destInput._coords;
      else dest = await geocode(destQ);

      // 2. Real route from OSRM
      const route = await fetchRoute(origin, dest);

      // 3. Fit map
      map.fitBounds(route.coords, { padding: [50, 50] });

      // 4. Sample AQI along actual route
      const aqiPoints = await sampleAQIAlongRoute(route.coords);
      const avgAqi    = Math.round(aqiPoints.reduce((s, p) => s + p.aqi, 0) / aqiPoints.length);
      const aqiGrade  = aqiInfo(avgAqi);

      // 5. Sample safe zones around origin
      const zonePromises = ZONE_OFFSETS.map(async z => {
        const lat = origin.lat + z.dlat;
        const lng = origin.lng + z.dlng;
        const aqi = await fetchAQI(lat, lng);
        return { label: z.label, lat, lng, aqi };
      });
      const allZones  = await Promise.all(zonePromises);
      const cleanZones = allZones.filter(z => z.aqi <= 100).sort((a, b) => a.aqi - b.aqi);

      // 6. Draw color-coded route
      drawColoredRoute(route.coords, aqiPoints);

      // 7. Origin / dest markers
      L.marker([origin.lat, origin.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#C65D07;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        })
      }).bindPopup(`<b>📍 ${origin.name}</b>`).addTo(markerLayer);

      L.marker([dest.lat, dest.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#2a9d8f;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        })
      }).bindPopup(`<b>🏁 ${dest.name}</b>`).addTo(markerLayer);

      // AQI markers along route
      aqiPoints.forEach(pt => {
        const info = aqiInfo(pt.aqi);
        L.circleMarker([pt.lat, pt.lng], {
          radius: 5, color: '#fff', weight: 1.5,
          fillColor: info.color, fillOpacity: 0.9,
        }).bindPopup(`AQI ${pt.aqi} — ${info.label}`).addTo(markerLayer);
      });

      // 8. Update summary
      document.getElementById('sr-distance').textContent = formatDistance(route.distance);
      document.getElementById('sr-duration').textContent = formatDuration(route.duration);
      document.getElementById('sr-aqi-avg').textContent  = avgAqi;
      document.getElementById('sr-aqi-grade').textContent = aqiGrade.label;
      document.getElementById('sr-aqi-grade').style.color = aqiGrade.color;

      // 9. Health warning
      const warningEl = document.getElementById('sr-warning');
      const warningText = document.getElementById('sr-warning-text');
      if (avgAqi > 100) {
        warningText.textContent = avgAqi > 150
          ? 'Very poor air quality on this route. Avoid if possible. If you must travel, wear an N95 mask and keep windows closed.'
          : 'Moderate to poor air quality along this route. Consider wearing a mask, especially if you have asthma or allergies.';
        warningEl.classList.remove('hidden');
      } else {
        warningEl.classList.add('hidden');
      }

      // 10. Best time
      document.getElementById('sr-best-time-val').textContent = getBestTime(avgAqi);
      document.getElementById('sr-best-time').classList.add('visible');

      // 11. AQI strip
      renderAQIStrip(aqiPoints);

      // 12. Zone list
      renderZoneList(cleanZones);

      // 13. Show results
      resultsBox.classList.add('visible');

      // 14. Groq insight (async)
      fetchGroqInsight(origin.name, dest.name, route.distance, route.duration, avgAqi, aqiPoints)
        .then(text => {
          document.getElementById('sr-insight-text').textContent = text || 'Check the air quality strip below for conditions along your route.';
        })
        .catch(() => {
          document.getElementById('sr-insight-text').textContent = 'Check the air quality strip below for conditions along your route.';
        })
        .finally(() => {
          document.getElementById('sr-insight-spinner').classList.remove('active');
        });

    } catch (err) {
      showError(err.message || 'Something went wrong. Please try again.');
      idleBox.style.display = 'flex';
    } finally {
      setLoading(false);
    }
  }

  // ── AUTOCOMPLETE (OpenWeather) ──
  function setupAutocomplete(input) {
    const dropdown = document.createElement('div');
    dropdown.className = 'sr-suggestions';
    input.parentElement.appendChild(dropdown);
    let timer = null;

    input.addEventListener('input', () => {
      input._coords = null;
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { dropdown.classList.remove('open'); return; }
      timer = setTimeout(async () => {
        try {
          const url  = `${OW_GEO}?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`;
          const res  = await fetch(url);
          const data = await res.json();
          dropdown.innerHTML = '';
          if (!data.length) { dropdown.classList.remove('open'); return; }
          data.forEach(r => {
            const item = document.createElement('div');
            item.className = 'sr-suggestion-item';
            const sub = [r.state, r.country].filter(Boolean).join(', ');
            item.innerHTML = `${r.name}<span>${sub}</span>`;
            item.addEventListener('mousedown', e => {
              e.preventDefault();
              input.value = r.name;
              input._coords = { lat: r.lat, lng: r.lon, name: r.name };
              dropdown.classList.remove('open');
            });
            dropdown.appendChild(item);
          });
          dropdown.classList.add('open');
        } catch {}
      }, 300);
    });

    input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('open'), 150));
    input.addEventListener('focus', () => { if (dropdown.children.length) dropdown.classList.add('open'); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') dropdown.classList.remove('open');
      if (e.key === 'Enter') { dropdown.classList.remove('open'); findRoute(); }
    });
  }

  setupAutocomplete(originInput);
  setupAutocomplete(destInput);

  // ── EVENTS ──
  goBtn.addEventListener('click', findRoute);

  // Dark mode tile switch
  document.addEventListener('bs-theme-change', () => {
    const dark  = document.body.classList.contains('dark');
    const mapEl = document.getElementById('saferoute-map');
    mapEl.style.opacity = '0';
    setTimeout(() => {
      if (dark) { map.removeLayer(lightTile); darkTile.addTo(map); }
      else       { map.removeLayer(darkTile); lightTile.addTo(map); }
      mapEl.style.opacity = '1';
    }, 300);
  });

  // Geolocation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      userCoords = { lat, lng };
      map.setView([lat, lng], 10);
      try {
        const url  = `${OW_REVERSE}?lat=${lat}&lon=${lng}&limit=1&appid=${API_KEY}`;
        const res  = await fetch(url);
        const data = await res.json();
        const city = data?.[0]?.name || 'Current Location';
        originInput.value = city;
        originInput._coords = { lat, lng, name: city };
      } catch {
        originInput.value = 'Current Location';
      }
    }, () => {});
  }

})();