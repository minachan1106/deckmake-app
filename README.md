# DeckMake

デュエルリンクスのデッキ強化アプリ（自分用・スマホ向けPWA）。設計方針は [CLAUDE.md](./CLAUDE.md)。

## 使い方（Claudeブリッジ）
アプリ内でAIは呼びません。各「取り込み」画面で ①指示をコピー → Claudeアプリに貼付（スクショ添付）→ ②返答JSONを貼り付け、で保存されます。

## セットアップ
```
npm i
npm run db:local && npm run dev:worker   # Worker + ローカルD1 (8787)
npm run dev                              # フロント (5173, /apiをプロキシ)
# 本番: npx wrangler d1 create deckmake → wrangler.jsonc の database_id 設定 → npm run db:remote && npm run deploy
```
初回は ⚙️設定 →「カードDBを同期」を実行。認証は Cloudflare Access をダッシュボードで設定。
