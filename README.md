# みちくさ (michikusa)

移動中の暇な時間を「京都の道中で出会うお題スポットを探すゲーム」に変える、位置情報×ストリートビュー体験です。

このリポジトリは **フロントエンドとバックエンドに分かれています**:

- `huckthon_react/` — React + TypeScript + Vite のフロントエンド(画面・地図表示・カメラ撮影UI)
- `backend/` — Node.js + Express + Socket.IO のバックエンド(地図/経路/ストリートビューAPIのプロキシ、グループ対戦のルーム管理)

`HuckThon_html/` は元の単一HTMLファイル版です(参照用に残してあります。現在の開発対象は上記2つです)。

## 開発の始め方

ターミナルを2つ開き、それぞれで:

```bash
# 1. バックエンド
cd backend
npm install
cp .env.example .env   # GOOGLE_STREETVIEW_KEY を設定
npm run dev

# 2. フロントエンド
cd huckthon_react
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。詳細は各フォルダの README を参照してください。
