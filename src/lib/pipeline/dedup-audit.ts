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

export interface CountryAudit {
  country: string;
  /** Sichtbare Events ab heute. */
  visible: number;
  residual: number;
  /** Restdubletten je 10.000 sichtbare Events. */
  rate: number;
  limit: number;
}

/**
 * Restdubletten je Land (fn-29.18). Österreich hat die feste Grenze
 * `maxAt`. Jedes andere Land darf je sichtbarem Event nicht mehr haben, als
 * die österreichische Grenze erlaubt (Qualitätsvertrag DE: Dedup-Audit
 * nicht schlechter als AT), mindestens 10. Ein Paar zählt zum Land seiner
 * ersten Zeile. Ein Lauf ohne AT-Zeilen (getrennter DE-Lauf) gibt die Zahl
 * der sichtbaren AT-Events als `atVisible` mit.
 */
export function auditByCountry(events: EventRow[], residual: ResidualPair[], maxAt: number, atVisible?: number): CountryAudit[] {
  const visible = new Map<string, number>();
  for (const e of events) {
    if (!VISIBLE.has(e.publish_status ?? '')) continue;
    const c = e.country ?? 'AT';
    visible.set(c, (visible.get(c) ?? 0) + 1);
  }
  const pairs = new Map<string, number>();
  for (const { a } of residual) {
    const c = a.country ?? 'AT';
    pairs.set(c, (pairs.get(c) ?? 0) + 1);
  }
  const atBase = atVisible ?? visible.get('AT') ?? 0;
  const countries = [...new Set([...visible.keys(), ...pairs.keys()])]
    .sort((x, y) => (x === 'AT' ? -1 : y === 'AT' ? 1 : x.localeCompare(y)));
  return countries.map(country => {
    const v = visible.get(country) ?? 0;
    const r = pairs.get(country) ?? 0;
    const limit = country === 'AT' || atBase === 0 ? maxAt : Math.max(10, Math.ceil((maxAt * v) / atBase));
    return { country, visible: v, residual: r, rate: v ? Math.round((r / v) * 100_000) / 10 : 0, limit };
  });
}
