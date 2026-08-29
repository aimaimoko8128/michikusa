import { useGame } from '../state/useGame';

export function GroupResultScreen() {
  const { results, room, playerId, goHomeFromGroup } = useGame();
  const myScore = results.reduce((s, r) => s + r.score, 0);
  const players = room?.players ?? {};
  const list = Object.entries(players)
    .map(([pid, p]) => ({ pid, name: p.name || 'プレイヤー', score: p.score || 0, finished: !!p.finished, answeredCount: p.answeredCount || 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <section className="screen active" id="screen-group-result">
      <div className="result-wrap">
        <p className="eyebrow">最終結果</p>
        <div className="score-plaque">
          <div className="score-num">{myScore}</div>
          <div className="score-label">あなたの合計点</div>
        </div>
        <div className="card setup-card" style={{ textAlign: 'left' }}>
          <div className="field">
            <label>ランキング（リアルタイム更新）</label>
            <div className="leaderboard">
              {list.map((p, i) => (
                <div className={'leader-row' + (i === 0 ? ' rank-1' : '') + (p.pid === playerId ? ' me' : '')} key={p.pid}>
                  <div className="lrank">{i + 1}</div>
                  <div className="lname">
                    {p.name}
                    {p.pid === playerId ? '（あなた）' : ''}
                  </div>
                  <div className="lstatus">{p.finished ? '完了' : `回答中 ${p.answeredCount}問`}</div>
                  <div className="lscore">{p.score}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="dest-status">他のプレイヤーの結果を待っています…（自動で更新されます）</p>
        </div>
        <div className="result-actions">
          <button className="btn" type="button" onClick={goHomeFromGroup}>
            タイトルへ戻る
          </button>
        </div>
      </div>
    </section>
  );
}
