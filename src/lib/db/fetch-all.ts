// Seitenweises Lesen über PostgREST.
//
// Der self-hostete Supabase-Stack (Hetzner) deckelt jede REST-Antwort bei
// PGRST_DB_MAX_ROWS = 1000 Zeilen, ohne Fehler: `.limit(5000)` oder
// `.range(0, 4999)` liefert still 1000 Zeilen. Code, der daraus „weniger als
// angefragt = fertig“ schloss, las seit dem Umzug nur noch einen Bruchteil:
// Der nächtliche Dedup prüfte 81 von 898 Tagen (alle vor Mai 2026), die
// Events-API meldete nach 1000 Events hasMore=false (Befund 2026-09-24).
//
// Deshalb gilt überall: nie mehr als POSTGREST_MAX_ROWS in einer Anfrage
// erwarten. Wer mehr braucht, liest über fetchAllRows/forEachPage.
// Wächter: src/__tests__/lib/db/postgrest-row-cap.test.ts.

/** Obergrenze einer einzelnen PostgREST-Antwort (PGRST_DB_MAX_ROWS). */
export const POSTGREST_MAX_ROWS = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Baut die Abfrage für die Zeilen `from`..`to` (inklusive), also mit
 * `.range(from, to)` am Ende. Die Abfrage braucht eine eindeutige, stabile
 * Sortierung (z. B. `.order('id')`), sonst verschiebt Offset-Paging Zeilen
 * zwischen den Seiten.
 */
export type PageQuery<T> = (from: number, to: number) => PromiseLike<PageResult<T>>;

interface PageOptions {
  /** Höchstens so viele Zeilen lesen (Standard: alle). */
  maxRows?: number;
  /** Präfix für Fehlermeldungen. */
  label?: string;
}

/**
 * Ruft `onPage` für jede Seite auf, bis die Abfrage erschöpft ist. Ende ist
 * erst eine LEERE Seite: eine kurze Seite kann auch eine vom Server gekürzte
 * sein. Fehler werfen, statt still ein Teilergebnis zu liefern.
 */
export async function forEachPage<T>(
  query: PageQuery<T>,
  onPage: (rows: T[]) => void | Promise<void>,
  opts: PageOptions = {},
): Promise<number> {
  const maxRows = opts.maxRows ?? Number.POSITIVE_INFINITY;
  let offset = 0;
  while (offset < maxRows) {
    const size = Math.min(POSTGREST_MAX_ROWS, maxRows - offset);
    const { data, error } = await query(offset, offset + size - 1);
    if (error) throw new Error(`${opts.label ?? 'forEachPage'}: ${error.message}`);
    if (!data || data.length === 0) break;
    await onPage(data);
    offset += data.length;
  }
  return offset;
}

// ─── Ganze Tabellen: Seiten nach id, mit Wiederholung ───────────────────────
//
// Offset-Seiten kosten in der Tiefe immer mehr: für `.range(186000, 186999)`
// liest Postgres 187.000 Zeilen und wirft 186.000 weg. Gemessen gegen Prod
// (2026-11-05, Bericht über 430.811 Events): mit Offset 3 min 46 s, die
// Seite 0,38 s am Anfang und 1,07 s bei Zeile 420.000; nach id 32 s bei
// gleichem Ergebnis. Unter Last (ein Deploy baut das
// App-Image auf demselben Server wie die Datenbank) lief so der Bericht des
// Nachtlaufs am 05.11. bei Offset 186.000 in den Statement-Timeout, zwei
// Tage davor die Abdeckung. Wer eine ganze Tabelle liest, blättert deshalb
// nach id (`forEachPageById`); Offset bleibt für kurze, gefilterte Listen.
//
// Während eines Deploys ist die API außerdem zeitweise gar nicht erreichbar
// („fetch failed“: am 05.11. mindestens 20 s, am 03.11. sechs Minuten,
// MASTERPLAN §3.10). Lesen ist beliebig wiederholbar, also wartet
// `readWithRetry` und versucht es erneut, statt den Schritt rot zu machen
// oder ein Teilergebnis zu liefern.

/** Lesefehler, die ein späterer Versuch heilt: Datenbank überlastet, API kurz weg. */
export function isTransientReadError(message: string): boolean {
  return /statement timeout|fetch failed/i.test(message);
}

/**
 * Wartezeiten vor den Wiederholungen, zusammen knapp fünf Minuten. Mit den
 * Versuchen selbst (ein Verbindungsversuch läuft 10 s) reicht das über den
 * längsten belegten Ausfall (03.11.2026, sechs Minuten).
 */
export const READ_RETRY_DELAYS_MS: readonly number[] = [5_000, 15_000, 30_000, 60_000, 60_000, 120_000];

interface RetryOptions {
  /** Präfix für Fehlermeldungen und Wiederholungs-Hinweise. */
  label?: string;
  /** Wartezeiten vor den Wiederholungen (Standard: READ_RETRY_DELAYS_MS). */
  retryDelaysMs?: readonly number[];
  /** Nur für Tests: ersetzt das Warten. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Führt eine Leseabfrage aus und wiederholt sie bei vorübergehenden Fehlern.
 * `run` baut die Abfrage bei jedem Versuch neu. Andere Fehler und ein Fehler
 * nach der letzten Wiederholung werfen.
 */
export async function readWithRetry<T>(
  run: () => PromiseLike<PageResult<T>>,
  opts: RetryOptions = {},
): Promise<T[]> {
  const label = opts.label ?? 'readWithRetry';
  const delays = opts.retryDelaysMs ?? READ_RETRY_DELAYS_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await run();
    if (!error) return data ?? [];
    if (attempt >= delays.length || !isTransientReadError(error.message)) {
      throw new Error(`${label}: ${error.message}`);
    }
    console.warn(
      `[${label}] Lesefehler (${error.message}), Versuch ${attempt + 2} von ${delays.length + 1} in ${delays[attempt] / 1000} s`,
    );
    await sleep(delays[attempt]);
  }
}

/**
 * Baut die Abfrage für die Seite nach `afterId` (null = erste Seite): mit
 * `.order('id').limit(POSTGREST_MAX_ROWS)` und, wenn gesetzt,
 * `.gt('id', afterId)`. `id` muss in der Auswahl stehen.
 */
export type KeysetQuery<T> = (afterId: string | null) => PromiseLike<PageResult<T>>;

/**
 * Wie `forEachPage`, aber blättert nach id statt nach Offset: jede Seite
 * kostet gleich viel, egal wie tief sie liegt. Jede Seite läuft über
 * `readWithRetry`. Ende ist eine leere Seite.
 */
export async function forEachPageById<T extends { id: string }>(
  query: KeysetQuery<T>,
  onPage: (rows: T[]) => void | Promise<void>,
  opts: RetryOptions = {},
): Promise<number> {
  const label = opts.label ?? 'forEachPageById';
  let afterId: string | null = null;
  let total = 0;
  for (;;) {
    const cursor: string | null = afterId;
    const page: T[] = await readWithRetry<T>(() => query(cursor), { ...opts, label });
    if (page.length === 0) break;
    await onPage(page);
    total += page.length;
    afterId = page[page.length - 1].id;
  }
  return total;
}

/** Liest alle Zeilen einer Abfrage (oder höchstens `maxRows`). */
export async function fetchAllRows<T>(query: PageQuery<T>, opts: PageOptions = {}): Promise<T[]> {
  const rows: T[] = [];
  await forEachPage<T>(query, (page) => { rows.push(...page); }, opts);
  return rows;
}
