import { useMemo } from 'react';
import { useGame } from '../state/useGame';
import { SAKURA_IMAGES } from '../lib/sakuraImages';
import titleImg from '../assets/title.png';

const SAKURA_COUNT = 16;

type Petal = {
  key: number;
  img: string;
  size: number;
  height: number;
  left: number;
  animationName: string;
  duration: number;
  delay: number;
};

function generatePetals(): Petal[] {
  return Array.from({ length: SAKURA_COUNT }, (_, i) => {
    const size = 14 + Math.random() * 16;
    const dur = 7 + Math.random() * 9;
    const delay = -(Math.random() * dur);
    return {
      key: i,
      img: SAKURA_IMAGES[i % SAKURA_IMAGES.length],
      size,
      height: size * (0.75 + Math.random() * 0.5),
      left: 40 + Math.random() * 65,
      animationName: i % 2 === 0 ? 'sakuraFall' : 'sakuraFall2',
      duration: dur,
      delay,
    };
  });
}

function SakuraPetals() {
  const petals = useMemo(() => generatePetals(), []);
  return (
    <div className="sakura-container" aria-hidden="true">
      {petals.map((p) => (
        <div
          key={p.key}
          className="sakura-petal"
          style={{
            backgroundImage: `url('${p.img}')`,
            width: p.size,
            height: p.height,
            left: `${p.left}%`,
            animationName: p.animationName,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export function HeroScreen() {
  const { goToSetup, openGroupMenu, setScreen } = useGame();
  return (
    <section className="screen active" id="screen-hero">
      <SakuraPetals />
      <div className="hero-content">
        <div className="hero-mark">京都リアルワールド探索ゲーム</div>
        <h1 className="hero-title">
          <img src={titleImg} alt="KyotoGuessr" className="hero-title-img" />
        </h1>
        <div className="hero-primary-actions">
          <button className="btn hero-primary-btn" onClick={goToSetup}>
            はじめる
          </button>
          <button className="btn hero-primary-btn" type="button" onClick={openGroupMenu}>
            グループで対戦
          </button>
        </div>
        <hr className="hero-rule" />
        <div className="hero-steps">
          <div className="hero-step">
            <span className="hero-step-num">1</span>
            <span>目的地を決める</span>
          </div>
          <div className="hero-step">
            <span className="hero-step-num">2</span>
            <span>道中で写真の場所を探す</span>
          </div>
          <div className="hero-step">
            <span className="hero-step-num">3</span>
            <span>撮影してスコアを見る</span>
          </div>
        </div>
        <p className="hero-sub">
          目的地までの道中に「見本の写真」が出現します。そっくりの景色を実際に歩いて探し、スマホで撮影してください。近い場所で撮れるほど高得点。暇な移動時間が、京都の景色探しゲームに変わります。
        </p>
        <button className="btn ghost small" type="button" onClick={() => setScreen('history')}>
          記録
        </button>
      </div>
      <div className="hero-foot">KyotoGuessr — 着くまでが、ゲーム。</div>
    </section>
  );
}
