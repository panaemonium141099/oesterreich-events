// src/lib/pipeline/dedup-audit.ts

/**
 * Nachkontrolle nach dem Dedup: sichtbare Paare, die offensichtlich
 * dasselbe Event sind — gleicher Titel, gleicher Wiener Tag, gleiche oder
 * unbekannte Uhrzeit, derselbe Ort, verschiedene Quellen (oder dieselbe
 * Quelle unter zwei Kennungen zur selben Minute).
 *
 * Der Dedup führt genau solche Paare zusammen. Bleiben welche sichtbar,
 * lief der Dedup nicht, brach ab oder eine neue Quelle/Statusvariante läuft
 * an ihm vorbei. Das Skript dedup-audit.ts schlägt dann Alarm, statt dass
 * Nutzer es auf der Seite finden (wie am 2026-10-07 die Sargfabrik).
 *
 * Rein und ohne I/O.
 */

import { pairKey } from './dedup-engine';
import { knownStartMs, placeEvidence, timeRelation, titleKey, viennaDayOf } from './dedup-evidence';
import type { EventRow } from './types';

const VISIBLE = new Set(['published', 'published_low_confidence']);

export interface ResidualPair {
  a: EventRow;
  b: EventRow;
}

export function findResidualDuplicates(
  events: EventRow[],
  opts: { manualSplits?: Set<string> } = {},
): ResidualPair[] {
  const groups = new Map<string, EventRow[]>();
  for (const e of events) {
    if (!VISIBLE.has(e.publish_status ?? '')) continue;
    const day = viennaDayOf(e);
    const title = titleKey(e);
    if (!day || !title) continue;
    const key = `${day}|${title}`;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  const out: ResidualPair[] = [];
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a.source_name) continue;
        if (opts.manualSplits?.has(pairKey(a.id, b.id))) continue;
        // Dieselbe Quelle zählt nur unter zwei Kennungen zur selben Minute
        // (Feratel-Basiszeile neben der Terminzeile); verschiedene Minuten
        // sind verschiedene Programmpunkte (Eventim-Zeitfenster).
        if (a.source_name === b.source_name) {
          const ta = knownStartMs(a);
          if (a.source_id === b.source_id || ta === null || ta !== knownStartMs(b)) continue;
        }
        const time = timeRelation(a, b);
        if (time !== 'exact' && time !== 'unknown') continue;
        if (placeEvidence(a, b).relation !== 'same') continue;
        out.push({ a, b });
      }
    }
  }
  return out;
}
