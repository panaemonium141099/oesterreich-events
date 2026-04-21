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

export type CategorySource = 'manual' | 'rules' | 'ai';

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
}

export type Category =
  | 'Musik'
  | 'Nightlife'
  | 'Wein & Kulinarik'
  | 'Kultur'
  | 'Märkte'
  | 'Sport'
  | 'Familie'
  | 'Natur'
  | 'Feste & Brauchtum'
  | 'Bildung'
  | 'Gesundheit'
  | 'Religion'
  | 'Wirtschaft'
  | 'Sonstiges';

export type District =
  | 'Neusiedl am See'
  | 'Eisenstadt'
  | 'Mattersburg'
  | 'Oberpullendorf'
  | 'Oberwart'
  | 'Güssing'
  | 'Jennersdorf';
