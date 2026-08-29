# みちくさ — frontend (React + TypeScript + Vite)

現在地から目的地までの道中で、道沿いのストリートビュー写真とそっくりの景色を実際に探して撮影する、京都の位置情報探索ゲーム「みちくさ」のフロントエンドです。

もとは単一の `index.html`(HuckThon_html)にすべて詰め込まれていたものを、フロントエンド(このプロジェクト)とバックエンド(`../backend`)に分割しました。地図・経路検索・ストリートビュー・グループ対戦の実データはすべて `../backend` の API/Socket.IO 経由で取得します。

## セットアップ

```bash
npm install
npm run dev
```

`../backend` も同時に起動しておく必要があります(`../backend/README.md` 参照)。開発時は Vite の dev サーバーが `/api` と `/socket.io` を `http://localhost:8787`(バックエンド)へ自動でプロキシします(`vite.config.ts`)。

## 本番ビルド

```bash
npm run build
```

バックエンドを別ホストで動かす場合は、`.env` に

```
VITE_API_BASE=https://your-backend.example.com
```

を設定してください(同一オリジンで配信する場合は不要です)。

## 構成

- `src/lib/` — 型定義、REST APIクライアント、Socket.IOクライアント、位置情報・スコア計算、localStorage ヘルパー
- `src/state/` — ゲーム全体の状態を持つ `useGameEngine` フックと、それを配る React Context
- `src/components/` — Leaflet地図(経路プレビュー用・答え合わせ用)などの再利用コンポーネント
- `src/screens/` — 画面ごとのコンポーネント(タイトル/旅のしたく/読み込み中/クイズ/答え合わせ/グループ対戦メニュー・待機室・結果/記録)

## 元のHTML版との違い

- ストリートビューAPIキーはバックエンドの環境変数のみで保持し、ブラウザには一切送られません(画像はバックエンドがプロキシします)。
- グループ対戦は Firebase Realtime Database の代わりに、バックエンドの Socket.IO ルームで同期します(サーバー再起動でルームはリセットされます)。
- 旧HTMLに埋め込まれていた「京都写真16枚+装飾画像」のJSON(約1.8MB)は、実際のゲームロジックからは参照されていなかったため(実写ストリートビューのみを使う実装になっていました)、`GET /api/landmarks` として軽量に提供するだけに留めています。
