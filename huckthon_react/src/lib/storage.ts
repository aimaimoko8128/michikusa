import type { HistoryEntry, RecentRoom } from './types';

const HISTORY_KEY = 'michikusa_history';
const HISTORY_MAX = 40;
const RECENT_ROOMS_KEY = 'michikusa_recent_rooms';
const RECENT_ROOMS_MAX = 10;
const PLAYER_ID_KEY = 'michikusa_player_id';

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: HistoryEntry): void {
  try {
    const list = loadHistory();
    list.unshift(entry);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch {
    /* storage full etc. — history is a nice-to-have, ignore */
  }
}

export function deleteHistoryEntry(index: number): void {
  try {
    const list = loadHistory();
    list.splice(index, 1);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function loadRecentRooms(): RecentRoom[] {
  try {
    const raw = window.localStorage.getItem(RECENT_ROOMS_KEY);
    return raw ? (JSON.parse(raw) as RecentRoom[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentRoom(code: string, destination: string): void {
  try {
    const list = loadRecentRooms().filter((r) => r.code !== code);
    list.unshift({ code, destination: destination || '', ts: Date.now() });
    window.localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(list.slice(0, RECENT_ROOMS_MAX)));
  } catch {
    /* ignore */
  }
}

export function deleteRecentRoom(code: string): void {
  try {
    const list = loadRecentRooms().filter((r) => r.code !== code);
    window.localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function getOrCreatePlayerId(): string {
  try {
    const saved = window.localStorage.getItem(PLAYER_ID_KEY);
    if (saved) return saved;
    const id = 'p-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    window.localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    return 'p-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
}

// Downscale a captured photo to a small JPEG data URL, for lightweight history storage
// and for sharing over the room's socket connection (group history thumbnails).
export function compressImageDataUrl(dataUrl: string, maxDim: number, quality: number): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const w = img.width || 1;
        const h = img.height || 1;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch {
      resolve(null);
    }
  });
}
