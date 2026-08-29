export interface LatLng {
  lat: number;
  lng: number;
}

export interface Destination extends LatLng {
  name: string;
}

export interface Stop extends LatLng {
  key: string;
  name: string;
  hint: string;
  fact: string;
  liveImg: string; // URL (proxied through our backend, no API key exposed)
}

export interface RouteResult {
  coords: [number, number][]; // [lat,lng][]
  distance: number; // meters
  isReal: boolean;
}

export interface QuizResult {
  stopIdx: number;
  key: string;
  name: string;
  fact: string;
  targetImg: string;
  targetLat: number;
  targetLng: number;
  userImg: string; // data URL
  userGeo: LatLng | null;
  distance: number;
  score: number;
  simulated: boolean;
}

export interface HistoryEntry {
  ts: number;
  mode: 'solo' | 'group';
  destination: string;
  playerName: string;
  stopName: string;
  score: number;
  distance: number;
  userImg: string;
  targetImg: string;
}

export interface RecentRoom {
  code: string;
  destination: string;
  ts: number;
}

export interface RoomPlayer {
  name: string;
  joinedAt: number;
  score: number;
  answeredCount: number;
  finished: boolean;
}

export interface RoomHistoryEntry {
  playerId: string;
  playerName: string;
  stopIdx: number;
  stopName: string;
  score: number;
  distance: number;
  ts: number;
  userImg: string;
  targetImg: string;
}

export interface Room {
  code: string;
  hostId: string;
  status: 'waiting' | 'playing';
  destination: Destination | null;
  stopsCount: number;
  stops: Stop[];
  players: Record<string, RoomPlayer>;
  history: RoomHistoryEntry[];
}

export type ScreenId =
  | 'hero'
  | 'setup'
  | 'loading'
  | 'quiz'
  | 'reveal'
  | 'group-menu'
  | 'group-wait'
  | 'group-result'
  | 'history';
