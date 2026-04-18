/**
 * In-memory classifier cache.
 *
 * Previous versions used a SQLite `category_cache` table. The project is
 * standardising on Supabase for all persistent state, and the cache isn't
 * worth a Supabase round-trip per event (140k × 100ms reads would dominate
 * runtime). A per-process Map is sufficient because the only caller is the
 * batch script `src/scripts/categorize-events.ts`, where AI responses are
 * deduped within a single run — the operational win we actually need.
 *
 * Cache entries are namespaced by `CLASSIFIER_VERSION`, so a version bump
 * implicitly invalidates the whole Map without needing a delete pass.
 */

import type { Category, CategoryCandidate } from '@/types/events';
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

const store = new Map<string, CachedClassifierResult>();

export function getCached(inputHash: string): CachedClassifierResult | null {
  const hit = store.get(inputHash);
  if (!hit) return null;
  if (hit.classifierVersion !== CLASSIFIER_VERSION) return null;
  return hit;
}

export function setCached(row: WriteCacheRow): void {
  store.set(row.inputHash, {
    inputHash: row.inputHash,
    classifierVersion: CLASSIFIER_VERSION,
    category: row.category,
    tags: row.tags,
    confidence: row.confidence,
    source: row.source,
    reason: row.reason ?? null,
    candidates: row.candidates ?? null,
  });
}

/** Drop all entries that do not match the current version. */
export function purgeStaleVersions(): number {
  let removed = 0;
  for (const [key, v] of store.entries()) {
    if (v.classifierVersion !== CLASSIFIER_VERSION) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

/** Test helper — clear the entire cache. */
export function _resetCacheForTests(): void {
  store.clear();
}
