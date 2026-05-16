// api/weather.js
// Proxy for OpenWeather API — hides API key from frontend

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, lat, lon, q, limit } = req.query;
  const KEY = process.env.OPENWEATHER_KEY;

  if (!KEY) return res.status(500).json({ error: 'API key not configured' });

  try {
    let url;

    if (type === 'weather') {
      url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${KEY}&units=metric`;
    } else if (type === 'aqi') {
      url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${KEY}`;
    } else if (type === 'geo') {
      url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=${limit || 5}&appid=${KEY}`;
    } else if (type === 'reverse') {
      url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${KEY}`;
    } else if (type === 'uvi') {
      url = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${KEY}`;
    } else {
      return res.status(400).json({ error: 'Invalid type parameter' });
    }

    const response = await fetch(url);
    const data     = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Weather API request failed' });
  }
}