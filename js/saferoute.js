// saferoute.js — Leaflet version
// Requires: API_KEY (OpenWeather), GROQ_KEY from config.js

(function () {
  'use strict';

  // ── CONFIG ──────────────────────────────────────────────
  const OW_BASE  = 'https://api.openweathermap.org/data/2.5/air_pollution';
  const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL = 'llama-3.1-8b-instant';

  const ZONE_OFFSETS = [
    { label: 'City Park North',  dlat:  0.015, dlng:  0.005 },
    { label: 'Riverside Walk',   dlat: -0.010, dlng:  0.018 },
    { label: 'Green Belt East',  dlat:  0.008, dlng: -0.020 },
    { label: 'West Commons',     dlat: -0.018, dlng: -0.008 },
    { label: 'Central Gardens',  dlat:  0.002, dlng:  0.012 },
    { label: 'Hillside Reserve', dlat:  0.022, dlng:  0.003 },
  ];

  const ROUTES = [
    { name: 'Greenway Route', emoji: '🌿', shift: [  0.004,  0.002 ] },
    { name: 'Main Road',      emoji: '🏙️', shift: [  0,      0     ] },
    { name: 'Riverside Path', emoji: '💧', shift: [ -0.006, -0.003 ] },
  ];

  // ── DOM ─────────────────────────────────────────────────
  const originInput = document.getElementById('sr-origin');
  const destInput   = document.getElementById('sr-dest');
  const goBtn       = document.getElementById('sr-go-btn');
  const resultBox   = document.getElementById('sr-result');
  const routeList   = document.getElementById('sr-route-list');
  const zoneList    = document.getElementById('sr-zone-list');
  const insightBox  = document.getElementById('sr-insight');
  const insightText = document.getElementById('sr-insight-text');
  const errorBox    = document.getElementById('sr-error');

  // ── MAP INIT ────────────────────────────────────────────
  const isDark = document.body.classList.contains('dark');

  const map = L.map('saferoute-map', { zoomControl: false }).setView([20.5937, 78.9629], 5);

  const lightTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', maxZoom: 19
  });
  const darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', maxZoom: 19
  });

  (isDark ? darkTile : lightTile).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);

  // ── STATE ───────────────────────────────────────────────
  let activeRouteIndex = 0;
  let routePolylines   = [];
  let markerLayer      = L.layerGroup().addTo(map);
  let routeData        = [];
  let userCoords       = null; // set when geolocation succeeds

  // ── HELPERS ─────────────────────────────────────────────
  function aqiCategory(aqi) {
    const m = { 1: 25, 2: 65, 3: 110, 4: 160, 5: 220 };
    return m[aqi] || aqi * 40;
  }

  function aqiLabel(val) {
    if (val <= 50)  return { label: 'Good',     cls: 'good',     badgeCls: 'safe',   color: '#27ae60' };
    if (val <= 100) return { label: 'Moderate', cls: 'moderate', badgeCls: 'medium', color: '#f39c12' };
    return              { label: 'Poor',     cls: 'poor',     badgeCls: 'risky',  color: '#e74c3c' };
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('visible');
    setTimeout(() => errorBox.classList.remove('visible'), 5000);
  }

  function clearError() { errorBox.classList.remove('visible'); }

  function setLoading(on) {
    goBtn.classList.toggle('loading', on);
    goBtn.disabled = on;
  }

  function clearMap() {
    routePolylines.forEach(p => map.removeLayer(p));
    routePolylines = [];
    markerLayer.clearLayers();
  }

  // ── GEOCODE ─────────────────────────────────────────────
  async function geocode(query) {
    const url  = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'BreatheSafe/1.0' } });
    const data = await res.json();
    if (!data.length) throw new Error(`Could not find "${query}". Try a place name or area.`);
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name.split(',')[0] };
  }

  // ── FETCH AQI ───────────────────────────────────────────
  async function fetchAQI(lat, lng) {
    const url  = `${OW_BASE}?lat=${lat}&lon=${lng}&appid=${API_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    const raw  = data?.list?.[0]?.main?.aqi ?? 2;
    return aqiCategory(raw);
  }

  // ── BUILD ROUTE COORDS ───────────────────────────────────
  function buildRouteCoords(origin, dest, shift) {
    const pts = 20, coords = [];
    for (let i = 0; i <= pts; i++) {
      const t    = i / pts;
      const bell = 4 * t * (1 - t);
      coords.push([
        origin.lat + (dest.lat - origin.lat) * t + shift[0] * bell,
        origin.lng + (dest.lng - origin.lng) * t + shift[1] * bell,
      ]);
    }
    return coords;
  }

  // ── DRAW ROUTES ─────────────────────────────────────────
  function drawRoutes(origin, dest, aqis) {
    routePolylines.forEach(p => map.removeLayer(p));
    routePolylines = [];

    ROUTES.forEach((route, i) => {
      const coords   = buildRouteCoords(origin, dest, route.shift);
      const info     = aqiLabel(aqis[i]);
      const isActive = i === activeRouteIndex;

      const poly = L.polyline(coords, {
        color:     info.color,
        weight:    isActive ? 5 : 3,
        opacity:   isActive ? 1 : 0.4,
        dashArray: isActive ? null : '6, 8',
      }).addTo(map);

      poly.on('click', () => {
        activeRouteIndex = i;
        updateRouteVisuals(aqis);
        document.querySelectorAll('.sr-route-card').forEach((c, j) => c.classList.toggle('active', j === i));
      });

      routePolylines.push(poly);
    });
  }

  function updateRouteVisuals(aqis) {
    routePolylines.forEach((poly, i) => {
      const isActive = i === activeRouteIndex;
      poly.setStyle({
        weight:    isActive ? 5 : 3,
        opacity:   isActive ? 1 : 0.4,
        dashArray: isActive ? null : '6, 8',
      });
    });
  }

  // ── CUSTOM MARKER ICONS ──────────────────────────────────
  function pinIcon(color) {
    return L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
  }

  function zoneIcon(aqiVal, color) {
    return L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;border-radius:50%;background:${color}33;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:${color};font-family:DM Sans,sans-serif;">${aqiVal}</div>`,
      iconSize: [22, 22], iconAnchor: [11, 11],
    });
  }

  // ── RENDER ROUTE CARDS ────────────────────────────────────
  function renderRouteCards(aqis) {
    routeList.innerHTML = '';
    ROUTES.forEach((route, i) => {
      const val  = aqis[i];
      const info = aqiLabel(val);
      const card = document.createElement('div');
      card.className = `sr-route-card${i === activeRouteIndex ? ' active' : ''}`;
      card.innerHTML = `
        <div class="sr-route-badge ${info.badgeCls}">${route.emoji}</div>
        <div class="sr-route-info">
          <div class="sr-route-name">${route.name}</div>
          <div class="sr-route-meta">Avg AQI · ${info.label}</div>
        </div>
        <div class="sr-route-aqi ${info.cls}">${val}</div>
      `;
      card.addEventListener('click', () => {
        activeRouteIndex = i;
        updateRouteVisuals(aqis);
        document.querySelectorAll('.sr-route-card').forEach((c, j) => c.classList.toggle('active', j === i));
      });
      routeList.appendChild(card);
    });
    resultBox.classList.add('visible');
  }

  // ── RENDER ZONE LIST ─────────────────────────────────────
  function renderZoneList(zones) {
    zoneList.innerHTML = '';
    if (!zones.length) {
      zoneList.innerHTML = '<div class="sr-empty"><div class="sr-empty-icon">😶‍🌫️</div>No clean zones found nearby right now.</div>';
      return;
    }
    zones.forEach(z => {
      const info = aqiLabel(z.aqi);
      const item = document.createElement('div');
      item.className = 'sr-zone-item';
      item.innerHTML = `
        <span class="sr-zone-dot ${info.cls}"></span>
        <span class="sr-zone-name">${z.label}</span>
        <span class="sr-zone-aqi">AQI ${z.aqi}</span>
      `;
      item.addEventListener('click', () => map.flyTo([z.lat, z.lng], 14));
      zoneList.appendChild(item);
    });
  }

  // ── GROQ INSIGHT ─────────────────────────────────────────
  async function fetchGroqInsight(originName, destName, bestRoute, bestAqi, zones) {
    const profile = {
      name:        localStorage.getItem('bs-name') || 'the user',
      conditions:  localStorage.getItem('bs-conditions') || 'none',
      sensitivity: localStorage.getItem('bs-sensitivity') || 'medium',
    };
    const cleanZones = zones.slice(0, 2).map(z => `${z.label} (AQI ${z.aqi})`).join(', ') || 'none';
    const prompt = `You are a health-aware air quality assistant for the BreatheSafe app.
User profile: name=${profile.name}, respiratory conditions=${profile.conditions}, pollution sensitivity=${profile.sensitivity}.
They are travelling from "${originName}" to "${destName}".
Best route: "${bestRoute}" with average AQI ${bestAqi}. Nearby clean zones: ${cleanZones}.
Write a friendly, personalised 2-sentence travel tip based on their health profile. No bullet points.`;

    const res  = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: GROQ_MODEL, max_tokens: 120, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  }

  // ── MAIN FLOW ────────────────────────────────────────────
  async function findRoutes() {
    const originQ = originInput.value.trim();
    const destQ   = destInput.value.trim();
    if (!originQ || !destQ) { showError('Please enter both origin and destination.'); return; }
    clearError();
    setLoading(true);
    clearMap();

    try {
      let origin;
      if (originQ.toLowerCase() === 'current location' && userCoords) {
        origin = { lat: userCoords.lat, lng: userCoords.lng, name: 'Your Location' };
      } else if (originInput._coords) {
        origin = originInput._coords;
      } else {
        origin = await geocode(originQ);
      }

      let dest;
      if (destInput._coords) {
        dest = destInput._coords;
      } else {
        dest = await geocode(destQ);
      }

      map.fitBounds([[origin.lat, origin.lng], [dest.lat, dest.lng]], { padding: [60, 60] });

      const routeAqiPromises = ROUTES.map(route => {
        const midLat = (origin.lat + dest.lat) / 2 + route.shift[0];
        const midLng = (origin.lng + dest.lng) / 2 + route.shift[1];
        return fetchAQI(midLat, midLng);
      });

      const zonePromises = ZONE_OFFSETS.map(async z => {
        const lat = origin.lat + z.dlat;
        const lng = origin.lng + z.dlng;
        const aqi = await fetchAQI(lat, lng);
        return { label: z.label, lat, lng, aqi };
      });

      const [routeAqis, allZones] = await Promise.all([
        Promise.all(routeAqiPromises),
        Promise.all(zonePromises),
      ]);

      activeRouteIndex = routeAqis.indexOf(Math.min(...routeAqis));
      routeData = routeAqis;

      const cleanZones = allZones.filter(z => z.aqi <= 100).sort((a, b) => a.aqi - b.aqi);

      drawRoutes(origin, dest, routeAqis);

      L.marker([origin.lat, origin.lng], { icon: pinIcon('#C65D07') })
        .bindPopup(`<b>📍 ${origin.name}</b>`).addTo(markerLayer);
      L.marker([dest.lat, dest.lng], { icon: pinIcon('#2a9d8f') })
        .bindPopup(`<b>🏁 ${dest.name}</b>`).addTo(markerLayer);

      cleanZones.forEach(z => {
        const info = aqiLabel(z.aqi);
        L.marker([z.lat, z.lng], { icon: zoneIcon(z.aqi, info.color) })
          .bindPopup(`<b>${z.label}</b><br>AQI ${z.aqi} — ${info.label}`)
          .addTo(markerLayer);
      });

      renderRouteCards(routeAqis);
      renderZoneList(cleanZones);

      const bestRoute = ROUTES[activeRouteIndex].name;
      const bestAqi   = routeAqis[activeRouteIndex];
      fetchGroqInsight(origin.name, dest.name, bestRoute, bestAqi, cleanZones)
        .then(text => {
          if (text) { insightText.textContent = text; insightBox.classList.add('visible'); }
        }).catch(() => {});

    } catch (err) {
      showError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── AUTOCOMPLETE ─────────────────────────────────────────
  function setupAutocomplete(input) {
    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'sr-suggestions';
    input.parentElement.appendChild(dropdown);

    let debounceTimer = null;
    let selectedCoords = null;

    async function fetchSuggestions(query) {
      if (query.length < 3) { dropdown.classList.remove('open'); return; }
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
        const res  = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'BreatheSafe/1.0' } });
        const data = await res.json();
        renderSuggestions(data);
      } catch (e) { dropdown.classList.remove('open'); }
    }

    function renderSuggestions(results) {
      dropdown.innerHTML = '';
      if (!results.length) { dropdown.classList.remove('open'); return; }
      results.forEach(r => {
        const item = document.createElement('div');
        item.className = 'sr-suggestion-item';
        const name    = r.display_name.split(',')[0];
        const subtext = r.display_name.split(',').slice(1, 3).join(',').trim();
        item.innerHTML = `${name}<span>${subtext}</span>`;
        item.addEventListener('mousedown', e => {
          e.preventDefault(); // prevent blur before click
          input.value = name;
          // Store coords on the input element for use in findRoutes
          input._coords = { lat: parseFloat(r.lat), lng: parseFloat(r.lng), name };
          dropdown.classList.remove('open');
        });
        dropdown.appendChild(item);
      });
      dropdown.classList.add('open');
    }

    input.addEventListener('input', () => {
      input._coords = null; // clear stored coords on manual type
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchSuggestions(input.value.trim()), 300);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('open'), 150);
    });

    input.addEventListener('focus', () => {
      if (dropdown.children.length) dropdown.classList.add('open');
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') dropdown.classList.remove('open');
      if (e.key === 'Enter') { dropdown.classList.remove('open'); findRoutes(); }
    });
  }

  setupAutocomplete(originInput);
  setupAutocomplete(destInput);

  // ── EVENTS ────────────────────────────────────────────────
  goBtn.addEventListener('click', findRoutes);

  // Sync tile layer with dark mode toggle
  document.addEventListener('bs-theme-change', () => {
    const dark = document.body.classList.contains('dark');
    if (dark) { map.removeLayer(lightTile); darkTile.addTo(map); }
    else       { map.removeLayer(darkTile); lightTile.addTo(map); }
  });

  // Pre-fill origin via geolocation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      userCoords = { lat, lng };
      originInput.value = 'Current Location';
      map.setView([lat, lng], 12);
    }, () => {});
  }

})();