/**
 * DE-Adapter NOLIS (fn-29.6), Golden-Tests auf echten iCal-Exporten
 * (abgerufen 2026-10-28, Fenster 365 Tage): Barsbüttel, Lütjensee.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { robotsCrawlDelay } from '@/lib/registry-de/robots';
import { nolisDetailUrl, nolisGeo, nolisIcsUrl, parseNolisIcs, parseNolisLocation } from '@/lib/scrapers/de/nolis';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'nolis', f), 'utf8');

describe('NOLIS: iCal lesen', () => {
  it('UTC-Zeit, Termin-ID aus X-ID, Ort aus LOCATION und X-ORT', () => {
    const evs = parseNolisIcs(fx('barsbuettel.ics'));
    expect(evs).toHaveLength(91);
    const e = evs.find(x => x.uid === '900007877')!;
    // Detailseite: „Mi., 28.10.2026, 15:00 - 16:00 Uhr"
    expect(e).toMatchObject({
      title: 'Eltern-Kind-Gruppe "Die kleinen Spatzen"', kommuneId: '22800', localDate: '2026-10-28',
      start: '2026-10-28T14:00:00.000Z', end: '2026-10-28T15:00:00.000Z',
      locationName: 'Kindergarten Falkennest', street: 'Falkenstraße 9L', postalCode: '22885', locality: 'Barsbüttel', ort: 'Barsbüttel',
      organizer: 'Familienzentrum FaSiBa', cancelled: false,
    });
    expect(e.lat).toBeUndefined(); // GEO 0;0
  });

  it('jeder Termin eine eigene ID', () => {
    for (const f of ['barsbuettel.ics', 'luetjensee.ics']) {
      const ids = parseNolisIcs(fx(f)).map(e => e.uid);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('lokale Mitternacht heißt ohne Uhrzeit, DTEND dann einschließlich (Märkische Schweiz, Rhede)', () => {
    const ics = (start: string, end?: string) => ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'X-ID:28220_900003433', 'SUMMARY:Rheder Weihnachtsmarkt', `DTSTART:${start}`, ...(end ? [`DTEND:${end}`] : []), 'END:VEVENT', 'END:VCALENDAR'].join(String.fromCharCode(13, 10));
    // Seite: „Do., 03.12.2026 bis So., 06.12.2026"
    expect(parseNolisIcs(ics('20261202T230000Z', '20261205T230000Z'))[0]).toMatchObject({ allDay: true, start: '2026-12-03', end: '2026-12-06', localDate: '2026-12-03' });
    // Sommerzeit: 22:00Z ist Mitternacht. Seite: „Mi., 28.10.2026" (Winter) bzw. Sommertermin ohne Uhrzeit
    expect(parseNolisIcs(ics('20270611T220000Z'))[0]).toMatchObject({ allDay: true, start: '2027-06-12' });
    // 22:00Z im Dezember ist 23:00 Ortszeit, eine echte Uhrzeit (Legden „14:00 bis 23:00 Uhr")
    expect(parseNolisIcs(ics('20261128T130000Z', '20261128T220000Z'))[0]).toMatchObject({ allDay: false, start: '2026-11-28T13:00:00.000Z', end: '2026-11-28T22:00:00.000Z' });
  });

  it('Ende 23:59:59 ist das Tagesende, keine Uhrzeit (Marburg)', () => {
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'X-ID:23001_900097012', 'SUMMARY:Denis Papin (1647-1713)', 'DTSTART:20261030T160000Z', 'DTEND:20261030T225959Z', 'END:VEVENT', 'END:VCALENDAR'].join(String.fromCharCode(13, 10));
    const [e] = parseNolisIcs(ics);
    expect(e.start).toBe('2026-10-30T16:00:00.000Z');
    expect(e.end).toBeUndefined();
  });

  it('GEO steht als Länge;Breite', () => {
    expect(nolisGeo('10.208733368;53.561771084')).toEqual({ lat: 53.561771084, lng: 10.208733368 });
    expect(nolisGeo('53.56;10.20')).toEqual({ lat: 53.56, lng: 10.2 });
    expect(nolisGeo('0.000000000;0.000000000')).toBeNull();
    expect(nolisGeo('16.3;48.2')).toBeNull(); // Wien: nicht in Deutschland
  });

  it('LOCATION zerlegen', () => {
    expect(parseNolisLocation('Waldenburger Weg 2, DRK Ortsverein Barsbüttel,\n22885 Barsbüttel')).toEqual({
      locationName: 'DRK Ortsverein Barsbüttel', street: 'Waldenburger Weg 2', postalCode: '22885', locality: 'Barsbüttel',
    });
    expect(parseNolisLocation('Am Spritzenhaus 2,\n22885 22885 Barsbüttel').locality).toBe('Barsbüttel');
    expect(parseNolisLocation('Familienspielplatz Buchenstraße')).toEqual({ locationName: 'Familienspielplatz Buchenstraße' });
  });

  it('Zeitfenster und Detailseite', () => {
    const u = new URL(nolisIcsUrl('https://www.barsbuettel.de/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&auswahl_woche_tage=28&selected_kommune=22800&beginn=20261028000000&ende=20261127235959', '2026-10-28', '2027-10-28'));
    expect(u.searchParams.get('beginn')).toBe('20261028000000');
    expect(u.searchParams.get('ende')).toBe('20271028235959');
    expect(u.searchParams.get('auswahl_woche_tage')).toBe('366');
    expect(u.searchParams.get('selected_kommune')).toBe('22800');
    expect(nolisDetailUrl('https://www.barsbuettel.de/veranstaltungen/veranstaltungen.ical?x=1', { uid: '900007877', kommuneId: '22800', title: 'Eltern-Kind-Gruppe "Die kleinen Spatzen"' }))
      .toBe('https://www.barsbuettel.de/regional/veranstaltungen/eltern-kind-gruppe-die-kleinen-spatzen-900007877-22800.html');
    // Website des Veranstalters im URL-Feld zählt nicht, Marburgs Terminlink schon.
    expect(nolisDetailUrl('https://www.barsbuettel.de/x.ical', { uid: '1', kommuneId: '2', title: 'A', url: 'http://www.familienzentrum-fasiba.de' })).toBe('https://www.barsbuettel.de/regional/veranstaltungen/a-1-2.html');
    const marburg = 'https://www.marburg.de/portal/seiten/Seite-900002802-23001.html#/veranstaltungen/RPT/12ca10a4-4356-49ab-8b1e-b37756fdb753';
    expect(nolisDetailUrl('https://www.marburg.de/veranstaltungen/veranstaltungen.ical?x=1', { uid: '900097012', kommuneId: '23001', title: 'Denis Papin', url: marburg })).toBe(marburg);
  });
});

describe('robots.txt: Crawl-delay', () => {
  const txt = (...lines: string[]) => lines.join(String.fromCharCode(10));
  it('eigene Gruppe vor *, ohne Angabe null', () => {
    expect(robotsCrawlDelay(txt('User-agent: *', 'Crawl-delay: 5', 'Disallow: /x'), 'lasstreffen')).toBe(5);
    expect(robotsCrawlDelay(txt('User-agent: lasstreffen', 'Disallow: /y', '', 'User-agent: *', 'Crawl-delay: 10'), 'lasstreffen')).toBeNull();
    expect(robotsCrawlDelay(txt('User-agent: *', 'Disallow: /x'), 'lasstreffen')).toBeNull();
    expect(robotsCrawlDelay(null, 'lasstreffen')).toBeNull();
  });
});

describe('NOLIS: Obergrenze 1.000', () => {
  it('gekappte Antwort ohne den letzten, angeschnittenen Tag; kürzere bleibt ganz', async () => {
    const { completeDays, NOLIS_MAX } = await import('@/lib/scrapers/de/nolis');
    const ev = (i: number, day: string) => ({ uid: String(i), kommuneId: '1', localDate: day, start: `${day}T10:00:00.000Z`, allDay: false, title: 't', cancelled: false });
    const full = Array.from({ length: NOLIS_MAX }, (_, i) => ev(i, i < 990 ? '2026-11-17' : '2026-11-18'));
    expect(completeDays(full)).toHaveLength(990);
    expect(completeDays(full.slice(0, 999))).toHaveLength(999);
  });
});
