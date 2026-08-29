# みちくさ — frontend (React + TypeScript + Vite)

現在地から目的地までの道中で、道沿いのストリートビュー写真とそっくりの景色を実際に探して撮影する、京都の位置情報探索ゲーム「みちくさ」です。

**バックエンド不要の完全な静的サイトです。** 地図・経路検索(OSM/OSRM)・ストリートビュー(Google Maps Platform)・グループ対戦(Firebase Realtime Database)は、すべてブラウザから直接呼び出します。もとの単一 `index.html` 版と同じアーキテクチャです。

## セットアップ

```bash
npm install
npm run dev
```

## 本番ビルド

```bash
npm run build
```

`dist/` に静的ファイル一式が出力されます。

## デプロイ(Vercel)

1. https://vercel.com で GitHub アカウント連携し、このリポジトリをインポート
2. 「Root Directory」に `huckthon_react` を指定(このリポジトリはfrontendとbackendが同居しているため)
3. Framework Preset は `Vite` が自動検出されます。ビルドコマンド・出力ディレクトリはデフォルトのままでOK
4. Deploy を押すと、`*.vercel.app` のURLで全国どこからでもアクセスできる公開サイトになります

## APIキー・Firebase設定について

`src/lib/config.ts` に、Street View APIキーとFirebaseのWeb設定を直接埋め込んでいます(もとのHTML版と同じ方式)。これらは「秘密情報として隠す」のではなく、提供元サービス側の制限機能で保護する設計です:

- **Street View APIキー**: Google Cloud Console の「認証情報」で、このキーに対して「HTTPリファラー制限」をかけ、公開後のドメイン(例: `https://your-app.vercel.app/*`)のみ許可するよう設定してください。制限をかけないと、誰でもこのキーを使って課金を発生させられる状態になります。
- **Firebase設定**: FirebaseのWeb設定値はもともと非秘匿情報です(公式ドキュメント参照)。実際のアクセス制御はRealtime Databaseの「セキュリティルール」側で行います。現在は元のHTML版から引き継いだテストモード(誰でも読み書き可)のルールのままなので、荒らし対策をしたい場合はFirebaseコンソールの「Realtime Database」→「ルール」で制限を追加してください。

独自のAPIキー・Firebaseプロジェクトに差し替えたい場合は `src/lib/config.ts` を編集してください。

## 構成

- `src/lib/config.ts` — 埋め込みAPIキー・Firebase設定
- `src/lib/api.ts` — 地名検索・経路検索・お題(ストリートビュー地点)生成ロジック(OSM/OSRM/Google Street View を直接呼び出し)
- `src/lib/rooms.ts` — グループ対戦のルーム同期(Firebase Realtime Database)
- `src/lib/geo.ts` / `src/lib/storage.ts` / `src/lib/types.ts` — 距離・スコア計算、localStorageヘルパー、型定義
- `src/state/` — ゲーム全体の状態を持つ `useGameEngine` フックと、それを配る React Context
- `src/components/` — Leaflet地図(経路プレビュー用・答え合わせ用)などの再利用コンポーネント
- `src/screens/` — 画面ごとのコンポーネント(タイトル/旅のしたく/読み込み中/クイズ/答え合わせ/グループ対戦メニュー・待機室・結果/記録)

## `../backend` について

このリポジトリには、APIキーをサーバー側に隠す構成の `backend`(Node/Express)も同梱していますが、上記の「静的サイト構成」では使用していません。より安全な構成(APIキーをブラウザに一切渡さない)にしたくなった場合のための参考実装として残しています。使う場合は `../backend/README.md` を参照し、`src/lib/api.ts` をバックエンドAPI呼び出しに戻す必要があります。
