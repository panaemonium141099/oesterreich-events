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
  event_score?: number;
  score_updated_at?: string;
  venue_id?: string | null;
  event_series_id?: string | null;
  content_fingerprint?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScrapedEvent {
  source_id: string;
  source_name: string;
  source_url: string;
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
  /** Sort order: 'date' (default) or 'score' */
  sort?: 'date' | 'score';
  /** Bounding box filter: [south_lat, west_lng, north_lat, east_lng] */
  bbox?: [number, number, number, number];
  /** Filter by scraper source_name (god-role only) */
  sourceName?: string;
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
