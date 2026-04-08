import { describe, it, expect } from 'vitest';
import {
  computeTrustScoreFromMetrics,
  aggregateMetrics,
} from '@/lib/pipeline/source-trust';

// ---------------------------------------------------------------------------
// computeTrustScoreFromMetrics
// ---------------------------------------------------------------------------

describe('computeTrustScoreFromMetrics', () => {
  it('returns zero score for source with 0 events', () => {
    const result = computeTrustScoreFromMetrics('empty-source', {
      total: 0,
      qualitySum: 0,
      withVenue: 0,
      duplicates: 0,
      withCoords: 0,
      withDescription: 0,
      withImage: 0,
      withTicket: 0,
      futureEvents: 0,
    });

    expect(result.sourceName).toBe('empty-source');
    expect(result.eventCount).toBe(0);
    expect(result.trustScore).toBe(0);
    expect(result.avgQualityScore).toBe(0);
    expect(result.venueMatchRate).toBe(0);
    expect(result.duplicateRate).toBe(0);
    expect(result.coordsRate).toBe(0);
    expect(result.descriptionRate).toBe(0);
    expect(result.imageRate).toBe(0);
    expect(result.ticketRate).toBe(0);
    expect(result.futureEventRate).toBe(0);
  });

  it('returns perfect score for a source with all perfect data', () => {
    const result = computeTrustScoreFromMetrics('perfect-source', {
      total: 100,
      qualitySum: 10000, // avg = 100
      withVenue: 100,
      duplicates: 0,
      withCoords: 100,
      withDescription: 100,
      withImage: 100,
      withTicket: 100,
      futureEvents: 100,
    });

    expect(result.sourceName).toBe('perfect-source');
    expect(result.eventCount).toBe(100);
    expect(result.trustScore).toBe(100);
    expect(result.avgQualityScore).toBe(100);
    expect(result.venueMatchRate).toBe(100);
    expect(result.duplicateRate).toBe(0);
    expect(result.coordsRate).toBe(100);
    expect(result.descriptionRate).toBe(100);
    expect(result.imageRate).toBe(100);
    expect(result.futureEventRate).toBe(100);
  });

  it('computes correct trust score with mixed metrics', () => {
    const result = computeTrustScoreFromMetrics('mixed-source', {
      total: 200,
      qualitySum: 12000, // avg = 60
      withVenue: 100, // 50%
      duplicates: 20, // 10%
      withCoords: 160, // 80%
      withDescription: 120, // 60%
      withImage: 40, // 20%
      withTicket: 60, // 30%
      futureEvents: 80, // 40%
    });

    expect(result.sourceName).toBe('mixed-source');
    expect(result.eventCount).toBe(200);
    expect(result.avgQualityScore).toBe(60);
    expect(result.venueMatchRate).toBe(50);
    expect(result.duplicateRate).toBe(10);
    expect(result.coordsRate).toBe(80);
    expect(result.descriptionRate).toBe(60);
    expect(result.imageRate).toBe(20);
    expect(result.futureEventRate).toBe(40);

    // Trust = avgQ(60/100)*0.4*100 + venue(0.5)*0.15*100 + coords(0.8)*0.15*100 + desc(0.6)*0.1*100 + img(0.2)*0.05*100 + future(0.4)*0.05*100 + (1-0.1)*0.1*100
    // = 24 + 7.5 + 12 + 6 + 1 + 2 + 9 = 61.5 -> 62
    expect(result.trustScore).toBe(62);
  });

  it('clamps trust score to 0-100 range', () => {
    const result = computeTrustScoreFromMetrics('extreme', {
      total: 1,
      qualitySum: 100,
      withVenue: 1,
      duplicates: 0,
      withCoords: 1,
      withDescription: 1,
      withImage: 1,
      withTicket: 1,
      futureEvents: 1,
    });

    expect(result.trustScore).toBeGreaterThanOrEqual(0);
    expect(result.trustScore).toBeLessThanOrEqual(100);
  });

  it('penalizes high duplicate rate', () => {
    const lowDup = computeTrustScoreFromMetrics('low-dup', {
      total: 100,
      qualitySum: 5000,
      withVenue: 50,
      duplicates: 5, // 5%
      withCoords: 80,
      withDescription: 60,
      withImage: 40,
      withTicket: 20,
      futureEvents: 50,
    });

    const highDup = computeTrustScoreFromMetrics('high-dup', {
      total: 100,
      qualitySum: 5000,
      withVenue: 50,
      duplicates: 80, // 80%
      withCoords: 80,
      withDescription: 60,
      withImage: 40,
      withTicket: 20,
      futureEvents: 50,
    });

    expect(lowDup.trustScore).toBeGreaterThan(highDup.trustScore);
  });

  it('rates are stored as percentages with one decimal', () => {
    const result = computeTrustScoreFromMetrics('decimals', {
      total: 3,
      qualitySum: 150,
      withVenue: 1,
      duplicates: 0,
      withCoords: 2,
      withDescription: 1,
      withImage: 0,
      withTicket: 0,
      futureEvents: 1,
    });

    // 1/3 = 33.3%, 2/3 = 66.7%
    expect(result.venueMatchRate).toBe(33.3);
    expect(result.coordsRate).toBe(66.7);
    expect(result.descriptionRate).toBe(33.3);
    expect(result.imageRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// aggregateMetrics
// ---------------------------------------------------------------------------

describe('aggregateMetrics', () => {
  const today = '2026-04-08';

  it('handles empty array', () => {
    const result = aggregateMetrics([], today);
    expect(result.total).toBe(0);
    expect(result.qualitySum).toBe(0);
  });

  it('counts all metrics correctly', () => {
    const events = [
      {
        quality_score: 80,
        venue_id: 'v1',
        publish_status: 'published',
        latitude: 48.2,
        longitude: 16.3,
        description: 'A long description that is definitely more than fifty characters in length to pass the check',
        image_url: 'https://example.com/img.jpg',
        ticket_url: 'https://tickets.example.com',
        start_date: '2026-05-01',
      },
      {
        quality_score: 40,
        venue_id: null,
        publish_status: 'duplicate',
        latitude: null,
        longitude: null,
        description: 'Short',
        image_url: null,
        ticket_url: null,
        start_date: '2025-01-01',
      },
      {
        quality_score: null,
        venue_id: 'v2',
        publish_status: 'published',
        latitude: 47.5,
        longitude: 15.4,
        description: null,
        image_url: 'https://example.com/img2.jpg',
        ticket_url: null,
        start_date: '2026-12-25',
      },
    ];

    const result = aggregateMetrics(events, today);
    expect(result.total).toBe(3);
    expect(result.qualitySum).toBe(120); // 80 + 40 + 0
    expect(result.withVenue).toBe(2); // v1 and v2
    expect(result.duplicates).toBe(1); // second event
    expect(result.withCoords).toBe(2); // first and third
    expect(result.withDescription).toBe(1); // only first has > 50 chars
    expect(result.withImage).toBe(2); // first and third
    expect(result.withTicket).toBe(1); // only first
    expect(result.futureEvents).toBe(2); // first and third (>= today)
  });

  it('treats null quality_score as 0', () => {
    const events = [
      { quality_score: null, start_date: '2026-01-01' },
      { quality_score: 60, start_date: '2026-01-01' },
    ];

    const result = aggregateMetrics(events, today);
    expect(result.qualitySum).toBe(60);
  });

  it('counts description only if > 50 chars', () => {
    const events = [
      { description: 'x'.repeat(50), start_date: '2026-01-01' }, // exactly 50 = not counted
      { description: 'x'.repeat(51), start_date: '2026-01-01' }, // 51 = counted
    ];

    const result = aggregateMetrics(events, today);
    expect(result.withDescription).toBe(1);
  });
});
