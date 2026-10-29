/**
 * DE-Adapter Hirsch & Wölfl `hwveranstaltung` (fn-29.12), Golden-Tests auf
 * echten Kalenderlisten (abgerufen 2026-10-29, gekürzt auf den Inhaltsbereich
 * `TYPO3SEARCH_begin` bis `_end`): Frickenhausen (ohne Termin-IDs, OSM und
 * Apple-Adresse), Höpfingen (Termin-IDs, Gemeinderatssitzung), Auenwald
 * (Ort mit Adresszeilen, Nachbargemeinde), Bempflingen (Datensatz-ID je
 * Termin), Bühlertann (Müllabfuhr), Gundelfingen (leer), Volkertshausen und
 * Osterburken (ältere Modulversionen).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appleAddress, hwPageUrl, hwWhen, parseHwList } from '@/lib/scrapers/de/hw';
import { HwDeScraper, hwGroups, imageAllowed, parentPath } from '@/lib/scrapers/de/HwDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'hw', `${f}.html`), 'utf8');

const KAL = {
  frickenhausen: { ags: '08116020', name: 'Frickenhausen', url: 'https://www.frickenhausen.de/freizeit-gaeste/veranstaltungskalender' },
  hoepfingen: { ags: '08225039', name: 'Höpfingen', url: 'https://www.hoepfingen.de/tourismus-freizeit/veranstaltungen' },
  auenwald: { ags: '08119006', name: 'Auenwald', url: 'https://www.auenwald.de/kultur-freizeit/veranstaltungen/kalender' },
  bempflingen: { ags: '08116008', name: 'Bempflingen', url: 'https://www.bempflingen.de/freizeit-kultur/veranstaltungskalender' },
  buehlertann: { ags: '08127012', name: 'Bühlertann', url: 'https://www.buehlertann.de/freizeit-tourismus/veranstaltungen' },
} as const;

const entry = (k: keyof typeof KAL): RegistryEntryDe => ({
  ...KAL[k], land: 'baden-wuerttemberg', host: new URL(KAL[k].url).host.replace(/^www\./, ''), stufe: 'B', integration: 'hwext', checked_at: '2026-10-28',
});
const group = (k: keyof typeof KAL): FeedGroup => ({ feedUrl: KAL[k].url, pageUrl: KAL[k].url, own: [entry(k)], viaVerband: [] });
const page = (k: keyof typeof KAL) => parseHwList(fx(k), KAL[k].url);

type Row = {
  source_id: string; source_url: string; start_date: string; end_date: string | null; publish_status: string;
  latitude: number | null; longitude: number | null; coords_precision: string | null; country: string;
  location_resolution: { gemeinde: { name: string } | null; admission?: { reasons: string[] } };
};
const row = (k: keyof typeof KAL, title: string, n = 0) => {
  const t = page(k).termine.filter(x => x.title === title)[n];
  return toSupabaseRow(new HwDeScraper().toScraped(t, group(k)), new Map(), new Map()).row as unknown as Row;
};

describe('hwveranstaltung: Liste lesen', () => {
  it('Frickenhausen: zehn Termine, Pager bis „Letzte Seite" 14', () => {
    const p = page('frickenhausen');
    expect(p).toMatchObject({ isList: true, oldModule: false, lastPage: 14 });
    expect(p.termine).toHaveLength(10);
    expect(hwPageUrl(p.pagerTemplate!, 7)).toBe('https://www.frickenhausen.de/freizeit-gaeste/veranstaltungskalender/seite-7/suche-none');
  });

  it('Dorffest „Kirbe TV Tischardt": 10:00 Uhr Ortszeit, Ort, OSM-Koordinate, Apple-Adresse, Detailseite', () => {
    const e = page('frickenhausen').termine.find(x => x.title === 'Kirbe TV Tischardt')!;
    expect(e).toMatchObject({
      recordId: '715', url: 'https://www.frickenhausen.de/freizeit-gaeste/veranstaltungskalender/715/kirbe-tv-tischardt',
      localDate: '2026-11-08', start: '2026-11-08T09:00:00.000Z', allDay: false,
      organizer: 'Turnverein Tischardt e. V.', locationName: 'Autmuthalle Tischardt', category: 'Feiern & Geselligkeit',
      street: 'Ermsstraße 3', postalCode: '72636', locality: 'Frickenhausen', lat: 48.57372510267607, lng: 9.325552582740784,
    });
    expect(e.terminId).toBeUndefined();
    expect(e.end).toBeUndefined();
  });

  it('„16:00 Uhr bis 20:00 Uhr": Beginn und Ende', () => {
    const e = page('frickenhausen').termine.find(x => x.title === 'Goischder Schnitza')!;
    expect(e).toMatchObject({ start: '2026-10-31T15:00:00.000Z', end: '2026-10-31T19:00:00.000Z' });
  });

  it('ohne Uhrzeit ganztägig, mehrtägig bis zum letzten Tag (Höpfingen „Kerwe", Auenwald „Lebendiger Adventskalender")', () => {
    expect(page('hoepfingen').termine.find(x => x.title === 'Kerwe')).toMatchObject({ allDay: true, start: '2026-11-07', localDate: '2026-11-07' });
    expect(page('auenwald').termine.find(x => x.title === 'Lebendiger Adventskalender')).toMatchObject({ allDay: true, start: '2026-12-01', end: '2026-12-24' });
  });

  it('Termin-IDs: eine Veranstaltung, zwei Termine (Höpfingen „Kerweübung", Bempflingen `record__647-2855`)', () => {
    const k = page('hoepfingen').termine.filter(x => x.recordId === '555');
    expect(k.map(x => [x.terminId, x.localDate, x.allDay])).toEqual([['3388', '2026-11-07', false], ['3389', '2026-11-08', true]]);
    const b = page('bempflingen').termine.filter(x => x.recordId === '647');
    expect(b.map(x => x.terminId)).toEqual(['2855', '2856', '2857']);
  });

  it('Ortsname mit Adresszeilen: nur die erste Zeile ist der Ort (Auenwald)', () => {
    const e = page('auenwald').termine.find(x => x.title === 'Kreuz und quer durchs Kirchenjahr')!;
    expect(e).toMatchObject({ locationName: 'Katholisches Gemeindehaus Ebersberg', street: 'Kirchberg 7', postalCode: '71549', start: '2026-10-29T18:30:00.000Z' });
  });

  it('alte Modulversion ohne Detailseiten wird erkannt und nicht gelesen (Volkertshausen)', () => {
    const p = parseHwList(fx('volkertshausen'), 'https://www.volkertshausen.de/freizeit-tourismus/veranstaltungen');
    expect(p).toMatchObject({ isList: false, oldModule: true, termine: [] });
    // Noch ältere Variante `einzeleintrag kalenderKatIdN` (Osterburken).
    expect(parseHwList(fx('osterburken'), 'https://www.osterburken.de/tourismus-kultur/veranstaltungskalender')).toMatchObject({ isList: false, oldModule: true, termine: [] });
  });

  it('leere Liste ist eine Liste (Gundelfingen „Es sind derzeit keine Einträge vorhanden")', () => {
    expect(parseHwList(fx('gundelfingen'), 'https://www.gundelfingen.de/unsere-gemeinde/aktuelles/veranstaltungskalender')).toMatchObject({ isList: true, oldModule: false, termine: [], lastPage: 1 });
  });
});

describe('hwveranstaltung: Datum, Uhrzeit, Adresse', () => {
  it('Sommerzeit: 18:00 Uhr am 20.06.2027 ist 16:00 UTC', () => {
    expect(hwWhen('20.06.2027', '18:00 Uhr bis 23:30 Uhr')).toEqual({ localDate: '2027-06-20', start: '2027-06-20T16:00:00.000Z', end: '2027-06-20T21:30:00.000Z', allDay: false });
  });

  it('mehrtägig mit Uhrzeit: Ende am letzten Tag; Ende vor Beginn ohne Enddatum bleibt offen', () => {
    expect(hwWhen('07.11.2026 bis 08.11.2026', '10:00 Uhr bis 17:00 Uhr')).toMatchObject({ start: '2026-11-07T09:00:00.000Z', end: '2026-11-08T16:00:00.000Z' });
    expect(hwWhen('31.12.2026', '20:00 Uhr bis 02:00 Uhr')).toEqual({ localDate: '2026-12-31', start: '2026-12-31T19:00:00.000Z', allDay: false });
  });

  it('Apple-Link von rechts: Titel mit Komma, Hausnummer ohne Leerzeichen, leere Adresse', () => {
    expect(appleAddress('Kaffee, Kuchen und Musik,Heidelberger Str.23,74746Höpfingen')).toEqual({ street: 'Heidelberger Str. 23', postalCode: '74746', locality: 'Höpfingen' });
    expect(appleAddress('6. Linsenhöfer Genussmarkt,Steinachstraße,72636Linsenhofen')).toEqual({ street: 'Steinachstraße', postalCode: '72636', locality: 'Linsenhofen' });
    expect(appleAddress('Seniorenfeier,,')).toEqual({});
  });
});

describe('hwveranstaltung: Termin → Zeile', () => {
  it('Dorffest der eigenen Gemeinde: Gemeinde, Ort am Platz, Detailseite, source_id aus Datensatz und Tag', () => {
    const r = row('frickenhausen', 'Kirbe TV Tischardt');
    expect(r).toMatchObject({
      source_id: 'hw-www.frickenhausen.de-715-2026-11-08', source_url: 'https://www.frickenhausen.de/freizeit-gaeste/veranstaltungskalender/715/kirbe-tv-tischardt',
      start_date: '2026-11-08T09:00:00.000Z', country: 'DE', latitude: 48.57372510267607, longitude: 9.325552582740784,
    });
    expect(r.location_resolution.gemeinde?.name).toBe('Frickenhausen');
    expect(r.publish_status).toMatch(/^published/);
  });

  it('source_id mit Termin-ID, je Termin verschieden', () => {
    expect(row('hoepfingen', 'Kerweübung und Kerwenachmittag', 0).source_id).toBe('hw-www.hoepfingen.de-555-t3388');
    expect(row('hoepfingen', 'Kerweübung und Kerwenachmittag', 1).source_id).toBe('hw-www.hoepfingen.de-555-t3389');
  });

  it('ohne Ortsangabe: Gemeinde des Kalenders (Höpfingen „Volkstrauertag")', () => {
    expect(row('hoepfingen', 'Volkstrauertag').location_resolution.gemeinde?.name).toBe('Höpfingen');
  });

  it('Adresse in der Nachbargemeinde gilt (Auenwald „Kirchweihfest", Uhlandstraße 15, 71566 Althütte)', () => {
    expect(row('auenwald', 'Kirchweihfest').location_resolution.gemeinde?.name).toBe('Althütte');
  });

  it('Müllabfuhr: Quarantäne municipal_service (Bühlertann „Müllabfuhr: Rest- und Biomüll, Gelber Sack")', () => {
    const r = row('buehlertann', 'Müllabfuhr: Rest- und Biomüll, Gelber Sack');
    expect(r.location_resolution.admission?.reasons).toContain('municipal_service');
    expect(r.publish_status).not.toMatch(/^published/);
  });
});

describe('hwveranstaltung: Kalender der Registry', () => {
  it('eine Seite je Kalender, gemeinsamer Kalender über die Verwaltungsgemeinschaft', () => {
    const vg: RegistryEntryDe = {
      ags: '09671152', name: 'Schöllkrippen, M', land: 'bayern', host: 'schoellkrippen.de', stufe: 'V', integration: 'leer', url: 'https://www.schoellkrippen.de/', checked_at: '2026-10-28',
      fallback: { kind: 'verband', host: 'vg-schoellkrippen.de', integration: 'hwext', url: 'https://www.vg-schoellkrippen.de/freizeit-tourismus/veranstaltungskalender' },
    };
    const gs = hwGroups([entry('frickenhausen'), { ...entry('hoepfingen'), url: null }, vg]);
    expect(gs.map(g => [g.pageUrl, g.own.length, g.viaVerband.length])).toEqual([
      ['https://www.frickenhausen.de/freizeit-gaeste/veranstaltungskalender', 1, 0],
      ['https://www.vg-schoellkrippen.de/freizeit-tourismus/veranstaltungskalender', 0, 1],
    ]);
  });

  it('Seite unter dem Kalender: eine Ebene höher', () => {
    expect(parentPath('https://www.grafenhausen.de/freizeit-erlebnis/veranstaltungen/dorffest')).toBe('https://www.grafenhausen.de/freizeit-erlebnis/veranstaltungen');
    expect(parentPath('https://www.steinenbronn.de/startseite')).toBeNull();
  });
});

describe('hwveranstaltung: Bilder und robots.txt', () => {
  // robots.txt der Kunden (Ammerbuch, 2026-10-29, Auszug).
  const robots = 'User-agent: *
Disallow: /*.png$
Disallow: /*.jpg$
Disallow: /*.jpeg$
Disallow: /fileadmin/Dateien/
Disallow: /fileadmin/_processed_/
';
  it('gesperrte Bildendung auch in Großbuchstaben, Pfad unter /fileadmin/Dateien/', () => {
    expect(imageAllowed(robots, 'https://www.ammerbuch.de/fileadmin/Kalenderbilder/Zehntscheuer_Reusten/Kino.JPG')).toBe(false);
    expect(imageAllowed(robots, 'https://www.frickenhausen.de/fileadmin/Dateien/Gemeinde_Frickenhausen/Bilder/News/kalender-678x381.webp')).toBe(false);
    expect(imageAllowed(robots, 'https://www.klettgau.de/index.php?eID=dumpFile&t=p&p=946666')).toBe(true);
  });
});
