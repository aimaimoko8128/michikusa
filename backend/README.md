# みちくさ — backend (Node.js + Express + Socket.IO)

> **注記**: 現在 `../huckthon_react` はデフォルトでこのバックエンドを使わず、完全な静的サイト(APIキー埋め込み + Firebase直接接続)として動作します。このバックエンドは、APIキーをサーバー側に隠したい場合の参考実装として残しています。使う場合は `../huckthon_react/src/lib/api.ts` と `src/lib/rooms.ts` をこちらのAPI/Socket.IO呼び出しに戻してください。

「みちくさ」のバックエンドAPIです(オプション)。使用する場合、フロントエンド(`../huckthon_react`)から呼び出されます。

## 責務

- **地名検索・逆ジオコーディング** (`/api/geocode/*`): Nominatim (OpenStreetMap) をプロキシ
- **徒歩ルート検索** (`/api/route`): OSRMをプロキシ、失敗時は直線にフォールバック
- **お題(道中のストリートビュー地点)生成** (`POST /api/streetview/quiz/generate`): ルート沿いの候補地点をサンプリングし、実写パノラマがあり徒歩到達可能な地点だけを採用してお題を組み立てる
- **ストリートビュー画像プロキシ** (`GET /api/streetview/image`): Google Maps APIキーをブラウザに一切渡さずに画像を配信
- **グループ対戦のルーム管理** (Socket.IO): ルーム作成・参加・お題配信・回答集計・リアルタイム順位表(旧版のFirebase Realtime Databaseを置き換え)
- **同梱データ配信** (`/api/landmarks`, `/images/*`): 旧HTMLに埋め込まれていた京都写真16枚+装飾画像(現状のゲームロジックからは未使用ですが、そのまま残しています)

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env` を編集し、`GOOGLE_STREETVIEW_KEY` にGoogle Maps Platformの Street View Static API キーを設定してください(このキーがないと `POST /api/streetview/quiz/generate` と画像プロキシは動きません)。

```bash
npm run dev   # nodeのwatchモードで起動
# もしくは
npm start
```

デフォルトで `http://localhost:8787` で待ち受けます。`CORS_ORIGIN` にフロントエンドのオリジン(開発時は `http://localhost:5173`)を設定してください。

## ルーム(グループ対戦)について

ルームはメモリ上に保持しているだけなので、サーバーを再起動すると消えます。本番運用で永続化やスケールアウト(複数プロセス/複数台)が必要になった場合は `src/rooms/roomManager.js` をRedis等に置き換えてください。
