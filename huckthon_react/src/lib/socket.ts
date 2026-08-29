import { io, type Socket } from 'socket.io-client';
import type { Destination, Room, Stop } from './types';

const SOCKET_BASE = import.meta.env.VITE_API_BASE ?? undefined;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_BASE, { autoConnect: true });
  }
  return socket;
}

interface Ack {
  error?: string;
}

export function createRoom(playerId: string, playerName: string): Promise<{ room: Room }> {
  return new Promise((resolve, reject) => {
    getSocket().emit('room:create', { playerId, playerName }, (res: Ack & { room?: Room }) => {
      if (res.error || !res.room) reject(new Error(res.error || 'unknown error'));
      else resolve({ room: res.room });
    });
  });
}

export function joinRoom(roomCode: string, playerId: string, playerName: string): Promise<{ room: Room }> {
  return new Promise((resolve, reject) => {
    getSocket().emit('room:join', { roomCode, playerId, playerName }, (res: Ack & { room?: Room }) => {
      if (res.error || !res.room) reject(new Error(res.error || 'unknown error'));
      else resolve({ room: res.room });
    });
  });
}

export function startQuizOnRoom(roomCode: string, playerId: string, destination: Destination, stops: Stop[]): Promise<void> {
  return new Promise((resolve, reject) => {
    getSocket().emit('room:start-quiz', { roomCode, playerId, destination, stops }, (res: Ack) => {
      if (res.error) reject(new Error(res.error));
      else resolve();
    });
  });
}

export interface SubmitAnswerPayload {
  stopIdx: number;
  score: number;
  distance: number;
  stopName: string;
  userImgThumb: string;
  targetImg: string;
}

export function submitAnswerToRoom(roomCode: string, playerId: string, answer: SubmitAnswerPayload): Promise<void> {
  return new Promise((resolve, reject) => {
    getSocket().emit('room:submit-answer', { roomCode, playerId, answer }, (res: Ack) => {
      if (res.error) reject(new Error(res.error));
      else resolve();
    });
  });
}

export function getRoomSnapshot(roomCode: string): Promise<{ room: Room }> {
  return new Promise((resolve, reject) => {
    getSocket().emit('room:get', { roomCode }, (res: Ack & { room?: Room }) => {
      if (res.error || !res.room) reject(new Error(res.error || 'unknown error'));
      else resolve({ room: res.room });
    });
  });
}

export function leaveRoomSocket(roomCode: string, playerId: string): void {
  getSocket().emit('room:leave', { roomCode, playerId });
}

export function onRoomUpdate(cb: (room: Room) => void): () => void {
  const s = getSocket();
  s.on('room:update', cb);
  return () => s.off('room:update', cb);
}

export function onRevealReady(cb: () => void): () => void {
  const s = getSocket();
  s.on('room:reveal-ready', cb);
  return () => s.off('room:reveal-ready', cb);
}
