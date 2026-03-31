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
  `);
}
