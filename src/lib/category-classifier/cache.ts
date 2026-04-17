/**
 * SQLite-backed cache for classifier results (both deterministic and AI).
 *
 * The cache key is the classifier input hash, which is namespaced by
 * CLASSIFIER_VERSION — bumping the version effectively invalidates the cache
 * without requiring a delete. Rows are kept indefinitely because they are
 * cheap and we may want to trace why an event was classified as X.
 */

import type { Category, CategoryCandidate } from '@/types/events';
import { getDatabase } from '@/lib/db/connection';
import { CLASSIFIER_VERSION } from './taxonomy';

export interface CachedClassifierResult {
  category: Category;
  tags: Category[];
  confidence: string;
  source: string;
  reason: string | null;
  candidates: CategoryCandidate[] | null;
  classifierVersion: string;
  inputHash: string;
}

export interface WriteCacheRow {
  inputHash: string;
  category: Category;
  tags: Category[];
  confidence: string;
  source: string;
  reason?: string | null;
  candidates?: CategoryCandidate[] | null;
}

/** Look up a cache entry for the current classifier version. */
export function getCached(inputHash: string): CachedClassifierResult | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT input_hash AS inputHash, classifier_version AS classifierVersion,
              category, tags, confidence, source, reason, candidates
         FROM category_cache
        WHERE input_hash = ? AND classifier_version = ?`,
    )
    .get(inputHash, CLASSIFIER_VERSION) as
    | {
        inputHash: string;
        classifierVersion: string;
        category: string;
        tags: string;
        confidence: string;
        source: string;
        reason: string | null;
        candidates: string | null;
      }
    | undefined;

  if (!row) return null;

  try {
    return {
      inputHash: row.inputHash,
      classifierVersion: row.classifierVersion,
      category: row.category as Category,
      tags: JSON.parse(row.tags) as Category[],
      confidence: row.confidence,
      source: row.source,
      reason: row.reason,
      candidates: row.candidates ? (JSON.parse(row.candidates) as CategoryCandidate[]) : null,
    };
  } catch {
    return null;
  }
}

/** Upsert a cache entry. */
export function setCached(row: WriteCacheRow): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO category_cache (
       input_hash, classifier_version, category, tags, confidence, source, reason, candidates, cached_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(input_hash) DO UPDATE SET
       classifier_version = excluded.classifier_version,
       category = excluded.category,
       tags = excluded.tags,
       confidence = excluded.confidence,
       source = excluded.source,
       reason = excluded.reason,
       candidates = excluded.candidates,
       cached_at = datetime('now')`,
  ).run(
    row.inputHash,
    CLASSIFIER_VERSION,
    row.category,
    JSON.stringify(row.tags),
    row.confidence,
    row.source,
    row.reason ?? null,
    row.candidates ? JSON.stringify(row.candidates) : null,
  );
}

/** Drop all rows written by an older classifier version. Used by --reset-cache. */
export function purgeStaleVersions(): number {
  const db = getDatabase();
  const result = db
    .prepare('DELETE FROM category_cache WHERE classifier_version != ?')
    .run(CLASSIFIER_VERSION);
  return Number(result.changes ?? 0);
}
