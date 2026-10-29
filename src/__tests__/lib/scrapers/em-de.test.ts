/**
 * DE-Adapter Events Manager (fn-29.7), Golden-Tests auf echten iCal-Exporten
 * (abgerufen 2026-10-29): Langenselbold (TZID), Laubach (`Z` = Ortszeit),
 * Leiblfing (00:00 = ohne Uhrzeit, mehrtägig).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emCompleteDays, EM_LIMIT, parseEmIcs, parseEmLocation } from '@/lib/scrapers/de/em';
import { EventsManagerDeScraper } from '@/lib/scrapers/de/EventsManagerDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { FeedGroup } from '@/lib/registry-de/load';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'em', f), 'utf8');

describe('Events Manager: iCal lesen', () => {
  it('TZID Europe/Berlin, Ort „Name, Straße, Ort, PLZ, Deutschland", Detailseite', () => {
    const e = parseEmIcs(fx('langenselbold.ics')).find(x => x.title.startsWith('EinTopf'))!;
    expect(e).toMatchObject({
      start: '2026-10-29T11:00:00.000Z', end: '2026-10-29T12:30:00.000Z', allDay: false,
      locationName: 'Katharina-von-Bora-Haus', street: 'Hinserdorfstraße 2a', postalCode: '63505', locality: 'Langenselbold',
    });
    expect(e.url).toMatch(/^https:\/\/langenselbold\.de\/veranstaltungskalender\//);
  });

  it('„Z" ohne TZID ist die Ortszeit der Website (Laubach „Repair Café", Seite 14:30)', () => {
    const e = parseEmIcs(fx('laubach.ics')).find(x => x.title === 'Repair Café')!;
    expect(e.start).toBe('2026-11-28T13:30:00.000Z');
    expect(e.lat).toBeCloseTo(50.5417, 3);
  });

  it('00:00 heißt ohne Uhrzeit, Ende um Mitternacht ist der letzte Tag (Leiblfing „Sa. 19. bis So. 20. Dezember")', () => {
    const e = parseEmIcs(fx('leiblfing.ics')).find(x => x.title.startsWith('Glühkindlfest'))!;
    expect(e).toMatchObject({ allDay: true, start: '2026-12-19', end: '2026-12-20', localDate: '2026-12-19' });
  });

  it('VALUE=DATE: Ende ausschließlich (Bergenhusen „Halloween Ralley", Seite „31/10/2026 Ganztägig")', () => {
    const e = parseEmIcs(fx('bergenhusen.ics')).find(x => x.title.includes('Halloween'))!;
    expect(e).toMatchObject({ allDay: true, start: '2026-10-31' });
    expect(e.end).toBeUndefined();
  });

  it('Ort ohne PLZ, Link kein Ort, doppelte Teile einmal', () => {
    // Straße nur mit Hausnummer (sonst wäre „Marktplatz" eine Straße): Brühlweg bleibt beim Namen.
    expect(parseEmLocation('Parkplatz an der Gründauhalle, Brühlweg, Langenselbold, Deutschland')).toEqual({
      locationName: 'Parkplatz an der Gründauhalle, Brühlweg', street: undefined, postalCode: undefined, locality: 'Langenselbold',
    });
    expect(parseEmLocation('https://nachtderausbildung-bensheim.de/, Bensheim, Deutschland').locationName).toBe('Bensheim');
    expect(parseEmLocation('Kirchplatz, Kirchplatz, Laubach, Deutschland')).toMatchObject({ locationName: 'Kirchplatz', locality: 'Laubach' });
  });

  it('Antwort an der Grenze von 50: ohne den letzten Tag', () => {
    const evs = parseEmIcs(fx('langenselbold.ics'));
    expect(evs).toHaveLength(EM_LIMIT);
    const last = evs.reduce((a, e) => (e.localDate > a ? e.localDate : a), '');
    const done = emCompleteDays(evs);
    expect(done.length).toBeLessThan(EM_LIMIT);
    expect(done.every(e => e.localDate < last)).toBe(true);
  });
});

describe('Events Manager: Termin → Zeile', () => {
  it('Gemeinde aus PLZ und Ort, Quelle die Detailseite', () => {
    const g: FeedGroup = {
      feedUrl: 'https://langenselbold.de/events.ics', pageUrl: 'https://langenselbold.de/',
      own: [{ ags: '06435017', name: 'Langenselbold', land: 'hessen', host: null, stufe: 'A', integration: 'eventsmanager', url: null, checked_at: '2026-10-29' }], viaVerband: [],
    };
    const e = parseEmIcs(fx('langenselbold.ics')).find(x => x.title.startsWith('EinTopf'))!;
    const s = new EventsManagerDeScraper().toScraped(e, g);
    expect(s).toMatchObject({ source_url: e.url, country: 'DE', postal_code: '63505' });
    expect(s.source_id).toBe(`em-langenselbold.de-${e.uid}-2026-10-29`);
    const row = toSupabaseRow(s, new Map(), new Map()).row as unknown as { location_resolution: { gemeinde: { name: string } | null } };
    expect(row.location_resolution.gemeinde?.name).toBe('Langenselbold');
  });
});
