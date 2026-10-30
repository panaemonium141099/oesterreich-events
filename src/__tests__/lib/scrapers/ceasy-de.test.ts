/**
 * DE-Adapter cEasy (fn-29.15), Golden-Tests auf echten Trefferlisten des
 * Moduls cVeka (abgerufen 2026-10-30, gekürzt auf Suchformular und Liste):
 * Weil im Schönbuch (Kasten), Schwaikheim (Streifen, Adresse mit PLZ),
 * Kirchheim unter Teck (Kasten, mehrtägig, Folgeseite), Denkingen (Streifen,
 * Uhrzeit als Freitext), Bollschweil (Streifen, fünf je Seite), Bückeburg
 * (Registry-Seite ohne Liste, Link auf den Veranstaltungskalender).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ceasyCalendarOf, ceasyLocation, ceasyNextUrl, ceasyWhen, parseCeasyList } from '@/lib/scrapers/de/ceasy';
import { CeasyDeScraper, calendarFromLinks, ceasyGroups } from '@/lib/scrapers/de/CeasyDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'ceasy', `${f}.html`), 'utf8');

const KAL = {
  'weil-im-schoenbuch': { ags: '08115051', name: 'Weil im Schönbuch', url: 'https://www.weil-im-schoenbuch.de/de/Aktuelles/Veranstaltungskalender' },
  schwaikheim: { ags: '08119068', name: 'Schwaikheim', url: 'https://www.schwaikheim.de/aktuelles/veranstaltungen' },
  'kirchheim-teck': { ags: '08116033', name: 'Kirchheim unter Teck, Stadt', url: 'https://www.kirchheim-teck.de/veranstaltungskalender' },
  denkingen: { ags: '08327010', name: 'Denkingen', url: 'https://www.denkingen.de/Aktuelles/Veranstaltungskalender' },
  bollschweil: { ags: '08315014', name: 'Bollschweil', url: 'https://www.bollschweil.de/veranstaltungen' },
} as const;
type Kal = keyof typeof KAL;

const entry = (k: Kal): RegistryEntryDe => ({
  ...KAL[k], land: 'baden-wuerttemberg', host: new URL(KAL[k].url).host.replace(/^www\./, ''), stufe: 'B', integration: 'ceasy', checked_at: '2026-10-28',
});
const group = (k: Kal): FeedGroup => ({ feedUrl: KAL[k].url, pageUrl: KAL[k].url, own: [entry(k)], viaVerband: [] });
const page = (k: Kal) => parseCeasyList(fx(k), KAL[k].url);
const termin = (k: Kal, id: string) => page(k).termine.find(t => t.id === id)!;

type Row = {
  source_id: string; source_url: string; start_date: string; end_date: string | null; publish_status: string; country: string;
  location_name: string | null; postal_code: string | null;
  location_resolution: { gemeinde: { name: string } | null; admission?: { reasons: string[] } };
};
const row = (k: Kal, id: string) => toSupabaseRow(new CeasyDeScraper().toScraped(termin(k, id), group(k)), new Map(), new Map()).row as unknown as Row;

describe('cEasy: Liste lesen', () => {
  it('Kasten (Weil im Schönbuch): 37 Termine auf einer Seite, Ort und Veranstalter', () => {
    const p = page('weil-im-schoenbuch');
    expect(p).toMatchObject({ isList: true, next: null });
    expect(p.termine).toHaveLength(37);
    expect(termin('weil-im-schoenbuch', '2264')).toMatchObject({
      url: 'https://www.weil-im-schoenbuch.de/de/Aktuelles/Veranstaltungskalender/Veranstaltung?view=publish&item=eventDate&id=2264',
      title: 'Café JoBa', start: '2026-11-06T14:00:00.000Z', end: '2026-11-06T17:00:00.000Z', allDay: false,
      locationName: 'Roncalli-Haus der kath. Kirchengemeinde', organizer: 'Katholische Kirchengemeinde', description: 'kleine Auszeit vom Alltag',
    });
  });

  it('Streifen (Schwaikheim): Datum und Uhrzeit in einer Zeile, Adresse mit PLZ, Vorschaubild', () => {
    expect(termin('schwaikheim', '1968')).toMatchObject({
      title: 'Mittagstisch für Jung und Alt', start: '2026-10-30T11:00:00.000Z', end: '2026-10-30T12:30:00.000Z',
      locationName: 'Begegnungsstätte', street: 'Kirchgasse 1', postalCode: '71409', locality: 'Schwaikheim',
      image: 'https://www.schwaikheim.de/ceasy/resource/1952?doCrop=1&width=150&height=150',
    });
  });

  it('Folgeseite: „nächste Seite" mit 50 statt 5 Treffern (Bollschweil)', () => {
    const p = page('bollschweil');
    expect(p.termine).toHaveLength(5);
    expect(ceasyNextUrl(p.next!)).toBe('https://www.bollschweil.de/veranstaltungen?item=eventDate&view=find&doPage=1&limit=50&doShowSearch=1&useXsl=STRIPES&offset=5');
  });

  it('Mailadresse ist kein Veranstalter (Denkingen „Lesezeit")', () => {
    expect(termin('denkingen', '2904').organizer).toBeUndefined();
  });

  it('Seite ohne Liste: Link auf den Veranstaltungskalender (Bückeburg)', () => {
    const p = parseCeasyList(fx('bueckeburg'), 'https://www.bueckeburg.de/de/Veranstaltungen');
    expect(p).toMatchObject({ isList: false, termine: [], calendarLinks: ['https://www.bueckeburg.de/de/Veranstaltungen/Veranstaltungskalender'] });
  });
});

describe('cEasy: Datum und Uhrzeit', () => {
  it('ohne Uhrzeit ganztägig; Freitext statt Uhrzeit bleibt ganztägig', () => {
    expect(termin('denkingen', '2827')).toMatchObject({ title: 'Backtage', start: '2026-10-31', allDay: true });
    expect(ceasyWhen('Mi., 04.11.26, mittwochs von 09.00-11.00 Uhr')).toEqual({ localDate: '2026-11-04', start: '2026-11-04', allDay: true });
    expect(ceasyWhen('Mo., 02.11.26, Gruppe A: 09:00 Uhr')).toMatchObject({ allDay: true });
    expect(ceasyWhen('Di., 17.11.26', 'Uhrzeit wird noch bekannt gegeben!')).toMatchObject({ allDay: true });
  });

  it('„ab", „von", „ca." vor der Uhrzeit; Text dahinter zählt nicht', () => {
    expect(ceasyWhen('Sa., 28.11.26', 'ab 15:00 - 21:00 Uhr')).toMatchObject({ start: '2026-11-28T14:00:00.000Z', end: '2026-11-28T20:00:00.000Z' });
    expect(ceasyWhen('Sa., 31.10.26', 'ca. 19:00 Uhr')).toMatchObject({ start: '2026-10-31T18:00:00.000Z' });
    expect(ceasyWhen('Fr., 06.11.26', '13:00 Uhr- 17:00 Uhr')).toMatchObject({ end: '2026-11-06T16:00:00.000Z' });
    expect(ceasyWhen('Mi., 04.11.26', '18:30 UhrEinlass ab 17:45 Uhr')).toMatchObject({ start: '2026-11-04T17:30:00.000Z' });
  });

  it('Sommerzeit: 18:00 Uhr am 20.06.27 ist 16:00 UTC', () => {
    expect(ceasyWhen('So., 20.06.27, 18:00 Uhr')).toMatchObject({ start: '2027-06-20T16:00:00.000Z' });
  });

  it('mehrtägig: ganztägig bis zum letzten Tag (Kirchheim „Vergnügungspark zum Gallusmarkt")', () => {
    expect(termin('kirchheim-teck', '16775')).toMatchObject({ start: '2026-10-30', end: '2026-11-02', allDay: true });
  });

  it('Ende vor dem Beginn bleibt offen', () => {
    expect(ceasyWhen('Sa., 31.12.26', '20:00 - 02:00 Uhr')).toEqual({ localDate: '2026-12-31', start: '2026-12-31T19:00:00.000Z', allDay: false });
  });
});

describe('cEasy: Ort', () => {
  it('Name, Straße, „PLZ Ort" in Zeilen oder hinter Komma', () => {
    expect(ceasyLocation(['Weingut Knauß', 'Weingut Knauß, Nolten 2, 71384 Weinstadt'])).toEqual({ locationName: 'Weingut Knauß', street: 'Nolten 2', postalCode: '71384', locality: 'Weinstadt' });
    expect(ceasyLocation(['44am Agency', 'Alleenstr. 128', '73230 Kirchheim/Teck', '(Alter Teckbote)'])).toEqual({ locationName: '44am Agency', street: 'Alleenstr. 128', postalCode: '73230', locality: 'Kirchheim/Teck' });
    expect(ceasyLocation(['Bürgerhaus'])).toEqual({ locationName: 'Bürgerhaus' });
  });
});

describe('cEasy: Termin → Zeile', () => {
  it('Termin der Gemeinde: Gemeinde des Kalenders, source_id aus der Termin-ID', () => {
    const r = row('weil-im-schoenbuch', '2264');
    expect(r).toMatchObject({ source_id: 'ceasy-weil-im-schoenbuch.de-2264', country: 'DE', start_date: '2026-11-06T14:00:00.000Z' });
    expect(r.location_resolution.gemeinde?.name).toBe('Weil im Schönbuch');
    expect(r.publish_status).toMatch(/^published/);
  });

  it('Adresse der Quelle mit PLZ', () => {
    const r = row('schwaikheim', '1968');
    expect(r).toMatchObject({ postal_code: '71409' });
    expect(r.location_resolution.gemeinde?.name).toBe('Schwaikheim');
  });
});

describe('cEasy: Kalender der Registry', () => {
  it('Kalender aus den Termin-Links einer Unterseite', () => {
    expect(ceasyCalendarOf('https://www.giengen.de/de/Stadt-Buerger/Aktuelles/Veranstaltungskalender/Veranstaltung?view=publish&item=eventDate&id=12')).toBe('https://www.giengen.de/de/Stadt-Buerger/Aktuelles/Veranstaltungskalender');
    expect(calendarFromLinks([
      'https://www.egg-leo.de/willkommen/Aktuelles/Veranstaltungskalender/Veranstaltung?view=publish&item=eventDate&id=1854',
      'https://www.egg-leo.de/willkommen/Aktuelles/Veranstaltungskalender/Veranstaltung?view=publish&item=eventDate&id=1855',
      'https://www.other.de/x/Veranstaltung?view=publish&item=eventDate&id=1',
    ], 'https://www.egg-leo.de/Veranstaltungen')).toBe('https://www.egg-leo.de/willkommen/Aktuelles/Veranstaltungskalender');
  });

  it('je Registry-Seite ein Kalender, ohne URL keiner', () => {
    expect(ceasyGroups([entry('denkingen'), { ...entry('bollschweil'), url: null }]).map(g => g.pageUrl)).toEqual([KAL.denkingen.url]);
  });
});
