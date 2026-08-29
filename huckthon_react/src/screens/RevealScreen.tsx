import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/useGame';
import { RevealMap } from '../components/RevealMap';
import { absoluteImageUrl } from '../lib/api';
import { directionsUrl, fmtDist, scoreLabel } from '../lib/geo';

// Counts `el`'s displayed number up from 0 to `target` over `durationMs`, easing out (cubic),
// and briefly pops it with a bounce class when the animation finishes.
function animateScoreCountUp(
  el: { current: number },
  target: number,
  durationMs: number,
  setShown: (n: number) => void,
  onDone: () => void
): () => void {
  let frame = 0;
  let start: number | null = null;
  const tick = (ts: number) => {
    if (start === null) start = ts;
    const progress = Math.min(1, (ts - start) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    const cur = Math.round(target * eased);
    el.current = cur;
    setShown(cur);
    if (progress < 1) {
      frame = requestAnimationFrame(tick);
    } else {
      setShown(target);
      onDone();
    }
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export function RevealScreen() {
  const { results, revealIdx, revealFinal, advanceReveal, stopsCount, route, routeOrigin, destCoord, userGeo, replay, goHome } = useGame();
  const r = results[revealIdx];

  const [judging, setJudging] = useState(true);
  const [shownScore, setShownScore] = useState(0);
  const [scorePop, setScorePop] = useState(false);
  const shownScoreRef = useRef(0);
  const cancelAnimRef = useRef<(() => void) | null>(null);

  // Each new answer reveal (and the final summary) starts scrolled to the top — otherwise the
  // player can land mid-page still scrolled from wherever they were on the quiz screen, or from
  // the previous result, and miss the score/photo comparison at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [revealIdx, revealFinal]);

  useEffect(() => {
    if (revealFinal || !r) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (re)starts the judging/score-count animation for the newly-shown result
    setJudging(true);
    setShownScore(0);
    setScorePop(false);
    if (cancelAnimRef.current) cancelAnimRef.current();
    const judgeTimer = window.setTimeout(() => {
      setJudging(false);
      cancelAnimRef.current = animateScoreCountUp(shownScoreRef, r.score, 1100, setShownScore, () => {
        setScorePop(true);
        setTimeout(() => setScorePop(false), 260);
      });
    }, 850);
    return () => {
      clearTimeout(judgeTimer);
      if (cancelAnimRef.current) cancelAnimRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealIdx, revealFinal]);

  const [shownTotal, setShownTotal] = useState(0);
  const shownTotalRef = useRef(0);
  const cancelTotalAnimRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!revealFinal) return;
    const total = results.reduce((s, res) => s + res.score, 0);
    shownTotalRef.current = 0;
    if (cancelTotalAnimRef.current) cancelTotalAnimRef.current();
    cancelTotalAnimRef.current = animateScoreCountUp(shownTotalRef, total, 1200, setShownTotal, () => {});
    return () => {
      if (cancelTotalAnimRef.current) cancelTotalAnimRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealFinal]);

  if (revealFinal) {
    const total = results.reduce((s, res) => s + res.score, 0);
    const max = stopsCount * 1000;
    const pct = total / max;
    const rank = pct >= 0.9 ? 'S' : pct >= 0.7 ? 'A' : pct >= 0.45 ? 'B' : 'C';
    return (
      <section className="screen active" id="screen-reveal">
        <div className="reveal-wrap">
          <div className="result-wrap">
            <div className="rank-badge">{rank}</div>
            <div className="total-score">
              合計スコア{'　'}<b>{shownTotal}</b> 点
            </div>
            <p className="score-hint">見本の地点に近い場所で撮影できているほど、高得点になります（1問1000点満点）。</p>
            <div className="result-list">
              {results.map((res) => (
                <div className="result-row" key={res.stopIdx}>
                  <img src={absoluteImageUrl(res.targetImg)} alt="" />
                  <div>
                    <div className="rname">{res.name}</div>
                    <div className="rdist">
                      約 {fmtDist(res.distance)}
                      {res.simulated ? '（体験モード）' : ''}
                    </div>
                  </div>
                  <div className="rscore">{res.score}</div>
                </div>
              ))}
            </div>
            <p className="share-hint">スクリーンショットを撮って、道中の発見をシェアしよう。</p>
            <div className="result-actions">
              <button className="btn" onClick={replay}>
                もういちど遊ぶ
              </button>
              <button className="btn ghost" type="button" onClick={goHome}>
                タイトルへ戻る
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!r) return null;
  const isLast = revealIdx >= results.length - 1;

  return (
    <section className="screen active" id="screen-reveal">
      <div className="reveal-wrap">
        <p className="eyebrow">答え合わせ</p>
        <p className="quiz-progress" style={{ margin: '-6px 0 10px' }}>
          答え合わせ {revealIdx + 1} / {results.length}
        </p>
        <div className={'judging-note' + (judging ? ' active' : '')}>
          <div className="judging-spinner" />
          <p>採点中…</p>
        </div>
        <div className={'reveal-content' + (!judging ? ' shown' : '')}>
          <div className="reveal-photos">
            <div>
              <div className="ph">
                <img src={r.userImg} alt="あなたの写真" />
              </div>
              <div className="lbl">あなたの撮影</div>
            </div>
            <div>
              <div className="ph">
                <img src={absoluteImageUrl(r.targetImg)} alt="見本の写真" />
              </div>
              <div className="lbl">見本の写真</div>
            </div>
          </div>
          <div className="score-plaque">
            <div className={'score-num' + (scorePop ? ' score-pop' : '')}>{shownScore}</div>
            <div className="score-label">{scoreLabel(r.score)}</div>
          </div>
          <div className="dist-line">推定距離: 約 {fmtDist(r.distance)}</div>
          <div>
            {r.simulated ? <span className="sim-badge">体験モード（GPS未取得のため距離を仮生成）</span> : null}
          </div>
          <div className="reveal-map-wrap">
            <RevealMap className="reveal-map" result={r} origin={routeOrigin()} originKnown={!!userGeo} dest={destCoord()} route={route} />
            <div className="map-legend">
              <span>
                <i className="dot dot-user" />あなたの撮影地点
              </span>
              <span>
                <i className="dot dot-target" />見本の地点
              </span>
              <span>
                <i className="dot dot-origin" />スタート地点
              </span>
              <span>
                <i className="dot dot-dest" />目的地
              </span>
            </div>
            <a className="map-open-link" href={directionsUrl(r.userGeo, r.targetLat, r.targetLng)} target="_blank" rel="noopener">
              Googleマップで大きく開く
            </a>
          </div>
          <div className="answer-box">
            <p className="answer-name">正解は『{r.name}』でした</p>
            <p className="answer-fact">{r.fact}</p>
          </div>
          <button className="btn" onClick={advanceReveal}>
            {isLast ? '結果を見る' : 'つぎの写真へ'}
          </button>
        </div>
      </div>
    </section>
  );
}
