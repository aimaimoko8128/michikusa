import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, onValue, off, push, type DatabaseReference } from 'firebase/database';
import type { Destination, Room, RoomHistoryEntry, RoomPlayer, Stop } from './types';
import { FIREBASE_CONFIG } from './config';

// Group-battle rooms, synced via Firebase Realtime Database — this mirrors what the
// original index.html did directly from the browser (no backend involved).

const app = initializeApp(FIREBASE_CONFIG);
const db = getDatabase(app);

function roomRef(code: string): DatabaseReference {
  return ref(db, 'rooms/' + code);
}

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O, 1/I
function randomCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  return s;
}
async function makeUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const snap = await get(roomRef(code));
    if (!snap.exists()) return code;
  }
  return randomCode() + Math.floor(Math.random() * 9);
}

interface RawRoom {
  hostId: string;
  status?: 'waiting' | 'playing';
  destination?: Destination | null;
  stopsCount?: number;
  stops?: Stop[];
  players?: Record<string, RoomPlayer>;
  history?: Record<string, RoomHistoryEntry>;
}

function normalizeRoom(code: string, val: RawRoom): Room {
  return {
    code,
    hostId: val.hostId,
    status: val.status || 'waiting',
    destination: val.destination || null,
    stopsCount: val.stopsCount || 0,
    stops: val.stops || [],
    players: val.players || {},
    history: val.history ? Object.values(val.history) : [],
  };
}

// ---- live subscription plumbing ----
let currentRoomCode: string | null = null;
let detach: (() => void) | null = null;
const roomUpdateCallbacks = new Set<(room: Room) => void>();
const revealCallbacks = new Set<() => void>();
let lastAllFinished = false;

function attachListener(code: string) {
  if (currentRoomCode === code && detach) return;
  detach?.();
  currentRoomCode = code;
  lastAllFinished = false;
  const r = roomRef(code);
  const handler = (snap: import('firebase/database').DataSnapshot) => {
    const val = snap.val() as RawRoom | null;
    if (!val) return;
    const room = normalizeRoom(code, val);
    roomUpdateCallbacks.forEach((fn) => fn(room));
    const pids = Object.keys(room.players);
    const allFinished = pids.length > 0 && pids.every((pid) => room.players[pid].finished);
    if (allFinished && !lastAllFinished) revealCallbacks.forEach((fn) => fn());
    lastAllFinished = allFinished;
  };
  onValue(r, handler);
  detach = () => off(r, 'value', handler);
}

export function onRoomUpdate(cb: (room: Room) => void): () => void {
  roomUpdateCallbacks.add(cb);
  return () => roomUpdateCallbacks.delete(cb);
}

export function onRevealReady(cb: () => void): () => void {
  revealCallbacks.add(cb);
  return () => revealCallbacks.delete(cb);
}

export async function createRoom(playerId: string, playerName: string): Promise<{ room: Room }> {
  const code = await makeUniqueRoomCode();
  const data: RawRoom = {
    hostId: playerId,
    status: 'waiting',
    players: {
      [playerId]: { name: playerName, joinedAt: Date.now(), score: 0, answeredCount: 0, finished: false },
    },
  };
  await set(roomRef(code), data);
  attachListener(code);
  return { room: normalizeRoom(code, data) };
}

export async function joinRoom(roomCode: string, playerId: string, playerName: string): Promise<{ room: Room }> {
  const snap = await get(roomRef(roomCode));
  if (!snap.exists()) throw new Error('そのルームコードは見つかりませんでした');
  await update(ref(db, `rooms/${roomCode}/players/${playerId}`), {
    name: playerName,
    joinedAt: Date.now(),
    score: 0,
    answeredCount: 0,
    finished: false,
  } as RoomPlayer);
  const fresh = await get(roomRef(roomCode));
  attachListener(roomCode);
  return { room: normalizeRoom(roomCode, fresh.val() as RawRoom) };
}

export async function startQuizOnRoom(roomCode: string, playerId: string, destination: Destination, stops: Stop[]): Promise<void> {
  const snap = await get(roomRef(roomCode));
  const val = snap.val() as RawRoom | null;
  if (!val) throw new Error('ルームが見つかりません');
  if (val.hostId !== playerId) throw new Error('ホストのみ開始できます');
  const resetPlayers: Record<string, RoomPlayer> = {};
  Object.entries(val.players || {}).forEach(([pid, p]) => {
    resetPlayers[pid] = { ...p, score: 0, answeredCount: 0, finished: false };
  });
  await update(roomRef(roomCode), {
    destination,
    stops,
    stopsCount: stops.length,
    status: 'playing',
    players: resetPlayers,
  });
}

export interface SubmitAnswerPayload {
  stopIdx: number;
  score: number;
  distance: number;
  stopName: string;
  userImgThumb: string;
  targetImg: string;
  totalScore: number;
  answeredCount: number;
  finished: boolean;
}

export async function submitAnswerToRoom(roomCode: string, playerId: string, playerName: string, answer: SubmitAnswerPayload): Promise<void> {
  await update(ref(db, `rooms/${roomCode}/players/${playerId}`), {
    score: answer.totalScore,
    answeredCount: answer.answeredCount,
    finished: answer.finished,
  });
  const historyEntry: RoomHistoryEntry = {
    playerId,
    playerName,
    stopIdx: answer.stopIdx,
    stopName: answer.stopName,
    score: answer.score,
    distance: answer.distance,
    ts: Date.now(),
    userImg: answer.userImgThumb,
    targetImg: answer.targetImg,
  };
  await push(ref(db, `rooms/${roomCode}/history`), historyEntry);
}

export async function getRoomSnapshot(roomCode: string): Promise<{ room: Room }> {
  const snap = await get(roomRef(roomCode));
  if (!snap.exists()) throw new Error('ルームが見つかりません');
  return { room: normalizeRoom(roomCode, snap.val() as RawRoom) };
}

export function leaveRoomSocket(): void {
  // Matches the original behaviour: leaving just stops listening locally — the player
  // entry (and their scores/history) stays in the room for others to see.
  detach?.();
  detach = null;
  currentRoomCode = null;
}
