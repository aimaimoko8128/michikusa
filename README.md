# みちくさ (michikusa)
https://michikusa-one.vercel.app/



移動中の暇な時間を「京都の道中で出会うお題スポットを探すゲーム」に変える、位置情報×ストリートビュー体験です。

**遊ぶ・公開するには `huckthon_react/` だけで完結します。** バックエンド不要の静的サイトです(APIキー・Firebase設定はブラウザに埋め込み、もとの単一HTML版と同じ方式)。`huckthon_react/README.md` にセットアップとVercelへのデプロイ手順を書いています。

`backend/` は、APIキーをサーバー側に隠したい場合の参考実装として同梱しています(デフォルトでは使用していません)。詳細は `backend/README.md` を参照してください。

## 開発の始め方

```bash
cd huckthon_react
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。
