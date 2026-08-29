import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { landmarksRouter } from './routes/landmarks.js';
import { geocodeRouter } from './routes/geocode.js';
import { routeRouter } from './routes/route.js';
import { streetviewRouter } from './routes/streetview.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigins.length ? config.corsOrigins : true,
    })
  );
  app.use(express.json({ limit: '2mb' }));

  // Static landmark/decor images
  app.use('/images', express.static(path.join(__dirname, '..', 'data', 'images')));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, streetViewConfigured: !!config.googleStreetViewKey });
  });

  app.use('/api/landmarks', landmarksRouter);
  app.use('/api/geocode', geocodeRouter);
  app.use('/api/route', routeRouter);
  app.use('/api/streetview', streetviewRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  return app;
}
