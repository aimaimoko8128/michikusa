// In-memory group-battle rooms (replaces the original Firebase Realtime Database usage).
// Rooms live only as long as the server process — that matches the original demo's
// "temporary Firebase test-mode database" scope.

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O, 1/I
const HISTORY_MAX = 200;

const rooms = new Map(); // code -> room

function makeRoomCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    destination: room.destination,
    stopsCount: room.stopsCount,
    stops: room.stops,
    players: room.players,
    history: room.history,
  };
}

export function createRoom(playerId, playerName) {
  const code = makeRoomCode();
  const room = {
    code,
    hostId: playerId,
    status: 'waiting',
    createdAt: Date.now(),
    destination: null,
    stopsCount: 0,
    stops: [],
    players: {
      [playerId]: { name: playerName, joinedAt: Date.now(), score: 0, answeredCount: 0, finished: false },
    },
    history: [],
  };
  rooms.set(code, room);
  return room;
}

export function joinRoom(code, playerId, playerName) {
  const room = rooms.get(code);
  if (!room) return { error: 'そのルームコードは見つかりませんでした' };
  room.players[playerId] = { name: playerName, joinedAt: Date.now(), score: 0, answeredCount: 0, finished: false };
  return { room };
}

export function getRoom(code) {
  return rooms.get(code) || null;
}

export function startQuiz(code, playerId, destination, stops) {
  const room = rooms.get(code);
  if (!room) return { error: 'ルームが見つかりません' };
  if (room.hostId !== playerId) return { error: 'ホストのみ開始できます' };
  room.destination = destination;
  room.stops = stops;
  room.stopsCount = stops.length;
  room.status = 'playing';
  // reset per-round player progress in case of a replay
  Object.values(room.players).forEach((p) => {
    p.score = 0;
    p.answeredCount = 0;
    p.finished = false;
  });
  return { room };
}

export function submitAnswer(code, playerId, { stopIdx, score, distance, stopName, userImgThumb, targetImg }) {
  const room = rooms.get(code);
  if (!room) return { error: 'ルームが見つかりません' };
  const player = room.players[playerId];
  if (!player) return { error: 'プレイヤーが見つかりません' };

  // recompute total score & answered count from history so re-takes overwrite cleanly
  room.history = room.history.filter((h) => !(h.playerId === playerId && h.stopIdx === stopIdx));
  room.history.unshift({
    playerId,
    playerName: player.name,
    stopIdx,
    stopName,
    score,
    distance,
    ts: Date.now(),
    userImg: userImgThumb,
    targetImg,
  });
  if (room.history.length > HISTORY_MAX) room.history.length = HISTORY_MAX;

  const mine = room.history.filter((h) => h.playerId === playerId);
  player.score = mine.reduce((s, h) => s + h.score, 0);
  player.answeredCount = mine.length;
  player.finished = mine.length >= room.stopsCount;

  const allFinished = Object.values(room.players).every((p) => p.finished);
  return { room, allFinished };
}

export function leaveRoom(code, playerId) {
  const room = rooms.get(code);
  if (!room) return;
  delete room.players[playerId];
  if (Object.keys(room.players).length === 0) {
    rooms.delete(code);
    return;
  }
  if (room.hostId === playerId) {
    room.hostId = Object.keys(room.players)[0];
  }
}

export { publicRoom };
