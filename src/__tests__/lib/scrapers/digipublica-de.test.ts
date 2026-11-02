/**
 * DE-Adapter DigiPublica (fn-29.15), Golden-Tests auf echten Seiten des
 * Moduls „gdc" (abgerufen 2026-10-30, gekürzt auf Kalenderblatt und Liste,
 * Vorschaubilder entfernt): Boos und Fellheim (VGem Boos, nur Liste, Termine
 * auf mehreren Websites), Kalchreuth (Liste, „19 Uhr ‐ 23:59 Uhr",
 * „Termin abgesagt"), Hirschau (Kalenderblatt, Ende fünf Minuten nach dem
 * Beginn), VG Altfraunhofen und Baierbach (dasselbe Kalenderblatt, Ende
 * `1970-01-01T`), Effeltrich (00:00 Uhr), Feldkirchen (00:01 bis 23:59,
 * Gemeinderatssitzung, Abfuhr), Sommerhausen (Kirchweih 00:05 bis 23:55).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { digipublicaWhen, parseDigipublicaPage } from '@/lib/scrapers/de/digipublica';
import { DigipublicaDeScraper, acrossCalendars, digipublicaGroups } from '@/lib/scrapers/de/DigipublicaDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'digipublica', `${f}.html`), 'utf8');

const KAL = {
  boos: { ags: '09778120', name: 'Boos', url: 'https://boos.vgem-boos.de/wir-in-boos/veranstaltungen' },
  fellheim: { ags: '09778139', name: 'Fellheim', url: 'https://fellheim.vgem-boos.de/wir-in-boos/veranstaltungen' },
  kalchreuth: { ags: '09572137', name: 'Kalchreuth', url: 'https://www.kalchreuth.de/vereine-freizeit-tourismus/veranstaltungen' },
  hirschau: { ags: '09371127', name: 'Hirschau, St', url: 'https://www.hirschau.de/freizeit/veranstaltungen' },
  'vg-altfraunhofen': { ags: '09274114', name: 'Altfraunhofen', url: 'https://www.vg-altfraunhofen.de/verwaltungsgemeinschaft-altfraunhofen/veranstaltungskalender' },
  baierbach: { ags: '09274118', name: 'Baierbach', url: 'https://www.baierbach.de/gemeinde-baierbach-2/veranstaltungskalender' },
  effeltrich: { ags: '09474122', name: 'Effeltrich', url: 'https://www.effeltrich.de/freizeit-kultur/veranstaltungskalender' },
  feldkirchen: { ags: '09184118', name: 'Feldkirchen', url: 'https://www.feldkirchen.de/aktuelles/veranstaltungskalender' },
  sommerhausen: { ags: '09679187', name: 'Sommerhausen, M', url: 'https://www.sommerhausen.de/veranstaltungen/kalender' },
} as const;
type Kal = keyof typeof KAL;

const entry = (k: Kal): RegistryEntryDe => ({
  ...KAL[k], land: 'bayern', host: new URL(KAL[k].url).host.replace(/^www\./, ''), stufe: 'B', integration: 'digipublica', checked_at: '2026-10-28',
});
const group = (k: Kal): FeedGroup => ({ feedUrl: KAL[k].url, pageUrl: KAL[k].url, own: [entry(k)], viaVerband: [] });
const page = (k: Kal) => parseDigipublicaPage(fx(k), KAL[k].url);
const termin = (k: Kal, title: string, n = 0) => page(k).termine.filter(t => t.title === title)[n];

type Row = {
  source_id: string; source_url: string; start_date: string; end_date: string | null; publish_status: string; country: string;
  location_resolution: { gemeinde: { name: string } | null; admission?: { reasons: string[] } };
};
const toRow = (e: Parameters<typeof toSupabaseRow>[0]) => toSupabaseRow(e, new Map(), new Map()).row as unknown as Row;
const rowsCache = new Map<Kal, Row[]>();
// Je Kalender einmal durch den Schreibweg (der Resolver ist teuer).
const rows = (k: Kal): Row[] => {
  if (!rowsCache.has(k)) rowsCache.set(k, new DigipublicaDeScraper().toScrapedAll(page(k).termine, group(k)).map(toRow));
  return rowsCache.get(k)!;
};
const row = (k: Kal, title: string) => {
  const t = termin(k, title);
  return rows(k).find(r => r.source_url === t.url && r.start_date === t.start)!;
};

// Die Fixtures stammen vom 30.10.2026 und listen Termine an diesem Tag.
// Der Freigabevertrag misst gegen die Uhr (start_in_past); sie steht
// deshalb auf dem Abrufdatum, sonst kippen die Zeilen mit jedem Tag.
beforeAll(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-30T12:00:00Z') }));
afterAll(() => vi.useRealTimers());

describe('DigiPublica: Liste lesen', () => {
  it('Liste mit Jahr (Boos): Datum, Uhrzeit, Text, Schlüssel und ID der Detailseite', () => {
    const p = page('boos');
    expect(p).toMatchObject({ isCalendar: true, fromJson: false, withoutYear: 0 });
    expect(p.termine).toHaveLength(60);
    expect(termin('boos', 'Preisschafkopfen')).toMatchObject({
      key: 'preisschafkopfen--509535', id: '509535', localDate: '2026-10-30', start: '2026-10-30T19:00:00.000Z', allDay: false,
      description: 'Schützenverein Boos', cancelled: false,
    });
  });

  it('Stunden ohne Minuten, 23:59 heißt Ende offen, Datum aus `selectedDate` (Kalchreuth)', () => {
    const t = termin('kalchreuth', 'Kabarettabend CSU');
    expect(t).toMatchObject({ start: '2026-10-31T18:00:00.000Z', allDay: false });
    expect(t.end).toBeUndefined();
    expect(t.url).toContain('selectedDate=');
  });

  it('„Termin abgesagt" wird erkannt und fällt in der Zeile weg (Kalchreuth)', () => {
    const t = termin('kalchreuth', 'Sprechstunde des Versichertenberaters der Deutschen Rentenversicherung Bund');
    expect(t).toMatchObject({ cancelled: true, start: '2026-11-24T15:00:00.000Z', end: '2026-11-24T17:00:00.000Z' });
    expect(rows('kalchreuth').some(r => r.source_url === t.url)).toBe(false);
  });

  it('Liste ohne Jahr und ohne Datum im Link wird nicht gelesen', () => {
    const html = '<div class="gdc-list"><div class="gdc-object"><div class="gdc-date"><span><span class="date-day">7.</span> <span class="date-month">Nov.</span></span></div>'
      + '<div class="gdc-time"><span>19:30 Uhr</span></div><div class="gdc-title"><a href="https://www.dingolfing.de/aktuelles/veranstaltungen/detail?-wiener-blut-13255&amp;lang=de"> Wiener Blut</a></div></div></div>';
    expect(parseDigipublicaPage(html, 'https://www.dingolfing.de/aktuelles/veranstaltungen')).toMatchObject({ isCalendar: true, termine: [], withoutYear: 1 });
  });

  it('Bild aus `background-image`, Gemeindelogo (`gdc-image-placeholder`) nicht', () => {
    const item = (cls: string, file: string) => `<div class="gdc-object"><div class="gdc-image"><a href="https://www.cham.de/k/detail?cham-entdecken-6608&amp;selectedDate=Samstag, 31.10.2026, 10:30 Uhr">`
      + `<div style="background-image: url(&quot;https://www.cham.de/_Resources/Persistent/${file}&quot;) !important;" class="${cls}"></div></a></div>`
      + `<div class="gdc-content"><div class="gdc-time"><span>10:30 Uhr</span></div><div class="gdc-title"><a href="https://www.cham.de/k/detail?cham-entdecken-6608&amp;lang=de">Cham entdecken</a></div></div></div>`;
    const html = `<div class="gdc-list">${item('gdc-image-container', 'stadtfuehrung.jpg')}</div>`;
    expect(parseDigipublicaPage(html, 'https://www.cham.de/k').termine[0]).toMatchObject({ image: 'https://www.cham.de/_Resources/Persistent/stadtfuehrung.jpg', start: '2026-10-31T09:30:00.000Z' });
    expect(parseDigipublicaPage(`<div class="gdc-list">${item('gdc-image-placeholder', 'Logo.png')}</div>`, 'https://www.cham.de/k').termine[0].image).toBeUndefined();
  });
});

describe('DigiPublica: Kalenderblatt', () => {
  it('Kalenderblatt ist die Quelle, alle Termine (Hirschau 82); Ende fünf Minuten nach dem Beginn ist kein Ende', () => {
    const p = page('hirschau');
    expect(p).toMatchObject({ fromJson: true });
    expect(p.termine).toHaveLength(82);
    const t = termin('hirschau', 'Halloween');
    expect(t).toMatchObject({ id: '14701', start: '2026-10-31T17:00:00.000Z', allDay: false });
    expect(t.end).toBeUndefined();
  });

  it('Platzhalterzeiten heißen ganztägig: 00:00 (Effeltrich), 00:01 bis 23:59 (Feldkirchen), 00:05 bis 23:55 (Sommerhausen Kirchweih)', () => {
    expect(termin('effeltrich', 'Friedhofgang Effeltrich und Gaiganz')).toMatchObject({ start: '2026-11-01', allDay: true });
    expect(termin('feldkirchen', 'Gemeinderatssitzung')).toMatchObject({ start: '2026-11-12', allDay: true });
    expect(termin('feldkirchen', 'Gemeinderatssitzung').end).toBeUndefined();
    expect(termin('sommerhausen', 'Sommerhäuser Kirchweih')).toMatchObject({ start: '2027-10-01', end: '2027-10-05', allDay: true });
  });

  it('Ende `1970-01-01T` ist kein Ende (VG Altfraunhofen)', () => {
    const t = termin('vg-altfraunhofen', 'Allerheiligen Steinbach');
    expect(t).toMatchObject({ start: '2026-10-31T18:00:00.000Z' });
    expect(t.end).toBeUndefined();
  });

  it('Text und Bild der Liste ergänzen das Kalenderblatt', () => {
    expect(termin('effeltrich', 'Friedhofgang Effeltrich und Gaiganz').description).toBe('Allerheiligen');
  });
});

describe('DigiPublica: Datum und Uhrzeit', () => {
  it('Formen', () => {
    expect(digipublicaWhen('2026-10-30', { hh: '20', mm: '00' })).toEqual({ localDate: '2026-10-30', start: '2026-10-30T19:00:00.000Z', allDay: false });
    expect(digipublicaWhen('2026-11-02', { hh: '00', mm: '00' }, '2026-11-10', { hh: '00', mm: '00' })).toEqual({ localDate: '2026-11-02', start: '2026-11-02', end: '2026-11-10', allDay: true });
    expect(digipublicaWhen('2027-06-20', { hh: '18', mm: '00' }, '2027-06-20', { hh: '22', mm: '00' })).toMatchObject({ start: '2027-06-20T16:00:00.000Z', end: '2027-06-20T20:00:00.000Z' });
    expect(digipublicaWhen('2026-12-31', { hh: '20', mm: '00' }, undefined, { hh: '02', mm: '00' })).toEqual({ localDate: '2026-12-31', start: '2026-12-31T19:00:00.000Z', allDay: false });
  });
});

// Der Schreibweg (Resolver, Kontext) braucht je Zeile einige zehn Millisekunden.
describe('DigiPublica: Termin → Zeile', { timeout: 30_000 }, () => {
  it('Gemeinde des Kalenders, source_id aus der ID (Sommerhausen Kirchweih, Dorffest)', () => {
    const r = row('sommerhausen', 'Sommerhäuser Kirchweih');
    expect(r).toMatchObject({ source_id: 'digipublica-sommerhausen.de-107901', country: 'DE', start_date: '2027-10-01' });
    expect(r.source_url).toContain('/detail?sommerhaeuser-kirchweih-107901');
    expect(r.location_resolution.gemeinde?.name).toBe('Sommerhausen');
    expect(r.publish_status).toMatch(/^published/);
  });

  it('Gemeinde-Dienst in Quarantäne (Feldkirchen „Gartenabfall-Abfuhr"); Sitzungen bleiben wie in Österreich sichtbar', () => {
    const r = row('feldkirchen', 'Gartenabfall-Abfuhr');
    expect(r.publish_status).not.toMatch(/^published/);
    expect(r.location_resolution.admission?.reasons).toContain('municipal_service');
    expect(row('feldkirchen', 'Gemeinderatssitzung').publish_status).toMatch(/^published/);
  });

  it('dieselbe ID an mehreren Tagen bekommt den Tag', () => {
    const ids = rows('boos').map(r => r.source_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some(id => /^digipublica-boos\.vgem-boos\.de-\d+-2026-\d{2}-\d{2}$/.test(id))).toBe(true);
  });

  it('Verbund: dasselbe Kalenderblatt auf zwei Websites ergibt je Termin eine Zeile ohne Website als Ort', () => {
    const merged = acrossCalendars([
      { group: group('vg-altfraunhofen'), termine: page('vg-altfraunhofen').termine },
      { group: group('baierbach'), termine: page('baierbach').termine },
    ]);
    expect(merged).toHaveLength(page('baierbach').termine.length);
    const s = merged.find(x => x.termin.title === 'Allerheiligen Steinbach')!;
    expect(s.group.own.map(e => e.ags).sort()).toEqual(['09274114', '09274118']);
    expect(s.group.pageUrl).toBe(KAL.baierbach.url);
    // Titel ohne „in <Gemeinde>": kein Ort, Quarantäne statt der Website als Ort.
    expect(toRow(new DigipublicaDeScraper().toScraped(s.termin, s.group, s.withDay)).location_resolution.gemeinde).toBeNull();
  });

  it('Verbund VGem Boos: „Trauerkaffee" steht auf Boos und Fellheim, bleibt einmal', () => {
    const merged = acrossCalendars([
      { group: group('boos'), termine: page('boos').termine },
      { group: group('fellheim'), termine: page('fellheim').termine },
    ]);
    const tk = merged.filter(x => x.termin.title === 'Trauerkaffee');
    expect(tk).toHaveLength(1);
    expect(tk[0].group.own.map(e => e.ags).sort()).toEqual(['09778120', '09778139']);
  });
});

describe('DigiPublica: Kalender der Registry', () => {
  it('Registry-URL mit `&amp;` wird normalisiert, Ausweichweg über die Verwaltungsgemeinschaft', () => {
    const fb = { ...entry('hirschau'), ags: '09571154', integration: 'keine', url: null, fallback: { kind: 'verband', host: 'vg-hesselberg.de', integration: 'digipublica', url: 'https://www.vg-hesselberg.de/aktuelles/termine' } } as RegistryEntryDe;
    const own = { ...entry('hirschau'), url: 'https://www.vg-hesselberg.de/aktuelles/termine' };
    expect(digipublicaGroups([own, fb]).map(g => [g.pageUrl, g.own.length, g.viaVerband.length])).toEqual([['https://www.vg-hesselberg.de/aktuelles/termine', 1, 1]]);
    expect(digipublicaGroups([{ ...entry('boos'), url: 'https://x.de/detail?a-1&amp;lang=de' }])[0].pageUrl).toBe('https://x.de/detail?a-1&lang=de');
  });
});
