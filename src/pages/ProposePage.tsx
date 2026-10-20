import { useCallback, useEffect, useState } from 'react'
import { api, copyText } from '../lib/api'
import { proposalPrompt } from '../lib/bridge'
import type { Deck, Owned, Proposal } from '../lib/types'
import { ImportSheet } from '../components/ImportSheet'
import { Btn, PullToRefresh, Skeleton, SwipeRow, useToast } from '../components/ui'

type Tier = Proposal['tier']
const TIERS: { id: Tier; label: string }[] = [
  { id: 'owned', label: '手持ちのみ' },
  { id: 'free', label: '無課金' },
  { id: 'paid', label: '課金あり' },
]
type Saved = { id: number; tier: Tier; meta_at: string | null; created_at: string; body: Proposal }
const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString('ja-JP') : '未取得')

export default function ProposePage() {
  const toast = useToast()
  const [tier, setTier] = useState<Tier>('owned')
  const [saved, setSaved] = useState<Saved[] | null>(null)
  const [imp, setImp] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [meta, setMeta] = useState<{ summary: string; fetched_at: string } | null>(null)

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([api.get<Saved[]>('/proposals'), api.get<typeof meta>('/meta')])
    setSaved(s); setMeta(m)
  }, [])
  useEffect(() => { load().catch(() => setSaved([])) }, [load])

  async function ask() {
    const [decks, owned, resources, settings] = await Promise.all([
      api.get<Deck[]>('/decks'), api.get<Owned[]>('/collection'), api.get<{ key: string; qty: number }[]>('/resources'), api.get<Record<string, string>>('/settings'),
    ])
    const deck = decks.find((d) => d.is_current) ?? decks[0]
    if (!deck) { toast('先にデッキを登録してください'); return }
    const p = proposalPrompt({ tier, deck, owned, resources, meta, budgetYen: settings.budget })
    setPrompt(p)
    toast((await copyText(p)) ? '指示をコピー → Claudeに貼付' : 'コピー失敗（シートからコピー）')
    setImp(true)
  }

  const mine = (saved ?? []).filter((s) => s.tier === tier)
  return (
    <>
      <PullToRefresh onRefresh={load}>
        <div className="space-y-3 px-4 pb-8">
          <div className="grid grid-cols-3 gap-2 text-sm">
            {TIERS.map((t) => <button key={t.id} onClick={() => setTier(t.id)} className={`h-11 rounded-xl font-bold ${tier === t.id ? 'bg-violet-500' : 'bg-[#232c55]'}`}>{t.label}</button>)}
          </div>
          <p className="text-xs text-slate-400">環境情報: {date(meta?.fetched_at)}時点{!meta && '（⚙️設定から取り込み推奨）'}</p>
          <Btn className="w-full" onClick={ask}>Claudeに提案を依頼（指示をコピー）</Btn>
          {saved === null ? <Skeleton rows={3} /> : mine.length === 0 ? <p className="py-8 text-center text-slate-400">この区分の提案はまだありません</p> : mine.map((s) => (
            <SwipeRow key={s.id} actions={[{ label: '削除', color: 'bg-rose-600', run: async () => { await api.del('/proposals/' + s.id); load() } }]}>
              <div className="space-y-2 p-3 text-sm">
                <p className="text-xs text-slate-400">{date(s.created_at)} ・ 環境 {date(s.meta_at)}時点</p>
                <p className="font-bold">{s.body.summary}</p>
                {s.body.swaps.map((w, i) => (
                  <div key={i} className="rounded-lg bg-[#0f1630] p-2">
                    <div><span className="text-emerald-300">IN</span> {w.in} <span className="ml-2 text-rose-300">OUT</span> {w.out}</div>
                    <p className="mt-1 text-slate-300">{w.reason}</p>
                    {w.source && <p className="text-xs text-slate-400">入手: {w.source}</p>}
                  </div>
                ))}
                {s.body.matchups && <p><b>相性</b> {s.body.matchups}</p>}
                {s.body.acquisitions && <p><b>入手手順</b> {s.body.acquisitions}</p>}
                {s.body.gems && <p><b>ジェム配分</b> {s.body.gems}</p>}
              </div>
            </SwipeRow>
          ))}
        </div>
      </PullToRefresh>
      <ImportSheet open={imp} onClose={() => setImp(false)} title="提案を取り込む" expect="proposal" prompt={prompt} onDone={load} />
    </>
  )
}
