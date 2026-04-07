// src/__tests__/pipeline/dedup-scorer.test.ts

import { describe, it, expect } from 'vitest';
import { scorePair, canonicalizeIds } from '@/lib/pipeline/dedup-scorer';
import { isGarbageTitle } from '@/lib/pipeline/garbage-filter';
import {
  selectPrimary,
  computeEnrichments,
  buildClusters,
  type ScoredPair,
} from '@/lib/pipeline/dedup-cluster';
import type { EventRow, DedupScoreBreakdown } from '@/lib/pipeline/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal EventRow with sensible defaults. */
function makeEvent(overrides: Partial<EventRow> & { id: string; title: string; start_date: string }): EventRow {
  return {
    ...overrides,
  } as EventRow;
}

// ---------------------------------------------------------------------------
// dedup-scorer.ts — scorePair()
// ---------------------------------------------------------------------------

describe('dedup-scorer / scorePair', () => {
  it('two identical events produce a merge decision', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Wiener Festwochen 2026',
      start_date: '2026-06-15T19:00:00',
      venue_id: 'v1',
      location_name: 'Rathausplatz',
      city: 'Wien',
      latitude: 48.2106,
      longitude: 16.3569,
      source_url: 'https://example.com/event/1',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Wiener Festwochen 2026',
      start_date: '2026-06-15T19:00:00',
      venue_id: 'v1',
      location_name: 'Rathausplatz',
      city: 'Wien',
      latitude: 48.2106,
      longitude: 16.3569,
      source_url: 'https://example.com/event/1',
    });

    const result = scorePair(a, b);
    expect(result.decision).toBe('merge');
    expect(result.overallScore).toBeGreaterThanOrEqual(0.85);
    expect(result.titleScore).toBeGreaterThanOrEqual(0.9);
    expect(result.venueScore).toBe(1.0);
  });

  it('same title, same day, same venue_id => merge (high score)', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Maibaumaufstellen',
      start_date: '2026-05-01T10:00:00',
      venue_id: 'v-main',
      location_name: 'Hauptplatz Eisenstadt',
      city: 'Eisenstadt',
      latitude: 47.845,
      longitude: 16.519,
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Maibaumaufstellen',
      start_date: '2026-05-01T10:00:00',
      venue_id: 'v-main',
      location_name: 'Hauptplatz Eisenstadt',
      city: 'Eisenstadt',
      latitude: 47.845,
      longitude: 16.519,
    });

    const result = scorePair(a, b);
    expect(result.decision).toBe('merge');
  });

  it('same title, same day, DIFFERENT venue_id => distinct (hard rule)', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Maibaumaufstellen',
      start_date: '2026-05-01',
      venue_id: 'venue-A',
      city: 'Eisenstadt',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Maibaumaufstellen',
      start_date: '2026-05-01',
      venue_id: 'venue-B',
      city: 'Eisenstadt',
    });

    const result = scorePair(a, b);
    expect(result.decision).toBe('distinct');
  });

  it('same title, same day, DIFFERENT city => distinct (hard rule)', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Sommerfest',
      start_date: '2026-07-20',
      city: 'Wien',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Sommerfest',
      start_date: '2026-07-20',
      city: 'Graz',
    });

    const result = scorePair(a, b);
    expect(result.decision).toBe('distinct');
  });

  it('same source_id + source_name => merge (hard rule)', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Some Event Title',
      start_date: '2026-08-01',
      source_id: 'ext-123',
      source_name: 'burgenland.info',
      city: 'Oberwart',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Some Event Title (Updated)',
      start_date: '2026-08-02',
      source_id: 'ext-123',
      source_name: 'burgenland.info',
      city: 'Oberwart',
    });

    const result = scorePair(a, b);
    expect(result.decision).toBe('merge');
  });

  it('same ticket_url => merge (hard rule)', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Rock im Dorf',
      start_date: '2026-09-10',
      ticket_url: 'https://tickets.example.com/rock-im-dorf',
      city: 'Wien',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Rock im Dorf Festival',
      start_date: '2026-09-10',
      ticket_url: 'https://tickets.example.com/rock-im-dorf',
      city: 'Wien',
    });

    const result = scorePair(a, b);
    expect(result.decision).toBe('merge');
  });

  it('similar but not identical titles get a mid-range title score', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Wiener Weihnachtsmarkt am Rathausplatz',
      start_date: '2026-12-01',
      city: 'Wien',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Weihnachtsmarkt Rathausplatz Wien',
      start_date: '2026-12-01',
      city: 'Wien',
    });

    const result = scorePair(a, b);
    // Similar but not identical — title score should be above 0.5 but below 1.0
    expect(result.titleScore).toBeGreaterThan(0.5);
    expect(result.titleScore).toBeLessThan(1.0);
  });

  it('different days => low datetime score', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Wiener Festwochen',
      start_date: '2026-06-15',
      city: 'Wien',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Wiener Festwochen',
      start_date: '2026-07-20',
      city: 'Wien',
    });

    const result = scorePair(a, b);
    expect(result.datetimeScore).toBe(0);
  });

  it('adjacent days get a small datetime score (0.2)', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Festival Tag 1',
      start_date: '2026-06-15',
      city: 'Wien',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Festival Tag 1',
      start_date: '2026-06-16',
      city: 'Wien',
    });

    const result = scorePair(a, b);
    expect(result.datetimeScore).toBe(0.2);
  });

  it('same day, close times => high datetime score', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Konzert',
      start_date: '2026-06-15T19:00:00',
      city: 'Wien',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Konzert',
      start_date: '2026-06-15T19:10:00',
      city: 'Wien',
    });

    const result = scorePair(a, b);
    expect(result.datetimeScore).toBe(1.0);
  });

  it('events with no coords but same venue_id get a geo proxy score', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Event A',
      start_date: '2026-06-15',
      venue_id: 'v1',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Event A',
      start_date: '2026-06-15',
      venue_id: 'v1',
    });

    const result = scorePair(a, b);
    // venueScore = 1.0, geoScore should be 0.8 (proxy from venue)
    expect(result.geoScore).toBe(0.8);
  });

  it('hard rule: same source_id + source_name overrides different city', () => {
    // source_id/source_name check comes before city check in the hard rules
    const a = makeEvent({
      id: 'aaa',
      title: 'Wandertag',
      start_date: '2026-05-01',
      source_id: 'src-99',
      source_name: 'my-scraper',
      city: 'Wien',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Wandertag',
      start_date: '2026-05-01',
      source_id: 'src-99',
      source_name: 'my-scraper',
      city: 'Graz',
    });

    const result = scorePair(a, b);
    expect(result.decision).toBe('merge');
  });

  it('hard rule: same ticket_url overrides different city', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Konzert',
      start_date: '2026-06-01',
      ticket_url: 'https://ntry.at/event/42',
      city: 'Wien',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Konzert',
      start_date: '2026-06-01',
      ticket_url: 'https://ntry.at/event/42',
      city: 'Linz',
    });

    const result = scorePair(a, b);
    expect(result.decision).toBe('merge');
  });

  it('completely different events => distinct', () => {
    const a = makeEvent({
      id: 'aaa',
      title: 'Opernball Wien',
      start_date: '2026-02-12',
      city: 'Wien',
    });
    const b = makeEvent({
      id: 'bbb',
      title: 'Bauernmarkt Graz',
      start_date: '2026-08-20',
      city: 'Graz',
    });

    const result = scorePair(a, b);
    expect(result.decision).toBe('distinct');
    expect(result.overallScore).toBeLessThan(0.65);
  });

  it('returns all score dimensions in the breakdown', () => {
    const a = makeEvent({ id: 'aaa', title: 'Test', start_date: '2026-01-01' });
    const b = makeEvent({ id: 'bbb', title: 'Test', start_date: '2026-01-01' });

    const result = scorePair(a, b);
    expect(result).toHaveProperty('titleScore');
    expect(result).toHaveProperty('datetimeScore');
    expect(result).toHaveProperty('venueScore');
    expect(result).toHaveProperty('geoScore');
    expect(result).toHaveProperty('urlScore');
    expect(result).toHaveProperty('overallScore');
    expect(result).toHaveProperty('decision');
    expect(['merge', 'uncertain', 'distinct']).toContain(result.decision);
  });
});

// ---------------------------------------------------------------------------
// dedup-scorer.ts — canonicalizeIds()
// ---------------------------------------------------------------------------

describe('dedup-scorer / canonicalizeIds', () => {
  it('returns smaller ID first when a < b', () => {
    expect(canonicalizeIds('aaa', 'bbb')).toEqual(['aaa', 'bbb']);
  });

  it('returns smaller ID first when b < a', () => {
    expect(canonicalizeIds('zzz', 'aaa')).toEqual(['aaa', 'zzz']);
  });

  it('returns same order for equal IDs', () => {
    expect(canonicalizeIds('abc', 'abc')).toEqual(['abc', 'abc']);
  });

  it('is consistent regardless of input order', () => {
    const [x1, y1] = canonicalizeIds('id-alpha', 'id-beta');
    const [x2, y2] = canonicalizeIds('id-beta', 'id-alpha');
    expect(x1).toBe(x2);
    expect(y1).toBe(y2);
  });

  it('works with UUID-like strings', () => {
    const idA = '550e8400-e29b-41d4-a716-446655440000';
    const idB = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const [first, second] = canonicalizeIds(idA, idB);
    expect(first).toBe(idA); // '5' < 'f'
    expect(second).toBe(idB);
  });
});

// ---------------------------------------------------------------------------
// garbage-filter.ts — isGarbageTitle()
// ---------------------------------------------------------------------------

describe('garbage-filter / isGarbageTitle', () => {
  it('"Öffnungszeiten" is garbage', () => {
    expect(isGarbageTitle('Öffnungszeiten')).toBe(true);
  });

  it('"oeffnungszeiten" is garbage (ASCII variant)', () => {
    expect(isGarbageTitle('oeffnungszeiten')).toBe(true);
  });

  it('"Kontakt" is garbage', () => {
    expect(isGarbageTitle('Kontakt')).toBe(true);
  });

  it('"Impressum" is garbage', () => {
    expect(isGarbageTitle('Impressum')).toBe(true);
  });

  it('"Datenschutz" is garbage', () => {
    expect(isGarbageTitle('Datenschutz')).toBe(true);
  });

  it('"Newsletter" is garbage', () => {
    expect(isGarbageTitle('Newsletter')).toBe(true);
  });

  it('"ab" (2 chars) is garbage — too short', () => {
    expect(isGarbageTitle('ab')).toBe(true);
  });

  it('empty string is garbage — too short', () => {
    expect(isGarbageTitle('')).toBe(true);
  });

  it('single character is garbage — too short', () => {
    expect(isGarbageTitle('X')).toBe(true);
  });

  it('"Wiener Festwochen" is NOT garbage', () => {
    expect(isGarbageTitle('Wiener Festwochen')).toBe(false);
  });

  it('"Maibaumaufstellen" is NOT garbage', () => {
    expect(isGarbageTitle('Maibaumaufstellen')).toBe(false);
  });

  it('"Konzert im Park" is NOT garbage', () => {
    expect(isGarbageTitle('Konzert im Park')).toBe(false);
  });

  it('garbage title with extra whitespace still matches', () => {
    expect(isGarbageTitle('  Kontakt  ')).toBe(true);
  });

  it('garbage title with mixed case still matches', () => {
    expect(isGarbageTitle('IMPRESSUM')).toBe(true);
  });

  it('garbage title with punctuation still matches', () => {
    expect(isGarbageTitle('---Kontakt---')).toBe(true);
  });

  it('"AGB" is garbage', () => {
    expect(isGarbageTitle('AGB')).toBe(true);
  });

  it('"FAQ" is garbage', () => {
    expect(isGarbageTitle('FAQ')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dedup-cluster.ts — selectPrimary()
// ---------------------------------------------------------------------------

describe('dedup-cluster / selectPrimary', () => {
  it('picks the event with the highest quality_score', () => {
    const a = makeEvent({
      id: 'low',
      title: 'Event',
      start_date: '2026-01-01',
      quality_score: 40,
    });
    const b = makeEvent({
      id: 'high',
      title: 'Event',
      start_date: '2026-01-01',
      quality_score: 90,
    });

    const primary = selectPrimary([a, b]);
    expect(primary.id).toBe('high');
  });

  it('tiebreak on quality_score: picks longer description (> 50 chars)', () => {
    const shortDesc = 'Short.';
    const longDesc = 'This is a very detailed description of the event that spans well over fifty characters to qualify as meaningful content.';
    const a = makeEvent({
      id: 'short',
      title: 'Event',
      start_date: '2026-01-01',
      quality_score: 80,
      description: shortDesc,
    });
    const b = makeEvent({
      id: 'long',
      title: 'Event',
      start_date: '2026-01-01',
      quality_score: 80,
      description: longDesc,
    });

    const primary = selectPrimary([a, b]);
    expect(primary.id).toBe('long');
  });

  it('tiebreak: prefers event with image_url', () => {
    const a = makeEvent({
      id: 'no-img',
      title: 'Event',
      start_date: '2026-01-01',
      quality_score: 80,
    });
    const b = makeEvent({
      id: 'has-img',
      title: 'Event',
      start_date: '2026-01-01',
      quality_score: 80,
      image_url: 'https://example.com/image.jpg',
    });

    const primary = selectPrimary([a, b]);
    expect(primary.id).toBe('has-img');
  });

  it('tiebreak: prefers event with ticket_url', () => {
    const a = makeEvent({
      id: 'no-ticket',
      title: 'Event',
      start_date: '2026-01-01',
      quality_score: 80,
      image_url: 'https://example.com/a.jpg',
    });
    const b = makeEvent({
      id: 'has-ticket',
      title: 'Event',
      start_date: '2026-01-01',
      quality_score: 80,
      image_url: 'https://example.com/b.jpg',
      ticket_url: 'https://tickets.example.com/1',
    });

    const primary = selectPrimary([a, b]);
    expect(primary.id).toBe('has-ticket');
  });

  it('tiebreak: prefers oldest created_at', () => {
    const a = makeEvent({
      id: 'newer',
      title: 'Event',
      start_date: '2026-01-01',
      quality_score: 80,
      created_at: '2026-03-15T12:00:00Z',
    });
    const b = makeEvent({
      id: 'older',
      title: 'Event',
      start_date: '2026-01-01',
      quality_score: 80,
      created_at: '2026-01-01T12:00:00Z',
    });

    const primary = selectPrimary([a, b]);
    expect(primary.id).toBe('older');
  });

  it('works with a single event', () => {
    const a = makeEvent({
      id: 'only',
      title: 'Solo Event',
      start_date: '2026-01-01',
    });

    const primary = selectPrimary([a]);
    expect(primary.id).toBe('only');
  });

  it('works with three or more events', () => {
    const events = [
      makeEvent({ id: 'c', title: 'E', start_date: '2026-01-01', quality_score: 50 }),
      makeEvent({ id: 'a', title: 'E', start_date: '2026-01-01', quality_score: 95 }),
      makeEvent({ id: 'b', title: 'E', start_date: '2026-01-01', quality_score: 70 }),
    ];

    const primary = selectPrimary(events);
    expect(primary.id).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// dedup-cluster.ts — computeEnrichments()
// ---------------------------------------------------------------------------

describe('dedup-cluster / computeEnrichments', () => {
  it('fills missing description from duplicate with longest meaningful one', () => {
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
      description: null,
    });
    const dup = makeEvent({
      id: 'd',
      title: 'Event',
      start_date: '2026-01-01',
      description: 'A wonderfully detailed description of this event that is certainly longer than fifty characters for sure.',
    });

    const enrichments = computeEnrichments(primary, [dup]);
    expect(enrichments.description).toBe(dup.description);
  });

  it('fills missing image_url from duplicate', () => {
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
    });
    const dup = makeEvent({
      id: 'd',
      title: 'Event',
      start_date: '2026-01-01',
      image_url: 'https://example.com/photo.jpg',
    });

    const enrichments = computeEnrichments(primary, [dup]);
    expect(enrichments.image_url).toBe('https://example.com/photo.jpg');
  });

  it('fills missing ticket_url from duplicate', () => {
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
    });
    const dup = makeEvent({
      id: 'd',
      title: 'Event',
      start_date: '2026-01-01',
      ticket_url: 'https://tickets.example.com/42',
    });

    const enrichments = computeEnrichments(primary, [dup]);
    expect(enrichments.ticket_url).toBe('https://tickets.example.com/42');
  });

  it('fills missing end_date from duplicate', () => {
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
    });
    const dup = makeEvent({
      id: 'd',
      title: 'Event',
      start_date: '2026-01-01',
      end_date: '2026-01-02',
    });

    const enrichments = computeEnrichments(primary, [dup]);
    expect(enrichments.end_date).toBe('2026-01-02');
  });

  it('fills missing price_text from duplicate', () => {
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
    });
    const dup = makeEvent({
      id: 'd',
      title: 'Event',
      start_date: '2026-01-01',
      price_text: 'EUR 25',
    });

    const enrichments = computeEnrichments(primary, [dup]);
    expect(enrichments.price_text).toBe('EUR 25');
  });

  it('fills missing organizer from duplicate', () => {
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
    });
    const dup = makeEvent({
      id: 'd',
      title: 'Event',
      start_date: '2026-01-01',
      organizer: 'Kulturverein Wien',
    });

    const enrichments = computeEnrichments(primary, [dup]);
    expect(enrichments.organizer).toBe('Kulturverein Wien');
  });

  it('does NOT overwrite existing description (> 50 chars)', () => {
    const longDesc = 'Primary already has a perfectly good description that is longer than fifty characters in total length.';
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
      description: longDesc,
    });
    const dup = makeEvent({
      id: 'd',
      title: 'Event',
      start_date: '2026-01-01',
      description: 'An alternative description from the duplicate that is also very long and descriptive and detailed.',
    });

    const enrichments = computeEnrichments(primary, [dup]);
    expect(enrichments).not.toHaveProperty('description');
  });

  it('does NOT overwrite existing image_url', () => {
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
      image_url: 'https://example.com/original.jpg',
    });
    const dup = makeEvent({
      id: 'd',
      title: 'Event',
      start_date: '2026-01-01',
      image_url: 'https://example.com/other.jpg',
    });

    const enrichments = computeEnrichments(primary, [dup]);
    expect(enrichments).not.toHaveProperty('image_url');
  });

  it('does NOT overwrite existing ticket_url', () => {
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
      ticket_url: 'https://tickets.example.com/original',
    });
    const dup = makeEvent({
      id: 'd',
      title: 'Event',
      start_date: '2026-01-01',
      ticket_url: 'https://tickets.example.com/other',
    });

    const enrichments = computeEnrichments(primary, [dup]);
    expect(enrichments).not.toHaveProperty('ticket_url');
  });

  it('merges tags as a union from primary + duplicates', () => {
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
      tags: ['musik', 'outdoor'],
    });
    const dup1 = makeEvent({
      id: 'd1',
      title: 'Event',
      start_date: '2026-01-01',
      tags: ['outdoor', 'festival'],
    });
    const dup2 = makeEvent({
      id: 'd2',
      title: 'Event',
      start_date: '2026-01-01',
      tags: ['kultur'],
    });

    const enrichments = computeEnrichments(primary, [dup1, dup2]);
    const tags = enrichments.tags as string[];
    expect(tags).toBeDefined();
    expect(tags).toContain('musik');
    expect(tags).toContain('outdoor');
    expect(tags).toContain('festival');
    expect(tags).toContain('kultur');
    expect(tags.length).toBe(4);
  });

  it('does not add tags enrichment if no new tags', () => {
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
      tags: ['musik'],
    });
    const dup = makeEvent({
      id: 'd',
      title: 'Event',
      start_date: '2026-01-01',
      tags: ['musik'],
    });

    const enrichments = computeEnrichments(primary, [dup]);
    expect(enrichments).not.toHaveProperty('tags');
  });

  it('returns empty enrichments when duplicates have nothing to add', () => {
    const longDesc = 'A rich description that is definitely over fifty characters long to meet the threshold requirement.';
    const primary = makeEvent({
      id: 'p',
      title: 'Full Event',
      start_date: '2026-01-01',
      description: longDesc,
      image_url: 'https://example.com/img.jpg',
      ticket_url: 'https://tickets.example.com/1',
      end_date: '2026-01-02',
      price_text: 'EUR 10',
      organizer: 'Org',
      tags: ['tag1'],
    });
    const dup = makeEvent({
      id: 'd',
      title: 'Full Event',
      start_date: '2026-01-01',
      tags: ['tag1'],
    });

    const enrichments = computeEnrichments(primary, [dup]);
    expect(Object.keys(enrichments).length).toBe(0);
  });

  it('picks the longest meaningful description among multiple duplicates', () => {
    const primary = makeEvent({
      id: 'p',
      title: 'Event',
      start_date: '2026-01-01',
      description: 'Short',
    });
    const dup1 = makeEvent({
      id: 'd1',
      title: 'Event',
      start_date: '2026-01-01',
      description: 'A medium-length description that passes the fifty character threshold easily.',
    });
    const dup2 = makeEvent({
      id: 'd2',
      title: 'Event',
      start_date: '2026-01-01',
      description: 'An even longer and more detailed description of this wonderful event that goes on and on with many details about performers, schedule, and location information.',
    });

    const enrichments = computeEnrichments(primary, [dup1, dup2]);
    expect(enrichments.description).toBe(dup2.description);
  });
});

// ---------------------------------------------------------------------------
// dedup-cluster.ts — buildClusters()
// ---------------------------------------------------------------------------

describe('dedup-cluster / buildClusters', () => {
  it('forms a cluster from a single merge pair', () => {
    const a = makeEvent({ id: 'a', title: 'Event', start_date: '2026-01-01', quality_score: 90 });
    const b = makeEvent({ id: 'b', title: 'Event', start_date: '2026-01-01', quality_score: 60 });

    const eventsById = new Map<string, EventRow>([
      ['a', a],
      ['b', b],
    ]);

    const pairs: ScoredPair[] = [
      {
        eventA: a,
        eventB: b,
        score: {
          titleScore: 1, datetimeScore: 1, venueScore: 0, geoScore: 0, urlScore: 0,
          overallScore: 0.9, decision: 'merge',
        },
      },
    ];

    const clusters = buildClusters(pairs, eventsById);
    expect(clusters.length).toBe(1);
    expect(clusters[0].primaryId).toBe('a');
    expect(clusters[0].duplicateIds).toEqual(['b']);
  });

  it('forms a transitive cluster from chained merge pairs (A-B, B-C)', () => {
    const a = makeEvent({ id: 'a', title: 'E', start_date: '2026-01-01', quality_score: 95 });
    const b = makeEvent({ id: 'b', title: 'E', start_date: '2026-01-01', quality_score: 80 });
    const c = makeEvent({ id: 'c', title: 'E', start_date: '2026-01-01', quality_score: 70 });

    const eventsById = new Map<string, EventRow>([
      ['a', a], ['b', b], ['c', c],
    ]);

    const mergeScore: DedupScoreBreakdown = {
      titleScore: 1, datetimeScore: 1, venueScore: 0, geoScore: 0, urlScore: 0,
      overallScore: 0.9, decision: 'merge',
    };

    const pairs: ScoredPair[] = [
      { eventA: a, eventB: b, score: mergeScore },
      { eventA: b, eventB: c, score: mergeScore },
    ];

    const clusters = buildClusters(pairs, eventsById);
    expect(clusters.length).toBe(1);
    expect(clusters[0].primaryId).toBe('a');
    expect(clusters[0].duplicateIds.sort()).toEqual(['b', 'c']);
  });

  it('does NOT form clusters from uncertain or distinct pairs', () => {
    const a = makeEvent({ id: 'a', title: 'E', start_date: '2026-01-01' });
    const b = makeEvent({ id: 'b', title: 'E', start_date: '2026-01-01' });

    const eventsById = new Map<string, EventRow>([
      ['a', a], ['b', b],
    ]);

    const pairs: ScoredPair[] = [
      {
        eventA: a,
        eventB: b,
        score: {
          titleScore: 0.5, datetimeScore: 0.5, venueScore: 0, geoScore: 0, urlScore: 0,
          overallScore: 0.5, decision: 'uncertain',
        },
      },
    ];

    const clusters = buildClusters(pairs, eventsById);
    expect(clusters.length).toBe(0);
  });

  it('forms two separate clusters from independent merge pairs', () => {
    const a = makeEvent({ id: 'a', title: 'Event1', start_date: '2026-01-01', quality_score: 90 });
    const b = makeEvent({ id: 'b', title: 'Event1', start_date: '2026-01-01', quality_score: 50 });
    const c = makeEvent({ id: 'c', title: 'Event2', start_date: '2026-02-01', quality_score: 85 });
    const d = makeEvent({ id: 'd', title: 'Event2', start_date: '2026-02-01', quality_score: 60 });

    const eventsById = new Map<string, EventRow>([
      ['a', a], ['b', b], ['c', c], ['d', d],
    ]);

    const mergeScore: DedupScoreBreakdown = {
      titleScore: 1, datetimeScore: 1, venueScore: 0, geoScore: 0, urlScore: 0,
      overallScore: 0.9, decision: 'merge',
    };

    const pairs: ScoredPair[] = [
      { eventA: a, eventB: b, score: mergeScore },
      { eventA: c, eventB: d, score: mergeScore },
    ];

    const clusters = buildClusters(pairs, eventsById);
    expect(clusters.length).toBe(2);

    const primaryIds = clusters.map(c => c.primaryId).sort();
    expect(primaryIds).toEqual(['a', 'c']);
  });

  it('each cluster has a clusterId', () => {
    const a = makeEvent({ id: 'a', title: 'E', start_date: '2026-01-01', quality_score: 90 });
    const b = makeEvent({ id: 'b', title: 'E', start_date: '2026-01-01', quality_score: 50 });

    const eventsById = new Map<string, EventRow>([['a', a], ['b', b]]);
    const pairs: ScoredPair[] = [
      {
        eventA: a, eventB: b,
        score: {
          titleScore: 1, datetimeScore: 1, venueScore: 0, geoScore: 0, urlScore: 0,
          overallScore: 0.9, decision: 'merge',
        },
      },
    ];

    const clusters = buildClusters(pairs, eventsById);
    expect(clusters[0].clusterId).toBeTruthy();
    expect(typeof clusters[0].clusterId).toBe('string');
  });

  it('cluster scores map contains overall scores for each duplicate', () => {
    const a = makeEvent({ id: 'a', title: 'E', start_date: '2026-01-01', quality_score: 90 });
    const b = makeEvent({ id: 'b', title: 'E', start_date: '2026-01-01', quality_score: 50 });

    const eventsById = new Map<string, EventRow>([['a', a], ['b', b]]);
    const pairs: ScoredPair[] = [
      {
        eventA: a, eventB: b,
        score: {
          titleScore: 1, datetimeScore: 1, venueScore: 0, geoScore: 0, urlScore: 0,
          overallScore: 0.92, decision: 'merge',
        },
      },
    ];

    const clusters = buildClusters(pairs, eventsById);
    expect(clusters[0].scores.get('b')).toBe(0.92);
  });

  it('returns empty array when no pairs are provided', () => {
    const clusters = buildClusters([], new Map());
    expect(clusters).toEqual([]);
  });

  it('returns empty array when all pairs are distinct', () => {
    const a = makeEvent({ id: 'a', title: 'E', start_date: '2026-01-01' });
    const b = makeEvent({ id: 'b', title: 'E', start_date: '2026-01-01' });

    const eventsById = new Map<string, EventRow>([['a', a], ['b', b]]);
    const pairs: ScoredPair[] = [
      {
        eventA: a, eventB: b,
        score: {
          titleScore: 0.1, datetimeScore: 0, venueScore: 0, geoScore: 0, urlScore: 0,
          overallScore: 0.03, decision: 'distinct',
        },
      },
    ];

    const clusters = buildClusters(pairs, eventsById);
    expect(clusters.length).toBe(0);
  });
});
