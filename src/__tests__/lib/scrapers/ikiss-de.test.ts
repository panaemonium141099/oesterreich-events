/**
 * DE-Adapter Advantic iKISS (fn-29.13), Golden-Tests auf echten Seiten
 * (abgerufen 2026-10-30, Skripte, Styles und Hauptmenü entfernt): Pfatter
 * (Vorlage `result-list veranstaltungen`, Ort mit Adresse), Kasseburg
 * (`list-title`, Bild), Amt Hohe Elbgeest/Hamwarde (`liste_titel`, nur Datum
 * in der Liste; Detailseite mit „Ortschaft:" und „Region:"), Gemünden (Felda)
 * (`dl.object-data` mit „Beginn:"/„Ende:", Veranstalter im Seitenkasten),
 * Hilchenbach (ganztägig über mehrere Tage), dazu aus dem Prüfstand-Lauf
 * Algermissen (Seitenüberschrift als erstes <h1>), Wismar (Icon in der
 * Beschriftung, Datum eines Sliders mit Screenreader-Text), Hennigsdorf
 * (`event-info` mit Monatsnamen und Kartenlink), Gießen (Beginn/Ende mit
 * Screenreader-Text), Lennestadt (Ende „23:59"), Amt Hohe Elbgeest
 * (Gemeinde-Dienst) und Oschersleben (Dorffest).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { calendarPaths, fidOf, ikissPageUrl, ikissWhen, numericDates, parseIkissDetail, parseIkissList, parseIkissRss } from '@/lib/scrapers/de/ikiss';
import { IkissDeScraper, ikissGroups, onSite } from '@/lib/scrapers/de/IkissDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

// Der Freigabevertrag misst gegen die Uhr (start_in_past); sie steht deshalb auf
// dem Abrufdatum der Fixtures, sonst kippen die Zeilen mit jedem Tag.
beforeAll(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-30T12:00:00Z') }));
afterAll(() => vi.useRealTimers());

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'ikiss', `${f}.html`), 'utf8');

const PFATTER = 'https://www.pfatter.de/Freizeit-und-Kultur/Veranstaltungskalender/';
const PFATTER_THEATER = 'https://www.pfatter.de/Freizeit-und-Kultur/Veranstaltungskalender/De-Zamgw%C3%BCrfelten-Theater.php?object=tx,4257.394.1&ModID=11&FID=4257.5597.1&NavID=4257.622&sfreg=1&sfort=1&k_sub=1';
const HAMWARDE = 'https://www.amt-hohe-elbgeest.de/Gemeinden/Hamwarde/Aktuelles/Veranstaltungen/';
const HAMWARDE_SENIOREN = 'https://www.amt-hohe-elbgeest.de/Gemeinden/Hamwarde/Aktuelles/Veranstaltungen/Kirche-Seniorennachmittag.php?object=tx,2610.13&ModID=11&FID=2610.486.1&NavID=2610.101&sfort=1&sfvort=1&sfreg=1';

const entry = (ags: string, name: string, land: string, url: string | null, host = url ? new URL(url).host.replace(/^www\./, '') : 'example.de'): RegistryEntryDe => ({
  ags, name, land, host, stufe: 'B', integration: 'ikiss', url, checked_at: '2026-10-28',
});
const single = (e: RegistryEntryDe): FeedGroup => ({ feedUrl: e.url!, pageUrl: e.url!, own: [e], viaVerband: [] });

type Row = {
  source_id: string; source_url: string; start_date: string; end_date: string | null; publish_status: string; country: string;
  location_resolution: { gemeinde: { name: string } | null; admission?: { reasons: string[] } };
};
const toRow = (t: NonNullable<ReturnType<typeof parseIkissDetail>>, g: FeedGroup) =>
  toSupabaseRow(new IkissDeScraper().toScraped(t, g), new Map(), new Map()).row as unknown as Row;

describe('iKISS: Liste lesen', () => {
  it('Pfatter: 87 Termine, 25 je Seite, Folgeseiten über ofs_2', () => {
    const p = parseIkissList(fx('pfatter-liste'), PFATTER);
    expect(p).toMatchObject({ isList: true, total: 87, pageSize: 25, maxOffset: 75 });
    expect(p.details).toHaveLength(25);
    expect(p.details[0]).toEqual({ fid: '4257.5597.1', url: PFATTER_THEATER });
    expect(ikissPageUrl(p.pagerTemplate!, 50)).toBe('https://www.pfatter.de/Freizeit-und-Kultur/Veranstaltungskalender/index.php?ofs_2=50&NavID=4257.622&sfreg=1&sfort=1&kuo=1&k_sub=1&ModID=11&object=tx%7C4257.394.1');
  });

  it('ältere Vorlagen: Kasseburg ohne Pager, Hamwarde mit `seitenzaehler` und Gemeinde-Filter', () => {
    const k = parseIkissList(fx('kasseburg-liste'), 'https://www.kasseburg.de/Termine/');
    expect(k).toMatchObject({ isList: true, total: 9, pagerTemplate: null });
    expect(k.details).toHaveLength(9);
    const h = parseIkissList(fx('hamwarde-liste'), HAMWARDE);
    expect(h).toMatchObject({ isList: true, total: 42, pageSize: 25 });
    expect(h.pagerTemplate).toContain('ort=1798.5');
    expect(h.details.map(d => d.fid)).toContain('2610.486.1');
  });

  it('nur Links des Veranstaltungsmoduls mit FID zählen, nicht Adressen (ModID=9) oder /output/', () => {
    expect(fidOf('/x.php?object=tx,4257.394.1&ModID=11&FID=4257.5597.1')).toBe('4257.5597.1');
    expect(fidOf('/index.php?object=tx,4257.1.1&ModID=9&FID=4257.1.1')).toBeNull();
    const p = parseIkissList(fx('pfatter-theater'), PFATTER_THEATER);
    expect(p.details.every(d => !d.url.includes('/output/'))).toBe(true);
  });

  it('Seite ohne Liste: Kalenderpfad der verlinkten Detailseiten', () => {
    expect(calendarPaths(fx('pfatter-liste'), PFATTER)[0]).toBe(PFATTER);
  });

  it('iKISS-RSS: Kanal-Link und Detailseiten (Giesen, gekürzt)', () => {
    const xml = `<?xml version="1.0" encoding="ISO-8859-15"?><rss version="2.0"><channel><title>Veranstaltungen</title>
      <link>https://www.giesen.de/index.php?NavID=1734.1&amp;object=tx%2C3817.4.1&amp;ModID=11&amp;kuo=1&amp;La=1</link><generator>IKISS</generator>
      <item><title>Puttappelabend</title><link>https://www.giesen.de/Kultur-Freizeit/Veranstaltungen/Puttappelabend-Heimatvereine-de-Hasen-e-V-Hasede.php?ModID=11&amp;FID=1734.1739.1</link><description>30.10.2026  in Hasede</description></item>
      </channel></rss>`;
    expect(parseIkissRss(xml)).toEqual({
      calendarUrl: 'https://www.giesen.de/index.php?NavID=1734.1&object=tx%2C3817.4.1&ModID=11&kuo=1&La=1',
      details: [{ fid: '1734.1739.1', url: 'https://www.giesen.de/Kultur-Freizeit/Veranstaltungen/Puttappelabend-Heimatvereine-de-Hasen-e-V-Hasede.php?ModID=11&FID=1734.1739.1' }],
    });
    expect(parseIkissRss('<rss><channel><generator>dvv</generator></channel></rss>')).toBeNull();
  });
});

describe('iKISS: Detailseite', () => {
  it('Pfatter „De Zamgwürfelten - Theater": Kategorie, Ort mit Adresse, 19:30 Ortszeit, Ende „23:59" offen', () => {
    expect(parseIkissDetail(fx('pfatter-theater'), PFATTER_THEATER)).toEqual({
      fid: '4257.5597.1', url: PFATTER_THEATER, localDate: '2026-10-30', start: '2026-10-30T18:30:00.000Z', allDay: false,
      title: 'De Zamgwürfelten - Theater', category: 'Vereine, Theater/Kabarett',
      locationName: 'Gasthaus zur Post (Gierstorfer)', street: 'Haidauer Str. 29', postalCode: '93102', locality: 'Pfatter', region: 'Pfatter',
    });
  });

  it('Kasseburg: „Ort:" nur mit Namen, Bild aus der Galerie', () => {
    const url = 'https://www.kasseburg.de/Termine/Info-Spieleabend.php?object=&ModID=11&FID=3874.242.1&NavID=3874.17';
    expect(parseIkissDetail(fx('kasseburg-spieleabend'), url)).toMatchObject({
      title: 'Info- & Spieleabend', start: '2026-11-13T16:00:00.000Z', locationName: 'Dorfgemeinschaftshaus Kasseburg',
      image: 'https://www.kasseburg.de/media/custom/3874_132_1_g.JPG?1713699680',
    });
  });

  it('Hamwarde: Beginn und Ende, „Ortschaft" und „Region" (ältere Vorlage `spalte_links`)', () => {
    expect(parseIkissDetail(fx('hamwarde-seniorennachmittag'), HAMWARDE_SENIOREN)).toMatchObject({
      title: 'Kirche Seniorennachmittag', start: '2026-11-25T13:30:00.000Z', end: '2026-11-25T16:00:00.000Z',
      locationName: 'Kirchengemeinde Hamwarde', ortschaft: 'Hamwarde', region: 'Amt Hohe Elbgeest',
    });
  });

  it('Gemünden (Felda) „Beginn:"/„Ende:" über Mitternacht, Veranstalter im Seitenkasten', () => {
    const url = 'https://gemuenden-felda.de/Lebendiges-Gem%C3%BCnden/Veranstaltungen/Karnevalistischer-Lichterumzug.php?object=tx,4124.4.1&ModID=11&FID=4124.143.1&NavID=4124.15&sfvort=1&sfreg=1&sfort=1&bn=1';
    expect(parseIkissDetail(fx('gemuenden-lichterumzug'), url)).toMatchObject({
      title: 'Karnevalistischer Lichterumzug', start: '2026-11-14T17:11:00.000Z', end: '2026-11-15T01:00:00.000Z', allDay: false,
      locationName: 'Ortsdurchfahrt / Dorfplatz', organizer: 'SV 1921 Ehringshausen e.V.',
    });
  });

  it('Hilchenbach „950 Jahre Müsen": ganztägig über vier Tage, keine erfundene Uhrzeit', () => {
    const url = 'https://hilchenbach.de/%C3%9Cber-die-Stadt/Veranstaltungskalender/950-Jahre-M%C3%BCsen.php?object=tx,4242.4.1&ModID=11&FID=4242.20.1&NavID=2632.83&bn=1';
    expect(parseIkissDetail(fx('hilchenbach-950-jahre'), url)).toMatchObject({ localDate: '2029-06-22', start: '2029-06-22', end: '2029-06-25', allDay: true, ortschaft: 'Müsen' });
  });
  it('Algermissen: Titel ist das <h1> vor dem Datum, nicht „Veranstaltungen" im Suchformular; „Gemeinde:" als Ort des Termins', () => {
    const url = 'https://www.algermissen.de/Startseite/Veranstaltungen/Gr%C3%A4bersegnung.php?object=tx,2598.13.1&ModID=11&FID=2598.31959.1&NavID=2598.179&bn=1&ort=546.2';
    expect(parseIkissDetail(fx('algermissen-graebersegnung'), url)).toMatchObject({
      title: 'Gräbersegnung', start: '2026-11-01', allDay: true, locationName: 'Friedhof, Ostpreußenstraße', ortschaft: 'Algermissen',
    });
  });

  it('Wismar: Beschriftung mit Icon im <dt>; das Datum eines Sliders („Datum: 20.12.2024") zählt nicht', () => {
    const url = 'https://www.wismar.de/Tourismus/Veranstaltungen/Veranstaltungskalender/Wismars-Welterbe-entdecken-%C3%B6ffentliche-Stadtf%C3%BChrung.php?object=tx,4176.4.1&ModID=11&FID=4176.398.1&NavID=4176.165&sfodddrt=1&sfreg=1&sfort=1&bn=1';
    expect(parseIkissDetail(fx('wismar-welterbe'), url)).toMatchObject({
      title: 'Wismars Welterbe entdecken - öffentliche Stadtführung', localDate: '2026-11-02', start: '2026-11-02T13:00:00.000Z',
      locationName: 'Tourist-Information Wismar, Lübsche Straße 23a',
    });
  });

  it('Hennigsdorf (`event-info`): „04. Dezember 2026 bis 06. Dezember 2026", Ort und Koordinate aus dem Kartenlink', () => {
    const url = 'https://www.hennigsdorf.de/Stadtleben/Veranstaltungen/Hennigsdorfer-Weihnachtsmarkt-Tradition-Handwerk.php?object=tx,3590.4&ModID=11&FID=3590.782.1&NavID=2713.9&kat%5B0%5D=1%2C2713.5&startkat=2713.5&max=9&k_sub=1';
    expect(parseIkissDetail(fx('hennigsdorf-weihnachtsmarkt'), url)).toMatchObject({
      title: 'Hennigsdorfer Weihnachtsmarkt: Tradition & Handwerk', start: '2026-12-04', end: '2026-12-06', allDay: true,
      locationName: 'Postplatz', lat: 52.63743, lng: 13.204573,
    });
  });

  it('Gießen: „Beginn:"/„Ende:" mit Screenreader-Text „Datum:"/„Uhrzeit:" im Wert, Ende „23:59" offen', () => {
    const url = 'https://www.giessen.de/Erleben/Veranstaltungen/-MEINGIESSEN.php?object=tx,2874.15926.1&ModID=11&FID=2874.51785.1&NavID=1894.29&kat=2874.530&sfvort=1&sfreg=1&sfort=1&bn=1&startkat=2874.530&k_sub=1';
    expect(parseIkissDetail(fx('giessen-meingiessen'), url)).toMatchObject({ localDate: '2026-08-26', start: '2026-08-26T15:00:00.000Z', end: '2026-10-31', allDay: false });
  });

  it('Lennestadt: „bis 23:59 Uhr" ist die Vorgabe des Formulars, das Ende bleibt offen', () => {
    const url = 'https://www.lennestadt.de/Kultur-Freizeit/Kultur/Veranstaltungskalender/Dinnershow-Das-Gold-der-Weihnacht-Elspe-Festival.php?object=tx,3905.4.1&ModID=11&FID=3905.2162.1&NavID=3905.15&sfvort=1&sfreg=1&sfort=1';
    const t = parseIkissDetail(fx('lennestadt-dinnershow'), url)!;
    expect(t.allDay).toBe(false);
    expect(t.end).toBeUndefined();
  });
});

describe('iKISS: Datum und Uhrzeit', () => {
  it('Sommerzeit und Winterzeit, Ende vor Beginn ohne Enddatum bleibt offen', () => {
    expect(ikissWhen('20.06.2027', '18:00 bis 22:00 Uhr')).toEqual({ localDate: '2027-06-20', start: '2027-06-20T16:00:00.000Z', end: '2027-06-20T20:00:00.000Z', allDay: false });
    expect(ikissWhen('31.12.2026', '20:00 Uhr bis 02:00 Uhr')).toEqual({ localDate: '2026-12-31', start: '2026-12-31T19:00:00.000Z', allDay: false });
  });

  it('Monatsnamen: „14. November 2026" (Bad Oldesloe), „01. März 2027"', () => {
    expect(numericDates('14. November 2026 bis 01. März 2027')).toBe('14.11.2026 bis 01.3.2027');
    expect(ikissWhen('14. November 2026', '17.00 Uhr bis 18.30 Uhr')).toEqual({ localDate: '2026-11-14', start: '2026-11-14T16:00:00.000Z', end: '2026-11-14T17:30:00.000Z', allDay: false });
  });

  it('mehrtägig ohne Uhrzeit: ganztägig bis zum letzten Tag', () => {
    expect(ikissWhen('05.12.2026 bis 06.12.2026', undefined)).toEqual({ localDate: '2026-12-05', start: '2026-12-05', end: '2026-12-06', allDay: true });
  });
});

describe('iKISS: Termin → Zeile', () => {
  it('Dorffest „Schützenfest Hordorf": drei Tage ganztägig, Ortsteil Hordorf in Oschersleben (Bode), öffentlich', () => {
    const url = 'https://www.oscherslebenbode.de/Home/Familie-Bildung/Freizeit-und-Vereine/Veranstaltungen/Sch%C3%BCtzenfest-Hordorf.php?object=tx,2962.9659.1&ModID=11&FID=2962.1973.1&NavID=2962.47&max=15';
    const e = entry('15083415', 'Oschersleben (Bode), Stadt', 'sachsen-anhalt', 'https://www.oscherslebenbode.de/Home/Familie-Bildung/Freizeit-und-Vereine/Veranstaltungen/');
    const r = toRow(parseIkissDetail(fx('oschersleben-schuetzenfest-hordorf'), url)!, single(e));
    expect(r).toMatchObject({ start_date: '2027-07-16', end_date: '2027-07-18' });
    expect(r.location_resolution.gemeinde?.name).toBe('Oschersleben (Bode)');
    expect(r.publish_status).toMatch(/^published/);
  });

  it('Gemeinde-Dienst: Quarantäne municipal_service (Amt Hohe Elbgeest „Bürgermeistersprechstunde")', () => {
    const url = 'https://www.amt-hohe-elbgeest.de/Aktuelles/Veranstaltungen/B%C3%BCrgermeistersprechstunde.php?object=tx,2610.13.1&ModID=11&FID=2610.530.1&NavID=2610.238&sfvort=1';
    const r = toRow(parseIkissDetail(fx('hohe-elbgeest-buergermeistersprechstunde'), url)!, single(entry('01053050', 'Hamwarde', 'schleswig-holstein', HAMWARDE)));
    expect(r.location_resolution.admission?.reasons).toContain('municipal_service');
    expect(r.publish_status).not.toMatch(/^published/);
  });

  const pfatter = entry('09375183', 'Pfatter', 'bayern', PFATTER);
  it('Pfatter: Gemeinde Pfatter, source_id aus Website und FID, Quelle verlinkt', () => {
    const t = parseIkissDetail(fx('pfatter-theater'), PFATTER_THEATER)!;
    const r = toRow(t, single(pfatter));
    expect(r).toMatchObject({ source_id: 'ikiss-www.pfatter.de-4257.5597.1', source_url: PFATTER_THEATER, start_date: '2026-10-30T18:30:00.000Z', country: 'DE' });
    expect(r.location_resolution.gemeinde?.name).toBe('Pfatter');
  });

  it('Amtskalender: „Ortschaft: Hamwarde" ordnet den Termin Hamwarde zu', () => {
    const amt: FeedGroup = {
      feedUrl: 'https://www.amt-hohe-elbgeest.de/Aktuelles/Veranstaltungen/', pageUrl: 'https://www.amt-hohe-elbgeest.de/Aktuelles/Veranstaltungen/',
      own: [entry('01053050', 'Hamwarde', 'schleswig-holstein', null, 'amt-hohe-elbgeest.de'), entry('01053023', 'Dassendorf', 'schleswig-holstein', null, 'amt-hohe-elbgeest.de')], viaVerband: [],
    };
    const r = toRow(parseIkissDetail(fx('hamwarde-seniorennachmittag'), HAMWARDE_SENIOREN)!, amt);
    expect(r.location_resolution.gemeinde?.name).toBe('Hamwarde');
  });
});

describe('iKISS: Kalender der Registry', () => {
  it('RSS-Link auf fremdem Host: derselbe Pfad auf der Website des RSS (Magdeburg)', () => {
    expect(onSite('https://projekt13.kid-magdeburg.de/B%C3%BCrger-Stadt/System/Veranstaltungskalender/Wir-hatten-doch-die-Kinder.php?ModID=11&FID=115.23752.1', 'https://www.magdeburg.de/media/rss/Veranstaltungsexport.xml'))
      .toBe('https://www.magdeburg.de/B%C3%BCrger-Stadt/System/Veranstaltungskalender/Wir-hatten-doch-die-Kinder.php?ModID=11&FID=115.23752.1');
  });

  it('ohne Kalenderseite die Startseite, `&amp;` aus der Registry dekodiert, Gemeinde-Kalender vor Amtskalendern', () => {
    const a = entry('01053050', 'Hamwarde', 'schleswig-holstein', HAMWARDE);
    const b = { ...entry('01053023', 'Dassendorf', 'schleswig-holstein', 'https://www.amt-hohe-elbgeest.de/Aktuelles/Veranstaltungen/') };
    const c = { ...entry('01053012', 'Börnsen', 'schleswig-holstein', 'https://www.amt-hohe-elbgeest.de/Aktuelles/Veranstaltungen/') };
    const s = entry('09375196', 'Schierling', 'bayern', 'https://www.schierling.de/Hauptpunkt-1/Veranstaltungen/?&amp;kat=4283.13');
    const n = entry('01051003', 'Averlak', 'schleswig-holstein', null, 'amt-burg-st-michaelisdonn.de');
    expect(ikissGroups([b, c, a, s, n]).map(g => [g.pageUrl, g.own.length])).toEqual([
      ['https://www.amt-burg-st-michaelisdonn.de/', 1],
      ['https://www.amt-hohe-elbgeest.de/Gemeinden/Hamwarde/Aktuelles/Veranstaltungen/', 1],
      ['https://www.schierling.de/Hauptpunkt-1/Veranstaltungen/?&kat=4283.13', 1],
      ['https://www.amt-hohe-elbgeest.de/Aktuelles/Veranstaltungen/', 2],
    ]);
  });
});
