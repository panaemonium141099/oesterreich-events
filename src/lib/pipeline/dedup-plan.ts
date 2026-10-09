// src/lib/pipeline/dedup-plan.ts

/**
 * Vom Sollzustand zum Schreibplan.
 *
 * Der Dedup rechnet jede Nacht ALLE Cluster aus den aktuellen Daten neu
 * (dedup-engine) und schreibt nur die Abweichungen zum Ist-Zustand. Damit
 * gilt: gleiche Daten → gleiches Ergebnis, egal was frühere Läufe oder
 * frühere Regeln markiert haben.
 *  - Neue Dubletten werden markiert, umgezogene Primaries umgehängt.
 *  - Ein Duplikat ohne passenden Partner (Regeln geschärft, Primary
 *    unterdrückt, Event geändert) wird wieder freigegeben.
 *  - Der Primary bekommt fehlende Felder aus seinen Duplikaten — in jedem
 *    Lauf neu, weil der nächtliche Upsert seiner Quelle sie überschreibt.
 *
 * Rein und ohne I/O.
 */

import { computeEnrichments, isDateOnlyTitle, underlyingStatus } from './dedup-cluster';
import { isGarbageTitle } from './garbage-filter';
import { newClusterId as defaultClusterId, pairKey, type ClusterResult } from './dedup-engine';
import { isOrphanRow, knownStartMs, placeEvidence, titleRelation, titleTokensOf } from './dedup-evidence';
import { LABEL_CONFLICTS, scorePair } from './dedup-scorer';
import { isEventSpecificUrl, normalizeUrlForDedup } from './event-url';
import type { PublishStatus } from '@/lib/quality/score-event';
import type { EventRow } from './types';

export interface MarkDuplicate {
  id: string;
  primaryId: string;
  clusterId: string;
  score: number;
  /** War vorher kein Duplikat (zählt fürs Sicherheitsventil). */
  isNew: boolean;
}

export interface Release {
  id: string;
  previousPrimaryId: string | null;
  /** Gegenbeleg, z. B. 'different_showtime' oder 'primary_of_cluster'. */
  reason: string;
  /** Wird die Zeile dadurch sichtbar? (Quarantäne/Ortskonflikt bleiben verborgen.) */
  visible?: boolean;
}

export interface PrimaryUpdate {
  id: string;
  clusterId: string;
  enrichments: Record<string, unknown>;
}

export interface DedupPlan {
  markDuplicate: MarkDuplicate[];
  release: Release[];
  primaries: PrimaryUpdate[];
}

export interface PlanOptions {
  newClusterId?: () => string;
  /** Ältere Fassungen einer Seite (staleVersionIds): gelten wie verwaist. */
  staleIds?: ReadonlySet<string>;
  /** Jüngstes last_seen_at je Quelle (verwaiste Zeilen, isOrphanRow). */
  sourceLastSeen?: Map<string, string>;
  /** Bisherige Primaries, die nicht im Tagessatz liegen (anderer Tag). */
  externalPrimaries?: Map<string, EventRow>;
  manualSplits?: Set<string>;
}

/** Wie `minGapDays` in withdrawal.ts: so lange gilt ein Duplikat als Bestätigung. */
const WITHDRAWAL_CONFIRM_MS = 7 * 86_400_000;

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

export function planDedup(events: EventRow[], clusters: ClusterResult[], opts: PlanOptions = {}): DedupPlan {
  const nextId = opts.newClusterId ?? defaultClusterId;
  const byId = new Map(events.map(e => [e.id, e]));
  const plan: DedupPlan = { markDuplicate: [], release: [], primaries: [] };
  const desiredDuplicate = new Set<string>();

  for (const c of clusters) {
    const primary = byId.get(c.primaryId);
    if (!primary) continue;
    const members = c.memberIds.map(id => byId.get(id)).filter((e): e is EventRow => !!e);
    // Cluster-Id stabil halten: die des Primary, sonst irgendeines Mitglieds.
    const clusterId = c.clusterId ?? primary.dedup_cluster_id ??
      members.find(m => m.dedup_cluster_id)?.dedup_cluster_id ?? nextId();

    const duplicates = members.filter(m => m.id !== primary.id);
    for (const d of duplicates) {
      desiredDuplicate.add(d.id);
      const correct = d.publish_status === 'duplicate' && d.duplicate_of === primary.id && d.dedup_cluster_id === clusterId;
      if (correct) continue;
      plan.markDuplicate.push({
        id: d.id,
        primaryId: primary.id,
        clusterId,
        score: c.scores.get(d.id) ?? 0,
        isNew: d.publish_status !== 'duplicate',
      });
    }

    const enrichments: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(computeEnrichments(primary, duplicates))) {
      if (!sameValue((primary as unknown as Record<string, unknown>)[k], v)) enrichments[k] = v;
    }
    // Ein bisheriges Duplikat als Primary wird freigegeben, und die Freigabe
    // setzt dedup_cluster_id auf null: die Cluster-Id danach neu schreiben.
    if (primary.dedup_cluster_id !== clusterId || primary.publish_status === 'duplicate' ||
        Object.keys(enrichments).length > 0) {
      plan.primaries.push({ id: primary.id, clusterId, enrichments });
    }
  }

  // Bestehende Duplikate, die der Lauf nicht mehr bestätigt: nur mit
  // Gegenbeleg lösen. Ohne Beleg (Primary weg, nur unsicher, mehrdeutig)
  // bleibt die Verbindung — sonst tauchen Altzeilen, die frühere Läufe zu
  // Recht versteckt hatten, als Phantome wieder auf (Probelauf 2026-10-07:
  // 11.837 Freigaben, überwiegend verwaiste Zeilen aus behobenen Scraper-Fehlern).
  const clusterPrimaries = new Set(clusters.map(c => c.primaryId));
  const isStale = (r: EventRow) => isOrphanRow(r, opts.sourceLastSeen) || !!opts.staleIds?.has(r.id);
  const VISIBLE = new Set(['published', 'published_low_confidence']);
  const seenMs = (r: EventRow) => (r.last_seen_at ? Date.parse(r.last_seen_at) : NaN);

  /** Sichtbare Zeile desselben Tages, die dasselbe Event sein kann (Titel
   *  gleich oder enthalten, kein Gegenbeleg) und sichtbar bleibt. */
  const visibleTwin = (e: EventRow): { row: EventRow; score: number } | null => {
    let best: { row: EventRow; score: number; rank: number } | null = null;
    for (const r of events) {
      if (r.id === e.id || !VISIBLE.has(r.publish_status ?? '') || desiredDuplicate.has(r.id)) continue;
      if (isStale(r)) continue;
      const t = titleRelation(e, r);
      if (t !== 'equal' && t !== 'near' && t !== 'contains') continue;
      if (opts.manualSplits?.has(pairKey(e.id, r.id))) continue;
      const v = scorePair(e, r);
      if (v.decision === 'distinct') continue;
      const rank = (v.decision === 'merge' ? 4 : 0) + (r.source_name === 'Eventim' ? 2 : 0) + (r.quality_score ?? 0) / 1000;
      if (!best || rank > best.rank) best = { row: r, score: v.overallScore, rank };
    }
    return best;
  };

  const pushRelease = (e: EventRow, previousPrimaryId: string | null, reason: string) => {
    plan.release.push({ id: e.id, previousPrimaryId, reason, visible: VISIBLE.has(underlyingStatus(e)) });
  };

  /** Bisheriger Primary weg oder veraltet: an einen sichtbaren Zwilling
   *  hängen statt eine zweite sichtbare Zeile zu erzeugen (Stichprobe
   *  2026-10-09: Weyer, Ebensee, Schwarzenberg doppelt sichtbar). */
  /** Liefert die Zeile, unter der das Event danach sichtbar ist (oder null). */
  const releaseOrAttach = (e: EventRow, previousPrimaryId: string | null, reason: string): EventRow | null => {
    const twin = visibleTwin(e);
    if (!twin) {
      pushRelease(e, previousPrimaryId, reason);
      return VISIBLE.has(underlyingStatus(e)) ? e : null;
    }
    attach(e, twin.row, twin.score, false);
    return twin.row;
  };

  const attach = (dup: EventRow, primary: EventRow, score: number, isNew: boolean) => {
    const existing = plan.primaries.find(p => p.id === primary.id);
    const clusterId = existing?.clusterId ?? primary.dedup_cluster_id ?? nextId();
    if (!existing && (primary.dedup_cluster_id !== clusterId || primary.publish_status === 'duplicate')) {
      plan.primaries.push({ id: primary.id, clusterId, enrichments: {} });
    }
    plan.markDuplicate.push({ id: dup.id, primaryId: primary.id, clusterId, score, isNew });
    desiredDuplicate.add(dup.id);
  };

  /** Dieselbe Detailseite derselben Quelle (Link auf genau ein Event). */
  const sameDetailPage = (a: EventRow, b: EventRow): boolean => {
    const ua = normalizeUrlForDedup(a.source_url);
    return a.source_name === b.source_name && !!ua && isEventSpecificUrl(ua) && ua === normalizeUrlForDedup(b.source_url);
  };

  for (const e of events) {
    if (e.publish_status !== 'duplicate' || desiredDuplicate.has(e.id)) continue;
    const previousPrimaryId = e.duplicate_of ?? null;
    if (clusterPrimaries.has(e.id)) {
      pushRelease(e, previousPrimaryId, 'primary_of_cluster');
      continue;
    }
    // Altzeilen, Datums- und Müll-Titel bleiben verborgen, egal was mit
    // ihrem Primary ist.
    if (isStale(e) || isDateOnlyTitle(e.title) ||
        isGarbageTitle(e.title, { sourceName: e.source_name, ticketUrl: e.ticket_url })) continue;
    // Ältere Fassung derselben Seite (die Quelle liefert die URL inzwischen als
    // andere Zeile): bleibt verborgen, der Rückzug löst sie ab.
    if (e.source_url && events.some(n => n !== e && n.source_name === e.source_name && n.source_url === e.source_url &&
        seenMs(n) - seenMs(e) > 86_400_000)) continue;
    const p = previousPrimaryId ? (byId.get(previousPrimaryId) ?? opts.externalPrimaries?.get(previousPrimaryId)) : undefined;
    // Der bisherige Primary ist selbst nicht (mehr) sichtbar: dann versteckt
    // die Verbindung ein echtes Event (Prod 2026-10-07: „Wickie, Slime und
    // Paiper" hinter dem als Müll unterdrückten „Event / Party").
    if (!p || p.publish_status === 'suppressed' || p.publish_status === 'needs_review' || p.location_status === 'conflict') {
      // Zurückgezogen, weil die Quelle es nicht mehr listet: ein Duplikat,
      // das damals schon eine Woche nicht gesehen war, belegt das Event
      // nicht (Rückzugsregel: Bestätigung nur binnen 7 Tagen).
      // Inserate (business/user) haben keine Sichtungen und gelten immer.
      const scraped = !e.source_type || e.source_type === 'scraped';
      if (scraped && p?.withdrawn_at && e.last_seen_at &&
          Date.parse(e.last_seen_at) < Date.parse(p.withdrawn_at) - WITHDRAWAL_CONFIRM_MS) continue;
      releaseOrAttach(e, previousPrimaryId, 'primary_hidden');
      continue;
    }
    // Der bisherige Primary ist eine Altzeile, und der Lauf hat die
    // Verbindung nicht bestätigt (sonst wäre die frische Zeile jetzt Primary,
    // dedup-engine 1c): Gegenbeleg, Mehrdeutigkeit oder anderer Tag. Die
    // frische Zeile bleibt sonst für immer hinter veralteten Daten verborgen.
    if (isStale(p)) {
      const shownAs = releaseOrAttach(e, previousPrimaryId, 'primary_orphaned');
      // Die Altzeile derselben Quelle steht noch sichtbar da (alter Zeitzonen-
      // Versatz, falsches Etikett, alter Datumsfehler): sie wird Duplikat der
      // Zeile, unter der das Event jetzt sichtbar ist, sonst ist es doppelt
      // sichtbar (Stichprobe 2026-10-09: 52 von 225 Fällen). Nur wenn das
      // Event dann wirklich sichtbar ist (sonst verschwände es ganz).
      const t = titleRelation(e, p);
      const nested = t === 'equal' || t === 'near' || t === 'contains';
      const samePage = sameDetailPage(e, p);
      const linkable = byId.has(p.id) ? (nested || samePage) : (samePage && nested);
      if (shownAs && linkable && VISIBLE.has(p.publish_status ?? '') && p.source_name === e.source_name &&
          !desiredDuplicate.has(p.id) && !clusterPrimaries.has(p.id)) {
        attach(p, shownAs, scorePair(p, shownAs).overallScore, true);
      }
      continue;
    }
    const verdict = opts.manualSplits?.has(pairKey(e.id, p.id))
      ? { decision: 'distinct', reason: 'manual_split' }
      : scorePair(e, p);
    if (verdict.decision !== 'distinct' || !verdict.reason) continue;
    if (!isCounterEvidence(e, p, verdict.reason)) continue;
    if (verdict.reason === 'different_day') releaseOrAttach(e, previousPrimaryId, 'different_day');
    else pushRelease(e, previousPrimaryId, verdict.reason);
  }
  return plan;
}

/**
 * Reicht der Grund, eine bestehende Verbindung zu lösen? Die Stichprobe
 * 2026-10-09 fand Freigaben ohne echten Gegenbeleg, die eine zweite
 * sichtbare Zeile erzeugt hätten:
 *  - Etiketten (Bezirk/PLZ/Ortsname): bei einzelnen Quellen falsch (5592
 *    statt 5575 für Lessach, Gemeinde-Kalender mit eigener PLZ); sie lösen
 *    nur, wenn auch sonst nichts denselben Ort belegt
 *  - verschiedene Venue-Namen bei gleichem Titel, gleicher Minute und PLZ
 *    („Schatz.Kammer Burg Kreuzen" / „Panoramagasthof Zur Burgschenke")
 *  - Titelvarianten desselben Events, die zwei Wörter teilen („Kabarett
 *    Weinzettl & Rudle" / „Weinzettl & Rudle - Für immer …")
 */
function isCounterEvidence(e: EventRow, p: EventRow, reason: string): boolean {
  if (LABEL_CONFLICTS.has(reason)) {
    // Dieselbe Detailseite derselben Quelle ist dasselbe Event, auch wenn ein
    // falsch konfigurierter Gemeinde-Kalender eine fremde PLZ setzt („Buch in
    // Tirol" liest gemeinde-buch.at, Buch in Vorarlberg).
    const ue = normalizeUrlForDedup(e.source_url);
    if (e.source_name === p.source_name && ue && isEventSpecificUrl(ue) && ue === normalizeUrlForDedup(p.source_url)) return false;
    return !['same', 'town'].includes(placeEvidence(e, p, { ignoreLabels: true }).relation);
  }
  if (!RELEASE_REASONS.has(reason)) return false;
  if (reason === 'different_venue') {
    const t = titleRelation(e, p);
    const sameMinute = knownStartMs(e) !== null && knownStartMs(e) === knownStartMs(p);
    return !((t === 'equal' || t === 'near') && sameMinute && !!e.postal_code && e.postal_code === p.postal_code);
  }
  if (reason === 'different_title') {
    const pt = new Set(titleTokensOf(p));
    return titleTokensOf(e).filter(w => pt.has(w)).length < 2;
  }
  return true;
}

/**
 * Gegenbelege, die eine bestehende Verbindung lösen (beide Zeilen aktuell
 * geliefert). Bezirks-/PLZ-/Ortsnamen-Etiketten (LABEL_CONFLICTS) lösen nur
 * ohne sonstigen Ortsbeleg: einzelne Quellen tragen falsche (5592 statt 5575
 * für Lessach). Navigations-Müll derselben Quelle („zum Footer") fängt der
 * Müll-Filter vorher ab.
 */
const RELEASE_REASONS = new Set([
  'different_day',
  'different_title',
  'different_showtime',
  'different_venue_id',
  'different_place',
  'different_venue',
  'same_source_other_time',
  'same_source_other_title',
  'cancellation_marker',
  'manual_split',
]);

/**
 * Status beim Freigeben eines Duplikats: derselbe wie beim Upsert (Score →
 * Status, Quarantäne bleibt Quarantäne). Der nächste Scrape der Quelle
 * rechnet ihn ohnehin neu.
 */
export function releaseStatus(row: {
  quality_score?: number | null;
  admission_decision?: string | null;
  location_status?: string | null;
}): PublishStatus {
  // Eine Quelle der Wahrheit mit der Primary-Wahl (dedup-cluster.wouldBeVisible).
  return underlyingStatus(row);
}

/**
 * Scheitert die Freigabe eines neuen Primary (z. B. DB-Constraint), darf
 * nichts an ihn gehängt werden: Er bliebe 'duplicate', seine neuen
 * Duplikate zeigten auf eine unsichtbare Zeile, das ganze Event wäre weg.
 */
export function dropDependentsOfFailedReleases(plan: DedupPlan, failedReleaseIds: Set<string>): DedupPlan {
  if (failedReleaseIds.size === 0) return plan;
  return {
    markDuplicate: plan.markDuplicate.filter(m => !failedReleaseIds.has(m.primaryId)),
    release: plan.release.filter(r => !failedReleaseIds.has(r.id)),
    primaries: plan.primaries.filter(p => !failedReleaseIds.has(p.id)),
  };
}

/**
 * Widersprüche zwischen den Tagesplänen auflösen: eine Zeile, die an ihrem
 * eigenen Tag Primary ist (andere hängen an ihr) oder freigegeben wird, darf
 * nicht zugleich von einem anderen Tag aus versteckt werden (Altzeile mit
 * altem Datumsfehler). Im Zweifel bleibt sie, wie ihr eigener Tag sie plant.
 */
export function resolvePlanConflicts(plan: DedupPlan): DedupPlan {
  const asPrimary = new Set([...plan.primaries.map(p => p.id), ...plan.markDuplicate.map(m => m.primaryId)]);
  const released = new Set(plan.release.map(r => r.id));
  return {
    ...plan,
    markDuplicate: plan.markDuplicate.filter(m => !asPrimary.has(m.id) && !released.has(m.id)),
  };
}

export interface SafetyLimits {
  maxNewDuplicates: number;
  maxReleases: number;
  /** Zeilen, die der Müll-Filter neu unterdrücken würde. */
  maxGarbage?: number;
}

/**
 * Massenänderungen sind fast immer ein Fehler (Regel kaputt, Daten halb
 * geladen). Dann schreibt der Lauf nichts und meldet sich laut; ein Mensch
 * prüft den Probelauf und gibt mit höheren Grenzen frei.
 */
export function checkSafetyValve(plan: DedupPlan, limits: SafetyLimits, garbage = 0): string[] {
  const violations: string[] = [];
  if (limits.maxGarbage !== undefined && garbage > limits.maxGarbage) {
    violations.push(`${garbage} Müll-Unterdrückungen > Grenze ${limits.maxGarbage}`);
  }
  const newDuplicates = plan.markDuplicate.filter(m => m.isNew).length;
  if (newDuplicates > limits.maxNewDuplicates) {
    violations.push(`${newDuplicates} neue Duplikate > Grenze ${limits.maxNewDuplicates}`);
  }
  // Nur Freigaben, die etwas sichtbar machen; zurückgehaltene Zeilen bleiben
  // verborgen und ändern an der Seite nichts.
  const releases = plan.release.filter(r => r.visible !== false).length;
  if (releases > limits.maxReleases) {
    violations.push(`${releases} Freigaben > Grenze ${limits.maxReleases}`);
  }
  return violations;
}
