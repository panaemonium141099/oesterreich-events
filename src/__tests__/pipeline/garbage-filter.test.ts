import { describe, it, expect } from 'vitest';
import { isGarbageTitle } from '@/lib/pipeline/garbage-filter';

// Befund 2026-10-06: der Gemeinde-Parser (vor #275) machte aus Kachel-Teilen
// eigene Events. Diese Titel stehen noch in der DB; der nächtliche Dedup
// unterdrückt alles, was isGarbageTitle erkennt.
describe('isGarbageTitle — Kachel-Teile statt Titel', () => {
  it.each([
    'Mehr Infos',
    'gefundene Veranstaltungen',
    'Suche ab:',
    'Datum der VeranstaltungMi,',
    'Datum der Veranstaltung',
  ])('überall: %s', (title) => {
    expect(isGarbageTitle(title)).toBe(true);
    expect(isGarbageTitle(title, { sourceName: 'Eventim' })).toBe(true);
  });

  it.each(['Mittwoch', ' Sonntag ', 'Heute', 'Morgen', 'Gemeindesaal'])(
    'bei Gemeinde-Aggregatoren: %s',
    (title) => {
      expect(isGarbageTitle(title, { sourceName: 'gemeinden-generic' })).toBe(true);
      expect(isGarbageTitle(title, { sourceName: 'gem2go' })).toBe(true);
    },
  );

  it('ein Stück namens "Montag" bei Eventim ist echt (Dschungel Wien, Feb. 2027)', () => {
    expect(isGarbageTitle('Montag', { sourceName: 'Eventim' })).toBe(false);
    expect(isGarbageTitle('Montag')).toBe(false);
  });

  it.each([
    'Bauernmarkt',
    'Sonntagsbrunch im Gemeindesaal',
    'Heute Abend: Jazz im Keller',
    'Mittwochs-Stammtisch',
    'Biomüll',
  ])('lässt echte Titel durch: %s', (title) => {
    expect(isGarbageTitle(title, { sourceName: 'gemeinden-generic' })).toBe(false);
  });
});

// Prod 2026-10-08: Das Ufo361-Konzert war samt Eventim-Zeile unterdrückt,
// weil „ufo361" nach Abzug der Ziffern nur drei Buchstaben hat. Ein Titel
// ist nur dann Datum/Uhrzeit, wenn außer Zahlen ausschließlich Datumswörter
// übrig bleiben.
describe('isGarbageTitle — Künstlernamen mit Ziffern sind echt', () => {
  it.each(['Ufo361', 'U2', 'Sum 41', 'Pop 2026', 'Ö3', 'Ö3 Wecker', '50 Cent', 'K2', 'Blink-182', 'AC/DC', 'ZZ Top',
    // Zahlen ohne Datums- oder Uhrzeitform: Stücktitel (TAO Dance Theater, Orwell)
    '17 & 18', '1984'])(
    '%s',
    (title) => {
      expect(isGarbageTitle(title)).toBe(false);
      expect(isGarbageTitle(title, { sourceName: 'Eventim' })).toBe(false);
    },
  );

  it.each([
    '15.04.2026 15:00 - 17:00 Uhr',
    'Mi.19:30-21:00Uhr',
    '10:00 Uhr',
    '18:00',
    '15 Okt',
    '15. Oktober 2026',
    'Sa, 24.10.2026 ab 19h',
    '15. und 16.10.',
    'x',
    '--',
    '20260929084918447.pdf',
    'Plakat_Herbstfest.JPG',
  ])('Datum, Uhrzeit, Dateiname oder Zeichenrest bleibt Müll: %s', (title) => {
    expect(isGarbageTitle(title)).toBe(true);
  });
});

// Abschlussprüfung 2026-10-08: Alle Navigationswort-Titel auf Prod kamen
// von Gemeinde-Aggregatoren ohne Ticket-Link. Einziger echter Treffer:
// Eventim „Archive" (Band, Gasometer 2027) mit Link auf genau dieses Event.
describe('isGarbageTitle — Navigationswort mit Event-Link', () => {
  const eventim = 'https://www.eventim.at/event/archive-gasometer-wien-12345678/';
  it('ein Link auf genau dieses Event macht ein Navigationswort zum Namen', () => {
    expect(isGarbageTitle('Archive', { sourceName: 'Eventim', ticketUrl: eventim })).toBe(false);
    expect(isGarbageTitle('Archive', { sourceName: 'Eventim' })).toBe(true);
    expect(isGarbageTitle('Kontakt', { sourceName: 'gemeinden-generic', ticketUrl: 'https://www.tulln.at/' })).toBe(true);
  });

  it('ein Datums-Titel bleibt Müll, auch mit Event-Link (kein Name)', () => {
    expect(isGarbageTitle('Donnerstag, 15.10.2026 , 19:00', { ticketUrl: 'https://www.tulln.at/veranstaltung/4711' })).toBe(true);
  });
});
