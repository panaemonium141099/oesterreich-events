import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEST_NOW } from '@/test/clock';

// Steuerbarer Supabase-Mock: jede Abfrage auf `events` mit `overlaps` ohne
// `or` (die Saison-Abfrage; Dorffeste filtern zusätzlich per `or` auf den
// Titel) scheitert `seasonFailures`-mal, danach liefert sie Daten.
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
    let hasOr = false;
    const proxy: unknown = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === 'then') {
          let result: { data: unknown[] | null; error: { message: string } | null } = { data: [], error: null };
          if (optionalFailures && (table === 'landing_features' || table === 'event_artists')) {
            result = { data: null, error: { message: `column ${table}.kind does not exist` } };
          } else if (table === 'events' && isSeason && !hasOr) {
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
          if (prop === 'or') hasOr = true;
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

import { getLandingData, LANDING_RETRY_DELAYS_MS, LANDING_TIMEOUT_MS } from '@/lib/v4/get-landing-data';

// Die Build-Wiederholungen warten Sekunden bis Minuten: Timer stellen, Uhr
// vorspulen. `vi.useRealTimers()` fällt über die Testuhr auf den Testtag zurück.
const withFakeTimers = async <T,>(run: () => Promise<T>, ms: number): Promise<T> => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], now: TEST_NOW });
  try {
    const p = run();
    await vi.advanceTimersByTimeAsync(ms);
    return await p;
  } finally {
    vi.useRealTimers();
  }
};

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

  it('im Build wird geduldig wiederholt: nach fünf Timeouts ist die Saison-Karte gefüllt', async () => {
    // Build 2026-11-06 21:06: drei Versuche binnen 1,2 s, alle im statement
    // timeout, die Karte leer ins Image gebacken. Der Build hat Zeit.
    process.env.NEXT_PHASE = 'phase-production-build';
    seasonFailures = 5;
    const d = await withFakeTimers(() => getLandingData(), LANDING_TIMEOUT_MS.build);
    expect(seasonCalls).toBe(6);
    expect(d.season.picks.map((p) => p.id)).toEqual(['s1']);
  });

  it('next build gibt der Seite mehr Zeit als der Build-Fahrplan braucht (staticPageGenerationTimeout)', () => {
    // Standard 60 s: Next bricht den Render ab und der Build scheitert nach drei Anläufen.
    const config = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf-8');
    const match = config.match(/staticPageGenerationTimeout:\s*(\d+)/);
    expect(match, 'staticPageGenerationTimeout fehlt in next.config.ts').not.toBeNull();
    expect(Number(match![1]) * 1000).toBeGreaterThan(LANDING_TIMEOUT_MS.build);
  });

  it('der Build-Fahrplan passt in sein Zeitfenster und ist länger als der der Laufzeit', () => {
    const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(LANDING_RETRY_DELAYS_MS.build)).toBeLessThan(LANDING_TIMEOUT_MS.build);
    expect(sum(LANDING_RETRY_DELAYS_MS.runtime)).toBeLessThan(LANDING_TIMEOUT_MS.runtime);
    expect(LANDING_RETRY_DELAYS_MS.build.length).toBeGreaterThan(LANDING_RETRY_DELAYS_MS.runtime.length);
    expect(sum(LANDING_RETRY_DELAYS_MS.build)).toBeGreaterThanOrEqual(60_000);
  });

  it('im Build bleibt nur die dauerhaft gescheiterte Sektion leer, der Rest wird gebaut', async () => {
    process.env.NEXT_PHASE = 'phase-production-build';
    seasonFailures = 99;
    const d = await withFakeTimers(() => getLandingData(), LANDING_TIMEOUT_MS.build);
    expect(seasonCalls).toBe(LANDING_RETRY_DELAYS_MS.build.length + 1);
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
