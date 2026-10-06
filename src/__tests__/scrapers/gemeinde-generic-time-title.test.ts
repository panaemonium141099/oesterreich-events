/**
 * Regression: gemeinden-generic las das Datum als Uhrzeit und machte aus
 * jedem inneren Block einer Kachel ein eigenes Event.
 *
 * Prod-Befund 2026-10-06: Bei zukünftigen published Events der Quelle war
 * die Minute fast immer 10, 11 oder 12, also der Monat. Die Uhrzeit-Regex
 * `(\d{1,2})[:.](\d{2})` traf "14.10.2026" vor der echten Uhrzeit und
 * ergab 14:10 (bei "31.12." sogar die Stunde 31). Dazu Titel wie
 * "Mittwoch", "Gemeindesaal", "Datum der VeranstaltungMi," oder
 * "mehr Informationen": Datums-Badge, Ortszeile und Button der Kachel
 * waren je ein eigener Treffer der Block-Suche.
 *
 * Die Fixtures sind gekürzte Ausschnitte der echten Seiten
 * (baumkirchen.gv.at/veranstaltungen, andelsbuch.at/termine, Stand 2026-10-06).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';
import { GenericGemeindeScraper, extractTimeOfDay } from '../../lib/scrapers/GenericGemeindeScraper';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');

const page = (url: string) => ({
  gemeinde: {
    name: 'Testgemeinde', website: url, plz: '6121', bezirk: 'Innsbruck-Land',
    bundesland: 'Tirol', lat: 47.3, lng: 11.56, idKey: '70305',
  },
  eventPageUrl: url,
  path: '/veranstaltungen', dateCount: 1, eventKeywords: 1, htmlSize: 1000,
});

function parse(html: string, url: string) {
  const scraper = new GenericGemeindeScraper();
  return (scraper as any).parseGenericEvents(cheerio.load(html), page(url)) as Array<{
    title: string; start_date: string; source_url: string;
  }>;
}

describe('extractTimeOfDay', () => {
  it('liest kein Datum als Uhrzeit', () => {
    expect(extractTimeOfDay('Mi, 14.10.2026 Ganztägig')).toBeNull();
    expect(extractTimeOfDay('9.11. Gemeindesaal')).toBeNull();
    expect(extractTimeOfDay('31.12.2026')).toBeNull();
  });

  it('findet die Uhrzeit hinter einem angeklebten Datum', () => {
    expect(extractTimeOfDay('21.10.2027Do.19:00-23:00UhrNutzung Rotes Kreuz')).toBe('19:00');
    expect(extractTimeOfDay('6.10.2026Di.9:00-10:00Uhr')).toBe('09:00');
    expect(extractTimeOfDay('Sa, 17.10.2026 19:30 - 03:00 Uhr')).toBe('19:30');
  });

  it('akzeptiert den Punkt als Trenner nur mit "Uhr"', () => {
    expect(extractTimeOfDay('Beginn 19.30 Uhr')).toBe('19:30');
    expect(extractTimeOfDay('Preis 12.50 Euro')).toBeNull();
  });

  it('verwirft unmögliche Uhrzeiten', () => {
    expect(extractTimeOfDay('Ergebnis 31:12')).toBeNull();
    expect(extractTimeOfDay('25:10 Uhr')).toBeNull();
  });
});

describe('GenericGemeindeScraper: gem2go-Kacheln (baumkirchen)', () => {
  const events = parse(fixture('gemeinde-generic-baumkirchen.html'), 'https://www.baumkirchen.gv.at/veranstaltungen');

  it('liefert genau ein Event pro Kachel', () => {
    expect(events.map(e => e.title).sort()).toEqual(['Oktoberparty', 'Seniorennachmittag']);
  });

  it('nimmt die Uhrzeit aus der Zeitzeile, nicht aus dem Datum', () => {
    const party = events.find(e => e.title === 'Oktoberparty')!;
    expect(party.start_date).toBe('2026-10-17T19:30');
    expect(party.source_url).toBe('https://www.baumkirchen.gv.at/Oktoberparty');
  });

  it('lässt ganztägige Termine ohne Uhrzeit', () => {
    const senioren = events.find(e => e.title === 'Seniorennachmittag')!;
    expect(senioren.start_date).toBe('2026-10-14');
  });
});

describe('GenericGemeindeScraper: Webflow-Terminliste (andelsbuch)', () => {
  const events = parse(fixture('gemeinde-generic-andelsbuch.html'), 'https://www.andelsbuch.at/termine');

  it('nimmt die h5-Überschrift als Titel statt des ganzen Kachel-Links', () => {
    expect(events.map(e => e.title)).toEqual([
      'Kunstbräu - Ausstellung', 'Bewegung bis ins Alter', 'Alteisensammlung',
    ]);
  });

  it('liest die Beginnzeit statt Tag:Monat', () => {
    expect(events.map(e => e.start_date)).toEqual([
      '2026-10-04T10:00', '2026-10-06T09:00', '2026-10-10T08:30',
    ]);
  });
});

describe('GenericGemeindeScraper: gem2go-Tabelle ohne Uhrzeit', () => {
  // Ausschnitt edtbeilambach.at / pettenbach.at (Tabellen-Layout).
  const html = `<!doctype html><html><body><div class="liste"><table><tbody>
    <tr class="tableheaderrow"><th>Datum</th><th>Veranstaltung</th><th>Ort</th></tr>
    <tr class="odd"><td class="td_va"><span>25.10.2026 </span></td><td class="td_va"><a href="/Herbstkonzert">Herbstkonzert</a></td><td class="td_va">KOMEDT.</td></tr>
    <tr class="even"><td class="td_va"><span>06.10.2026 - 15.11.2026 </span></td><td class="td_va"><a href="/Wildwochen_im_Bierhotel_Ranklleiten_1">Wildwochen im Bierhotel Ranklleiten</a></td><td class="td_va">Bierhotel Ranklleiten im Almtal</td></tr>
  </tbody></table></div></body></html>`;
  const events = parse(html, 'https://www.edtbeilambach.at/system/web/veranstaltung.aspx');

  it('setzt kein Datum als Uhrzeit und keine Liste als Event', () => {
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['Herbstkonzert', '2026-10-25'],
      ['Wildwochen im Bierhotel Ranklleiten', '2026-10-06'],
    ]);
  });
});
