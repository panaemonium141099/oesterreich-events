/**
 * DE-Adapter Komm.ONE Online-Suite (fn-29.10), Golden-Tests auf echten
 * Terminlisten (abgerufen 2026-10-30, Skripte, Styles und Menüs entfernt):
 * Waldenbuch (hCalendar `article.vevent` mit vCard, Datenfehler „7111"),
 * Besigheim (neuere Vorlage `div.zmitem`, Datum nur als Text), Bötzingen
 * (Ort als Freitext), Schwörstadt (Veranstalter-vCard mit Ansprechpartner),
 * Berghaupten (Titel als Link, Logo als Bild), Schwieberdingen (Dorffest,
 * Gemeinde-Dienst) und das gekürzte RSS von Aichwald („20-22 Uhr").
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kommOneWhen, parseKommOneList, parseKommOneRss } from '@/lib/scrapers/de/kommone';
import { KommOneDeScraper, kommOneGroups } from '@/lib/scrapers/de/KommOneDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'kommone', f), 'utf8');

const KAL = {
  waldenbuch: { ags: '08115048', name: 'Waldenbuch, Stadt', url: 'https://www.waldenbuch.de/start/waldenbuch+entdecken/veranstaltungen.html' },
  besigheim: { ags: '08118007', name: 'Besigheim, Stadt', url: 'https://www.besigheim.de/aktuelle-themen/veranstaltungen' },
  boetzingen: { ags: '08315013', name: 'Bötzingen', url: 'https://boetzingen.de/start/Aktuell/veranstaltungen.html' },
  schwoerstadt: { ags: '08336082', name: 'Schwörstadt', url: 'https://schwoerstadt.de/aktuelles/veranstaltungen' },
  berghaupten: { ags: '08317009', name: 'Berghaupten', url: 'https://www.berghaupten.de/freizeit--tourismus/veranstaltungskalender' },
  schwieberdingen: { ags: '08118067', name: 'Schwieberdingen', url: 'https://www.schwieberdingen.de/freizeit-und-tourismus/veranstaltungen' },
} as const;
type K = keyof typeof KAL;

const entry = (k: K): RegistryEntryDe => ({
  ...KAL[k], land: 'baden-wuerttemberg', host: new URL(KAL[k].url).host.replace(/^www\./, ''), stufe: 'A', integration: 'komm1', checked_at: '2026-10-28',
});
const group = (k: K): FeedGroup => ({ feedUrl: KAL[k].url, pageUrl: KAL[k].url, own: [entry(k)], viaVerband: [] });
const list = (k: K, page = '') => parseKommOneList(fx(`${k}-liste${page}.html`), KAL[k].url);

type Row = {
  source_id: string; source_url: string; start_date: string; end_date: string | null; publish_status: string; country: string;
  image_url: string | null; location_resolution: { gemeinde: { name: string } | null; admission?: { reasons: string[] } };
};
const row = (k: K, title: string, page = '') => {
  const t = list(k, page).termine.find(x => x.title === title)!;
  return toSupabaseRow(new KommOneDeScraper().toScraped(t, group(k)), new Map(), new Map()).row as unknown as Row;
};

describe('Komm.ONE: Terminliste lesen', () => {
  it('Waldenbuch (hCalendar): 20 Termine, „Weiter" ohne Sitzungs-ID, RSS-Link', () => {
    const p = list('waldenbuch');
    expect(p.termine).toHaveLength(20);
    expect(p.next).toBe('https://www.waldenbuch.de/site/Waldenbuch-Internet/node/13702713/page2/page2');
    expect(p.rss).toBe('https://www.waldenbuch.de/site/Waldenbuch-Internet/zmrss/13702713/rss.xml');
  });

  it('Waldenbuch „WaldenBUH!": 19:00 Ortszeit, Ort mit vCard, Veranstalter, Kategorie, Bild, Detailseite', () => {
    expect(list('waldenbuch').termine.find(t => t.title === 'WaldenBUH!')).toEqual({
      id: '523256908503', url: 'https://www.waldenbuch.de/site/Waldenbuch-Internet/node/13702713/zmdetail_523256908503/WaldenBUH.html?nodeID=523256908503',
      localDate: '2026-10-30', start: '2026-10-30T18:00:00.000Z', allDay: false, title: 'WaldenBUH!', category: 'Stadtführung',
      organizer: 'Stadtverwaltung Waldenbuch', locationName: 'Schlosshof Waldenbuch', street: 'Kirchgasse 3', postalCode: '71111', locality: 'Waldenbuch',
      image: 'https://www.waldenbuch.de/site/Waldenbuch-Internet/get/documents/waldenbuch/dictionaries/bild/Veran/20261006/dsc_0113-1.jpg',
    });
  });

  it('ganztägig über zwei Tage; PLZ „7111" der Quelle ist keine PLZ (Waldenbuch „Kinderbibeltage")', () => {
    const t = list('waldenbuch').termine.find(x => x.title === 'Kinderbibeltage')!;
    expect(t).toMatchObject({ start: '2026-10-29', end: '2026-10-30', allDay: true, street: 'Bahnhofstraße 8', locality: 'Waldenbuch' });
    expect(t.postalCode).toBeUndefined();
  });

  it('neuere Vorlage: Datum als Text, Ort und Veranstalter ohne Adresse (Besigheim)', () => {
    const p = list('besigheim');
    expect(p.next).toBe('https://www.besigheim.de/site/Besigheim-2023/node/20981999/page2/page2');
    expect(p.termine.find(t => t.title === 'Jugendtheateraufführungen')).toMatchObject({ start: '2026-10-30', end: '2026-11-01', allDay: true, organizer: 'Studiobühne Besigheim', locationName: 'Steinhauskeller' });
    expect(p.termine.find(t => t.title === 'Gottesdienst zum Reformationsfest mit Abendmahl')).toMatchObject({ start: '2026-11-01T09:00:00.000Z', allDay: false });
  });

  it('Ort als Freitext, Uhrzeit „19.00 Uhr" (Bötzingen „Hauptversammlung")', () => {
    expect(list('boetzingen').termine.find(t => t.title === 'Hauptversammlung')).toMatchObject({
      start: '2026-10-30T18:00:00.000Z', organizer: 'VdK Ortsverband Bötzingen-Gottenheim', locationName: 'Gasthaus "Zur Krone", Gottenheimer Straße 1',
    });
  });

  it('Veranstalter ohne Ansprechpartner, Kategorie aus `zmitem__kategorie` (Schwörstadt)', () => {
    expect(list('schwoerstadt').termine.find(t => t.title === 'Wanderung Gempenfluh, Jura (CH)')).toMatchObject({ category: 'Sport', organizer: 'Schwarzwaldverein Schwörstadt e. V.' });
    expect(list('schwoerstadt').termine.find(t => t.title === 'Theaterabend - Sportverein Schwörstadt')).toMatchObject({
      start: '2026-11-21T19:00:00.000Z', locationName: 'Turn- und Festhalle Schwörstadt', street: 'Römerstraße 32', postalCode: '79739', locality: 'Schwörstadt',
    });
  });

  it('RSS: Kanal-Link ist die Terminliste, Termine aus `content:encoded`, „20-22 Uhr" (Aichwald)', () => {
    const r = parseKommOneRss(fx('aichwald-rss.xml'), 'https://www.aichwald.de/site/Aichwald-Responsive/zmrss/15099216/rss.xml')!;
    expect(r.listUrl).toBe('https://www.aichwald.de/start/freizeit+_+kultur/veranstaltungskalender.html');
    expect(r.termine).toHaveLength(15);
    expect(r.termine.find(t => t.id === '523252622010')).toMatchObject({
      start: '2026-11-05T19:00:00.000Z', end: '2026-11-05T21:00:00.000Z', locationName: 'Neue Sporthalle (Schanbach)', postalCode: '73773', organizer: 'ASV Aichwald',
    });
    expect(parseKommOneRss('<rss><channel><generator>IKISS</generator></channel></rss>', 'https://x.de/')).toBeNull();
  });
});

describe('Komm.ONE: Datum und Uhrzeit', () => {
  it('Sommerzeit, Spanne, Ende vor Beginn bleibt offen, „ab 19 Uhr"', () => {
    expect(kommOneWhen('2027-06-20', undefined, '18:00 - 22:00 Uhr')).toEqual({ localDate: '2027-06-20', start: '2027-06-20T16:00:00.000Z', end: '2027-06-20T20:00:00.000Z', allDay: false });
    expect(kommOneWhen('2026-12-31', undefined, '20:00 - 02:00')).toEqual({ localDate: '2026-12-31', start: '2026-12-31T19:00:00.000Z', allDay: false });
    expect(kommOneWhen('2026-11-14', undefined, 'ab 19 Uhr')).toMatchObject({ start: '2026-11-14T18:00:00.000Z', allDay: false });
    expect(kommOneWhen('2026-11-14', undefined, '')).toEqual({ localDate: '2026-11-14', start: '2026-11-14', allDay: true });
  });
});

describe('Komm.ONE: Termin → Zeile', () => {
  it('Waldenbuch: Gemeinde Waldenbuch, source_id aus Website und Detail-ID, Bildnachweis', () => {
    const r = row('waldenbuch', 'WaldenBUH!');
    expect(r).toMatchObject({ source_id: 'komm1-www.waldenbuch.de-523256908503', start_date: '2026-10-30T18:00:00.000Z', country: 'DE' });
    expect(r.location_resolution.gemeinde?.name).toBe('Waldenbuch');
  });

  it('Dorffest „Schwieberdinger Kirbe": 11:30 bis 18:00 Ortszeit, Rund ums Rathaus, öffentlich', () => {
    const r = row('schwieberdingen', 'Schwieberdinger Kirbe');
    expect(r).toMatchObject({ start_date: '2026-11-08T10:30:00.000Z', end_date: '2026-11-08T17:00:00.000Z' });
    expect(r.location_resolution.gemeinde?.name).toBe('Schwieberdingen');
    expect(r.publish_status).toMatch(/^published/);
  });

  it('Gemeinde-Dienst: Quarantäne municipal_service (Schwieberdingen „Weihnachtsbaumsammlung des EJW")', () => {
    const r = row('schwieberdingen', 'Weihnachtsbaumsammlung des EJW', '-3');
    expect(r.location_resolution.admission?.reasons).toContain('municipal_service');
    expect(r.publish_status).not.toMatch(/^published/);
  });

  it('Logo als Bild fällt weg (Berghaupten `logo-kksv-ok_6.png`)', () => {
    expect(row('berghaupten', 'Training für Dorfmeisterschaften des KKSV').image_url).toBeNull();
  });
});

describe('Komm.ONE: Kalender der Registry', () => {
  it('Kalenderseite, sonst RSS; Ausweichweg über die VG', () => {
    const vg: RegistryEntryDe = {
      ags: '08336010', name: 'Böllen', land: 'baden-wuerttemberg', host: 'boellen.de', stufe: 'V', integration: 'kein_link', url: null, checked_at: '2026-10-28',
      fallback: { kind: 'verband', host: 'gvvschoenau.de', integration: 'komm1', url: null, feed_url: 'https://www.gvvschoenau.de/site/X/zmrss/1/rss.xml' },
    };
    const nur = { ...entry('boetzingen'), url: null, feed_url: 'https://boetzingen.de/site/Boetzingen/zmrss/430432/rss.xml' };
    const gs = kommOneGroups([entry('waldenbuch'), nur, vg, { ...entry('besigheim'), url: null }]);
    expect(gs.map(g => [g.pageUrl, g.feedUrl, g.own.length, g.viaVerband.length])).toEqual([
      ['https://boetzingen.de/site/Boetzingen/zmrss/430432/rss.xml', 'https://boetzingen.de/site/Boetzingen/zmrss/430432/rss.xml', 1, 0],
      ['https://www.gvvschoenau.de/site/X/zmrss/1/rss.xml', 'https://www.gvvschoenau.de/site/X/zmrss/1/rss.xml', 0, 1],
      ['https://www.waldenbuch.de/start/waldenbuch+entdecken/veranstaltungen.html', 'https://www.waldenbuch.de/start/waldenbuch+entdecken/veranstaltungen.html', 1, 0],
    ]);
  });
});
