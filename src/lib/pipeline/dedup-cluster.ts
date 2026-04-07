// src/lib/pipeline/dedup-cluster.ts

/**
 * Cluster formation and primary selection for dedup.
 *
 * Takes scored pairs and forms clusters using union-find,
 * selects the primary event, and enriches it from duplicates.
 */

import type { EventRow, DedupScoreBreakdown } from './types';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Union-Find for cluster formation
// ---------------------------------------------------------------------------

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;

    const rankA = this.rank.get(rootA) ?? 0;
    const rankB = this.rank.get(rootB) ?? 0;
    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
  }

  getClusters(): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    for (const id of Array.from(this.parent.keys())) {
      const root = this.find(id);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root)!.push(id);
    }
    return clusters;
  }
}

// ---------------------------------------------------------------------------
// Scored pair type
// ---------------------------------------------------------------------------

export interface ScoredPair {
  eventA: EventRow;
  eventB: EventRow;
  score: DedupScoreBreakdown;
}

// ---------------------------------------------------------------------------
// Cluster type
// ---------------------------------------------------------------------------

export interface DedupCluster {
  clusterId: string;
  primaryId: string;
  duplicateIds: string[];
  /** Fields to enrich on the primary from duplicates */
  enrichments: Record<string, unknown>;
  /** Dedup scores for each duplicate relative to primary */
  scores: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Build clusters from merge pairs
// ---------------------------------------------------------------------------

/**
 * Build dedup clusters from scored pairs.
 * Only 'merge' decisions create clusters.
 */
export function buildClusters(
  pairs: ScoredPair[],
  eventsById: Map<string, EventRow>,
): DedupCluster[] {
  const uf = new UnionFind();

  // Union all merge pairs
  for (const pair of pairs) {
    if (pair.score.decision === 'merge') {
      uf.union(pair.eventA.id, pair.eventB.id);
    }
  }

  // Get clusters (only multi-member ones)
  const rawClusters = uf.getClusters();
  const results: DedupCluster[] = [];

  for (const [, memberIds] of Array.from(rawClusters)) {
    if (memberIds.length < 2) continue;

    const members = memberIds
      .map(id => eventsById.get(id))
      .filter((e): e is EventRow => !!e);

    if (members.length < 2) continue;

    // Select primary
    const primary = selectPrimary(members);
    const duplicates = members.filter(m => m.id !== primary.id);

    // Compute enrichments
    const enrichments = computeEnrichments(primary, duplicates);

    // Build score map (use overall score from pairs)
    const scores = new Map<string, number>();
    for (const dup of duplicates) {
      // Find the pair score for this duplicate
      const pair = pairs.find(
        p =>
          (p.eventA.id === primary.id && p.eventB.id === dup.id) ||
          (p.eventA.id === dup.id && p.eventB.id === primary.id),
      );
      scores.set(dup.id, pair?.score.overallScore ?? 0);
    }

    results.push({
      clusterId: uuidv4(),
      primaryId: primary.id,
      duplicateIds: duplicates.map(d => d.id),
      enrichments,
      scores,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Primary selection
// ---------------------------------------------------------------------------

/**
 * Select the best event as primary from a cluster.
 *
 * Criteria (in order):
 * 1. Highest quality_score
 * 2. Longest meaningful description (> 50 chars)
 * 3. Has image_url
 * 4. Has ticket_url
 * 5. Oldest created_at
 */
export function selectPrimary(events: EventRow[]): EventRow {
  return events.sort((a, b) => {
    // 1. quality_score DESC
    const scoreA = a.quality_score ?? 0;
    const scoreB = b.quality_score ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 2. description length DESC
    const descA = (a.description?.length ?? 0) > 50 ? a.description!.length : 0;
    const descB = (b.description?.length ?? 0) > 50 ? b.description!.length : 0;
    if (descA !== descB) return descB - descA;

    // 3. has image_url
    const imgA = a.image_url ? 1 : 0;
    const imgB = b.image_url ? 1 : 0;
    if (imgA !== imgB) return imgB - imgA;

    // 4. has ticket_url
    const tickA = a.ticket_url ? 1 : 0;
    const tickB = b.ticket_url ? 1 : 0;
    if (tickA !== tickB) return tickB - tickA;

    // 5. oldest created_at ASC
    const dateA = a.created_at ?? '';
    const dateB = b.created_at ?? '';
    return dateA.localeCompare(dateB);
  })[0];
}

// ---------------------------------------------------------------------------
// Field enrichment
// ---------------------------------------------------------------------------

/**
 * Compute fields to enrich on the primary from duplicates.
 * Only fills in fields that the primary is missing.
 */
export function computeEnrichments(
  primary: EventRow,
  duplicates: EventRow[],
): Record<string, unknown> {
  const enrichments: Record<string, unknown> = {};

  // description: longest meaningful one if primary has none/short
  if (!primary.description || primary.description.length < 50) {
    const best = duplicates
      .filter(d => d.description && d.description.length > 50)
      .sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0))[0];
    if (best?.description) {
      enrichments.description = best.description;
    }
  }

  // image_url
  if (!primary.image_url) {
    const withImg = duplicates.find(d => d.image_url);
    if (withImg) enrichments.image_url = withImg.image_url;
  }

  // ticket_url
  if (!primary.ticket_url) {
    const withTicket = duplicates.find(d => d.ticket_url);
    if (withTicket) enrichments.ticket_url = withTicket.ticket_url;
  }

  // end_date
  if (!primary.end_date) {
    const withEnd = duplicates.find(d => d.end_date);
    if (withEnd) enrichments.end_date = withEnd.end_date;
  }

  // price_text
  if (!primary.price_text) {
    const withPrice = duplicates.find(d => d.price_text);
    if (withPrice) enrichments.price_text = withPrice.price_text;
  }

  // organizer
  if (!primary.organizer) {
    const withOrg = duplicates.find(d => d.organizer);
    if (withOrg) enrichments.organizer = withOrg.organizer;
  }

  // tags: union of all tags
  const allTags = new Set<string>();
  for (const t of primary.tags ?? []) allTags.add(t);
  for (const dup of duplicates) {
    for (const t of dup.tags ?? []) allTags.add(t);
  }
  if (allTags.size > (primary.tags?.length ?? 0)) {
    enrichments.tags = [...allTags];
  }

  return enrichments;
}

/**
 * Resolve a duplicate_of target to the actual primary.
 * Prevents chains by following the reference until we find a non-duplicate.
 */
export function resolvePrimary(
  targetId: string,
  eventsById: Map<string, EventRow>,
  maxDepth = 10,
): string {
  let current = targetId;
  let depth = 0;
  while (depth < maxDepth) {
    const event = eventsById.get(current);
    if (!event || !event.duplicate_of) return current;
    current = event.duplicate_of;
    depth++;
  }
  return current; // Safety: return whatever we have after maxDepth
}
