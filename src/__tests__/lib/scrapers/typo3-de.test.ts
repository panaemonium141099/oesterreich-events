/**
 * DE-Adapter TYPO3- und Contao-Kalender (fn-29.14), Golden-Tests auf echten
 * Kalenderseiten (Prüfstand-Cache, abgerufen 2026-10-30, gekürzt auf die
 * Kalendermodule): Contao Klinkrade (`<base href>`, „16:00–17:30“),
 * Asendorf (Ort mit Adresse), Uetersen (Monatskalender mit `times=`),
 * Wurmsham („| Ort:“), Nienhagen (Beschriftungen im Ort), Baesweiler (nur
 * Linktitel, Sprechstunde); calendarize Oberzissen („Open End“), Dülmen
 * („Ganztags“, „00:00 - 00:00“), Himmelkron (Elektroschrott); sf_event_mgt
 * Burgsponheim (Tag/Monat/Jahr in Feldern); events2 Wedel (JSON-LD der
 * Detailseite).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contaoWhen, fieldDate, parseContaoPage, parsePlace, splitOrtSuffix, whenFromTimes } from '@/lib/scrapers/de/contao';
import { calendarizeWhen, detailId, parseTypo3Detail, parseTypo3Page } from '@/lib/scrapers/de/typo3';
import { Typo3DeScraper, mergeSameTermin, typo3Groups } from '@/lib/scrapers/de/Typo3DeScraper';
import { withoutPlaceholderImages } from '@/lib/scrapers/de/bild';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import type { CmsTermin } from '@/lib/scrapers/de/cms-termin';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'typo3', `${f}.html`), 'utf8');

const KAL = {
  klinkrade: { ags: '01053068', name: 'Klinkrade', land: 'schleswig-holstein', url: 'https://www.klinkrade.de/leben-in-klinkrade/termine', integration: 'contao_events' },
  asendorf: { ags: '03251002', name: 'Asendorf', land: 'niedersachsen', url: 'https://www.asendorf.info/veranstaltungen', integration: 'contao_events' },
  uetersen: { ags: '01056049', name: 'Uetersen, Stadt', land: 'schleswig-holstein', url: 'https://uetersen.de/events-veranstaltungen.html', integration: 'contao_events' },
  wurmsham: { ags: '09274193', name: 'Wurmsham', land: 'bayern', url: 'https://www.wurmsham.de/veranstaltungskalender-wurmsham.html', integration: 'contao_events' },
  nienhagen: { ags: '03351018', name: 'Nienhagen', land: 'niedersachsen', url: 'https://www.gemeinde-nienhagen.de/veranstaltungen.html', integration: 'contao_events' },
  baesweiler: { ags: '05334008', name: 'Baesweiler, Stadt', land: 'nordrhein-westfalen', url: 'https://www.baesweiler.de/veranstaltungen.html', integration: 'contao_events' },
  oberzissen: { ags: '07131060', name: 'Oberzissen', land: 'rheinland-pfalz', url: 'https://www.oberzissen.de/termine', integration: 'calendarize' },
  duelmen: { ags: '05558016', name: 'Dülmen, Stadt', land: 'nordrhein-westfalen', url: 'https://www.duelmen.de/veranstaltungen', integration: 'calendarize' },
  himmelkron: { ags: '09477121', name: 'Himmelkron', land: 'bayern', url: 'https://www.himmelkron.de/aktuelles/termine-veranstaltungen', integration: 'calendarize' },
  burgsponheim: { ags: '07133019', name: 'Burgsponheim', land: 'rheinland-pfalz', url: 'https://www.burgsponheim.de/termine', integration: 'sfeventmgt' },
  grevenbroich: { ags: '05162008', name: 'Grevenbroich, Stadt', land: 'nordrhein-westfalen', url: 'https://www.grevenbroich.de/leben-in-grevenbroich/veranstaltungen', integration: 'sfeventmgt' },
  'markt-velden': { ags: '09274183', name: 'Velden, M', land: 'bayern', url: 'https://www.markt-velden.de/veranstaltungskalender.html', integration: 'contao_events' },
} as const;
type K = keyof typeof KAL;

const entry = (k: K): RegistryEntryDe => ({ ...KAL[k], host: new URL(KAL[k].url).host.replace(/^www\./, ''), stufe: 'B', checked_at: '2026-10-28' });
const group = (k: K): FeedGroup => ({ feedUrl: KAL[k].url, pageUrl: KAL[k].url, own: [entry(k)], viaVerband: [] });
const contao = (k: K) => parseContaoPage(fx(k), KAL[k].url);
const typo3 = (k: K) => parseTypo3Page(fx(k), KAL[k].url);
const termin = (list: CmsTermin[], title: string) => list.find(t => t.title === title)!;

type Row = {
  source_id: string; source_url: string; start_date: string; end_date: string | null; publish_status: string; country: string;
  location_name: string | null; postal_code: string | null;
  location_resolution: { gemeinde: { name: string } | null; admission?: { reasons: string[] } };
};
const row = (k: K, t: CmsTermin) => toSupabaseRow(new Typo3DeScraper().toScraped(t, group(k)), new Map(), new Map()).row as unknown as Row;

describe('Contao: Terminliste', () => {
  it('Klinkrade: relative Links zu `<base href>`, „16:00–17:30“ als Beginn und Ende (MEZ)', () => {
    const p = contao('klinkrade');
    expect(p).toMatchObject({ isCalendar: true, unreadable: 0, nextPage: null });
    expect(p.termine).toHaveLength(5);
    expect(termin(p.termine, 'Mobile Spieliothek')).toMatchObject({
      url: 'https://www.klinkrade.de/leben-in-klinkrade/termin/mobile-spieliothek-237',
      localDate: '2026-11-06', start: '2026-11-06T15:00:00.000Z', end: '2026-11-06T16:30:00.000Z', allDay: false,
    });
    // „19:00“ ohne Endzeit: kein Ende.
    expect(termin(p.termine, 'Dance op de Deel').end).toBeUndefined();
  });

  it('Klinkrade: das Platzhalterbild aller Termine (`files/web/Platzhalter/termine.png`) fällt weg', () => {
    const p = contao('klinkrade').termine.map(t => ({ ...t, uid: t.key }));
    expect(p.every(t => t.image?.endsWith('/Platzhalter/termine.png'))).toBe(true);
    expect(withoutPlaceholderImages(p).every(t => !t.image)).toBe(true);
  });

  it('Asendorf: Ort mit Adresse in Schema.org (`name`, `address`)', () => {
    expect(termin(contao('asendorf').termine, 'Spielzeugbörse')).toMatchObject({
      start: '2026-11-21T12:00:00.000Z', end: '2026-11-21T15:00:00.000Z',
      locationName: 'Gemeindehaus Asendorf', street: 'St. Marcellusstraße 7', postalCode: '27330', locality: 'Asendorf',
    });
  });

  it('Wurmsham: „Name| Ort: Gasthaus …“ trennt Name und Ort', () => {
    expect(termin(contao('wurmsham').termine, 'Christbaumversteigerung der Rott-Quelle Schützen Wurmsham e.V.')).toMatchObject({
      locationName: 'Gasthaus Maier Wurmsham', start: '2026-11-28T19:00:00.000Z',
    });
    expect(splitOrtSuffix('Kameradschaftsabend der FW Vilslern | Ort: Gasthaus Putz')).toEqual({ title: 'Kameradschaftsabend der FW Vilslern', place: 'Gasthaus Putz' });
    expect(splitOrtSuffix('Alfred Dorfer | Gleich')).toEqual({ title: 'Alfred Dorfer | Gleich' });
  });

  it('Nienhagen: Beschriftungen „Ort:“, „Adresse:“ und Trenner gehören nicht zum Ort', () => {
    expect(termin(contao('nienhagen').termine, 'Konzert Kosakenchor mit Peter Orloff')).toMatchObject({
      locationName: 'Hagensaal, Rathaus Nienhagen', street: 'Dorfstraße 41', postalCode: '29336', locality: 'Nienhagen', start: '2026-11-07T18:00:00.000Z',
    });
  });

  it('Baesweiler: ohne `datetime` gilt das Datum im Linktitel („(Donnerstag, 2026-10-01)“), ohne Uhrzeit ganztägig', () => {
    const t = termin(contao('baesweiler').termine, 'Sprechstunde der Seniorenlotsen: Informationen zu allen Themen rund um Alter und Pflege');
    expect(t).toMatchObject({ localDate: '2026-10-01', start: '2026-10-01', allDay: true });
  });
});

describe('Contao: Monatskalender', () => {
  it('Uetersen: `times=` in Ortszeit, 00:00 bis 23:59 ganztägig, gleiches Ende heißt ohne Ende, Folgemonat', () => {
    const p = contao('uetersen');
    expect(p.nextMonth).toBe('https://uetersen.de/events-veranstaltungen.html?month=202611');
    expect(termin(p.termine, 'Herbstfest')).toMatchObject({ localDate: '2026-10-04', start: '2026-10-04', allDay: true });
    // 10:00 bis 11:00 Sommerzeit.
    expect(p.termine.find(t => t.title.startsWith('Dialog in Deutsch'))).toMatchObject({ start: '2026-10-01T08:00:00.000Z', end: '2026-10-01T09:00:00.000Z' });
    expect(p.termine.find(t => t.title.startsWith('Offenes Singen'))?.end).toBeUndefined();
  });

  it('Liste und Kalender derselben Seite: ein Termin, fehlende Angaben ergänzt', () => {
    const a: CmsTermin = { key: 'x.de/e/fest', localDate: '2026-11-07', start: '2026-11-07', allDay: true, title: 'Fest' };
    const b: CmsTermin = { ...a, locationName: 'Dorfplatz' };
    expect(mergeSameTermin([a, b])).toEqual([{ ...a, locationName: 'Dorfplatz' }]);
  });

  it('Teaser ohne Link und Listeneintrag mit Link: ein Termin (Bleicherode „Kirmes Pustleben“)', () => {
    const teaser: CmsTermin = { key: 'www.bleicherode.de/#Kirmes Pustleben', localDate: '2026-10-31', start: '2026-10-31', end: '2026-11-01', allDay: true, title: 'Kirmes Pustleben', locationName: 'Kulturscheune Wipperdorf' };
    const liste: CmsTermin = { key: 'www.bleicherode.de/aktuelles/veranstaltungen/veranstaltung/kirmes-pustleben-2.html', url: 'https://www.bleicherode.de/aktuelles/veranstaltungen/veranstaltung/kirmes-pustleben-2.html', localDate: '2026-10-31', start: '2026-10-31', allDay: true, title: 'Kirmes Pustleben' };
    expect(mergeSameTermin([teaser, liste])).toEqual([{ ...liste, end: '2026-11-01', locationName: 'Kulturscheune Wipperdorf' }]);
  });
});

describe('Contao: Datum, Uhrzeit, Ort', () => {
  it('Sommerzeit: Wandzeit aus `datetime`, der Versatz zählt nicht', () => {
    expect(contaoWhen('2026-10-02T19:00:00+02:00', '02.10.2026, 19:00 Uhr')).toEqual({ localDate: '2026-10-02', start: '2026-10-02T17:00:00.000Z', allDay: false });
  });

  it('mehrtägig ganztägig, mehrtägig mit Uhrzeit, Ende gleich Beginn', () => {
    expect(contaoWhen('2026-11-06', '06.11.2026–08.11.2026')).toEqual({ localDate: '2026-11-06', start: '2026-11-06', end: '2026-11-08', allDay: true });
    expect(contaoWhen('2026-11-06T16:00:00+01:00', '06.11.2026 16:00–08.11.2026 12:00')).toMatchObject({ start: '2026-11-06T15:00:00.000Z', end: '2026-11-08T11:00:00.000Z' });
    expect(contaoWhen(undefined, '06.11.2026 20:00 – 20:00')).toEqual({ localDate: '2026-11-06', start: '2026-11-06T19:00:00.000Z', allDay: false });
    // Monat als Wort (Tiefenbach „So 8. Nov 2026“, Winsen „10. Oktober 2026 10:00“).
    expect(contaoWhen(undefined, 'Samstag, 10. Oktober 2026 10:00')).toMatchObject({ localDate: '2026-10-10', start: '2026-10-10T08:00:00.000Z' });
  });

  it('`times=`: ganztägig mehrtägig bis 23:59:59 des letzten Tages', () => {
    // Prinzhöfte „Herbstschießen“ 30.10. 18:00 bis 31.10. 17:59 ist kein ganztägiger Termin.
    expect(whenFromTimes(1793379600, 1793465999)).toEqual({ localDate: '2026-10-30', start: '2026-10-30T17:00:00.000Z', end: '2026-10-31T16:59:00.000Z', allDay: false });
    expect(whenFromTimes(1790805600, 1790891940)).toEqual({ localDate: '2026-10-01', start: '2026-10-01', allDay: true });
  });

  it('Datum aus Feldern (Gutweiler „09 //11 // 2026“, Burgsponheim „15 Nov. 2026“)', () => {
    expect(fieldDate('09 //11 // 2026')).toBe('2026-11-09');
    expect(fieldDate('15 Nov. 2026')).toBe('2026-11-15');
    expect(fieldDate('Freitag')).toBeUndefined();
  });

  it('Ortszeile: Name, Straße, PLZ, Ort; Beschriftung entfällt', () => {
    expect(parsePlace('Oberschule Stolpen, Pirnaer Landstraße 1, 01833 Stolpen')).toEqual({ locationName: 'Oberschule Stolpen', street: 'Pirnaer Landstraße 1', postalCode: '01833', locality: 'Stolpen' });
    expect(parsePlace('Begegnungsstätte, Alleegässchen1 - 01558 Großenhain')).toEqual({ locationName: 'Begegnungsstätte', street: 'Alleegässchen1', postalCode: '01558', locality: 'Großenhain' });
    expect(parsePlace('Ort: Sportheim VfB Eichenbühl: In den Rittern 3, 63928 Eichenbühl')).toEqual({ locationName: 'Sportheim VfB Eichenbühl', street: 'In den Rittern 3', postalCode: '63928', locality: 'Eichenbühl' });
    expect(parsePlace('Ort: Gemeindehaus Kellenhusen 23746 Kellenhusen Kirchweg 20')).toEqual({ locationName: 'Gemeindehaus Kellenhusen', postalCode: '23746' });
    expect(parsePlace('Ort: Zuchtanlage')).toEqual({ locationName: 'Zuchtanlage' });
  });
});

describe('TYPO3-Extensions', () => {
  it('calendarize Oberzissen: „13.11.2026 17:30 - Open End“ ohne Ende, ID aus `tx_calendarize_calendar[index]`', () => {
    const p = typo3('oberzissen');
    expect(p.ext).toBe('calendarize');
    expect(p.needDetail).toEqual([]);
    expect(termin(p.termine, 'St. Martinszug')).toMatchObject({ key: 'calendarize-www.oberzissen.de-134', localDate: '2026-11-13', start: '2026-11-13T17:00:00.000Z', allDay: false });
    expect(termin(p.termine, 'St. Martinszug').end).toBeUndefined();
  });

  it('calendarize Dülmen: „01.10.2026 - 10.11.2026 Ganztags“ und „02.10.2026 00:00 - 30.10.2026 00:00“ ganztägig', () => {
    const p = typo3('duelmen');
    expect(termin(p.termine, 'Kunstausstellung: Und dazwischen Erinnerung')).toMatchObject({ start: '2026-10-01', end: '2026-11-10', allDay: true });
    expect(termin(p.termine, 'Ausstellung Maria Eggenkemper und Rolf Ebert')).toMatchObject({ start: '2026-10-02', end: '2026-10-30', allDay: true });
    expect(p.nextPage).toBe('https://www.duelmen.de/veranstaltungen/seite/2');
  });

  it('Terminzeilen der Vorlagen (Gönnheim „//“, Grafengehaig „Uhr“, Helmstedt „All day“)', () => {
    expect(calendarizeWhen('30.10.2026 // 19:00 Uhr')).toEqual({ localDate: '2026-10-30', start: '2026-10-30T18:00:00.000Z', allDay: false });
    expect(calendarizeWhen('01.11.2026 11:00 - 16:00')).toMatchObject({ start: '2026-11-01T10:00:00.000Z', end: '2026-11-01T15:00:00.000Z' });
    expect(calendarizeWhen('11.09.2026 - 30.10.2026 All day')).toEqual({ localDate: '2026-09-11', start: '2026-09-11', end: '2026-10-30', allDay: true });
  });

  it('sf_event_mgt Burgsponheim: Tag, Monat, Jahr in Feldern, Uhrzeit darunter', () => {
    const p = typo3('burgsponheim');
    expect(p.ext).toBe('sfeventmgt');
    expect(termin(p.termine, 'Martinsfeuer')).toMatchObject({ key: 'sfeventmgt-www.burgsponheim.de-107', localDate: '2026-11-15', start: '2026-11-15T17:00:00.000Z' });
  });

  it('sf_event_mgt Grevenbroich: Datum und Uhrzeit in getrennten Tabellenzeilen („Fr 30.10.2026“, „19:00 Uhr - 21:00 Uhr“)', () => {
    expect(termin(typo3('grevenbroich').termine, '18. Grevenbroicher Gitarrenwochen: Rob Collins & Paddy Boy')).toMatchObject({
      localDate: '2026-10-30', start: '2026-10-30T18:00:00.000Z', end: '2026-10-30T20:00:00.000Z', allDay: false,
    });
  });

  it('Detail-IDs: calendarize Route, events2 Ereignis und Tag', () => {
    expect(detailId('calendarize', '/termine/detailansicht/termin/kulturbanausen-stand-up-comedy')).toBe('kulturbanausen-stand-up-comedy');
    expect(detailId('events2', '/v/detail.html?tx_events2_show%5Baction%5D=show&amp;tx_events2_show%5Bevent%5D=81&amp;tx_events2_show%5Btimestamp%5D=1794006000&amp;cHash=6a')).toBe('81-1794006000');
    expect(detailId('events2', '/leben-in-wedel/veranstaltungen/veranstaltungsdetails/2026-11-02_1500/herbstaktion-zurueck-aufs-rad')).toBe('2026-11-02_1500-herbstaktion-zurueck-aufs-rad');
  });

  it('events2 Wedel: Beginn, Ende und Ort aus dem JSON-LD der Detailseite (Ortszeit ohne Versatz)', () => {
    const url = 'https://www.wedel.de/leben-in-wedel/veranstaltungen/veranstaltungsdetails/2026-11-02_1500/herbstaktion-zurueck-aufs-rad';
    expect(parseTypo3Detail('events2', fx('wedel-detail'), url, 'Herbstaktion Zurück aufs Rad')).toMatchObject({
      url, localDate: '2026-11-02', start: '2026-11-02T14:00:00.000Z', end: '2026-11-02T16:00:00.000Z', allDay: false,
      locationName: 'Elbestadion', postalCode: '22880', locality: 'Wedel',
    });
  });
});

describe('Termin → Zeile', () => {
  it('Contao Klinkrade: Gemeinde des Kalenders, Detailseite, source_id aus Detailseite und Tag', () => {
    const r = row('klinkrade', termin(contao('klinkrade').termine, 'Dance op de Deel'));
    expect(r).toMatchObject({
      source_id: 't3-www.klinkrade.de/leben-in-klinkrade/termin/dance-op-de-deel-230-2026-11-07',
      source_url: 'https://www.klinkrade.de/leben-in-klinkrade/termin/dance-op-de-deel-230',
      start_date: '2026-11-07T18:00:00.000Z', country: 'DE',
    });
    expect(r.location_resolution.gemeinde?.name).toBe('Klinkrade');
    expect(r.publish_status).toMatch(/^published/);
  });

  it('Asendorf: Adresse der Quelle (27330, Landkreis Diepholz)', () => {
    const r = row('asendorf', termin(contao('asendorf').termine, 'Spielzeugbörse'));
    expect(r).toMatchObject({ location_name: 'Gemeindehaus Asendorf', postal_code: '27330' });
    expect(r.location_resolution.gemeinde?.name).toBe('Asendorf');
  });

  it('Bürgermeistersprechstunde (Markt Velden) und Elektroschrott-Abgabe (Himmelkron): Quarantäne municipal_service', () => {
    const s = row('markt-velden', termin(contao('markt-velden').termine, 'Bürgermeistersprechstunde Eberspoint, Sportheim FC Eberspoint'));
    expect(s.location_resolution.admission?.reasons).toContain('municipal_service');
    expect(s.publish_status).not.toMatch(/^published/);
    const e = row('himmelkron', termin(typo3('himmelkron').termine, 'Abgabe Elektroschrott Kläranlage'));
    expect(e.location_resolution.admission?.reasons).toContain('municipal_service');
  });

  it('Dorffest Markt Velden „Gründungsfest der FF Eberspoint“: je Tag gelistet, ein Termin 17. bis 20.06.2027 wie auf der Detailseite', () => {
    const tage = contao('markt-velden').termine.filter(t => t.title === 'Gründungsfest der FF Eberspoint');
    expect(tage.map(t => [t.start, t.end])).toEqual([['2027-06-17', undefined], ['2027-06-17', '2027-06-18'], ['2027-06-17', '2027-06-19'], ['2027-06-17', '2027-06-20']]);
    const [fest] = mergeSameTermin(tage);
    const r = row('markt-velden', fest);
    expect(r).toMatchObject({ start_date: '2027-06-17', end_date: '2027-06-20', source_url: 'https://www.markt-velden.de/2234/10332.html' });
    expect(r.location_resolution.gemeinde?.name).toBe('Velden');
    expect(r.publish_status).toMatch(/^published/);
  });

  it('calendarize Oberzissen: Zeile mit Gemeinde, source_id aus Extension und Datensatz', () => {
    const r = row('oberzissen', termin(typo3('oberzissen').termine, 'St. Martinszug'));
    expect(r.source_id).toBe('t3-calendarize-www.oberzissen.de-134-2026-11-13');
    expect(r.location_resolution.gemeinde?.name).toBe('Oberzissen');
  });
});

describe('Kalender der Registry', () => {
  it('eine Seite je Kalender, alle fünf Integrationen, Ausweichweg über das Amt', () => {
    const amt: RegistryEntryDe = {
      ags: '13073054', name: 'Lüssow', land: 'mecklenburg-vorpommern', host: 'gemeinde-luessow.de', stufe: 'V', integration: 'leer', url: 'https://gemeinde-luessow.de/veranstaltungskalender/', checked_at: '2026-10-28',
      fallback: { kind: 'verband', host: 'amt-niepars.de', integration: 'contao_events', url: 'https://www.amt-niepars.de/veranstaltungen.html' },
    };
    const gs = typo3Groups([entry('klinkrade'), entry('oberzissen'), { ...entry('burgsponheim'), url: null }, amt]);
    expect(gs.map(g => [g.pageUrl, g.own.length, g.viaVerband.length])).toEqual([
      ['https://www.amt-niepars.de/veranstaltungen.html', 0, 1],
      ['https://www.klinkrade.de/leben-in-klinkrade/termine', 1, 0],
      ['https://www.oberzissen.de/termine', 1, 0],
    ]);
  });
});
