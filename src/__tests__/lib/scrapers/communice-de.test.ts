/**
 * DE-Adapter communice (fn-29.8), Golden-Tests auf echten Kalenderlisten
 * (abgerufen 2026-10-30, gekürzt auf die communice-Kennung aus `<head>` und
 * `<main>`): Amt Mitteldithmarschen (neue Vorlage, Amtskalender mit
 * Gemeinde-Etiketten), Wacken (alte Vorlage, eigener Kalender, Laubannahme),
 * Markt Babenhausen (alte Vorlage, Kalender für zwei Gemeinden, mehrtägig
 * ohne Jahr), Teisendorf (neue Vorlage, mehrtägig mit Uhrzeit), Bad Segeberg
 * (leer); dazu Detailseite und iCal „Christkindlmarkt im Schloss Babenhausen".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  communiceCalendarUrl, communiceIcalHref, communicePageUrl, communiceSlug, communiceStartWithoutYear,
  communiceStartYear, communiceWhen, parseCommuniceList,
} from '@/lib/scrapers/de/communice';
import { CommuniceDeScraper, acrossCalendars, communiceGroups, labelGemeinde } from '@/lib/scrapers/de/CommuniceDeScraper';
import { feedGemeinden } from '@/lib/scrapers/de/kontext';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string, ext = 'html') => readFileSync(join(__dirname, 'fixtures', 'communice', `${f}.${ext}`), 'utf8');

const MD = 'https://www.mitteldithmarschen.de/tourismus-naherholung/touristinformation/veranstaltungskalender';
const KAL = {
  mitteldithmarschen: MD,
  wacken: 'https://www.wacken.de/veranstaltungen',
  babenhausen: 'https://www.babenhausen-schwaben.de/freizeit-geniessen/was-ist-los-in-babenhausen/veranstaltungskalender',
  teisendorf: 'https://www.teisendorf.org/freizeit-tourismus/veranstaltungen',
} as const;
type Kal = keyof typeof KAL;

const reg = (ags: string, name: string, land: string, url: string, integration = 'communice'): RegistryEntryDe => ({
  ags, name, land, host: new URL(url).host.replace(/^www\./, ''), stufe: 'A', integration, url, checked_at: '2026-10-28',
});
// Registry-Einträge wie in data/de-gemeinde-registry.json (Auszug).
const GROUPS: Record<Kal, FeedGroup> = {
  mitteldithmarschen: { feedUrl: MD, pageUrl: MD, own: [reg('01051002', 'Arkebek', 'schleswig-holstein', MD), reg('01051098', 'Sarzbüttel', 'schleswig-holstein', MD)], viaVerband: [] },
  wacken: { feedUrl: KAL.wacken, pageUrl: KAL.wacken, own: [reg('01061107', 'Wacken', 'schleswig-holstein', KAL.wacken)], viaVerband: [] },
  babenhausen: { feedUrl: KAL.babenhausen, pageUrl: KAL.babenhausen, own: [reg('09778115', 'Babenhausen, M', 'bayern', KAL.babenhausen), reg('09778152', 'Kirchhaslach', 'bayern', KAL.babenhausen)], viaVerband: [] },
  teisendorf: { feedUrl: KAL.teisendorf, pageUrl: KAL.teisendorf, own: [reg('09172134', 'Teisendorf, M', 'bayern', KAL.teisendorf)], viaVerband: [] },
};

const page = (k: Kal) => parseCommuniceList(fx(k), KAL[k]);
const termin = (k: Kal, title: string) => page(k).termine.find(t => t.title === title)!;

type Row = {
  source_id: string; source_url: string; start_date: string; end_date: string | null; publish_status: string; country: string;
  location_name: string | null; image_url: string | null; image_credit: string | null;
  location_resolution: { gemeinde: { name: string } | null; admission?: { reasons: string[] } };
};
const row = (k: Kal, title: string) => {
  const t = termin(k, title);
  const w = communiceWhen(t.dateText)!;
  return toSupabaseRow(new CommuniceDeScraper().toScraped({ ...t, ...w }, GROUPS[k]), new Map(), new Map()).row as unknown as Row;
};

describe('communice: Liste lesen', () => {
  it('neue Vorlage (Mitteldithmarschen): zwölf Termine, Pager bis Seite 18', () => {
    const p = page('mitteldithmarschen');
    expect(p).toMatchObject({ isList: true, lastPage: 18 });
    expect(p.termine).toHaveLength(12);
    expect(communicePageUrl(p.pagerTemplate!, 7)).toBe(`${MD}/seite-7`);
  });

  it('Termin mit Ort, Etiketten (Gemeinde + Rubrik), Bild und Detailseite', () => {
    expect(termin('mitteldithmarschen', 'Wochenmarkt')).toMatchObject({
      url: `${MD}/veranstaltung/wochenmarkt-5`, slug: 'wochenmarkt-5', dateText: '30.10.2026 08:00 Uhr',
      locationName: 'Südermarkt', labels: ['Meldorf', 'Markt'],
      image: 'https://www.mitteldithmarschen.de/fileadmin/_processed_/f/d/csm_Wochenmarkt_3_d5001150c2.webp',
    });
  });

  it('alte Vorlage (Wacken): Ort im Datumsblock, Etiketten, Pager', () => {
    const p = page('wacken');
    expect(p).toMatchObject({ isList: true, lastPage: 5, pagerTemplate: 'https://www.wacken.de/veranstaltungen/seite-2' });
    expect(termin('wacken', 'Laternenumzug')).toMatchObject({ dateText: '06.11.2026', locationName: 'Feuerwehr Wacken', labels: ['Feuerwehr', 'Kultur', 'Kinder & Jugendliche'] });
  });

  it('abgeschnittener Anrisstext („…") ist keine Beschreibung (Babenhausen)', () => {
    expect(termin('babenhausen', 'Regelmäßige Veranstaltungen und Beratung und Hilfe').description).toBeUndefined();
    expect(termin('babenhausen', 'KJR Unterallgäu: Mini Camp- Herbstabenteuer').description).toMatch(/^Ein kompaktes Outdoor-Programm/);
  });

  it('leerer Kalender ist ein Kalender (Bad Segeberg „Keine Veranstaltung gefunden")', () => {
    expect(parseCommuniceList(fx('bad-segeberg'), 'https://www.bad-segeberg.de/veranstaltungen')).toMatchObject({ isList: true, termine: [], lastPage: 1 });
  });

  it('Seite ohne communice-Liste ist kein Kalender', () => {
    expect(parseCommuniceList('<main><section class="calendar-list"><article class="event"></article></section></main>', 'https://x.de/')).toMatchObject({ isList: false, termine: [] });
  });
});

describe('communice: Datum und Uhrzeit', () => {
  it('ohne Uhrzeit ganztägig (Churchnight; der Atom-Feed nennt 12:10, die Anlagezeit)', () => {
    expect(communiceWhen(termin('mitteldithmarschen', 'Churchnight').dateText)).toEqual({ localDate: '2026-10-30', start: '2026-10-30', allDay: true });
  });

  it('„00:00 Uhr" ohne Ende ist ganztägig (Reichertsheim „Nikolausdienst Landvolk Ramsau")', () => {
    expect(communiceWhen('06.12.2026 00:00 Uhr')).toEqual({ localDate: '2026-12-06', start: '2026-12-06', allDay: true });
    expect(communiceWhen('31.12.2026 00:00 Uhr – 02:00 Uhr')).toMatchObject({ allDay: false });
  });

  it('Uhrzeit als Ortszeit: 18:31 Uhr am 30.10.2026 ist 17:31 UTC (Winterzeit)', () => {
    expect(communiceWhen(termin('mitteldithmarschen', 'Laternelaufen/ Martinsumzug').dateText)).toMatchObject({ start: '2026-10-30T17:31:00.000Z', allDay: false });
  });

  it('Beginn und Ende am selben Tag (alte Vorlage)', () => {
    expect(communiceWhen('06.11.2026 09:00 Uhr – 19:00 Uhr')).toEqual({ localDate: '2026-11-06', start: '2026-11-06T08:00:00.000Z', end: '2026-11-06T18:00:00.000Z', allDay: false });
  });

  it('Sommerzeit: 18:00 Uhr am 20.06.2027 ist 16:00 UTC', () => {
    expect(communiceWhen('20.06.2027 18:00 Uhr')).toMatchObject({ start: '2027-06-20T16:00:00.000Z' });
  });

  it('mehrtägig: die Liste lässt das Jahr des Beginns weg, ohne Jahr kein Termin', () => {
    const steinzeit = termin('mitteldithmarschen', 'Veranstaltungen im Steinzeitpark').dateText;
    expect(steinzeit).toBe('14.11. – 31.12.2026');
    expect(communiceWhen(steinzeit)).toBeNull();
    expect(communiceStartWithoutYear(steinzeit)).toEqual({ day: '14', month: '11' });
    // Teisendorf: Strich ohne Leerzeichen davor.
    const rep = termin('teisendorf', 'Reperaturcafe in Teisendorf').dateText;
    expect(communiceStartWithoutYear(rep)).toEqual({ day: '16', month: '03' });
    expect(communiceWhen(rep, '2026')).toEqual({ localDate: '2026-03-16', start: '2026-03-16T09:20:00.000Z', end: '2026-12-31T17:00:00.000Z', allDay: false });
  });

  it('mehrtägig ganztägig mit Jahr aus dem iCal; ein Ende vor dem Beginn bleibt offen (Christkindlmarkt Babenhausen)', () => {
    // Listenzeile wie auf Seite 2 der Liste und auf der Detailseite.
    const t = { dateText: '05.12. – 07.12.2025' };
    const detailUrl = `${KAL.babenhausen}/veranstaltung/weihnachtsmarkt-gewerberegion-babenhausen-schrannenstrasse-platz-vor-dem-roessle-319-1-1`;
    const ical = communiceIcalHref(fx('babenhausen-christkindlmarkt'), detailUrl);
    expect(ical).toMatch(/\/veranstaltung\/ical-download\?tx_communicecalendar_calendarical%5Baction%5D=ical&.*eventlist%5D=9&cHash=/);
    const year = communiceStartYear(fx('babenhausen-christkindlmarkt', 'ics'), communiceStartWithoutYear(t.dateText)!);
    expect(year).toBe('2026');
    expect(communiceWhen(t.dateText, year!)).toEqual({ localDate: '2026-12-05', start: '2026-12-05', allDay: true });
    // Passen Tag und Monat nicht, gibt es kein Jahr.
    expect(communiceStartYear(fx('babenhausen-christkindlmarkt', 'ics'), { day: '06', month: '12' })).toBeNull();
  });
});

describe('communice: Termin → Zeile', () => {
  it('Amtskalender: Etikett nennt die Gemeinde (Sarzbüttel), source_id aus dem Pfad der Detailseite', () => {
    const r = row('mitteldithmarschen', 'Laternelaufen/ Martinsumzug');
    expect(r).toMatchObject({
      source_id: 'communice-mitteldithmarschen.de-laternelaufen-41', source_url: `${MD}/veranstaltung/laternelaufen-41`,
      start_date: '2026-10-30T17:31:00.000Z', country: 'DE', location_name: 'Blockhaus',
    });
    expect(r.location_resolution.gemeinde?.name).toBe('Sarzbüttel');
    expect(r.publish_status).toMatch(/^published/);
  });

  it('Etikett Bargenstedt, Veranstaltungsort Heide: der Ort gilt (Churchnight)', () => {
    expect(row('mitteldithmarschen', 'Churchnight').location_resolution.gemeinde?.name).toBe('Heide');
  });

  it('Bild mit Website als Bildnachweis', () => {
    expect(row('mitteldithmarschen', 'Wochenmarkt')).toMatchObject({ image_credit: 'mitteldithmarschen.de', location_resolution: { gemeinde: { name: 'Meldorf' } } });
  });

  it('eigener Kalender: Gemeinde des Kalenders; „Laternenumzug Schenefeld" am Feuerwehrgerätehaus Schenefeld', () => {
    expect(row('wacken', 'Laternenumzug').location_resolution.gemeinde?.name).toBe('Wacken');
    expect(row('wacken', 'Laternenumzug Schenefeld').location_resolution.gemeinde?.name).toBe('Schenefeld');
  });

  it('Laubannahme am Bauhof: Quarantäne municipal_service', () => {
    const r = row('wacken', 'Laubannahme');
    expect(r.location_resolution.admission?.reasons).toContain('municipal_service');
    expect(r.publish_status).not.toMatch(/^published/);
  });

  it('Kalender für zwei Gemeinden ohne Ortsnennung: kein Ort, Quarantäne (Babenhausen/Kirchhaslach)', () => {
    const r = row('babenhausen', 'DAV Ortsgruppe Babenhausen: Kletterhalle-Ottobeuren, Klettern');
    expect(r.location_resolution.gemeinde).toBeNull();
    expect(r.publish_status).not.toMatch(/^published/);
  });

  it('dieselbe Detailseite an zwei Tagen ohne Datum in der URL: Tag in der source_id', () => {
    const t = termin('wacken', 'Laternenumzug');
    const a = { ...t, ...communiceWhen('06.11.2026')! };
    const b = { ...t, ...communiceWhen('13.11.2026')! };
    const ids = new CommuniceDeScraper().toScrapedAll([a, b], GROUPS.wacken).map(e => e.source_id);
    expect(ids).toEqual(['communice-wacken.de-laternenumzug-2026-11-06', 'communice-wacken.de-laternenumzug-2026-11-13']);
  });
});

describe('communice: derselbe Termin auf mehreren Gemeinde-Websites', () => {
  // Amt Schenefeld: wacken.de und vaale.de zeigen denselben Datensatz
  // (Prüfstand 2026-10-30, vaale.de/veranstaltungen/veranstaltung/laternenumzug-schenefeld).
  const VAALE = 'https://www.vaale.de/veranstaltungen';
  const vaale: FeedGroup = { feedUrl: VAALE, pageUrl: VAALE, own: [reg('01061105', 'Vaale', 'schleswig-holstein', VAALE)], viaVerband: [] };
  const w = termin('wacken', 'Laternenumzug Schenefeld');
  const onWacken = { ...w, ...communiceWhen(w.dateText)! };
  const onVaale = { ...onWacken, url: `${VAALE}/veranstaltung/laternenumzug-schenefeld` };

  it('einmal, Vertreter ist der Kalender mit der kleinsten URL, Gemeinden beider Websites', () => {
    const out = acrossCalendars([{ group: GROUPS.wacken, termine: [onWacken] }, { group: vaale, termine: [onVaale] }]);
    expect(out).toHaveLength(1);
    expect(out[0].termin.url).toBe(onVaale.url);
    expect(out[0].group.own.map(e => e.name).sort()).toEqual(['Vaale', 'Wacken']);
  });

  it('Ort aus der Ortsangabe, nicht aus der Website (Schenefeld)', () => {
    const [x] = acrossCalendars([{ group: GROUPS.wacken, termine: [onWacken] }, { group: vaale, termine: [onVaale] }]);
    const r = toSupabaseRow(new CommuniceDeScraper().toScraped(x.termin, x.group), new Map(), new Map()).row as unknown as Row;
    expect(r.location_resolution.gemeinde?.name).toBe('Schenefeld');
    expect(r.source_id).toBe('communice-vaale.de-laternenumzug-schenefeld');
  });

  it('Kopie mit Zählsuffix ist derselbe Termin; anderer Ort nicht', () => {
    const copy = { ...onVaale, slug: 'laternenumzug-schenefeld-12', url: `${VAALE}/veranstaltung/laternenumzug-schenefeld-12` };
    expect(acrossCalendars([{ group: GROUPS.wacken, termine: [onWacken] }, { group: vaale, termine: [copy] }])).toHaveLength(1);
    const other = { ...copy, locationName: 'Dorfplatz' };
    expect(acrossCalendars([{ group: GROUPS.wacken, termine: [onWacken] }, { group: vaale, termine: [other] }])).toHaveLength(2);
  });
});

describe('communice: Kalender der Registry', () => {
  it('Detail-URL der Registry zeigt auf ihren Kalender (Wacken), Serien-Datum aus der URL', () => {
    expect(communiceCalendarUrl('https://www.wacken.de/veranstaltungen/veranstaltung/laubannahme/2026-11-07?cHash=97fac4be942a31f78f07c02dee75d049')).toBe('https://www.wacken.de/veranstaltungen');
    expect(communiceSlug('https://www.wacken.de/veranstaltungen/veranstaltung/laubannahme/2026-11-07?cHash=97')).toEqual({ slug: 'laubannahme', urlDate: '2026-11-07' });
  });

  it('ein Kalender je Seite; Amtskalender mit eigenen und Ausweich-Gemeinden', () => {
    const barlt: RegistryEntryDe = {
      ags: '01051006', name: 'Barlt', land: 'schleswig-holstein', host: 'barlt.de', stufe: 'V', integration: 'leer', url: null, checked_at: '2026-10-28',
      fallback: { kind: 'verband', host: 'mitteldithmarschen.de', integration: 'communice', url: MD, feed_url: `${MD}/rss` },
    };
    const gs = communiceGroups([...GROUPS.mitteldithmarschen.own, barlt, reg('01061107', 'Wacken', 'schleswig-holstein', 'https://www.wacken.de/veranstaltungen/veranstaltung/laubannahme/2026-11-07?cHash=97')]);
    expect(gs.map(g => [g.pageUrl, g.own.length, g.viaVerband.length])).toEqual([[MD, 2, 1], ['https://www.wacken.de/veranstaltungen', 1, 0]]);
  });

  it('Etikett nur, wenn es genau eine Gemeinde des Kalenders nennt', () => {
    const members = feedGemeinden(GROUPS.mitteldithmarschen.own);
    expect(labelGemeinde(['Tensbüttel-Röst', 'Kultur'], members)?.name).toBe('Tensbüttel-Röst');
    expect(labelGemeinde(['Kultur', 'Natur'], members)).toBeNull();
    expect(labelGemeinde(['Elpersbüttel', 'Meldorf', 'Natur'], members)).toBeNull();
  });
});
