import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../state/useGame';
import { RouteMap } from '../components/RouteMap';
import { absoluteImageUrl } from '../lib/api';

export function QuizScreen() {
  const { stops, idx, setIdx, stopsCount, results, isStopAnswered, submitPhoto, groupMode, room, route, routeOrigin, destCoord, userGeo, destination } = useGame();
  const lm = stops[idx];

  const frameRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [vx, setVx] = useState('50%');
  const [vy, setVy] = useState('50%');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets local UI state for the newly-shown stop
    setVx('50%');
    setVy('50%');
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

  function updateVeilPosition(clientX: number, clientY: number) {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    setVx(Math.max(0, Math.min(rect.width, clientX - rect.left)) + 'px');
    setVy(Math.max(0, Math.min(rect.height, clientY - rect.top)) + 'px');
  }

  function handleFile(file: File) {
    setStatus('写真を確認中…');
    const reader = new FileReader();
    reader.onload = () => {
      setStatus('位置情報を確認中…');
      void submitPhoto(String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  const veiled = groupMode;
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

        <div
          className={'photo-frame' + (veiled ? ' veiled' : '')}
          id="photo-frame"
          ref={frameRef}
          onMouseMove={(e) => veiled && updateVeilPosition(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            if (!veiled) return;
            const t = e.touches[0];
            if (t) updateVeilPosition(t.clientX, t.clientY);
          }}
          onTouchMove={(e) => {
            if (!veiled) return;
            const t = e.touches[0];
            if (t) updateVeilPosition(t.clientX, t.clientY);
            e.preventDefault();
          }}
          style={{ ['--vx' as string]: vx, ['--vy' as string]: vy }}
        >
          <img className="quiz-img" src={imgSrc} alt="見本の写真" />
          <div className="photo-veil" style={veiled ? { backgroundImage: `url("${imgSrc}")` } : undefined} />
          {veiled && <p className="photo-veil-hint">写真を指でなぞると、なぞった部分だけ見えます</p>}
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
