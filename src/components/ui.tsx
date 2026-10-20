import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { Suggest } from '../lib/types'

// ---- Toast ----
const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([])
  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { id, msg }])
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 2200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className="toast rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-lg">{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---- Skeleton ----
export const Skeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2 p-4">{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-14" />)}</div>
)

// ---- BottomSheet (下スワイプで閉じる) ----
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const [dy, setDy] = useState(0)
  const start = useRef<number | null>(null)
  useEffect(() => { if (!open) setDy(0) }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="sheet flex max-h-[88%] w-full flex-col rounded-t-3xl bg-[#141b34]"
        style={{ transform: `translateY(${dy}px)`, transition: start.current === null ? 'transform .2s' : 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="touch-none px-4 pb-2 pt-3"
          onPointerDown={(e) => { start.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={(e) => { if (start.current !== null) setDy(Math.max(0, e.clientY - start.current)) }}
          onPointerUp={() => { const d = dy; start.current = null; d > 90 ? onClose() : setDy(0) }}
        >
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-600" />
          {title && <h2 className="text-center text-base font-bold">{title}</h2>}
        </div>
        <div className="safe-b overflow-y-auto px-4 pt-1">{children}</div>
      </div>
    </div>
  )
}

// ---- SwipeRow: 左スワイプで右側アクションを出す ----
export type SwipeAction = { label: string; color: string; run: () => void }
export function SwipeRow({ children, actions }: { children: ReactNode; actions: SwipeAction[] }) {
  const W = 76 * actions.length
  const [x, setX] = useState(0)
  const st = useRef<{ x: number; base: number; moved: boolean } | null>(null)
  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 flex">
        {actions.map((a) => (
          <button key={a.label} className={`w-[76px] text-sm font-bold text-white ${a.color}`} onClick={() => { a.run(); setX(0) }}>{a.label}</button>
        ))}
      </div>
      <div
        className="relative bg-[#1a2140]"
        style={{ transform: `translateX(${x}px)`, transition: st.current ? 'none' : 'transform .18s', touchAction: 'pan-y' }}
        onPointerDown={(e) => { st.current = { x: e.clientX, base: x, moved: false } }}
        onPointerMove={(e) => {
          const s = st.current; if (!s) return
          const d = e.clientX - s.x
          if (Math.abs(d) > 6) s.moved = true
          if (s.moved) setX(Math.min(0, Math.max(-W, s.base + d)))
        }}
        onPointerUp={() => { const s = st.current; st.current = null; if (s?.moved) setX((v) => (v < -W / 2 ? -W : 0)); else if (x !== 0) setX(0) }}
        onPointerCancel={() => { st.current = null; setX(0) }}
      >{children}</div>
    </div>
  )
}

// ---- PullToRefresh ----
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: ReactNode }) {
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const y0 = useRef<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className="h-full overflow-y-auto"
      onTouchStart={(e) => { if (ref.current && ref.current.scrollTop <= 0) y0.current = e.touches[0].clientY }}
      onTouchMove={(e) => { if (y0.current !== null && !busy) setPull(Math.min(90, Math.max(0, (e.touches[0].clientY - y0.current) * 0.5))) }}
      onTouchEnd={async () => {
        y0.current = null
        if (pull > 60 && !busy) { setBusy(true); setPull(48); try { await onRefresh() } finally { setBusy(false) } }
        setPull(0)
      }}
    >
      <div className="flex items-center justify-center text-xs text-slate-400 transition-[height]" style={{ height: pull }}>
        {busy ? '更新中…' : pull > 60 ? '離して更新' : pull > 8 ? '引っ張って更新' : ''}
      </div>
      {children}
    </div>
  )
}

// ---- Autocomplete (JA/EN横断) ----
export function Autocomplete({ placeholder, onPick, clearOnPick = true }: { placeholder: string; onPick: (s: Suggest) => void; clearOnPick?: boolean }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Suggest[]>([])
  useEffect(() => {
    if (!q.trim()) { setList([]); return }
    const t = setTimeout(() => api.get<Suggest[]>('/cards/suggest?q=' + encodeURIComponent(q)).then(setList).catch(() => setList([])), 180)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="relative">
      <input
        value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} enterKeyHint="search"
        className="h-12 w-full rounded-xl bg-[#1a2140] px-4 text-base outline-none ring-1 ring-slate-700 focus:ring-violet-400"
      />
      {list.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl bg-[#232c55] shadow-xl">
          {list.map((s, i) => (
            <li key={i}>
              <button className="flex min-h-11 w-full flex-col items-start px-4 py-2 text-left active:bg-violet-500/30"
                onClick={() => { onPick(s); if (clearOnPick) setQ(''); setList([]) }}>
                <span className="text-sm font-medium">{s.name_ja ?? s.name_en}</span>
                {s.name_ja && <span className="text-xs text-slate-400">{s.name_en}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const Btn = ({ children, onClick, kind = 'primary', disabled, className = '' }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; className?: string }) => (
  <button disabled={disabled} onClick={onClick}
    className={`h-12 rounded-xl px-4 text-base font-bold active:scale-[.98] disabled:opacity-40 ${kind === 'primary' ? 'bg-violet-500 text-white' : kind === 'danger' ? 'bg-rose-600 text-white' : 'bg-[#232c55] text-slate-200'} ${className}`}>
    {children}
  </button>
)
