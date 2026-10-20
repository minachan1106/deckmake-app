import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { IMPORT_PROMPTS } from '../lib/bridge'
import { harpieDeck } from '../lib/fixtures'
import type { Card, Deck } from '../lib/types'
import { CardSheet } from '../components/CardSheet'
import { ImportSheet } from '../components/ImportSheet'
import { Btn, PullToRefresh, Skeleton, SwipeRow, useToast } from '../components/ui'

export default function DecksPage() {
  const toast = useToast()
  const [decks, setDecks] = useState<Deck[] | null>(null)
  const [imp, setImp] = useState(false)
  const [card, setCard] = useState<string | null>(null)
  const load = useCallback(async () => setDecks(await api.get<Deck[]>('/decks')), [])
  useEffect(() => { load().catch(() => setDecks([])) }, [load])

  const list = (cs: Card[]) => (
    <ul className="space-y-1">
      {cs.map((c) => (
        <li key={c.name_en}>
          <button onClick={() => setCard(c.name_en)} className="flex min-h-11 w-full items-center justify-between rounded-lg bg-[#141b34] px-3 text-left">
            <span className="truncate text-sm">{c.name_ja ?? c.name_en}{c.limit ? <em className="ml-1 text-xs text-amber-300">リミット{c.limit}</em> : null}</span>
            <b className="ml-2">×{c.qty}</b>
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <PullToRefresh onRefresh={load}>
        <div className="space-y-4 px-4 pb-28">
          {decks === null ? <Skeleton /> : decks.length === 0 ? (
            <div className="space-y-3 rounded-2xl bg-[#141b34] p-5 text-center">
              <p className="text-slate-300">デッキがまだありません。デッキ編集画面のスクショを取り込みましょう。</p>
              <Btn kind="ghost" className="w-full" onClick={async () => { await api.post('/decks', { ...harpieDeck, is_current: true }); toast('テストデッキを追加'); load() }}>テストデータ（新ハーピィ）を入れる</Btn>
            </div>
          ) : decks.map((d) => (
            <SwipeRow key={d.id} actions={[{ label: '削除', color: 'bg-rose-600', run: async () => { await api.del('/decks/' + d.id); toast('削除しました'); load() } }]}>
              <details className="p-3" open={!!d.is_current}>
                <summary className="flex min-h-11 cursor-pointer items-center justify-between">
                  <span className="font-bold">{d.name}{d.is_current ? <span className="ml-2 rounded bg-violet-500/30 px-1.5 text-xs">現在</span> : null}</span>
                  <span className="text-xs text-slate-400">{d.main.reduce((a, c) => a + c.qty, 0)}+{d.extra.reduce((a, c) => a + c.qty, 0)}</span>
                </summary>
                <p className="mb-2 text-xs text-slate-400">スキル: {d.skill ?? '—'}</p>
                {list(d.main)}
                <p className="my-2 text-xs text-slate-400">EXデッキ</p>
                {list(d.extra)}
              </details>
            </SwipeRow>
          ))}
        </div>
      </PullToRefresh>
      <button onClick={() => setImp(true)} className="fixed bottom-24 right-4 z-30 h-14 rounded-full bg-violet-500 px-5 font-bold shadow-xl active:scale-95">＋ 取り込み</button>
      <ImportSheet open={imp} onClose={() => setImp(false)} title="デッキを取り込む" expect="deck" prompt={IMPORT_PROMPTS.deck} onDone={load} />
      <CardSheet name={card} onClose={() => setCard(null)} />
    </>
  )
}
