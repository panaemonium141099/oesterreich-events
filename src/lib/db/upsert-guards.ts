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
 *   - new empty/whitespace                                    → keep existing
 *   - existing empty/whitespace                               → write new
 *   - existing is unenriched (oldVersion null) AND new differs → write new
 *     (re-sync from the same scraper source IS the source of truth — when
 *     a TVB corrects/shortens the text in their CMS the next hourly Feratel
 *     pull must propagate the change, even if it's shorter than the old text.)
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
  // Re-sync from the same scraper source: when the old text was never
  // enriched (oldVersion null), the scraper IS authoritative — any change
  // from the source must propagate, regardless of length direction.
  if (!oldVersion && trimmedNew !== trimmedOld) return true;
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
 * Preis-Gruppe: `price_text`, `price_min` und `price_max` stammen aus
 * DERSELBEN Quellbeobachtung und müssen gemeinsam aktualisiert werden.
 *
 * Vorher galt: `price_text` nur füllen, wenn die Spalte leer ist — nie
 * überschreiben, weil "das Enrichment-Skript besitzt Preisverfeinerungen".
 * Das KI-Enrichment ist seit 2026-07 entfernt (MASTERPLAN §6), die
 * numerischen Preise wurden aber weiterhin bei jedem Upsert neu
 * geschrieben. Ergebnis: der Text fror auf der ersten Beobachtung ein,
 * während die Zahlen weiterliefen.
 *
 * Am Prod-Bestand gemessen (2026-09-06): **875 veröffentlichte künftige
 * Events** zeigten einen `price_text`, der den gespeicherten `price_min`
 * nicht nennt — 805 davon aus dem Eventim-Feed, wo sich Preise real
 * ändern. Beispiele: Text "20,50 €" bei min/max 26,50; Text
 * "31,99 € – 101,99 €" bei min 29,79 / max 93,96. Der Nutzer sieht einen
 * Preis, der Ticketlink führt zu einem anderen.
 *
 * Regel jetzt:
 *   - neuer Text leer/Whitespace                → alten behalten
 *   - alter Text leer                           → neuen schreiben
 *   - numerischer Preis hat sich geändert       → neuen Text schreiben
 *     (die alte Beobachtung ist überholt; Text und Zahl ziehen zusammen um)
 *   - sonst                                     → alten behalten
 *
 * Whitespace-Handling: ein Scraper, der `'   '` liefert, gilt als
 * "kein Preis" und kann weder einen bestehenden Preis verdrängen noch
 * eine leere Spalte mit Leerzeichen füllen.
 */
export function shouldOverwritePrice(
  newPrice: string | null,
  oldPrice: string | null,
  newMin?: number | null,
  oldMin?: number | null,
  newMax?: number | null,
  oldMax?: number | null,
): boolean {
  const trimmedNew = newPrice?.trim() ?? '';
  if (!trimmedNew) return false;
  const trimmedOld = oldPrice?.trim() ?? '';
  if (!trimmedOld) return true;
  if (numericPriceChanged(newMin, oldMin) || numericPriceChanged(newMax, oldMax)) return true;
  return false;
}

/**
 * Hat sich ein numerischer Preis belegbar geändert?
 *
 * `undefined`/`null` auf der NEUEN Seite heisst "die Quelle sagt diesmal
 * nichts dazu" — das ist keine Änderung, sondern eine Lücke, und darf den
 * Text nicht umschreiben. Vergleich mit Cent-Toleranz gegen
 * Float-Rundung (29.79 aus dem Feed vs. 29.790000000000003).
 */
function numericPriceChanged(
  next: number | null | undefined,
  prev: number | null | undefined,
): boolean {
  if (next == null) return false;
  if (prev == null) return true;
  return Math.abs(next - prev) >= 0.005;
}
