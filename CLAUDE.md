# CLAUDE.md — デュエルリンクス デッキ強化アプリ

遊戯王デュエルリンクスの「デッキ／所持カード／所持リソース」から、ランク戦で勝つための改善案（手持ち→無課金→課金）を出す**自分用スマホアプリ**。要件の原本は `docs/requirements.md`。

## 最重要の設計判断

- **アプリ内でAI APIは呼ばない**（Claude.aiサブスクのみ・APIキー無し）。
  代わりに「**Claudeブリッジ**」方式：アプリが文脈＋指示をワンタップでコピー → ユーザーがClaudeアプリへ貼り付け（スクショも添付）→ Claudeが返す**JSON**をアプリへ貼り戻して取り込む。
  - プロンプト生成・JSONスキーマ・取り込み検証は `src/lib/bridge.ts` に集約。Claudeの返答は必ず ```json フェンス付きで1つだけ返させる。
  - 将来APIキーを使えるようになっても、`bridge.ts` の入出力スキーマを流用して差し替えられる構造を保つ。
- **スマホ最優先・入力は最小タップ**。キーボード入力を要求しない設計を優先（検索はオートコンプリート、枚数は±ボタン／スワイプ、取り込みは貼り付けボタン1回）。
- データには必ず取得日時（`fetched_at` / `updated_at`）を持たせる。

## 技術スタック

| 層 | 採用 |
|---|---|
| フロント | React 19 + TypeScript + Vite + Tailwind CSS v4（PWA、ホーム画面追加前提） |
| API | Cloudflare Workers + Hono（`worker/`）。`/api/*` |
| DB | Cloudflare D1（SQLite）。`migrations/` で管理 |
| 配信 | Workers Static Assets（`dist/` をWorkerと同一デプロイ） |
| 認証 | 最小：Cloudflare Access（ワンタイムPIN）をダッシュボード側で設定。アプリ内に認証コードは持たない |
| カードDB | YGOPRODeck API v7（`format=duel links`）。**Worker経由で1回だけ全件取得しD1にキャッシュ**。クライアントからは直接叩かない |
| テスト | Vitest（`src/lib` の純粋ロジックを中心に） |

## UI方針（採用パターン）

- **下タブ**（デッキ／所持／提案／検索）＋ 親指で届く位置に主要操作
- **ボトムシート**：カード詳細・取り込み・設定はすべて下からせり上がる
- **スワイプアクション**：所持カード行を横スワイプで 分解候補／削除。±1は行内ボタン
- **オートコンプリート**：カード名・アイテム名（日本語/英語の両対応、`name_map` と `cards` を横断）
- **スケルトン／トースト／Pull to Refresh**：待ち時間と保存フィードバックの標準部品（`src/components/`）
- タップ領域は最小44px、ダークテーマ既定、セーフエリア対応（`env(safe-area-inset-*)`）

## ディレクトリ

```
worker/        Hono API（index.ts がエントリ、routes は機能単位）
src/           フロント（components / pages / lib）
src/lib/       bridge.ts(Claude連携) matching.ts(名前照合) api.ts(fetchラッパ) など純粋ロジック
migrations/    D1 SQL（連番、既存は編集せず追加する）
docs/          要件定義
```

## コマンド

```
npm run dev          # フロント(Vite)。/api は wrangler dev(8787) にプロキシ
npm run dev:worker   # Worker + ローカルD1
npm run db:local     # ローカルD1へmigration適用
npm run typecheck && npm test && npm run build   # コミット前に必ず通す
npm run deploy       # 本番（事前に wrangler d1 create deckmake → wrangler.jsonc の database_id を設定、npm run db:remote）
```

## 実装ルール

- YGOPRODeck: レート制限1秒20リクエスト・超過で1時間ブロック。**全件同期は1リクエスト**で行い、個別カード取得のループ禁止。画像は直リンクせずR2等へ自前保持（現状は画像なしで運用）。
- 外部サイト記事は丸ごと保存しない。`meta_snapshots` には要約のみ。スクレイピングはしない（環境情報はClaudeのWeb検索結果をブリッジで取り込む）。
- 日本語名照合の確定結果は `name_map`（`source: 'confirmed'`）へ。曖昧な候補だけユーザー確認UIに出す。
- D1スキーマ変更は新しい migration ファイルを追加。
- 提案は常に「手持ちのみ／無課金／課金あり」を分け、`meta_snapshots` の取得日時を併記する。
- 想定ユーザー前提：復帰直後（現ルーキー、過去最高プラチナ）。提案はプラチナ以上水準。

## フェーズ進捗

- Phase 1（MVP）: F1/F2/F4 取り込み＋手持ち提案 ← **着手中**
- Phase 2: F3/F5(無課金・課金)/F6/F7
- Phase 3: F2動画/F8/F9一覧拡充

## 未決事項（decisions）

- コマ切り出し（動画）: Phase 3で、端末側（ブラウザ canvas）処理を第一候補とする。
- BOX別収録データの取得元: ブリッジ経由でClaude Web検索結果を `glossary` / `meta_snapshots` に取り込む運用で開始。
