import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './src/app.js';
import { config } from './src/config.js';
import { registerRoomSocketHandlers } from './src/rooms/socketHandlers.js';

const app = createApp();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.corsOrigins.length ? config.corsOrigins : true },
});

io.on('connection', (socket) => {
  registerRoomSocketHandlers(io, socket);
});

httpServer.listen(config.port, () => {
  console.log(`[みちくさ backend] listening on http://localhost:${config.port}`);
  if (!config.googleStreetViewKey) {
    console.warn('[みちくさ backend] GOOGLE_STREETVIEW_KEY is not set — quiz generation will fail until it is.');
  }
});
