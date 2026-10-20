import { useEffect, useState } from 'react'
import { api, copyText, readClipboard } from '../lib/api'
import { parseReply } from '../lib/bridge'
import type { Card, Reply } from '../lib/types'
import { BottomSheet, Btn, useToast } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  expect: Reply['kind']
  prompt: string
  onDone: () => void
  /** collectionのとき: 差分追加か全置換か */
  collectionMode?: boolean
  asCurrentDeck?: boolean
}

export function ImportSheet({ open, onClose, title, expect, prompt, onDone, collectionMode, asCurrentDeck = true }: Props) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [reply, setReply] = useState<Reply | null>(null)
  const [unverified, setUnverified] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'add' | 'replace'>('add')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (!open) { setText(''); setReply(null); setErr(''); setUnverified(new Set()) } }, [open])

  const cards = (r: Reply | null): Card[] =>
    r?.kind === 'deck' ? [...r.main, ...r.extra] : r?.kind === 'collection' ? r.items : []

  async function parse(raw: string) {
    setErr('')
    try {
      const r = parseReply(raw)
      if (r.kind !== expect) throw new Error(`${expect}形式ではありません（${r.kind}）`)
      setReply(r)
      const cs = cards(r)
      if (cs.length) {
        const st = await api.get<{ n: number }>('/cards/status')
        if (st.n > 0) {
          const v = await api.post<Record<string, string | null>>('/import/verify', { names: [...new Set(cs.map((c) => c.name_en))] })
          setUnverified(new Set(Object.entries(v).filter(([, x]) => !x).map(([k]) => k)))
        }
      }
    } catch (e) {
      setReply(null)
      setErr((e as Error).message)
    }
  }

  async function paste() {
    const t = await readClipboard()
    if (!t) { toast('貼り付け許可が出ない場合は下の欄に貼ってください'); return }
    setText(t); await parse(t)
  }

  const edit = (fn: (cs: Card[]) => Card[], which: 'main' | 'extra' | 'items') =>
    setReply((r) => (r && (r.kind === 'deck' || r.kind === 'collection') ? ({ ...r, [which]: fn((r as any)[which]) } as Reply) : r))

  async function commit() {
    if (!reply) return
    setBusy(true)
    try {
      const maps = cards(reply).filter((c) => c.name_ja).map((c) => ({ name_ja: c.name_ja!, name_en: c.name_en }))
      if (reply.kind === 'deck') {
        await api.post('/decks', { name: reply.name, skill: reply.skill, main: reply.main, extra: reply.extra, is_current: asCurrentDeck })
      } else if (reply.kind === 'collection') {
        await api.post('/collection/import', { items: reply.items, mode })
      } else if (reply.kind === 'resources') {
        await api.put('/resources', reply.items)
      } else if (reply.kind === 'meta') {
        await api.post('/meta', { summary: reply.summary })
      } else if (reply.kind === 'glossary') {
        await api.post('/glossary', reply)
      } else if (reply.kind === 'proposal') {
        const m = await api.get<{ fetched_at: string } | null>('/meta')
        const { kind: _k, ...body } = reply
        await api.post('/proposals', { tier: reply.tier, body, meta_at: m?.fetched_at })
      }
      if (maps.length) await api.post('/namemap', maps)
      toast('保存しました')
      onDone(); onClose()
    } catch (e) {
      setErr((e as Error).message)
    } finally { setBusy(false) }
  }

  const row = (c: Card, i: number, which: 'main' | 'extra' | 'items') => {
    const warn = c.confidence === 'low' || unverified.has(c.name_en)
    return (
      <li key={which + i} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${warn ? 'bg-amber-500/15 ring-1 ring-amber-400/60' : 'bg-[#1a2140]'}`}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{c.name_ja ?? c.name_en}</div>
          <div className="truncate text-xs text-slate-400">{c.name_en}{warn && ' ・要確認'}</div>
        </div>
        <button className="h-9 w-9 rounded-lg bg-[#232c55]" onClick={() => edit((cs) => cs.map((x, k) => (k === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)), which)}>−</button>
        <span className="w-5 text-center font-bold">{c.qty}</span>
        <button className="h-9 w-9 rounded-lg bg-[#232c55]" onClick={() => edit((cs) => cs.map((x, k) => (k === i ? { ...x, qty: x.qty + 1 } : x)), which)}>＋</button>
        <button className="h-9 w-9 rounded-lg text-rose-300" onClick={() => edit((cs) => cs.filter((_, k) => k !== i), which)}>✕</button>
      </li>
    )
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="space-y-3 pb-3">
        <div className="rounded-xl bg-[#1a2140] p-3 text-sm text-slate-300">
          ① 指示をコピー → Claudeアプリに貼付（スクショがある場合は一緒に添付）<br />② Claudeの返答をコピー → 下で貼り付け
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Btn kind="ghost" onClick={async () => toast((await copyText(prompt)) ? '指示をコピーしました' : 'コピーに失敗しました')}>① 指示をコピー</Btn>
          <Btn onClick={paste}>② 返答を貼り付け</Btn>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text && !reply && parse(text)} rows={2}
          placeholder="貼り付けできない場合はここに返答を貼る" className="w-full rounded-xl bg-[#1a2140] p-3 text-sm outline-none ring-1 ring-slate-700" />
        {err && <p className="rounded-lg bg-rose-500/15 p-3 text-sm text-rose-200">{err}</p>}

        {reply?.kind === 'deck' && (
          <>
            <p className="font-bold">{reply.name}<span className="ml-2 text-sm font-normal text-slate-400">スキル: {reply.skill ?? '—'}</span></p>
            <p className="text-xs text-slate-400">メイン {reply.main.reduce((a, c) => a + c.qty, 0)}枚 / EX {reply.extra.reduce((a, c) => a + c.qty, 0)}枚</p>
            <ul className="space-y-1.5">{reply.main.map((c, i) => row(c, i, 'main'))}</ul>
            <p className="pt-1 text-xs text-slate-400">EXデッキ</p>
            <ul className="space-y-1.5">{reply.extra.map((c, i) => row(c, i, 'extra'))}</ul>
          </>
        )}
        {reply?.kind === 'collection' && (
          <>
            {collectionMode !== false && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {(['add', 'replace'] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} className={`h-11 rounded-xl font-bold ${mode === m ? 'bg-violet-500' : 'bg-[#232c55]'}`}>{m === 'add' ? '差分を加算' : '全置換'}</button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400">{reply.items.length}種類</p>
            <ul className="space-y-1.5">{reply.items.map((c, i) => row(c, i, 'items'))}</ul>
          </>
        )}
        {reply?.kind === 'resources' && <ul className="space-y-1">{reply.items.map((r) => <li key={r.key} className="flex justify-between rounded-lg bg-[#1a2140] px-3 py-2"><span>{r.key}</span><b>{r.qty}</b></li>)}</ul>}
        {reply?.kind === 'meta' && <p className="whitespace-pre-wrap rounded-xl bg-[#1a2140] p-3 text-sm">{reply.summary}</p>}
        {reply?.kind === 'glossary' && <div className="rounded-xl bg-[#1a2140] p-3 text-sm"><b>{reply.term}</b><br />{reply.use}</div>}
        {reply?.kind === 'proposal' && <p className="rounded-xl bg-[#1a2140] p-3 text-sm">{reply.summary}（入替{reply.swaps.length}件）</p>}

        {reply && <Btn className="sticky bottom-2 w-full" disabled={busy} onClick={commit}>{busy ? '保存中…' : '保存する'}</Btn>}
      </div>
    </BottomSheet>
  )
}
