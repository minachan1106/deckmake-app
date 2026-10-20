import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { glossaryPrompt } from '../lib/bridge'
import { CardSheet } from '../components/CardSheet'
import { ImportSheet } from '../components/ImportSheet'
import { Autocomplete, Btn } from '../components/ui'

type Term = { term: string; use: string; where: string; priority: string; updated_at: string }

export default function SearchPage() {
  const [card, setCard] = useState<string | null>(null)
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<Term[]>([])
  const [imp, setImp] = useState(false)
  const [recent, setRecent] = useState<Term[]>([])
  const load = () => api.get<Term[]>('/glossary').then(setRecent).catch(() => {})
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!term.trim()) { setHits([]); return }
    const t = setTimeout(() => api.get<Term[]>('/glossary?q=' + encodeURIComponent(term)).then(setHits).catch(() => {}), 200)
    return () => clearTimeout(t)
  }, [term])

  const T = ({ t }: { t: Term }) => (
    <div className="space-y-1 rounded-xl bg-[#1a2140] p-3 text-sm">
      <b>{t.term}</b>
      <p>用途: {t.use}</p><p>入手: {t.where}</p><p>優先度: {t.priority}</p>
      <p className="text-xs text-slate-500">{new Date(t.updated_at).toLocaleDateString('ja-JP')}時点</p>
    </div>
  )
  return (
    <div className="h-full space-y-4 overflow-y-auto px-4 pb-8">
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-300">カード検索</h2>
        <Autocomplete placeholder="カード名（日本語/英語）" onPick={(s) => setCard(s.name_en)} />
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-300">アイテム・用語</h2>
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="例: 属性石, ジェム, 交換所"
          className="h-12 w-full rounded-xl bg-[#1a2140] px-4 outline-none ring-1 ring-slate-700 focus:ring-violet-400" />
        {term && hits.map((t) => <T key={t.term} t={t} />)}
        {term.trim() && <Btn kind="ghost" className="w-full" onClick={() => setImp(true)}>「{term}」をClaudeに調べてもらう</Btn>}
        {!term && recent.map((t) => <T key={t.term} t={t} />)}
      </section>
      <CardSheet name={card} onClose={() => setCard(null)} />
      <ImportSheet open={imp} onClose={() => setImp(false)} title={`「${term}」を調べる`} expect="glossary" prompt={glossaryPrompt(term)} onDone={() => { load(); setTerm((t) => t + ' ') }} />
    </div>
  )
}
