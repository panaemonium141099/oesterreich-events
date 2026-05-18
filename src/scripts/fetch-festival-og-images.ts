/**
 * Visit each festival's homepage and extract a usable og:image.
 *
 * Reads the missing-lineup list, fetches each website, parses meta tags,
 * and writes a `slug → og:image` map. Used to backfill imageUrl overrides
 * where the subagent-supplied URL didn't resolve.
 *
 * Output: data/festival-og-images.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LIST_PATH = resolve(process.cwd(), 'data/festivals-missing-lineup.json');
const OUTPUT_PATH = resolve(process.cwd(), 'data/festival-og-images.json');
const VALIDATION_PATH = resolve(process.cwd(), 'data/festival-image-validation.json');

const TIMEOUT_MS = 12_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

interface ListEntry {
  slug: string;
  name: string;
  website: string;
  starts_at: string;
  city: string;
  state: string;
}

interface ValidationEntry {
  slug: string;
  url: string;
  ok: boolean;
}

const list = JSON.parse(readFileSync(LIST_PATH, 'utf8')) as ListEntry[];
const validation = JSON.parse(readFileSync(VALIDATION_PATH, 'utf8')) as ValidationEntry[];
const goodSlugs = new Set(validation.filter(v => v.ok).map(v => v.slug));

// Only chase festivals whose current override URL is failing OR missing.
const toFetch = list.filter(f => !goodSlugs.has(f.slug));
console.log(`Will fetch og:image for ${toFetch.length} festivals (skipping ${goodSlugs.size} that already work)`);

async function fetchOG(url: string): Promise<{ ogImage: string | null; ogImageAlt: string | null; description: string | null }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*' },
    });
    clearTimeout(t);
    if (!res.ok) return { ogImage: null, ogImageAlt: null, description: null };
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html')) return { ogImage: null, ogImageAlt: null, description: null };
    const html = await res.text();

    // Cheap regex-based meta extraction — we don't need cheerio here.
    function meta(prop: string): string | null {
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
      const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
      const m = html.match(re) || html.match(re2);
      return m?.[1] ?? null;
    }

    let ogImage = meta('og:image:secure_url') || meta('og:image') || meta('twitter:image');
    // Twitter:image:src is a common alias
    if (!ogImage) ogImage = meta('twitter:image:src');
    // Try first JSON-LD image
    if (!ogImage) {
      const ld = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i.exec(html);
      if (ld) {
        try {
          const obj = JSON.parse(ld[1].trim()) as { image?: unknown };
          if (typeof obj.image === 'string') ogImage = obj.image;
          else if (Array.isArray(obj.image) && typeof obj.image[0] === 'string') ogImage = obj.image[0];
        } catch { /* ignore */ }
      }
    }

    if (ogImage && !ogImage.startsWith('http')) {
      // resolve relative
      try { ogImage = new URL(ogImage, url).toString(); } catch { ogImage = null; }
    }

    const ogImageAlt = meta('og:image:alt');
    const description = meta('og:description') || meta('description');
    return { ogImage, ogImageAlt, description };
  } catch (err) {
    clearTimeout(t);
    return { ogImage: null, ogImageAlt: null, description: null };
  }
}

async function isImageReachable(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Range: 'bytes=0-1023', Accept: 'image/*,*/*;q=0.8' },
    });
    clearTimeout(t);
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') ?? '';
    return /image\/|application\/octet|svg/i.test(ct);
  } catch {
    return false;
  }
}

async function main() {
  const results: Record<string, { ogImage: string | null; description: string | null; ogValid: boolean }> = {};
  let cursor = 0;
  async function worker() {
    while (cursor < toFetch.length) {
      const i = cursor++;
      const fest = toFetch[i];
      const { ogImage, description } = await fetchOG(fest.website);
      let ogValid = false;
      if (ogImage) {
        ogValid = await isImageReachable(ogImage);
      }
      results[fest.slug] = { ogImage, description, ogValid };
      console.log(`  [${ogValid ? 'OK ' : 'BAD'}] ${fest.slug} ← ${ogImage ?? '(no og:image)'}`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));

  // Sort and write
  const sorted = Object.fromEntries(Object.entries(results).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2) + '\n');

  const found = Object.values(results).filter(r => r.ogValid).length;
  console.log('');
  console.log(`Festivals with valid og:image: ${found}/${toFetch.length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
