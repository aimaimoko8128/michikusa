import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../state/useGame';
import { RouteMap } from '../components/RouteMap';
import { absoluteImageUrl } from '../lib/api';

type Circle = { cx: number; cy: number; r: number };

// Greedy circle-packing: samples a grid over the 400x300 viewBox and keeps adding
// randomly-placed circles until at least ~55% of the sampled grid is covered (or the
// circle/attempt caps are hit). The result permanently blacks out part of the sample
// photo in group battles, so it can never be fully revealed by peeking around.
function generateBlackoutCircles(): Circle[] {
  const W = 400;
  const H = 300;
  const GRID_X = 40;
  const GRID_Y = 30;
  const totalPoints = GRID_X * GRID_Y;
  const covered = new Array<boolean>(totalPoints).fill(false);
  const circles: Circle[] = [];

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

export function QuizScreen() {
  const { stops, idx, setIdx, stopsCount, results, isStopAnswered, submitPhoto, groupMode, room, route, routeOrigin, destCoord, userGeo, destination } = useGame();
  const lm = stops[idx];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState('');

  const veiled = groupMode;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `idx` intentionally forces a fresh random layout each time the shown stop changes
  const blackoutCircles = useMemo(() => (veiled ? generateBlackoutCircles() : []), [veiled, idx]);

  useEffect(() => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets local UI state for the newly-shown stop
    setStatus('');
  }, [idx]);

  const mineDone = results.length >= stopsCount;
  const waitingStatus = useMemo(() => {
    if (!groupMode || !mineDone || !room) return '';
    const pids = Object.keys(room.players);
    const doneCount = pids.filter((pid) => room.players[pid].finished).length;
    return pids.length
      ? `全員の撮影を待っています…（${doneCount} / ${pids.length}人が撮影完了。撮り直しもできます）`
      : '全員の撮影を待っています…（撮り直しもできます）';
  }, [groupMode, mineDone, room]);

  if (!lm) return null;

  function handleFile(file: File) {
    setStatus('写真を確認中…');
    const reader = new FileReader();
    reader.onload = () => {
      setStatus('位置情報を確認中…');
      void submitPhoto(String(reader.result)).then((retryMessage) => {
        if (retryMessage) {
          setStatus(retryMessage);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      });
    };
    reader.readAsDataURL(file);
  }

  const imgSrc = absoluteImageUrl(lm.liveImg);

  return (
    <section className="screen active" id="screen-quiz">
      <div className="quiz-wrap">
        <div className="quiz-top">
          <div className="quiz-progress">
            写真 <span>{idx + 1}</span> / <span>{stopsCount}</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: Math.round((results.length / stopsCount) * 100) + '%' }} />
            </div>
          </div>
          <div className="quiz-progress" style={{ textAlign: 'right' }}>
            目的地: {destination?.name}
          </div>
        </div>

        <div className="stop-picker">
          {stops.map((s, i) => {
            const done = isStopAnswered(i);
            const locked = done && !groupMode;
            return (
              <button
                key={s.key}
                type="button"
                className={
                  'stop-chip' + (locked ? ' done' : '') + (done && groupMode ? ' answered' : '') + (i === idx ? ' active' : '')
                }
                disabled={locked}
                onClick={() => !locked && setIdx(i)}
              >
                {done ? '✓' : i + 1}
              </button>
            );
          })}
        </div>
        <p className="stop-picker-note">
          {groupMode
            ? '好きな番号の写真から撮影できます（全員が撮り終わるまで、何度でも撮り直しできます）'
            : '好きな番号の写真から撮影できます（済みの番号はもう選べません）'}
        </p>

        <div className="quiz-map-wrap">
          <RouteMap className="quiz-map" origin={routeOrigin()} originKnown={!!userGeo} dest={destCoord()} route={route} />
          <div className="map-legend">
            <span>
              <i className="dot dot-user" />現在地
            </span>
            <span>
              <i className="dot dot-target" />目的地
            </span>
          </div>
        </div>

        <div className={'photo-frame' + (veiled ? ' veiled' : '')} id="photo-frame">
          <img className="quiz-img" src={imgSrc} alt="見本の写真" />
          {veiled && (
            <svg className="photo-blackout" id="photo-blackout" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
              {blackoutCircles.map((c, i) => (
                <circle key={i} cx={c.cx.toFixed(1)} cy={c.cy.toFixed(1)} r={c.r.toFixed(1)} />
              ))}
            </svg>
          )}
        </div>
        <p className="quiz-caption">この景色を探してください</p>
        <p className="quiz-hint">{lm.hint}</p>
        <p className="quiz-flavor">『{destination?.name}』へ向かう道中に、この写真の場所が出現しました。（ストリートビュー実写）</p>
        <div className="quiz-cta">
          <label className="btn" htmlFor="file-input">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx={12} cy={13.5} r={3.3} />
            </svg>
            撮影する
          </label>
          <input
            className="file-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            id="file-input"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
        <p className="quiz-note">スマートフォンではカメラが起動します（PCではファイルを選択してください）。</p>
        <div className="status-line">{status || waitingStatus}</div>
      </div>
    </section>
  );
}
