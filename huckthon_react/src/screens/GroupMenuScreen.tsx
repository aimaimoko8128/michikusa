import { useState } from 'react';
import { useGame } from '../state/useGame';

export function GroupMenuScreen() {
  const { groupMenuStatus, createGroupRoom, joinGroupRoom, setScreen } = useGame();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <section className="screen active" id="screen-group-menu">
      <p className="eyebrow">グループ対戦</p>
      <h2 className="heading">グループで対戦</h2>
      <p className="subheading">同じ写真をみんなで探して、スコアを競おう。</p>
      <div className="card setup-card">
        <div className="field">
          <label>プレイヤー名</label>
          <input
            type="text"
            placeholder="表示される名前を入力（例: たいせい）"
            autoComplete="off"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="setup-actions">
          <button className="btn" type="button" onClick={() => void createGroupRoom(name)}>
            ルームを作る
          </button>
        </div>
        <div className="group-divider">
          <span>または</span>
        </div>
        <div className="field">
          <label>ルームコードで参加</label>
          <div className="geo-row">
            <input
              type="text"
              placeholder="6桁のコード"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="btn ghost small" type="button" onClick={() => void joinGroupRoom(name, code)}>
              参加する
            </button>
          </div>
        </div>
        <p className="dest-status">{groupMenuStatus}</p>
      </div>
      <button className="btn ghost small" type="button" style={{ marginTop: 18 }} onClick={() => setScreen('hero')}>
        ← タイトルへ戻る
      </button>
    </section>
  );
}
