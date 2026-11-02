/**
 * DE-Adapter GeoCMS (fn-29.15), Golden-Tests auf echten Listen des Moduls
 * „gcevent" (abgerufen 2026-10-30, gekürzt auf das Listenmodul samt Pager):
 * Sibbesse (Bootstrap-Karte, „ab 17:30 Uhr", Pager), Köthen (älteres Theme,
 * „01. bis 31. Oktober 2026", Pager `gcevent[pager]`), Gerstungen
 * (`.card-date`/`.card-time`, Kirmes, Platzhalterbild `leer.jpg`),
 * Weida-Land (Verbandsgemeinde, „bis 23:59 Uhr"), Muldestausee („von 14:00
 * Uhr bis 14:00 Uhr"), Lützen („10.05. - 15.11.2026"), Laatzen (kompakte
 * Kachel ohne Uhrzeit, Uhrzeit von der Detailseite, Bürgersprechstunde).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { geocmsDetailWhen, geocmsWhen, parseGeocmsList } from '@/lib/scrapers/de/geocms';
import { GeocmsDeScraper, geocmsGroups, withoutGeocmsPlaceholders } from '@/lib/scrapers/de/GeocmsDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'geocms', `${f}.html`), 'utf8');

const KAL = {
  sibbesse: { url: 'https://www.sibbesse.de/de/veranstaltungskalender-link.html', members: [['03254045', 'Sibbesse', 'niedersachsen']] },
  koethen: { url: 'https://www.koethen-anhalt.de/de/veranstaltungen.html', members: [['15082180', 'Köthen (Anhalt), Stadt', 'sachsen-anhalt']] },
  gerstungen: { url: 'https://www.gerstungen.de/de/veranstaltungen.html', members: [['16063097', 'Gerstungen', 'thueringen']] },
  'weida-land': {
    url: 'https://www.weida-land.de/de/veranstaltungen.html',
    members: [['15088030', 'Barnstädt', 'sachsen-anhalt'], ['15088100', 'Farnstädt', 'sachsen-anhalt'], ['15088250', 'Nemsdorf-Göhrendorf', 'sachsen-anhalt'], ['15088265', 'Obhausen', 'sachsen-anhalt'], ['15088355', 'Schraplau, Stadt', 'sachsen-anhalt']],
  },
  muldestausee: { url: 'https://www.gemeinde-muldestausee.de/de/veranstaltungskalender.html', members: [['15082241', 'Muldestausee', 'sachsen-anhalt']] },
  luetzen: { url: 'https://www.stadt-luetzen.de/de/veranstaltungen.html', members: [['15084315', 'Lützen, Stadt', 'sachsen-anhalt']] },
  laatzen: { url: 'https://www.laatzen.de/de/veranstaltungskalender.html', members: [['03241009', 'Laatzen, Stadt', 'niedersachsen']] },
} as const;
type Kal = keyof typeof KAL;

const group = (k: Kal): FeedGroup => ({
  feedUrl: KAL[k].url,
  pageUrl: KAL[k].url,
  own: KAL[k].members.map(([ags, name, land]) => ({
    ags, name, land, url: KAL[k].url, host: new URL(KAL[k].url).host.replace(/^www\./, ''), stufe: 'B', integration: 'geocms', checked_at: '2026-10-28',
  }) as RegistryEntryDe),
  viaVerband: [],
});
const page = (k: Kal) => parseGeocmsList(fx(k), KAL[k].url);
const termin = (k: Kal, title: string) => page(k).termine.find(t => t.title === title)!;

type Row = {
  source_id: string; source_url: string; start_date: string; end_date: string | null; publish_status: string; country: string;
  image_url: string | null; location_name: string | null;
  location_resolution: { gemeinde: { name: string } | null; admission?: { reasons: string[] } };
};
const rowsCache = new Map<Kal, Row[]>();
// Je Kalender einmal durch den Schreibweg (der Resolver ist teuer).
const rows = (k: Kal): Row[] => {
  if (!rowsCache.has(k)) rowsCache.set(k, new GeocmsDeScraper().toScrapedAll(page(k).termine, group(k)).map(e => toSupabaseRow(e, new Map(), new Map()).row as unknown as Row));
  return rowsCache.get(k)!;
};
const row = (k: Kal, title: string) => {
  const t = termin(k, title);
  return rows(k).find(r => r.source_url === t.url)!;
};

// Die Fixtures stammen vom 30.10.2026 und listen Termine an diesem Tag.
// Der Freigabevertrag misst gegen die Uhr (start_in_past); sie steht
// deshalb auf dem Abrufdatum, sonst kippen die Zeilen mit jedem Tag.
beforeAll(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-30T12:00:00Z') }));
afterAll(() => vi.useRealTimers());

describe('GeoCMS: Liste lesen', () => {
  it('Bootstrap-Karte (Sibbesse): Termin-ID und Tag aus dem Link, „ab 17:30 Uhr" als Beginn, Ort, Pager', () => {
    const p = page('sibbesse');
    expect(p).toMatchObject({ isList: true, main: true, pages: ['https://www.sibbesse.de/de/vak.html?btp_event%5Bp_2_400_1222%5D=10'] });
    expect(p.termine).toHaveLength(10);
    expect(termin('sibbesse', 'Laternenumzug (Ortsfeuerwehr Segeste)')).toMatchObject({
      url: 'https://www.sibbesse.de/de/vak/event/13293,1222/laternenumzug-ortsfeuerwehr-segeste-04-11-2026.html',
      id: '13293', localDate: '2026-11-04', start: '2026-11-04T16:30:00.000Z', allDay: false,
      locationName: 'Feuerwehr- und Dorfgemeinschaftshaus Segeste', timeOnDetail: false,
    });
    expect(termin('sibbesse', 'Laternenumzug (Ortsfeuerwehr Segeste)').end).toBeUndefined();
    expect(termin('sibbesse', 'Frauenkreis (Kirchengemeinde Eberholzen)')).toMatchObject({ start: '2026-10-30', allDay: true, timeOnDetail: false });
  });

  it('älteres Theme (Köthen): „01. bis 31. Oktober 2026, von 10:00 Uhr bis 18:00 Uhr", Rubriken, Pager', () => {
    const p = page('koethen');
    expect(p.termine).toHaveLength(20);
    expect(p.pages).toEqual([20, 40, 60].map(n => `https://www.koethen-anhalt.de/de/veranstaltungen.html?gcevent%5Bpager%5D=${n}`));
    expect(termin('koethen', 'Lesestart Set kostenlos erhältlich in der Kinderbibliothek Köthen')).toMatchObject({
      id: '81338', start: '2026-10-01T08:00:00.000Z', end: '2026-10-31T17:00:00.000Z',
      categories: ['Familien und Kinder', 'Kunst, Kultur und Literatur'],
    });
  });

  it('`.card-date` und `.card-time` (Gerstungen): Kirmes mehrtägig ganztägig, Uhrzeit aus der Zeitzeile', () => {
    expect(termin('gerstungen', 'Kirmes in OBERELLEN')).toMatchObject({
      start: '2026-10-30', end: '2026-11-01', allDay: true, locationName: 'Festzelt in Oberellen', categories: ['Musik', 'Volksfeste'],
    });
    expect(termin('gerstungen', 'Eröffnung der Bibliothek in GERSTUNGEN')).toMatchObject({ start: '2026-10-31T09:00:00.000Z', end: '2026-10-31T15:00:00.000Z' });
  });

  it('„bis 23:59 Uhr" ohne Beginn ist ganztägig (Weida-Land)', () => {
    expect(termin('weida-land', 'Neue Sonderausstellung im Kulturhistorischen Museum')).toMatchObject({ start: '2026-09-03', end: '2026-11-01', allDay: true });
  });

  it('Tag ohne Jahr in der Spanne: „10.05. - 15.11.2026" (Lützen)', () => {
    expect(termin('luetzen', 'Veranstaltungen 2026')).toMatchObject({ start: '2026-05-10T12:30:00.000Z', end: '2026-11-15T17:00:00.000Z' });
  });

  it('kompakte Kachel ohne Uhrzeit und Jahr (Laatzen): Uhrzeit nur auf der Detailseite', () => {
    const t = termin('laatzen', 'Laternenfest');
    expect(t).toMatchObject({ localDate: '2026-10-30', allDay: true, timeOnDetail: true, locationName: 'Park der Sinne' });
    expect(geocmsDetailWhen(fx('laatzen-laternenfest'), '2026-10-30')).toEqual({ localDate: '2026-10-30', start: '2026-10-30T16:30:00.000Z', allDay: false });
    // Ein anderer Tag auf der Detailseite: die Liste gilt.
    expect(geocmsDetailWhen(fx('laatzen-laternenfest'), '2026-10-31')).toBeNull();
  });

  it('Detailseite im älteren Theme (Köthen „Eisbjörn"): „von 17:00 Uhr bis 17:30 Uhr"', () => {
    expect(geocmsDetailWhen(fx('koethen-eisbjoern'), '2026-11-05')).toEqual({
      localDate: '2026-11-05', start: '2026-11-05T16:00:00.000Z', end: '2026-11-05T16:30:00.000Z', allDay: false,
    });
  });

  it('Seite ohne Liste nennt ihren Kalender; ein Kasten am Rand ist nicht der Hauptbereich (Merseburg)', () => {
    const html = '<div class="btp_event modularea-right view-listview"><div class="card"><h4 class="card-title"><a href="/de/detailseite/event/145299,1055/tanz-im-keller-30-10-2026.html">Tanz im Keller</a></h4>'
      + '<div class="card-text date"><i data-info="ticket"></i> 30.10.2026 ab 20:30 Uhr</div></div></div>'
      + '<a href="//www.merseburg.de/de/veranstaltungskalender.html">Veranstaltungskalender</a><a href="/de/veranstaltungsreihen.html">Reihen</a>';
    const p = parseGeocmsList(html, 'https://www.merseburg.de/de/veranstaltungsreihen.html');
    expect(p).toMatchObject({ isList: true, main: false, calendarLinks: ['https://www.merseburg.de/de/veranstaltungskalender.html'] });
    expect(p.termine[0]).toMatchObject({ id: '145299', start: '2026-10-30T19:30:00.000Z' });
  });

  it('Detail-Links mit Pager-Parameter sind keine Folgeseite (Braunsbedra, Seite 2)', () => {
    const html = '<div class="btp_event modularea-main view-listview"><div class="card"><h4 class="card-title">'
      + '<a href="/de/veranstaltung/event/53275,1243/saale-beratungs-mobil-60-05-01-2027.html?btp_event%5Bp_3_24_1243%5D=15">Saale-Beratungs-Mobil 60+</a></h4>'
      + '<div class="card-text date"><i data-info="ticket"></i> 05.01.2027 von 09:00 Uhr bis 11:00 Uhr</div></div>'
      + '<nav><a class="page-link" href="/de/veranstaltung.html?btp_event%5Bp_3_24_1243%5D=30">3</a></nav></div>';
    const p = parseGeocmsList(html, 'https://www.braunsbedra.de/de/veranstaltung.html?btp_event%5Bp_3_24_1243%5D=15');
    expect(p.pages).toEqual(['https://www.braunsbedra.de/de/veranstaltung.html?btp_event%5Bp_3_24_1243%5D=30']);
    expect(p.termine[0]).toMatchObject({ url: 'https://www.braunsbedra.de/de/veranstaltung/event/53275,1243/saale-beratungs-mobil-60-05-01-2027.html', start: '2027-01-05T08:00:00.000Z' });
  });

  it('Liste ohne Treffer ist eine Liste (Raguhn-Jeßnitz)', () => {
    expect(parseGeocmsList('<div class="gc_gcevent modularea-main view-listview_no_result"><p>Keine Veranstaltungen</p></div>', 'https://www.raguhn-jessnitz.de/de/veranstaltungen.html'))
      .toMatchObject({ isList: true, main: true, termine: [] });
  });
});

describe('GeoCMS: Datum und Uhrzeit', () => {
  it('Formen der Datumszeile', () => {
    expect(geocmsWhen('2026-10-30', 'ticket 30.10.2026 ab 18:00 Uhr')).toEqual({ localDate: '2026-10-30', start: '2026-10-30T17:00:00.000Z', allDay: false });
    expect(geocmsWhen('2026-10-17', '17.10.2026 - 12.12.2026 von 09:30 Uhr bis 11:00 Uhr')).toMatchObject({ start: '2026-10-17T07:30:00.000Z', end: '2026-12-12T10:00:00.000Z' });
    expect(geocmsWhen('2026-10-30', 'Fr 30. Okt')).toEqual({ localDate: '2026-10-30', start: '2026-10-30', allDay: true });
    expect(geocmsWhen('2026-12-31', '31.12.2026 von 20:00 Uhr bis 02:00 Uhr')).toEqual({ localDate: '2026-12-31', start: '2026-12-31T19:00:00.000Z', allDay: false });
  });

  it('Sommerzeit: 18:00 Uhr am 20.06.2027 ist 16:00 UTC', () => {
    expect(geocmsWhen('2027-06-20', '20.06.2027 ab 18:00 Uhr')).toMatchObject({ start: '2027-06-20T16:00:00.000Z' });
  });

  it('Ende gleich Beginn bleibt offen; mehrtägig dann bis zum letzten Tag (Muldestausee)', () => {
    expect(geocmsWhen('2026-10-31', '31.10.2026 von 14:00 Uhr bis 14:00 Uhr')).toEqual({ localDate: '2026-10-31', start: '2026-10-31T13:00:00.000Z', allDay: false });
    expect(termin('muldestausee', '26. Drachenbootfest')).toMatchObject({ start: '2026-08-22T08:00:00.000Z', end: '2026-11-28T17:00:00.000Z' });
  });
});

// Der Schreibweg (Resolver, Kontext) braucht je Zeile einige zehn Millisekunden.
describe('GeoCMS: Termin → Zeile', { timeout: 30_000 }, () => {
  it('Gemeinde des Kalenders, source_id aus der Termin-ID, Quelle ist die Detailseite (Sibbesse, Dorffest)', () => {
    const r = row('sibbesse', 'Laternenumzug (Ortsfeuerwehr Segeste)');
    expect(r).toMatchObject({
      source_id: 'geocms-sibbesse.de-13293',
      source_url: 'https://www.sibbesse.de/de/vak/event/13293,1222/laternenumzug-ortsfeuerwehr-segeste-04-11-2026.html',
      country: 'DE', start_date: '2026-11-04T16:30:00.000Z',
    });
    expect(r.location_resolution.gemeinde?.name).toBe('Sibbesse');
    expect(r.publish_status).toMatch(/^published/);
  });

  it('Verbandsgemeinde: nur die Gemeinde, die der Termin nennt (Weida-Land „Halloween Geisterhaus" in Obhausen)', () => {
    expect(row('weida-land', 'Halloween Geisterhaus im Obhäuser Feuerwehr-Gerätehaus').location_resolution.gemeinde?.name).toBe('Obhausen');
    // „Kulturhistorisches Museum Schloss Merseburg" nennt keine Gemeinde des Verbands: kein Ort.
    expect(row('weida-land', 'Neue Sonderausstellung im Kulturhistorischen Museum').location_resolution.gemeinde).toBeNull();
  });

  it('Gemeinde-Dienst geht in Quarantäne (Laatzen „Bürgersprechstunde")', () => {
    const r = row('laatzen', 'Bürgersprechstunde');
    expect(r.publish_status).not.toMatch(/^published/);
    expect(r.location_resolution.admission?.reasons).toContain('municipal_service');
  });

  it('Platzhalterbild an mehreren Terminen fällt weg (Gerstungen `leer.jpg`), eigenes Bild bleibt', () => {
    expect(row('gerstungen', 'Weihnachtsmarkt in FÖRTHA').image_url).toBeNull();
    expect(row('gerstungen', 'Kirmes in OBERELLEN').image_url).toMatch(/kirmes_oberellen_2026\.jpg$/);
  });

  it('derselbe Dateiname unter neuen IDs an drei Terminen ist ein Platzhalter (Königswinter VHS-Logo)', () => {
    const t = (title: string, id: string) => ({ title, image: `https://www.koenigswinter.de/de/datei/zuschneiden/100x100/id/${id},1081/7gebirge_untereinander_k.png` });
    expect(withoutGeocmsPlaceholders([t('A', '1'), t('B', '2'), t('C', '3')]).map(x => x.image)).toEqual([undefined, undefined, undefined]);
    expect(withoutGeocmsPlaceholders([t('A', '1'), t('B', '2')]).every(x => x.image)).toBe(true);
  });

  it('source_ids eines Kalenders sind eindeutig', () => {
    for (const k of Object.keys(KAL) as Kal[]) {
      const ids = rows(k).map(r => r.source_id);
      expect(new Set(ids).size, k).toBe(ids.length);
    }
  });
});

describe('GeoCMS: Kalender der Registry', () => {
  it('Gemeinden mit derselben Seite teilen eine Gruppe, Ausweichweg über die Verbandsgemeinde', () => {
    const e = (ags: string, url: string, fallback?: RegistryEntryDe['fallback']): RegistryEntryDe => ({
      ags, name: ags, land: 'sachsen-anhalt', host: 'weida-land.de', stufe: 'B', integration: fallback ? 'keine' : 'geocms', url: fallback ? null : url, checked_at: '2026-10-28', ...(fallback ? { fallback } : {}),
    }) as RegistryEntryDe;
    const url = KAL['weida-land'].url;
    const groups = geocmsGroups([e('15088030', url), e('15088100', url), e('15088265', '', { kind: 'verband', host: 'weida-land.de', integration: 'geocms', url } as RegistryEntryDe['fallback'])]);
    expect(groups.map(g => [g.pageUrl, g.own.length, g.viaVerband.length])).toEqual([[url, 2, 1]]);
  });
});
