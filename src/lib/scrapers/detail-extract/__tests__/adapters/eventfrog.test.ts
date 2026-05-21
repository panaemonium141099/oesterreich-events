import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { eventfrogAdapter } from '../../adapters/eventfrog';

describe('eventfrogAdapter', () => {
  it('parses venue + street + city + country CSV', () => {
    const html = `<span class="location-title">FLOW Hotel &amp; Conference, Szent György utca 12, Inárcs, HU</span>`;
    const $ = cheerio.load(html);
    const r = eventfrogAdapter.extract($, {}, 'https://x');
    expect(r.location_name).toBe('FLOW Hotel & Conference');
    expect(r.address).toBe('Szent György utca 12');
    expect(r.address_locality).toBe('Inárcs');
  });

  it('parses Austrian venue with PLZ', () => {
    const html = `<span class="location-title">Stadthalle Wien, Roland-Rainer-Platz 1, 1150 Wien, AT</span>`;
    const $ = cheerio.load(html);
    const r = eventfrogAdapter.extract($, {}, 'https://x');
    expect(r.location_name).toBe('Stadthalle Wien');
    expect(r.address).toBe('Roland-Rainer-Platz 1');
    expect(r.postal_code).toBe('1150');
    expect(r.address_locality).toBe('Wien');
  });

  it('returns empty for Online-Event', () => {
    const html = `<span class="location-title">Online-Event</span>`;
    const $ = cheerio.load(html);
    const r = eventfrogAdapter.extract($, {}, 'https://x');
    expect(r.address).toBeUndefined();
    expect(r.location_name).toBeUndefined();
  });

  it('returns empty when no .location-title', () => {
    const html = `<div>no event here</div>`;
    const $ = cheerio.load(html);
    const r = eventfrogAdapter.extract($, {}, 'https://x');
    expect(r).toEqual({});
  });
});
