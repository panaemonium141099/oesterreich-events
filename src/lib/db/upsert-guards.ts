/**
 * UPSERT-Guard predicates (fn-14.5).
 *
 * Decide whether incoming scrape values should overwrite the existing
 * row's image / description / price columns. Extracted from
 * `supabase-sync.ts` so the predicates have a single home — both the
 * production mapper (`toSupabaseRow`) and the unit tests import from
 * here, eliminating drift between the two.
 *
 * Why these are predicates (not inline branches in the mapper): same
 * rules also need to run inside the Claude/OpenAI enrichment write
 * path. Keeping them pure + standalone makes that reuse trivial.
 */

/**
 * Image upgrade rule:
 *   - existing has no URL                       → write new
 *   - same URL                                  → write new only when
 *                                                 we now know dims and
 *                                                 existing didn't
 *   - existing width unknown                    → write new
 *   - new width >= existing width               → write new
 *   - otherwise                                 → keep existing
 */
export function shouldUpgradeImage(
  newUrl: string | null,
  newWidth: number | null,
  oldUrl: string | null,
  oldWidth: number | null,
): boolean {
  if (!newUrl) return false;
  if (!oldUrl) return true;
  if (newUrl === oldUrl) {
    // Same URL — only worth re-writing when we now have dims and
    // existing didn't (the dims piggy-back on the URL field).
    return oldWidth == null && newWidth != null;
  }
  if (oldWidth == null) return true;
  if (newWidth != null && newWidth >= oldWidth) return true;
  return false;
}

/**
 * Description upgrade rule:
 *   - existing empty                                          → write new
 *   - new is meaningfully longer (>20%)                       → write new
 *   - existing not 'claude-v1' AND new comes from claude-v1   → write new (upgrade path)
 *   - otherwise                                               → keep existing
 *
 * `newVersion` is the enrichment_version we're about to attach. For raw
 * scraper writes we pass null/undefined — the function falls through to
 * the length comparison only.
 */
export function shouldOverwriteDescription(
  newDesc: string | null,
  oldDesc: string | null,
  newVersion: string | null | undefined,
  oldVersion: string | null,
): boolean {
  if (!newDesc) return false;
  if (!oldDesc || !oldDesc.trim()) return true;
  if (newDesc.length > oldDesc.length * 1.2) return true;
  if (newVersion === 'claude-v1' && oldVersion !== 'claude-v1') {
    return true;
  }
  return false;
}

/**
 * Price-text upgrade rule: only fill when existing is empty. Once a
 * price is on the row we never clobber it from raw scrape data; the
 * enrichment script owns price refinements via its own bulk RPC.
 */
export function shouldOverwritePrice(
  newPrice: string | null,
  oldPrice: string | null,
): boolean {
  if (!newPrice) return false;
  if (!oldPrice || !oldPrice.trim()) return true;
  return false;
}
