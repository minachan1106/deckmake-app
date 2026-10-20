import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { IMPORT_PROMPTS } from '../lib/bridge'
import { ImportSheet } from '../components/ImportSheet'
import { BottomSheet, Btn, useToast } from '../components/ui'

const KEYS = ['ジェム', 'チケット', '宝玉', '属性石']
const date = (s?: string | null) => (s ? new Date(s).toLocaleString('ja-JP') : '未取得')

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [res, setRes] = useState<Record<string, number>>({})
  const [budget, setBudget] = useState('')
  const [db, setDb] = useState<{ n: number; t: string | null } | null>(null)
  const [meta, setMeta] = useState<{ fetched_at: string } | null>(null)
  const [imp, setImp] = useState<'resources' | 'meta' | null>(null)
  const [syncing, setSyncing] = useState(false)

  const load = () => Promise.all([
    api.get<{ key: string; qty: number }[]>('/resources').then((r) => setRes(Object.fromEntries(r.map((x) => [x.key, x.qty])))),
    api.get<Record<string, string>>('/settings').then((s) => setBudget(s.budget ?? '')),
    api.get<{ n: number; t: string | null }>('/cards/status').then(setDb),
    api.get<{ fetched_at: string } | null>('/meta').then(setMeta),
  ]).catch(() => {})
  useEffect(() => { if (open) load() }, [open])

  const keys = [...new Set([...KEYS, ...Object.keys(res)])]
  return (
    <>
      <BottomSheet open={open && !imp} onClose={onClose} title="設定">
        <div className="space-y-5 pb-4">
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-300">所持リソース</h3>
            <div className="grid grid-cols-2 gap-2">
              {keys.map((k) => (
                <label key={k} className="rounded-xl bg-[#1a2140] p-2 text-xs text-slate-400">{k}
                  <input inputMode="numeric" value={res[k] ?? ''} onChange={(e) => setRes({ ...res, [k]: Number(e.target.value.replace(/\D/g, '')) })}
                    onBlur={() => api.put('/resources', [{ key: k, qty: res[k] ?? 0 }]).then(() => toast('保存しました'))}
                    className="mt-1 h-10 w-full bg-transparent text-lg font-bold text-white outline-none" />
                </label>
              ))}
            </div>
            <Btn kind="ghost" className="w-full" onClick={() => setImp('resources')}>スクショから取り込む</Btn>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-300">課金の予算上限</h3>
            <input value={budget} onChange={(e) => setBudget(e.target.value)} onBlur={() => api.put('/settings', { budget }).then(() => toast('保存しました'))}
              placeholder="例: 3000円" className="h-12 w-full rounded-xl bg-[#1a2140] px-4 outline-none ring-1 ring-slate-700" />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-300">環境情報</h3>
            <p className="text-xs text-slate-400">最終取り込み: {date(meta?.fetched_at)}（週1回を目安に更新）</p>
            <Btn kind="ghost" className="w-full" onClick={() => setImp('meta')}>環境情報を取り込む</Btn>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-300">カードDB（YGOPRODeck）</h3>
            <p className="text-xs text-slate-400">{db?.n ?? 0}枚 ・ 最終同期 {date(db?.t)}</p>
            <Btn className="w-full" disabled={syncing} onClick={async () => {
              setSyncing(true)
              try { const r = await api.post<{ skipped?: boolean; count?: number }>('/cards/sync', {}); toast(r.skipped ? '24時間以内に同期済み' : `${r.count}枚を同期`); load() }
              catch (e) { toast((e as Error).message) } finally { setSyncing(false) }
            }}>{syncing ? '同期中…' : 'カードDBを同期'}</Btn>
          </section>
        </div>
      </BottomSheet>
      <ImportSheet open={imp === 'resources'} onClose={() => setImp(null)} title="リソースを取り込む" expect="resources" prompt={IMPORT_PROMPTS.resources} onDone={load} />
      <ImportSheet open={imp === 'meta'} onClose={() => setImp(null)} title="環境情報を取り込む" expect="meta" prompt={IMPORT_PROMPTS.meta} onDone={load} />
    </>
  )
}
