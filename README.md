# DeckMake

デュエルリンクスのデッキ強化アプリ（自分用・スマホ向けPWA）。設計方針は [CLAUDE.md](./CLAUDE.md)。

## 使い方（Claudeブリッジ）
アプリ内でAIは呼びません。各「取り込み」画面で ①指示をコピー → Claudeアプリに貼付（スクショ添付）→ ②返答JSONを貼り付け、で保存されます。

## デプロイ（スマホのみ・ブラウザで完結）
1. dash.cloudflare.com → Workers & Pages → Create → **Import a repository** → GitHub の `deckmake-app`、ブランチ `claude/duel-links-deck-builder-nkt50d`
2. ビルドコマンド `npm run build` / デプロイコマンド `npx wrangler deploy`（D1は初回デプロイで自動作成）
3. 発行された `*.workers.dev` URLを開く → 共有→ホーム画面に追加
4. ⚙️設定 →「カードDBを同期」
5. （推奨）Zero Trust → Access でこのURLにワンタイムPINを設定

## ローカル開発（PC用・任意）
```
npm i && npm run dev:worker   # 8787
npm run dev                   # 5173
```
