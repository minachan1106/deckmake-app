CREATE TABLE cards (
  id INTEGER PRIMARY KEY,
  name_en TEXT NOT NULL,
  type TEXT NOT NULL,
  desc TEXT NOT NULL DEFAULT '',
  race TEXT, attribute TEXT, level INTEGER, atk INTEGER, def INTEGER,
  fetched_at TEXT NOT NULL
);
CREATE INDEX idx_cards_name ON cards(name_en COLLATE NOCASE);

CREATE TABLE name_map (
  name_ja TEXT PRIMARY KEY,
  card_id INTEGER,
  name_en TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'confirmed',
  updated_at TEXT NOT NULL
);

CREATE TABLE collection (
  name_en TEXT PRIMARY KEY,
  name_ja TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  disposal INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE decks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  skill TEXT,
  main_json TEXT NOT NULL,
  extra_json TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE resources (
  key TEXT PRIMARY KEY,
  qty INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE meta_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE glossary (
  term TEXT PRIMARY KEY,
  body_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier TEXT NOT NULL,
  body_json TEXT NOT NULL,
  meta_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
