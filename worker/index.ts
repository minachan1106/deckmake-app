import { Hono } from 'hono'

type Env = { DB: D1Database; ASSETS: Fetcher }
type Item = { name_en: string; name_ja?: string | null; qty: number }

const app = new Hono<{ Bindings: Env }>()
const now = () => new Date().toISOString()
const YGO = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?format=duel%20links'

async function chunked(db: D1Database, stmts: D1PreparedStatement[], size = 50) {
  for (let i = 0; i < stmts.length; i += size) await db.batch(stmts.slice(i, i + size))
}

// ---- cards (YGOPRODeck cache) ----
app.post('/api/cards/sync', async (c) => {
  const last = await c.env.DB.prepare('SELECT MAX(fetched_at) t FROM cards').first<{ t: string | null }>()
  const force = c.req.query('force') === '1'
  // YGOPRODeckへの負荷対策: 24h以内は再取得しない
  if (!force && last?.t && Date.now() - Date.parse(last.t) < 86_400_000) {
    return c.json({ skipped: true, fetched_at: last.t })
  }
  const res = await fetch(YGO, { headers: { 'User-Agent': 'deckmake-app/0.1 (personal)' } }).catch(() => null)
  if (!res || !res.ok) return c.json({ error: `YGOPRODeckに接続できません (${res?.status ?? 'network'})` }, 502)
  const { data } = (await res.json()) as { data: any[] }
  const t = now()
  const ins = c.env.DB.prepare(
    'INSERT OR REPLACE INTO cards (id,name_en,type,desc,race,attribute,level,atk,def,fetched_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
  )
  await chunked(
    c.env.DB,
    data.map((d) => ins.bind(d.id, d.name, d.type, d.desc ?? '', d.race ?? null, d.attribute ?? null, d.level ?? null, d.atk ?? null, d.def ?? null, t)),
  )
  return c.json({ count: data.length, fetched_at: t })
})

app.get('/api/cards/status', async (c) => {
  const r = await c.env.DB.prepare('SELECT COUNT(*) n, MAX(fetched_at) t FROM cards').first<{ n: number; t: string | null }>()
  return c.json(r)
})

// 日本語/英語の両対応サジェスト
app.get('/api/cards/suggest', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  if (!q) return c.json([])
  const like = `%${q.replace(/[%_]/g, '')}%`
  const [en, ja] = await Promise.all([
    c.env.DB.prepare('SELECT id,name_en,type FROM cards WHERE name_en LIKE ? LIMIT 8').bind(like).all(),
    c.env.DB.prepare('SELECT card_id id,name_en,name_ja FROM name_map WHERE name_ja LIKE ? LIMIT 8').bind(like).all(),
  ])
  return c.json([...ja.results, ...en.results])
})

app.get('/api/cards/by-name', async (c) => {
  const name = c.req.query('name') ?? ''
  const r = await c.env.DB.prepare('SELECT * FROM cards WHERE name_en = ? COLLATE NOCASE').bind(name).first()
  return r ? c.json(r) : c.json({ error: 'not found' }, 404)
})

// 取り込みデータのカード名検証: 英語名がcardsに存在するか（大文字小文字無視）
app.post('/api/import/verify', async (c) => {
  const { names } = await c.req.json<{ names: string[] }>()
  const out: Record<string, string | null> = {}
  for (const n of names) {
    const r = await c.env.DB.prepare('SELECT name_en FROM cards WHERE name_en = ? COLLATE NOCASE').bind(n).first<{ name_en: string }>()
    out[n] = r?.name_en ?? null
  }
  return c.json(out)
})

// ---- name_map ----
app.get('/api/namemap', async (c) => c.json((await c.env.DB.prepare('SELECT * FROM name_map').all()).results))
app.post('/api/namemap', async (c) => {
  const rows = await c.req.json<{ name_ja: string; name_en: string }[]>()
  const st = c.env.DB.prepare(
    "INSERT INTO name_map (name_ja,name_en,card_id,source,updated_at) VALUES (?,?,(SELECT id FROM cards WHERE name_en=? COLLATE NOCASE),'confirmed',?) ON CONFLICT(name_ja) DO UPDATE SET name_en=excluded.name_en,card_id=excluded.card_id,updated_at=excluded.updated_at",
  )
  await chunked(c.env.DB, rows.filter((r) => r.name_ja && r.name_en).map((r) => st.bind(r.name_ja, r.name_en, r.name_en, now())))
  return c.json({ ok: true })
})

// ---- collection ----
app.get('/api/collection', async (c) =>
  c.json((await c.env.DB.prepare('SELECT * FROM collection ORDER BY name_en').all()).results),
)
// mode: replace=全置換 / add=差分加算 / set=指定カードのみ上書き
app.post('/api/collection/import', async (c) => {
  const { items, mode } = await c.req.json<{ items: Item[]; mode: 'replace' | 'add' | 'set' }>()
  const db = c.env.DB
  const stmts: D1PreparedStatement[] = []
  if (mode === 'replace') stmts.push(db.prepare('DELETE FROM collection'))
  const sql =
    mode === 'add'
      ? 'INSERT INTO collection (name_en,name_ja,qty,updated_at) VALUES (?,?,?,?) ON CONFLICT(name_en) DO UPDATE SET qty=qty+excluded.qty,name_ja=COALESCE(excluded.name_ja,name_ja),updated_at=excluded.updated_at'
      : 'INSERT INTO collection (name_en,name_ja,qty,updated_at) VALUES (?,?,?,?) ON CONFLICT(name_en) DO UPDATE SET qty=excluded.qty,name_ja=COALESCE(excluded.name_ja,name_ja),updated_at=excluded.updated_at'
  const st = db.prepare(sql)
  for (const i of items) stmts.push(st.bind(i.name_en, i.name_ja ?? null, i.qty, now()))
  await chunked(db, stmts)
  return c.json({ ok: true, count: items.length })
})
app.put('/api/collection/item', async (c) => {
  const b = await c.req.json<{ name_en: string; qty?: number; disposal?: number; name_ja?: string }>()
  const cur = await c.env.DB.prepare('SELECT * FROM collection WHERE name_en=?').bind(b.name_en).first<any>()
  const qty = b.qty ?? cur?.qty ?? 0
  if (qty <= 0) {
    await c.env.DB.prepare('DELETE FROM collection WHERE name_en=?').bind(b.name_en).run()
    return c.json({ deleted: true })
  }
  await c.env.DB.prepare(
    'INSERT INTO collection (name_en,name_ja,qty,disposal,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(name_en) DO UPDATE SET qty=excluded.qty,disposal=excluded.disposal,name_ja=COALESCE(excluded.name_ja,name_ja),updated_at=excluded.updated_at',
  )
    .bind(b.name_en, b.name_ja ?? cur?.name_ja ?? null, qty, b.disposal ?? cur?.disposal ?? 0, now())
    .run()
  return c.json({ ok: true })
})

// ---- decks ----
app.get('/api/decks', async (c) => {
  const rows = (await c.env.DB.prepare('SELECT * FROM decks ORDER BY is_current DESC, updated_at DESC').all()).results as any[]
  return c.json(rows.map((r) => ({ ...r, main: JSON.parse(r.main_json), extra: JSON.parse(r.extra_json), main_json: undefined, extra_json: undefined })))
})
app.post('/api/decks', async (c) => {
  const d = await c.req.json<{ name: string; skill?: string; main: unknown[]; extra: unknown[]; is_current?: boolean }>()
  const db = c.env.DB
  const ex = await db.prepare('SELECT id FROM decks WHERE name=?').bind(d.name).first<{ id: number }>()
  const stmts: D1PreparedStatement[] = []
  if (d.is_current) stmts.push(db.prepare('UPDATE decks SET is_current=0'))
  stmts.push(
    ex
      ? db.prepare('UPDATE decks SET skill=?,main_json=?,extra_json=?,is_current=?,updated_at=? WHERE id=?').bind(d.skill ?? null, JSON.stringify(d.main), JSON.stringify(d.extra), d.is_current ? 1 : 0, now(), ex.id)
      : db.prepare('INSERT INTO decks (name,skill,main_json,extra_json,is_current,updated_at) VALUES (?,?,?,?,?,?)').bind(d.name, d.skill ?? null, JSON.stringify(d.main), JSON.stringify(d.extra), d.is_current ? 1 : 0, now()),
  )
  await db.batch(stmts)
  return c.json({ ok: true })
})
app.delete('/api/decks/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM decks WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ---- resources / meta / glossary / proposals / settings ----
app.get('/api/resources', async (c) => c.json((await c.env.DB.prepare('SELECT * FROM resources').all()).results))
app.put('/api/resources', async (c) => {
  const rows = await c.req.json<{ key: string; qty: number }[]>()
  const st = c.env.DB.prepare('INSERT INTO resources (key,qty,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET qty=excluded.qty,updated_at=excluded.updated_at')
  await chunked(c.env.DB, rows.map((r) => st.bind(r.key, r.qty, now())))
  return c.json({ ok: true })
})

app.get('/api/meta', async (c) => c.json((await c.env.DB.prepare('SELECT * FROM meta_snapshots ORDER BY id DESC LIMIT 1').first()) ?? null))
app.post('/api/meta', async (c) => {
  const { summary } = await c.req.json<{ summary: string }>()
  await c.env.DB.prepare('INSERT INTO meta_snapshots (summary,fetched_at) VALUES (?,?)').bind(summary, now()).run()
  return c.json({ ok: true })
})

app.get('/api/glossary', async (c) => {
  const q = c.req.query('q')
  const r = q
    ? await c.env.DB.prepare('SELECT * FROM glossary WHERE term LIKE ? LIMIT 8').bind(`%${q}%`).all()
    : await c.env.DB.prepare('SELECT * FROM glossary ORDER BY updated_at DESC LIMIT 50').all()
  return c.json((r.results as any[]).map((x) => ({ term: x.term, ...JSON.parse(x.body_json), updated_at: x.updated_at })))
})
app.post('/api/glossary', async (c) => {
  const { term, ...body } = await c.req.json<{ term: string }>()
  await c.env.DB.prepare('INSERT INTO glossary (term,body_json,updated_at) VALUES (?,?,?) ON CONFLICT(term) DO UPDATE SET body_json=excluded.body_json,updated_at=excluded.updated_at').bind(term, JSON.stringify(body), now()).run()
  return c.json({ ok: true })
})

app.get('/api/proposals', async (c) => {
  const rows = (await c.env.DB.prepare('SELECT * FROM proposals ORDER BY id DESC LIMIT 20').all()).results as any[]
  return c.json(rows.map((r) => ({ id: r.id, tier: r.tier, meta_at: r.meta_at, created_at: r.created_at, body: JSON.parse(r.body_json) })))
})
app.post('/api/proposals', async (c) => {
  const { tier, body, meta_at } = await c.req.json<{ tier: string; body: unknown; meta_at?: string }>()
  await c.env.DB.prepare('INSERT INTO proposals (tier,body_json,meta_at,created_at) VALUES (?,?,?,?)').bind(tier, JSON.stringify(body), meta_at ?? null, now()).run()
  return c.json({ ok: true })
})
app.delete('/api/proposals/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM proposals WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

app.get('/api/settings', async (c) => {
  const rows = (await c.env.DB.prepare('SELECT * FROM settings').all()).results as { key: string; value: string }[]
  return c.json(Object.fromEntries(rows.map((r) => [r.key, r.value])))
})
app.put('/api/settings', async (c) => {
  const kv = await c.req.json<Record<string, string>>()
  const st = c.env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
  await chunked(c.env.DB, Object.entries(kv).map(([k, v]) => st.bind(k, String(v))))
  return c.json({ ok: true })
})

app.onError((e, c) => c.json({ error: e.message }, 500))
export default app
