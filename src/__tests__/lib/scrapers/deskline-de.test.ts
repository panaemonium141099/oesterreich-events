/**
 * DE-Adapter Feratel Deskline (fn-29 Rest-Adapter), Golden-Tests auf echten
 * Antworten (abgerufen 2026-11-07): Zeller Land (DW5-Widget „ZELL",
 * Linkkey `rptzell`), WebAPI-Liste `moselneu` (Mosel: ohne Uhrzeit, Serie,
 * Einzeltermin mit Dauer).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanDesklineTitle, desklineEmbeds, desklineEventsUrl, linkKeyFromTagcontext, parseDesklinePage, tagcontextUrl } from '@/lib/scrapers/de/deskline';
import { DesklineDeScraper } from '@/lib/scrapers/de/DesklineDeScraper';
import { seitenGruppen } from '@/lib/scrapers/de/seiten-gruppen';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

beforeAll(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-07T12:00:00Z') }));
afterAll(() => vi.useRealTimers());

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'deskline', f), 'utf8');

describe('Deskline: Widget und Linkkey', () => {
  it('DW5-Start-Script auf der Gemeindeseite, Anmeldung des Vermieters ist kein Widget', () => {
    expect(desklineEmbeds(fx('zellerland.html'))).toEqual([{ owner: 'zell', guid: 'f9f5f635-0c82-4d43-a1c0-d7afbb196cf9' }]);
    expect(desklineEmbeds('<a href="https://webclient4.deskline.net/RPT/de/Login">Login</a>')).toEqual([]);
    expect(desklineEmbeds('<iframe src="https://web5.deskline.net/NORDEIFEL/ea3630fb-f823-4d95-8828-8be2ad2c55c1/de#/veranstaltungen">')).toEqual([
      { owner: 'nordeifel', guid: 'ea3630fb-f823-4d95-8828-8be2ad2c55c1' },
    ]);
  });

  it('Linkkey steht im Tag-Kontext, nicht auf der Seite (ZELL → rptzell)', () => {
    const e = desklineEmbeds(fx('zellerland.html'))[0];
    expect(tagcontextUrl(e)).toBe('https://resc.deskline.net/DW5/tags/zell/f9f5f635-0c82-4d43-a1c0-d7afbb196cf9/tagcontext.js');
    expect(linkKeyFromTagcontext(fx('tagcontext-zell.js'))).toBe('rptzell');
    expect(linkKeyFromTagcontext('var x = {};')).toBeNull();
    expect(desklineEventsUrl('rptzell', 2)).toContain('https://webapi.deskline.net/rptzell/de/events?fields=id,dbCode,name,date,');
    expect(desklineEventsUrl('rptzell', 2)).toContain('&pageNo=2&pageSize=400');
  });
});

describe('Deskline: Liste lesen', () => {
  const page = parseDesklinePage(fx('moselneu.json'));

  it('Seitenzahl und Gesamtzahl', () => {
    expect(page.pageCount).toBe(5);
    expect(page.total).toBe(1942);
    expect(page.events).toHaveLength(4);
  });

  it('00:00 ohne Dauer ist ohne Uhrzeit', () => {
    const e = page.events.find(x => x.title.startsWith('Zeichenkünstler'))!;
    expect(e).toMatchObject({ allDay: true, start: '2026-11-07', localDate: '2026-11-07', locationName: 'Stadtmuseum Simeonstift', locality: 'Trier', country: 'DE' });
    expect(e.end).toBeUndefined();
  });

  it('Wandzeit als deutsche Ortszeit, Ende aus der Dauer, Serie markiert', () => {
    const e = page.events.find(x => x.title.startsWith('Kinoevent'))!;
    expect(e.start).toBe('2026-11-07T16:45:00.000Z');
    expect(e.end).toBe('2026-11-07T18:35:00.000Z');
    expect(e.hasMoreDates).toBe(false);
    expect(page.events.find(x => x.title.startsWith('Altstadtführung'))!.hasMoreDates).toBe(true);
  });

  it('Koordinaten, Bild mit Nachweis, Kategorie aus dem Kriterienbaum', () => {
    const e = page.events.find(x => x.title.startsWith('Kinoevent'))!;
    expect(e.lat).toBeCloseTo(49.98, 1);
    expect(e.lng).toBeCloseTo(6.89, 1);
    for (const x of page.events) if (x.image) expect(x.image).toMatch(/^https:\/\/resc\.deskline\.net\//);
    expect(page.events.every(x => x.category || !x.categoryLocked)).toBe(true);
  });

  it('Kalender-Beiwerk im Titel', () => {
    expect(cleanDesklineTitle('8.4.2026Mi.16:00-18:00UhrKids Soul mit Sofie')).toBe('Kids Soul mit Sofie');
    expect(cleanDesklineTitle('Fronleichnam')).toBe('Fronleichnam');
  });
});

describe('Deskline: Termin → Zeile', () => {
  const entry = (o: Partial<RegistryEntryDe>): RegistryEntryDe => ({
    ags: '07135092', name: 'Zell (Mosel), Stadt', land: 'rheinland-pfalz', host: 'stadt-zell-mosel.de', stufe: 'C', integration: 'deskline', url: 'https://stadt-zell-mosel.de/erlebnisse/veranstaltungen', checked_at: '2026-10-28', ...o,
  });
  const g: FeedGroup = { feedUrl: 'https://stadt-zell-mosel.de/erlebnisse/veranstaltungen', pageUrl: 'https://stadt-zell-mosel.de/erlebnisse/veranstaltungen', own: [entry({})], viaVerband: [] };

  it('Quelle ist die Kalenderseite, Ort aus town, Gemeinde aus PLZ-Referenz', () => {
    const scraper = new DesklineDeScraper();
    const e = parseDesklinePage(fx('moselneu.json')).events.find(x => x.title.startsWith('Kinoevent'))!;
    const s = scraper.toScraped(e, g);
    expect(s).toMatchObject({ source_id: `deskline-${e.uid}`, source_url: g.pageUrl, country: 'DE', city: 'Wittlich', coords_precision: 'venue' });
    // Der Linkkey liefert die Region: Wittlich bekommt weder PLZ noch Mittelpunkt von Zell.
    expect(s.postal_code).toBeUndefined();
    expect(s.latitude).toBeCloseTo(49.98, 1);
    const row = toSupabaseRow(s, new Map(), new Map()).row as unknown as { location_resolution: { gemeinde: { name: string } | null }; country: string };
    expect(row.country).toBe('DE');
    expect(row.location_resolution.gemeinde?.name).toMatch(/^Wittlich/);
  });

  it('Termin in der Gemeinde der Seite: Kontext der Gemeinde (PLZ) bleibt', () => {
    const e = parseDesklinePage(fx('moselneu.json')).events.find(x => x.locality === 'Zell')!;
    const s = new DesklineDeScraper().toScraped(e, g);
    expect(s).toMatchObject({ city: 'Zell', postal_code: '56856', coords_precision: 'venue' });
  });

  it('ohne Koordinaten in einem anderen Ort: kein Mittelpunkt der Seiten-Gemeinde', () => {
    const e = parseDesklinePage(fx('moselneu.json')).events.find(x => x.title.startsWith('Kinoevent'))!;
    const s = new DesklineDeScraper().toScraped({ ...e, lat: undefined, lng: undefined }, g);
    expect(s.latitude).toBeUndefined();
    expect(s.postal_code).toBeUndefined();
    expect(s.city).toBe('Wittlich');
  });

  it('Registry-Seiten der Integration, Seite genau einer Gemeinde zuerst', () => {
    const groups = seitenGruppen('deskline', [
      entry({}),
      entry({ ags: '07135004', name: 'Altstrimmig', url: 'https://www.zellerland.de/wein-kulinarik/events/veranstaltungen' }),
      entry({ ags: '07135032', name: 'Forst (Hunsrück)', url: 'https://www.zellerland.de/wein-kulinarik/events/veranstaltungen' }),
      entry({ ags: '07231020', name: 'Diefenbach', url: null, host: 'diefenbach.de' }),
    ]);
    expect(groups.map(x => [x.pageUrl, x.own.length])).toEqual([
      ['https://stadt-zell-mosel.de/erlebnisse/veranstaltungen', 1],
      ['https://www.diefenbach.de/', 1],
      ['https://www.zellerland.de/wein-kulinarik/events/veranstaltungen', 2],
    ]);
  });
});
