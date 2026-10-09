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
import { isOrphanRow, placeEvidence } from './dedup-evidence';
import { LABEL_CONFLICTS, scorePair } from './dedup-scorer';
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
  for (const e of events) {
    if (e.publish_status !== 'duplicate' || desiredDuplicate.has(e.id)) continue;
    const previousPrimaryId = e.duplicate_of ?? null;
    if (clusterPrimaries.has(e.id)) {
      plan.release.push({ id: e.id, previousPrimaryId, reason: 'primary_of_cluster' });
      continue;
    }
    // Altzeilen, Datums- und Müll-Titel bleiben verborgen, egal was mit
    // ihrem Primary ist.
    if (isOrphanRow(e, opts.sourceLastSeen) || isDateOnlyTitle(e.title) ||
        isGarbageTitle(e.title, { sourceName: e.source_name, ticketUrl: e.ticket_url })) continue;
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
      plan.release.push({ id: e.id, previousPrimaryId, reason: 'primary_hidden' });
      continue;
    }
    // Der bisherige Primary ist eine Altzeile, und der Lauf hat die
    // Verbindung nicht bestätigt (sonst wäre die frische Zeile jetzt Primary,
    // dedup-engine 1c): Gegenbeleg, Mehrdeutigkeit oder anderer Tag. Die
    // frische Zeile bleibt sonst für immer hinter veralteten Daten verborgen.
    if (isOrphanRow(p, opts.sourceLastSeen)) {
      plan.release.push({ id: e.id, previousPrimaryId, reason: 'primary_orphaned' });
      continue;
    }
    const verdict = opts.manualSplits?.has(pairKey(e.id, p.id))
      ? { decision: 'distinct', reason: 'manual_split' }
      : scorePair(e, p);
    if (verdict.decision !== 'distinct' || !verdict.reason) continue;
    // Etiketten allein (Bezirk/PLZ/Ortsname) sind bei einzelnen Quellen
    // falsch; sie lösen nur, wenn auch sonst nichts denselben Ort belegt.
    const labelOnly = LABEL_CONFLICTS.has(verdict.reason) &&
      ['same', 'town'].includes(placeEvidence(e, p, { ignoreLabels: true }).relation);
    if ((RELEASE_REASONS.has(verdict.reason) || LABEL_CONFLICTS.has(verdict.reason)) && !labelOnly) {
      plan.release.push({ id: e.id, previousPrimaryId, reason: verdict.reason });
    }
  }
  return plan;
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
  if (plan.release.length > limits.maxReleases) {
    violations.push(`${plan.release.length} Freigaben > Grenze ${limits.maxReleases}`);
  }
  return violations;
}
