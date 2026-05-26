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
 * Image upgrade rule (URL only):
 *   - existing has no URL                       → write new
 *   - same URL                                  → write new only when
 *                                                 we now know any dim
 *                                                 the existing row
 *                                                 didn't (width OR
 *                                                 height)
 *   - validatedUpgrade=true (HEAD-validated CDN
 *     allowlist upgrade)                        → write new even when
 *                                                 new dims unknown,
 *                                                 because the URL was
 *                                                 verified to deliver
 *                                                 a higher-res variant
 *                                                 of the same asset
 *                                                 (e.g. WordPress
 *                                                 strip-suffix where
 *                                                 the original lacks
 *                                                 dim hints in URL)
 *   - existing width unknown                    → write new
 *   - new width >= existing width               → write new
 *   - otherwise                                 → keep existing
 *
 * Width and height are evaluated INDEPENDENTLY for the persisted
 * value (see `pickFinalImageWidth` / `pickFinalImageHeight` below) so
 * a wider new image with unknown height never clobbers a known
 * height, and the same URL can backfill a missing height when only
 * width was previously known.
 */
export function shouldUpgradeImage(
  newUrl: string | null,
  newWidth: number | null,
  newHeight: number | null,
  oldUrl: string | null,
  oldWidth: number | null,
  oldHeight: number | null,
  validatedUpgrade: boolean = false,
): boolean {
  if (!newUrl) return false;
  if (!oldUrl) return true;
  if (newUrl === oldUrl) {
    // Same URL — write back when we've discovered any dim that was
    // missing before (covers both "width was known, now we know height
    // too" and the symmetric height-first case).
    if (oldWidth == null && newWidth != null) return true;
    if (oldHeight == null && newHeight != null) return true;
    return false;
  }
  // Validated CDN upgrades win even with unknown new dims — the URL
  // was HEAD-checked and the allowlist guarantees a higher-res asset
  // (e.g. WordPress `photo-400x300.jpg` → `photo.jpg`, where the
  // original loses its size suffix).
  if (validatedUpgrade) return true;
  if (oldWidth == null) return true;
  if (newWidth != null && newWidth >= oldWidth) return true;
  return false;
}

/**
 * Pick which width to persist.
 *
 * - **URL changing** (we're writing a new image_url): use the new
 *   width if known, otherwise NULL. Never fall back to the old
 *   width — it described the previous image, and stamping it on
 *   a different URL produces impossible metadata like
 *   `large.jpg + width=400` when the old was `small.jpg, 400×300`.
 *   The downstream renderer can either re-measure or fall back to
 *   intrinsic sizing.
 * - **URL unchanged**: a freshly-discovered width backfills a
 *   missing column. Otherwise the existing value is preserved.
 */
export function pickFinalImageWidth(
  upgradingUrl: boolean,
  newWidth: number | null,
  oldWidth: number | null,
): number | null {
  if (upgradingUrl) {
    return newWidth ?? null;
  }
  // URL unchanged or rejected — backfill missing existing width when
  // new width is known; otherwise leave the existing value alone.
  if (oldWidth == null && newWidth != null) return newWidth;
  return oldWidth ?? null;
}

/** Symmetric helper for height — see `pickFinalImageWidth`. */
export function pickFinalImageHeight(
  upgradingUrl: boolean,
  newHeight: number | null,
  oldHeight: number | null,
): number | null {
  if (upgradingUrl) {
    return newHeight ?? null;
  }
  if (oldHeight == null && newHeight != null) return newHeight;
  return oldHeight ?? null;
}

/**
 * Description upgrade rule:
 *   - existing empty/whitespace                               → write new
 *   - new is meaningfully longer (>20% by trimmed length)     → write new
 *   - existing not 'claude-v1' AND new comes from claude-v1   → write new (upgrade path)
 *   - otherwise                                               → keep existing
 *
 * `newVersion` is the enrichment_version we're about to attach. For raw
 * scraper writes we pass null/undefined — the function falls through to
 * the length comparison only.
 *
 * Whitespace handling: both inputs are evaluated by trimmed length so
 * a scraper emitting `'   '` cannot win the 20%-longer rule against
 * an existing real description, and cannot overwrite an empty column.
 */
export function shouldOverwriteDescription(
  newDesc: string | null,
  oldDesc: string | null,
  newVersion: string | null | undefined,
  oldVersion: string | null,
): boolean {
  const trimmedNew = newDesc?.trim() ?? '';
  if (!trimmedNew) return false;
  const trimmedOld = oldDesc?.trim() ?? '';
  if (!trimmedOld) return true;
  if (trimmedNew.length > trimmedOld.length * 1.2) return true;
  if (newVersion === 'claude-v1' && oldVersion !== 'claude-v1') {
    return true;
  }
  return false;
}

/**
 * Address upgrade rule:
 *   - new is null/whitespace                        → keep existing (don't NULL it out)
 *   - existing empty/whitespace                     → write new
 *   - both present                                  → write new
 *     (a hourly Feratel re-sync MAY update street; if the detail-extract
 *      enrichment has refined it earlier, the next detail-fetch run
 *      will re-apply within an hour anyway)
 *
 * This is the "don't NULL on missing" rule for `address` — a listing-only
 * re-scrape that doesn't carry a street anymore must NOT erase an address
 * that an earlier detail-fetch / enrichment had populated.
 */
export function shouldOverwriteAddress(
  newAddr: string | null | undefined,
  oldAddr: string | null | undefined,
): boolean {
  const trimmedNew = newAddr?.trim() ?? '';
  if (!trimmedNew) return false;
  return true;
}

/**
 * Price-text upgrade rule: only fill when existing is empty. Once a
 * price is on the row we never clobber it from raw scrape data; the
 * enrichment script owns price refinements via its own bulk RPC.
 *
 * Whitespace handling: a scraper emitting `'   '` is treated as
 * absent and cannot displace either an existing price or an empty
 * column — the latter would persist whitespace and confuse later
 * "is this column empty?" checks.
 */
export function shouldOverwritePrice(
  newPrice: string | null,
  oldPrice: string | null,
): boolean {
  const trimmedNew = newPrice?.trim() ?? '';
  if (!trimmedNew) return false;
  const trimmedOld = oldPrice?.trim() ?? '';
  if (!trimmedOld) return true;
  return false;
}
