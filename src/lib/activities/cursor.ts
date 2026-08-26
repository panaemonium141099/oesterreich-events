/**
 * Cursor-Wire-Format fuer /api/activities.
 *
 * Seit dem Ranking-Umbau (2026-08-26): base64url-kodiertes JSON
 * `{"q":<int>,"id":"<uuid>"}` — Fortsetzung der Sortierung
 * `quality_score DESC, id ASC` (vorberechnete Spalte, taeglicher
 * Recompute via pg_cron inkl. Saison-Signal + Rotations-Jitter; siehe
 * Migration 20260826180000_activities_quality_score.sql).
 *
 * Lookup-Regel: `quality_score < $q OR (quality_score = $q AND id > $i)`.
 *
 * Alt-Cursor des frueheren `{name,id}`-Formats (name ASC) dekodieren
 * bewusst zu null -> Route antwortet 400, der Client startet die Liste
 * neu. Betrifft nur ISR-Seiten aus dem 1h-Fenster um den Deploy.
 *
 * Pur (Node-Buffer, kein Supabase) — Round-Trip ist getestet.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export interface ActivityCursor {
  /** quality_score der letzten Row der Vorseite. */
  q: number;
  /** UUID der letzten Row der Vorseite (Tie-Breaker). */
  id: string;
}

export function encodeActivityCursor(cursor: ActivityCursor): string {
  return Buffer.from(JSON.stringify({ q: cursor.q, id: cursor.id }), 'utf8').toString(
    'base64url',
  );
}

/**
 * Strikte Dekodierung: nur base64url-Alphabet, valides JSON-Objekt,
 * `q` ganzzahlig (Score ist integer; NaN/float/injection -> null),
 * `id` UUID. Alles andere -> null (Route antwortet 400).
 */
export function decodeActivityCursor(raw: string | null | undefined): ActivityCursor | null {
  if (!raw || !BASE64URL_RE.test(raw)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const { q, id } = parsed as { q?: unknown; id?: unknown };
  if (typeof q !== 'number' || !Number.isSafeInteger(q)) return null;
  if (typeof id !== 'string' || !UUID_RE.test(id)) return null;
  return { q, id: id.toLowerCase() };
}

/**
 * Lookup-Regel als PostgREST-or-Ausdruck:
 * `quality_score < $q OR (quality_score = $q AND id > $i)` —
 * Fortsetzung der (quality_score DESC, id ASC)-Sortierung
 * ueberlappungs- und lueckenfrei. `q` ist validiert ganzzahlig,
 * `id` eine validierte UUID — kein Quoting-Bedarf.
 */
export function buildActivityCursorFilter(cursor: ActivityCursor): string {
  return `quality_score.lt.${cursor.q},and(quality_score.eq.${cursor.q},id.gt."${cursor.id}")`;
}
