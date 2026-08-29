import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 8787,
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  googleStreetViewKey: process.env.GOOGLE_STREETVIEW_KEY || '',
};
