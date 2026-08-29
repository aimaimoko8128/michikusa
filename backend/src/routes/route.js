import { Router } from 'express';
import { haversine } from '../geo.js';

export const routeRouter = Router();

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), ms)),
  ]);
}

// GET /api/route?originLat&originLng&destLat&destLng
// Proxies OSRM's free foot-routing service. Falls back to a straight line between the
// two points if OSRM is slow/unavailable (matches the original client-side behaviour).
routeRouter.get('/', async (req, res) => {
  const originLat = Number(req.query.originLat);
  const originLng = Number(req.query.originLng);
  const destLat = Number(req.query.destLat);
  const destLng = Number(req.query.destLng);
  if (![originLat, originLng, destLat, destLng].every(Number.isFinite)) {
    return res.status(400).json({ error: 'originLat/originLng/destLat/destLng required' });
  }

  const url =
    `https://router.project-osrm.org/route/v1/foot/${originLng},${originLat};${destLng},${destLat}` +
    '?overview=full&geometries=geojson';

  try {
    const data = await withTimeout(fetch(url).then((r) => r.json()), 8000);
    if (!data.__timeout && data.code === 'Ok' && data.routes && data.routes[0]) {
      const r = data.routes[0];
      const coords = r.geometry.coordinates.map((c) => [c[1], c[0]]); // [lng,lat] -> [lat,lng]
      return res.json({ coords, distance: r.distance, isReal: true });
    }
    throw new Error(data.__timeout ? 'osrm timeout' : `no route: ${data.code}`);
  } catch (err) {
    // Route service unavailable — fall back to a straight line, like the original app did.
    res.json({
      coords: [
        [originLat, originLng],
        [destLat, destLng],
      ],
      distance: haversine(originLat, originLng, destLat, destLng),
      isReal: false,
      fallbackReason: String(err && err.message ? err.message : err),
    });
  }
});
