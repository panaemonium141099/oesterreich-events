import { describe, it, expect, vi } from 'vitest';
import { BaseScraper } from '@/lib/scrapers/BaseScraper';
import type { ScrapedEvent } from '@/types/events';

class TestScraper extends BaseScraper {
  readonly name = 'test-source';
  async scrape(): Promise<ScrapedEvent[]> { return []; }
  public _enrich = this.enrichFromDetail.bind(this);
  public _setFetch(fn: (url: string, t: number) => Promise<string | null>) {
    (this as any).fetchDetailHtml = fn;
  }
}

const ev = (id: string, url: string | null): ScrapedEvent => ({
  source_id: id,
  source_name: 'test-source',
  source_url: url,
  title: 't',
  start_date: '2026-06-01',
});

describe('BaseScraper.enrichFromDetail', () => {
  it('skips events without source_url', async () => {
    const s = new TestScraper();
    const fetchMock = vi.fn();
    s._setFetch(fetchMock as any);
    const events = [ev('1', null)];
    const sum = await s._enrich(events);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sum.fetched).toBe(0);
  });

  it('fetches and merges JSON-LD address', async () => {
    const s = new TestScraper();
    const html = `<html><head><title>X</title></head><body><main>${'x'.repeat(300)}<script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      location: { name: 'Stadthalle', address: { streetAddress: 'Roland-Rainer-Platz 1', postalCode: '1150' } },
    })}</script></main></body></html>`;
    s._setFetch(async () => html);
    const events = [ev('1', 'https://example.com/e/1')];
    const sum = await s._enrich(events);
    expect(events[0].address).toBe('Roland-Rainer-Platz 1');
    expect(events[0].postal_code).toBe('1150');
    expect(sum.success).toBe(1);
  });

  it('does not throw on per-event fetch failure', async () => {
    const s = new TestScraper();
    s._setFetch(async () => { throw new Error('HTTP 500'); });
    const events = [ev('1', 'https://example.com/e/1')];
    const sum = await s._enrich(events);
    expect(sum.http_error).toBe(1);
    expect(events[0].address).toBeUndefined();
  });

  it('marks timeouts separately from http errors', async () => {
    const s = new TestScraper();
    s._setFetch(async () => { throw new Error('Timeout after 100ms (aborted)'); });
    const events = [ev('1', 'https://example.com/e/1')];
    const sum = await s._enrich(events);
    expect(sum.timeout).toBe(1);
    expect(sum.http_error).toBe(0);
  });

  it('counts invalid_html when extractor returns no layers', async () => {
    const s = new TestScraper();
    s._setFetch(async () => '<html><head><title>404</title></head><body></body></html>');
    const events = [ev('1', 'https://example.com/e/1')];
    const sum = await s._enrich(events);
    expect(sum.invalid_html).toBe(1);
  });

  it('skips events already considered complete', async () => {
    const s = new TestScraper();
    const fetchMock = vi.fn();
    s._setFetch(fetchMock as any);
    const e = ev('1', 'https://example.com/e/1');
    e.address = 'Schlossplatz 1';
    e.description = 'x'.repeat(120);
    e.price_text = '€ 12,–';
    const sum = await s._enrich([e]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sum.fetched).toBe(0);
  });
});
