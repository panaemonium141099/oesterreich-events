import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Steuerbarer Supabase-Mock: jede Abfrage auf `events` mit `overlaps` (die
// Saison-Abfrage) scheitert `seasonFailures`-mal, danach liefert sie Daten.
let seasonFailures = 0;
let seasonCalls = 0;
const seasonRow = {
  id: 's1', slug: 'sturmfest', title: 'Sturmfest', start_date: new Date(Date.now() + 86_400_000).toISOString(),
  publish_status: 'published', tags: ['weinfest'], category: 'Märkte & Feste',
};

vi.mock('@supabase/supabase-js', () => {
  const chain = (table: string): unknown => {
    let isSeason = false;
    const proxy: unknown = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === 'then') {
          let result: { data: unknown[] | null; error: { message: string } | null } = { data: [], error: null };
          if (table === 'events' && isSeason) {
            seasonCalls++;
            result = seasonFailures > 0
              ? (seasonFailures--, { data: null, error: { message: 'canceling statement due to statement timeout' } })
              : { data: [seasonRow], error: null };
          }
          const p = Promise.resolve(result);
          return p.then.bind(p);
        }
        return () => {
          if (prop === 'overlaps') isSeason = true;
          return proxy;
        };
      },
    });
    return proxy;
  };
  return { createClient: () => ({ from: (t: string) => chain(t) }) };
});

import { getLandingData } from '@/lib/v4/get-landing-data';

describe('Landing: gescheiterte Abfragen werden nicht als leere Sektion gecacht', () => {
  const phase = process.env.NEXT_PHASE;
  beforeEach(() => { seasonCalls = 0; vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { process.env.NEXT_PHASE = phase; vi.restoreAllMocks(); });

  it('ein Timeout wird wiederholt und die Saison-Karte ist gefüllt', async () => {
    seasonFailures = 1;
    const d = await getLandingData();
    expect(seasonCalls).toBe(2);
    expect(d.season.picks.map((p) => p.id)).toEqual(['s1']);
  });

  it('zur Laufzeit wirft ein dauerhafter Fehler (ISR behält die letzte gute Seite)', async () => {
    delete process.env.NEXT_PHASE;
    seasonFailures = 3;
    await expect(getLandingData()).rejects.toThrow(/season/);
  });

  it('im Build bleibt nur die gescheiterte Sektion leer, der Rest wird gebaut', async () => {
    process.env.NEXT_PHASE = 'phase-production-build';
    seasonFailures = 3;
    const d = await getLandingData();
    expect(d.season.picks).toEqual([]);
    expect(d.popularArtists.length).toBeGreaterThan(0);
  });
});
