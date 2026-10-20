import type { Card, Deck, Owned, Reply } from './types'

/** Claudeの返答から最初のJSONを取り出す（```json フェンス優先、無ければ最初の{...}）。 */
export function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  if (!raw.trim()) throw new Error('JSONが見つかりません')
  return JSON.parse(raw)
}

const isCards = (v: unknown): v is Card[] =>
  Array.isArray(v) && v.every((c) => c && typeof c.name_en === 'string' && Number.isInteger(c.qty) && c.qty > 0)

export function parseReply(text: string): Reply {
  const j = extractJson(text) as any
  switch (j?.kind) {
    case 'deck':
      if (!j.name || !isCards(j.main) || !isCards(j.extra ?? [])) throw new Error('deck形式が不正です')
      return { ...j, extra: j.extra ?? [] }
    case 'collection':
      if (!isCards(j.items)) throw new Error('collection形式が不正です')
      return j
    case 'resources':
      if (!Array.isArray(j.items) || !j.items.every((r: any) => typeof r.key === 'string' && Number.isFinite(r.qty))) throw new Error('resources形式が不正です')
      return j
    case 'proposal':
      if (!['owned', 'free', 'paid'].includes(j.tier) || !Array.isArray(j.swaps)) throw new Error('proposal形式が不正です')
      return j
    case 'meta':
      if (typeof j.summary !== 'string') throw new Error('meta形式が不正です')
      return j
    case 'glossary':
      if (typeof j.term !== 'string') throw new Error('glossary形式が不正です')
      return j
    default:
      throw new Error('kind が不明です')
  }
}

const CARD = '{"name_ja":"日本語名","name_en":"YGOPRODeck準拠の英語名","qty":枚数,"limit":リミット枚数(あれば),"confidence":"high|low"}'
const RULE = '返答は ```json フェンス付きのJSONを1つだけ。説明文は不要。読み取りに自信が無いカードは confidence を "low" にする。'

export const IMPORT_PROMPTS = {
  deck: `添付のデッキ編集画面のスクショ（複数枚）から、デッキを読み取ってください。
形式: {"kind":"deck","name":"デッキ名","skill":"スキル名","main":[${CARD}],"extra":[${CARD}]}
カード名はデュエルリンクス日本語名とYGOPRODeckの英語名の両方を入れる。リミットマークがあれば limit に入れる。
${RULE}`,
  collection: `添付の所持カード一覧のスクショ（または画面収録のコマ）から、カード名と所持枚数を読み取ってください。重複して写っているカードは1つにまとめる。
形式: {"kind":"collection","items":[${CARD}]}
${RULE}`,
  resources: `添付のスクショから、所持ジェム・チケット・宝玉・属性石などの残数を読み取ってください。
形式: {"kind":"resources","items":[{"key":"ジェム","qty":1234}]}
${RULE}`,
  meta: `現在のデュエルリンクスのランク戦環境をWeb検索し、ティア表・注目カード・リミットレギュレーションを要約してください（記事の転載は不可、500字程度）。
形式: {"kind":"meta","summary":"..."}
${RULE}`,
} as const

const fmt = (cs: Card[]) => cs.map((c) => `${c.name_ja ? c.name_ja + ' / ' : ''}${c.name_en} ×${c.qty}${c.limit ? ` (リミット${c.limit})` : ''}`).join('\n')

const TIER_GOAL = {
  owned: '手持ちのカードだけで組み替える案（追加コスト無し）。',
  free: '手持ちのジェム・チケット・宝玉/属性石・イベント報酬で届く無課金案。どのBOXを何ジェム分引くか、何を交換・分解するかの順番まで示す。',
  paid: '無課金で届かないカードについて、課金案。効率のよいBOXと目安のジェム数を示し、予算上限内に収める。',
} as const

export function proposalPrompt(o: {
  tier: keyof typeof TIER_GOAL
  deck: Deck
  owned: Owned[]
  resources: { key: string; qty: number }[]
  meta?: { summary: string; fetched_at: string } | null
  budgetYen?: string
}): string {
  const lines = [
    `デュエルリンクスのランク戦で勝つためのデッキ改善案を出してください（現在ルーキー、過去最高プラチナ。プラチナ以上を狙う水準で）。勝率最優先。`,
    `■今回の提案区分: ${TIER_GOAL[o.tier]}`,
    o.tier === 'paid' ? `■課金予算上限: ${o.budgetYen || '未設定(控えめに)'}` : '',
    `■環境情報(${o.meta ? o.meta.fetched_at + '時点' : '未取得。必要ならWeb検索して最新を反映'}): ${o.meta?.summary ?? ''}`,
    `■現在のデッキ「${o.deck.name}」 スキル:${o.deck.skill ?? '不明'}\n[メイン]\n${fmt(o.deck.main)}\n[EX]\n${fmt(o.deck.extra)}`,
    `■所持カード(デッキ外含む)\n${o.owned.map((c) => `${c.name_ja ?? c.name_en} ×${c.qty}`).join('\n') || '(未登録)'}`,
    o.resources.length ? `■所持リソース: ${o.resources.map((r) => `${r.key}${r.qty}`).join(', ')}` : '',
    `各入れ替えは「IN/OUT・理由・入手手段」、環境デッキとの相性も含める。所持済みのカードの採用可否も理由つきで。`,
    `形式: {"kind":"proposal","tier":"${o.tier}","summary":"要点","swaps":[{"in":"カード名","out":"カード名","reason":"理由","source":"入手手段"}],"matchups":"相性","acquisitions":"入手手順","gems":"ジェム配分(無課金/課金のみ)"}`,
    RULE.replace('読み取りに自信が無いカードは confidence を "low" にする。', ''),
  ]
  return lines.filter(Boolean).join('\n\n')
}

export const glossaryPrompt = (term: string) =>
  `デュエルリンクスの「${term}」について、何に使うか・どこで手に入るか・今優先して使うべきかを調べてください（必要ならWeb検索）。
形式: {"kind":"glossary","term":"${term}","use":"用途","where":"入手先","priority":"優先度と理由"}
${RULE.replace('読み取りに自信が無いカードは confidence を "low" にする。', '')}`
