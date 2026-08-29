export type BlackoutCircle = { cx: number; cy: number; r: number };

// Greedy circle-packing: samples a grid over the 400x300 viewBox and keeps adding
// randomly-placed circles until at least ~55% of the sampled grid is covered (or the
// circle/attempt caps are hit). Used to permanently black out part of the sample photo
// in group battles so it can never be fully revealed. Generated once per stop and kept
// fixed for the rest of the round — see useGameEngine's `blackoutByStop`.
export function generateBlackoutCircles(): BlackoutCircle[] {
  const W = 400;
  const H = 300;
  const GRID_X = 40;
  const GRID_Y = 30;
  const totalPoints = GRID_X * GRID_Y;
  const covered = new Array<boolean>(totalPoints).fill(false);
  const circles: BlackoutCircle[] = [];

  function markCovered(cx: number, cy: number, r: number): number {
    let count = 0;
    for (let gy = 0; gy < GRID_Y; gy++) {
      const py = (gy + 0.5) * (H / GRID_Y);
      for (let gx = 0; gx < GRID_X; gx++) {
        const idx = gy * GRID_X + gx;
        if (covered[idx]) continue;
        const px = (gx + 0.5) * (W / GRID_X);
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= r * r) {
          covered[idx] = true;
          count++;
        }
      }
    }
    return count;
  }

  let coveredCount = 0;
  const targetRatio = 0.55;
  const maxCircles = 14;
  let attempts = 0;
  while (coveredCount / totalPoints < targetRatio && circles.length < maxCircles && attempts < 200) {
    attempts++;
    const r = 45 + Math.random() * 70;
    const cx = Math.random() * W;
    const cy = Math.random() * H;
    const gained = markCovered(cx, cy, r);
    if (gained > 0 || circles.length < 3) {
      circles.push({ cx, cy, r });
      coveredCount = covered.reduce((a, b) => a + (b ? 1 : 0), 0);
    }
  }
  return circles;
}
