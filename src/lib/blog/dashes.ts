/**
 * Striche in sichtbaren Blogtexten (User-Regel 2026-09-06, bekräftigt
 * 2026-10-26): kein Gedankenstrich als Einschub, keine Strich-Spannen in
 * Datums- und Preisangaben. Gedankenstriche klingen nach generiertem Text.
 *
 * `stripDashes` repariert, was sich mechanisch sicher umformulieren lässt;
 * `findDashes` meldet den Rest, damit ein Mensch oder das Modell nachbessert.
 * Bindestriche in Zusammensetzungen fasst `stripDashes` nicht an: ob
 * "Kammermusik-Festival" zu "Kammermusikfestival" werden darf, entscheidet
 * der Kontext (Eigennamen), nicht eine Regex.
 */

const RANGE_DASH = /(\d)\s*[–—]\s*(\d)/g;
const DATE_RANGE_DASH = /(\d\.)\s*[–—]\s*(\d)/g;
const SPACED_DASH = /\s+[–—]\s+/g;
const LEFTOVER_DASH = /[–—]/g;

/** Gedankenstriche durch Wörter/Satzzeichen ersetzen. */
export function stripDashes(text: string): string {
  return text
    .replace(DATE_RANGE_DASH, '$1 bis $2')
    .replace(RANGE_DASH, '$1 bis $2')
    .replace(SPACED_DASH, ', ')
    // Restliche Striche ohne Leerzeichen ("A–Z") werden zu Bindestrichen,
    // die findDashes dann als Kopplung meldet.
    .replace(LEFTOVER_DASH, '-')
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',');
}

/** Rekursiv alle Strings eines Entwurfs bereinigen (URLs bleiben unberührt). */
export function stripDashesDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return (/^https?:\/\//.test(value) ? value : stripDashes(value)) as T;
  }
  if (Array.isArray(value)) return value.map(v => stripDashesDeep(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripDashesDeep(v);
    return out as T;
  }
  return value;
}

export interface DashFinding {
  kind: 'dash' | 'hyphen';
  match: string;
}

/**
 * Gedankenstriche und Wort-Bindestrich-Kopplungen finden. URLs und
 * Slugs werden vorher entfernt; `allow` nimmt Eigennamen aus
 * (z. B. "Saint-Saëns").
 */
export function findDashes(text: string, allow: string[] = []): DashFinding[] {
  let t = text.replace(/https?:\/\/\S+/g, ' ');
  for (const a of allow) t = t.split(a).join(' ');
  const out: DashFinding[] = [];
  for (const m of t.matchAll(/[–—]/g)) out.push({ kind: 'dash', match: t.slice(Math.max(0, m.index! - 12), m.index! + 13) });
  for (const m of t.matchAll(/[\p{L}\p{N}]+-[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu)) out.push({ kind: 'hyphen', match: m[0] });
  return out;
}
