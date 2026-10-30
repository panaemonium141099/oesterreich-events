import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Steuerbarer Supabase-Mock: jede Abfrage auf `events` mit `overlaps` (die
// Saison-Abfrage) scheitert `seasonFailures`-mal, danach liefert sie Daten.
let seasonFailures = 0;
let seasonCalls = 0;
// Optionale Quellen (Buchung, Künstler) dürfen die Seite nicht blockieren.
let optionalFailures = false;
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
          if (optionalFailures && (table === 'landing_features' || table === 'event_artists')) {
            result = { data: null, error: { message: `column ${table}.kind does not exist` } };
          } else if (table === 'events' && isSeason) {
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
  // event_counts_for_stats() liefert die Event-Zahl; ohne Stub fiele die Abfrage als Fehler aus.
  const rpc = () => Promise.resolve({ data: { country_total: 88123 }, error: null });
  return { createClient: () => ({ from: (t: string) => chain(t), rpc }) };
});

import { getLandingData } from '@/lib/v4/get-landing-data';

describe('Landing: gescheiterte Abfragen werden nicht als leere Sektion gecacht', () => {
  const phase = process.env.NEXT_PHASE;
  beforeEach(() => { seasonCalls = 0; optionalFailures = false; vi.spyOn(console, 'error').mockImplementation(() => {}); });
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
    expect(d.countryTotal).toBe(88123);
  });

  it('zur Laufzeit rendert die Seite ohne Buchung und Künstler weiter (Migrationen fehlen)', async () => {
    delete process.env.NEXT_PHASE;
    seasonFailures = 0;
    optionalFailures = true;
    const d = await getLandingData();
    expect(d.season.picks.map((p) => p.id)).toEqual(['s1']);
    expect(d.artistsLive).toEqual([]);
    expect(d.tip?.kind ?? 'auto').not.toBe('sponsored');
  });
});
