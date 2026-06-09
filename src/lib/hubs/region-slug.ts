/**
 * Region-name → image-filename slug. MUST stay in sync with the slugify in
 * tmp/fetch-images.mjs (the one-off that downloaded public/images/regions/*.jpg),
 * otherwise the derived <img src> won't match the files on disk.
 *
 * Note: only LOWERCASE umlauts are digraph-expanded (ä→ae); capital umlauts
 * (Ö in "Ötztal") fall through to NFD-stripping → "otztal". Deliberate — that's
 * exactly what produced the filenames.
 */
export function regionSlug(name: string): string {
  const u: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
  let s = name;
  for (const [k, v] of Object.entries(u)) s = s.split(k).join(v);
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Background photo for a Bundesland tile/banner. */
export function blImg(blId: string): string {
  return `/images/regions/${blId}.jpg`;
}

/** Thumbnail photo for a region row inside the hybrid sheet. */
export function regionImg(blId: string, regionName: string): string {
  return `/images/regions/${blId}-${regionSlug(regionName)}.jpg`;
}
