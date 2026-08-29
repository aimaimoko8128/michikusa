import type { Destination, RouteResult, Stop } from './types';

// In dev, Vite proxies /api and /socket.io to the backend (see vite.config.ts), so the
// default '' (same-origin) works out of the box. For a separately-hosted backend in
// production, set VITE_API_BASE to its full URL (e.g. https://api.example.com).
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export function absoluteImageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return API_BASE + path;
}

export interface GeocodeSearchResult {
  name: string | null;
  displayName: string;
  lat: number;
  lng: number;
  distance: number | null;
}

export function geocodeSearch(query: string, ref?: { lat: number; lng: number }): Promise<{ results: GeocodeSearchResult[] }> {
  const params = new URLSearchParams({ q: query });
  if (ref) {
    params.set('refLat', String(ref.lat));
    params.set('refLng', String(ref.lng));
  }
  return getJson(`/api/geocode/search?${params.toString()}`);
}

export function geocodeReverse(lat: number, lng: number, variant: 'destination' | 'stop' = 'stop'): Promise<{ name: string | null }> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), variant });
  return getJson(`/api/geocode/reverse?${params.toString()}`);
}

export function fetchRoute(origin: { lat: number; lng: number }, dest: { lat: number; lng: number }): Promise<RouteResult> {
  const params = new URLSearchParams({
    originLat: String(origin.lat),
    originLng: String(origin.lng),
    destLat: String(dest.lat),
    destLng: String(dest.lng),
  });
  return getJson(`/api/route?${params.toString()}`);
}

export interface QuizGenerateResponse {
  route: RouteResult;
  stops: Stop[];
}

export function generateQuiz(
  origin: { lat: number; lng: number },
  dest: Destination,
  count: number
): Promise<QuizGenerateResponse> {
  return postJson('/api/streetview/quiz/generate', {
    originLat: origin.lat,
    originLng: origin.lng,
    destLat: dest.lat,
    destLng: dest.lng,
    count,
  });
}

export interface LandmarksResponse {
  landmarks: { key: string; name: string; hint: string; fact: string; lat: number; lng: number; img: string }[];
  decor: Record<string, string>;
}

export function fetchLandmarks(): Promise<LandmarksResponse> {
  return getJson('/api/landmarks');
}
