// Shared geo helpers (ported from the original index.html game logic).

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function scoreForDistance(d) {
  if (d <= 5) return 100;
  if (d <= 10) return 90;
  if (d <= 25) return 75;
  if (d <= 50) return 50;
  if (d <= 100) return 25;
  return 0;
}

export function pointAtDistance(coords, targetDist) {
  let acc = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = haversine(a[0], a[1], b[0], b[1]);
    if (acc + segLen >= targetDist) {
      const t = segLen > 0 ? (targetDist - acc) / segLen : 0;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    acc += segLen;
  }
  return coords[coords.length - 1];
}

// Sample `count` candidate points along the route, spaced out with a bit of randomness,
// avoiding the very start/end of the route.
export function sampleRoutePoints(coords, totalDist, count) {
  const pts = [];
  if (!coords || coords.length < 2 || !totalDist) return pts;
  const margin = Math.min(totalDist * 0.08, 150);
  const usable = Math.max(totalDist - margin * 2, 1);
  for (let i = 0; i < count; i++) {
    const segStart = margin + (usable * i) / count;
    const segEnd = margin + (usable * (i + 1)) / count;
    const d = segStart + Math.random() * Math.max(segEnd - segStart, 1);
    pts.push(pointAtDistance(coords, d));
  }
  return pts;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
