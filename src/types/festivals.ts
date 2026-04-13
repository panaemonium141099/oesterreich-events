/**
 * TypeScript types for the festival lineup ingestion pipeline.
 *
 * Maps to `festivals` and `festival_artists` tables created in
 * supabase/migrations/20260413_festival_lineup_schema.sql.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.2
 */

// ── Enum-like string unions ──────────────────────────────────────────────────

/** How the lineup is fetched for a given festival. */
export type LineupFetchMode = 'html_scrape' | 'api' | 'manual' | 'none';

/** Current status of the lineup data for a festival. */
export type LineupStatus = 'unknown' | 'fetched' | 'error' | 'no_lineup';

/** Spotify follow priority inferred from genre/size metadata. */
export type SpotifyPriority = 'high' | 'medium' | 'low';

/** Billing tier for an artist on a festival lineup. */
export type ArtistBilling = 'headliner' | 'sub_headliner' | 'support' | 'opener' | 'unknown';

/** How a festival_artists row was sourced. */
export type ArtistSourceType = 'scraper' | 'manual' | 'api';

/** How a festival_artists row was matched to a Spotify artist. */
export type ArtistMatchedBy = 'exact' | 'fuzzy' | 'manual' | 'lineup';

/** Genre codes used in the mica austria registry. */
export type FestivalGenreCode =
  | 'K'   // Klassik
  | 'J'   // Jazz
  | 'P'   // Pop/Rock
  | 'E'   // Elektronik
  | 'H'   // Hip-Hop
  | 'G'   // Global
  | 'N'   // Neue Musik
  | 'I'   // Interdisziplinar
  | 'R'   // (appears in registry data)
  | 'M'   // (appears in registry data)
  | 'W';  // (appears in registry data)

// ── Festival ─────────────────────────────────────────────────────────────────

/** Represents a row in the `festivals` table. */
export interface Festival {
  id: string;
  canonical_name: string;
  slug: string;
  website_url: string | null;
  lineup_url: string | null;
  city: string | null;
  state: string | null;
  starts_at: string | null;     // date as ISO string (YYYY-MM-DD) or null for TBA
  ends_at: string | null;       // date as ISO string (YYYY-MM-DD) or null
  genres: string | null;        // comma-separated genre codes
  registry_source: string | null;
  spotify_priority: SpotifyPriority | null;
  direct_lineup_candidate: boolean;
  lineup_fetch_mode: LineupFetchMode | null;
  lineup_status: LineupStatus;
  lineup_hash: string | null;
  lineup_last_checked_at: string | null;
  parent_event_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Input type for creating/upserting a festival from the seed registry.
 * Omits server-generated fields (id, created_at, updated_at).
 */
export type FestivalInsert = Omit<Festival, 'id' | 'created_at' | 'updated_at'>;

// ── Festival Artist ──────────────────────────────────────────────────────────

/** Represents a row in the `festival_artists` table. */
export interface FestivalArtist {
  id: string;
  festival_id: string;
  artist_name_raw: string;
  artist_name_normalized: string;
  day_label: string | null;
  stage_name: string | null;
  billing: ArtistBilling | string | null;
  source_url: string | null;
  source_type: ArtistSourceType | string | null;
  confidence_score: number | null;
  spotify_artist_id: string | null;
  matched_by: ArtistMatchedBy | string | null;
  /** Backlink to the derived event created from this lineup entry. */
  derived_event_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Input type for creating/upserting a festival artist.
 * Omits server-generated fields (id, created_at, updated_at).
 */
export type FestivalArtistInsert = Omit<FestivalArtist, 'id' | 'created_at' | 'updated_at'>;

// ── Result types ─────────────────────────────────────────────────────────────

/** Result returned by a lineup scraper for a single festival. */
export interface FestivalLineupResult {
  festival_slug: string;
  artists: FestivalArtistInsert[];
  lineup_hash: string;
  source_url: string;
  fetch_mode: LineupFetchMode;
  error?: string;
}

// ── Seed registry entry ──────────────────────────────────────────────────────

/** Shape of a single entry in the mica austria seed registry JSON. */
export interface SeedRegistryEntry {
  start_date: string;           // "M/D/YYYY" or "tba"
  end_date: string;             // "M/D/YYYY" or ""
  name: string;
  genres: string;               // comma-separated genre codes
  city: string;
  state: string;
  website: string;
  prev_dates: string;
  raw: string;
  spotify_priority_inferred: string;
  direct_lineup_candidate_inferred: boolean;
  registry_source: string;
  slug: string;
  spotify_pipeline_recommended_inferred: boolean;
}
