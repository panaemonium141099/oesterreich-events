/**
 * DE-Adapter active-City (fn-29.15), Golden-Tests auf echten Listen
 * (abgerufen 2026-10-30, gekürzt auf die Terminliste samt Pager): Lohne
 * (Hintergrundbild, Pager), Stadthagen (Bild-Link vor dem Titel, mehrtägig),
 * Vellmar (ganztägig mit 00:00), Bedburg (Ort ohne Adresse), Barntrup (nur
 * „Nächster Termin“ ohne Uhrzeit: nicht gelesen).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { activeCityCalendarOf, activeCityWhen, parseActiveCityList } from '@/lib/scrapers/de/activecity';
import { ActiveCityDeScraper, activeCityCalendarLinks, activeCityGroups } from '@/lib/scrapers/de/ActiveCityDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'activecity', `${f}.html`), 'utf8');

const KAL = {
  lohne: { ags: '03460006', name: 'Lohne (Oldenburg), Stadt', land: 'niedersachsen', url: 'https://www.lohne.de/Kultur-Freizeit/Veranstaltungen.htm' },
  stadthagen: { ags: '03257035', name: 'Stadthagen, Stadt', land: 'niedersachsen', url: 'https://www.stadthagen.de/Aktuelles/Veranstaltungen.htm/Veranstaltungen' },
  vellmar: { ags: '06633026', name: 'Vellmar, Stadt', land: 'hessen', url: 'https://www.vellmar.de/Veranstaltungskalender.htm' },
  bedburg: { ags: '05362004', name: 'Bedburg, Stadt', land: 'nordrhein-westfalen', url: 'https://www.bedburg.de/Unsere-Stadt/Veranstaltungen.htm' },
  barntrup: { ags: '05766012', name: 'Barntrup, Stadt', land: 'nordrhein-westfalen', url: 'https://www.barntrup.de/Tourismus-Kultur-Freizeit/Veranstaltungskalender.htm' },
} as const;
type Kal = keyof typeof KAL;

const entry = (k: Kal): RegistryEntryDe => ({
  ...KAL[k], host: new URL(KAL[k].url).host.replace(/^www\./, ''), stufe: 'B', integration: 'activecity', checked_at: '2026-10-28',
});
const group = (k: Kal): FeedGroup => ({ feedUrl: KAL[k].url, pageUrl: KAL[k].url, own: [entry(k)], viaVerband: [] });
const page = (k: Kal) => parseActiveCityList(fx(k), KAL[k].url);
const termin = (k: Kal, title: string) => page(k).termine.find(t => t.title === title)!;

// Die Fixtures stammen vom 30.10.2026 und listen Termine an diesem Tag.
// Der Freigabevertrag misst gegen die Uhr (start_in_past); sie steht
// deshalb auf dem Abrufdatum, sonst kippen die Zeilen mit jedem Tag.
beforeAll(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-30T12:00:00Z') }));
afterAll(() => vi.useRealTimers());

type Row = {
  source_id: string; source_url: string; start_date: string; end_date: string | null; publish_status: string; country: string;
  location_name: string | null; postal_code: string | null;
  location_resolution: { gemeinde: { name: string } | null };
};
const rowsCache = new Map<Kal, Row[]>();
// Je Kalender einmal durch den Schreibweg (der Resolver ist teuer).
const rows = (k: Kal): Row[] => {
  if (!rowsCache.has(k)) rowsCache.set(k, new ActiveCityDeScraper().toScrapedAll(page(k).termine, group(k)).map(e => toSupabaseRow(e, new Map(), new Map()).row as unknown as Row));
  return rowsCache.get(k)!;
};

describe('active-City: Liste lesen', () => {
  it('Termin (Lohne): Beginn aus data-sortdate/-sorttime, strukturierter Ort, Bild, Pager', () => {
    const p = page('lohne');
    expect(p.termine).toHaveLength(20);
    expect(p.pages[0]).toBe('https://www.lohne.de/Kultur-Freizeit/Veranstaltungen.htm/Veranstaltungen?event_regions=own&az=all&page=2');
    expect(termin('lohne', 'HotlipsProject')).toMatchObject({
      url: 'https://www.lohne.de/Kultur-Freizeit/Veranstaltungen.htm/Veranstaltungen/HotlipsProject.html',
      slug: 'HotlipsProject', start: '2026-10-30T19:00:00.000Z', allDay: false,
      locationName: 'Kleinkunstbühne "Chaméleon"', street: 'Bahnhofstr. 7', postalCode: '49393', locality: 'Lohne',
      image: 'https://www.lohne.de/city_data/images/6/6/250866/resize_176x176.jpg',
    });
  });

  it('Bild-Link vor dem Titel; mehrtägig bis zum letzten Datum (Stadthagen „Märchenlichter“)', () => {
    expect(page('stadthagen').termine).toHaveLength(20);
    expect(termin('stadthagen', 'Märchenlichter')).toMatchObject({ start: '2026-10-30', end: '2026-10-31', allDay: true });
    expect(termin('stadthagen', 'Wildes Holz')).toMatchObject({ start: '2026-10-30T19:00:00.000Z' });
  });

  it('00:00 heißt ganztägig (Vellmar „Energietag Vellmar“)', () => {
    expect(termin('vellmar', 'Energietag Vellmar')).toMatchObject({ start: '2026-10-30', allDay: true });
  });

  it('nur „Nächster Termin“ ohne data-sortdate wird nicht gelesen (Barntrup)', () => {
    expect(page('barntrup')).toMatchObject({ isList: true, withoutSortdate: 20, termine: [] });
  });

  it('Datum und Uhrzeit', () => {
    expect(activeCityWhen('2027-06-20', '18:00', 'So 20. Juni 2027')).toEqual({ localDate: '2027-06-20', start: '2027-06-20T16:00:00.000Z', allDay: false });
    expect(activeCityWhen('2026-11-04', '19:00', 'Mi 04. November - Fr 04. Dezember 2026')).toMatchObject({ end: '2026-12-04' });
    expect(activeCityWhen(undefined, '19:00', '')).toBeNull();
  });
});

// Der Schreibweg (Resolver, Kontext) braucht je Zeile einige zehn Millisekunden.
describe('active-City: Termin → Zeile', { timeout: 30_000 }, () => {
  it('Gemeinde des Kalenders, Adresse an den Resolver, source_id aus dem Namen der Detailseite (Lohne)', () => {
    const r = rows('lohne').find(x => x.source_url.endsWith('/HotlipsProject.html'))!;
    expect(r).toMatchObject({ source_id: 'activecity-lohne.de-HotlipsProject', postal_code: '49393', country: 'DE', start_date: '2026-10-30T19:00:00.000Z' });
    expect(r.location_resolution.gemeinde?.name).toMatch(/^Lohne/);
    expect(r.publish_status).toMatch(/^published/);
  });

  it('source_ids eines Kalenders sind eindeutig', () => {
    for (const k of ['lohne', 'stadthagen', 'vellmar', 'bedburg'] as Kal[]) {
      const ids = rows(k).map(r => r.source_id);
      expect(new Set(ids).size, k).toBe(ids.length);
    }
  });
});

describe('active-City: Kalender der Registry', () => {
  it('Detailseite zeigt auf ihren Kalender, Kalender-Links derselben Website', () => {
    expect(activeCityCalendarOf('https://www.steinfurt.de/Freizeit-in-Steinfurt-erleben/Veranstaltungen.htm/Veranstaltungen/Offener-Spieletreff.html'))
      .toBe('https://www.steinfurt.de/Freizeit-in-Steinfurt-erleben/Veranstaltungen.htm');
    expect(activeCityCalendarOf('https://www.wiesmoor.de/Veranstaltungen/Lesestunde.html')).toBeNull();
    expect(activeCityCalendarLinks('<a href="/Leben/Veranstaltungen.htm?">V</a><a href="https://anders.de/Veranstaltungen.htm">X</a><a href="/Seiten/Impressum.html">I</a>', 'https://www.wiesmoor.de/Veranstaltungen/Lesestunde.html'))
      .toEqual(['https://www.wiesmoor.de/Leben/Veranstaltungen.htm']);
  });

  it('Gemeinden mit derselben Seite teilen eine Gruppe', () => {
    const b = { ...entry('lohne'), ags: '03460999' };
    expect(activeCityGroups([entry('lohne'), b]).map(g => [g.pageUrl, g.own.length])).toEqual([[KAL.lohne.url, 2]]);
  });
});
