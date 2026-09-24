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

/** Liest alle Zeilen einer Abfrage (oder höchstens `maxRows`). */
export async function fetchAllRows<T>(query: PageQuery<T>, opts: PageOptions = {}): Promise<T[]> {
  const rows: T[] = [];
  await forEachPage<T>(query, (page) => { rows.push(...page); }, opts);
  return rows;
}
