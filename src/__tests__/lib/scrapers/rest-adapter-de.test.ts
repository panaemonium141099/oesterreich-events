/**
 * DE-Rest-Adapter (fn-29): lkrg (sqronline-JSON), regiogate (recon CMS,
 * Karten und Detailseite) und GeoCMS (Liste und Detailseite), Golden-Tests
 * auf echten Antworten (abgerufen 2026-11-07): Hohenroth, Chamerau, Rheine,
 * Köthen (Anhalt).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { lkrgEmbed, lkrgEventsUrl, parseLkrgEvents } from '@/lib/scrapers/de/lkrg';
import { parseRegiogateDetail, parseRegiogateList, regiogateDay, toRegiogateTermin } from '@/lib/scrapers/de/regiogate';
import { geocmsListUrl, parseGeocmsDetail, parseGeocmsList, toGeocmsTermin } from '@/lib/scrapers/de/geocms';
import { LkrgDeScraper } from '@/lib/scrapers/de/LkrgDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

beforeAll(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-07T12:00:00Z') }));
afterAll(() => vi.useRealTimers());

const fx = (dir: string, f: string) => readFileSync(join(__dirname, 'fixtures', dir, f), 'utf8');
const TODAY = '2026-11-07';

describe('lkrg: Kalender-Element und JSON', () => {
  it('UUID des Moduls aus der Seite, Standard-API', () => {
    const e = lkrgEmbed(fx('lkrg', 'aubstadt.html'))!;
    expect(e.uuids).toEqual(['9ab83daa-34ec-4ae2-aff6-85d2a0069110']);
    expect(lkrgEventsUrl(e, e.uuids[0])).toBe('https://aht1gh-api.sqronline.de/api/modules/events/getevents?module_division_uuid=9ab83daa-34ec-4ae2-aff6-85d2a0069110');
    expect(lkrgEmbed('<div data-moddivuuids="x"></div>')).toBeNull();
  });

  it('Termine: Wandzeit, Ende, Ort mit PLZ, Ortsteil hinter dem Komma', () => {
    const t = parseLkrgEvents(fx('lkrg', 'hohenroth.json'), TODAY);
    expect(t).toHaveLength(4);
    expect(t[0]).toMatchObject({ title: 'Kirchweihessen', start: '2026-11-07T17:00:00.000Z', allDay: false, locationName: 'Seeheim', street: 'Seestraße 4', postalCode: '97618', locality: 'Hohenroth' });
    expect(t[0].end).toBeUndefined();
    expect(t[1]).toMatchObject({ title: 'Kirchweih Pfarrgemeinde', start: '2026-11-08T13:00:00.000Z', end: '2026-11-08T21:00:00.000Z', locality: 'Hohenroth' });
    expect(parseLkrgEvents(fx('lkrg', 'hohenroth.json'), '2026-11-09')).toHaveLength(2);
    expect(() => parseLkrgEvents('{"status":-1,"msg":"Missing module_division_uuid"}', TODAY)).toThrow(/Missing/);
  });

  it('Termin → Zeile: Gemeinde aus PLZ und Ort, Quelle ist die Kalenderseite', () => {
    const entry: RegistryEntryDe = { ags: '09673141', name: 'Hohenroth', land: 'bayern', host: 'hohenroth.de', stufe: 'C', integration: 'lkrg', url: 'https://www.hohenroth.de/veranstaltungen', checked_at: '2026-10-28' };
    const g: FeedGroup = { feedUrl: entry.url!, pageUrl: entry.url!, own: [entry], viaVerband: [] };
    const t = parseLkrgEvents(fx('lkrg', 'hohenroth.json'), TODAY);
    const s = new LkrgDeScraper().toScraped(t[3], g);
    expect(s).toMatchObject({ source_id: `lkrg-${t[3].uid}`, source_url: entry.url, city: 'Strahlungen', postal_code: '97618', country: 'DE' });
    const row = toSupabaseRow(s, new Map(), new Map()).row as unknown as { location_resolution: { gemeinde: { name: string } | null } };
    expect(row.location_resolution.gemeinde?.name).toBe('Strahlungen');
  });
});

describe('regiogate: Karten und Detailseite', () => {
  it('Karten mit Datebox (Chamerau) und mit vollem Datum (Rheine)', () => {
    const cards = parseRegiogateList(fx('regiogate', 'chamerau-liste.html'), 'https://www.chamerau.de/aktuelles/veranstaltungen/index.html');
    expect(cards.map(c => [c.id, c.title, c.dateText])).toEqual([
      ['138', 'Gemeinsamer Jahrtag KuRK und FFW Lederdorn', '07.11.'],
      ['173', expect.any(String), expect.stringMatching(/^\d{2}\.\d{2}\.$/)],
    ]);
    expect(cards[0].url).toBe('https://www.chamerau.de/aktuelles/veranstaltungen/index.html?ev%5Bid%5D=138');
    const [r] = parseRegiogateList(fx('regiogate', 'rheine-liste.html'), 'https://www.rheine.de/kultur-freizeit-tourismus/veranstaltungen-highlights/index.html');
    expect(r).toMatchObject({ id: '15538', title: 'Ich mach dich gesund, sagte der kleine Bär' });
    expect(r.dateText).toContain('08.11.2026, 11:00 Uhr bis 12:00 Uhr');
    const t = toRegiogateTermin(r, null, TODAY)!;
    expect(t).toMatchObject({ localDate: '2026-11-08', start: '2026-11-08T10:00:00.000Z', end: '2026-11-08T11:00:00.000Z', postalCode: '48429', locality: 'Rheine' });
  });

  it('Jahr aus der Datebox: Tag vor heute liegt im nächsten Jahr', () => {
    expect(regiogateDay('07.11.', TODAY)).toBe('2026-11-07');
    expect(regiogateDay('03.01.', TODAY)).toBe('2027-01-03');
    expect(regiogateDay('08.11.2026, 11:00 Uhr', TODAY)).toBe('2026-11-08');
  });

  it('Detailseite: Adresse mit PLZ, ohne Uhrzeit ganztägig', () => {
    const d = parseRegiogateDetail(fx('regiogate', 'chamerau-detail.html'), 'https://www.chamerau.de/aktuelles/veranstaltungen/index.html?ev%5Bid%5D=138')!;
    expect(d).toMatchObject({ title: 'Gemeinsamer Jahrtag KuRK und FFW Lederdorn', dateText: '07.11.', locationName: 'KuRK Lederdorn', postalCode: '93466', locality: 'Chamerau' });
    const [card] = parseRegiogateList(fx('regiogate', 'chamerau-liste.html'), 'https://www.chamerau.de/aktuelles/veranstaltungen/index.html');
    const t = toRegiogateTermin(card, d, TODAY)!;
    expect(t).toMatchObject({ localDate: '2026-11-07', start: '2026-11-07', allDay: true, locality: 'Chamerau' });
  });
});

describe('GeoCMS: Liste und Detailseite', () => {
  it('Listen-URL mit Fenster und Offset', () => {
    const u = new URL(geocmsListUrl('https://www.koethen-anhalt.de/de/veranstaltungen.html', '2026-11-07', '2027-11-07', 40));
    expect(u.searchParams.get('min_date')).toBe('07.11.2026');
    expect(u.searchParams.get('max_date')).toBe('07.11.2027');
    expect(u.searchParams.get('gcevent[pager]')).toBe('40');
  });

  it('Zeilen: Schlüssel mit Datum, Uhrzeit, Zeitraum „01. bis 30. November", Kategorie', () => {
    const rows = parseGeocmsList(fx('geocms', 'koethen-liste.html'), 'https://www.koethen-anhalt.de/de/veranstaltungen.html');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toMatchObject({ key: 'event-81327-1233-de-1-2026-11-01-10-00', localDate: '2026-11-01', time: '10:00', endTime: '18:00', lastDate: '2026-11-30', category: 'Familien und Kinder' });
    expect(rows[0].url).toBe('https://www.koethen-anhalt.de/de/veranstaltungen/event/82169,1233/lesestart-set-kostenlos-erhaeltlich-in-der-kinderbibliothek-koethen-01-11-2026.html');
  });

  it('Detailseite: Veranstaltungsort mit PLZ und Straße, Ticket-Link', () => {
    const d = parseGeocmsDetail(fx('geocms', 'koethen-detail.html'), 'https://www.koethen-anhalt.de/de/veranstaltungen/event/76555,1233/aladin.html')!;
    expect(d).toMatchObject({ locationName: 'Veranstaltungszentrum Schloss Köthen - Johann-Sebastian-Bach-Saal', postalCode: '06366', locality: 'Köthen (Anhalt)', street: 'Schlossplatz 4' });
    expect(d.ticketUrl).toMatch(/^https:\/\/www\.reservix\.de\//);
    const [row] = parseGeocmsList(fx('geocms', 'koethen-liste.html'), 'https://www.koethen-anhalt.de/de/veranstaltungen.html');
    const t = toGeocmsTermin(row, d);
    expect(t).toMatchObject({ start: '2026-11-01T09:00:00.000Z', end: '2026-11-30T17:00:00.000Z', allDay: false, postalCode: '06366' });
  });
});
