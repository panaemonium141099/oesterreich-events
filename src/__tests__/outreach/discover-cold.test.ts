import { describe, it, expect } from 'vitest';
import { extractColdDomains, buildColdQueries, isBlockedDomain } from '@/lib/outreach/discover-cold';

describe('isBlockedDomain', () => {
  it('blocks search engines + social + big aggregators', () => {
    expect(isBlockedDomain('google.com')).toBe(true);
    expect(isBlockedDomain('m.facebook.com')).toBe(true);
    expect(isBlockedDomain('de.wikipedia.org')).toBe(true);
    expect(isBlockedDomain('stadtfest-graz.at')).toBe(false);
  });
});

describe('extractColdDomains', () => {
  it('normalizes + dedupes + drops blocked + already-known', () => {
    const results = [
      { url: 'https://www.google.com/search', title: '', snippet: '' },
      { url: 'https://stadtfest-graz.at/programm', title: '', snippet: '' },
      { url: 'https://stadtfest-graz.at/', title: '', snippet: '' },
      { url: 'https://facebook.com/event', title: '', snippet: '' },
      { url: 'https://bekannt.at', title: '', snippet: '' },
    ];
    expect(extractColdDomains(results, new Set(['bekannt.at']))).toEqual(['stadtfest-graz.at']);
  });
});

describe('buildColdQueries', () => {
  it('expands each place into search templates', () => {
    const q = buildColdQueries(['Graz']);
    expect(q).toContain('Veranstaltungskalender Graz');
    expect(q).toContain('Events Graz');
    expect(q.length).toBeGreaterThanOrEqual(3);
  });
});
