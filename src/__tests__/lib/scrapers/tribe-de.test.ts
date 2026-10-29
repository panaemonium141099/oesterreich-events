/**
 * DE-Adapter The Events Calendar (fn-29.7), Golden-Tests auf echten
 * REST-Antworten (abgerufen 2026-10-29): Kaiser-Wilhelm-Koog („UTC+1"),
 * Mellingen („UTC+2"), Esthal (ganztägig, Europe/Berlin).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTribePage, tribePageUrl } from '@/lib/scrapers/de/tribe';
import { TribeDeScraper } from '@/lib/scrapers/de/TribeDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'tribe', f), 'utf8');

describe('Tribe: REST lesen', () => {
  it('Ort aus venue, Wandzeit als deutsche Ortszeit, Detailseite', () => {
    const { events, totalPages } = parseTribePage(fx('kwk.json'));
    expect(totalPages).toBe(1);
    const e = events.find(x => x.title === 'Fahrbücherei')!;
    expect(e).toMatchObject({
      url: 'https://kaiser-wilhelm-koog.de/kalender/fahrbuecherei-10/', localDate: '2026-11-09',
      start: '2026-11-09T13:30:00.000Z', end: '2026-11-09T14:25:00.000Z', allDay: false,
      locationName: 'Feuerwehrgerätehaus', street: 'Schulstraße 8', postalCode: '25709', locality: 'Kaiser-Wilhelm-Koog',
      organizer: 'Fahrbücherei 13 im Kreis Dithmarschen',
    });
  });

  it('fester Versatz „UTC+2": Wandzeit zählt, nicht utc_start_date (Mellingen 18:00, Seite „18:00 bis 20:00")', () => {
    const e = parseTribePage(fx('mellingen.json')).events.find(x => x.title.startsWith('Roy Reinker'))!;
    // 18:00 Sommerzeit = 16:00 UTC; die Website meldete 15:00 UTC.
    expect(e.start).toBe('2027-06-19T16:00:00.000Z');
    expect(e.end).toBe('2027-06-19T18:00:00.000Z');
  });

  it('HTML-Entitäten im Titel', () => {
    expect(parseTribePage(fx('mellingen.json')).events[0].title).toBe('Vokalkonzert „Yuppies“ / Kirche Mellingen');
  });

  it('ganztägig über mehrere Tage: letzter Tag einschließlich', () => {
    const [e] = parseTribePage(fx('allday.json')).events;
    expect(e).toMatchObject({ allDay: true, start: '2027-03-26', end: '2027-03-28' });
  });

  it('00:00 bis 00:00 ist ohne Uhrzeit (Volkstrauertag)', () => {
    const e = parseTribePage(fx('kwk.json')).events.find(x => x.title === 'Volkstrauertag')!;
    expect(e).toMatchObject({ allDay: true, start: '2026-11-15' });
    expect(e.end).toBeUndefined();
  });

  it('Seiten-URL mit Zeitfenster', () => {
    const u = new URL(tribePageUrl('https://kaiser-wilhelm-koog.de/wp-json/tribe/events/v1/events', '2026-10-29', '2027-10-29', 2));
    expect(u.searchParams.get('start_date')).toBe('2026-10-29 00:00:00');
    expect(u.searchParams.get('end_date')).toBe('2027-10-29 23:59:59');
    expect(u.searchParams.get('page')).toBe('2');
    expect(u.searchParams.get('per_page')).toBe('50');
  });
});

describe('Tribe: Termin → Zeile', () => {
  const entry = (o: Partial<RegistryEntryDe>): RegistryEntryDe => ({
    ags: '01051057', name: 'Kaiser-Wilhelm-Koog', land: 'schleswig-holstein', host: null, stufe: 'A', integration: 'tribe', url: null, checked_at: '2026-10-29', ...o,
  });
  const g: FeedGroup = { feedUrl: 'https://kaiser-wilhelm-koog.de/wp-json/tribe/events/v1/events', pageUrl: 'https://kaiser-wilhelm-koog.de/kalender/', own: [entry({})], viaVerband: [] };

  it('Termin der eigenen Gemeinde: Ort und Gemeinde aus venue, source_id je Website', () => {
    const scraper = new TribeDeScraper();
    const e = parseTribePage(fx('kwk.json')).events.find(x => x.title.startsWith('Gemeindevertretersitzung'))!;
    const s = scraper.toScraped(e, g);
    expect(s).toMatchObject({ source_id: 'tribe-kaiser-wilhelm-koog.de-' + e.uid, source_url: e.url, country: 'DE', postal_code: '25709' });
    const row = toSupabaseRow(s, new Map(), new Map()).row as unknown as { location_resolution: { gemeinde: { name: string } | null } };
    expect(row.location_resolution.gemeinde?.name).toBe('Kaiser-Wilhelm-Koog');
  });
});

describe('Tribe: Gemeinde-Dienst', () => {
  it('Bürgermeister-Sprechstunde (Bodensee, Landkreis Göttingen): Quarantäne municipal_service', () => {
    const scraper = new TribeDeScraper();
    const [e] = parseTribePage(fx('bodensee.json')).events;
    const g: FeedGroup = {
      feedUrl: 'https://bodensee-eichsfeld.de/wp-json/tribe/events/v1/events', pageUrl: 'https://bodensee-eichsfeld.de/',
      own: [{ ags: '03159006', name: 'Bodensee', land: 'niedersachsen', host: null, stufe: 'A', integration: 'tribe', url: null, checked_at: '2026-10-29' }], viaVerband: [],
    };
    const row = toSupabaseRow(scraper.toScraped(e, g), new Map(), new Map()).row as unknown as { publish_status: string; location_resolution: { admission?: { reasons: string[] } } };
    expect(row.location_resolution.admission?.reasons).toContain('municipal_service');
    expect(row.publish_status).not.toMatch(/^published/);
  });
});

describe('Kalender einer Gemeinde, Termin nennt eine andere', () => {
  it('nahe Gemeinde im Ort oder Titel gilt, eigener Ortsteil und Namensteil nicht, ferne Gemeinde ohne Ort', async () => {
    const { otherGemeindeNamed } = await import('@/lib/scrapers/de/kontext');
    const { findGemeindeDe, gemeindeDeByAgs } = await import('@/lib/gemeinden/de');
    const marburg = findGemeindeDe({ name: 'Marburg', land: 'hessen' })!;
    expect(otherGemeindeNamed(marburg, { title: 'Spiele-Nachmittag in Lollar', locationName: 'ev. Gemeindezentrum Lollar' })?.name).toBe('Lollar');
    // Zwei Allendorf im Umkreis: der Zusatz entscheidet, ohne ihn kein Ort.
    expect(otherGemeindeNamed(marburg, { title: 'Nikelsmarkt Allendorf', locationName: 'Allendorf / Lumda' })?.name).toBe('Allendorf (Lumda)');
    expect(otherGemeindeNamed(marburg, { title: 'Markt', locationName: 'Bürgerhaus Allendorf' })).toBeNull();
    const reimlingen = findGemeindeDe({ name: 'Reimlingen', land: 'bayern' })!;
    expect(otherGemeindeNamed(reimlingen, { title: 'Kirchenkonzert in Nördlingen', locationName: 'Nördlingen' })?.name).toBe('Nördlingen');
    const bornheim = gemeindeDeByAgs('07337014')!; // Bornheim (Südliche Weinstraße), 76879
    expect(otherGemeindeNamed(bornheim, { title: 'Berlinreise „Unser Dorf hat Zukunft“', locationName: 'Berlin' })).toBeNull();
    const nv = findGemeindeDe({ name: 'Neuenkirchen-Vörden', land: 'niedersachsen' })!;
    expect(otherGemeindeNamed(nv, { title: 'CNN-Galasitzung', locationName: 'Sporthalle Neuenkirchen' })).toBeUndefined();
    const rheide = findGemeindeDe({ name: 'Groß Rheide', land: 'schleswig-holstein' })!;
    expect(otherGemeindeNamed(rheide, { title: 'Fitness 2. Gruppe', locationName: 'Sporthalle Groß Rheide' })).toBeUndefined();
  });
});
