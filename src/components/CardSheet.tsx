import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { BottomSheet, Skeleton } from './ui'

type Info = { name_en: string; type: string; desc: string; race?: string; attribute?: string; level?: number; atk?: number; def?: number }

export function CardSheet({ name, onClose }: { name: string | null; onClose: () => void }) {
  const [info, setInfo] = useState<Info | null | undefined>(undefined)
  useEffect(() => {
    if (!name) return
    setInfo(undefined)
    api.get<Info>('/cards/by-name?name=' + encodeURIComponent(name)).then(setInfo).catch(() => setInfo(null))
  }, [name])
  return (
    <BottomSheet open={!!name} onClose={onClose} title={name ?? ''}>
      {info === undefined ? <Skeleton rows={3} /> : info === null ? (
        <p className="pb-4 text-sm text-slate-400">カードDB未同期、または該当なし。⚙️設定からカードDBを同期してください。</p>
      ) : (
        <div className="space-y-2 pb-4 text-sm">
          <p className="text-slate-400">{[info.type, info.race, info.attribute, info.level && `Lv${info.level}`, info.atk != null && `ATK${info.atk}`, info.def != null && `DEF${info.def}`].filter(Boolean).join(' / ')}</p>
          <p className="whitespace-pre-wrap leading-relaxed">{info.desc}</p>
        </div>
      )}
    </BottomSheet>
  )
}
