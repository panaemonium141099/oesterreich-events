/**
 * Regression: innsbrucktermine.at zeigt je Termin mal die richtige Uhrzeit,
 * mal eine Stunde früher, je nach Import der Seite (Liste, Detailseite und
 * `?date=` stimmen dabei untereinander überein).
 *
 * Prod-Befund 2026-11-03: 27 Seiten-Tage mit mehreren sichtbaren Registry-
 * Zeilen derselben Detailseite, je Lesart eine (source_id aus Titel +
 * Beginn). Beispiel „Jazz & Apéro" 18.11.2026: Zeile 16:30Z
 * (registry-gen-5ed4b99d389b6f8b, ?date=1795019400, Seite zeigt 17:30)
 * neben 17:30Z (registry-gen-1edc350e4a783406, ?date=1795023000, zuletzt
 * gesehen 28.10.). Der Spielplan des Landestheaters nennt 18:30, die
 * Feratel-Zeilen stehen auf 17:30Z. Mit zwei Registry-Zeilen passte die
 * Feratel-Zeile zu zwei Lesarten, der Dedup ließ sie mit keiner zusammen
 * (dedup_audit AT 114).
 *
 * Schnappschüsse: fixtures/innsbrucktermine-p3.html und -p4.html
 * (~p3.html / ~p4.html vom 03.11.2026, auf die Karten gekürzt).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GemeindeRegistryScraper, loadRegistryEntries, withoutStartTime } from '../../lib/scrapers/GemeindeRegistryScraper';
import { planSourceIdMigrations, planSupersededRows, type LegacyRow } from '../../lib/db/source-id-migration';
import { normalizeEventTimestamps } from '../../lib/db/supabase-sync';
import type { ScrapedEvent } from '@/types/events';

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T18:30:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
});

const entry = {
  name: 'Innsbruck', plz: '6020', bundesland: 'Tirol', bezirk: 'Innsbruck',
  lat: 47.26, lng: 11.39, strategy: 'generic-dates', status: 'active', eventUrl: 'https://www.innsbrucktermine.at',
};
const fixture = (page: string) =>
  readFileSync(join(__dirname, 'fixtures', `innsbrucktermine-${page}.html`), 'utf8');
const parse = (html: string): ScrapedEvent[] => {
  const events: ScrapedEvent[] = (new GemeindeRegistryScraper() as any).parsePage(html, entry);
  withoutStartTime(events);
  return events;
};
const find = (events: ScrapedEvent[], title: string, day: string) =>
  events.filter(e => e.title === title && e.start_date.startsWith(day));

/**
 * Lesart eine Stunde später: ?date= und Badge der Karte (`datetime` ohne,
 * Text mit führender Null), wie die Seite es abwechselnd ausliefert.
 */
const laterReading = (html: string, slug: string, epoch: number) => {
  const card = new RegExp(
    `(${slug}\\?date=)${epoch}([\\s\\S]*?<time datetime="\\d{2}-\\d{2}-\\d{4} )(\\d{1,2})(:\\d{2}">\\d{2}\\.\\d{2}\\.\\d{4} )(\\d{2})(:\\d{2})`,
  );
  if (!card.test(html)) throw new Error(`Karte ${slug}?date=${epoch} fehlt`);
  return html.replace(card, (_m, a, b, h1, c, h2, m) =>
    `${a}${epoch + 3600}${b}${Number(h1) + 1}${c}${String(Number(h2) + 1).padStart(2, '0')}${m}`);
};

const JAZZ_NOW = 'registry-gen-5ed4b99d389b6f8b-2026-11-18'; // Prod, Lesart 17:30
const JAZZ_LATER = 'registry-gen-1edc350e4a783406-2026-11-18'; // Prod, Lesart 18:30

describe('gemeinde-registry: innsbrucktermine.at, eine Zeile je Termin', () => {
  it('liest Jazz & Apéro so, wie die Seite ihn am 03.11. zeigt', () => {
    const [jazz] = find(parse(fixture('p3')), 'Jazz & Apéro', '2026-11-18');
    expect(jazz.start_date).toBe('2026-11-18T17:30:00');
    expect(jazz.source_url).toBe('https://www.innsbrucktermine.at/veranstaltungen/jazz-apero?date=1795019400');
  });

  it('gibt beiden Lesarten dieselbe source_id', () => {
    const now = find(parse(fixture('p3')), 'Jazz & Apéro', '2026-11-18');
    const later = find(parse(laterReading(fixture('p3'), 'jazz-apero', 1795019400)), 'Jazz & Apéro', '2026-11-18');
    expect(later[0].start_date).toBe('2026-11-18T18:30:00');
    expect(later[0].source_url).toContain('?date=1795023000');
    expect(now).toHaveLength(1);
    expect(later[0].source_id).toBe(now[0].source_id);
    // Festgeschrieben: eine geänderte Bildung legte jede Zeile neu an.
    expect(now[0].source_id).toBe('registry-gen-fdd5af5a55b38fb5-2026-11-18');
  });

  it('meldet die Prod-IDs beider Lesarten als previous_source_id', () => {
    const [jazz] = find(parse(fixture('p3')), 'Jazz & Apéro', '2026-11-18');
    expect(jazz.previous_source_id).toEqual(expect.arrayContaining([JAZZ_NOW, JAZZ_LATER]));
  });

  it('trennt zwei Vorstellungen am selben Tag, auch wenn beide kippen', () => {
    const now = find(parse(fixture('p4')), 'Das doppelte Lottchen', '2026-11-19');
    expect(now.map(e => e.start_date)).toEqual(['2026-11-19T09:00:00', '2026-11-19T11:00:00']);
    expect(new Set(now.map(e => e.source_id)).size).toBe(2);

    let html = fixture('p4');
    html = laterReading(html, 'das-doppelte-lottchen', 1795075200);
    html = laterReading(html, 'das-doppelte-lottchen', 1795082400);
    const later = find(parse(html), 'Das doppelte Lottchen', '2026-11-19');
    expect(later.map(e => e.start_date)).toEqual(['2026-11-19T10:00:00', '2026-11-19T12:00:00']);
    expect(later.map(e => e.source_id)).toEqual(now.map(e => e.source_id));
  });

  it('hält Vorstellungen im 75-Minuten-Takt auseinander', () => {
    const kuschel = find(parse(fixture('p4')), 'Kuschelkonzert', '2026-11-20');
    expect(kuschel.map(e => e.start_date.slice(11, 16))).toEqual(['09:00', '10:15', '11:30']);
    expect(new Set(kuschel.map(e => e.source_id)).size).toBe(3);
  });

  it('gilt nur für Einträge mit unstableTimes', () => {
    const flagged = loadRegistryEntries().filter(e => (e as { unstableTimes?: boolean }).unstableTimes);
    expect(flagged.map(e => e.eventUrl)).toEqual(['https://www.innsbrucktermine.at']);
  });
});

describe('gemeinde-registry: innsbrucktermine.at, Übernahme der Prod-Zeilen', () => {
  const row = (id: string, source_id: string, start_date: string, url: string, title: string): LegacyRow => ({
    id, source_name: 'gemeinde-registry', source_id, start_date, source_url: url, title,
  });
  const jazzRows = [
    row('a0f1', JAZZ_NOW, '2026-11-18T16:30:00+00:00', 'https://www.innsbrucktermine.at/veranstaltungen/jazz-apero?date=1795019400', 'Jazz & Apéro'),
    row('b7c2', JAZZ_LATER, '2026-11-18T17:30:00+00:00', 'https://www.innsbrucktermine.at/veranstaltungen/jazz-apero?date=1795023000', 'Jazz & Apéro'),
  ];
  const synced = (html: string) =>
    normalizeEventTimestamps(parse(html).map(e => ({ ...e, source_name: 'gemeinde-registry' })));

  it('behält die Zeile der aktuellen Lesart und löst die andere ab', () => {
    const events = synced(fixture('p3'));
    const [jazz] = find(events, 'Jazz & Apéro', '2026-11-18');
    const moves = planSourceIdMigrations(events, jazzRows, new Set());
    expect(moves).toEqual([{ id: 'a0f1', source_name: 'gemeinde-registry', from: JAZZ_NOW, to: jazz.source_id }]);
    expect(planSupersededRows(events, jazzRows, moves).map(r => r.id)).toEqual(['b7c2']);
  });

  it('nimmt bei der anderen Lesart die andere Zeile', () => {
    const events = synced(laterReading(fixture('p3'), 'jazz-apero', 1795019400));
    const moves = planSourceIdMigrations(events, jazzRows, new Set());
    expect(moves.map(m => m.id)).toEqual(['b7c2']);
    expect(planSupersededRows(events, jazzRows, moves).map(r => r.id)).toEqual(['a0f1']);
  });

  it('löst ab dem zweiten Lauf nur noch ab, schlüsselt nichts mehr um', () => {
    const events = synced(fixture('p3'));
    const [jazz] = find(events, 'Jazz & Apéro', '2026-11-18');
    const existing = new Set([`gemeinde-registry::${jazz.source_id}`]);
    const legacy = [jazzRows[1]];
    const moves = planSourceIdMigrations(events, legacy, existing);
    expect(moves).toEqual([]);
    expect(planSupersededRows(events, legacy, moves).map(r => r.id)).toEqual(['b7c2']);
  });

  it('ordnet die vier Lottchen-Zeilen vom 19.11. zwei Vorstellungen zu', () => {
    // Prod: 07:00Z und 09:00Z (Lesart eine Stunde früher, zuletzt 01.11.),
    // 08:00Z und 10:00Z (wie die Seite am 03.11., Landestheater 9:00 / 11:00).
    const url = (epoch: number) => `https://www.innsbrucktermine.at/veranstaltungen/das-doppelte-lottchen?date=${epoch}`;
    const t = 'Das doppelte Lottchen';
    const legacy = [
      row('l07', 'registry-gen-f38bb176512ac748-2026-11-19', '2026-11-19T07:00:00+00:00', url(1795071600), t),
      row('l08', 'registry-gen-968989bf5bd8dbff-2026-11-19', '2026-11-19T08:00:00+00:00', url(1795075200), t),
      row('l09', 'registry-gen-ffb4a5dfbf91a6ea-2026-11-19', '2026-11-19T09:00:00+00:00', url(1795078800), t),
      row('l10', 'registry-gen-ca161cd3bbf266e2-2026-11-19', '2026-11-19T10:00:00+00:00', url(1795082400), t),
    ];
    const events = synced(fixture('p4'));
    const lottchen = find(events, t, '2026-11-19');
    // In DB-Reihenfolge kommt die abgelöste 09:00Z vor der 10:00Z: genaue Treffer gehen vor.
    const moves = planSourceIdMigrations(events, [legacy[0], legacy[2], legacy[1], legacy[3]], new Set());
    expect(moves.map(m => [m.id, m.to])).toEqual([
      ['l08', lottchen[0].source_id],
      ['l10', lottchen[1].source_id],
    ]);
    expect(planSupersededRows(events, legacy, moves).map(r => r.id).sort()).toEqual(['l07', 'l09']);
  });
});
