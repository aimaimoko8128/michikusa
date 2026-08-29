import { useEffect, useState } from 'react';
import { useGame } from '../state/useGame';
import { loadHistory, loadRecentRooms, deleteHistoryEntry, deleteRecentRoom } from '../lib/storage';
import { absoluteImageUrl } from '../lib/api';
import { fmtDateShort } from '../lib/geo';
import type { HistoryEntry, RoomHistoryEntry } from '../lib/types';

type LightboxData = { userImg: string; targetImg: string; stopName: string; metaLine: string; score: number };

function HistoryRow({
  userImg,
  targetImg,
  stopName,
  metaLine,
  score,
  onDelete,
  onOpen,
}: {
  userImg: string;
  targetImg: string;
  stopName: string;
  metaLine: string;
  score: number;
  onDelete?: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="history-row">
      <button type="button" className="history-row-main" onClick={onOpen} aria-label={`${stopName}の写真を大きく見比べる`}>
        <div className="h-imgs">
          <img src={userImg} alt="あなたの写真" />
          <img src={absoluteImageUrl(targetImg)} alt="見本の写真" />
        </div>
        <div className="h-info">
          <div className="h-name">{stopName}</div>
          <div className="h-meta">{metaLine}</div>
        </div>
        <div className="h-score">{score}</div>
      </button>
      {onDelete && (
        <button type="button" className="h-delete" aria-label="この記録を削除" onClick={onDelete}>
          ×
        </button>
      )}
    </div>
  );
}

function HistoryLightbox({ data, onClose }: { data: LightboxData; onClose: () => void }) {
  return (
    <div className="history-lightbox-overlay" onClick={onClose}>
      <div className="history-lightbox" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="history-lightbox-close" aria-label="閉じる" onClick={onClose}>
          ×
        </button>
        <div className="history-lightbox-name">{data.stopName}</div>
        <div className="history-lightbox-meta">{data.metaLine}</div>
        <div className="history-lightbox-photos">
          <div className="history-lightbox-photo">
            <img src={data.userImg} alt="あなたの写真" />
            <div className="lbl">あなたの撮影</div>
          </div>
          <div className="history-lightbox-photo">
            <img src={absoluteImageUrl(data.targetImg)} alt="見本の写真" />
            <div className="lbl">見本の写真</div>
          </div>
        </div>
        <div className="history-lightbox-score">
          スコア <b>{data.score}</b> 点
        </div>
      </div>
    </div>
  );
}

export function HistoryScreen() {
  const { setScreen, getRoomHistory } = useGame();
  const [myHistory, setMyHistory] = useState<HistoryEntry[]>([]);
  const [recentRooms, setRecentRooms] = useState(() => loadRecentRooms());
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [roomHistory, setRoomHistory] = useState<RoomHistoryEntry[] | null>(null);
  const [roomHistoryError, setRoomHistoryError] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxData | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of localStorage on mount
    setMyHistory(loadHistory());
    setActiveRoom((cur) => cur ?? recentRooms[0]?.code ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function handleDeleteHistory(index: number) {
    if (!confirm('この記録を削除しますか？（元に戻せません）')) return;
    deleteHistoryEntry(index);
    setMyHistory(loadHistory());
  }

  function handleDeleteRoom(code: string) {
    if (!confirm('このルームを記録一覧から削除しますか？（自分の端末上の一覧から削除されます）')) return;
    deleteRecentRoom(code);
    const next = loadRecentRooms();
    setRecentRooms(next);
    setActiveRoom((cur) => (cur === code ? next[0]?.code ?? null : cur));
  }

  return (
    <section className="screen active" id="screen-history">
      <p className="eyebrow">撮影記録</p>
      <h2 className="heading">記録</h2>
      <p className="subheading">これまでに撮影した写真の履歴です。タップすると大きく見比べられます。</p>
      <div className="card setup-card" style={{ textAlign: 'left' }}>
        <div className="field">
          <label>自分の記録</label>
          <div className="history-list">
            {myHistory.length === 0 ? (
              <p className="history-empty">まだ記録がありません。遊んでみましょう。</p>
            ) : (
              myHistory.map((h, i) => {
                const metaLine = `${h.destination ? h.destination + ' ・ ' : ''}${fmtDateShort(h.ts)}`;
                return (
                  <HistoryRow
                    key={i}
                    userImg={h.userImg}
                    targetImg={h.targetImg}
                    stopName={h.stopName}
                    score={h.score}
                    metaLine={metaLine}
                    onDelete={() => handleDeleteHistory(i)}
                    onOpen={() => setLightbox({ userImg: h.userImg, targetImg: h.targetImg, stopName: h.stopName, metaLine, score: h.score })}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
      <div className="card setup-card" style={{ textAlign: 'left', marginTop: 18 }}>
        <div className="field">
          <label>グループ対戦の記録（みんなの写真）</label>
          <div className="room-history-picker">
            {recentRooms.map((r) => (
              <div key={r.code} className={'room-history-chip' + (activeRoom === r.code ? ' active' : '')}>
                <button type="button" className="room-history-chip-label" onClick={() => setActiveRoom(r.code)}>
                  {(r.destination || r.code) + '（' + r.code + '）'}
                </button>
                <button
                  type="button"
                  className="room-history-chip-del"
                  aria-label="このルームを記録一覧から削除"
                  onClick={() => handleDeleteRoom(r.code)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="history-list">
            {recentRooms.length === 0 && <p className="history-empty">参加したグループ対戦がまだありません。</p>}
            {recentRooms.length > 0 && roomHistoryError && <p className="history-empty">読み込みに失敗しました。</p>}
            {recentRooms.length > 0 && !roomHistoryError && roomHistory === null && <p className="history-empty">読み込み中…</p>}
            {roomHistory && roomHistory.length === 0 && <p className="history-empty">このルームの記録はまだありません。</p>}
            {roomHistory &&
              roomHistory.map((h, i) => {
                const metaLine = `${h.playerName || 'プレイヤー'} ・ ${fmtDateShort(h.ts)}`;
                return (
                  <HistoryRow
                    key={i}
                    userImg={h.userImg}
                    targetImg={h.targetImg}
                    stopName={h.stopName}
                    score={h.score}
                    metaLine={metaLine}
                    onOpen={() => setLightbox({ userImg: h.userImg, targetImg: h.targetImg, stopName: h.stopName, metaLine, score: h.score })}
                  />
                );
              })}
          </div>
        </div>
      </div>
      <button className="btn ghost small" type="button" style={{ marginTop: 18 }} onClick={() => setScreen('hero')}>
        ← タイトルへ戻る
      </button>
      {lightbox && <HistoryLightbox data={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  );
}
