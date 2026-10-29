/**
 * DE-Adapter verwaltungsportal.de (fn-29.11), Golden-Tests auf echten
 * Seiten (abgerufen 2026-10-29): Listen in drei Layouts (Remptendorf,
 * Breitungen, Heiligengrabe, gekürzt auf den Inhalt) und Druckansichten
 * der Detailseiten aus neun Gemeinden in vier Layouts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseVpDateLine, parseVpDetail, parseVpListLinks, vpCalendarHost, vpListUrls, vpOccurrence, vpPrintUrl, vpSameClock, type VpEvent, type VpLink,
} from '@/lib/scrapers/de/verwaltungsportal';
import { spreadSample, VerwaltungsportalDeScraper, vpGroups, type VpGroup } from '@/lib/scrapers/de/VerwaltungsportalDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'verwaltungsportal', f), 'utf8');

/** Link wie aus der Liste: `/veranstaltungen/<ID>/<JJJJ>/<MM>/<TT>/<slug>`. */
const link = (path: string): VpLink => {
  const m = /^\/veranstaltungen\/(\d+)\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(path)!;
  return { id: m[1], date: `${m[2]}-${m[3]}-${m[4]}`, path };
};

function detail(file: string, origin: string, path: string): VpEvent {
  const r = parseVpDetail(fx(file), link(path), origin);
  if ('skip' in r) throw new Error(r.skip);
  return r.event;
}

describe('verwaltungsportal: Liste', () => {
  it('Layout events-box (Remptendorf): Termin-Links je Tag, Serie mit einer ID', () => {
    const links = parseVpListLinks(fx('list-remptendorf.html'), 'https://www.remptendorf.de/veranstaltungen/index.php');
    expect(links).toContainEqual(expect.objectContaining({ id: '2981205', date: '2026-10-29', path: '/veranstaltungen/2981205/2026/10/29/kirmes-ruppersdorf-2026' }));
    // „Digital dabei" steht sechsmal mittwochs in der Liste.
    expect(links.filter(l => l.id === '2980180').map(l => l.date)).toEqual(['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25', '2026-12-02', '2026-12-09']);
    // Uhrzeit am Eintrag („16:30 Uhr bis 19:30 Uhr“), leer ohne Uhrzeit (Kirmes)
    expect(links.find(l => l.id === '2980180')?.listClock).toBe('16:30-19:30');
    expect(links.find(l => l.id === '2981205')?.listClock).toBe('');
    expect(new Set(links.map(l => l.path)).size).toBe(links.length);
    expect(links.every(l => !l.path.includes('?'))).toBe(true);
  });

  it('Layout event-entry-new-2 (Breitungen) und events-entry-3 (Heiligengrabe, Umlaut im Pfad)', () => {
    const b = parseVpListLinks(fx('list-breitungen.html'), 'https://www.breitungen.de/veranstaltungen/index.php');
    expect(b).toContainEqual(expect.objectContaining({ id: '2914156', date: '2026-10-29', path: '/veranstaltungen/2914156/2026/10/29/kirche-mal-anders-kochen-mit-liebe' }));
    const h = parseVpListLinks(fx('list-heiligengrabe.html'), 'https://www.heiligengrabe.de/veranstaltungen/index.php');
    expect(h.find(l => l.id === '2824896' && l.date === '2026-10-29')?.path).toBe('/veranstaltungen/2824896/2026/10/29/rommé--skat-und-kartennachmittag-in-heiligengrabe');
    // Breitungen zeigt Uhrzeiten, Heiligengrabe nicht (Layout ohne Uhrzeit: undefined)
    expect(b.find(l => l.id === '2914156')?.listClock).toBe('16:00-18:00');
    expect(h.every(l => l.listClock === undefined)).toBe(true);
  });

  it('Links anderer Websites zählen nicht', () => {
    const html = '<a href="https://www.nachbar.de/veranstaltungen/1/2026/11/01/fest">x</a><a href="/veranstaltungen/2/2026/11/02/markt">y</a>';
    expect(parseVpListLinks(html, 'https://remptendorf.de/veranstaltungen/index.php').map(l => l.id)).toEqual(['2']);
  });

  it('Druckansicht der Detailseite', () => {
    expect(vpPrintUrl('https://www.remptendorf.de', '/veranstaltungen/2981205/2026/10/29/kirmes-ruppersdorf-2026'))
      .toBe('https://www.remptendorf.de/veranstaltungen/2981205/2026/10/29/kirmes-ruppersdorf-2026?modus=drucken');
  });
});

describe('verwaltungsportal: Detailseite', () => {
  it('Dorffest „Kirmes Ruppersdorf 2026": mehrtägig ohne Uhrzeit, Gemeinde aus „Remptendorf OT Ruppersdorf", Bild mit Maßen', () => {
    const e = detail('remptendorf-kirmes-ruppersdorf.html', 'https://www.remptendorf.de', '/veranstaltungen/2981205/2026/10/29/kirmes-ruppersdorf-2026');
    expect(e).toMatchObject({
      url: 'https://www.remptendorf.de/veranstaltungen/2981205/2026/10/29/kirmes-ruppersdorf-2026',
      start: '2026-10-29', end: '2026-11-01', allDay: true,
      title: 'Kirmes Ruppersdorf 2026', locationName: 'Ruppersdorf', street: 'Ruppersdorf', postalCode: '07368', locality: 'Remptendorf',
      organizer: 'Feuerwehrverein Ruppersdorfer e.V.',
      image: 'https://fotos.verwaltungsportal.de/events/2/9/8/1/2/0/5/gross/Kirmes_Flyer_Ruppersdorf_2026-1.webp', imageWidth: 1190, imageHeight: 1683,
    });
  });

  it('„um 19:00 Uhr" im Winter (Remptendorf Faschingsauftakt, JSON-LD +0100)', () => {
    const e = detail('remptendorf-faschingsauftakt.html', 'https://www.remptendorf.de', '/veranstaltungen/2976683/2026/11/13/faschingsauftakt-in-remptendorf');
    expect(e).toMatchObject({ start: '2026-11-13T18:00:00.000Z', allDay: false, postalCode: '07368', locality: 'Remptendorf' });
    expect(e.end).toBeUndefined();
    expect(e.description).toContain('Start des Programms 20:11 Uhr');
  });

  it('Sommerzeit und Adresse im Ortsnamen (Fredersdorf-Vogelsdorf, 03.06.2027 um 19:00 Uhr)', () => {
    const e = detail('fredersdorf-ausschuss-sommer.html', 'https://www.fredersdorf-vogelsdorf.de', '/veranstaltungen/2978542/2027/06/03/x');
    expect(e).toMatchObject({
      start: '2027-06-03T17:00:00.000Z', locationName: 'Sitzungssaal, Verwaltungsgebäude', street: 'Lindenallee 3', postalCode: '15370', locality: 'Fredersdorf-Vogelsdorf',
    });
  });

  it('mehrtägig „bis 13.06.2027 von 18:00 – 00:00 Uhr": Ende um Mitternacht nach dem letzten Tag (Harzgerode)', () => {
    const e = detail('harzgerode-vereinsfest.html', 'https://www.harzgerode.de', '/veranstaltungen/2943752/2027/06/11/x');
    expect(e).toMatchObject({ start: '2027-06-11T16:00:00.000Z', end: '2027-06-13T22:00:00.000Z', allDay: false, street: 'Neudorfer Weg 1b', postalCode: '06493', locality: 'Stadt Harzgerode' });
  });

  it('mehrtägig mit früherer Endzeit endet am letzten Tag (Wörnersberg „bis 01.11.2026 von 18:30 – 13:30 Uhr")', () => {
    const e = detail('woernersberg-seminar.html', 'https://www.woernersberg.de', '/veranstaltungen/2753456/2026/10/29/x');
    expect(e).toMatchObject({ start: '2026-10-29T17:30:00.000Z', end: '2026-11-01T12:30:00.000Z', locality: 'Wörnersberg' });
  });

  it('eintägig „von 19:00 – 00:00 Uhr" endet um Mitternacht (Dagebüll)', () => {
    const e = detail('dagebuell-lotto.html', 'https://www.gemeinde-dagebuell.de', '/veranstaltungen/2984459/2026/11/13/x');
    expect(e).toMatchObject({ start: '2026-11-13T18:00:00.000Z', end: '2026-11-13T23:00:00.000Z', locationName: 'Hotel Neuwarft', postalCode: '25899' });
  });

  it('Layout single-view-1 mit Wochentag (Joldelund „Sa, 29.05.2027 um 08:00 Uhr")', () => {
    const e = detail('joldelund-ringreiten.html', 'https://www.joldelund.de', '/veranstaltungen/1641325/2027/05/29/x');
    expect(e).toMatchObject({ title: 'Ringreiten', start: '2027-05-29T06:00:00.000Z', postalCode: '25862', locality: 'Joldelund' });
  });

  it('Layout single-view-4: Tag und Uhrzeit getrennt (Mulfingen „So, 29.11.2026", „von 13:30 – 18:00 Uhr")', () => {
    const e = detail('mulfingen-weihnachtsmarkt.html', 'https://www.mulfingen.de', '/veranstaltungen/2786563/2026/11/29/x');
    expect(e).toMatchObject({ start: '2026-11-29T12:30:00.000Z', end: '2026-11-29T17:00:00.000Z', locationName: 'St. Josefspflege Mulfingen' });
  });

  it('Layout single-view-2 ohne „von" (Wandlitz „Do. 11.03.2027 10:00 – 11:30 Uhr")', () => {
    const e = detail('wandlitz-krabbelgruppe.html', 'https://www.wandlitz.de', '/veranstaltungen/2758751/2027/03/11/x');
    expect(e).toMatchObject({ start: '2027-03-11T09:00:00.000Z', end: '2027-03-11T10:30:00.000Z', locality: 'Wandlitz', street: 'Klosterfelder Hauptstraße 42' });
  });

  it('ohne Terminbild: og:image ist das Wappen der Gemeinde und gilt nicht (Haina)', () => {
    const e = detail('haina-terminabsprache.html', 'https://www.haina.de', '/veranstaltungen/2805617/2026/11/06/x');
    expect(e.image).toBeUndefined();
    expect(e.locality).toBe('Haina (Kloster)');
  });

  it('widersprechen sich Link und Seite, bleibt der Termin weg', () => {
    const r = parseVpDetail(fx('remptendorf-faschingsauftakt.html'), link('/veranstaltungen/2976683/2026/11/14/x'), 'https://www.remptendorf.de');
    expect(r).toEqual({ skip: 'Datum widerspricht sich: Link 2026-11-14, JSON-LD 2026-11-13, Zeile 2026-11-13' });
  });
});

describe('verwaltungsportal: Datumszeile', () => {
  it('bekannte Formen', () => {
    expect(parseVpDateLine('29.​10.​2026')).toEqual({ start: { date: '2026-10-29' } });
    expect(parseVpDateLine('29.10.2026 bis 01.11.2026')).toEqual({ start: { date: '2026-10-29' }, end: { date: '2026-11-01' } });
    expect(parseVpDateLine('Fr, 28.05.2027 um 17:30 Uhr')).toEqual({ start: { date: '2027-05-28', time: '17:30' } });
    expect(parseVpDateLine('11.11.2026 von 16:30 – 19:30 Uhr')).toEqual({ start: { date: '2026-11-11', time: '16:30' }, end: { date: '2026-11-11', time: '19:30' } });
  });

  it('Unbekanntes ergibt null statt einer geratenen Zeit', () => {
    expect(parseVpDateLine('')).toBeNull();
    expect(parseVpDateLine('jeden Mittwoch 16:30 Uhr')).toBeNull();
    expect(parseVpDateLine('01.11.2026 bis 29.10.2026')).toBeNull();
  });
});

describe('verwaltungsportal: Websites der Registry', () => {
  const entry = (o: Partial<RegistryEntryDe>): RegistryEntryDe => ({
    ags: '16075134', name: 'Remptendorf', land: 'thueringen', host: 'remptendorf.de', stufe: 'B', integration: 'verwaltungsportal',
    url: 'https://www.remptendorf.de/veranstaltungen/index.php', checked_at: '2026-10-28', ...o,
  });

  it('Kalender-URL der Registry: Modul von verwaltungsportal oder eigene Website, sonst die eigene Website', () => {
    expect(vpCalendarHost('https://www.amt-huerup.de/veranstaltungen/index.php', 'ausacker.de')).toBe('amt-huerup.de');
    expect(vpCalendarHost('https://www.luehe.de/seite/697402/veranstaltungskalender.html', 'luehe-online.de')).toBe('luehe.de');
    // Amtskalender in anderem CMS, Stylesheet-URL der Vollerhebung
    expect(vpCalendarHost('https://www.amt-burg-st-michaelisdonn.de/B%C3%BCrgerservice-Politik/Veranstaltungskalender/', 'grossenrade.de')).toBe('grossenrade.de');
    expect(vpCalendarHost('https://layout.verwaltungsportal.de/global/css/module/event/list-old.css?v=1', 'berkatal.de')).toBe('berkatal.de');
    expect(vpCalendarHost(null, 'www.buchholz-dithmarschen.de')).toBe('buchholz-dithmarschen.de');
  });

  it('Liste: bekannte URL zuerst, dann www/ohne www/http', () => {
    expect(vpListUrls('remptendorf.de', 'https://www.remptendorf.de/veranstaltungen/index.php')).toEqual([
      'https://www.remptendorf.de/veranstaltungen/index.php', 'https://remptendorf.de/veranstaltungen/index.php', 'http://www.remptendorf.de/veranstaltungen/index.php',
    ]);
  });

  it('drei Gemeinden auf der Amtswebsite sind ein Amtskalender', () => {
    const gs = vpGroups([
      entry({ ags: '01059103', name: 'Ausacker', land: 'schleswig-holstein', host: 'ausacker.de', url: 'https://www.amt-huerup.de/veranstaltungen/index.php' }),
      entry({ ags: '01059116', name: 'Großsolt', land: 'schleswig-holstein', host: 'grosssolt.de', url: 'https://www.amt-huerup.de/veranstaltungen/index.php' }),
      entry({ ags: '01059126', name: 'Hürup', land: 'schleswig-holstein', host: 'huerup.de', url: 'https://www.amt-huerup.de/veranstaltungen/index.php' }),
      entry({}),
    ]);
    expect(gs.map(g => [g.host, g.own.length])).toEqual([['amt-huerup.de', 3], ['remptendorf.de', 1]]);
  });
});

describe('verwaltungsportal: Termin → Zeile', () => {
  const remptendorf: VpGroup = {
    host: 'remptendorf.de', knownUrl: null, feedUrl: 'https://www.remptendorf.de/veranstaltungen/index.php', pageUrl: 'https://www.remptendorf.de/veranstaltungen/index.php',
    own: [{ ags: '16075134', name: 'Remptendorf', land: 'thueringen', host: 'remptendorf.de', stufe: 'B', integration: 'verwaltungsportal', url: null, checked_at: '2026-10-28' }],
    viaVerband: [],
  };

  it('Dorffest: Gemeinde Remptendorf, source_id je Website, Termin und Tag, Bildnachweis die Website', () => {
    const e = detail('remptendorf-kirmes-ruppersdorf.html', 'https://www.remptendorf.de', '/veranstaltungen/2981205/2026/10/29/kirmes-ruppersdorf-2026');
    const s = new VerwaltungsportalDeScraper().toScraped(e, remptendorf);
    expect(s).toMatchObject({
      source_name: 'de-verwaltungsportal', source_id: 'vp-remptendorf.de-2981205-2026-10-29', source_url: e.url, country: 'DE',
      image_credit: 'remptendorf.de', image_width: 1190, image_height: 1683, postal_code: '07368', city: 'Remptendorf',
    });
    const row = toSupabaseRow(s, new Map(), new Map()).row as unknown as { publish_status: string; location_resolution: { gemeinde: { name: string } | null } };
    expect(row.location_resolution.gemeinde?.name).toBe('Remptendorf');
    expect(row.publish_status).toMatch(/^published/);
  });

  it('Gemeinde-Dienst: „Bürgersprechstunde" (Fredersdorf-Vogelsdorf) geht in Quarantäne municipal_service', () => {
    const e = detail('fredersdorf-buergersprechstunde.html', 'https://www.fredersdorf-vogelsdorf.de', '/veranstaltungen/2925786/2026/11/02/x');
    const g: VpGroup = {
      ...remptendorf, host: 'fredersdorf-vogelsdorf.de',
      own: [{ ags: '12064136', name: 'Fredersdorf-Vogelsdorf', land: 'brandenburg', host: 'fredersdorf-vogelsdorf.de', stufe: 'B', integration: 'verwaltungsportal', url: null, checked_at: '2026-10-28' }],
    };
    const row = toSupabaseRow(new VerwaltungsportalDeScraper().toScraped(e, g), new Map(), new Map()).row as unknown as { publish_status: string; location_resolution: { admission?: { reasons: string[] } } };
    expect(row.location_resolution.admission?.reasons).toContain('municipal_service');
    expect(row.publish_status).not.toMatch(/^published/);
  });
});

describe('verwaltungsportal: Serien', () => {
  const origin = 'https://www.remptendorf.de';
  const first: VpLink = { ...link('/veranstaltungen/2976683/2026/11/13/faschingsauftakt-in-remptendorf'), listClock: '19:00' };
  const read = detail('remptendorf-faschingsauftakt.html', origin, first.path);

  it('weiterer Termin mit gleicher Uhrzeit in der Liste: abgeleitet, auch über die Zeitumstellung', () => {
    const later: VpLink = { ...link('/veranstaltungen/2976683/2027/04/02/faschingsauftakt-in-remptendorf'), listClock: '19:00' };
    expect(vpSameClock(read, first, later)).toBe(true);
    expect(vpOccurrence(read, later, origin)).toMatchObject({
      localDate: '2027-04-02', start: '2027-04-02T17:00:00.000Z', url: 'https://www.remptendorf.de/veranstaltungen/2976683/2027/04/02/faschingsauftakt-in-remptendorf',
    });
  });

  it('andere Uhrzeit in der Liste oder Layout ohne Uhrzeit: eigener Abruf', () => {
    expect(vpSameClock(read, first, { ...link('/veranstaltungen/2976683/2026/11/20/x'), listClock: '18:00' })).toBe(false);
    expect(vpSameClock(read, { ...first, listClock: undefined }, link('/veranstaltungen/2976683/2026/11/20/x'))).toBe(false);
    // Liste und Detailseite des gelesenen Termins müssen übereinstimmen
    expect(vpSameClock(read, { ...first, listClock: '20:00' }, { ...link('/veranstaltungen/2976683/2026/11/20/x'), listClock: '20:00' })).toBe(false);
  });

  it('mehrtägig ganztägig: Ende wandert mit', () => {
    const k = detail('remptendorf-kirmes-ruppersdorf.html', origin, '/veranstaltungen/2981205/2026/10/29/kirmes-ruppersdorf-2026');
    expect(vpOccurrence(k, link('/veranstaltungen/2981205/2027/10/28/kirmes-ruppersdorf-2026'), origin)).toMatchObject({ start: '2027-10-28', end: '2027-10-31' });
  });

  it('Stichprobe für den Prüfstand: gleichmäßig verteilt', () => {
    expect(spreadSample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3)).toEqual([1, 4, 7]);
    expect(spreadSample([1, 2], undefined)).toEqual([1, 2]);
  });
});
