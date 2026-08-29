import { useEffect, useState } from 'react';
import { useGame } from '../state/useGame';
import { loadHistory, loadRecentRooms } from '../lib/storage';
import { absoluteImageUrl } from '../lib/api';
import { fmtDateShort } from '../lib/geo';
import type { HistoryEntry, RoomHistoryEntry } from '../lib/types';

function HistoryRow({ userImg, targetImg, stopName, metaLine, score }: { userImg: string; targetImg: string; stopName: string; metaLine: string; score: number }) {
  return (
    <div className="history-row">
      <div className="h-imgs">
        <img src={userImg} alt="あなたの写真" />
        <img src={absoluteImageUrl(targetImg)} alt="見本の写真" />
      </div>
      <div className="h-info">
        <div className="h-name">{stopName}</div>
        <div className="h-meta">{metaLine}</div>
      </div>
      <div className="h-score">{score}</div>
    </div>
  );
}

export function HistoryScreen() {
  const { setScreen, getRoomHistory } = useGame();
  const [myHistory, setMyHistory] = useState<HistoryEntry[]>([]);
  const recentRooms = loadRecentRooms();
  const [activeRoom, setActiveRoom] = useState<string | null>(recentRooms[0]?.code ?? null);
  const [roomHistory, setRoomHistory] = useState<RoomHistoryEntry[] | null>(null);
  const [roomHistoryError, setRoomHistoryError] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of localStorage on mount
    setMyHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (!activeRoom) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets/loads the room history fetch when the selected room changes
    setRoomHistory(null);
    setRoomHistoryError(false);
    getRoomHistory(activeRoom)
      .then(({ room }) => {
        const entries = [...room.history].sort((a, b) => (b.ts || 0) - (a.ts || 0));
        setRoomHistory(entries);
      })
      .catch(() => setRoomHistoryError(true));
  }, [activeRoom, getRoomHistory]);

  return (
    <section className="screen active" id="screen-history">
      <p className="eyebrow">撮影記録</p>
      <h2 className="heading">記録</h2>
      <p className="subheading">これまでに撮影した写真の履歴です。</p>
      <div className="card setup-card" style={{ textAlign: 'left' }}>
        <div className="field">
          <label>自分の記録</label>
          <div className="history-list">
            {myHistory.length === 0 ? (
              <p className="history-empty">まだ記録がありません。遊んでみましょう。</p>
            ) : (
              myHistory.map((h, i) => (
                <HistoryRow
                  key={i}
                  userImg={h.userImg}
                  targetImg={h.targetImg}
                  stopName={h.stopName}
                  score={h.score}
                  metaLine={`${h.destination ? h.destination + ' ・ ' : ''}${fmtDateShort(h.ts)}`}
                />
              ))
            )}
          </div>
        </div>
      </div>
      <div className="card setup-card" style={{ textAlign: 'left', marginTop: 18 }}>
        <div className="field">
          <label>グループ対戦の記録（みんなの写真）</label>
          <div className="room-history-picker">
            {recentRooms.map((r) => (
              <button
                key={r.code}
                type="button"
                className={'room-history-chip' + (activeRoom === r.code ? ' active' : '')}
                onClick={() => setActiveRoom(r.code)}
              >
                {(r.destination || r.code) + '（' + r.code + '）'}
              </button>
            ))}
          </div>
          <div className="history-list">
            {recentRooms.length === 0 && <p className="history-empty">参加したグループ対戦がまだありません。</p>}
            {recentRooms.length > 0 && roomHistoryError && <p className="history-empty">読み込みに失敗しました。</p>}
            {recentRooms.length > 0 && !roomHistoryError && roomHistory === null && <p className="history-empty">読み込み中…</p>}
            {roomHistory && roomHistory.length === 0 && <p className="history-empty">このルームの記録はまだありません。</p>}
            {roomHistory &&
              roomHistory.map((h, i) => (
                <HistoryRow
                  key={i}
                  userImg={h.userImg}
                  targetImg={h.targetImg}
                  stopName={h.stopName}
                  score={h.score}
                  metaLine={`${h.playerName || 'プレイヤー'} ・ ${fmtDateShort(h.ts)}`}
                />
              ))}
          </div>
        </div>
      </div>
      <button className="btn ghost small" type="button" style={{ marginTop: 18 }} onClick={() => setScreen('hero')}>
        ← タイトルへ戻る
      </button>
    </section>
  );
}
