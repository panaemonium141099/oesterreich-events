/**
 * Fortsetzung langer Quell-Listen (rotation-cursor.ts).
 *
 * Befund 2026-10-14: rotateDaily rückte den Startpunkt nur EINE Gemeinde
 * pro Tag weiter. gemeinde-registry schaffte je Nacht ~800 von 1.881
 * Gemeinden, fast immer dieselben; Salzburg und Steiermark waren seit Mai
 * nicht mehr dran. Eine um 16 Einträge kürzere Liste (Commit 477c399c)
 * setzte den Startpunkt zudem auf 29 zurück.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const insert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
let storedCursor: string | null = null;
const select = vi.fn();
vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient: vi.fn(() => ({
    from: () => ({
      insert,
      select: (...args: unknown[]) => {
        select(...args);
        const chain = {
          eq: () => chain,
          not: () => chain,
          order: () => chain,
          limit: async () => ({ data: storedCursor ? [{ rotation_cursor: storedCursor }] : [], error: null }),
        };
        return chain;
      },
    }),
  })),
}));

import { rotateAfterCursor } from '@/lib/scrapers/rotation-cursor';
import { runScraper } from '@/lib/scrapers';
import { BaseScraper } from '@/lib/scrapers/BaseScraper';
import {
  GemeindeRegistryScraper, isScrapeableEntry, loadRegistryEntries, registryCursorKey,
} from '@/lib/scrapers/GemeindeRegistryScraper';
import { Gem2GoScraper } from '@/lib/scrapers/Gem2GoScraper';
import { GemeindeListScraper } from '@/lib/scrapers/GemeindeListScraper';
import { GenericGemeindeScraper, genericPageCursorKey } from '@/lib/scrapers/GenericGemeindeScraper';
import { GEM2GO_GEMEINDEN_LISTE } from '@/lib/scrapers/gemeinden/gem2goGemeinden';
import { GEMEINDEN } from '@/lib/scrapers/gemeinden/gemeindeList';
import { withStammdaten } from '@/lib/scrapers/gemeinden/stammdaten';
import { gemeindeCursorKey } from '@/lib/scrapers/rotation-cursor';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScrapedEvent } from '@/types/events';

const keys = (n: number) => Array.from({ length: n }, (_, i) => `k${String(i).padStart(4, '0')}`);
const id = (s: string) => s;

/** Ein Lauf mit fester Reichweite, wie der Soft-Budget-Abbruch. */
function budgetRun(list: string[], cursor: string | null, reach: number) {
  const { items } = rotateAfterCursor(list, id, cursor);
  const done = items.slice(0, reach);
  return { done, cursor: done.length > 0 ? done[done.length - 1] : cursor };
}

describe('rotateAfterCursor', () => {
  it('ohne Cursor: Listenanfang, nach Schlüssel sortiert', () => {
    const { items, startIndex } = rotateAfterCursor(['c', 'a', 'b'], id, null);
    expect(items).toEqual(['a', 'b', 'c']);
    expect(startIndex).toBe(0);
  });

  it('setzt direkt nach dem Cursor fort und hängt den Anfang hinten an', () => {
    expect(rotateAfterCursor(['a', 'b', 'c', 'd'], id, 'b').items).toEqual(['c', 'd', 'a', 'b']);
  });

  it('Cursor auf dem letzten Eintrag: neue Runde von vorne', () => {
    expect(rotateAfterCursor(['a', 'b', 'c'], id, 'c').items).toEqual(['a', 'b', 'c']);
  });

  it('fehlt der Cursor-Eintrag, beginnt der Lauf beim Nachfolger', () => {
    expect(rotateAfterCursor(['a', 'c', 'd'], id, 'b').items).toEqual(['c', 'd', 'a']);
  });

  it('sortiert nach Code-Einheiten, nicht nach Locale', () => {
    expect(rotateAfterCursor(['60001 Ö', '60001 O', '50001 Z'], id, null).items).toEqual(['50001 Z', '60001 O', '60001 Ö']);
  });
});

describe('Abdeckung über Budget-Läufe', () => {
  it.each([
    [1881, 800], [1881, 771], [2043, 1218], [10, 3], [7, 7], [5, 9],
  ])('n=%i, Reichweite %i: jeder Eintrag in ceil(n/reach) Läufen', (n, reach) => {
    const list = keys(n);
    const seen = new Set<string>();
    let cursor: string | null = null;
    const runs = Math.ceil(n / reach);
    for (let r = 0; r < runs; r++) {
      const run = budgetRun(list, cursor, reach);
      run.done.forEach(k => seen.add(k));
      cursor = run.cursor;
    }
    expect(seen.size).toBe(n);
  });

  it('schwankende Reichweite (771 bis 829 je Nacht): alle in ceil(n/771) Läufen', () => {
    const list = keys(1881);
    const reaches = [829, 771, 800];
    const seen = new Set<string>();
    let cursor: string | null = null;
    for (let r = 0; r < Math.ceil(1881 / 771); r++) {
      const run = budgetRun(list, cursor, reaches[r % reaches.length]);
      run.done.forEach(k => seen.add(k));
      cursor = run.cursor;
    }
    expect(seen.size).toBe(1881);
  });

  it('kürzere Liste zwischen zwei Läufen: Fortsetzung am richtigen Eintrag', () => {
    // Lauf 1 auf 1.897 Einträgen, dann fallen 16 weg (8 davor, 8 danach),
    // dazu kommen 5 neue vor dem Cursor (wie Commit 477c399c, 2026-09-24).
    const before = keys(1897);
    const run1 = budgetRun(before, null, 800);
    expect(run1.cursor).toBe('k0799');
    const removed = new Set([...before.slice(100, 108), ...before.slice(1000, 1008)]);
    const after = [...before.filter(k => !removed.has(k)), 'k0050a', 'k0051a', 'k0052a', 'k0053a', 'k0054a'];
    const run2 = rotateAfterCursor(after, id, run1.cursor);
    expect(run2.items[0]).toBe('k0800');
    // Die Lücke ab Index 800 wird in den Folgeläufen vollständig erreicht.
    const seen = new Set(run1.done);
    let cursor = run1.cursor;
    for (let r = 0; r < 2; r++) {
      const run = budgetRun(after, cursor, 800);
      run.done.forEach(k => seen.add(k));
      cursor = run.cursor;
    }
    expect(after.filter(k => !seen.has(k))).toEqual([]);
  });

  it('fällt der Cursor-Eintrag selbst weg, geht es beim Nachfolger weiter', () => {
    const before = keys(100);
    const run1 = budgetRun(before, null, 40);
    const after = before.filter(k => k !== run1.cursor);
    expect(rotateAfterCursor(after, id, run1.cursor).items[0]).toBe('k0040');
  });
});

describe('gemeinde-registry', () => {
  const scrapeable = loadRegistryEntries().filter(isScrapeableEntry);

  it('Fortsetzungsschlüssel sind eindeutig (Kennziffer allein ist es nicht)', () => {
    const keyList = scrapeable.map(registryCursorKey);
    const dupes = keyList.filter((k, i) => keyList.indexOf(k) !== i);
    expect(dupes).toEqual([]);
    expect(new Set(scrapeable.map(e => e.gkz)).size).toBeLessThan(scrapeable.length);
  });

  it('Nachtläufe mit 240 min Budget und ~18 s je Gemeinde erreichen jede Gemeinde in drei Nächten', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const scraper = new GemeindeRegistryScraper();
    const reached = new Set<string>();
    vi.spyOn(scraper as unknown as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue();
    vi.spyOn(scraper as unknown as { scrapeGemeinde: (e: never) => Promise<ScrapedEvent[]> }, 'scrapeGemeinde')
      .mockImplementation(async (entry: { gkz: string; listName: string }) => {
        reached.add(registryCursorKey(entry));
        vi.setSystemTime(Date.now() + 18_000);
        return [];
      });
    const perNight: number[] = [];
    try {
      for (let night = 0; night < 3; night++) {
        const before = reached.size;
        scraper.rotationCursor = scraper.reachedCursor;
        await scraper.scrape();
        perNight.push(reached.size - before);
      }
    } finally {
      vi.useRealTimers();
    }
    expect(perNight[0]).toBeGreaterThan(700);
    expect(reached.size).toBe(scrapeable.length);
  });

  it('ein auf ein Bundesland gefilterter Lauf schreibt keinen Cursor', async () => {
    vi.stubEnv('REGISTRY_BUNDESLAND', 'vorarlberg');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const scraper = new GemeindeRegistryScraper();
    scraper.rotationCursor = '40101 Linz';
    vi.spyOn(scraper as unknown as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue();
    const spy = vi.spyOn(scraper as unknown as { scrapeGemeinde: () => Promise<ScrapedEvent[]> }, 'scrapeGemeinde').mockResolvedValue([]);
    await scraper.scrape();
    expect(spy.mock.calls.length).toBeGreaterThan(0);
    expect(scraper.reachedCursor).toBeNull();
  });
});

/**
 * Nächte eines Aggregators mit gemessener Reichweite: `step` stubbt den
 * Abruf je Eintrag und rückt die Uhr um `secondsPerEntry` vor.
 */
async function nights(
  scraper: BaseScraper,
  count: number,
  secondsPerEntry: number,
  step: (scraper: BaseScraper, onEntry: (key: string) => void) => void,
): Promise<{ reached: Set<string>; perNight: number[] }> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(scraper as unknown as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue();
  const reached = new Set<string>();
  step(scraper, (key) => {
    reached.add(key);
    vi.setSystemTime(Date.now() + secondsPerEntry * 1000);
  });
  const perNight: number[] = [];
  try {
    for (let n = 0; n < count; n++) {
      const before = reached.size;
      scraper.rotationCursor = scraper.reachedCursor;
      await scraper.scrape();
      perNight.push(reached.size - before);
    }
  } finally {
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
  return { reached, perNight };
}

describe('gem2go, gemeinden, gemeinden-generic', () => {
  const gem2go = withStammdaten(GEM2GO_GEMEINDEN_LISTE).filter(g => g.website !== 'https://none');
  const liste = withStammdaten(GEMEINDEN).filter(g => g.website !== 'https://none');
  const pages = (JSON.parse(readFileSync(join(process.cwd(), 'data', 'gemeinden-event-pages.json'), 'utf8')) as Array<{ gemeinde: { name: string; bundesland: string; idKey: string }; eventPageUrl: string }>)
    .flatMap(p => { const [g] = withStammdaten([p.gemeinde]); return g ? [{ ...p, gemeinde: g }] : []; });

  it('Schlüssel von gem2go und gemeinden sind eindeutig', () => {
    for (const list of [gem2go, liste]) {
      const k = list.map(gemeindeCursorKey);
      expect(k.filter((x, i) => k.indexOf(x) !== i)).toEqual([]);
    }
  });

  it('gem2go (1.218 je Nacht laut Prod) erreicht jede Gemeinde in zwei Nächten', async () => {
    const scraper = new Gem2GoScraper();
    const { reached, perNight } = await nights(scraper, 2, (240 * 60) / 1218, (s, onEntry) => {
      vi.spyOn(s as unknown as { fetchWithTimeout: () => Promise<string | null> }, 'fetchWithTimeout').mockResolvedValue(null);
      vi.spyOn(s as unknown as { tryFallbackDiscovery: (g: { gkz: string; listName: string }) => Promise<ScrapedEvent[]> }, 'tryFallbackDiscovery')
        .mockImplementation(async (g) => { onEntry(gemeindeCursorKey(g)); return []; });
    });
    expect(perNight[0]).toBeGreaterThan(1100);
    expect(reached.size).toBe(gem2go.length);
  });

  it('gemeinden setzt über den Zweig ohne Kalender (continue) hinweg fort', async () => {
    const scraper = new GemeindeListScraper();
    const { reached } = await nights(scraper, 2, 60, (s, onEntry) => {
      vi.spyOn(s as unknown as { findCalendarUrl: (g: { gkz: string; listName: string }) => Promise<string | null> }, 'findCalendarUrl')
        .mockImplementation(async (g) => { onEntry(gemeindeCursorKey(g)); return null; });
    });
    expect(reached.size).toBe(liste.length);
  });

  it('gemeinden-generic erreicht jede Seite in zwei Nächten', async () => {
    const scraper = new GenericGemeindeScraper();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { reached } = await nights(scraper, 2, (240 * 60) / 600, (s, onEntry) => {
      vi.spyOn(s as unknown as { scrapeGemeinde: (p: (typeof pages)[number]) => Promise<ScrapedEvent[]> }, 'scrapeGemeinde')
        .mockImplementation(async (p) => { onEntry(genericPageCursorKey(p)); return []; });
    });
    expect(reached.size).toBe(new Set(pages.map(genericPageCursorKey)).size);
  });
});

class ListScraper extends BaseScraper {
  readonly name = 'fake-list';
  override readonly resumesSourceList = true;
  constructor(private readonly list: string[], private readonly reach: number, private readonly fail = false) { super(); }
  readonly processed: string[] = [];
  async scrape(): Promise<ScrapedEvent[]> {
    const items = this.resumeAfterCursor(this.list, id);
    for (const k of items.slice(0, this.reach)) {
      this.processed.push(k);
      this.markReached(k);
    }
    if (this.fail) throw new Error('Absturz');
    return [];
  }
}

class PlainScraper extends BaseScraper {
  readonly name = 'fake-plain';
  async scrape(): Promise<ScrapedEvent[]> { return []; }
}

describe('runScraper: Cursor über source_runs', () => {
  beforeEach(() => {
    insert.mockClear();
    select.mockClear();
    storedCursor = null;
    vi.stubEnv('SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('liest den Cursor des letzten Laufs und schreibt den erreichten zurück', async () => {
    const scraper = new ListScraper(keys(10), 4);
    for (let run = 0; run < 3; run++) {
      await runScraper(scraper);
      const row = insert.mock.calls[insert.mock.calls.length - 1][0];
      storedCursor = row.rotation_cursor as string;
    }
    expect(scraper.processed).toEqual([...keys(10), 'k0000', 'k0001']);
    expect(insert.mock.calls.map(c => c[0].rotation_cursor)).toEqual(['k0003', 'k0007', 'k0001']);
  });

  it('nach einem Absturz kein Cursor: der nächste Lauf wiederholt den Abschnitt', async () => {
    storedCursor = 'k0003';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const scraper = new ListScraper(keys(10), 4, true);
    await runScraper(scraper);
    expect(insert.mock.calls[0][0]).not.toHaveProperty('rotation_cursor');
    expect(insert.mock.calls[0][0]).toMatchObject({ status: 'error' });
    expect(scraper.processed[0]).toBe('k0004');
  });

  it('Scraper ohne Fortsetzung lesen und schreiben keinen Cursor', async () => {
    await runScraper(new PlainScraper());
    expect(select).not.toHaveBeenCalled();
    expect(insert.mock.calls[0][0]).not.toHaveProperty('rotation_cursor');
  });

  it('ohne Datenbank: Start am Listenanfang', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const scraper = new ListScraper(keys(5), 2);
    await runScraper(scraper);
    expect(scraper.processed).toEqual(['k0000', 'k0001']);
  });
});
