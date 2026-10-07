// src/__tests__/pipeline/dedup-evidence.test.ts

import { describe, it, expect } from 'vitest';
import { titleRelation, timeRelation, placeRelation, viennaDayOf, viennaDayBoundsUtc, isPlausibleEventDay } from '@/lib/pipeline/dedup-evidence';
import type { EventRow } from '@/lib/pipeline/types';

const e = (o: Partial<EventRow>): EventRow => ({ id: 'x', title: '', start_date: '2026-10-07T17:30:00Z', ...o }) as EventRow;

describe('titleRelation', () => {
  const rel = (a: string, b: string) => titleRelation(e({ title: a }), e({ title: b }));

  it('Satzzeichen, Groß/Klein, Umlaut-Schreibweise und HTML-Entities sind egal', () => {
    expect(rel('Fehringer´s Kalte Küche', 'FEHRINGER S KALTE KUECHE')).toBe('equal');
    expect(rel('Die große Weihnachtsgala', 'Die grosse Weihnachtsgala')).toBe('equal');
    expect(rel('Oysterband &amp; Friends', 'Oysterband & Friends')).toBe('equal');
    expect(rel('Gery Seidl - NIX is NIE', 'Gery Seidl- NIX is NIE')).toBe('equal');
  });

  it('Länderkürzel in Klammern und Jahreszahlen zählen nicht', () => {
    expect(rel('Fehringer´s Kalte Küche (A)', 'Fehringer´s Kalte Küche')).toBe('equal');
    expect(rel('ARLO PARKS (uk)', 'Arlo Parks')).toBe('equal');
    expect(rel('Masters of Dirt 2027', 'Masters of Dirt')).toBe('equal');
  });

  it('Tippfehler sind „near", andere Nummern nicht', () => {
    expect(rel('Vortrag - Die zweite Lebenshälfte mit Freude meistern', 'Vortrag - Die zweite Lebenshälte mit Freude meistern')).toBe('near');
    expect(rel('FC Red Bull Salzburg - SC Austria Lustenau', 'FC Red Bull Salzburg vs. SC Austria Lustenau')).toBe('near');
    expect(rel('UDC Highlanders 1 - Darts', 'UDC Highlanders 2 - Darts')).toBe('different');
  });

  it('Kursstufen sind keine Tippfehler (Probelauf 2026-10-07)', () => {
    expect(rel('MelodyKids Midi - Musikalische Frühförderung', 'MelodyKids Midi2 - Musikalische Frühförderung')).toBe('different');
    expect(rel('MelodyKids Mini - Musikalische Frühförderung', 'MelodyKids Midi - Musikalische Frühförderung')).toBe('different');
    expect(rel('Anzahl der Folgetermine2 weitere Termine', 'Anzahl der Folgetermine5 weitere Termine')).toBe('different');
  });

  it('Titel mit Untertitel oder Tourname enthält den Kurztitel', () => {
    expect(rel('Fehringer´s Kalte Küche', 'Fehringer´s Kalte Küche - Griaßkoch und Kaviar / Album Release')).toBe('contains');
    expect(rel('Marten', 'Marten Immer Leben Tour')).toBe('contains');
    expect(rel('Sooshi Mango: Home made to the World', 'Sooshi Mango - The Home Made World Tour')).toBe('contains');
  });

  it('an den Titel geklebter Kategorie-Text der Quelle: enthalten', () => {
    expect(rel('Tanzabend am Dorfplatz', 'Tanzabend am DorfplatzMusik, Konzerte')).toBe('contains');
  });

  it('Akronyme mit Punkten bleiben ein Wort („K.O.", „K.U.L.T.")', () => {
    expect(rel('KI UND K.O.', '"KI und K.O." - Theater in Steeg')).toBe('contains');
    expect(rel('KI UND K.O.', 'KI und Kabarett')).toBe('different');
  });

  it('gemeinsamer Hauptteil vor dem Trennzeichen: nur verwandt', () => {
    expect(rel('Sarah Bosetti - Worte gegen den Weltuntergang', 'Sarah Bosetti - Make Democracy Great Again!')).toBe('related');
  });

  it('verschiedene Kurse und Vereine sind verschieden', () => {
    expect(rel('Naturfotografie für Fortgeschrittene Landseer Berge', 'Naturfotografie für Einsteiger im Naturpark Landseer Berge')).toBe('different');
    expect(rel('Punschstand der FF Gleißenfeld', 'Punschstand der JK/LJ Thernberg')).toBe('different');
  });
});

describe('timeRelation', () => {
  const rel = (a: string, b: string) => timeRelation(e({ start_date: a }), e({ start_date: b }));
  it('echte Uhrzeiten', () => {
    expect(rel('2026-10-07T17:30:00Z', '2026-10-07T17:40:00Z')).toBe('exact');
    expect(rel('2026-10-07T17:30:00Z', '2026-10-07T18:00:00Z')).toBe('near');
    expect(rel('2026-10-07T17:30:00Z', '2026-10-07T19:00:00Z')).toBe('far');
    expect(rel('2026-10-07T12:00:00Z', '2026-10-07T17:30:00Z')).toBe('conflict');
  });
  it('Platzhalter (00:00Z und Wien-Mitternacht) sind unbekannt', () => {
    expect(rel('2026-10-07T00:00:00Z', '2026-10-07T17:30:00Z')).toBe('unknown');
    expect(rel('2026-10-06T22:00:00Z', '2026-10-07T17:30:00Z')).toBe('unknown');
  });
  it('Datum als Uhrzeit gelesen (15.10. → 15:10) ist keine echte Uhrzeit', () => {
    expect(rel('2026-10-15T15:10:00Z', '2026-10-15T16:00:00Z')).toBe('unknown');
    expect(rel('2026-08-01T01:08:00Z', '2026-08-01T18:00:00Z')).toBe('unknown');
    expect(rel('2026-10-15T13:10:00Z', '2026-10-15T16:00:00Z')).toBe('unknown'); // 15:10 Wiener Zeit
  });
});

describe('viennaDayOf', () => {
  it('liefert den Wiener Kalendertag', () => {
    expect(viennaDayOf(e({ start_date: '2026-10-06T22:00:00Z' }))).toBe('2026-10-07');
    expect(viennaDayOf(e({ start_date: '2026-10-07T21:30:00Z' }))).toBe('2026-10-07');
    expect(viennaDayOf(e({ start_date: '2026-10-07T22:30:00Z' }))).toBe('2026-10-08');
  });
});

describe('isPlausibleEventDay', () => {
  it('Jahr 1 oder 2919 sind Quellfehler, keine Dedup-Tage', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    expect(isPlausibleEventDay('2026-10-07', now)).toBe(true);
    expect(isPlausibleEventDay('2015-03-01', now)).toBe(true);
    expect(isPlausibleEventDay('2031-12-31', now)).toBe(true);
    expect(isPlausibleEventDay('0001-01-01', now)).toBe(false);
    expect(isPlausibleEventDay('1980-01-01', now)).toBe(false);
    expect(isPlausibleEventDay('2919-12-07', now)).toBe(false);
  });
});

describe('viennaDayBoundsUtc', () => {
  it('Wiener Mitternacht bis Mitternacht als UTC-Grenzen, auch an Umstellungstagen', () => {
    expect(viennaDayBoundsUtc('2026-10-07')).toEqual(['2026-10-06T22:00:00.000Z', '2026-10-07T22:00:00.000Z']);
    expect(viennaDayBoundsUtc('2026-10-25')).toEqual(['2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z']);
    expect(viennaDayBoundsUtc('2026-03-29')).toEqual(['2026-03-28T23:00:00.000Z', '2026-03-29T22:00:00.000Z']);
    expect(viennaDayBoundsUtc('2026-12-31')).toEqual(['2026-12-30T23:00:00.000Z', '2026-12-31T23:00:00.000Z']);
  });

  it('kaputte Quelldaten (Jahr 1, Jahr 2919) bringen den Lauf nicht zum Absturz', () => {
    const day1 = viennaDayOf(e({ start_date: '0001-01-01T00:00:00+00:00' }))!;
    expect(day1).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const [from, to] = viennaDayBoundsUtc(day1);
    expect(new Date(from).getTime()).toBeLessThanOrEqual(new Date('0001-01-01T00:00:00Z').getTime());
    expect(new Date(to).getTime()).toBeGreaterThan(new Date('0001-01-01T00:00:00Z').getTime());
    const day2919 = viennaDayOf(e({ start_date: '2919-12-07T18:30:00+00:00' }))!;
    expect(viennaDayBoundsUtc(day2919)).toEqual(['2919-12-06T23:00:00.000Z', '2919-12-07T23:00:00.000Z']);
  });
});

describe('placeRelation', () => {
  const at = (o: Partial<EventRow>) => e({ location_precision: 'building', ...o } as Partial<EventRow>);

  it('Pins unter 250 m: selber Ort, auch bei anders geschriebenem Venue', () => {
    expect(placeRelation(
      at({ location_name: 'Gasometer / Planet.tt', latitude: 48.1852, longitude: 16.4180 }),
      at({ location_name: 'Raiffeisen Halle im Gasometer', latitude: 48.1856, longitude: 16.4183 }),
    )).toBe('same');
  });

  it('Venue-Name enthält den anderen: selber Ort, auch ohne genauen Pin', () => {
    expect(placeRelation(
      e({ location_name: 'Sargfabrik', postal_code: '1140' }),
      e({ location_name: 'Sargfabrik - Verein für integrative Lebensgestaltung', postal_code: '1140' }),
    )).toBe('same');
    expect(placeRelation(e({ location_name: 'STADTSAAL', postal_code: '1150' }), e({ location_name: 'STADTSAAL Wien', postal_code: '1150' }))).toBe('same');
    expect(placeRelation(e({ location_name: 'Simm City Festsaal', postal_code: '1110' }), e({ location_name: 'SiMMCity', postal_code: '1110' }))).toBe('same');
  });

  it('Ortsname statt Venue („Österreich", „Linz") ist kein Widerspruch', () => {
    expect(placeRelation(
      at({ location_name: 'Österreich', postal_code: '1140', latitude: 48.1952213, longitude: 16.3046408 }),
      at({ location_name: 'Sargfabrik', postal_code: '1140', latitude: 48.1952213, longitude: 16.3046408 }),
    )).toBe('same');
    expect(placeRelation(
      e({ location_name: 'Linz', postal_code: '4020', latitude: 48.3058, longitude: 14.2848, location_precision: 'municipality' } as Partial<EventRow>),
      at({ location_name: 'Musiktheater Linz', postal_code: '4020', latitude: 48.2948, longitude: 14.2931 }),
    )).toBe('town');
  });

  it('klar verschiedene Venues widersprechen sich', () => {
    expect(placeRelation(e({ location_name: 'Pfarrkirche St. Martin', postal_code: '7000' }), e({ location_name: 'Pfarrkirche St. Georg', postal_code: '7000' }))).toBe('conflict');
    expect(placeRelation(e({ location_name: 'Hauptplatz Eisenstadt' }), e({ location_name: 'Dorfplatz Rust' }))).toBe('conflict');
  });

  it('Alt-Koordinaten ohne Präzisionsangabe widersprechen gleicher PLZ nicht (Normalizer-Altlast)', () => {
    expect(placeRelation(
      e({ location_name: 'Walding', postal_code: '4111', latitude: 48.35, longitude: 14.16 }),
      e({ location_name: 'Walding', postal_code: '4111', latitude: 47.07, longitude: 15.43, location_precision: 'municipality' } as Partial<EventRow>),
    )).toBe('town');
  });

  it('Akronym-Venue, Bezirks-Etikett und Venue-Tippfehler sind kein Widerspruch', () => {
    expect(placeRelation(e({ location_name: 'K.U.L.T.', postal_code: '4632' }), e({ location_name: 'K.U.L.T., Brunnfeldstraße 1', postal_code: '4632' }))).toBe('same');
    expect(placeRelation(e({ location_name: 'Politischer Bezirk Tulln', postal_code: '3430' }), e({ location_name: 'Danubium Tulln', postal_code: '3430' }))).not.toBe('conflict');
    expect(placeRelation(e({ location_name: 'Madonnenschlössel', postal_code: '7434' }), e({ location_name: 'Madonnenschlössl', postal_code: '7434' }))).toBe('same');
  });

  it('genaue Pins 1–5 km auseinander in derselben PLZ: gleiche Gemeinde, kein Widerspruch (ein Pin liegt daneben)', () => {
    expect(placeRelation(
      at({ location_name: 'Steyr', postal_code: '4400', latitude: 48.0303, longitude: 14.4123 }),
      at({ location_name: 'Altes Theater Steyr', postal_code: '4400', latitude: 48.0402, longitude: 14.4184 }),
    )).toBe('town');
    expect(placeRelation(
      at({ location_name: 'POSTHOF - Zeitkultur am Hafen', postal_code: '4020', latitude: 48.2850, longitude: 14.2900 }),
      at({ location_name: 'Posthof', postal_code: '4020', latitude: 48.3118, longitude: 14.3116 }),
    )).toBe('same');
  });

  it('verschiedene Venue-Datensätze am selben Pin sind derselbe Ort', () => {
    expect(placeRelation(
      at({ venue_id: 'v1', location_name: 'Dom im Berg', latitude: 47.0712, longitude: 15.4380 }),
      at({ venue_id: 'v2', location_name: 'Dom im Berg', latitude: 47.0713, longitude: 15.4381 }),
    )).toBe('same');
  });

  it('genaue Pins über 1 km auseinander widersprechen sich', () => {
    expect(placeRelation(at({ latitude: 48.2, longitude: 16.3 }), at({ latitude: 48.22, longitude: 16.3 }))).toBe('conflict');
  });
});
