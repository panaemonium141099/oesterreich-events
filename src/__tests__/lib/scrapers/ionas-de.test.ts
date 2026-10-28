/**
 * DE-Adapter ionas (fn-29.5), Golden-Tests auf echten iCal-Exporten
 * (abgerufen 2026-10-28): Amt Sandesneben-Nusse (Amtskalender, mehrere
 * Gemeinden), Hopsten, Longuich, Parchim.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ionasIcsUrl, parseIonasIcs } from '@/lib/scrapers/de/ionas';
import { IonasDeScraper } from '@/lib/scrapers/de/IonasDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'ionas', f), 'utf8');

const entry = (o: Partial<RegistryEntryDe>): RegistryEntryDe => ({
  ags: '01053114', name: 'X', land: 'schleswig-holstein', host: null, stufe: 'A', integration: 'ionas', url: null, checked_at: '2026-10-28', ...o,
});

describe('ionas: iCal lesen', () => {
  it('Amtskalender: Ort aus X-Feldern, Veranstalter, Wandzeit Europe/Berlin', () => {
    const evs = parseIonasIcs(fx('amt-sn.ics'));
    expect(evs).toHaveLength(14);
    const kaffee = evs.find(e => e.title === 'Amts-Senioren-Kaffee in Steinhorst')!;
    expect(kaffee).toMatchObject({ locationName: 'Multifunktionshaus', street: 'Schulstraße 3', postalCode: '23847', locality: 'Steinhorst', localDate: '2026-10-29' });
    // 29.10.2026 15:00 MEZ (Winterzeit seit 25.10.) = 14:00 UTC
    expect(kaffee.start).toBe('2026-10-29T14:00:00.000Z');
    // 15:00–15:00: Ende unbekannt
    expect(kaffee.end).toBeUndefined();
    const cafe = evs.find(e => e.title === 'Buntes Café')!;
    expect(cafe.organizer).toBe('Flisanu');
    // UID-Datum ist nicht das Termindatum: die source_id nimmt den Termintag.
    expect(cafe.uid).toBe('22b35992-5d03-4aff-9258-bf89c494e6c8');
    expect(cafe.localDate).toBe('2026-10-30');
  });

  it('ganztägig: DTEND ist exklusiv (Longuicher Weinstraßenkirmes 7. bis 9.8.2027)', () => {
    const k = parseIonasIcs(fx('longuich.ics')).find(e => e.title.startsWith('25. Longuicher Weinstraßenkirmes'))!;
    expect(k).toMatchObject({ allDay: true, start: '2027-08-07', end: '2027-08-09' });
  });

  it('Koordinate aus GEO', () => {
    const withGeo = parseIonasIcs(fx('hopsten.ics')).filter(e => e.lat != null);
    expect(withGeo.length).toBeGreaterThan(0);
    expect(withGeo[0].lat).toBeCloseTo(52.384, 2);
    expect(withGeo[0].lng).toBeCloseTo(7.605, 2);
  });

  it('alle Termine haben Titel, Beginn und eine eindeutige ID je Tag', () => {
    for (const f of ['amt-sn.ics', 'hopsten.ics', 'longuich.ics', 'parchim.ics']) {
      const evs = parseIonasIcs(fx(f));
      expect(evs.length).toBeGreaterThan(0);
      for (const e of evs) {
        expect(e.title.length).toBeGreaterThan(1);
        expect(e.start).toMatch(/^\d{4}-\d{2}-\d{2}/);
        if (e.end) expect(e.end > e.start).toBe(true);
      }
      const ids = evs.map(e => `${e.uid}-${e.localDate}-${e.start}`);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('TEXT entmaskieren in einem Durchgang: \\" (Nidda), \\, und \\\\n bleibt Backslash + n', () => {
    const ics = [
      'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:x:20261109', 'DTSTART;TZID=Europe/Berlin:20261109T180000',
      'SUMMARY:\\"Talk am Turm\\"', 'LOCATION:Kirche\\, Saal C:\\\\new', 'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const [e] = parseIonasIcs(ics);
    expect(e.title).toBe('"Talk am Turm"');
    expect(e.locationName).toBe('Kirche, Saal C:\\new');
  });

  it('iCal-URL mit Zeitfenster aus dem events.json der Registry', () => {
    expect(ionasIcsUrl('https://www.amt-sn.de/kalender/events.json?weekends=false&tagMode=ALL', '2026-10-28', '2027-10-28'))
      .toBe('https://www.amt-sn.de/kalender/event.ics?weekends=false&tagMode=ALL&start=2026-10-28&end=2027-10-28');
  });
});

describe('ionas: Termin → Zeile', () => {
  const scraper = new IonasDeScraper();
  const amt: FeedGroup = {
    feedUrl: 'https://www.amt-sn.de/kalender/events.json', pageUrl: 'https://www.amt-sn.de/kalender/',
    own: [entry({ ags: '01053025', name: 'Duvensee' }), entry({ ags: '01053039', name: 'Groß Boden' })], viaVerband: [],
  };

  it('Amtskalender: Ort und PLZ aus dem Termin, kein Gemeinde-Mittelpunkt der Amtsseite', () => {
    const ev = parseIonasIcs(fx('amt-sn.ics')).find(e => e.title === 'Amts-Senioren-Kaffee in Steinhorst')!;
    const s = scraper.toScraped(ev, amt);
    expect(s).toMatchObject({ country: 'DE', city: 'Steinhorst', postal_code: '23847', address: 'Schulstraße 3, 23847 Steinhorst', location_name: 'Multifunktionshaus', source_url: 'https://www.amt-sn.de/kalender/' });
    expect(s.latitude).toBeUndefined();
    const row = toSupabaseRow(s, new Map(), new Map()).row as unknown as { postal_code: string; location_resolution: { gemeinde: { name: string } | null }; bundesland: string | null };
    expect(row.postal_code).toBe('23847');
    expect(row.location_resolution.gemeinde?.name).toBe('Steinhorst');
    expect(row.bundesland).toBeNull();
  });

  it('Kalender einer einzelnen Gemeinde: deren Ort, PLZ und Mittelpunkt als Gebietsangabe', () => {
    const ev = { ...parseIonasIcs(fx('amt-sn.ics'))[0], street: undefined, postalCode: undefined, locality: undefined };
    const s = scraper.toScraped(ev, { ...amt, own: [entry({ ags: '07143205', name: 'Atzelgift', land: 'rheinland-pfalz' })] });
    expect(s.city).toBe('Atzelgift');
    expect(s.postal_code).toBe('57629');
    expect(s.coords_precision).toBe('municipality');
  });

  it('keine Bilder (Nutzungsrecht nicht belegt)', () => {
    const ev = parseIonasIcs(fx('parchim.ics'))[0];
    expect(scraper.toScraped(ev, amt).image_url).toBeUndefined();
  });
});

describe('ionas: Quelle und Amtskalender', () => {
  it('derselbe Termin zweimal im Feed: einer bleibt (Bad Honnef „Bilderbuchkino")', async () => {
    const { collapseSourceDuplicates } = await import('@/lib/scrapers/de/IonasDeScraper');
    const a = { uid: 'b', localDate: '2026-11-18', start: '2026-11-18T15:00:00.000Z', allDay: false, title: 'Bilderbuchkino in der Stadtbücherei', locationName: 'Stadtbücherei' };
    const b = { ...a, uid: 'a' };
    const c = { ...a, uid: 'c', start: '2026-11-18T17:00:00.000Z' };
    expect(collapseSourceDuplicates([a, b, c]).map(e => e.uid)).toEqual(['a', 'c']);
  });

  it('Mitgliedsgemeinde nur, wenn genau eine im Titel steht, nie aus einem Bindestrich-Namen', async () => {
    const { namedMember, feedGemeinden } = await import('@/lib/scrapers/de/IonasDeScraper');
    const members = feedGemeinden([{ ags: '01053025' }, { ags: '01053039' }]); // Duvensee, Groß Boden
    expect(namedMember({ title: 'Laternenumzug in Duvensee' }, members)?.name).toBe('Duvensee');
    expect(namedMember({ title: 'Grünkohlessen' }, members)).toBeNull();
    expect(namedMember({ title: 'Feiern in Duvensee und Groß Boden', locationName: 'Groß Boden' }, members)).toBeNull();
    expect(namedMember({ title: 'Lesung mit Anna Duvensee' }, members)).toBeNull();
    expect(namedMember({ title: 'Treffen in Amt Duvensee-Nord' }, members)).toBeNull();
    // Klinkrade gehört zum Amt Sandesneben-Nusse, steht aber nicht in der Registry.
    expect(namedMember({ title: 'Sitzung', locationName: 'Feuerwehrhaus Klinkrade-1' }, members)?.name).toBe('Klinkrade');
  });

  it('Amtskalender: Name ohne Klammerzusatz („Ahlden (Aller)")', async () => {
    const { namedMember, feedGemeinden } = await import('@/lib/scrapers/de/IonasDeScraper');
    expect(namedMember({ title: 'Adventsmarkt in Ahlden' }, feedGemeinden([{ ags: '03358001' }]))?.name).toBe('Ahlden (Aller)');
  });
});
