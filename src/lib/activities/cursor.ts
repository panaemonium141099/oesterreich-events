/**
 * Cursor-Wire-Format fuer /api/activities (fn-18 Task 3, verbindlich):
 * base64url-kodiertes JSON `{"name":"<raw-DB-Wert>","id":"<uuid>"}`.
 *
 * - `name` ist der UNVERAENDERTE DB-Wert der letzten Row (keine
 *   Re-Normalisierung client-seitig) — nur so ist die Lookup-Regel
 *   `name > $n OR (name = $n AND id > $i)` gegen die DB-Kollation stabil.
 * - Deterministische Default-Sortierung der API: `name ASC, id ASC`.
 * - Pur (Node-Buffer, kein Supabase) — Round-Trip ist getestet, inkl.
 *   Umlaut-/Sonderzeichen-Namen.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export interface ActivityCursor {
  /** Raw-DB-Wert von `name` der letzten Row der Vorseite. */
  name: string;
  /** UUID der letzten Row der Vorseite (Tie-Breaker). */
  id: string;
}

export function encodeActivityCursor(cursor: ActivityCursor): string {
  return Buffer.from(JSON.stringify({ name: cursor.name, id: cursor.id }), 'utf8').toString(
    'base64url',
  );
}

/**
 * Strikte Dekodierung: nur base64url-Alphabet, valides JSON-Objekt,
 * `name` string (auch leer erlaubt — DB-not-null, aber wir verlassen uns
 * nicht darauf), `id` UUID. Alles andere -> null (Route antwortet 400).
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
  const { name, id } = parsed as { name?: unknown; id?: unknown };
  if (typeof name !== 'string') return null;
  if (typeof id !== 'string' || !UUID_RE.test(id)) return null;
  return { name, id: id.toLowerCase() };
}

/**
 * PostgREST-Wert-Quoting fuer .or()-Filter: doppelte Anfuehrungszeichen
 * um den Wert, `\` und `"` backslash-escaped. Ohne Quoting wuerden
 * Namen mit Komma/Klammern (`Cafe, Bar (Terrasse)`) den or-Ausdruck
 * syntaktisch zerlegen.
 */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Lookup-Regel als PostgREST-or-Ausdruck:
 * `name > $n OR (name = $n AND id > $i)` — Fortsetzung der
 * (name ASC, id ASC)-Sortierung ueberlappungs- und lueckenfrei.
 */
export function buildActivityCursorFilter(cursor: ActivityCursor): string {
  const name = quotePostgrestValue(cursor.name);
  return `name.gt.${name},and(name.eq.${name},id.gt."${cursor.id}")`;
}
