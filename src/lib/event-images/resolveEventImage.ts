import { normalizeEventCategory, getCategoryMeta, bundeslandToRegionKey } from './categoryMeta';

/** Simple deterministic hash for varied image selection. */
function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Lightweight check whether a URL string looks like a usable image candidate.
 * No network requests — just filters out obvious garbage.
 */
export function isUsableImageCandidate(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('data:')) return false;
  if (trimmed === 'null' || trimmed === 'undefined') return false;
  // Must look like a URL
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) return false;
  return true;
}

/**
 * Get a category-specific local fallback image.
 *
 * If the event's bundesland maps to a regional pool (`bgld` for
 * Burgenland/NÖ — pannonian landscapes, `wien` for Vienna — urban), the
 * resolver uses that pool so a Burgenland event never shows an alpine
 * mountain photo. Falls back to the alpine default when no region matches
 * or no regional pool is configured for the category.
 */
export function resolveCategoryFallbackImage(
  category: string | null | undefined,
  seed?: string,
  bundesland?: string | null,
): string {
  const meta = getCategoryMeta(category);
  let slug = meta.fallbackSlug;
  let count = Math.max(1, meta.imageCount);

  const region = bundeslandToRegionKey(bundesland);
  if (region && meta.regions?.[region]) {
    slug = meta.regions[region]!.slug;
    count = Math.max(1, meta.regions[region]!.imageCount);
  }

  const variant = seed ? (simpleHash(seed) % count) + 1 : 1;
  return `/images/categories/${slug}-${variant}.jpg`;
}

/**
 * Generic fallback — used when even the category fallback fails.
 */
export function resolveGenericFallbackImage(): string {
  return '/images/categories/default-1.jpg';
}

/**
 * Primary resolver: returns the best available image URL for an event.
 *
 * Priority:
 * 1. event's own image_url (if it passes the usability check)
 * 2. category + region specific fallback (bundesland-aware)
 */
/**
 * SEO-Bilder-Fix (2026-09-01): Google zeigt dank max-image-preview:large
 * GROSSE Thumbnails aus dem Seiten-/Schema-Bild — gescrapte Mini-Bilder
 * (Stichprobe: 222×222) wirken hochskaliert verpixelt und kosten CTR.
 * Bilder unterhalb dieser Breite (per probe-image-widths.ts vermessen,
 * events.image_width) werden deshalb durch die großen lokalen
 * Kategorie-/Region-Fallbacks ersetzt statt hochskaliert.
 * image_width null/-1 = (noch) nicht vermessen → Original behalten.
 */
export const MIN_TRUSTED_EVENT_IMAGE_WIDTH = 600;

/**
 * Inserate (source_id `inserat:<submission-id>`, gebaut in
 * src/lib/inserate/approve.ts) tragen das Bild, das der Veranstalter selbst
 * eingereicht und freigegeben bekommen hat. Das ersetzen wir nie durch ein
 * Stockfoto, auch wenn es kleiner als MIN_TRUSTED_EVENT_IMAGE_WIDTH ist:
 * sonst sieht der Inserent in der Liste sein Bild und auf der Detailseite
 * ein fremdes (Photo & Adventure 2026, 300 px Logo, 2026-09-25).
 */
export function isInseratSourceId(sourceId: string | null | undefined): boolean {
  return typeof sourceId === 'string' && sourceId.startsWith('inserat:');
}

export function resolvePrimaryEventImage(opts: {
  imageUrl?: string | null;
  category?: string | null;
  title?: string | null;
  bundesland?: string | null;
  /** Gemessene Breite aus events.image_width (null/-1 = unbekannt). */
  imageWidth?: number | null;
  /** events.source_id; Inserate sind von der Mindestbreite ausgenommen. */
  sourceId?: string | null;
}): string {
  // imageWidth === 0 heisst "geprueft und dauerhaft nicht abrufbar"
  // (probe-image-widths.ts, IMAGE_DEAD). Vorher gab es dafuer keinen eigenen
  // Wert: Probe-Fehler landeten wie unvermessene Bilder auf -1, und weil -1
  // als "unbekannt" gilt, wurde eine tote URL weiter ausgeliefert und stand
  // als kaputtes Bild in der Karte. null/-1 bleiben "noch nicht vermessen"
  // und behalten das Original.
  const isDead = opts.imageWidth === 0;
  const tooSmall =
    !isInseratSourceId(opts.sourceId) &&
    opts.imageWidth != null &&
    opts.imageWidth > 0 &&
    opts.imageWidth < MIN_TRUSTED_EVENT_IMAGE_WIDTH;
  if (!isDead && !tooSmall && isUsableImageCandidate(opts.imageUrl)) {
    return opts.imageUrl!.trim();
  }
  return resolveCategoryFallbackImage(opts.category, opts.title ?? undefined, opts.bundesland);
}
