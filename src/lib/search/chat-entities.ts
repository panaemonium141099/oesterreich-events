/**
 * chat-entities — pures Parsing der Entity-Marker im Concierge-Chat
 * (fn-19 Phase B).
 *
 * Das Modell referenziert konkrete DB-Treffer inline als
 * `[event:<uuid>]` bzw. `[activity:<slug>]`. Der Server löst die Marker
 * gegen die Tool-Ergebnisse des Requests auf (nie gegen freie
 * LLM-Erfindungen), streamt die Karten als eigene SSE-Events und
 * entfernt die Marker aus dem sichtbaren Text.
 */

export interface EntityRef {
  kind: 'event' | 'activity';
  ref: string;
}

const MARKER_RE = /\[(event|activity):([a-zA-Z0-9-]{1,80})\]/g;

/** Alle Marker in Text-Reihenfolge, dedupliziert. */
export function extractEntityRefs(text: string): EntityRef[] {
  const seen = new Set<string>();
  const out: EntityRef[] = [];
  for (const m of text.matchAll(MARKER_RE)) {
    const kind = m[1] as EntityRef['kind'];
    const ref = m[2];
    const key = `${kind}:${ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind, ref });
  }
  return out;
}

/** Marker aus dem sichtbaren Text entfernen (inkl. entstehender
 *  Doppel-Leerzeichen und verwaister Leerzeichen vor Satzzeichen). */
export function stripEntityMarkers(text: string): string {
  return text
    .replace(MARKER_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ ([.,!?;:])/g, '$1')
    .replace(/\(\)/g, '')
    .trim();
}
