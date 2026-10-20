import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { IMPORT_PROMPTS } from '../lib/bridge'
import type { Owned } from '../lib/types'
import { CardSheet } from '../components/CardSheet'
import { ImportSheet } from '../components/ImportSheet'
import { Autocomplete, PullToRefresh, Skeleton, SwipeRow, useToast } from '../components/ui'

export default function CollectionPage() {
  const toast = useToast()
  const [rows, setRows] = useState<Owned[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'dup' | 'disposal'>('all')
  const [imp, setImp] = useState(false)
  const [card, setCard] = useState<string | null>(null)
  const load = useCallback(async () => setRows(await api.get<Owned[]>('/collection')), [])
  useEffect(() => { load().catch(() => setRows([])) }, [load])

  const shown = useMemo(() => (rows ?? []).filter((r) => filter === 'all' || (filter === 'dup' ? r.qty > 3 : r.disposal === 1)), [rows, filter])
  const update = async (r: Owned, p: Partial<Owned>) => {
    setRows((s) => s && s.map((x) => (x.name_en === r.name_en ? { ...x, ...p } : x)).filter((x) => x.qty > 0))
    await api.put('/collection/item', { name_en: r.name_en, ...p })
  }

  return (
    <>
      <PullToRefresh onRefresh={load}>
        <div className="space-y-3 px-4 pb-28">
          <Autocomplete placeholder="カード名で追加（日本語/英語）" onPick={async (s) => { await api.put('/collection/item', { name_en: s.name_en, name_ja: s.name_ja, qty: 1 }); toast(`${s.name_ja ?? s.name_en} を追加`); load() }} />
          <div className="grid grid-cols-3 gap-2 text-sm">
            {([['all', `全て ${rows?.length ?? ''}`], ['dup', '3枚超'], ['disposal', '分解候補']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`h-11 rounded-xl font-bold ${filter === k ? 'bg-violet-500' : 'bg-[#232c55]'}`}>{l}</button>
            ))}
          </div>
          <p className="text-xs text-slate-500">← 左スワイプで「分解候補／削除」</p>
          {rows === null ? <Skeleton /> : shown.length === 0 ? <p className="py-10 text-center text-slate-400">カードがありません。右下の「取り込み」から登録</p> : (
            <ul className="space-y-1.5">
              {shown.map((r) => (
                <li key={r.name_en}>
                  <SwipeRow actions={[
                    { label: r.disposal ? '解除' : '分解候補', color: 'bg-amber-600', run: () => update(r, { disposal: r.disposal ? 0 : 1 }) },
                    { label: '削除', color: 'bg-rose-600', run: () => { update(r, { qty: 0 }); toast('削除しました') } },
                  ]}>
                    <div className="flex min-h-14 items-center gap-2 px-3">
                      <button className="min-w-0 flex-1 text-left" onClick={() => setCard(r.name_en)}>
                        <div className="truncate text-sm">{r.disposal ? '♻️ ' : ''}{r.name_ja ?? r.name_en}</div>
                        {r.name_ja && <div className="truncate text-xs text-slate-400">{r.name_en}</div>}
                      </button>
                      <button className="h-10 w-10 rounded-lg bg-[#232c55] text-lg" onClick={() => update(r, { qty: r.qty - 1 })}>−</button>
                      <span className="w-6 text-center font-bold">{r.qty}</span>
                      <button className="h-10 w-10 rounded-lg bg-[#232c55] text-lg" onClick={() => update(r, { qty: r.qty + 1 })}>＋</button>
                    </div>
                  </SwipeRow>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PullToRefresh>
      <button onClick={() => setImp(true)} className="fixed bottom-24 right-4 z-30 h-14 rounded-full bg-violet-500 px-5 font-bold shadow-xl active:scale-95">＋ 取り込み</button>
      <ImportSheet open={imp} onClose={() => setImp(false)} title="所持カードを取り込む" expect="collection" prompt={IMPORT_PROMPTS.collection} onDone={load} />
      <CardSheet name={card} onClose={() => setCard(null)} />
    </>
  )
}
