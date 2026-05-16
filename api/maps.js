// api/maps.js
// Proxy for Google Maps API — hides API key from frontend

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, q, lat, lng, radius } = req.query;
  const KEY = process.env.GOOGLE_MAPS_KEY;

  if (!KEY) return res.status(500).json({ error: 'API key not configured' });

  try {
    let url;

    if (type === 'autocomplete') {
      // Places Autocomplete
      url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${KEY}&language=en${lat ? `&location=${lat},${lng}&radius=${radius || 50000}` : ''}`;
    } else if (type === 'geocode') {
      // Geocoding — address to coordinates
      url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${KEY}`;
    } else if (type === 'reverse') {
      // Reverse geocoding — coordinates to address
      url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${KEY}`;
    } else if (type === 'details') {
      // Place details by place_id
      url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${q}&fields=geometry,name,formatted_address&key=${KEY}`;
    } else {
      return res.status(400).json({ error: 'Invalid type parameter' });
    }

    const response = await fetch(url);
    const data     = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Maps API request failed' });
  }
}