import { describe, it, expect } from 'vitest';
import type {
  Venue,
  EventSeries,
  VenueInsert,
  EventSeriesInsert,
  VenueType,
  EventFeedType,
  RegistrySource,
  ScrapeStatus,
} from '@/types/venues';

describe('Venue types', () => {
  const validVenueTypes: VenueType[] = [
    'bar',
    'pub',
    'nightclub',
    'club',
    'vereinslokal',
    'university',
    'student_org',
    'cultural_center',
    'concert_hall',
    'theater',
    'museum',
    'other',
  ];

  const validFeedTypes: EventFeedType[] = ['ics', 'rss', 'json-ld', 'html', 'api'];

  const validRegistrySources: RegistrySource[] = [
    'osm',
    'open_data',
    'oeh',
    'esn',
    'iaeste',
    'aiesec',
    'aegee',
    'manual',
  ];

  const validScrapeStatuses: ScrapeStatus[] = ['active', 'inactive', 'error', 'pending'];

  it('should define all expected venue types', () => {
    expect(validVenueTypes).toHaveLength(12);
    expect(validVenueTypes).toContain('bar');
    expect(validVenueTypes).toContain('student_org');
    expect(validVenueTypes).toContain('university');
  });

  it('should define all expected feed types', () => {
    expect(validFeedTypes).toHaveLength(5);
    expect(validFeedTypes).toContain('ics');
    expect(validFeedTypes).toContain('json-ld');
  });

  it('should define all expected registry sources', () => {
    expect(validRegistrySources).toHaveLength(8);
    expect(validRegistrySources).toContain('osm');
    expect(validRegistrySources).toContain('oeh');
    expect(validRegistrySources).toContain('esn');
  });

  it('should define all expected scrape statuses', () => {
    expect(validScrapeStatuses).toHaveLength(4);
    expect(validScrapeStatuses).toContain('active');
    expect(validScrapeStatuses).toContain('pending');
  });

  it('should allow creating a valid Venue object', () => {
    const venue: Venue = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Flex Wien',
      name_normalized: 'flex wien',
      type: 'nightclub',
      subtype: null,
      address: 'Augartenbrücke 1',
      postal_code: '1010',
      city: 'Wien',
      bundesland: 'Wien',
      latitude: 48.2128,
      longitude: 16.3764,
      website: 'https://flex.at',
      facebook_url: null,
      instagram_url: null,
      event_feed_url: 'https://flex.at/events',
      event_feed_type: 'html',
      osm_id: 123456789,
      osm_tags: { amenity: 'nightclub', name: 'Flex' },
      registry_source: 'osm',
      is_student_relevant: true,
      localness_score: 80,
      last_scraped_at: null,
      scrape_status: 'pending',
      created_at: '2026-04-05T00:00:00Z',
      updated_at: '2026-04-05T00:00:00Z',
    };

    expect(venue.name).toBe('Flex Wien');
    expect(venue.type).toBe('nightclub');
    expect(venue.is_student_relevant).toBe(true);
    expect(venue.localness_score).toBe(80);
  });

  it('should allow creating a venue with minimal fields (null optionals)', () => {
    const venue: Venue = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Unknown Bar',
      name_normalized: 'unknown bar',
      type: 'bar',
      subtype: null,
      address: null,
      postal_code: null,
      city: null,
      bundesland: null,
      latitude: null,
      longitude: null,
      website: null,
      facebook_url: null,
      instagram_url: null,
      event_feed_url: null,
      event_feed_type: null,
      osm_id: null,
      osm_tags: null,
      registry_source: 'manual',
      is_student_relevant: false,
      localness_score: 50,
      last_scraped_at: null,
      scrape_status: 'pending',
      created_at: '2026-04-05T00:00:00Z',
      updated_at: '2026-04-05T00:00:00Z',
    };

    expect(venue.city).toBeNull();
    expect(venue.osm_id).toBeNull();
    expect(venue.event_feed_type).toBeNull();
  });

  it('should allow creating a valid EventSeries object', () => {
    const series: EventSeries = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      venue_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Pub Quiz Dienstag',
      title_normalized: 'pub quiz dienstag',
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU',
      category: 'Bildung',
      day_of_week: 2,
      start_time: '19:30:00',
      created_at: '2026-04-05T00:00:00Z',
    };

    expect(series.title).toBe('Pub Quiz Dienstag');
    expect(series.day_of_week).toBe(2);
    expect(series.recurrence_rule).toContain('FREQ=WEEKLY');
  });

  it('should allow creating a VenueInsert without server-generated fields', () => {
    const insert: VenueInsert = {
      name: 'Bierlokal',
      name_normalized: 'bierlokal',
      type: 'pub',
      subtype: null,
      address: 'Hauptstrasse 1',
      postal_code: '7000',
      city: 'Eisenstadt',
      bundesland: 'Burgenland',
      latitude: 47.845,
      longitude: 16.519,
      website: null,
      facebook_url: null,
      instagram_url: null,
      event_feed_url: null,
      event_feed_type: null,
      osm_id: 987654321,
      osm_tags: { amenity: 'pub' },
      registry_source: 'osm',
      is_student_relevant: false,
      localness_score: 70,
      last_scraped_at: null,
      scrape_status: 'pending',
    };

    expect(insert.name).toBe('Bierlokal');
    // VenueInsert should not have id, created_at, updated_at
    expect('id' in insert).toBe(false);
    expect('created_at' in insert).toBe(false);
    expect('updated_at' in insert).toBe(false);
  });

  it('should allow creating an EventSeriesInsert without server-generated fields', () => {
    const insert: EventSeriesInsert = {
      venue_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Karaoke Night',
      title_normalized: 'karaoke night',
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=FR',
      category: 'Nightlife',
      day_of_week: 5,
      start_time: '21:00:00',
    };

    expect(insert.title).toBe('Karaoke Night');
    expect('id' in insert).toBe(false);
    expect('created_at' in insert).toBe(false);
  });
});

describe('Event type extensions', () => {
  it('should allow venue_id, event_series_id, and content_fingerprint on Event', () => {
    // Type-level test: verify the new fields compile on Event interface
    const event: import('@/types/events').Event = {
      id: 'test-id',
      source_id: 'src-1',
      source_name: 'test',
      source_url: 'https://example.com',
      title: 'Test Event',
      description: null,
      start_date: '2026-04-10T18:00:00Z',
      end_date: null,
      location_name: null,
      address: null,
      postal_code: null,
      bundesland: null,
      district: null,
      latitude: null,
      longitude: null,
      category: null,
      price_text: null,
      price_min: null,
      price_max: null,
      image_url: null,
      organizer: null,
      tags: null,
      venue_id: '550e8400-e29b-41d4-a716-446655440000',
      event_series_id: '550e8400-e29b-41d4-a716-446655440002',
      content_fingerprint: 'abc123hash',
      created_at: '2026-04-05T00:00:00Z',
      updated_at: '2026-04-05T00:00:00Z',
    };

    expect(event.venue_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(event.event_series_id).toBe('550e8400-e29b-41d4-a716-446655440002');
    expect(event.content_fingerprint).toBe('abc123hash');
  });
});
