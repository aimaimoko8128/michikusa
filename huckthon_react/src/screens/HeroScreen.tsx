import { useGame } from '../state/useGame';

export function HeroScreen() {
  const { goToSetup, openGroupMenu, setScreen } = useGame();
  return (
    <section className="screen active" id="screen-hero">
      <div className="hero-content">
        <div className="hero-mark">京都リアルワールド探索ゲーム</div>
        <div className="plaque">
          <h1 className="hero-title">みちくさ</h1>
          <p className="hero-tagline">目的地までの道のりを、ゲームにする。</p>
        </div>
        <div className="hero-primary-actions">
          <button className="btn hero-primary-btn" onClick={goToSetup}>
            はじめる
          </button>
          <button className="btn ghost hero-primary-btn" type="button" onClick={openGroupMenu}>
            グループで対戦
          </button>
        </div>
        <hr className="hero-rule" />
        <p className="hero-sub">
          目的地までの道中に「見本の写真」が出現します。そっくりの景色を実際に歩いて探し、スマホで撮影してください。近い場所で撮れるほど高得点。暇な移動時間が、京都の景色探しゲームに変わります。
        </p>
        <div className="hero-steps">
          <div className="hero-step">
            <span className="hero-step-num">1</span>
            <span>目的地を決める</span>
          </div>
          <div className="hero-step-arrow">→</div>
          <div className="hero-step">
            <span className="hero-step-num">2</span>
            <span>道中で写真の場所を探す</span>
          </div>
          <div className="hero-step-arrow">→</div>
          <div className="hero-step">
            <span className="hero-step-num">3</span>
            <span>撮影してスコアを見る</span>
          </div>
        </div>
        <button className="btn ghost small" type="button" onClick={() => setScreen('history')}>
          記録
        </button>
      </div>
      <div className="hero-foot">みちくさ — 着くまでが、ゲーム。</div>
    </section>
  );
}
