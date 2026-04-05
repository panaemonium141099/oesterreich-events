/**
 * Venue types for the venue-centric registry architecture.
 *
 * Venues are physical locations (bars, clubs, universities) or organizations
 * (student orgs) that host events. They are imported from registries like
 * OpenStreetMap, OeH, ESN, and other open data sources.
 */

export type VenueType =
  | 'bar'
  | 'pub'
  | 'nightclub'
  | 'club'
  | 'vereinslokal'
  | 'university'
  | 'student_org'
  | 'cultural_center'
  | 'concert_hall'
  | 'theater'
  | 'museum'
  | 'other';

export type EventFeedType = 'ics' | 'rss' | 'json-ld' | 'html' | 'api';

export type RegistrySource =
  | 'osm'
  | 'open_data'
  | 'oeh'
  | 'esn'
  | 'iaeste'
  | 'aiesec'
  | 'aegee'
  | 'manual';

export type ScrapeStatus = 'active' | 'inactive' | 'error' | 'pending';

export interface Venue {
  id: string;
  name: string;
  name_normalized: string;
  type: VenueType;
  subtype: string | null;

  // Location
  address: string | null;
  postal_code: string | null;
  city: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;

  // Digital footprint
  website: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  event_feed_url: string | null;
  event_feed_type: EventFeedType | null;

  // Registry provenance
  osm_id: number | null;
  osm_tags: Record<string, string> | null;
  registry_source: RegistrySource;

  // Metadata
  is_student_relevant: boolean;
  localness_score: number;
  last_scraped_at: string | null;
  scrape_status: ScrapeStatus;
  created_at: string;
  updated_at: string;
}

export interface EventSeries {
  id: string;
  venue_id: string | null;
  title: string;
  title_normalized: string;
  recurrence_rule: string | null;
  category: string | null;
  /** 0=Sunday, 1=Monday, ..., 6=Saturday */
  day_of_week: number | null;
  start_time: string | null;
  created_at: string;
}

/**
 * Input type for creating/upserting a venue from a registry import.
 * Omits server-generated fields (id, created_at, updated_at).
 */
export type VenueInsert = Omit<Venue, 'id' | 'created_at' | 'updated_at'>;

/**
 * Input type for creating an event series entry.
 * Omits server-generated fields (id, created_at).
 */
export type EventSeriesInsert = Omit<EventSeries, 'id' | 'created_at'>;
