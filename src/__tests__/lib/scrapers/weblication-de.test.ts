/**
 * DE-Adapter Weblication (fn-29.15), Golden-Tests auf echten Listen des
 * Listenobjekts „eventMulti" (abgerufen 2026-10-30, gekürzt auf die Liste
 * samt Pager): Laer (Titelzeile, Monat ausgeschrieben, Ende 23:59),
 * Schlangen (Serienlinks mit `from`/`to`, mehrtägig ganztägig, Pager),
 * Borchen (Ort, Serien), Neunkirchen (Kacheln, Monat abgekürzt), Lorsch
 * (Pager `?pageIdd69d4944=N`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseWeblicationList, weblicationCalendarOf, weblicationWhen, weblicationWhenFromLink } from '@/lib/scrapers/de/weblication';
import { WeblicationDeScraper, weblicationGroups } from '@/lib/scrapers/de/WeblicationDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'weblication', `${f}.html`), 'utf8');

const KAL = {
  laer: { ags: '05566036', name: 'Laer', land: 'nordrhein-westfalen', url: 'https://www.laer.de/de/veranstaltungen/' },
  schlangen: { ags: '05766064', name: 'Schlangen', land: 'nordrhein-westfalen', url: 'http://www.gemeinde-schlangen.de/gemeinde/aktuelles/veranstaltungen.php' },
  borchen: { ags: '05774012', name: 'Borchen', land: 'nordrhein-westfalen', url: 'https://www.borchen.de/de/veranstaltungen/' },
  'neunkirchen-baden': { ags: '08225068', name: 'Neunkirchen', land: 'baden-wuerttemberg', url: 'https://www.neunkirchen-baden.de/de/veranstaltungskalender/' },
  lorsch: { ags: '06431016', name: 'Lorsch, Karolingerstadt', land: 'hessen', url: 'https://lorsch.de/de/veranstaltungen/' },
} as const;
type Kal = keyof typeof KAL;

const entry = (k: Kal): RegistryEntryDe => ({
  ...KAL[k], host: new URL(KAL[k].url).host.replace(/^www\./, ''), stufe: 'B', integration: 'weblication', checked_at: '2026-10-28',
});
const group = (k: Kal): FeedGroup => ({ feedUrl: KAL[k].url, pageUrl: KAL[k].url, own: [entry(k)], viaVerband: [] });
const page = (k: Kal) => parseWeblicationList(fx(k), KAL[k].url);
const termin = (k: Kal, title: string, n = 0) => page(k).termine.filter(t => t.title === title)[n];

type Row = {
  source_id: string; source_url: string; start_date: string; end_date: string | null; publish_status: string; country: string;
  location_name: string | null; location_resolution: { gemeinde: { name: string } | null; admission?: { reasons: string[] } };
};
const rows = (k: Kal) => new WeblicationDeScraper().toScrapedAll(page(k).termine, group(k))
  .map(e => toSupabaseRow(e, new Map(), new Map()).row as unknown as Row);

describe('Weblication: Liste lesen', () => {
  it('Titelzeile (Laer): zehn Termine, Detailseite, Beginn in Ortszeit, Ende 23:59 heißt offen', () => {
    const p = page('laer');
    expect(p).toMatchObject({ isList: true, pages: [] });
    expect(p.termine).toHaveLength(10);
    expect(termin('laer', 'MÜNSTERLAND-KRIMI am Kaminfeuer')).toMatchObject({
      url: 'https://www.laer.de/de/veranstaltungen/termine/MUeNSTERLAND-KRIMI-am-Kaminfeuer.php',
      start: '2026-11-06T18:00:00.000Z', allDay: false,
    });
    expect(termin('laer', 'MÜNSTERLAND-KRIMI am Kaminfeuer').end).toBeUndefined();
  });

  it('Serienlink mit from/to geht vor dem Text (Borchen „Spaziertreff am Mittwoch in Kirchborchen"), Ort', () => {
    expect(termin('borchen', 'Spaziertreff am Mittwoch in Kirchborchen')).toMatchObject({
      splitId: '24', localDate: '2026-11-04', start: '2026-11-04T14:00:00.000Z', end: '2026-11-04T15:30:00.000Z', locationName: 'Rathaus Borchen',
    });
  });

  it('mehrtägig ganztägig: „Fr, 30.10.2026 - Sa, 31.10.2026" (Schlangen „Schlänger Markt 2026", to 00:00)', () => {
    expect(termin('schlangen', 'Schlänger Markt 2026')).toMatchObject({ start: '2026-10-30', end: '2026-10-31', allDay: true });
  });

  it('Kacheln mit abgekürztem Monat und „Ort:"-Zeile (Neunkirchen „Luthermahl")', () => {
    expect(termin('neunkirchen-baden', 'Luthermahl')).toMatchObject({ start: '2026-10-31T17:00:00.000Z', locationName: 'Aglasterhausen' });
  });

  it('Eintrag mit Link auf ein anderes System: Quelle ist die Liste (Gütersloh „Sitzung des Rates")', () => {
    const html = '<ul><li class="listEntry listEntryObject-eventMulti"><h3 class="listEntryTitle"><a href="https://ratsinfo.guetersloh.de/tops/">Sitzung des Rates</a></h3>'
      + '<div class="listEntryDate">Do, 21.10.2027, 17:00 Uhr</div></li></ul>';
    expect(parseWeblicationList(html, 'https://www.guetersloh.de/de/veranstaltungen/?pageId1=3').termine[0]).toMatchObject({
      url: 'https://www.guetersloh.de/de/veranstaltungen/', path: '/de/veranstaltungen/', start: '2027-10-21T15:00:00.000Z',
    });
  });

  it('Pager: Folgeseiten der Liste, ohne Anker', () => {
    expect(page('lorsch').pages.slice(0, 2)).toEqual(['https://lorsch.de/de/veranstaltungen/?pageIdd69d4944=2', 'https://lorsch.de/de/veranstaltungen/?pageIdd69d4944=3']);
    expect(page('neunkirchen-baden').pages).toEqual(['https://www.neunkirchen-baden.de/de/veranstaltungskalender/?pageId=2']);
  });
});

describe('Weblication: Datum und Uhrzeit', () => {
  it('Formen der Datumszeile', () => {
    expect(weblicationWhen('Mi., 04.11.2026, 15:00 Uhr - 16:30 Uhr')).toEqual({ localDate: '2026-11-04', start: '2026-11-04T14:00:00.000Z', end: '2026-11-04T15:30:00.000Z', allDay: false });
    expect(weblicationWhen('Fr., 06. November 2026, 19:00 Uhr')).toMatchObject({ start: '2026-11-06T18:00:00.000Z' });
    expect(weblicationWhen('Sa, 31. Okt 2026, 17:00 Uhr')).toMatchObject({ start: '2026-10-31T16:00:00.000Z' });
    expect(weblicationWhen('27.03.2027')).toEqual({ localDate: '2027-03-27', start: '2027-03-27', allDay: true });
    expect(weblicationWhen('Sa, 31. Okt 2026 - So, 1. Nov 2026')).toEqual({ localDate: '2026-10-31', start: '2026-10-31', end: '2026-11-01', allDay: true });
    expect(weblicationWhen('Sa, 26.09.2026, 19:00 Uhr - So, 03.01.2027, 23:00 Uhr')).toMatchObject({ end: '2027-01-03T22:00:00.000Z' });
  });

  it('Sommerzeit: 18:00 Uhr am 20.06.2027 ist 16:00 UTC', () => {
    expect(weblicationWhen('So, 20.06.2027, 18:00 Uhr')).toMatchObject({ start: '2027-06-20T16:00:00.000Z' });
  });

  it('„00:00 Uhr" ohne Ende ist ganztägig; Ende vor Beginn bleibt offen', () => {
    expect(weblicationWhenFromLink('https://x.de/termine/a.php?splitId=19&from=2026-11-02%2000:00:00&to=2026-11-02%2000:00:00')).toEqual({ localDate: '2026-11-02', start: '2026-11-02', allDay: true });
    expect(weblicationWhen('Do, 31.12.2026, 20:00 Uhr - 02:00 Uhr')).toEqual({ localDate: '2026-12-31', start: '2026-12-31T19:00:00.000Z', allDay: false });
  });
});

describe('Weblication: Termin → Zeile', () => {
  it('Gemeinde des Kalenders, source_id aus dem Pfad, bei Serien mit dem Tag', () => {
    const r = rows('borchen').find(x => x.source_url.includes('Spaziertreff-am-Mittwoch-in-Kirchborchen'))!;
    expect(r).toMatchObject({
      source_id: 'weblication-borchen.de-de-veranstaltungen-termine-Spaziertreff-am-Mittwoch-in-Kirchborchen-2026-11-04',
      source_url: 'https://www.borchen.de/de/veranstaltungen/termine/Spaziertreff-am-Mittwoch-in-Kirchborchen.php?splitId=24&from=2026-11-04%2015:00:00&to=2026-11-04%2016:30:00',
      country: 'DE', location_name: 'Rathaus Borchen',
    });
    expect(r.location_resolution.gemeinde?.name).toBe('Borchen');
    expect(r.publish_status).toMatch(/^published/);
  });

  it('source_ids eines Kalenders sind eindeutig', () => {
    for (const k of Object.keys(KAL) as Kal[]) {
      const ids = rows(k).map(r => r.source_id);
      expect(new Set(ids).size, k).toBe(ids.length);
    }
  });
});

describe('Weblication: Kalender der Registry', () => {
  it('Registry-Seite eines Einzeltermins zeigt auf ihren Kalender', () => {
    expect(weblicationCalendarOf('https://www.beverungen.de/de/veranstaltungen/termine/Die-Raeuber.php')).toBe('https://www.beverungen.de/de/veranstaltungen/');
    expect(weblicationCalendarOf('https://www.laer.de/de/veranstaltungen/')).toBeNull();
  });

  it('Gemeinden mit demselben Kalender teilen eine Gruppe', () => {
    const a = { ...entry('laer'), url: 'https://www.laer.de/de/veranstaltungen/termine/MUeNSTERLAND-KRIMI-am-Kaminfeuer.php' };
    const b = { ...entry('borchen'), ags: '05774099', name: 'Test', url: 'https://www.laer.de/de/veranstaltungen/' };
    expect(weblicationGroups([a, b]).map(g => [g.pageUrl, g.own.length])).toEqual([['https://www.laer.de/de/veranstaltungen/', 2]]);
  });
});
