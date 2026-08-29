import { createRoom, joinRoom, getRoom, startQuiz, submitAnswer, leaveRoom, publicRoom } from './roomManager.js';

// Wires the in-memory room manager up to Socket.IO. Each connected client joins the
// Socket.IO room matching the game room code, so `io.to(code).emit(...)` reaches every
// player currently in that game room (this is what replaces Firebase's realtime listener).
export function registerRoomSocketHandlers(io, socket) {
  function broadcast(code) {
    const room = getRoom(code);
    if (room) io.to(code).emit('room:update', publicRoom(room));
  }

  socket.on('room:create', ({ playerId, playerName }, cb) => {
    if (!playerId || !playerName) return cb?.({ error: 'playerId/playerName required' });
    const room = createRoom(playerId, playerName);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerId = playerId;
    cb?.({ room: publicRoom(room) });
  });

  socket.on('room:join', ({ roomCode, playerId, playerName }, cb) => {
    if (!roomCode || !playerId || !playerName) return cb?.({ error: 'roomCode/playerId/playerName required' });
    const { room, error } = joinRoom(String(roomCode).toUpperCase(), playerId, playerName);
    if (error) return cb?.({ error });
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerId = playerId;
    cb?.({ room: publicRoom(room) });
    broadcast(room.code);
  });

  socket.on('room:start-quiz', ({ roomCode, playerId, destination, stops }, cb) => {
    const { room, error } = startQuiz(roomCode, playerId, destination, stops);
    if (error) return cb?.({ error });
    cb?.({ ok: true });
    broadcast(room.code);
  });

  socket.on('room:submit-answer', ({ roomCode, playerId, answer }, cb) => {
    const { room, error, allFinished } = submitAnswer(roomCode, playerId, answer);
    if (error) return cb?.({ error });
    cb?.({ ok: true });
    broadcast(room.code);
    if (allFinished) io.to(room.code).emit('room:reveal-ready');
  });

  socket.on('room:get', ({ roomCode }, cb) => {
    const room = getRoom(roomCode);
    if (!room) return cb?.({ error: 'ルームが見つかりません' });
    cb?.({ room: publicRoom(room) });
  });

  socket.on('room:leave', ({ roomCode, playerId }) => {
    if (!roomCode || !playerId) return;
    leaveRoom(roomCode, playerId);
    socket.leave(roomCode);
    broadcast(roomCode);
  });

  socket.on('disconnect', () => {
    // Players are intentionally NOT removed from the room on disconnect (a phone lock /
    // brief signal loss shouldn't drop someone from the battle) — same behaviour as the
    // original Firebase version, which had no presence system either.
  });
}
