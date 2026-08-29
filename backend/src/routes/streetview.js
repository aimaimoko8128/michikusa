import { Router } from 'express';
import { config } from '../config.js';
import { haversine, sampleRoutePoints, shuffle } from '../geo.js';

export const streetviewRouter = Router();

function streetViewImageUrl(lat, lng, heading, key) {
  return (
    'https://maps.googleapis.com/maps/api/streetview?size=720x540&location=' +
    `${lat},${lng}&fov=90&heading=${heading}&pitch=0&source=outdoor&key=${encodeURIComponent(key)}`
  );
}
function streetViewMetadataUrl(lat, lng, key) {
  return (
    `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}` +
    `&radius=300&source=outdoor&key=${encodeURIComponent(key)}`
  );
}

// Highway/tunnel/underground heuristic — a point Street View snapped to that isn't
// realistically reachable on foot (ported from isInaccessibleRoadType).
function isInaccessibleRoadType(nomData) {
  if (!nomData) return false;
  const type = String(nomData.type || '').toLowerCase();
  const cls = String(nomData.class || '').toLowerCase();
  if (cls === 'highway' && /^(motorway|trunk|motorway_link|trunk_link)$/.test(type)) return true;
  const et = nomData.extratags;
  if (et) {
    if (et.tunnel === 'yes') return true;
    if (et.highway && /^(motorway|trunk|motorway_link|trunk_link)$/.test(String(et.highway))) return true;
    if (et.layer && parseInt(et.layer, 10) < 0 && cls === 'highway') return true;
  }
  return false;
}

async function checkRoadAccessible(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&extratags=1&accept-language=ja`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await r.json();
    return !isInaccessibleRoadType(data);
  } catch {
    return true; // can't verify -> allow (avoid over-filtering)
  }
}

async function reverseGeocodeStop(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&accept-language=ja`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await r.json();
    if (!data) return null;
    const addr = data.address || {};
    return (
      addr.road ||
      addr.neighbourhood ||
      addr.suburb ||
      addr.quarter ||
      addr.city_district ||
      (data.display_name ? data.display_name.split(/[、,]/)[0] : null)
    );
  } catch {
    return null;
  }
}

// Checks whether a real Street View panorama exists near [lat,lng] (within 300m) and that
// the snapped location isn't on an inaccessible road. Returns {lat,lng,heading} or null.
async function resolveStreetViewAt(pt, key) {
  const heading = Math.floor(Math.random() * 360);
  try {
    const r = await fetch(streetViewMetadataUrl(pt[0], pt[1], key));
    const meta = await r.json();
    if (!(meta && meta.status === 'OK')) return null;
    const loc =
      meta.location && typeof meta.location.lat === 'number' && typeof meta.location.lng === 'number'
        ? meta.location
        : { lat: pt[0], lng: pt[1] };
    const ok = await checkRoadAccessible(loc.lat, loc.lng);
    if (!ok) return null;
    return { lat: loc.lat, lng: loc.lng, heading };
  } catch {
    return null;
  }
}

const HINT_VARIANTS = [
  '写真とよく似た景色を、道沿いで探してみてください。',
  '道の途中に見えるこの景色を探してみましょう。',
  'この一枚に写る景色が、道のどこかにあります。',
];

function imageProxyUrl(lat, lng, heading) {
  return `/api/streetview/image?lat=${lat}&lng=${lng}&heading=${heading}`;
}

// GET /api/streetview/image?lat=&lng=&heading=
// Proxies the actual Street View JPEG so the API key never reaches the browser.
streetviewRouter.get('/image', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const heading = Number(req.query.heading) || 0;
  if (!config.googleStreetViewKey) {
    return res.status(503).json({ error: 'GOOGLE_STREETVIEW_KEY not configured on server' });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat/lng required' });
  }
  try {
    const upstream = await fetch(streetViewImageUrl(lat, lng, heading, config.googleStreetViewKey));
    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).send(buf);
  } catch (err) {
    res.status(502).json({ error: 'street view image fetch failed', detail: String(err) });
  }
});

// POST /api/quiz/generate  { originLat, originLng, destLat, destLng, count }
// The main "build a round" endpoint: fetches the walking route, samples candidate points
// along it, keeps trying candidates until `count` of them have a confirmed, road-accessible
// Street View panorama, reverse-geocodes a label for each, and returns ready-to-play stops.
streetviewRouter.post('/quiz/generate', async (req, res) => {
  const { originLat, originLng, destLat, destLng, count } = req.body || {};
  const wantCount = Math.max(1, Math.min(10, Number(count) || 2));
  if (![originLat, originLng, destLat, destLng].every(Number.isFinite)) {
    return res.status(400).json({ error: 'originLat/originLng/destLat/destLng required' });
  }
  if (!config.googleStreetViewKey) {
    return res.status(503).json({ error: 'GOOGLE_STREETVIEW_KEY not configured on server' });
  }

  try {
    // 1. route
    const routeUrl =
      `https://router.project-osrm.org/route/v1/foot/${originLng},${originLat};${destLng},${destLat}` +
      '?overview=full&geometries=geojson';
    let route;
    try {
      const data = await Promise.race([
        fetch(routeUrl).then((r) => r.json()),
        new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), 8000)),
      ]);
      if (!data.__timeout && data.code === 'Ok' && data.routes && data.routes[0]) {
        const r = data.routes[0];
        route = {
          coords: r.geometry.coordinates.map((c) => [c[1], c[0]]),
          distance: r.distance,
          isReal: true,
        };
      } else {
        throw new Error('no route');
      }
    } catch {
      route = {
        coords: [
          [originLat, originLng],
          [destLat, destLng],
        ],
        distance: haversine(originLat, originLng, destLat, destLng),
        isReal: false,
      };
    }

    // 2. candidate points along the route
    const candidateCount = Math.min(Math.max(wantCount * 4, 8), 48);
    const candidates = shuffle(sampleRoutePoints(route.coords, route.distance, candidateCount));

    // 3. try candidates in order until we have `wantCount` confirmed Street View stops
    const confirmed = [];
    for (let i = 0; i < candidates.length && confirmed.length < wantCount; i++) {
      const hit = await resolveStreetViewAt(candidates[i], config.googleStreetViewKey);
      if (hit) confirmed.push(hit);
    }

    if (confirmed.length === 0) {
      return res.json({ route, stops: [] });
    }

    // 4. reverse-geocode a label for each confirmed stop
    const stops = await Promise.all(
      confirmed.map(async (stop, idx) => {
        const label = await reverseGeocodeStop(stop.lat, stop.lng);
        return {
          key: 'route-' + idx,
          name: label || '道中の一地点',
          hint: HINT_VARIANTS[Math.floor(Math.random() * HINT_VARIANTS.length)],
          fact: label ? `ここは「${label}」付近でした。` : '目的地までの道中にある一地点でした。',
          lat: stop.lat,
          lng: stop.lng,
          liveImg: imageProxyUrl(stop.lat, stop.lng, stop.heading),
        };
      })
    );

    res.json({ route, stops });
  } catch (err) {
    res.status(502).json({ error: 'quiz generation failed', detail: String(err) });
  }
});
