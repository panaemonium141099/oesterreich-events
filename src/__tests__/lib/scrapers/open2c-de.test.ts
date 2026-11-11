/**
 * DE-Adapter Open2C (fn-29.15), Golden-Tests auf echten Kalenderseiten
 * (abgerufen 2026-10-30, gekürzt auf die Terminblöcke samt Pager,
 * Vorschaubilder entfernt): Scheyern (mehrtägig mit Uhrzeit, volle Adresse,
 * Sommerzeit-Offset), Wolnzach (Beschreibung, Pager), Aindling (Ort),
 * Pliening (ganztägig, „von 19:00 bis 21:00 Uhr"), Mittelstetten (Ende ohne
 * Uhrzeit), Gangkofen (Christkindlmarkt, Elisabethmarkt), Jesenwang
 * (Problemmüllsammlung).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { open2cWhen, parseOpen2cList } from '@/lib/scrapers/de/open2c';
import { Open2cDeScraper, open2cGroups, open2cPlace } from '@/lib/scrapers/de/Open2cDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'open2c', `${f}.html`), 'utf8');

const KAL = {
  scheyern: { ags: '09186151', name: 'Scheyern', url: 'https://www.scheyern.de/Veranstaltungen.n18.html' },
  wolnzach: { ags: '09186162', name: 'Wolnzach, M', url: 'https://www.wolnzach.de/veranstaltungskalender-freizeit' },
  aindling: { ags: '09771114', name: 'Aindling, M', url: 'https://www.aindling.de/Veranstaltungskalender.n62.html' },
  pliening: { ags: '09175133', name: 'Pliening', url: 'https://www.pliening.de/Veranstaltungen.n18.html' },
  mittelstetten: { ags: '09179137', name: 'Mittelstetten', url: 'https://www.mittelstetten.de/veranstaltungen-mittelsetten' },
  gangkofen: { ags: '09277121', name: 'Gangkofen, M', url: 'https://www.gangkofen.de/VeranstaltungenTermine.n16.html' },
  jesenwang: { ags: '09179130', name: 'Jesenwang', url: 'https://www.jesenwang.de/veranstaltungen-jesenwang' },
} as const;
type Kal = keyof typeof KAL;

const entry = (k: Kal): RegistryEntryDe => ({
  ...KAL[k], land: 'bayern', host: new URL(KAL[k].url).host.replace(/^www\./, ''), stufe: 'B', integration: 'open2c', checked_at: '2026-10-28',
});
const group = (k: Kal): FeedGroup => ({ feedUrl: KAL[k].url, pageUrl: KAL[k].url, own: [entry(k)], viaVerband: [] });
const page = (k: Kal) => parseOpen2cList(fx(k), KAL[k].url);
const termin = (k: Kal, title: string) => page(k).termine.find(t => t.title === title)!;

type Row = {
  source_id: string; source_url: string; start_date: string; end_date: string | null; publish_status: string; country: string;
  location_name: string | null; postal_code: string | null;
  location_resolution: { gemeinde: { name: string } | null; admission?: { reasons: string[] } };
};
const rowsCache = new Map<Kal, Row[]>();
// Je Kalender einmal durch den Schreibweg (der Resolver ist teuer).
const rows = (k: Kal): Row[] => {
  if (!rowsCache.has(k)) rowsCache.set(k, new Open2cDeScraper().toScrapedAll(page(k).termine, group(k)).map(e => toSupabaseRow(e, new Map(), new Map()).row as unknown as Row));
  return rowsCache.get(k)!;
};
const row = (k: Kal, title: string) => rows(k).find(r => r.source_url === termin(k, title).url)!;

// Die Fixtures stammen vom 30.10.2026 und listen Termine an diesem Tag.
// Der Freigabevertrag misst gegen die Uhr (start_in_past); sie steht
// deshalb auf dem Abrufdatum, sonst kippen die Zeilen mit jedem Tag.
beforeAll(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-30T12:00:00Z') }));
afterAll(() => vi.useRealTimers());

describe('Open2C: Liste lesen', () => {
  it('Terminblock (Aindling): Detailansicht, Beginn mit Offset, Ort, Kategorie', () => {
    const p = page('aindling');
    expect(p).toMatchObject({ isList: true, pages: [] });
    expect(p.termine).toHaveLength(16);
    expect(termin('aindling', 'Jubiläumskonzert Famgosis')).toMatchObject({
      url: 'https://www.aindling.de/Veranstaltungskalender-des-Marktes-Aindling.o135.html?detailevent=10291',
      id: '10291', localDate: '2026-10-30', start: '2026-10-30T18:00:00.000Z', allDay: false,
      locationName: 'Gemeinschaftshaus Stotzard', category: 'Vereine',
    });
  });

  it('mehrtägig mit Uhrzeit über den Wechsel der Sommerzeit (Scheyern „Spiel-Nachmittag" +02:00 bis +01:00)', () => {
    expect(termin('scheyern', 'Spiel-Nachmittag')).toMatchObject({ start: '2026-09-27T13:30:00.000Z', end: '2026-11-22T16:00:00.000Z', allDay: false });
  });

  it('ganztägig, auch mehrtägig: Text ohne Uhrzeit (Pliening, Scheyern)', () => {
    expect(termin('pliening', 'Halloween-Party')).toMatchObject({ start: '2026-10-31', allDay: true });
    expect(termin('scheyern', 'Vorlesenachmittag in der Bücherei Scheyern')).toMatchObject({ start: '2026-10-22', end: '2026-12-17', allDay: true });
  });

  it('„von 19:00 bis 21:00 Uhr" (Pliening „Wattturnier FFW Landsham")', () => {
    expect(termin('pliening', 'Wattturnier FFW Landsham')).toMatchObject({ start: '2026-10-31T18:00:00.000Z', end: '2026-10-31T20:00:00.000Z' });
  });

  it('Beschreibung und Pager (Wolnzach)', () => {
    expect(termin('wolnzach', 'KDFB Wolnzach: Frauenbund-Kinoabend').description).toContain('Zuhause in Tangar');
    expect(page('wolnzach').pages).toEqual(['https://www.wolnzach.de/Veranstaltungskalender.o59.html?page=2']);
  });

  it('Seite ohne Kalendermodul ist keine Liste', () => {
    expect(parseOpen2cList('<main><p>Die im RCE-Kalender erfassten Termine …</p></main>', 'https://www.sulzemoos.de/veranstaltungen').isList).toBe(false);
  });
});

describe('Open2C: Datum und Uhrzeit', () => {
  it('Formen der Terminzeile', () => {
    expect(open2cWhen('06.11.2026 19:00 Uhr', '2026-11-06T19:00:00+01:00')).toEqual({ localDate: '2026-11-06', start: '2026-11-06T18:00:00.000Z', allDay: false });
    expect(open2cWhen('02.05.2027 10:00 Uhr', '2027-05-02T10:00:00+02:00')).toMatchObject({ start: '2027-05-02T08:00:00.000Z' });
    expect(open2cWhen('30.10.2026', '2026-10-30T00:00:00+01:00')).toEqual({ localDate: '2026-10-30', start: '2026-10-30', allDay: true });
    // Ende ohne Uhrzeit ist der Tag (Mittelstetten).
    expect(open2cWhen('01.12.2026 17:00 Uhr – 26.12.2026', '2026-12-01T17:00:00+01:00', '2026-12-26T00:00:00+01:00'))
      .toEqual({ localDate: '2026-12-01', start: '2026-12-01T16:00:00.000Z', end: '2026-12-26', allDay: false });
  });
});

// Der Schreibweg (Resolver, Kontext) braucht je Zeile einige zehn Millisekunden.
describe('Open2C: Termin → Zeile', { timeout: 30_000 }, () => {
  it('Gemeinde des Kalenders, source_id aus der Termin-ID (Gangkofen Christkindlmarkt, Dorffest)', () => {
    const r = row('gangkofen', 'Christkindlmarkt');
    expect(r).toMatchObject({
      source_id: 'open2c-gangkofen.de-4360', start_date: '2026-12-05', end_date: '2026-12-06', country: 'DE',
      location_name: 'Kommendehof an der kath. Pfarrkirche Gangkofen Deutsch Haus 2', postal_code: '84140',
    });
    expect(r.location_resolution.gemeinde?.name).toBe('Gangkofen');
    expect(r.publish_status).toMatch(/^published/);
  });

  it('PLZ und Ort am Ende der Ortsangabe', () => {
    expect(open2cPlace('Bürgerhaus Rathausplatz 2 85298 Scheyern')).toEqual({ locationName: 'Bürgerhaus Rathausplatz 2', postalCode: '85298', locality: 'Scheyern' });
    expect(open2cPlace('Haus der Bürger Reisbach, Neumühlstraße 4, 94419 Reisbach')).toEqual({ locationName: 'Haus der Bürger Reisbach, Neumühlstraße 4', postalCode: '94419', locality: 'Reisbach' });
    expect(open2cPlace('Gasthof zur Post')).toEqual({ locationName: 'Gasthof zur Post' });
    expect(open2cPlace('-')).toEqual({});
  });

  it('Gemeinde-Dienst in Quarantäne (Jesenwang „Problemmüllsamlung")', () => {
    const r = row('jesenwang', 'Problemmüllsamlung');
    expect(r.publish_status).not.toMatch(/^published/);
    expect(r.location_resolution.admission?.reasons).toContain('municipal_service');
  });

  it('source_ids eines Kalenders sind eindeutig', () => {
    for (const k of Object.keys(KAL) as Kal[]) {
      const ids = rows(k).map(r => r.source_id);
      expect(new Set(ids).size, k).toBe(ids.length);
    }
  });

  it('Gemeinden mit derselben Seite teilen eine Gruppe', () => {
    const b = { ...entry('scheyern'), ags: '09186999', url: KAL.scheyern.url };
    expect(open2cGroups([entry('scheyern'), b]).map(g => [g.pageUrl, g.own.length])).toEqual([[KAL.scheyern.url, 2]]);
  });
});
