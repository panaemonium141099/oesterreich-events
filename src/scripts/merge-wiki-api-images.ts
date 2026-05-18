/**
 * Filter Wikipedia API results to drop district maps/flags/bezirk thumbnails
 * (they look terrible as hero images), and merge only real venue/festival
 * photos into festival-overrides.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OV = resolve(process.cwd(), 'data/festival-overrides.json');
const SRC = resolve(process.cwd(), 'data/festival-wiki-api-images.json');

const overrides = JSON.parse(readFileSync(OV, 'utf8')) as Record<string, { imageUrl?: string }>;
const src = JSON.parse(readFileSync(SRC, 'utf8')) as Record<string, { url: string | null; via: string }>;

// Patterns indicating district maps, flags, or generic Bezirk thumbnails —
// not usable as hero images.
const REJECT = [
  /Karte_/i,
  /im_Bezirk/i,
  /im_BL/i,
  /Flag_of/i,
  /langde-/,  // German-language localized map asset
];

function isUsable(url: string): boolean {
  return !REJECT.some(re => re.test(url));
}

let applied = 0, rejected = 0;
for (const [slug, info] of Object.entries(src)) {
  if (!info.url) continue;
  if (!isUsable(info.url)) {
    rejected++;
    console.log(`  [rej] ${slug}`);
    continue;
  }
  const cur = (overrides[slug] as Record<string, unknown>) ?? {};
  cur.imageUrl = info.url;
  overrides[slug] = cur as { imageUrl?: string };
  applied++;
  console.log(`  [OK ] ${slug} → ${info.url}`);
}

writeFileSync(OV, JSON.stringify(overrides, null, 2) + '\n');
console.log('');
console.log(`Applied: ${applied}`);
console.log(`Rejected: ${rejected}`);
