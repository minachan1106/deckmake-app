export type Card = { name_en: string; name_ja?: string | null; qty: number; limit?: number; confidence?: 'high' | 'low' }
export type Deck = { id?: number; name: string; skill?: string | null; main: Card[]; extra: Card[]; is_current?: number; updated_at?: string }
export type Owned = { name_en: string; name_ja?: string | null; qty: number; disposal: number; updated_at: string }
export type Suggest = { id?: number | null; name_en: string; name_ja?: string; type?: string }
export type Swap = { in: string; out: string; reason: string; source?: string }
export type Proposal = {
  tier: 'owned' | 'free' | 'paid'
  summary: string
  swaps: Swap[]
  matchups?: string
  acquisitions?: string
  gems?: string
}
export type Reply =
  | { kind: 'deck'; name: string; skill?: string; main: Card[]; extra: Card[] }
  | { kind: 'collection'; items: Card[] }
  | { kind: 'resources'; items: { key: string; qty: number }[] }
  | ({ kind: 'proposal' } & Proposal)
  | { kind: 'meta'; summary: string }
  | { kind: 'glossary'; term: string; use: string; where: string; priority: string }
