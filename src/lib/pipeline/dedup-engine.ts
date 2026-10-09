// src/lib/pipeline/dedup-engine.ts

/**
 * Dedup eines Wiener Kalendertags: Kandidaten finden, Paare entscheiden,
 * Cluster bilden, Primary wählen. Rein und ohne I/O — der Batch
 * (src/scripts/dedup.ts) lädt nur Daten und schreibt den Plan.
 *
 * Schutz vor falschem Zusammenführen (eine übrige Dublette ist der kleinere
 * Schaden als ein verstecktes Event):
 *  1. Mehrdeutigkeit: passt ein Eintrag zu zwei Events, die selbst nicht
 *     zusammengehören („Kaiser Wiesn" zu zwei Acts, „Hl. Messe" ohne Kirche
 *     zu zwei Kirchen), wird er keinem zugeordnet.
 *  2. Ausschluss im Cluster: zwei Events mit hartem Widerspruch (andere
 *     Vorstellung, anderer Ort, gleiche Quelle mit anderem Titel, manuell
 *     getrennt) landen nie im selben Cluster, auch nicht über Dritte.
 */

import { v4 as uuidv4 } from 'uuid';
import { canonicalizeIds, isHardDistinct, normalizeUrlForDedup, scorePair } from './dedup-scorer';
import { isEventSpecificUrl } from './event-url';
import { isOrphanRow, isSpecificTitle, knownStartMs, labelConflict, placeEvidence, placeRelation, timeRelation, titleRelation, titleTokensOf, viennaDayOf } from './dedup-evidence';
import { selectPrimary, wouldBeVisible } from './dedup-cluster';
import type { DedupScoreBreakdown, EventRow } from './types';

export interface EngineOptions {
  /** Paar-Schlüssel `idA:idB` (kanonisch sortiert) aus event_dedup_log. */
  manualMerges?: Set<string>;
  manualSplits?: Set<string>;
  /** Jüngstes last_seen_at je Quelle (für verwaiste Zeilen, siehe isOrphanRow). */
  sourceLastSeen?: Map<string, string>;
  /** Ältere Fassungen einer Seite (staleVersionIds): gelten wie verwaist. */
  staleIds?: ReadonlySet<string>;
}

export interface ClusterResult {
  clusterId?: string;
  primaryId: string;
  memberIds: string[];
  /** Entscheidungswert je Duplikat (für dedup_score). */
  scores: Map<string, number>;
}

export interface EvaluatedPair {
  a: EventRow;
  b: EventRow;
  breakdown: DedupScoreBreakdown;
}

export interface DayStats {
  candidatePairs: number;
  merge: number;
  uncertain: number;
  ambiguousDropped: number;
  blockedByConflict: number;
}

export interface DayResult {
  clusters: ClusterResult[];
  /** Alle bewerteten Paare mit Entscheidung merge oder uncertain. */
  pairs: EvaluatedPair[];
  /** Einträge, die zu mehreren verschiedenen Events passten (keinem zugeordnet). */
  ambiguousIds: string[];
  /** Verwaiste Zeilen dieses Tages (isOrphanRow). */
  orphanIds: string[];
  stats: DayStats;
}

/** Wörter, die an einem Tag in so vielen Titeln stehen, taugen nicht als Block. */
const MAX_BLOCK = 250;

/** Zusätze, die eine Titelvariante derselben Show macht (Ticket- und Infoseiten). */
const VARIANT_FILLER = new Set([
  'detailinfos', 'details', 'detail', 'infos', 'info', 'informationen', 'tickets', 'ticket', 'karten',
  'vip', 'packages', 'package', 'paket', 'pakete', 'ticket24', 'eintritt', 'vorverkauf',
]);

export function pairKey(a: string, b: string): string {
  const [x, y] = canonicalizeIds(a, b);
  return `${x}:${y}`;
}

/** Gruppiert nach Wiener Kalendertag (nicht UTC: 00:30 Wien gehört zum Wiener Tag). */
export function groupByViennaDay(events: EventRow[]): Map<string, EventRow[]> {
  const days = new Map<string, EventRow[]>();
  for (const e of events) {
    const day = viennaDayOf(e);
    if (!day) continue;
    const list = days.get(day);
    if (list) list.push(e);
    else days.set(day, [e]);
  }
  return days;
}

/**
 * Kandidaten: Paare, die mindestens ein bedeutungstragendes Titelwort, den
 * kompletten Titel, die Venue-Id oder den Ticket-Link teilen. Jede Titel-Relation, die zum
 * Zusammenführen reicht (gleich, Tippfehler, enthalten), teilt ein Wort —
 * unabhängig von Quelle, Ortsname oder Bezirk.
 */
export function candidatePairs(events: EventRow[]): Array<[number, number]> {
  const blocks = new Map<string, number[]>();
  const add = (key: string, i: number) => {
    const list = blocks.get(key);
    if (list) list.push(i);
    else blocks.set(key, [i]);
  };
  events.forEach((e, i) => {
    const tokens = titleTokensOf(e);
    add(`c:${tokens.join('')}`, i);
    for (const t of new Set(tokens)) add(`t:${t}`, i);
    if (e.venue_id) add(`v:${e.venue_id}`, i);
    // Gleicher Ticket-Link ist ein Beleg, auch wenn die Titel kein Wort teilen.
    const ticket = normalizeUrlForDedup(e.ticket_url);
    if (ticket) add(`k:${ticket}`, i);
  });

  const seen = new Set<number>();
  const out: Array<[number, number]> = [];
  const n = events.length;
  for (const [key, members] of blocks) {
    if (members.length < 2) continue;
    if (members.length > MAX_BLOCK && !key.startsWith('c:')) continue;
    for (let x = 0; x < members.length; x++) {
      for (let y = x + 1; y < members.length; y++) {
        const i = Math.min(members[x], members[y]);
        const j = Math.max(members[x], members[y]);
        const code = i * n + j;
        if (seen.has(code)) continue;
        seen.add(code);
        out.push([i, j]);
      }
    }
  }
  return out;
}

class UnionFind {
  private parent = new Map<string, string>();
  private members = new Map<string, string[]>();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.members.set(x, [x]);
    }
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (cur !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  membersOf(root: string): string[] {
    return this.members.get(root) ?? [root];
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const [big, small] = this.membersOf(ra).length >= this.membersOf(rb).length ? [ra, rb] : [rb, ra];
    this.parent.set(small, big);
    this.members.set(big, [...this.membersOf(big), ...this.membersOf(small)]);
    this.members.delete(small);
  }

  roots(): string[] {
    return [...this.members.keys()];
  }
}

/**
 * Dieselbe Listung einer Quelle (Vorgängerversion): beide Links zeigen auf
 * genau ein Event → dieselbe Seite; sonst (Listen-, Veranstalterseiten)
 * entscheidet der Ort: kein Widerspruch aus PLZ, Gemeinde, Bezirk oder
 * genauen Pins (Venue-Namen von Altzeilen sind oft Regionsnamen), und
 * Ortsbeleg oder derselbe konkrete Titel („Traditionelles Nikolospiel am
 * Dorfplatz Bad Mitterndorf").
 */
function sameListing(o: EventRow, f: EventRow, title: ReturnType<typeof titleRelation>): boolean {
  const uo = normalizeUrlForDedup(o.source_url);
  const uf = normalizeUrlForDedup(f.source_url);
  if (uo && uf && isEventSpecificUrl(uo) && isEventSpecificUrl(uf)) return uo === uf;
  if (labelConflict(o, f)) return false;
  const place = placeEvidence(o, f, { ignoreLabels: true }).relation;
  return place === 'same' || place === 'town' || (o.postal_code != null && o.postal_code === f.postal_code) ||
    ((title === 'equal' || title === 'near') && isSpecificTitle(o));
}

export function dedupDay(events: EventRow[], opts: EngineOptions = {}): DayResult {
  const byId = new Map(events.map(e => [e.id, e]));
  // Verwaiste Altzeilen sind kein Gegenbeleg: sie machen weder Einträge
  // mehrdeutig noch blockieren sie einen Cluster (dürfen aber hinein).
  const orphans = new Set(events.filter(e => isOrphanRow(e, opts.sourceLastSeen) || !!opts.staleIds?.has(e.id)).map(e => e.id));
  const conflicting = (x: string, y: string) =>
    !orphans.has(x) && !orphans.has(y) && isHardDistinct(decide(byId.get(x)!, byId.get(y)!));
  const stats: DayStats = { candidatePairs: 0, merge: 0, uncertain: 0, ambiguousDropped: 0, blockedByConflict: 0 };
  const decisions = new Map<string, DedupScoreBreakdown>();

  const decide = (x: EventRow, y: EventRow): DedupScoreBreakdown => {
    const key = pairKey(x.id, y.id);
    const cached = decisions.get(key);
    if (cached) return cached;
    // Verwaiste Altzeilen tragen oft falsche Bezirks-/PLZ-Etiketten (Altdaten,
    // tote Quellen): die zählen bei ihnen nicht als Widerspruch.
    let d = scorePair(x, y, { lenientLabels: orphans.has(x.id) || orphans.has(y.id) });
    if (opts.manualSplits?.has(key)) d = { ...d, decision: 'distinct', reason: 'manual_split', strength: undefined };
    else if (opts.manualMerges?.has(key)) d = { ...d, decision: 'merge', reason: 'manual_merge', strength: 'strong' };
    decisions.set(key, d);
    return d;
  };

  // 1. Kandidaten bewerten (+ manuell zusammengeführte Paare dieses Tages)
  const pairs: Array<[EventRow, EventRow]> = candidatePairs(events).map(([i, j]) => [events[i], events[j]]);
  const seenPairs = new Set(pairs.map(([x, y]) => pairKey(x.id, y.id)));
  for (const key of opts.manualMerges ?? []) {
    const [x, y] = key.split(':');
    if (byId.has(x) && byId.has(y) && !seenPairs.has(key)) pairs.push([byId.get(x)!, byId.get(y)!]);
  }
  stats.candidatePairs = pairs.length;

  const evaluated: EvaluatedPair[] = [];
  const edges = new Map<string, Map<string, DedupScoreBreakdown>>();
  const link = (x: string, y: string, d: DedupScoreBreakdown) => {
    if (!edges.has(x)) edges.set(x, new Map());
    edges.get(x)!.set(y, d);
  };
  for (const [x, y] of pairs) {
    const d = decide(x, y);
    if (d.decision === 'distinct') continue;
    evaluated.push({ a: x, b: y, breakdown: d });
    if (d.decision === 'uncertain') { stats.uncertain++; continue; }
    stats.merge++;
    link(x.id, y.id, d);
    link(y.id, x.id, d);
  }

  // 1b. Vorgängerversion: Eine verwaiste Zeile, für die ihre Quelle am selben
  //     Tag genau EINE frische Zeile mit gleichem oder verschachteltem Titel
  //     liefert, ist deren Vorgänger (neue source_id, korrigierte Uhrzeit;
  //     Prod 2026-10-08: Feratel-Altzeilen mit +1/+2 h versteckten die
  //     frischen Termine). Zeit- und Ortsabweichungen der Altzeile zählen nicht.
  //     Dieselbe Quelle heißt nicht derselbe Ort: Aggregatoren (gem2go) führen
  //     hunderte Gemeinden unter einem Namen (Stichprobe 2026-10-09: JHV
  //     Grinzens wäre unter der JHV Kematen verschwunden). Nachfolger ist nur
  //     eine Zeile derselben Seite oder, ohne Seitenangabe, desselben Orts.
  const successors = new Map<string, string[]>();
  for (const [x, y] of pairs) {
    for (const [o, f] of [[x, y], [y, x]] as const) {
      if (!orphans.has(o.id) || orphans.has(f.id)) continue;
      if (!o.source_name || o.source_name !== f.source_name) continue;
      const t = titleRelation(o, f);
      if (t !== 'equal' && t !== 'near' && t !== 'contains') continue;
      if (!sameListing(o, f, t)) continue;
      successors.set(o.id, [...(successors.get(o.id) ?? []), f.id]);
    }
  }
  for (const [o, list] of successors) {
    if (list.length !== 1) continue;
    const f = list[0];
    if (opts.manualSplits?.has(pairKey(o, f)) || edges.get(o)?.get(f)?.decision === 'merge') continue;
    const d: DedupScoreBreakdown = {
      ...decide(byId.get(o)!, byId.get(f)!),
      decision: 'merge',
      reason: 'superseded_same_source',
      strength: 'strong',
    };
    evaluated.push({ a: byId.get(o)!, b: byId.get(f)!, breakdown: d });
    stats.merge++;
    link(o, f, d);
    link(f, o, d);
  }

  // 1c. Bestehende Verbindung einer frischen Zeile zu einem verwaisten
  //     Primary: bleibt, solange kein Gegenbeleg da ist; der Cluster macht
  //     dann die frische Zeile zum Primary (Prod 2026-10-08: 433 künftige
  //     Termine hingen an Altzeilen mit falscher Uhrzeit). Mit Gegenbeleg
  //     oder ohne Bestätigung gibt planDedup die frische Zeile frei.
  for (const f of events) {
    const o = f.publish_status === 'duplicate' && f.duplicate_of ? byId.get(f.duplicate_of) : undefined;
    if (!o || !orphans.has(o.id) || orphans.has(f.id) || edges.get(f.id)?.has(o.id)) continue;
    const d = decide(f, o);
    if (d.decision === 'distinct') continue;
    const kept: DedupScoreBreakdown = { ...d, decision: 'merge', reason: 'kept_link_orphan_primary', strength: 'weak' };
    evaluated.push({ a: f, b: o, breakdown: kept });
    stats.merge++;
    link(f.id, o.id, kept);
    link(o.id, f.id, kept);
  }

  // 2. Mehrdeutige Einträge: Nachbarn, die nicht zusammenpassen, heißen,
  //    dass der Eintrag zu mehreren Events passt — dann zu keinem.
  //    Zusammen passen zwei Nachbarn, wenn sie selbst verschmelzen, wenn ihre
  //    Titel gleich/verschachtelt sind (nur Ort/Zeit fehlten zum Beleg), oder
  //    wenn sie zur selben Minute am selben Ort stattfinden. Nicht zusammen
  //    passen verschiedene Programmpunkte („Kaiser Wiesn – Act A" / „– Act B")
  //    und alles mit hartem Widerspruch.
  const nested = (a: EventRow, b: EventRow) => {
    const t = titleRelation(a, b);
    return t === 'equal' || t === 'near' || t === 'contains';
  };
  const compatible = (x: EventRow, y: EventRow, z: EventRow): boolean => {
    if (orphans.has(y.id) || orphans.has(z.id)) return true;
    const d = decide(y, z);
    if (isHardDistinct(d)) return false;
    if (d.decision === 'merge') return true;
    const t = titleRelation(y, z);
    if (t === 'equal' || t === 'near' || t === 'contains') return true;
    const place = placeRelation(y, z);
    const time = timeRelation(y, z);
    if (time === 'exact' && (place === 'same' || place === 'town')) return true;
    // Titelvarianten derselben Show am selben Ort („Detailinfos zu X",
    // „X - VIP Packages"), die beide den mehrwortigen Titel von x enthalten
    // (Prod 2026-10-08: Beatrice Egli, Trivium). Eine der beiden fügt nur
    // Füllwörter hinzu; zwei eigene Zusätze („Kaiser Wiesn Dirndl Rocker" /
    // „… Die Lauser", Kurator- / Familienführung) sind zwei Programmpunkte.
    // Nicht bei „related", nicht bei Einwort-Titeln, nicht bei verschiedenen
    // bekannten Uhrzeiten.
    if (t !== 'different' || place !== 'same' || time === 'far' || titleTokensOf(x).length < 2) return false;
    if (!nested(x, y) || !nested(x, z)) return false;
    const ty = knownStartMs(y);
    const tz = knownStartMs(z);
    if (ty !== null && tz !== null && ty !== tz) return false;
    const base = new Set(titleTokensOf(x));
    const onlyFiller = (e: EventRow) => titleTokensOf(e).every(w => base.has(w) || VARIANT_FILLER.has(w));
    return onlyFiller(y) || onlyFiller(z);
  };
  const ambiguous = new Set<string>();
  for (const [x, neighbours] of edges) {
    const list = [...neighbours.keys()];
    if (list.length < 2) continue;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (!compatible(byId.get(x)!, byId.get(list[i])!, byId.get(list[j])!)) {
          ambiguous.add(x);
          break outer;
        }
      }
    }
  }

  // 3. Cluster: starke Belege zuerst, keine harten Widersprüche im Cluster.
  const edgeList: Array<{ x: string; y: string; d: DedupScoreBreakdown }> = [];
  for (const [x, neighbours] of edges) {
    for (const [y, d] of neighbours) {
      if (x >= y) continue;
      const manual = d.reason === 'manual_merge';
      if (!manual && (ambiguous.has(x) || ambiguous.has(y))) { stats.ambiguousDropped++; continue; }
      edgeList.push({ x, y, d });
    }
  }
  edgeList.sort((p, q) =>
    (p.d.strength === 'weak' ? 1 : 0) - (q.d.strength === 'weak' ? 1 : 0) ||
    q.d.overallScore - p.d.overallScore);

  const uf = new UnionFind();
  for (const e of events) uf.find(e.id);
  for (const { x, y } of edgeList) {
    const rx = uf.find(x);
    const ry = uf.find(y);
    if (rx === ry) continue;
    let conflict = false;
    check: for (const m of uf.membersOf(rx)) {
      for (const k of uf.membersOf(ry)) {
        if (conflicting(m, k)) { conflict = true; break check; }
      }
    }
    if (conflict) { stats.blockedByConflict++; continue; }
    uf.union(x, y);
  }

  // 4. Primary je Cluster
  const clusters: ClusterResult[] = [];
  for (const root of uf.roots()) {
    const memberIds = uf.membersOf(root);
    if (memberIds.length < 2) continue;
    const members = memberIds.map(id => byId.get(id)!);
    // Kein aktuelles Mitglied, das sichtbar sein darf (nur Altzeilen, oder
    // die frische Zeile ist zurückgehalten): nichts daran ändern, sonst würde
    // eine verwaiste Zeile mit veralteten Daten als Primary wieder sichtbar.
    if (!members.some(m => !orphans.has(m.id) && wouldBeVisible(m))) continue;
    const primary = selectPrimary([...members], id => orphans.has(id));
    const scores = new Map<string, number>();
    for (const m of members) {
      if (m.id === primary.id) continue;
      scores.set(m.id, decide(primary, m).overallScore);
    }
    clusters.push({ primaryId: primary.id, memberIds, scores });
  }

  return { clusters, pairs: evaluated, ambiguousIds: [...ambiguous], orphanIds: [...orphans], stats };
}

/** Neue Cluster-Id (eigene Funktion, damit Tests sie ersetzen können). */
export function newClusterId(): string {
  return uuidv4();
}
