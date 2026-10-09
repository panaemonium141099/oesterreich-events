/**
 * Regression: Datum oder Uhrzeit als Titel bei gemeinde-registry,
 * gemeinde-fallback, pph-augustinum-graz, wien-clubs, innsbruck-clubs und
 * linz-clubs (Prod-Befund 2026-10-08/09: "11.10.2026, 10:00 - 18:00",
 * "NOVEMBER 2026", "Samstag 31.10. ab 22Uhr", "SA 10.10. 19:30 UHR",
 * "Di. 13.10.2026 - 21:00"). Der Müll-Filter verwirft solche Titel, das
 * Event dahinter ging verloren. Gemeinsame Prüfung: event-title.ts.
 *
 * Die Fixtures sind gekürzte Ausschnitte der echten Seiten (Stand 2026-10-09).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GemeindeRegistryScraper } from '../../lib/scrapers/GemeindeRegistryScraper';
import { PPHAugustinumScraper } from '../../lib/scrapers/uni/PHScrapers';
import { parseEventList, asScrapedEvent } from '../../lib/scrapers/gemeinde-event-discovery';
import { WienClubsScraper } from '../../lib/scrapers/WienClubsScraper';
import { InnsbruckClubsScraper } from '../../lib/scrapers/InnsbruckClubsScraper';
import { LinzClubsScraper } from '../../lib/scrapers/LinzClubsScraper';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const rows = (events: Array<{ title: string; start_date: string }>) => events.map(e => [e.title, e.start_date]);

// Vergangene Termine fallen weg und Daten ohne Jahr bekommen das laufende:
// die Fixtures sind vom 09.10.2026.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T10:00:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
});

const club = (id: string, url: string) => ({
  id, name: id, url, latitude: 48.2, longitude: 16.37, postalCode: '1010', district: '1. Innere Stadt',
});

describe('gemeinde-registry: Datums-Überschrift vor dem Titel (ottenschlag)', () => {
  it('nimmt die zweite Überschrift, "Ganztägig" ist kein Titel', () => {
    const entry = {
      name: 'Ottenschlag', plz: '3631', bundesland: 'niederoesterreich', bezirk: 'Zwettl',
      lat: 48.42, lng: 15.22, strategy: 'generic-dates', status: 'active',
      eventUrl: 'https://www.ottenschlag.com/aktuelles/',
    };
    const events = (new GemeindeRegistryScraper() as any).parseGenericDates(
      fixture('gemeinde-registry-ottenschlag.html'), entry,
    );
    expect(rows(events)).toEqual([
      ['Pfarre Ottenschlag: Begegnungstage mit dem Bischofsvikar', '2026-10-11'],
      ['Oktoberfest vom Hilfswerk Ottenschlag', '2026-10-11T10:00:00'],
    ]);
    // Alte ID aus "Ganztägig" bzw. "10:00 - 18:00": der Sync übernimmt die Zeile.
    expect(events[1].previous_source_id).toBe(
      `registry-gen-${Buffer.from('10:00 - 18:00' + '2026-10-11T10:00:00').toString('base64').substring(0, 24)}`,
    );
  });
});

describe('pph-augustinum-graz: Monats-Abschnitte', () => {
  const events = (new PPHAugustinumScraper() as any).parseHtml(fixture('pph-augustinum-kalender.html'));

  it('liest je Listeneintrag ein Event statt des Monats', () => {
    expect(rows(events)).toEqual([
      ['Tagung: Wie Technik Kinder stark macht', '2026-10-16T14:30:00'],
      ['Herbsttagung der RL an AHS/BMHS in St. Georgen am Längsee', '2026-11-04T09:00:00'],
      ['Akademische Feier', '2026-11-05T15:00:00'],
      ['BIP - Creativity and Innovation in Early Foreign Language Education', '2026-11-09'],
      ['Focus on Europe 2026', '2026-11-11'],
      ['ELLAplus Abschlussveranstaltung', '2026-11-18T12:00:00'],
    ]);
  });

  it('übernimmt Ende und Zeitraum', () => {
    expect(events[0].end_date).toBe('2026-10-16T19:00:00');
    expect(events[3].end_date).toBe('2026-11-13');
  });

  it('meldet die Monats-Zeile als alte ID', () => {
    expect(events[1].previous_source_id).toBe('uni-pph-augustinum-november-2026');
  });
});

describe('gemeinde-fallback: Monats-Überschrift über den Events (himberg)', () => {
  it('nimmt den Namen statt "NOVEMBER 2026"', () => {
    const url = 'https://www.himberg.gv.at/events/';
    const gemeinde = { name: 'Himberg', plz: '2325', bezirk: 'Bruck an der Leitha', bundesland: 'niederoesterreich', lat: 48.08, lng: 16.44, gkz: '30731' };
    const events = parseEventList(fixture('gemeinde-fallback-himberg.html'), url).map(e => asScrapedEvent(e, gemeinde));
    expect(rows(events)).toEqual([['Tag des Liedes', '2026-11-06']]);
    expect(events[0].previous_source_id).toBe('gemeinde-30731-november-2026-2026-11-06');
  });
});

describe('wien-clubs: Datums-Überschrift über dem Namen (bettel-alm)', () => {
  it('nimmt "HALLOWEEN PARTY" statt "Samstag 31.10. ab 22Uhr"', () => {
    const url = 'https://bettel-alm.at/';
    const events = (new WienClubsScraper() as any).parseClubHtml(fixture('wien-clubs-bettel-alm.html'), club('bettel-alm', url));
    expect(rows(events)).toEqual([['HALLOWEEN PARTY', '2026-10-31']]);
    expect(events[0].previous_source_id).toBe('wien-clubs-bettel-alm-samstag-31-10-ab-22uhr');
  });
});

describe('innsbruck-clubs: Datums-Link der Kachel (treibhaus)', () => {
  it('nimmt den Schema.org-Namen der Kachel', () => {
    const url = 'https://treibhaus.at/programm';
    const events = (new InnsbruckClubsScraper() as any).parseClubHtml(fixture('innsbruck-clubs-treibhaus.html'), club('treibhaus', url));
    const named = events.filter((e: { title: string }) => e.title !== 'Tickets');
    expect(rows(named)).toEqual([
      ['RENAUD GARCIA FONS & BLUE MAQAM // DER PAGANINI DES KONTRABASSES', '2026-10-09'],
      ['KRIMIFEST TIROL: ERÖFFNUNG', '2026-10-10'],
    ]);
    expect(named[1].previous_source_id).toBe('innsbruck-clubs-treibhaus-sa-10-10-19-30-uhr');
  });
});

describe('linz-clubs: Datums-Link der Kachel (kapu)', () => {
  it('nimmt die Überschrift und hält Serientermine getrennt', () => {
    const url = 'https://kapu.or.at/events';
    const events = (new LinzClubsScraper() as any).parseClubHtml(fixture('linz-clubs-kapu.html'), club('kapu', url));
    expect(rows(events)).toEqual([
      ['RELEASE SHOW: ANDA MORTS', '2026-10-13'],
      ['RELEASE SHOW: ANDA MORTS', '2026-10-14'],
    ]);
    expect(new Set(events.map((e: { source_id: string }) => e.source_id)).size).toBe(2);
    expect(events[0].previous_source_id).toBe('linz-clubs-kapu-di-13-10-2026-21-00');
  });
});
