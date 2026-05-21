import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { gem2goAdapter } from '../../adapters/gem2go';

describe('gem2goAdapter', () => {
  it('extracts via va-adr-* CSS classes', () => {
    const html = `<html><body>
      <span class="va-vaort">Pfarrsaal</span>
      <span class="va-adr-strasse">Kirchengasse</span>
      <span class="va-adr-hnr">7,</span>
      <span class="va-adr-plz">3040</span>
      <span class="va-adr-ort">Neulengbach</span>
      <div class="vatext_container"><div class="mehrtext-limiter">Konzert mit dem örtlichen Chor.</div></div>
    </body></html>`;
    const $ = cheerio.load(html);
    const r = gem2goAdapter.extract($, {}, 'https://gemeinde.example/');
    expect(r.location_name).toBe('Pfarrsaal');
    expect(r.address).toBe('Kirchengasse 7');
    expect(r.postal_code).toBe('3040');
    expect(r.address_locality).toBe('Neulengbach');
    expect(r.description).toContain('Konzert');
  });

  it('extracts organizer via veranstalter_bez_veranstalter class', () => {
    const html = `<html><body>
      <span class="veranstalter_bez_veranstalter">Musikverein Mönchdorf</span>
    </body></html>`;
    const $ = cheerio.load(html);
    const r = gem2goAdapter.extract($, {}, 'https://x');
    expect(r.organizer).toBe('Musikverein Mönchdorf');
  });

  it('falls back to vatext_container when mehrtext-limiter is empty', () => {
    const html = `<html><body>
      <div class="vatext_container">
        <span class="mehrtext-toggle">mehr anzeigen</span>
        Beschreibungstext der Veranstaltung mit vielen Details für die Besucher.
      </div>
    </body></html>`;
    const $ = cheerio.load(html);
    const r = gem2goAdapter.extract($, {}, 'https://x');
    expect(r.description).toContain('Beschreibungstext');
    expect(r.description).not.toContain('mehr anzeigen');
  });

  it('drops description = "mehr anzeigen"', () => {
    const html = `<html><body>
      <div class="vatext_container"><span class="mehrtext-limiter">mehr anzeigen</span></div>
    </body></html>`;
    const $ = cheerio.load(html);
    const r = gem2goAdapter.extract($, {}, 'https://x');
    expect(r.description).toBeUndefined();
  });
});
