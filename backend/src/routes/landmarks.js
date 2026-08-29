import { Router } from 'express';
import { landmarks, decor } from '../data/landmarks.js';

export const landmarksRouter = Router();

// GET /api/landmarks
// Returns the 16 Kyoto sample landmarks (for the "experience mode" demo photos) plus
// the decorative illustration images used around the UI. Image URLs are server-relative
// paths under /images/... served as static files (see app.js).
landmarksRouter.get('/', (_req, res) => {
  res.json({ landmarks, decor });
});
