import { describe, it, expect } from 'vitest';
import {
  computeCompletenessScore,
  computeDateScore,
  computeLocationScore,
  computeImageScore,
  computeLinkScore,
  isOutsideAustria,
  scoreToPublishStatus,
  generateQualityFlags,
} from '@/lib/pipeline/quality-scorer';

describe('isOutsideAustria', () => {
  it('returns true for Berlin', () => {
    expect(isOutsideAustria(52.52, 13.405)).toBe(true);
  });
  it('returns false for Vienna', () => {
    expect(isOutsideAustria(48.2082, 16.3738)).toBe(false);
  });
  it('returns false for null coords', () => {
    expect(isOutsideAustria(null, null)).toBe(false);
  });
  it('returns true for Zurich', () => {
    expect(isOutsideAustria(47.3769, 8.5417)).toBe(true);
  });
  it('returns false for Innsbruck', () => {
    expect(isOutsideAustria(47.2692, 11.4041)).toBe(false);
  });
});

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

describe('computeCompletenessScore', () => {
  it('gives max 25 for complete event', () => {
    expect(computeCompletenessScore({
      title: 'Great Festival',
      startDate: '2026-06-14',
      locationName: 'Flex Wien',
      category: 'Musik',
      description: 'A'.repeat(201),
    })).toBe(25);
  });
  it('gives 0 for empty', () => {
    expect(computeCompletenessScore({})).toBe(0);
  });
  it('gives partial for partial data', () => {
    const score = computeCompletenessScore({ title: 'Test Event', startDate: '2026-01-01' });
    expect(score).toBe(10); // title +5, startDate +5
  });
});

describe('computeDateScore', () => {
  it('gives full score for exact future date with end', () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    expect(computeDateScore({
      start_date: futureDate.toISOString(),
      start_precision: 'exact',
      end_date: futureDate.toISOString(),
    })).toBe(15);
  });
  it('gives 0 for no date', () => {
    expect(computeDateScore({})).toBe(0);
  });
});

describe('computeLocationScore', () => {
  it('gives full score for complete location in Austria', () => {
    expect(computeLocationScore({
      latitude: 48.2, longitude: 16.3,
      address: 'Donaukanal 1', location_name: 'Flex',
      bundesland: 'Wien', postal_code: '1010',
    })).toBe(25);
  });
  it('gives 0 for no location data', () => {
    expect(computeLocationScore({})).toBe(0);
  });
});

describe('computeImageScore', () => {
  it('gives 10 if image present', () => {
    expect(computeImageScore({ image_url: 'https://img.com/x.jpg' })).toBe(10);
  });
  it('gives 0 if no image', () => {
    expect(computeImageScore({})).toBe(0);
  });
});

describe('computeLinkScore', () => {
  it('gives 10 for both URLs', () => {
    expect(computeLinkScore({ source_url: 'https://a.com', ticket_url: 'https://b.com' })).toBe(10);
  });
  it('gives 0 for no URLs', () => {
    expect(computeLinkScore({})).toBe(0);
  });
});

describe('generateQualityFlags', () => {
  it('flags outside_austria as critical', () => {
    const flags = generateQualityFlags({ id: '1', latitude: 52.52, longitude: 13.405 });
    expect(flags.some(f => f.flag_type === 'outside_austria' && f.severity === 'critical')).toBe(true);
  });
  it('flags missing_location', () => {
    const flags = generateQualityFlags({ id: '1' });
    expect(flags.some(f => f.flag_type === 'missing_location')).toBe(true);
  });
  it('flags missing_image', () => {
    const flags = generateQualityFlags({ id: '1' });
    expect(flags.some(f => f.flag_type === 'missing_image')).toBe(true);
  });
  it('flags missing_time for day_only precision', () => {
    const flags = generateQualityFlags({ id: '1', start_precision: 'day_only' });
    expect(flags.some(f => f.flag_type === 'missing_time')).toBe(true);
  });
  it('no outside_austria flag for Vienna coords', () => {
    const flags = generateQualityFlags({ id: '1', latitude: 48.2, longitude: 16.3 });
    expect(flags.some(f => f.flag_type === 'outside_austria')).toBe(false);
  });
});
