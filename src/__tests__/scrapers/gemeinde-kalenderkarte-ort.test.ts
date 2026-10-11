/**
 * Regression: Ort im Titel und fehlende Endzeit bei Kalenderkarten der
 * TYPO3-Vorlage mit `.calendarize-item` (Überschrift `h4.card-title`,
 * Terminzeile in `.calendar_wrap`).
 *
 * Prod-Befund 2026-10-11 (oberpullendorf.gv.at, gemeinden-generic und
 * gemeinde-registry): alle 57 sichtbaren künftigen Zeilen hießen
 * „<Titel> | <Ort>" („Halloween im Garten | Hauptplatz 10"), end_date war
 * bei allen 225 künftigen Zeilen leer, obwohl die Terminzeile
 * „31.10.2026 16:00 - 23:00" lautet. Die Karte hat kein eigenes Ortsfeld,
 * die Gemeinde schreibt den Ort hinter den Trenner.
 *
 * Andere Gemeinden setzen „ | " für Untertitel („Alfred Dorfer | "GLEICH"",
 * frantschach.gv.at), zweisprachige Titel (oslip.at) oder vor dem Titel
 * das Datum (kapfenstein.at). Der Ort wird deshalb nur bei dieser Vorlage
 * abgetrennt, und nur, wenn die Seite den Trenner durchgehend setzt.
 *
 * Fixture: echte Karten der Seite (Stand 2026-10-11), gekürzt auf 8.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';
import { GenericGemeindeScraper } from '../../lib/scrapers/GenericGemeindeScraper';
import { GemeindeRegistryScraper, registryEventId } from '../../lib/scrapers/GemeindeRegistryScraper';
import { parseCalendarizeTerm, readCalendarizeCard, usesPlaceSuffix } from '../../lib/scrapers/calendarize-card';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const oberpullendorf = fixture('gemeinde-oberpullendorf-kalender.html');
const URL = 'https://www.oberpullendorf.gv.at/leben-bildung/veranstaltungen/';

type Ev = {
  source_id: string; previous_source_id?: string; title: string; start_date: string;
  end_date?: string; location_name?: string; description?: string;
};

// Die Registry verwirft vergangene Termine: die Fixture ist vom 11.10.2026.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T08:00:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
});

/** Kartenaufbau wie auf der Seite. */
const card = (heading: string, term: string, extra = '') =>
  `<div class="card "><div class="card-block"><div class="media calendarize-item"><div><h4 class="card-title">${heading}</h4>${extra}</div>` +
  `<div class="calendar_wrap"><p>\n  ${term}\n  </p></div></div></div></div>`;
/** Name, Ort, Beschreibung und Ende einer Karte (fehlend = undefined). */
const parts = (c: ReturnType<typeof readCalendarizeCard>) =>
  c && { title: c.title, location: c.location, details: c.details, end: c.end };
const page = (...cards: string[]) =>
  cheerio.load(`<html><body><div class="tx-sf-event-mgt">${cards.join('')}</div></body></html>`);

describe('parseCalendarizeTerm: Terminzeile', () => {
  it('liest Beginn und Ende am selben Tag', () => {
    expect(parseCalendarizeTerm('31.10.2026 16:00 - 23:00')).toEqual({
      date: '2026-10-31', time: '16:00', end: '2026-10-31T23:00',
    });
  });

  it('liest ein Ende an einem anderen Tag', () => {
    expect(parseCalendarizeTerm('03.09.2026 10:00 - 23.12.2026 13:00')).toEqual({
      date: '2026-09-03', time: '10:00', end: '2026-12-23T13:00',
    });
  });

  it('legt ein Ende vor dem Beginn am selben Tag auf den Folgetag (nach Mitternacht)', () => {
    expect(parseCalendarizeTerm('17.10.2026 21:00 - 02:00')?.end).toBe('2026-10-18T02:00');
  });

  it('setzt kein Ende ohne Endzeit', () => {
    expect(parseCalendarizeTerm('13.10.2026 19:00 -')).toEqual({ date: '2026-10-13', time: '19:00' });
    expect(parseCalendarizeTerm('10.10.2026 20:00 - Offenes Ende')?.end).toBeUndefined();
    // Endtag ohne Uhrzeit (grosswarasdorf.at): kein erfundenes 00:00.
    expect(parseCalendarizeTerm('27.11.2026 17:00 - 28.11.2026 Offenes Ende')?.end).toBeUndefined();
    expect(parseCalendarizeTerm('26.12.2026 Ganztags')).toEqual({ date: '2026-12-26' });
  });

  it('verwirft ein ausdrückliches Ende vor dem Beginn', () => {
    // Seite: Vortrag am 20.10. „bis 02.10.2026 13:45" (Eingabefehler).
    expect(parseCalendarizeTerm('20.10.2026 18:30 - 02.10.2026 13:45')).toEqual({ date: '2026-10-20', time: '18:30' });
  });

  it('liefert nichts ohne Datum am Anfang', () => {
    expect(parseCalendarizeTerm('Offenes Ende')).toBeNull();
  });
});

describe('readCalendarizeCard: Ort hinter dem Trenner', () => {
  const placePage = page(
    card('Halloween im Garten | Hauptplatz 10', '31.10.2026 16:00 - 23:00'),
    card('Gulaschessen | Feuerwehrhaus', '26.10.2026 11:00 - 14:00'),
    card('Christmette | Pfarre MP', '24.12.2026 20:00 - 21:00'),
    card('Herbstausstellung | 14er Haus | Do+Sa 10-13h, Fr 10-17h', '03.09.2026 10:00 - 23.12.2026 13:00'),
    card('Narrenwecken | &quot;Die Krebsler&quot; | GH Domschitz', '11.11.2026 11:11 -'),
    card('Seniorennachmittag', '05.11.2026 15:00 - 18:00'),
  );
  const cards = placePage('.card');
  const read = (i: number) => readCalendarizeCard(cards.eq(i), usesPlaceSuffix(placePage));

  it('erkennt die Seiten-Konvention', () => {
    expect(usesPlaceSuffix(placePage)).toBe(true);
  });

  it('trennt Titel und Ort', () => {
    expect(read(0)).toMatchObject({
      heading: 'Halloween im Garten | Hauptplatz 10', title: 'Halloween im Garten',
      location: 'Hauptplatz 10', start: { date: '2026-10-31', time: '16:00' }, end: '2026-10-31T23:00',
    });
  });

  it('nimmt bei mehreren Teilen den letzten, der einen Ort nennt, der Rest wird Beschreibung', () => {
    expect(read(3)).toMatchObject({ title: 'Herbstausstellung', location: '14er Haus', details: 'Do+Sa 10-13h, Fr 10-17h' });
    expect(read(4)).toMatchObject({ title: 'Narrenwecken', location: 'GH Domschitz', details: '"Die Krebsler"' });
  });

  it('lässt eine Karte ohne Trenner unverändert', () => {
    expect(parts(read(5))).toEqual({ title: 'Seniorennachmittag', end: '2026-11-05T18:00' });
  });

  it('trennt nichts, wenn nur einzelne Karten den Trenner tragen (Untertitel)', () => {
    const subtitles = page(
      card('Alfred Dorfer | &quot;GLEICH&quot;', '04.11.2026 20:00 -'),
      card('Petutschnig Hons', '23.01.2027 19:30 -'),
      card('Adventmarkt', '28.11.2026 14:00 - 20:00'),
      card('Laternenfest', '11.11.2026 17:00 - 19:00'),
    );
    expect(usesPlaceSuffix(subtitles)).toBe(false);
    const c = readCalendarizeCard(subtitles('.card').first(), usesPlaceSuffix(subtitles));
    expect(parts(c)).toEqual({ title: 'Alfred Dorfer | "GLEICH"' });
  });

  it('trennt nichts bei Karten mit eigenem Ortsfeld (grosswarasdorf.at)', () => {
    const details = '<div class="calendar_details"><p><span class="info">Veranstaltungsort:</span> KUGA | <span class="info">Veranstalter:</span> KUGA</p></div>';
    const own = page(
      card('Konzert | Band A', '10.10.2026 20:00 - 22:00', details),
      card('Kabarett | Künstler B', '17.10.2026 20:00 - Offenes Ende', details),
      card('Lesung | Autorin C', '25.10.2026 19:30 - 21:00', details),
    );
    expect(usesPlaceSuffix(own)).toBe(false);
    expect(parts(readCalendarizeCard(own('.card').first(), true))).toEqual({
      title: 'Konzert | Band A', end: '2026-10-10T22:00',
    });
  });

  it('trennt kein Datum vor dem Trenner ab (kapfenstein.at: „Sa, 17.10.2026 | Flohmarkt")', () => {
    const p = page(card('Sa, 17.10.2026 | Flohmarkt', '17.10.2026 08:00 - 12:00'));
    expect(parts(readCalendarizeCard(p('.card').first(), true))).toEqual({ title: 'Sa, 17.10.2026 | Flohmarkt', end: '2026-10-17T12:00' });
  });

  it('liefert nichts für Blöcke ohne Kalenderkarte', () => {
    const $ = cheerio.load('<div class="card"><h4 class="card-title">Halloween | Hauptplatz</h4><p>31.10.2026 16:00 - 23:00</p></div>');
    expect(readCalendarizeCard($('.card').first(), true)).toBeNull();
  });
});

describe('gemeinden-generic: Kalenderkarten (oberpullendorf)', () => {
  const page = {
    gemeinde: {
      name: 'Oberpullendorf', website: 'https://www.oberpullendorf.gv.at', plz: '7350',
      bezirk: 'Oberpullendorf', bundesland: 'Burgenland', lat: 47.5, lng: 16.5, idKey: '7350',
    },
    eventPageUrl: URL, path: '/leben-bildung/veranstaltungen/', dateCount: 1, eventKeywords: 1, htmlSize: 1,
  };
  const events: Ev[] = (new GenericGemeindeScraper() as any).parsePage(oberpullendorf, page);
  const byTitle = (t: string) => events.filter(e => e.title === t);

  it('liest Titel ohne Ort, den Ort und das Ende', () => {
    expect(byTitle('Halloween im Garten')).toEqual([expect.objectContaining({
      start_date: '2026-10-31T16:00', end_date: '2026-10-31T23:00', location_name: 'Hauptplatz 10',
    })]);
  });

  it('behält die source_id aus der Überschrift: keine neue Zeile, manual_merge bleibt', () => {
    const [halloween] = byTitle('Halloween im Garten');
    expect(halloween.source_id).toBe('gemeinden-generic-7350-halloween-im-garten-hauptplatz-10-2026-10-31');
    expect(events.every(e => e.previous_source_id === undefined)).toBe(true);
  });

  it('hält zwei gleichnamige Termine am selben Tag an verschiedenen Orten auseinander', () => {
    expect(byTitle('Christmette').map(e => [e.location_name, e.start_date, e.source_id])).toEqual([
      ['Pfarre MP', '2026-12-24T20:00', 'gemeinden-generic-7350-christmette-pfarre-mp-2026-12-24'],
      ['Pfarre OP', '2026-12-24T22:00', 'gemeinden-generic-7350-christmette-pfarre-op-2026-12-24'],
    ]);
  });

  it('liest alle Karten der Fixture', () => {
    expect(events.map(e => [e.title, e.location_name ?? null, e.end_date ?? null, e.description ?? null])).toEqual([
      ["Herbst- und Winterausstellung 'Der Gelbe Tisch'", '14er Haus', '2026-12-23T13:00', 'Do+Sa 10-13h, Fr 10-17h'],
      ['Treffpunkt Oberpullendorf', 'Eisenstädterstraße 76', null, 'Sonnenland Teamspace'],
      ['Heilkräuter für die Verdauung Vortrag', 'Apotheke', null, null],
      ['Halloween im Garten', 'Hauptplatz 10', '2026-10-31T23:00', null],
      ['Narrenwecken', 'GH Domschitz', null, '"Die Krebsler"'],
      ['Christmette', 'Pfarre MP', '2026-12-24T21:00', null],
      ['Christmette', 'Pfarre OP', '2026-12-24T23:00', null],
      ['Silvestermarsch', 'Stadtkapelle OP', null, null],
    ]);
  });
});

describe('gemeinde-registry: Kalenderkarten (oberpullendorf)', () => {
  const entry = {
    name: 'Oberpullendorf', plz: '7350', bundesland: 'burgenland', bezirk: 'Oberpullendorf',
    lat: 47.5, lng: 16.5, strategy: 'generic-dates', status: 'active', eventUrl: URL,
  };
  const events: Ev[] = (new GemeindeRegistryScraper() as any).parsePage(oberpullendorf, entry);

  it('liest Titel ohne Ort, den Ort und das Ende', () => {
    const [halloween] = events.filter(e => e.title === 'Halloween im Garten');
    expect(halloween).toMatchObject({
      start_date: '2026-10-31T16:00:00', end_date: '2026-10-31T23:00', location_name: 'Hauptplatz 10',
    });
  });

  it('behält die source_id aus der Überschrift', () => {
    const [halloween] = events.filter(e => e.title === 'Halloween im Garten');
    expect(halloween).toMatchObject(registryEventId('gen', 'Halloween im Garten | Hauptplatz 10', '2026-10-31T16:00:00'));
    // Alte, gekürzte ID der bestehenden Zeile (gemeinde-registry-source-id.test.ts).
    expect(halloween.previous_source_id).toBe('registry-gen-SGFsbG93ZWVuIGltIEdhcnRl');
  });

  it('liest die künftigen Karten', () => {
    expect(events.map(e => [e.title, e.location_name ?? null, e.end_date ?? null])).toEqual([
      ['Treffpunkt Oberpullendorf', 'Eisenstädterstraße 76', null],
      ['Heilkräuter für die Verdauung Vortrag', 'Apotheke', null],
      ['Halloween im Garten', 'Hauptplatz 10', '2026-10-31T23:00'],
      ['Narrenwecken', 'GH Domschitz', null],
      ['Christmette', 'Pfarre MP', '2026-12-24T21:00'],
      ['Christmette', 'Pfarre OP', '2026-12-24T23:00'],
      ['Silvestermarsch', 'Stadtkapelle OP', null],
    ]);
  });
});
