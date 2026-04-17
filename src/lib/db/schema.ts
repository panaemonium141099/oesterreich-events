import Database from 'better-sqlite3';

export function initializeDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id     TEXT NOT NULL,
      source_name   TEXT NOT NULL,
      source_url    TEXT NOT NULL,
      title         TEXT NOT NULL,
      description   TEXT,
      start_date    TEXT NOT NULL,
      end_date      TEXT,
      location_name TEXT,
      address       TEXT,
      postal_code   TEXT,
      bundesland    TEXT,
      district      TEXT,
      latitude      REAL,
      longitude     REAL,
      category      TEXT,
      price_text    TEXT,
      price_min     REAL,
      price_max     REAL,
      image_url     TEXT,
      organizer     TEXT,
      tags          TEXT,
      ticket_url    TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now')),
      UNIQUE(source_name, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
    CREATE INDEX IF NOT EXISTS idx_events_bundesland ON events(bundesland);
    CREATE INDEX IF NOT EXISTS idx_events_district ON events(district);
    CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
    CREATE INDEX IF NOT EXISTS idx_events_coords ON events(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_events_bl_date ON events(bundesland, start_date);
    CREATE INDEX IF NOT EXISTS idx_events_source_id ON events(source_id);

    CREATE TABLE IF NOT EXISTS scrape_runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name     TEXT NOT NULL,
      started_at      TEXT NOT NULL,
      finished_at     TEXT,
      status          TEXT NOT NULL DEFAULT 'running',
      events_found    INTEGER DEFAULT 0,
      events_new      INTEGER DEFAULT 0,
      events_updated  INTEGER DEFAULT 0,
      error_message   TEXT
    );

    CREATE TABLE IF NOT EXISTS geocode_cache (
      query       TEXT PRIMARY KEY,
      latitude    REAL NOT NULL,
      longitude   REAL NOT NULL,
      cached_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS event_tags (
      event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      tag         TEXT NOT NULL,
      PRIMARY KEY (event_id, tag)
    );
    CREATE INDEX IF NOT EXISTS idx_event_tags_tag ON event_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_event_tags_event_id ON event_tags(event_id);

    CREATE TABLE IF NOT EXISTS category_cache (
      input_hash          TEXT PRIMARY KEY,
      classifier_version  TEXT NOT NULL,
      category            TEXT NOT NULL,
      tags                TEXT NOT NULL,       -- JSON array
      confidence          TEXT NOT NULL,
      source              TEXT NOT NULL,
      reason              TEXT,
      candidates          TEXT,                -- JSON array
      cached_at           TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_category_cache_version ON category_cache(classifier_version);
  `);

  // Migration: add ticket_url column to existing databases
  const columns = db.pragma('table_info(events)') as Array<{ name: string }>;
  if (!columns.some(c => c.name === 'ticket_url')) {
    db.exec('ALTER TABLE events ADD COLUMN ticket_url TEXT');
  }

  // Migration: add category classifier columns to existing databases. These
  // mirror the Postgres columns added in 20260417_add_category_classifier.sql
  // so both sides of the dual-write speak the same schema.
  const refreshedColumns = db.pragma('table_info(events)') as Array<{ name: string }>;
  const columnNames = new Set(refreshedColumns.map(c => c.name));
  const classifierColumns: Array<[string, string]> = [
    ['source_category_raw', 'TEXT'],
    ['source_tags_raw', 'TEXT'],           // JSON array on SQLite side
    ['category_confidence', 'TEXT'],
    ['category_source', 'TEXT'],
    ['category_version', 'TEXT'],
    ['category_locked', 'INTEGER DEFAULT 0'],
    ['category_needs_review', 'INTEGER DEFAULT 0'],
    ['category_reason', 'TEXT'],
    ['category_candidates', 'TEXT'],        // JSON array on SQLite side
  ];
  for (const [name, type] of classifierColumns) {
    if (!columnNames.has(name)) {
      db.exec(`ALTER TABLE events ADD COLUMN ${name} ${type}`);
    }
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_category_confidence ON events(category_confidence);
    CREATE INDEX IF NOT EXISTS idx_events_category_needs_review ON events(category_needs_review);
    CREATE INDEX IF NOT EXISTS idx_events_category_version ON events(category_version);
  `);
}
