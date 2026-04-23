export interface Event {
  id: string;
  source_type?: string;
  source_id: string | null;
  source_name: string | null;
  source_url: string | null;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  is_all_day?: boolean;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  price_text: string | null;
  price_min: number | null;
  price_max: number | null;
  image_url: string | null;
  organizer: string | null;
  tags: string[] | null;
  ticket_url?: string | null;
  visibility?: string;
  geocoding_confidence?: string | null;
  geocoding_source?: string | null;
  publish_status?: 'draft' | 'published' | 'published_low_confidence' | 'suppressed' | 'needs_review' | 'expired' | 'duplicate';
  quality_score?: number | null;
  raw_event_id?: string | null;
  duplicate_of?: string | null;
  dedup_score?: number | null;
  dedup_cluster_id?: string | null;
  event_score?: number;
  score_updated_at?: string;
  slug?: string | null;
  venue_id?: string | null;
  venue_match_confidence?: number | null;
  venue_match_stage?: number | null;
  event_series_id?: string | null;
  content_fingerprint?: string | null;
  /** FK to parent event (e.g. festival umbrella event for derived artist events). */
  parent_event_id?: string | null;
  // Category classifier provenance. The canonical `category` and `tags` above
  // are produced by the central classifier; these fields record how.
  source_category_raw?: string | null;
  source_tags_raw?: string[] | null;
  category_confidence?: CategoryConfidence | null;
  category_source?: CategorySource | null;
  category_version?: string | null;
  category_locked?: boolean;
  category_needs_review?: boolean;
  category_reason?: string | null;
  category_candidates?: CategoryCandidate[] | null;
  // Enrichment layer — populated by src/scripts/enrich-openai.ts. All
  // are nullable because older rows (or rows from scrapers that
  // haven't been enriched yet) won't have them.
  //
  // See docs/TAXONOMY.md §3 for the full closed vocabulary of each axis.
  audience?: string[] | null;
  vibe?: string[] | null;
  setting?: string[] | null;
  language?: string | null;
  price_tier?: 'gratis' | 'günstig' | 'mittel' | 'premium' | 'unbekannt' | null;
  duration_type?: 'kurz' | 'abend' | 'ganztag' | 'mehrtägig' | 'dauerausstellung' | 'nacht-bis-morgen' | '24-stunden' | '48-stunden' | null;
  is_student_friendly?: boolean | null;
  is_family_friendly?: boolean | null;
  /**
   * Taxonomy v3 additions — "Anlass-Tags" like ausgehen, date-night,
   * afterwork, saufen-gehen, wochenendplan. 0-3 per event.
   */
  occasion_tags?: string[] | null;
  /**
   * Taxonomy v3 additions — binary price/barrier flags: happy-hour,
   * studentenrabatt, barrierefrei, kinderwagengeeignet, freier-eintritt.
   * Complements price_tier (which is a coarse bucket).
   */
  price_flags?: string[] | null;
  suggested_description?: string | null;
  suggested_price_text?: string | null;
  enrichment_version?: string | null;
  enrichment_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type CategoryConfidence =
  | 'manual'
  | 'rules_exact'
  | 'rules_high'
  | 'rules_medium'
  | 'rules_low'
  | 'ai'
  | 'ai_low';

export type CategorySource = 'manual' | 'rules' | 'ai' | 'enrichment';

export interface CategoryCandidate {
  category: string;
  score: number;
  evidence?: string[];
}

export interface ScrapedEvent {
  source_id: string;
  source_name: string;
  /**
   * Public-facing source URL. Nullable because some scrapers (notably
   * Feratel-Deskline via webapi.deskline.net) only have backend API
   * endpoints which aren't usable by humans or our enrichment fetcher.
   * The DB column allows NULL to match.
   */
  source_url: string | null;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location_name?: string;
  address?: string;
  postal_code?: string;
  bundesland?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  price_text?: string;
  price_min?: number;
  price_max?: number;
  image_url?: string;
  organizer?: string;
  tags?: string[];
  ticket_url?: string;
  /** Venue ID from the registry (set by RegistryBasedScraper) */
  venue_id?: string;
  /** FK to parent event for derived events (e.g. "Artist at Festival"). */
  parent_event_id?: string;
  /** Source type override (e.g. 'derived' for lineup-generated events). */
  source_type?: string;
}

export interface EventFilters {
  bundesland?: string;
  district?: string;
  category?: string;
  /** Multi-tag filter: events matching ANY of the provided tags */
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  priceMin?: number;
  priceMax?: number;
  search?: string;
  eveningOnly?: boolean;
  limit?: number;
  offset?: number;
  /** Cursor-based pagination: ID of last event from previous page */
  cursor?: string;
  /** Sort order: 'date' (default), 'score', or 'relevance' */
  sort?: 'date' | 'score' | 'relevance';
  /** Bounding box filter: [south_lat, west_lng, north_lat, east_lng] */
  bbox?: [number, number, number, number];
  /** Filter by scraper source_name (god-role only) */
  sourceName?: string;
  /** Filter events by venue ID */
  venueId?: string;
  /** Only show events at student-relevant venues */
  studentOnly?: boolean;
  /** Minimum localness score of the venue (0-100) */
  localnessMin?: number;
  // ── Enrichment filters (populated by Claude-based event enrichment) ──
  /** Only events where Claude flagged is_student_friendly=true. */
  studentFriendly?: boolean;
  /** Only events where Claude flagged is_family_friendly=true. */
  familyFriendly?: boolean;
  /** Price tier filter: gratis | günstig | mittel | premium | unbekannt */
  priceTier?: 'gratis' | 'günstig' | 'mittel' | 'premium' | 'unbekannt';
  /** Audience filter: studenten | familien-mit-kindern | senioren | paare | ... */
  audience?: string[];
  /** Vibe filter: rave | gemütlich | kulturell | romantisch | ... */
  vibe?: string[];
  /** Setting filter: indoor | outdoor | am-see | in-den-bergen | warehouse | ... */
  setting?: string[];
  /** Language: deutsch | dialekt | englisch | mehrsprachig | ohne-sprache */
  language?: 'deutsch' | 'dialekt' | 'englisch' | 'mehrsprachig' | 'ohne-sprache';
  /** Occasion filter: ausgehen | afterwork | date-night | saufen-gehen | ... */
  occasion?: string[];
  /** Price flag filter: happy-hour | studentenrabatt | barrierefrei | ... */
  priceFlags?: string[];
}

/**
 * Event Hauptkategorien.
 * Single source of truth: docs/TAXONOMY.md §2.
 * Code mirror: src/lib/category-classifier/taxonomy.ts CATEGORIES[].
 *
 * Union of v3 (current, 11 + Sonstiges) and v1/v2 legacy names kept as
 * deprecated aliases so the rule-based classifier (`src/lib/category-
 * classifier/rules.ts`) still compiles. Legacy values get migrated to v3
 * at the DB boundary via migrateOldCategory() in taxonomy.ts, and by the
 * SQL migration 20260423_taxonomy_v3.sql at runtime.
 */
export type Category =
  // v3 Hauptkategorien (target state)
  | 'Musik'
  | 'Kultur & Bühne'
  | 'Nightlife & Party'
  | 'Essen & Trinken'
  | 'Märkte & Feste'
  | 'Sport & Bewegung'
  | 'Natur & Abenteuer'
  | 'Wissen & Karriere'
  | 'Familie & Kinder'
  | 'Community & Freizeit'
  | 'Wellness & Spiritualität'
  | 'Sonstiges'
  // v1/v2 legacy names — kept as aliases so rules.ts compiles and old
  // DB rows don't produce type errors. @deprecated, will be removed
  // after the enrichment rerun and SQL migration are both done.
  /** @deprecated Use 'Kultur & Bühne' */
  | 'Kultur'
  /** @deprecated Use 'Sport & Bewegung' */
  | 'Sport'
  /** @deprecated Use 'Märkte & Feste' (merged with Feste & Brauchtum) */
  | 'Märkte'
  /** @deprecated Use 'Märkte & Feste' (merged with Märkte) */
  | 'Feste & Brauchtum'
  /** @deprecated Use 'Essen & Trinken' */
  | 'Wein & Kulinarik'
  /** @deprecated Use 'Familie & Kinder' */
  | 'Familie'
  /** @deprecated Use 'Natur & Abenteuer' */
  | 'Natur'
  /** @deprecated Use 'Nightlife & Party' */
  | 'Nightlife'
  /** @deprecated Use 'Wissen & Karriere' (merged with Wirtschaft) */
  | 'Bildung'
  /** @deprecated Use 'Wissen & Karriere' (merged with Bildung) */
  | 'Wirtschaft'
  /** @deprecated Use 'Wellness & Spiritualität' (merged with Religion) */
  | 'Gesundheit'
  /** @deprecated Use 'Wellness & Spiritualität' (merged with Gesundheit) */
  | 'Religion';

export type District =
  | 'Neusiedl am See'
  | 'Eisenstadt'
  | 'Mattersburg'
  | 'Oberpullendorf'
  | 'Oberwart'
  | 'Güssing'
  | 'Jennersdorf';
