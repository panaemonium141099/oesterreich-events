/**
 * Regression: gekürzte source_id bei gemeinde-registry.
 *
 * Die ID war `Buffer.from(titel + beginn).toString('base64').substring(0, 24)`,
 * also nur die ersten 18 Byte von Titel und Datum. Ab 18 Byte Titel fiel
 * das Datum weg: alle Termine eines Titels teilten eine Zeile, die jede
 * Nacht zum nächsten Termin auf der Seite wanderte und als alte Zeile im
 * Dedup Primary vor den richtigen Zeilen blieb.
 *
 * Prod-Befund 2026-10-11: 8.799 von 9.107 künftigen Registry-Zeilen (ohne
 * CITIES) hatten eine ID ohne vollständiges Datum, 1.335 davon wechselten
 * seit 14.09. den Tag. Beispiel c47ce3a5 (scheiblingkirchen-thernberg.gv.at,
 * `registry-gem2go-QmF1ZXJubWFya3QgRmFtLiBF` = „Bauernmarkt Fam. E…",
 * angelegt 2026-04-02): 10.10., dann 14.11., Primary vor der gem2go-Zeile
 * des 14.11.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { GemeindeRegistryScraper } from '../../lib/scrapers/GemeindeRegistryScraper';
import { planSourceIdMigrations } from '../../lib/db/source-id-migration';
import { normalizeEventTimestamps } from '../../lib/db/supabase-sync';
import type { ScrapedEvent } from '@/types/events';

// Die Registry verwirft vergangene Termine.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T08:00:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
});

const URL = 'https://www.scheiblingkirchen-thernberg.gv.at/system/web/veranstaltung.aspx';
const BAUERNMARKT = 'Bauernmarkt Fam. Eisenkölbl beim Sparmarkt-Koller';
const OLD_ID = 'registry-gem2go-QmF1ZXJubWFya3QgRmFtLiBF';

const entry = (strategy: string, eventUrl = URL) => ({
  name: 'Scheiblingkirchen-Thernberg', plz: '2831', bundesland: 'Niederösterreich', bezirk: 'Neunkirchen',
  lat: 47.66, lng: 16.13, strategy, status: 'active', eventUrl,
});
const parse = (html: string, strategy: string, eventUrl?: string): ScrapedEvent[] =>
  (new GemeindeRegistryScraper() as any).parsePage(`<html><body>${html}</body></html>`, entry(strategy, eventUrl));

/** Karte im GEM2GO-BEM-Layout wie auf der Seite. */
const bemCard = (title: string, date: string, time: string, href: string) =>
  `<div class="bemCard"><div class="bemHeaderContainer"><span class="bemHeader bemHeader--h5">${title}</span></div>` +
  `<div class="bemContainer--date">${date}</div><div class="bemContainer--time">${time}</div>` +
  `<a class="bemLink-detail" href="${href}">Details</a></div>`;

const bauernmarkt = parse(
  bemCard(BAUERNMARKT, 'Sa, 14.11.2026', '08:00', '/Bauernmarkt_Fam_Eisenkoelbl_beim_Sparmarkt-Koller_2') +
  bemCard(BAUERNMARKT, 'Sa, 12.12.2026', '08:00', '/Bauernmarkt_Fam_Eisenkoelbl_beim_Sparmarkt-Koller_3'),
  'gem2go',
);

describe('gemeinde-registry: eine source_id je Termin', () => {
  it('trennt zwei Termine eines langen Titels', () => {
    expect(bauernmarkt.map(e => e.start_date)).toEqual(['2026-11-14T08:00:00', '2026-12-12T08:00:00']);
    expect(new Set(bauernmarkt.map(e => e.source_id)).size).toBe(2);
    expect(bauernmarkt[0].source_id).toMatch(/^registry-gem2go-[0-9a-f]{16}-2026-11-14$/);
    expect(bauernmarkt[1].source_id).toMatch(/^registry-gem2go-[0-9a-f]{16}-2026-12-12$/);
  });

  it('bleibt von Lauf zu Lauf gleich', () => {
    // Festgeschrieben (sha256 aus Titel + Beginn): eine geänderte Bildung
    // legte jede Zeile neu an.
    expect(bauernmarkt[0].source_id).toBe('registry-gem2go-6caf2b2f216919c3-2026-11-14');
  });

  it('trennt Termine am selben Tag zu verschiedenen Uhrzeiten', () => {
    const events = parse(
      bemCard('Kinderführung durch die Burgruine Thernberg', 'So, 18.10.2026', '10:00', '/a') +
      bemCard('Kinderführung durch die Burgruine Thernberg', 'So, 18.10.2026', '14:00', '/b'),
      'gem2go',
    );
    expect(events).toHaveLength(2);
    expect(events[0].source_id).not.toBe(events[1].source_id);
  });

  it('meldet die gekürzte alte ID als previous_source_id', () => {
    expect(bauernmarkt.map(e => e.previous_source_id)).toEqual([OLD_ID, OLD_ID]);
  });

  it('gilt auch für die Datums-Blöcke (registry-gen)', () => {
    const title = 'Seniorennachmittag im Pfarrheim Unterbergern';
    const events = parse(
      `<article><h3>${title}</h3><p>05.11.2026, 15:00 Uhr</p></article>` +
      `<article><h3>${title}</h3><p>03.12.2026, 15:00 Uhr</p></article>`,
      'generic-dates',
    );
    const old = `registry-gen-${Buffer.from(title + '2026-11-05T15:00:00').toString('base64').substring(0, 24)}`;
    expect(old).toBe(`registry-gen-${Buffer.from(title + '2026-12-03T15:00:00').toString('base64').substring(0, 24)}`);
    expect(events.map(e => e.source_id)).toEqual([
      expect.stringMatching(/^registry-gen-[0-9a-f]{16}-2026-11-05$/),
      expect.stringMatching(/^registry-gen-[0-9a-f]{16}-2026-12-03$/),
    ]);
    expect(events.map(e => e.previous_source_id)).toEqual([old, old]);
  });
});

describe('gemeinde-registry: Übernahme der alten Zeile', () => {
  // Wie im Sync: Wandzeit → Instant, dann Plan.
  const events = normalizeEventTimestamps(bauernmarkt);
  const legacy = (start: string, source_url = `https://www.scheiblingkirchen-thernberg.gv.at/Bauernmarkt_Fam_Eisenkoelbl_beim_Sparmarkt-Koller_2`) =>
    ({ id: 'c47ce3a5', source_name: 'gemeinde-registry', source_id: OLD_ID, start_date: start, source_url });
  const now = new Date('2026-10-11T08:00:00Z');

  it('gibt die Zeile genau an den Termin, auf dem sie steht', () => {
    // Prod: c47ce3a5 steht auf 14.11. 07:00Z (08:00 Wien).
    expect(planSourceIdMigrations(events, [legacy('2026-11-14T07:00:00+00:00')], new Set(), now)).toEqual([
      { id: 'c47ce3a5', source_name: 'gemeinde-registry', from: OLD_ID, to: bauernmarkt[0].source_id },
    ]);
    expect(planSourceIdMigrations(events, [legacy('2026-12-12T07:00:00+00:00')], new Set(), now)).toEqual([
      { id: 'c47ce3a5', source_name: 'gemeinde-registry', from: OLD_ID, to: bauernmarkt[1].source_id },
    ]);
  });

  it('gibt eine Zeile nicht an den Termin einer anderen Gemeinde mit gleichem ID-Anfang', () => {
    // 538 von 13.099 alten IDs standen in der Rohschicht unter mehreren
    // Websites ("16. Waldviertler Jobmesse" auf brunn-wild.gv.at und irnfritz.at).
    const other = normalizeEventTimestamps(parse(
      bemCard(BAUERNMARKT, 'Sa, 14.11.2026', '08:00', '/x'),
      'gem2go', 'https://www.irnfritz.at/system/web/veranstaltung.aspx',
    ));
    expect(other[0].previous_source_id).toBe(OLD_ID);
    expect(planSourceIdMigrations(other, [legacy('2026-11-14T07:00:00+00:00')], new Set(), now)).toEqual([]);
  });
});
