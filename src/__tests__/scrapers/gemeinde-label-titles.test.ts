/**
 * Regression: Beschriftungen statt Event-Namen.
 *
 * Prod-Befund 2026-10-14: 558 sichtbare künftige Events trugen eine
 * Beschriftung als Titel, 515 davon in den letzten drei Tagen geliefert.
 *  - gemeinde-registry, GEM2GO-Tabelle: `text()` aller Links der Zeile,
 *    „Weitere Termine vorhanden<Name>Mehr" (430 Zeilen, alkoven.at 285,
 *    stockerau.at 61). 419 davon hatten einen sauber benannten gem2go-
 *    Zwilling am selben Tag, den der Dedup wegen der Klebung nicht fand.
 *  - stadthalle: `<span class="sr-only">Detailinfos zu </span>` in der
 *    Überschrift, alle 170 künftigen Zeilen.
 *  - GEM2GO-Karten: „mehr zu <Name>" aus dem Bild-Link, Text nur für
 *    Screenreader (deutschlandsberg.at).
 *  - Kacheln mit ausgezeichnetem Namen (EventON auf neuberg-bgld.at:
 *    `.evcal_event_title`, krumpendorf.gv.at: `div.title`): die Parser
 *    nahmen die erste Überschrift („Veranstaltungsdetails", „Termin") oder
 *    den ersten Link („mehr lesen").
 *  - EventON-JSON-LD („2027-1-30T17:00+2:00") las parseIsoDate nicht.
 *
 * Die Fixtures sind gekürzte Ausschnitte der echten Seiten (Stand
 * 2026-10-14). Die alten IDs in den Erwartungen sind die der Prod-Zeilen:
 * genau diese Zeilen muss der Sync übernehmen.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';
import { GemeindeRegistryScraper } from '../../lib/scrapers/GemeindeRegistryScraper';
import { GenericGemeindeScraper } from '../../lib/scrapers/GenericGemeindeScraper';
import { GemeindeListScraper } from '../../lib/scrapers/GemeindeListScraper';
import { StadthalleScraper } from '../../lib/scrapers/StadthalleScraper';
import { eventNameNodes, visibleText } from '../../lib/scrapers/event-title';
import { planSourceIdMigrations, previousSourceIds } from '../../lib/db/source-id-migration';
import { normalizeEventTimestamps } from '../../lib/db/supabase-sync';
import type { ScrapedEvent } from '@/types/events';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

// Die Registry verwirft vergangene Termine: die Fixtures sind vom 14.10.2026.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T08:00:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
});

const registry = (html: string, strategy: string, eventUrl: string): ScrapedEvent[] =>
  (new GemeindeRegistryScraper() as any).parsePage(html, {
    name: 'Testgemeinde', plz: '2000', bundesland: 'niederoesterreich', bezirk: 'Korneuburg',
    lat: 48.38, lng: 16.21, strategy, status: 'active', eventUrl,
  });
const generic = (html: string, url: string, idKey: string): ScrapedEvent[] =>
  (new GenericGemeindeScraper() as any).parsePage(html, {
    gemeinde: { name: 'Testgemeinde', website: url, plz: '7537', bezirk: 'Güssing', bundesland: 'Burgenland', lat: 47.1, lng: 16.25, idKey },
    eventPageUrl: url, path: '/termine', dateCount: 1, eventKeywords: 1, htmlSize: 1000,
  });
const list = (html: string, url: string, idKey: string): ScrapedEvent[] =>
  (new GemeindeListScraper() as any).parseCalendarPage(html, url, {
    name: 'Testgemeinde', website: url, plz: '8530', bezirk: 'Deutschlandsberg', bundesland: 'Steiermark', lat: 46.8, lng: 15.2, idKey,
  });
const byTitle = (events: ScrapedEvent[], title: string) => {
  const found = events.find(e => e.title === title);
  if (!found) throw new Error(`kein Event "${title}" in ${events.map(e => e.title).join(' | ')}`);
  return found;
};

describe('visibleText: Text ohne Screenreader-Anteil', () => {
  const $ = cheerio.load(
    '<h3 id="a"><span class="sr-only">Detailinfos zu </span>PLOT HOUSE</h3>' +
    '<a id="b" href="/x"><img src="x.jpg"><span class="visually-hidden">mehr zu Tag der offenen Tür</span></a>' +
    '<a id="c" class="sr-only" href="/y">Pilates - Montag,28.09.2026 Mehr erfahren</a>' +
    '<a id="d" href="/z">weiterlesen<span class="screen-reader-text"> „Yoga am Abend"</span></a>',
  );
  it('lässt sr-only, visually-hidden und screen-reader-text weg', () => {
    expect(visibleText($('#a'))).toBe('PLOT HOUSE');
    expect(visibleText($('#b'))).toBe('');
    expect(visibleText($('#d'))).toBe('weiterlesen');
  });
  it('liefert nichts für ein Element, das selbst nur für Screenreader ist', () => {
    expect(visibleText($('#c'))).toBe('');
  });
});

describe('eventNameNodes: ausgezeichnete Namen einer Kachel', () => {
  it('nimmt den Namen des Events, nicht den des Orts (gemeinde.lochau.at)', () => {
    const $ = cheerio.load(
      '<div class="event" itemscope itemtype="http://schema.org/Event"><h1 itemprop="name">Orgelkonzert mit Giorgio Galvan</h1>' +
      '<span itemprop="location" itemscope itemtype="http://schema.org/Place"><span itemprop="name">Pfarrkirche Lochau</span></span></div>',
    );
    expect(eventNameNodes($('.event')).toArray().map(n => $(n).text())).toEqual(['Orgelkonzert mit Giorgio Galvan']);
  });
  it('überspringt Feldbeschriftungen vor einem Wert (schaerding.at)', () => {
    const $ = cheerio.load(
      '<div class="box"><span class="title">Uhrzeit:</span> <span class="value">07:00 Uhr</span>' +
      '<span class="title">Ort:</span> <span class="value">Stadtplatz</span></div>',
    );
    expect(eventNameNodes($('.box')).length).toBe(0);
  });
});

describe('gemeinde-registry: GEM2GO-Tabelle (stockerau)', () => {
  const events = registry(fixture('gemeinde-registry-stockerau.html'), 'gem2go', 'https://www.stockerau.at/Buergerservice/Aktuelles/Veranstaltungen');

  it('nimmt den Namen aus .va_list_bez statt aller Links der Zeile', () => {
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['Tanzkurs Paare Hobby ab Silber', '2026-10-14'],
      ['Wein.Lese.Herbst', '2026-10-15'],
      ['Tage der offenen Ateliers in der Tondaradei', '2026-10-17'],
    ]);
  });

  it('meldet die IDs der geklebten Prod-Zeilen', () => {
    // Prod: „Weitere Termine vorhandenTanzkurs Paare Hobby ab SilberMehr",
    // „Wein.Lese.HerbstMehr", „Tage der offenen Ateliers in der TondaradeiMehr".
    expect(previousSourceIds(events[0])).toContain('registry-gem2go-952987a08b1ad959-2026-10-14');
    expect(previousSourceIds(events[1])).toContain('registry-gem2go-5c027d674137a413-2026-10-15');
    expect(previousSourceIds(events[2])).toContain('registry-gem2go-1d1a57684d6eaeb8-2026-10-17');
  });

  it('meldet auch die gekürzte ID der geklebten Fassung', () => {
    const glued = 'Weitere Termine vorhandenTanzkurs Paare Hobby ab SilberMehr2026-10-14';
    expect(previousSourceIds(events[0])).toContain(`registry-gem2go-${Buffer.from(glued).toString('base64').substring(0, 24)}`);
  });

  it('gibt die geklebte Zeile an den sauberen Termin', () => {
    const legacy = [{ id: 'z1', source_name: 'gemeinde-registry', source_id: 'registry-gem2go-952987a08b1ad959-2026-10-14',
      start_date: '2026-10-14T00:00:00+00:00', source_url: 'https://www.stockerau.at/Tanzkurs_Paare_Hobby_ab_Silber_1',
      title: 'Weitere Termine vorhandenTanzkurs Paare Hobby ab SilberMehr' }];
    const moves = planSourceIdMigrations(normalizeEventTimestamps(events), legacy, new Set(), new Date('2026-10-14T08:00:00Z'));
    expect(moves).toEqual([{ id: 'z1', source_name: 'gemeinde-registry', from: legacy[0].source_id, to: events[0].source_id }]);
  });
});

describe('gemeinde-registry: GEM2GO-Tabelle (alkoven)', () => {
  const events = registry(fixture('gemeinde-registry-alkoven.html'), 'gem2go', 'https://www.alkoven.at/Meine_Gemeinde/Freizeit_Tourismus/Veranstaltungen');

  it('nimmt den Namen aus .va_list_bez', () => {
    expect(events.map(e => e.title)).toEqual([
      'Gesund im Alter', 'Naturfreunde: Wanderung zum Niederberger', 'Herbstkonzert Musikverein Alkoven',
    ]);
  });

  it('meldet die IDs der geklebten Prod-Zeilen', () => {
    expect(previousSourceIds(events[0])).toContain('registry-gem2go-81c7746682ca3b40-2026-10-15');
    expect(previousSourceIds(events[1])).toContain('registry-gem2go-5c89dcee2fcf1248-2026-10-17');
    expect(previousSourceIds(events[2])).toContain('registry-gem2go-8558da6447577df7-2026-10-18');
  });
});

describe('stadthalle: Screenreader-Text in der Überschrift', () => {
  const events = (new StadthalleScraper() as any).parsePage(fixture('stadthalle-alle-events.html')) as ScrapedEvent[];

  it('nimmt den sichtbaren Namen', () => {
    expect(events.map(e => e.title)).toEqual(['PLOT HOUSE', 'Die grosse Filmmusikgala der Musicalstars', 'Freedom Ballet']);
  });

  it('behält die ID aus der URL', () => {
    expect(events[1].source_id).toBe('stadthalle-51283');
  });
});

describe('gemeinden: Bild-Link der GEM2GO-Karte (deutschlandsberg)', () => {
  const events = list(fixture('gemeinde-list-deutschlandsberg.html'), 'https://www.deutschlandsberg.at/veranstaltungen', '8530');

  it('nimmt den Namen aus dem Kopf der Karte statt „mehr zu <Name>"', () => {
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['Kinderbuch­lesung', '2026-10-20'],
      ['Theaterbesuch im Lassnitzhaus', '2026-11-26'],
    ]);
  });

  it('meldet die IDs der Prod-Zeilen', () => {
    expect(previousSourceIds(events[0])).toContain('gemeinde-8530-mehr-zu-kinderbuch-shy-lesung');
    expect(previousSourceIds(events[1])).toContain('gemeinde-8530-mehr-zu-theaterbesuch-im-lassnitzhaus');
  });
});

describe('gemeinden: Link nur für Screenreader neben dem Titel-Link (tulln)', () => {
  // Aufbau wie auf tulln.at/veranstaltungen (Stand 2026-10-14), Datum verschoben.
  const html = '<html><body><div class="col-70"><div class="event-text">' +
    '<h2 role="presentation" aria-hidden="true"><strong><a title="Pilates &amp; Yoga Basics Kurse" href="/detail/pilates">Pilates &amp; Yoga Basics Kurse</a></strong></h2> ' +
    '<a class="sr-only" title="Pilates &amp; Yoga Basics Kurse" href="/detail/pilates">Pilates &amp; Yoga Basics Kurse - Montag,28.10.2026, 19:00 Mehr erfahren </a> ' +
    '<div class="event-datestart" role="text"><strong> Montag, <span class="span-vondatum">28.10.2026</span><span>, 19:00</span></strong></div>' +
    '</div></div></body></html>';

  it('nimmt den Namen aus dem sichtbaren Link mit demselben Ziel', () => {
    const events = list(html, 'https://www.tulln.at/veranstaltungen', '3430');
    expect(events.map(e => [e.title, e.start_date])).toEqual([['Pilates & Yoga Basics Kurse', '2026-10-28']]);
    // Alte ID aus dem ganzen Linktext (Slug auf 60 Zeichen gekürzt).
    expect(previousSourceIds(events[0])).toContain('gemeinde-3430-pilates-yoga-basics-kurse-montag-28-10-2026-19-00-mehr-erfah');
  });
});

describe('neuberg-bgld.at (EventON)', () => {
  const html = fixture('gemeinde-neuberg-termine.html');
  const URL = 'https://www.neuberg-bgld.at/gemeinde/termine/';

  describe('gemeinde-registry: JSON-LD', () => {
    const events = registry(html, 'generic-dates', URL);

    it('liest Namen und Beginn aus dem JSON-LD', () => {
      // Wandzeit wie auf der Karte und in data-time, auch im Winter mit „+2:00".
      expect(events.map(e => [e.title, e.start_date])).toEqual([
        ['Halloweenparty Tankstö', '2026-10-31T17:00:00'],
        ['Besuch des Nikolaus & Adventmarkt', '2026-12-05T10:00:00'],
        ['Faschingsumzug des TC Neuberg Bergen', '2027-01-30T17:00:00'],
        ['Frühschoppen der SPÖ Neuberg', '2027-08-15T10:00:00'],
      ]);
    });

    it('übernimmt die Zeilen der Datums-Blöcke derselben Detailseite', () => {
      // Prod: „Termin" am 30.01. (05:00 aus „5:00pm") und am 15.08.
      expect(previousSourceIds(events[2])).toContain('registry-gen-VGVybWluMjAyNy0wMS0zMFQw');
      expect(previousSourceIds(events[3])).toContain('registry-gen-VGVybWluMjAyNy0wOC0xNVQx');
    });
  });

  describe('gemeinden-generic: Datums-Blöcke', () => {
    const events = generic(html, URL, '7537');

    it('nimmt .evcal_event_title statt der Überschrift „Veranstaltungsdetails"', () => {
      expect(events.map(e => e.title)).toEqual([
        'Halloweenparty Tankstö', 'Besuch des Nikolaus & Adventmarkt',
        'Faschingsumzug des TC Neuberg Bergen', 'Frühschoppen der SPÖ Neuberg',
      ]);
    });

    it('meldet die IDs der Prod-Zeilen', () => {
      expect(previousSourceIds(events[0])).toContain('gemeinden-generic-7537-veranstaltungsdetails-2026-10-31');
      expect(previousSourceIds(events[1])).toContain('gemeinden-generic-7537-veranstaltungsdetails-2026-12-05');
      expect(previousSourceIds(events[2])).toContain('gemeinden-generic-7537-termin-2027-01-30');
    });
  });
});

describe('gemeinde-registry: Name in div.title (krumpendorf)', () => {
  const html = fixture('gemeinde-krumpendorf-veranstaltungen.html');
  const URL = 'https://www.krumpendorf.gv.at/veranstaltungen';

  it('nimmt den Namen statt „mehr lesen"', () => {
    const events = registry(html, 'generic-dates', URL);
    expect(events.map(e => [e.title, e.start_date])).toEqual([
      ['Manjana | KulturKlima26', '2026-10-23'],
      ['Allerseelen - Heilige Messe in Pirk', '2026-11-02'],
    ]);
    expect(previousSourceIds(events[0])).toContain('registry-gen-3ba4608ecf22f83c-2026-10-23');
    expect(previousSourceIds(events[1])).toContain('registry-gen-69d5d5ebea33430c-2026-11-02');
  });

});

describe('gemeinde-registry: parseIsoDate', () => {
  const parse = (s: string) => (new GemeindeRegistryScraper() as any).parseIsoDate(s);

  it('liest Tag und Monat ohne führende Null und einstelligen Offset', () => {
    expect(parse('2027-1-30T17:00+2:00')).toBe('2027-01-30T17:00:00');
    expect(parse('2026-12-5T10:00+2:00')).toBe('2026-12-05T10:00:00');
    expect(parse('2026-10-26T14:00+2:00')).toBe('2026-10-26T14:00:00');
    expect(parse('2026-1-1')).toBe('2026-01-01');
  });

  it('rechnet andere Offsets nach Wien um', () => {
    expect(parse('2026-12-5T09:00Z')).toBe('2026-12-05T10:00:00');
    expect(parse('2026-7-5T08:00+0:00')).toBe('2026-07-05T10:00:00');
  });

  it('lässt bisher gelesene Angaben unverändert (die ID enthält den Beginn)', () => {
    expect(parse('2026-12-05T10:00:00+01:00')).toBe('2026-12-05T10:00:00');
    expect(parse('2026-10-17')).toBe('2026-10-17');
  });

  it('verwirft unmögliche Daten', () => {
    expect(parse('2026-13-5T10:00+2:00')).toBeNull();
    expect(parse('2026-2-30')).toBeNull();
    expect(parse('2026-2-3T25:00')).toBeNull();
  });
});

describe('source-id-migration: mehrere frühere IDs', () => {
  it('übernimmt die Zeile unter jeder der früheren IDs', () => {
    const event = { source_name: 'gemeinde-registry', source_id: 'neu-2026-10-20', start_date: '2026-10-20T10:00:00.000Z',
      previous_source_id: ['alt-hash-2026-10-20', 'alt-base64'] } as ScrapedEvent;
    const row = (source_id: string) => ({ id: 'r1', source_name: 'gemeinde-registry', source_id, start_date: '2026-10-20T10:00:00+00:00' });
    const now = new Date('2026-10-14T08:00:00Z');
    expect(planSourceIdMigrations([event], [row('alt-hash-2026-10-20')], new Set(), now).map(m => m.to)).toEqual(['neu-2026-10-20']);
    expect(planSourceIdMigrations([event], [row('alt-base64')], new Set(), now).map(m => m.to)).toEqual(['neu-2026-10-20']);
  });

  it('ignoriert die eigene ID unter den früheren', () => {
    expect(previousSourceIds({ source_id: 'a', previous_source_id: ['a', 'b', 'b'] })).toEqual(['b']);
  });
});
