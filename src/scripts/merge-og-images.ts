/**
 * Merge data/festival-og-images.json into data/festival-overrides.json:
 *   - For each slug, if og-images says ogValid=true → use ogImage as override
 *   - For each slug, if og-images says ogValid=false → clear imageUrl (set null)
 *     so runtime can attempt fresh enrichment on each request
 *   - Skip slugs not in og-images (those validated as already-working stay as-is)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OVERRIDES_PATH = resolve(process.cwd(), 'data/festival-overrides.json');
const OG_PATH = resolve(process.cwd(), 'data/festival-og-images.json');

const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8')) as Record<string, unknown>;
const og = JSON.parse(readFileSync(OG_PATH, 'utf8')) as Record<string, { ogImage: string | null; ogValid: boolean }>;

let updated = 0, cleared = 0;
for (const [slug, info] of Object.entries(og)) {
  const cur = overrides[slug] as Record<string, unknown> | undefined;
  if (!cur || typeof cur !== 'object') continue;
  if (info.ogValid && info.ogImage) {
    cur.imageUrl = info.ogImage;
    updated++;
  } else {
    // Clear so runtime gets a chance — and if runtime also fails, the
    // category-placeholder fallback kicks in.
    delete cur.imageUrl;
    cleared++;
  }
}

writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2) + '\n');
console.log(`Updated imageUrl for ${updated} slugs from valid og:image`);
console.log(`Cleared broken imageUrl for ${cleared} slugs (runtime/fallback will handle)`);
