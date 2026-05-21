import { describe, it, expect, beforeEach } from 'vitest';
import { enrichFromDetailHtml } from '../extract';
import { _resetAdaptersForTests } from '../registry';

beforeEach(() => _resetAdaptersForTests());

describe('enrichFromDetailHtml', () => {
  it('returns empty result for invalid HTML (404 title)', () => {
    const html = '<html><head><title>404</title></head><body></body></html>';
    const r = enrichFromDetailHtml('test', 'https://x', html);
    expect(r.layersHit).toEqual([]);
    expect(r.address).toBeUndefined();
  });

  it('extracts via JSON-LD when no adapter registered', () => {
    const html = `<html><head><title>X</title></head><body><main>${'x'.repeat(300)}<script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      location: { address: { streetAddress: 'Mariahilfer Straße 1', postalCode: '1060' }},
    })}</script></main></body></html>`;
    const r = enrichFromDetailHtml('unknown-source', 'https://x', html);
    expect(r.address).toBe('Mariahilfer Straße 1');
    expect(r.postal_code).toBe('1060');
    expect(r.layersHit).toContain('jsonld');
    expect(r.address_confidence).toBe('high');
  });

  it('reports og layer when only og:description hit', () => {
    const html = `<html><head><title>X</title>
      <meta property="og:description" content="${'desc '.repeat(40)}">
    </head><body><main>${'x'.repeat(300)}</main></body></html>`;
    const r = enrichFromDetailHtml('unknown', 'https://x', html);
    expect(r.description?.length).toBeGreaterThan(50);
    expect(r.layersHit).toContain('og');
    expect(r.address_confidence).toBeUndefined();
  });

  it('regex-only address gets confidence=low', () => {
    const desc = 'Adresse: Bahnhofstraße 12, 4020 Linz. ' + 'x'.repeat(200);
    const html = `<html><head><title>Event</title></head><body><main>${desc}</main></body></html>`;
    const r = enrichFromDetailHtml('unknown', 'https://x', html);
    expect(r.address).toBe('Bahnhofstraße 12');
    expect(r.address_confidence).toBe('low');
  });

  it('strips trailing empty-string fields', () => {
    const html = `<html><head><title>Event</title></head><body><main>${'x'.repeat(300)}<script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      description: '',
      location: { name: 'V' },
    })}</script></main></body></html>`;
    const r = enrichFromDetailHtml('unknown', 'https://x', html);
    expect(r.description).toBeUndefined();
  });
});
