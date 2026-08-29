import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', '..', 'data', 'landmarks.json');

const raw = JSON.parse(readFileSync(filePath, 'utf-8'));

export const landmarks = raw.landmarks; // [{key,name,hint,fact,lat,lng,img}]
export const decor = raw.decor; // {frame,sakura,kimono,komono}

export function landmarkByKey(key) {
  return landmarks.find((l) => l.key === key) || null;
}
