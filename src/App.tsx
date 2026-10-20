import { useState } from 'react'
import DecksPage from './pages/DecksPage'
import CollectionPage from './pages/CollectionPage'
import ProposePage from './pages/ProposePage'
import SearchPage from './pages/SearchPage'
import SettingsSheet from './pages/SettingsSheet'

const TABS = [
  { id: 'deck', label: 'デッキ', icon: '🃏' },
  { id: 'own', label: '所持', icon: '📦' },
  { id: 'prop', label: '提案', icon: '💡' },
  { id: 'search', label: '検索', icon: '🔍' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<Tab>('deck')
  const [settings, setSettings] = useState(false)
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      <header className="safe-t flex items-center justify-between px-4 pb-2 pt-3">
        <h1 className="text-lg font-bold">{TABS.find((t) => t.id === tab)!.label}</h1>
        <button aria-label="設定" className="h-11 w-11 rounded-full bg-[#1a2140] text-xl" onClick={() => setSettings(true)}>⚙️</button>
      </header>
      <main className="min-h-0 flex-1">
        {tab === 'deck' && <DecksPage />}
        {tab === 'own' && <CollectionPage />}
        {tab === 'prop' && <ProposePage />}
        {tab === 'search' && <SearchPage />}
      </main>
      <nav className="safe-b grid grid-cols-4 border-t border-slate-800 bg-[#0f1630] pt-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex h-14 flex-col items-center justify-center text-xs ${tab === t.id ? 'text-violet-300' : 'text-slate-400'}`}>
            <span className="text-xl">{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  )
}
