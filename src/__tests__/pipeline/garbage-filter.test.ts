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
