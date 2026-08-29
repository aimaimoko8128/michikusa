import { useGame } from '../state/useGame';

export function LoadingScreen() {
  const { loadingText } = useGame();
  return (
    <section className="screen active" id="screen-loading">
      <div className="loading-wrap">
        <svg className="route-svg" viewBox="0 0 300 60">
          <defs>
            <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#15130f" />
              <stop offset="100%" stopColor="#c1321a" />
            </linearGradient>
          </defs>
          <path d="M10,45 C 80,10 120,50 150,30 C 180,10 220,50 290,15" />
          <circle className="route-dot" cx="10" cy="45" r="5" />
          <circle className="route-dot" cx="290" cy="15" r="5" />
        </svg>
        <div className="loading-text">{loadingText}</div>
      </div>
    </section>
  );
}
