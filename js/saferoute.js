// saferoute.js — v4
// Google Maps geocoding + OSRM routing + OpenWeather AQI + Groq insights

(function () {
  'use strict';

  const OW_BASE    = '/api/weather';   // AQI + geocoding
  const OSRM_BASE  = 'https://router.project-osrm.org/route/v1/driving';
  const GROQ_URL   = '/api/groq';
  const GROQ_MODEL = 'llama-3.1-8b-instant';

  const ROUTE_VARIANTS = [
    { name: 'Direct Route',  emoji: '🛣️', shift: [0, 0]      },
    { name: 'Northern Path', emoji: '🌿', shift: [0.15, 0]   },
    { name: 'Southern Path', emoji: '💧', shift: [-0.15, 0]  },
  ];

  const ZONE_OFFSETS = [
    { dlat:  0.015, dlng:  0.005 },
    { dlat: -0.010, dlng:  0.018 },
    { dlat:  0.008, dlng: -0.020 },
    { dlat: -0.018, dlng: -0.008 },
    { dlat:  0.022, dlng:  0.003 },
  ];

  const ZONE_DIRECTION_LABELS = ['North Zone', 'East Zone', 'South Zone', 'West Zone', 'Central Zone'];

  // ── DOM ──
  const originInput = document.getElementById('sr-origin');
  const destInput   = document.getElementById('sr-dest');
  const goBtn       = document.getElementById('sr-go-btn');
  const errorBox    = document.getElementById('sr-error');
  const resultsBox  = document.getElementById('sr-results');
  const idleBox     = document.getElementById('sr-idle');

  // ── MAP ──
  const map = L.map('saferoute-map', { zoomControl: false }).setView([20.5937, 78.9629], 5);

  const lightTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', maxZoom: 19
  });
  const darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', maxZoom: 19
  });

  // Check both body and html for dark class (FOUC fix applied to html too)
  const initDark = document.body.classList.contains('dark') || document.documentElement.classList.contains('dark');
  (initDark ? darkTile : lightTile).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);

  setTimeout(() => map.invalidateSize(), 300);
  window.addEventListener('resize', () => map.invalidateSize());

  let markerLayer = L.layerGroup().addTo(map);
  let routeLayer  = L.layerGroup().addTo(map);
  let userCoords  = null;

  // ── HELPERS ──
  function aqiCategory(raw) {
    const m = { 1: 25, 2: 65, 3: 110, 4: 160, 5: 220 };
    return m[raw] || raw * 40;
  }

  function aqiInfo(val) {
    if (val <= 50)  return { label: 'Good',      color: '#27ae60', cls: 'good'     };
    if (val <= 100) return { label: 'Moderate',  color: '#f39c12', cls: 'moderate' };
    if (val <= 150) return { label: 'Poor',      color: '#e74c3c', cls: 'poor'     };
    return              { label: 'Very Poor',  color: '#8e44ad', cls: 'poor'     };
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

  function formatDistance(meters) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  }

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  }

  // ── GEOCODING (OpenWeather) ──
  async function geocode(query) {
    const res  = await fetch(`${OW_BASE}?type=geo&q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    if (!data.length) throw new Error(`Could not find "${query}". Try "City, State" e.g. "Indore, MP".`);
    return { lat: data[0].lat, lng: data[0].lon, name: data[0].name };
  }

  async function fetchSuggestions(query) {
    if (query.length < 2) return [];
    const res  = await fetch(`${OW_BASE}?type=geo&q=${encodeURIComponent(query)}&limit=5`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(r => ({
      name:    r.name,
      subtext: [r.state, r.country].filter(Boolean).join(', '),
      lat:     r.lat,
      lng:     r.lon,
    }));
  }

  async function reverseGeocode(lat, lng) {
    try {
      const res  = await fetch(`${OW_BASE}?type=reverse&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      return data?.[0]?.name || 'Current Location';
    } catch { return 'Current Location'; }
  }

  async function getZoneLabel(lat, lng, fallbackIdx) {
    try {
      const res  = await fetch(`${OW_BASE}?type=reverse&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      return data?.[0]?.name || ZONE_DIRECTION_LABELS[fallbackIdx] || `Zone ${fallbackIdx + 1}`;
    } catch { return ZONE_DIRECTION_LABELS[fallbackIdx] || `Zone ${fallbackIdx + 1}`; }
  }

  // ── FETCH AQI ──
  async function fetchAQI(lat, lng) {
    const res  = await fetch(`${OW_BASE}?type=aqi&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    return aqiCategory(data?.list?.[0]?.main?.aqi ?? 2);
  }

  // ── OSRM ROUTING ──
  async function fetchRoute(origin, dest, waypointShift) {
    let url;
    if (waypointShift[0] !== 0 || waypointShift[1] !== 0) {
      const latDiff = Math.abs(dest.lat - origin.lat);
      const lngDiff = Math.abs(dest.lng - origin.lng);
      const scale   = Math.max(latDiff, lngDiff) * 0.3;
      const midLat  = (origin.lat + dest.lat) / 2 + waypointShift[0] * scale;
      const midLng  = (origin.lng + dest.lng) / 2 + waypointShift[1] * scale;
      url = `${OSRM_BASE}/${origin.lng},${origin.lat};${midLng},${midLat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=false`;
    } else {
      url = `${OSRM_BASE}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=false`;
    }
    const res  = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes.length)
      throw new Error('Could not find a route between these locations.');
    const route = data.routes[0];
    return {
      coords:   route.geometry.coordinates.map(c => [c[1], c[0]]),
      distance: route.distance,
      duration: route.duration,
    };
  }

  // ── AQI ALONG ROUTE ──
  async function sampleAQIAlongRoute(coords) {
    const count  = Math.min(6, coords.length);
    const step   = Math.floor(coords.length / count);
    const points = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.min(i * step, coords.length - 1);
      points.push(coords[idx]);
    }
    const aqis = await Promise.all(points.map(pt => fetchAQI(pt[0], pt[1])));
    return points.map((pt, i) => ({ lat: pt[0], lng: pt[1], aqi: aqis[i] }));
  }

  // ── DRAW ROUTES ──
  function drawColoredRoute(coords, aqiPoints, isActive) {
    if (aqiPoints.length < 2) {
      const info = aqiInfo(aqiPoints[0]?.aqi || 65);
      L.polyline(coords, {
        color: info.color, weight: isActive ? 5 : 3,
        opacity: isActive ? 0.9 : 0.35, dashArray: isActive ? null : '6,8'
      }).addTo(routeLayer);
      return;
    }
    const segmentSize = Math.floor(coords.length / aqiPoints.length);
    aqiPoints.forEach((pt, i) => {
      const start = i * segmentSize;
      const end   = i === aqiPoints.length - 1 ? coords.length : (i + 1) * segmentSize + 1;
      const seg   = coords.slice(start, end);
      const info  = aqiInfo(pt.aqi);
      if (seg.length >= 2) {
        L.polyline(seg, {
          color: info.color, weight: isActive ? 5 : 3,
          opacity: isActive ? 0.9 : 0.35,
          dashArray: isActive ? null : '6,8',
          lineCap: 'round', lineJoin: 'round',
        }).addTo(routeLayer);
      }
    });
  }

  // ── BADGE HELPER ──
  function badge(routes, i, safestIdx) {
    const minDur     = Math.min(...routes.map(r => r.duration));
    const fastestIdx = routes.findIndex(r => r.duration === minDur);
    if (i === safestIdx && i === fastestIdx) return '<div style="font-size:0.65rem;color:var(--or);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-left:4px">★ Best & Fastest</div>';
    if (i === safestIdx)  return '<div style="font-size:0.65rem;color:var(--or);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-left:4px">★ Cleanest Air</div>';
    if (i === fastestIdx) return '<div style="font-size:0.65rem;color:#2a9d8f;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-left:4px">⚡ Fastest</div>';
    return '';
  }

  // ── ROUTE CARDS ──
  function renderRouteCards(routes, activeIndex, safestIdx, onSelect) {
    const existing = document.getElementById('sr-route-cards');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'sr-route-cards';
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:10px 20px 0;';

    routes.forEach((r, i) => {
      const info = aqiInfo(r.avgAqi);
      const card = document.createElement('div');
      card.className = `sr-route-card-item${i === activeIndex ? ' active' : ''}`;
      card.innerHTML = `
        <div style="font-size:1.2rem">${r.emoji}</div>
        <div style="flex:1">
          <div style="font-size:0.83rem;font-weight:600;color:var(--wm)">${r.name}</div>
          <div style="font-size:0.72rem;color:var(--mu);margin-top:2px">${formatDistance(r.distance)} · ${formatDuration(r.duration)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:600;color:${info.color};">${r.avgAqi}</div>
          <div style="font-size:0.65rem;color:var(--mu);text-transform:uppercase;letter-spacing:0.08em;">${info.label}</div>
        </div>
        ${badge(routes, i, safestIdx)}
      `;
      card.addEventListener('click', () => onSelect(i));
      wrap.appendChild(card);
    });

    const warning = document.getElementById('sr-warning');
    warning.parentElement.insertBefore(wrap, warning);
  }

  // ── ZONE LIST ──
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
      smoke:       localStorage.getItem('bs-smoke') || 'no',
    };

    const aqiWorst = Math.max(...aqiPoints.map(p => p.aqi));
    const aqiBest  = Math.min(...aqiPoints.map(p => p.aqi));
    const aqiLabel = aqiWorst <= 50 ? 'Good' : aqiWorst <= 100 ? 'Moderate' : aqiWorst <= 150 ? 'Poor' : 'Very Poor';
    const now      = new Date().getHours();

    const prompt = `You are a health and air quality AI in BreatheSafe. Respond ONLY with valid JSON, no markdown, no backticks.

User: name=${profile.name}, conditions=${profile.conditions}, sensitivity=${profile.sensitivity}, smoker=${profile.smoke}.
Route: ${originName} to ${destName}, ${formatDistance(distance)}, ~${formatDuration(duration)}.
AQI: avg=${avgAqi}, worst=${aqiWorst} (${aqiLabel}), best=${aqiBest}. Current hour: ${now}:00.

Rules:
- insight: 3-4 sentences. Write for ANY person. Mention AQI number and what it means (eye irritation, fatigue, breathing discomfort). Say if route is safe or risky.
- warning: If AQI>100 OR user has asthma/COPD/allergies, write 2-3 sentences with SPECIFIC actions (N95 mask, rescue inhaler, antihistamine, windows closed, AC on recirculate). If AQI<=100 and no conditions, return null.
- best_time: ONE sentence with EXACT time window like "6:00 AM – 8:00 AM". Always include actual times.

{"insight":"...","warning":"...or null","best_time":"..."}`;

    const res  = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROQ_MODEL, max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    try {
      return JSON.parse(text);
    } catch {
      return {
        insight:   text || 'Check the map for air quality conditions along your route.',
        warning:   avgAqi > 100 ? 'Air quality is poor — consider wearing a mask.' : null,
        best_time: avgAqi <= 50 ? 'Any time is suitable for this route.' : 'Early morning (6:00 AM – 8:00 AM) is recommended for cleaner air.',
      };
    }
  }

  // ── MAIN FLOW ──
  async function findRoute() {
    const originQ = originInput.value.trim();
    const destQ   = destInput.value.trim();
    if (!originQ || !destQ) { showError('Please enter both origin and destination.'); return; }

    errorBox.classList.remove('visible');
    setLoading(true);
    markerLayer.clearLayers();
    routeLayer.clearLayers();
    resultsBox.classList.remove('visible');
    idleBox.style.display = 'none';

    document.getElementById('sr-insight-text').textContent = 'Generating personalised advice…';
    document.getElementById('sr-insight-spinner').classList.add('active');
    document.getElementById('sr-warning').style.display = 'none';
    document.getElementById('sr-best-time').style.display = 'none';

    try {
      // 1. Geocode
      let origin;
      if (originInput._coords) {
        origin = originInput._coords;
      } else if (userCoords && originQ.toLowerCase() === 'current location') {
        origin = { ...userCoords, name: 'Your Location' };
      } else {
        origin = await geocode(originQ);
      }
      let dest = destInput._coords || await geocode(destQ);

      // 2. Fetch routes
      const routeResults = await Promise.all(
        ROUTE_VARIANTS.map(v => fetchRoute(origin, dest, v.shift).catch(() => null))
      );
      const validRoutes = routeResults.map((r, i) => r ? { ...ROUTE_VARIANTS[i], ...r } : null).filter(Boolean);
      if (!validRoutes.length) throw new Error('Could not find any routes between these locations.');

      // 3. Sample AQI
      const routesWithAQI = await Promise.all(
        validRoutes.map(async r => {
          const aqiPoints = await sampleAQIAlongRoute(r.coords);
          const avgAqi    = Math.round(aqiPoints.reduce((s, p) => s + p.aqi, 0) / aqiPoints.length);
          return { ...r, aqiPoints, avgAqi };
        })
      );

      // 4. Deduplicate
      const uniqueRoutes = routesWithAQI.filter((r, i) => {
        if (i === 0) return true;
        return !routesWithAQI.slice(0, i).some(prev =>
          Math.abs(prev.distance - r.distance) / prev.distance < 0.05
        );
      });
      const finalRoutes = uniqueRoutes.length >= 1 ? uniqueRoutes : routesWithAQI;

      // 5. Find safest
      const minAqi    = Math.min(...finalRoutes.map(r => r.avgAqi));
      const safestIdx = finalRoutes.indexOf(
        finalRoutes.filter(r => r.avgAqi === minAqi).reduce((a, b) => a.duration <= b.duration ? a : b)
      );
      let activeIndex = safestIdx;

      map.fitBounds(finalRoutes[safestIdx].coords, { padding: [50, 50] });

      // 6. Safe zones with Google Maps labels
      const allZones = await Promise.all(ZONE_OFFSETS.map(async (z, idx) => {
        const lat = origin.lat + z.dlat;
        const lng = origin.lng + z.dlng;
        const [aqi, label] = await Promise.all([fetchAQI(lat, lng), getZoneLabel(lat, lng, idx)]);
        return { label, lat, lng, aqi };
      }));
      const cleanZones = allZones.filter(z => z.aqi <= 100).sort((a, b) => a.aqi - b.aqi);

      // 7. Draw
      function drawAllRoutes(activeIdx) {
        routeLayer.clearLayers();
        markerLayer.clearLayers();

        finalRoutes.forEach((r, i) => drawColoredRoute(r.coords, r.aqiPoints, i === activeIdx));

        finalRoutes[activeIdx].aqiPoints.forEach(pt => {
          const info = aqiInfo(pt.aqi);
          L.circleMarker([pt.lat, pt.lng], {
            radius: 5, color: '#fff', weight: 1.5,
            fillColor: info.color, fillOpacity: 0.9,
          }).bindPopup(`AQI ${pt.aqi} — ${info.label}`).addTo(markerLayer);
        });

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
      }

      drawAllRoutes(activeIndex);

      // 8. Route select handler
      function onRouteSelect(i) {
        activeIndex = i;
        drawAllRoutes(i);
        updateSummary(finalRoutes[i]);
        renderRouteCards(finalRoutes, i, safestIdx, onRouteSelect);

        // Update insight for selected route
        const sel = finalRoutes[i];
        document.getElementById('sr-insight-text').textContent = 'Generating advice for this route…';
        document.getElementById('sr-insight-spinner').classList.add('active');
        fetchGroqInsight(origin.name, dest.name, sel.distance, sel.duration, sel.avgAqi, sel.aqiPoints)
          .then(result => updateInsight(result))
          .catch(() => {})
          .finally(() => document.getElementById('sr-insight-spinner').classList.remove('active'));
      }

      renderRouteCards(finalRoutes, activeIndex, safestIdx, onRouteSelect);

      // 9. Summary
      function updateSummary(r) {
        const aqiGrade = aqiInfo(r.avgAqi);
        document.getElementById('sr-distance').textContent  = formatDistance(r.distance);
        document.getElementById('sr-duration').textContent  = formatDuration(r.duration);
        document.getElementById('sr-aqi-avg').textContent   = r.avgAqi;
        document.getElementById('sr-aqi-grade').textContent = aqiGrade.label;
        document.getElementById('sr-aqi-grade').style.color = aqiGrade.color;
      }

      function updateInsight(result) {
        document.getElementById('sr-insight-text').textContent = result.insight || 'Check the map for air quality along your route.';
        const warningEl   = document.getElementById('sr-warning');
        const warningText = document.getElementById('sr-warning-text');
        if (result.warning && result.warning !== 'null') {
          warningText.textContent = result.warning;
          warningEl.style.display = 'flex';
        } else {
          warningEl.style.display = 'none';
        }
        if (result.best_time) {
          document.getElementById('sr-best-time-val').textContent = result.best_time;
          document.getElementById('sr-best-time').style.display = 'block';
        }
      }

      updateSummary(finalRoutes[activeIndex]);
      renderZoneList(cleanZones);
      resultsBox.classList.add('visible');

      // 10. Groq insight
      const safest = finalRoutes[safestIdx];
      fetchGroqInsight(origin.name, dest.name, safest.distance, safest.duration, safest.avgAqi, safest.aqiPoints)
        .then(result => updateInsight(result))
        .catch(() => { document.getElementById('sr-insight-text').textContent = 'Check the map for air quality along your route.'; })
        .finally(() => document.getElementById('sr-insight-spinner').classList.remove('active'));

    } catch (err) {
      showError(err.message || 'Something went wrong. Please try again.');
      idleBox.style.display = 'flex';
    } finally {
      setLoading(false);
    }
  }

  // ── AUTOCOMPLETE ──
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
          const suggestions = await fetchSuggestions(q, userCoords?.lat, userCoords?.lng);
          dropdown.innerHTML = '';
          if (!suggestions.length) { dropdown.classList.remove('open'); return; }
          suggestions.forEach(r => {
            const item = document.createElement('div');
            item.className = 'sr-suggestion-item';
            item.innerHTML = `${r.name}<span>${r.subtext}</span>`;
            item.addEventListener('mousedown', e => {
              e.preventDefault();
              input.value   = r.name;
              input._coords = { lat: r.lat, lng: r.lng, name: r.name };
              dropdown.classList.remove('open');
            });
            dropdown.appendChild(item);
          });
          dropdown.classList.add('open');
        } catch {}
      }, 300);
    });

    input.addEventListener('blur',  () => setTimeout(() => dropdown.classList.remove('open'), 150));
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

  // ── GEOLOCATION ──
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      userCoords = { lat, lng };
      map.setView([lat, lng], 10);

      // Pulsing blue location dot
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#4285f4;border:3px solid #fff;box-shadow:0 0 0 4px rgba(66,133,244,0.3),0 2px 8px rgba(0,0,0,0.3);animation:pulse-loc 2s ease-in-out infinite;"></div><style>@keyframes pulse-loc{0%,100%{box-shadow:0 0 0 4px rgba(66,133,244,0.3)}50%{box-shadow:0 0 0 8px rgba(66,133,244,0.1)}}</style>`,
          iconSize: [16, 16], iconAnchor: [8, 8],
        }),
        zIndexOffset: 1000,
      }).bindPopup('<b>📍 Your Location</b>').addTo(map);

      const city = await reverseGeocode(lat, lng);
      originInput.value   = city;
      originInput._coords = { lat, lng, name: city };
    }, () => {});
  }

})();