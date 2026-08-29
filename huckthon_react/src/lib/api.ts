import type { Destination, RouteResult, Stop } from './types';
import { haversine } from './geo';
import { STREETVIEW_KEY } from './config';

// Everything in this file talks directly to public, keyless services (Nominatim/OSM,
// OSRM) or to Google's Street View Static/Metadata APIs using the embedded key — the
// app is a fully static site with no backend, same as the original index.html.

const UA_HEADERS = { Accept: 'application/json' };

function firstPart(displayName: string): string | null {
  return displayName ? displayName.split(/[、,]/)[0] : null;
}

export function absoluteImageUrl(path: string): string {
  return path; // URLs from this module are already absolute (Google Street View URLs)
}

export interface GeocodeSearchResult {
  name: string | null;
  displayName: string;
  lat: number;
  lng: number;
  distance: number | null;
}

export async function geocodeSearch(query: string, ref?: { lat: number; lng: number }): Promise<{ results: GeocodeSearchResult[] }> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=8&accept-language=ja&q=' +
    encodeURIComponent(query + ' 京都');
  const res = await fetch(url, { headers: UA_HEADERS });
  const list = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  if (!Array.isArray(list) || !list.length) return { results: [] };
  const results: GeocodeSearchResult[] = list.map((item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    return {
      name: firstPart(item.display_name),
      displayName: item.display_name,
      lat,
      lng,
      distance: ref ? haversine(ref.lat, ref.lng, lat, lng) : null,
    };
  });
  if (ref) results.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  return { results };
}

interface NominatimReverse {
  name?: string;
  display_name?: string;
  address?: Record<string, string>;
}

export async function geocodeReverse(lat: number, lng: number, variant: 'destination' | 'stop' = 'stop'): Promise<{ name: string | null }> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${
    variant === 'destination' ? 16 : 17
  }&accept-language=ja`;
  try {
    const res = await fetch(url, { headers: UA_HEADERS });
    const data = (await res.json()) as NominatimReverse;
    if (!data) return { name: null };
    const addr = data.address || {};
    const name =
      variant === 'destination'
        ? data.name ||
          addr.attraction ||
          addr.tourism ||
          addr.neighbourhood ||
          addr.suburb ||
          addr.quarter ||
          addr.road ||
          addr.city_district ||
          firstPart(data.display_name || '')
        : addr.road || addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || firstPart(data.display_name || '');
    return { name: name || null };
  } catch {
    return { name: null };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | { __timeout: true }> {
  return Promise.race([promise, new Promise<{ __timeout: true }>((resolve) => setTimeout(() => resolve({ __timeout: true }), ms))]);
}

export async function fetchRoute(origin: { lat: number; lng: number }, dest: { lat: number; lng: number }): Promise<RouteResult> {
  const url =
    `https://router.project-osrm.org/route/v1/foot/${origin.lng},${origin.lat};${dest.lng},${dest.lat}` +
    '?overview=full&geometries=geojson';
  try {
    interface OsrmResponse {
      code: string;
      routes?: { geometry: { coordinates: [number, number][] }; distance: number }[];
    }
    const data = await withTimeout(fetch(url).then((r) => r.json() as Promise<OsrmResponse>), 8000);
    if (!('__timeout' in data) && data.code === 'Ok' && data.routes && data.routes[0]) {
      const r = data.routes[0];
      const coords: [number, number][] = r.geometry.coordinates.map((c) => [c[1], c[0]]);
      return { coords, distance: r.distance, isReal: true };
    }
    throw new Error('no route');
  } catch {
    return {
      coords: [
        [origin.lat, origin.lng],
        [dest.lat, dest.lng],
      ],
      distance: haversine(origin.lat, origin.lng, dest.lat, dest.lng),
      isReal: false,
    };
  }
}

// ---------------- Street View quiz generation ----------------

function pointAtDistance(coords: [number, number][], targetDist: number): [number, number] {
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

function sampleRoutePoints(coords: [number, number][], totalDist: number, count: number): [number, number][] {
  const pts: [number, number][] = [];
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

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function streetViewImageUrl(lat: number, lng: number, heading: number): string {
  return `https://maps.googleapis.com/maps/api/streetview?size=720x540&location=${lat},${lng}&fov=90&heading=${heading}&pitch=0&source=outdoor&key=${encodeURIComponent(STREETVIEW_KEY)}`;
}
function streetViewMetadataUrl(lat: number, lng: number): string {
  return `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=300&source=outdoor&key=${encodeURIComponent(STREETVIEW_KEY)}`;
}

interface NominatimExtratags {
  tunnel?: string;
  highway?: string;
  layer?: string;
}
interface NominatimData {
  type?: string;
  class?: string;
  extratags?: NominatimExtratags;
}

function isInaccessibleRoadType(nomData: NominatimData | null): boolean {
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

async function checkRoadAccessible(lat: number, lng: number): Promise<boolean> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&extratags=1&accept-language=ja`;
  try {
    const res = await fetch(url, { headers: UA_HEADERS });
    const data = (await res.json()) as NominatimData;
    return !isInaccessibleRoadType(data);
  } catch {
    return true;
  }
}

interface StreetViewMetadata {
  status: string;
  location?: { lat: number; lng: number };
}

async function resolveStreetViewAt(pt: [number, number]): Promise<{ lat: number; lng: number; heading: number } | null> {
  const heading = Math.floor(Math.random() * 360);
  try {
    const res = await fetch(streetViewMetadataUrl(pt[0], pt[1]));
    const meta = (await res.json()) as StreetViewMetadata;
    if (!(meta && meta.status === 'OK')) return null;
    const loc = meta.location && typeof meta.location.lat === 'number' && typeof meta.location.lng === 'number' ? meta.location : { lat: pt[0], lng: pt[1] };
    const ok = await checkRoadAccessible(loc.lat, loc.lng);
    if (!ok) return null;
    return { lat: loc.lat, lng: loc.lng, heading };
  } catch {
    return null;
  }
}

const HINT_VARIANTS = ['写真とよく似た景色を、道沿いで探してみてください。', '道の途中に見えるこの景色を探してみましょう。', 'この一枚に写る景色が、道のどこかにあります。'];

export interface QuizGenerateResponse {
  route: RouteResult;
  stops: Stop[];
}

export async function generateQuiz(origin: { lat: number; lng: number }, dest: Destination, count: number): Promise<QuizGenerateResponse> {
  const wantCount = Math.max(1, Math.min(10, count));
  const route = await fetchRoute(origin, dest);

  const candidateCount = Math.min(Math.max(wantCount * 4, 8), 48);
  const candidates = shuffle(sampleRoutePoints(route.coords, route.distance, candidateCount));

  const confirmed: { lat: number; lng: number; heading: number }[] = [];
  for (let i = 0; i < candidates.length && confirmed.length < wantCount; i++) {
    const hit = await resolveStreetViewAt(candidates[i]);
    if (hit) confirmed.push(hit);
  }

  if (confirmed.length === 0) return { route, stops: [] };

  const stops = await Promise.all(
    confirmed.map(async (stop, idx) => {
      const { name: label } = await geocodeReverse(stop.lat, stop.lng, 'stop');
      const s: Stop = {
        key: 'route-' + idx,
        name: label || '道中の一地点',
        hint: HINT_VARIANTS[Math.floor(Math.random() * HINT_VARIANTS.length)],
        fact: label ? `ここは「${label}」付近でした。` : '目的地までの道中にある一地点でした。',
        lat: stop.lat,
        lng: stop.lng,
        liveImg: streetViewImageUrl(stop.lat, stop.lng, stop.heading),
      };
      return s;
    })
  );

  return { route, stops };
}
