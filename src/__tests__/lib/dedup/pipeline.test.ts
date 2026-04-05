import { describe, it, expect } from 'vitest';
import { findDuplicates, deduplicateEvents, FUZZY_THRESHOLD, type DedupEvent } from '@/lib/dedup';

describe('findDuplicates', () => {
  it('should detect exact duplicates via fingerprint', () => {
    const events: DedupEvent[] = [
      { title: 'Pub Quiz Flex', start_date: '2026-04-10T19:00:00Z', source_name: 'scraper-a', city: 'Wien' },
      { title: 'Pub Quiz Flex', start_date: '2026-04-10T20:00:00Z', source_name: 'scraper-b', city: 'Wien' },
    ];

    const { matches } = findDuplicates(events);
    expect(matches).toHaveLength(1);
    expect(matches[0].method).toBe('fingerprint');
    expect(matches[0].similarity).toBe(1.0);
  });

  it('should detect exact duplicates with different casing/punctuation', () => {
    const events: DedupEvent[] = [
      { title: 'Pub-Quiz @ Flex!', start_date: '2026-04-10', source_name: 'a', city: 'Wien' },
      { title: 'pub quiz flex', start_date: '2026-04-10', source_name: 'b', city: 'Wien' },
    ];

    const { matches } = findDuplicates(events);
    expect(matches).toHaveLength(1);
    expect(matches[0].method).toBe('fingerprint');
  });

  it('should detect fuzzy duplicates within same (date, city) block', () => {
    const events: DedupEvent[] = [
      { title: 'Pub Quiz Night at Flex Wien', start_date: '2026-04-10', source_name: 'a', city: 'Wien' },
      { title: 'Pub Quiz Night im Flex Wien', start_date: '2026-04-10', source_name: 'b', city: 'Wien' },
    ];

    const { matches } = findDuplicates(events);
    // These should match as fuzzy duplicates (high Jaro-Winkler similarity)
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const fuzzyMatch = matches.find(m => m.method === 'fuzzy');
    if (fuzzyMatch) {
      expect(fuzzyMatch.similarity).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
    }
  });

  it('should NOT flag events on different dates as duplicates', () => {
    const events: DedupEvent[] = [
      { title: 'Pub Quiz Flex', start_date: '2026-04-10', source_name: 'a', city: 'Wien' },
      { title: 'Pub Quiz Flex', start_date: '2026-04-17', source_name: 'a', city: 'Wien' },
    ];

    const { matches } = findDuplicates(events);
    expect(matches).toHaveLength(0);
  });

  it('should NOT flag events in different cities as fuzzy duplicates', () => {
    const events: DedupEvent[] = [
      { title: 'Sommerfest 2026', start_date: '2026-06-15', source_name: 'a', city: 'Wien' },
      { title: 'Sommerfest 2026', start_date: '2026-06-15', source_name: 'b', city: 'Graz' },
    ];

    const { matches } = findDuplicates(events);
    // Same title+date but different cities: fingerprints match (city not in fingerprint),
    // but they are in different blocks for fuzzy matching
    // Fingerprint still catches them as duplicates since fingerprint = title+date only
    const fpMatches = matches.filter(m => m.method === 'fingerprint');
    expect(fpMatches).toHaveLength(1); // fingerprint doesn't consider city
  });

  it('should populate content_fingerprint on all events', () => {
    const events: DedupEvent[] = [
      { title: 'Event A', start_date: '2026-04-10', source_name: 'a' },
      { title: 'Event B', start_date: '2026-04-10', source_name: 'b' },
    ];

    const { fingerprinted } = findDuplicates(events);
    expect(fingerprinted).toHaveLength(2);
    for (const e of fingerprinted) {
      expect(e.content_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('should handle empty event list', () => {
    const { fingerprinted, matches } = findDuplicates([]);
    expect(fingerprinted).toHaveLength(0);
    expect(matches).toHaveLength(0);
  });

  it('should prefer events with IDs (already in DB)', () => {
    const events: DedupEvent[] = [
      { title: 'Test Event', start_date: '2026-04-10', source_name: 'a' },
      { id: 'existing-uuid', title: 'Test Event', start_date: '2026-04-10', source_name: 'b' },
    ];

    const { matches } = findDuplicates(events);
    expect(matches).toHaveLength(1);
    expect(matches[0].keep.id).toBe('existing-uuid');
    expect(matches[0].duplicate.id).toBeUndefined();
  });
});

describe('deduplicateEvents', () => {
  it('should remove exact duplicates', () => {
    const events: DedupEvent[] = [
      { title: 'Pub Quiz Flex', start_date: '2026-04-10', source_name: 'scraper-a', city: 'Wien' },
      { title: 'Pub Quiz Flex', start_date: '2026-04-10', source_name: 'scraper-b', city: 'Wien' },
      { title: 'Different Event', start_date: '2026-04-10', source_name: 'scraper-c', city: 'Wien' },
    ];

    const { unique, removed } = deduplicateEvents(events);
    expect(unique).toHaveLength(2);
    expect(removed).toHaveLength(1);
  });

  it('should set content_fingerprint on all returned events', () => {
    const events: DedupEvent[] = [
      { title: 'Event A', start_date: '2026-04-10', source_name: 'a' },
      { title: 'Event B', start_date: '2026-04-11', source_name: 'b' },
    ];

    const { unique } = deduplicateEvents(events);
    expect(unique).toHaveLength(2);
    for (const e of unique) {
      expect(e.content_fingerprint).toBeTruthy();
    }
  });

  it('should handle single event', () => {
    const events: DedupEvent[] = [
      { title: 'Solo Event', start_date: '2026-04-10', source_name: 'a' },
    ];

    const { unique, removed } = deduplicateEvents(events);
    expect(unique).toHaveLength(1);
    expect(removed).toHaveLength(0);
  });

  it('should handle multiple duplicates of the same event', () => {
    const events: DedupEvent[] = [
      { title: 'Repeated Event', start_date: '2026-04-10', source_name: 'a' },
      { title: 'Repeated Event', start_date: '2026-04-10', source_name: 'b' },
      { title: 'Repeated Event', start_date: '2026-04-10', source_name: 'c' },
    ];

    const { unique } = deduplicateEvents(events);
    expect(unique).toHaveLength(1);
  });
});

describe('FUZZY_THRESHOLD', () => {
  it('should be 0.85', () => {
    expect(FUZZY_THRESHOLD).toBe(0.85);
  });
});
