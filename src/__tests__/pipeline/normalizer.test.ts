import { describe, it, expect } from 'vitest';
import { normalizeRawEvent, normalizeEvents } from '@/lib/pipeline/normalizer';
import type { RawEventRow } from '@/lib/pipeline/types';

function makeRawEvent(overrides: Partial<RawEventRow> = {}): RawEventRow {
  return {
    id: 'raw-1',
    scrape_run_id: 'run-1',
    source_name: 'test-source',
    source_event_id: 'evt-1',
    source_url: 'https://example.com/event/1',
    raw_title: 'TECHNO FRIDAY | FLEX VIENNA',
    raw_description: 'A great party with top DJs',
    raw_start_text: '14.06.2026',
    raw_end_text: null,
    raw_location_name: 'Flex Wien',
    raw_address: 'Donaukanal, 1010 Wien',
    raw_image_url: 'https://example.com/img.jpg',
    raw_ticket_url: 'https://tickets.com/buy?utm_source=scraper&id=123',
    raw_payload_json: { category: 'Nightlife', bundesland: 'Wien', organizer: 'Flex' },
    content_hash: 'abc123',
    fetched_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('normalizeRawEvent', () => {
  it('normalizes title to full and compact versions', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate).not.toBeNull();
    expect(result.candidate!.normalized_title).toBe('techno friday flex vienna');
  });

  it('normalizes date with precision', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate!.normalized_start_at).not.toBeNull();
    expect(result.candidate!.start_precision).toBe('day_only');
  });

  it('normalizes URLs by removing tracking params', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate!.normalized_ticket_url).toBe('https://tickets.com/buy?id=123');
  });

  it('extracts postal code from address', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate!.normalized_postal_code).toBe('1010');
  });

  it('extracts city from address', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate!.normalized_city).toBe('Wien');
  });

  it('extracts category from payload', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate!.normalized_category).toBe('Nightlife');
  });

  it('extracts bundesland from payload', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate!.normalized_bundesland).toBe('Wien');
  });

  it('returns error for events with no title', () => {
    const result = normalizeRawEvent(makeRawEvent({ raw_title: null }));
    expect(result.error).toBe('missing_title');
    expect(result.candidate).toBeNull();
  });

  it('returns error for events with empty title', () => {
    const result = normalizeRawEvent(makeRawEvent({ raw_title: '   ' }));
    expect(result.error).toBe('missing_title');
    expect(result.candidate).toBeNull();
  });

  it('sets normalization_version to 1', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate!.normalization_version).toBe(1);
  });

  it('handles missing optional fields gracefully', () => {
    const result = normalizeRawEvent(makeRawEvent({
      raw_address: null,
      raw_image_url: null,
      raw_ticket_url: null,
      raw_payload_json: null,
    }));
    expect(result.candidate).not.toBeNull();
    expect(result.candidate!.normalized_postal_code).toBeNull();
    expect(result.candidate!.normalized_image_url).toBeNull();
    expect(result.candidate!.normalized_ticket_url).toBeNull();
  });
});

describe('normalizeEvents', () => {
  it('returns candidates and errors separately', async () => {
    const events = [
      makeRawEvent({ id: 'raw-1' }),
      makeRawEvent({ id: 'raw-2', raw_title: null }),
      makeRawEvent({ id: 'raw-3' }),
    ];
    const result = await normalizeEvents(events);
    expect(result.candidates).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rawEventId).toBe('raw-2');
  });
});
