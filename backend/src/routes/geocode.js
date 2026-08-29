import { Router } from 'express';
import { haversine } from '../geo.js';

export const geocodeRouter = Router();

const UA_HEADERS = { Accept: 'application/json' };

function firstPart(displayName) {
  return displayName ? displayName.split(/[、,]/)[0] : null;
}

// GET /api/geocode/search?q=...&refLat=&refLng=
// Proxies Nominatim search (destination search box), sorted by distance to a reference
// point (the player's current location, or a fallback) so the closest match can be
// auto-selected by the frontend.
geocodeRouter.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });
  const refLat = Number(req.query.refLat);
  const refLng = Number(req.query.refLng);
  const hasRef = Number.isFinite(refLat) && Number.isFinite(refLng);

  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=8&accept-language=ja&q=' +
    encodeURIComponent(q + ' 京都');
  try {
    const r = await fetch(url, { headers: UA_HEADERS });
    const list = await r.json();
    if (!Array.isArray(list) || !list.length) {
      return res.json({ results: [] });
    }
    const results = list.map((item) => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      return {
        name: firstPart(item.display_name),
        displayName: item.display_name,
        lat,
        lng,
        distance: hasRef ? haversine(refLat, refLng, lat, lng) : null,
      };
    });
    if (hasRef) results.sort((a, b) => a.distance - b.distance);
    res.json({ results });
  } catch (err) {
    res.status(502).json({ error: 'geocode search failed', detail: String(err) });
  }
});

// GET /api/geocode/reverse?lat=&lng=&variant=destination|stop
// variant "destination": used when the player picks a point on the map as their destination.
// variant "stop" (default): used to label a quiz stop point along the route.
geocodeRouter.get('/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const variant = req.query.variant === 'destination' ? 'destination' : 'stop';
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat/lng required' });
  }
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${
    variant === 'destination' ? 16 : 17
  }&accept-language=ja`;
  try {
    const r = await fetch(url, { headers: UA_HEADERS });
    const data = await r.json();
    let name = null;
    if (data) {
      const addr = data.address || {};
      if (variant === 'destination') {
        name =
          data.name ||
          addr.attraction ||
          addr.tourism ||
          addr.neighbourhood ||
          addr.suburb ||
          addr.quarter ||
          addr.road ||
          addr.city_district ||
          firstPart(data.display_name);
      } else {
        name =
          addr.road ||
          addr.neighbourhood ||
          addr.suburb ||
          addr.quarter ||
          addr.city_district ||
          firstPart(data.display_name);
      }
    }
    res.json({ name: name || null });
  } catch (err) {
    res.status(502).json({ error: 'reverse geocode failed', detail: String(err) });
  }
});
