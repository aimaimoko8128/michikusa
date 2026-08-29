import { useGame } from '../state/useGame';

export function GroupWaitScreen() {
  const { roomCode, room, isHost, groupWaitStatus, hostStartTrip } = useGame();
  const players = room?.players ?? {};
  const hostId = room?.hostId;

  return (
    <section className="screen active" id="screen-group-wait">
      <p className="eyebrow">ルームコード</p>
      <div className="room-code-display">{roomCode ?? '------'}</div>
      <p className="subheading">このコードをみんなに伝えて、参加してもらいましょう。</p>
      <div className="card setup-card">
        <div className="field">
          <label>参加中のプレイヤー</label>
          <div className="player-list">
            {Object.entries(players).map(([pid, p]) => (
              <div className="player-row" key={pid}>
                <span>{p.name || 'プレイヤー'}</span>
                {pid === hostId && <span className="host-tag">ホスト</span>}
                {p.finished && <span className="done-tag">回答済み</span>}
              </div>
            ))}
          </div>
        </div>
        {isHost && (
          <div className="setup-actions">
            <button className="btn" type="button" onClick={hostStartTrip}>
              旅のしたくへ進む →
            </button>
          </div>
        )}
        <p className="dest-status">{groupWaitStatus}</p>
      </div>
    </section>
  );
}
