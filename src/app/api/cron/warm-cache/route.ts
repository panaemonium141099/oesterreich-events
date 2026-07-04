import { NextRequest, NextResponse } from 'next/server';

/**
 * Cache-Warming-Cron für ~183 Top-Filter-Kombis.
 *
 * Läuft stündlich (`0 * * * *` in vercel.json). Pingt parallel die URLs die
 * 95 % aller UI-Klick-Pfade abdecken, sodass User immer den Vercel Edge-Cache
 * treffen (`X-Vercel-Cache: HIT`, 100-500 ms) statt den Cold-Path (1-6 s).
 *
 * Welche URLs:
 *   1. Bundesland alleine (10 — `all` + 9 Bundesländer)
 *   2. Bundesland × 11 Hauptkategorien (110)
 *   3. Bundesland × 4 Date-Presets — heute/morgen/wochenende/woche (40)
 *   4. Bundesland × studentFriendly (10)
 *   5. Bundesland × priceTier=gratis (10)
 *   6. Featured + Stats (3)
 *
 * **Wichtig: Cache-Key muss EXAKT matchen mit dem was das UI fetcht.**
 * Bundesland-IDs sind aus src/lib/bundeslaender.ts; Kategorien sind aus
 * docs/TAXONOMY.md (die 11 Hauptkategorien — `Sonstiges` ist Fallback und
 * wird im UI nicht angeboten); Date-Math ist 1:1 die Logik aus
 * src/components/MapV3/datePresets.ts mit Europe/Vienna-Timezone (sonst
 * berechnet der Cron um 23:30 UTC ein anderes „Heute" als der Browser-User
 * in Wien um 1:30 lokal).
 *
 * Hit-Budget: ~183 × 24 × 30 = ~132 000 Invocations/Monat. Auf Vercel Pro
 * komfortabel im 1 Mio-Limit. Geschätzte Active-CPU-Kosten: ~1-2 €/Monat.
 *
 * Concurrency: 6 parallel — vorher 30, das produzierte einen Cron-internen
 * Storm der den Supabase PgBouncer-Pool exhaustierte und Postgres
 * statement_timeout (57014) auslöste für 60-80 % der URLs. Production-Logs
 * zeigten 60-126 s function-Duration weil Funktionen auf
 * Connection-Slots warteten. EXPLAIN ANALYZE der "langsamen" Query
 * (bundesland=salzburg + category=Märkte & Feste, 1082 rows) ist isoliert
 * 270 ms — die Slowness war reine Concurrency, nicht die Query selbst.
 * Mit 6 parallel bei ~600 ms pro URL endet der Cron in ~20 s.
 *
 * Per-URL limit=3000 (ehemals 10000): nirgendwo gibt es eine (bundesland,
 * category) Kombi mit > 2 600 published-future-events, also fetcht der
 * Cron jetzt sicher die KOMPLETTE Result-Set aller Listen statt unnötiger
 * Index-Walks. Das passende UI BATCH_SIZE wurde mitverändert, sonst
 * stimmen die Edge-Cache-Keys nicht überein.
 *
 * Auth: Vercel setzt automatisch `Authorization: Bearer ${CRON_SECRET}`
 * für eigene Cron-Aufrufe. Direkte Aufrufe ohne Bearer werden mit 401
 * abgewiesen wenn `CRON_SECRET` env gesetzt ist.
 */
export const dynamic = 'force-dynamic';

const BUNDESLAENDER = [
  'all',
  'wien',
  'niederoesterreich',
  'oberoesterreich',
  'steiermark',
  'tirol',
  'salzburg',
  'kaernten',
  'vorarlberg',
  'burgenland',
] as const;

// Hauptkategorien aus docs/TAXONOMY.md (11 + 1 Fallback `Sonstiges` der
// nicht im UI angezeigt wird, also auch nicht gewärmt werden muss).
// Strings müssen EXAKT der DB-Spalte `events.category` entsprechen — der
// Server filtert mit `query.eq('category', cat)`, kein Aliasing.
const KATEGORIEN = [
  'Musik',
  'Kultur & Bühne',
  'Nightlife & Party',
  'Essen & Trinken',
  'Märkte & Feste',
  'Sport & Bewegung',
  'Natur & Abenteuer',
  'Wissen & Karriere',
  'Familie & Kinder',
  'Community & Freizeit',
  'Wellness & Spiritualität',
] as const;

/** YYYY-MM-DD in Europe/Vienna timezone — matched mit toLocalIso aus
 *  datePresets.ts wenn der User in Österreich sitzt (was er meistens tut). */
function viennaIso(d: Date): string {
  // en-CA-Locale formatiert ISO-mässig als YYYY-MM-DD.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d);
}

/** Day of week in Vienna timezone (0 = Sonntag, 6 = Samstag), exakt wie
 *  `new Date().getDay()` im Browser-Client in Wien. */
function viennaDayOfWeek(d: Date): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Vienna',
    weekday: 'short',
  }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/** Replicates applyDatePreset() aus datePresets.ts für die 4 wichtigen
 *  Presets. Reihenfolge der Berechnung muss identisch zum UI-Code sein,
 *  sonst stimmen die Cache-Keys nicht überein. */
function getDatePresets(): Array<{ id: string; dateFrom: string; dateTo: string }> {
  const now = new Date();
  const today = viennaIso(now);

  // morgen
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // wochenende: kommendes Sat + Sun (oder das aktuelle wenn Sa/So heute)
  const day = viennaDayOfWeek(now);
  const sat = new Date(now);
  const daysToSat = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
  sat.setDate(sat.getDate() + daysToSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);

  // woche: Mo-So der ISO-Woche
  const mon = new Date(now);
  const daysToMon = day === 0 ? -6 : 1 - day;
  mon.setDate(mon.getDate() + daysToMon);
  const wkSun = new Date(mon);
  wkSun.setDate(mon.getDate() + 6);

  return [
    { id: 'heute', dateFrom: today, dateTo: today },
    { id: 'morgen', dateFrom: viennaIso(tomorrow), dateTo: viennaIso(tomorrow) },
    { id: 'wochenende', dateFrom: viennaIso(sat), dateTo: viennaIso(sun) },
    { id: 'woche', dateFrom: viennaIso(mon), dateTo: viennaIso(wkSun) },
  ];
}

function buildPaths(): string[] {
  const paths: string[] = [];

  // 1. Bundesland alleine (default Map-View pro Region)
  for (const bl of BUNDESLAENDER) {
    paths.push(`/api/events?bundesland=${bl}&limit=3000&slim=true`);
  }

  // 2. Featured (Landing-Page)
  paths.push('/api/events/featured?limit=10');
  paths.push('/api/events/featured?limit=8');

  // 3. Bundesland × Kategorie (110 Kombis)
  for (const bl of BUNDESLAENDER) {
    for (const cat of KATEGORIEN) {
      paths.push(
        `/api/events?bundesland=${bl}&category=${encodeURIComponent(cat)}&limit=3000&slim=true`,
      );
    }
  }

  // 4. Bundesland × Date-Preset (40 Kombis)
  const presets = getDatePresets();
  for (const bl of BUNDESLAENDER) {
    for (const p of presets) {
      paths.push(
        `/api/events?bundesland=${bl}&dateFrom=${p.dateFrom}&dateTo=${p.dateTo}&limit=3000&slim=true`,
      );
    }
  }

  // 5. Bundesland × studentFriendly (10 Kombis)
  for (const bl of BUNDESLAENDER) {
    paths.push(
      `/api/events?bundesland=${bl}&studentFriendly=true&limit=3000&slim=true`,
    );
  }

  // 6. Bundesland × priceTier=gratis (10 Kombis)
  for (const bl of BUNDESLAENDER) {
    paths.push(
      `/api/events?bundesland=${bl}&priceTier=gratis&limit=3000&slim=true`,
    );
  }

  return paths;
}

/** Promise-pool mit konstanter Concurrency. Verhindert dass Vercel uns mit
 *  „too many concurrent connections" abwürgt wenn wir 200 parallele fetches
 *  ohne Limit feuern. */
async function fetchInChunks<T>(
  items: string[],
  handler: (path: string) => Promise<T>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(handler));
    results.push(...chunkResults);
  }
  return results;
}

interface WarmResult {
  path: string;
  status: number | string;
  cache: string;
  ms: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const baseUrl = 'https://lasstreffen.at';
  const paths = buildPaths();
  const start = Date.now();

  const results = await fetchInChunks<WarmResult>(
    paths,
    async (path) => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${baseUrl}${path}`);
        return {
          path,
          status: res.status,
          cache: res.headers.get('x-vercel-cache') ?? 'unknown',
          ms: Date.now() - t0,
        };
      } catch (err) {
        return {
          path,
          status: 'ERROR',
          cache: 'n/a',
          ms: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    6,
  );

  // Aggregierte Statistik fürs Logging — auf einen Blick sehen ob die
  // meisten URLs HIT waren oder ob der Cron Cold-Paths erlebt hat.
  const stats = results.reduce(
    (acc, r) => {
      acc.total++;
      if (r.status === 200) acc.ok++;
      else acc.failed++;
      const cache = String(r.cache).toUpperCase();
      acc.byCache[cache] = (acc.byCache[cache] ?? 0) + 1;
      acc.totalMs += r.ms;
      if (r.ms > acc.maxMs) acc.maxMs = r.ms;
      return acc;
    },
    {
      total: 0,
      ok: 0,
      failed: 0,
      byCache: {} as Record<string, number>,
      totalMs: 0,
      maxMs: 0,
    },
  );

  return NextResponse.json({
    warmed: stats.total,
    ok: stats.ok,
    failed: stats.failed,
    durationMs: Date.now() - start,
    avgMs: Math.round(stats.totalMs / Math.max(1, stats.total)),
    maxMs: stats.maxMs,
    cacheBreakdown: stats.byCache,
    results,
  });
}
