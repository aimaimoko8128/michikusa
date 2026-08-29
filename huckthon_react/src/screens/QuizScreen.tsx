import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../state/useGame';
import { RouteMap } from '../components/RouteMap';
import { absoluteImageUrl } from '../lib/api';

export function QuizScreen() {
  const { stops, idx, setIdx, stopsCount, blackoutByStop, results, isStopAnswered, submitPhoto, skipGeoAndSubmit, groupMode, room, route, routeOrigin, destCoord, userGeo, heading, destination } = useGame();
  const lm = stops[idx];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState('');
  const [skippableDataUrl, setSkippableDataUrl] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);

  const veiled = groupMode;
  const blackoutCircles = useMemo(() => blackoutByStop[idx] || [], [blackoutByStop, idx]);

  useEffect(() => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets local UI state for the newly-shown stop
    setStatus('');
    setSkippableDataUrl(null);
    setSkipping(false);
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
    setSkippableDataUrl(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setStatus('位置情報を確認中…');
      // Offer the skip button as soon as we start waiting on GPS, not only once it has already
      // failed — on some mobile browsers the location callback can hang far longer than our
      // internal timeout expects, so the player shouldn't have to wait that out before they get
      // an escape hatch.
      setSkippableDataUrl(dataUrl);
      void submitPhoto(dataUrl).then((retryMessage) => {
        if (retryMessage) {
          setStatus(retryMessage);
          setSkippableDataUrl(dataUrl);
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          setSkippableDataUrl(null);
        }
      });
    };
    reader.readAsDataURL(file);
  }

  function handleSkip() {
    if (!skippableDataUrl || skipping) return;
    setSkipping(true);
    setStatus('位置情報なしでスキップしています…');
    void skipGeoAndSubmit(skippableDataUrl).finally(() => {
      setSkippableDataUrl(null);
      setSkipping(false);
    });
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
          <RouteMap className="quiz-map" origin={routeOrigin()} originKnown={!!userGeo} dest={destCoord()} route={route} heading={heading} />
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
        <p className="quiz-note">スマートフォンではカメラが起動します。</p>
        <div className="status-line">{status || waitingStatus}</div>
        {skippableDataUrl && (
          <button type="button" className="btn ghost small quiz-skip-btn" onClick={handleSkip} disabled={skipping}>
            {skipping ? 'スキップ中…' : '位置情報なしでスキップして進める'}
          </button>
        )}
      </div>
    </section>
  );
}
