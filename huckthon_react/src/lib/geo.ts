export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function scoreForDistance(d: number): number {
  if (d <= 5) return 100;
  if (d <= 10) return 90;
  if (d <= 25) return 75;
  if (d <= 50) return 50;
  if (d <= 100) return 25;
  return 0;
}

export function scoreLabel(score: number): string {
  if (score >= 100) return 'パーフェクト！大正解！';
  if (score >= 90) return 'ナイス！かなり近い！';
  if (score >= 75) return 'いい線いってる！';
  if (score >= 50) return 'おしい！もう少し！';
  if (score >= 25) return '近くまで来てた！';
  return '圏外…でもナイストライ！';
}

export function fmtDist(d: number): string {
  if (d >= 1000) return (d / 1000).toFixed(1) + ' km';
  return Math.round(d) + ' m';
}

export function fmtDateShort(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Weighted-random distance used when GPS isn't available ("experience mode").
export function simulateDistance(): number {
  const r = Math.random();
  if (r < 0.12) return Math.random() * 5;
  if (r < 0.32) return 5 + Math.random() * 15;
  if (r < 0.55) return 20 + Math.random() * 35;
  if (r < 0.78) return 50 + Math.random() * 60;
  return 100 + Math.random() * 400;
}

export function mapUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function directionsUrl(userGeo: { lat: number; lng: number } | null, targetLat: number, targetLng: number): string {
  if (userGeo) {
    return `https://www.google.com/maps/dir/?api=1&origin=${userGeo.lat},${userGeo.lng}&destination=${targetLat},${targetLng}`;
  }
  return mapUrl(targetLat, targetLng);
}
