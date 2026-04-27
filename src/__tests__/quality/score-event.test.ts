import { describe, it, expect } from 'vitest';
import {
  isOutsideAustria,
  scoreToPublishStatus,
  computeCompletenessScore,
  computeDateScore,
  computeLocationScore,
  computeImageScore,
  computeLinkScore,
  scoreEvent,
} from '@/lib/quality/score-event';

// ─── Bounding-box check ─────────────────────────────────────────────

describe('isOutsideAustria', () => {
  it('returns true for Berlin', () => {
    expect(isOutsideAustria(52.52, 13.405)).toBe(true);
  });
  it('returns false for Vienna', () => {
    expect(isOutsideAustria(48.2082, 16.3738)).toBe(false);
  });
  it('returns false for Innsbruck', () => {
    expect(isOutsideAustria(47.2692, 11.4041)).toBe(false);
  });
  it('returns true for Zurich', () => {
    expect(isOutsideAustria(47.3769, 8.5417)).toBe(true);
  });
  it('returns false for null coords', () => {
    expect(isOutsideAustria(null, null)).toBe(false);
    expect(isOutsideAustria(undefined, undefined)).toBe(false);
  });
});

// ─── Score → publish_status mapping ────────────────────────────────

describe('scoreToPublishStatus', () => {
  it('returns published for >= 60', () => {
    expect(scoreToPublishStatus(75)).toBe('published');
    expect(scoreToPublishStatus(60)).toBe('published');
  });
  it('returns published_low_confidence for 40-59', () => {
    expect(scoreToPublishStatus(45)).toBe('published_low_confidence');
    expect(scoreToPublishStatus(40)).toBe('published_low_confidence');
    expect(scoreToPublishStatus(59)).toBe('published_low_confidence');
  });
  it('returns needs_review for 20-39', () => {
    expect(scoreToPublishStatus(25)).toBe('needs_review');
    expect(scoreToPublishStatus(20)).toBe('needs_review');
  });
  it('returns suppressed for < 20', () => {
    expect(scoreToPublishStatus(10)).toBe('suppressed');
    expect(scoreToPublishStatus(0)).toBe('suppressed');
  });
});

// ─── Per-dimension score components ─────────────────────────────────

describe('computeCompletenessScore', () => {
  it('gives 25 for fully complete event', () => {
    expect(
      computeCompletenessScore({
        title: 'Great Festival',
        start_date: '2026-06-14',
        location_name: 'Flex Wien',
        category: 'Konzerte',
        description: 'A'.repeat(201),
      }),
    ).toBe(25);
  });
  it('gives 0 for empty', () => {
    expect(computeCompletenessScore({})).toBe(0);
  });
  it('gives 10 for title + start_date only', () => {
    // title (>5 chars) +5, start_date +5
    expect(
      computeCompletenessScore({ title: 'Test Event', start_date: '2026-01-01' }),
    ).toBe(10);
  });
  it('does not award title bonus for short title', () => {
    // title length must be > 5 chars
    expect(computeCompletenessScore({ title: 'short' })).toBe(0);
    expect(computeCompletenessScore({ title: 'longer' })).toBe(5);
  });
});

describe('computeDateScore', () => {
  it('awards full bonus for future exact-time dated event with end_date', () => {
    const future = new Date();
    future.setMonth(future.getMonth() + 1);
    future.setHours(20, 0, 0, 0); // non-midnight
    const iso = future.toISOString();
    // start_date +5, exact-time bonus +5, future-window +3, end_date +2 = 15
    expect(
      computeDateScore({
        start_date: iso,
        end_date: iso,
      }),
    ).toBe(15);
  });
  it('returns 0 when no date present', () => {
    expect(computeDateScore({})).toBe(0);
  });
  it('does not award exact-time bonus for midnight start', () => {
    const future = new Date();
    future.setMonth(future.getMonth() + 1);
    future.setHours(0, 0, 0, 0);
    // Build the exact "T00:00:00" form the score function checks for
    const iso = `${future.toISOString().slice(0, 10)}T00:00:00`;
    // start_date +5, NO exact-time bonus, future-window +3 = 8
    expect(computeDateScore({ start_date: iso })).toBe(8);
  });
});

describe('computeLocationScore', () => {
  it('caps at 25 for full Austria event', () => {
    expect(
      computeLocationScore({
        latitude: 48.2,
        longitude: 16.3,
        address: 'Donaukanal 1',
        location_name: 'Flex',
        bundesland: 'Wien',
        postal_code: '1010',
      }),
    ).toBe(25);
  });
  it('returns 0 with no location data', () => {
    expect(computeLocationScore({})).toBe(0);
  });
  it('does not award AT-bonus for outside-AT coords', () => {
    // Berlin: coords +7, no AT-bonus
    expect(
      computeLocationScore({
        latitude: 52.52,
        longitude: 13.405,
      }),
    ).toBe(7);
  });
});

describe('computeImageScore', () => {
  it('returns 10 with image_url', () => {
    expect(computeImageScore({ image_url: 'https://img.example/foo.jpg' })).toBe(10);
  });
  it('returns 0 without image_url', () => {
    expect(computeImageScore({})).toBe(0);
  });
});

describe('computeLinkScore', () => {
  it('returns 10 for both URLs present', () => {
    expect(
      computeLinkScore({
        source_url: 'https://example.at/event',
        ticket_url: 'https://tickets.example.at',
      }),
    ).toBe(10);
  });
  it('returns 7 for source_url only', () => {
    // source +3, has-any-link +4
    expect(computeLinkScore({ source_url: 'https://example.at' })).toBe(7);
  });
  it('returns 0 with no URLs', () => {
    expect(computeLinkScore({})).toBe(0);
  });
});

// ─── End-to-end scoreEvent ──────────────────────────────────────────

describe('scoreEvent', () => {
  it('short-circuits to suppressed when coords outside Austria', () => {
    const result = scoreEvent({
      title: 'Berlin Event',
      start_date: '2026-06-14T20:00:00',
      latitude: 52.52,
      longitude: 13.405,
      location_name: 'Berghain',
      address: 'Am Wriezener Bahnhof',
    });
    expect(result.outside_austria).toBe(true);
    expect(result.publish_status).toBe('suppressed');
    expect(result.quality_score).toBe(0);
    expect(result.flags.some(f => f.flag_type === 'outside_austria')).toBe(true);
  });

  it('returns published for a complete Vienna event', () => {
    const future = new Date();
    future.setMonth(future.getMonth() + 1);
    future.setHours(20, 0, 0, 0);
    const result = scoreEvent({
      title: 'Pizzera & Jaus Konzert',
      description: 'Live in der Stadthalle. '.repeat(20),
      start_date: future.toISOString(),
      end_date: future.toISOString(),
      location_name: 'Stadthalle',
      address: 'Roland-Rainer-Platz 1',
      postal_code: '1150',
      bundesland: 'Wien',
      category: 'Konzerte',
      latitude: 48.2,
      longitude: 16.33,
      image_url: 'https://img/foo.jpg',
      source_url: 'https://example.at/event',
      ticket_url: 'https://tickets.example.at',
    });
    expect(result.outside_austria).toBe(false);
    expect(result.publish_status).toBe('published');
    expect(result.quality_score).toBeGreaterThanOrEqual(60);
    // Per-dimension breakdown sums to quality_score
    const sum =
      result.breakdown.completeness +
      result.breakdown.date +
      result.breakdown.location +
      result.breakdown.image +
      result.breakdown.link +
      result.breakdown.dedup +
      result.breakdown.source_trust;
    expect(sum).toBe(result.quality_score);
  });

  it('flags missing_location when no name and no coords', () => {
    const result = scoreEvent({ title: 'Foo Event', start_date: '2026-06-14' });
    expect(result.flags.some(f => f.flag_type === 'missing_location')).toBe(true);
  });

  it('flags missing_image when no image_url', () => {
    const result = scoreEvent({ title: 'Foo Event', start_date: '2026-06-14' });
    expect(result.flags.some(f => f.flag_type === 'missing_image')).toBe(true);
  });

  it('flags missing_description for short or no description', () => {
    const noDesc = scoreEvent({ title: 'Foo Event', start_date: '2026-06-14' });
    expect(noDesc.flags.some(f => f.flag_type === 'missing_description')).toBe(true);
    const shortDesc = scoreEvent({
      title: 'Foo',
      start_date: '2026-06-14',
      description: 'too short',
    });
    expect(shortDesc.flags.some(f => f.flag_type === 'missing_description')).toBe(true);
  });

  it('honors caller-supplied dedup and source_trust overrides', () => {
    const future = new Date();
    future.setMonth(future.getMonth() + 1);
    const baseEvent = {
      title: 'Test Event Long Title',
      start_date: future.toISOString(),
      location_name: 'Some Venue',
      latitude: 48.2,
      longitude: 16.3,
    };
    const defaults = scoreEvent(baseEvent);
    const overridden = scoreEvent(baseEvent, { dedupScore: 0, sourceTrust: 0 });
    // 0+0 vs 10+2 = 12 less
    expect(defaults.quality_score - overridden.quality_score).toBe(12);
  });

  it('produces deterministic output', () => {
    const event = {
      title: 'Determinism Test',
      start_date: '2027-06-14T20:00:00',
      location_name: 'Venue',
      latitude: 48.2,
      longitude: 16.3,
      image_url: 'https://img/x.jpg',
    };
    const a = scoreEvent(event);
    const b = scoreEvent(event);
    expect(a).toEqual(b);
  });
});
