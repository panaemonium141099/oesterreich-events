import { describe, it, expect } from 'vitest';
import { calculateScore, type ScoringEventRow, type ScoringVenueRow } from '../lib/utils/scoring';

/** Helper to create a minimal event row for testing */
function makeEvent(overrides: Partial<ScoringEventRow> = {}): ScoringEventRow {
  return {
    id: 'test-1',
    title: 'Test Event',
    description: null,
    image_url: null,
    ticket_url: null,
    price_min: null,
    price_text: null,
    tags: null,
    organizer: null,
    source_url: null,
    view_count: 0,
    save_count: 0,
    share_count: 0,
    start_date: new Date(Date.now() + 3 * 86400000).toISOString(), // 3 days from now
    venue_id: null,
    event_series_id: null,
    ...overrides,
  };
}

function makeVenue(overrides: Partial<ScoringVenueRow> = {}): ScoringVenueRow {
  return {
    id: 'venue-1',
    type: 'bar',
    is_student_relevant: false,
    localness_score: 50,
    registry_source: null,
    ...overrides,
  };
}

/** Far future date (no time bonus) */
const FAR_FUTURE = new Date(Date.now() + 60 * 86400000).toISOString();

describe('calculateScore', () => {
  it('returns 0 for a minimal event with no data', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    expect(calculateScore(event)).toBe(0);
  });

  it('awards +15 for image_url', () => {
    const event = makeEvent({ image_url: 'https://example.com/img.jpg', start_date: FAR_FUTURE });
    expect(calculateScore(event)).toBe(15);
  });

  it('awards +10 for description > 50 chars', () => {
    const event = makeEvent({ description: 'A'.repeat(51), start_date: FAR_FUTURE });
    expect(calculateScore(event)).toBe(10);
  });

  it('awards +15 for description > 200 chars (10 + 5)', () => {
    const event = makeEvent({ description: 'A'.repeat(201), start_date: FAR_FUTURE });
    expect(calculateScore(event)).toBe(15);
  });

  it('awards +15 for ticket_url', () => {
    const event = makeEvent({ ticket_url: 'https://tickets.com', start_date: FAR_FUTURE });
    expect(calculateScore(event)).toBe(15);
  });

  it('awards +10 time bonus for events within 7 days', () => {
    const event = makeEvent({ start_date: new Date(Date.now() + 2 * 86400000).toISOString() });
    expect(calculateScore(event)).toBe(10);
  });

  it('awards +5 time bonus for events 8-30 days away', () => {
    const event = makeEvent({ start_date: new Date(Date.now() + 15 * 86400000).toISOString() });
    expect(calculateScore(event)).toBe(5);
  });

  // --- Venue/series bonus tests ---

  it('awards +10 for student-relevant venue', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    const venue = makeVenue({ is_student_relevant: true, type: 'university' });
    expect(calculateScore(event, venue)).toBe(10);
  });

  it('awards +5 for local venue type (bar)', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    const venue = makeVenue({ type: 'bar' });
    expect(calculateScore(event, venue)).toBe(5);
  });

  it('awards +5 for local venue type (pub)', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    const venue = makeVenue({ type: 'pub' });
    expect(calculateScore(event, venue)).toBe(5);
  });

  it('awards +5 for local venue type (nightclub)', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    const venue = makeVenue({ type: 'nightclub' });
    expect(calculateScore(event, venue)).toBe(5);
  });

  it('awards +5 for local venue type (biergarten)', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    const venue = makeVenue({ type: 'biergarten' });
    expect(calculateScore(event, venue)).toBe(5);
  });

  it('does not award localness bonus for non-local venue type', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    const venue = makeVenue({ type: 'university' });
    expect(calculateScore(event, venue)).toBe(0);
  });

  it('awards +15 for student-relevant bar (both bonuses)', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    const venue = makeVenue({ type: 'bar', is_student_relevant: true });
    expect(calculateScore(event, venue)).toBe(15); // 10 + 5
  });

  it('awards +5 for recurring series event', () => {
    const event = makeEvent({ event_series_id: 'series-1', start_date: FAR_FUTURE });
    expect(calculateScore(event)).toBe(5);
  });

  it('awards +10 for student org source (oeh)', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    const venue = makeVenue({ type: 'student_org', registry_source: 'oeh' });
    expect(calculateScore(event, venue)).toBe(10);
  });

  it('awards +10 for student org source (esn)', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    const venue = makeVenue({ type: 'student_org', registry_source: 'esn' });
    expect(calculateScore(event, venue)).toBe(10);
  });

  it('awards +10 for student org source (iaeste)', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    const venue = makeVenue({ type: 'student_org', registry_source: 'iaeste' });
    expect(calculateScore(event, venue)).toBe(10);
  });

  it('does not award student org bonus for osm source', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    const venue = makeVenue({ type: 'bar', registry_source: 'osm' });
    expect(calculateScore(event, venue)).toBe(5); // only localness
  });

  it('stacks all venue/series bonuses correctly', () => {
    const event = makeEvent({ event_series_id: 'series-1', start_date: FAR_FUTURE });
    const venue = makeVenue({ type: 'bar', is_student_relevant: true, registry_source: 'esn' });
    // student_relevant: +10, local venue: +5, series: +5, student org: +10 = 30
    expect(calculateScore(event, venue)).toBe(30);
  });

  it('does not award venue bonuses when no venue provided', () => {
    const event = makeEvent({ start_date: FAR_FUTURE });
    expect(calculateScore(event, null)).toBe(0);
    expect(calculateScore(event, undefined)).toBe(0);
    expect(calculateScore(event)).toBe(0);
  });

  it('clamps score to 100 max', () => {
    const event = makeEvent({
      image_url: 'https://example.com/img.jpg',     // +15
      description: 'A'.repeat(201),                  // +15
      ticket_url: 'https://tickets.com',             // +15
      price_min: 25,                                 // +10
      tags: ['music'],                               // +5
      organizer: 'Some Org',                         // +5
      source_url: 'https://source.com',              // +5
      view_count: 100,                               // +20 (capped)
      start_date: new Date(Date.now() + 2 * 86400000).toISOString(), // +10
      event_series_id: 'series-1',                   // +5
    });
    const venue = makeVenue({ type: 'bar', is_student_relevant: true, registry_source: 'oeh' });
    // Base: 15+15+15+10+5+5+5+20+10 = 100, plus venue: +10+5+5+10 = 30 => 130, clamped to 100
    expect(calculateScore(event, venue)).toBe(100);
  });
});
