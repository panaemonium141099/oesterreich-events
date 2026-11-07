/**
 * DE-Adapter destination.one (fn-29 Rest-Adapter), Golden-Tests auf echten
 * Antworten von meta.et4.de (abgerufen 2026-11-07): Experience
 * „nordwaerts-orte" (Samtgemeinde Selsingen: Reihe mit Wochentagen,
 * ganztägiges Festival, Einzeltermin mit kanonischer Seite) und die
 * Lizenzsperre von „kiel".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { et4DetailUrl, et4Embeds, et4SearchUrl, expandInterval, isDauerangebot, MAX_OCCURRENCES, parseEt4Page } from '@/lib/scrapers/de/destinationone';
import { DestinationOneDeScraper } from '@/lib/scrapers/de/DestinationOneDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

beforeAll(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-07T12:00:00Z') }));
afterAll(() => vi.useRealTimers());

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'destinationone', f), 'utf8');
const embed = { experience: 'nordwaerts-orte', pagesHost: 'pages.destination.one' };
const FROM = '2026-11-07', TO = '2027-11-07';

describe('destination.one: Experience auf der Seite', () => {
  it('Script, iframe, data-experience und meta; Anmeldung derselben Experience nur einmal', () => {
    expect(et4Embeds('<script id="et4pages" src="https://pages.destination.one/de/nordwaerts-orte/default/search/Event?i_target=et4pages"></script>')).toEqual([embed]);
    expect(et4Embeds('<iframe src="https://pages.et4.de/de/konnersreuth/default/search/Event/view:list"></iframe>')).toEqual([{ experience: 'konnersreuth', pagesHost: 'pages.et4.de' }]);
    expect(et4Embeds('<meta name="experience" content="lauenburg"><div data-experience="lauenburg"></div><a href="https://pages.et4.de/de/lauenburg/default/announce/Event/edit">melden</a>')).toEqual([
      { experience: 'lauenburg', pagesHost: 'pages.et4.de' },
    ]);
    expect(et4Embeds('<p>kein Widget</p>')).toEqual([]);
  });

  it('Such-URL mit Fenster und Seite, Detail-URL mit Slug', () => {
    const u = new URL(et4SearchUrl('wiesau', FROM, TO, 500));
    expect(u.origin + u.pathname).toBe('https://meta.et4.de/rest.ashx/search/');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ experience: 'wiesau', type: 'Event', template: 'ET2014A.json', startdate: FROM, enddate: TO, limit: '500', offset: '500' });
    expect(et4DetailUrl({ experience: 'wiesau', pagesHost: 'pages.et4.de' }, 'e_100486067', '"Fisch to go" bei der Fischzucht Maierhöfer')).toBe(
      'https://pages.et4.de/de/wiesau/default/detail/Event/e_100486067/fisch-to-go-bei-der-fischzucht-maierhofer',
    );
  });
});

describe('destination.one: Termine lesen', () => {
  const page = parseEt4Page(fx('nordwaerts.json'), embed, FROM, TO);

  it('Lizenzsperre wird gemeldet, keine Termine', () => {
    const k = parseEt4Page(fx('kiel.json'), { experience: 'kiel', pagesHost: 'pages.destination.one' }, FROM, TO);
    expect(k.status).toBe('INVALID_LICENSE');
    expect(k.items).toEqual([]);
  });

  it('Einzeltermin: Offset der Quelle, Ende, Ort mit Straße, PLZ, Gemeinde, kanonische Seite', () => {
    const e = page.items.find(x => x.title.startsWith('La Papaya'))!;
    expect(e).toMatchObject({
      globalId: 'e_101350355', localDate: '2026-11-07', start: '2026-11-07T19:00:00.000Z', end: '2026-11-07T20:30:00.000Z', allDay: false,
      locality: 'Visselhövede', postalCode: '27374', canonical: 'https://www.nordwaerts.de/kultur-veranstaltungen/event/la-papaya-topola-die-peanuts-101350355/',
    });
    expect(e.uid).toBe('e_101350355@2026-11-07T19:00:00.000Z');
    expect(e.street).toBeTruthy();
    expect(e.lat).toBeGreaterThan(52);
  });

  it('ganztägig 00:00 bis 00:00 des Folgetags: Datum ohne Uhrzeit, ein Termin je Tag', () => {
    const days = parseEt4Page(fx('nordwaerts.json'), embed, '2026-06-01', TO).items.filter(x => x.title === 'Hurricane Festival');
    expect(days.length).toBeGreaterThanOrEqual(2);
    expect(days[0]).toMatchObject({ allDay: true, start: '2026-06-19' });
    expect(days[0].end).toBeUndefined();
  });

  it('Reihe mit Wochentagen: Vorkommen im Fenster, nicht vor dem Fensterbeginn, Wandzeit je Tag', () => {
    const occ = expandInterval({ weekdays: ['Sunday'], start: '2026-10-04T11:00:00+02:00', end: '2026-10-04T13:00:00+02:00', repeatUntil: '2026-11-22T11:00:00+01:00', tz: 'Europe/Berlin', freq: 'Weekly', interval: 1 }, FROM, TO, new Set());
    expect(occ.map(o => o.localDate)).toEqual(['2026-11-08', '2026-11-15', '2026-11-22']);
    // 11:00 Winterzeit = 10:00 UTC.
    expect(occ[0].start).toBe('2026-11-08T10:00:00.000Z');
    expect(occ[0].end).toBe('2026-11-08T12:00:00.000Z');
  });

  it('tägliche Öffnung über Wochen ist ein Dauerangebot, kein Termin; ein Wochenmarkt bleibt bis zur Obergrenze', () => {
    const daily = expandInterval({ start: '2026-11-01T10:00:00+01:00', end: '2026-11-01T18:00:00+01:00', repeatUntil: '2027-10-31T10:00:00+01:00', tz: 'Europe/Berlin', freq: 'Daily', interval: 1 }, FROM, TO, new Set());
    expect(daily[0].localDate).toBe('2026-11-07');
    expect(isDauerangebot(daily)).toBe(true);
    const weekly = expandInterval({ weekdays: ['Saturday'], start: '2026-01-03T08:00:00+01:00', end: '2026-01-03T12:00:00+01:00', repeatUntil: '2027-12-31T08:00:00+01:00', tz: 'Europe/Berlin', freq: 'Weekly', interval: 1 }, FROM, TO, new Set());
    expect(isDauerangebot(weekly)).toBe(false);
    expect(weekly.length).toBeGreaterThanOrEqual(MAX_OCCURRENCES);
  });

  it('Bilder nur mit freier Lizenz, Nachweis mit Lizenz', () => {
    for (const e of page.items) {
      if (e.image) expect(e.imageCredit).toMatch(/\((CC0|CC-BY|CC-BY-SA|PD)\)$/);
    }
  });
});

describe('destination.one: Termin → Zeile', () => {
  const entry = (o: Partial<RegistryEntryDe>): RegistryEntryDe => ({
    ags: '03357043', name: 'Selsingen', land: 'niedersachsen', host: 'selsingen.de', stufe: 'C', integration: 'destinationone', url: 'https://www.selsingen.de/rathaus/veranstaltungskalender', checked_at: '2026-10-28', ...o,
  });
  const g: FeedGroup = { feedUrl: 'https://www.selsingen.de/rathaus/veranstaltungskalender', pageUrl: 'https://www.selsingen.de/rathaus/veranstaltungskalender', own: [entry({}), entry({ ags: '03357003', name: 'Anderlingen' })], viaVerband: [] };

  it('Amtskalender: Gemeinde aus PLZ und Ort des Termins, Quelle ist die kanonische Seite', () => {
    const scraper = new DestinationOneDeScraper();
    const e = parseEt4Page(fx('nordwaerts.json'), embed, FROM, TO).items.find(x => x.title.startsWith('La Papaya'))!;
    const s = scraper.toScraped(e, g, embed);
    expect(s).toMatchObject({ source_id: `et4-${e.uid}`, source_url: e.canonical, country: 'DE', postal_code: '27374', city: 'Visselhövede', coords_precision: 'venue' });
    expect(s.postal_code).toBe('27374');
    const row = toSupabaseRow(s, new Map(), new Map()).row as unknown as { location_resolution: { gemeinde: { name: string } | null } };
    expect(row.location_resolution.gemeinde?.name).toMatch(/^Visselhövede/);
  });
});
