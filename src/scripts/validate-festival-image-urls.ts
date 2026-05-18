/**
 * Validate image URLs in data/festival-overrides.json by performing a HEAD
 * (falling back to GET with Range: bytes=0-0) for each.
 *
 * Why: many subagent-supplied URLs were marked "spekulativ" — guessed from
 * common CMS path patterns. We need to know which actually resolve to an
 * image before shipping them as overrides.
 *
 * Outputs:
 *   data/festival-image-validation.json  per-slug { url, status, contentType, ok }
 *   stderr summary by status code.
 *
 * Usage: npx tsx src/scripts/validate-festival-image-urls.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OVERRIDES_PATH = resolve(process.cwd(), 'data/festival-overrides.json');
const OUTPUT_PATH = resolve(process.cwd(), 'data/festival-image-validation.json');

interface Override {
  imageUrl?: string | null;
  description?: string | null;
  priceText?: string | null;
}

const data = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8')) as Record<string, Override | string>;

const TIMEOUT_MS = 8_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

interface Result {
  slug: string;
  url: string;
  status: number;
  contentType: string | null;
  ok: boolean;
  error?: string;
}

async function check(slug: string, url: string): Promise<Result> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // Try GET with Range to avoid downloading the whole image; many servers
    // refuse HEAD or return 405 for it.
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Range: 'bytes=0-1023', Accept: 'image/*,*/*;q=0.8' },
    });
    clearTimeout(t);
    const ct = res.headers.get('content-type');
    const ok = res.ok && !!ct && /image\/|application\/octet|svg/i.test(ct);
    return { slug, url, status: res.status, contentType: ct, ok };
  } catch (err) {
    clearTimeout(t);
    return { slug, url, status: 0, contentType: null, ok: false, error: (err as Error).message };
  }
}

async function main() {
  const entries: { slug: string; url: string }[] = [];
  for (const [slug, ov] of Object.entries(data)) {
    if (slug.startsWith('_')) continue;
    if (!ov || typeof ov !== 'object') continue;
    const url = (ov as Override).imageUrl;
    if (typeof url === 'string' && url.startsWith('http')) {
      entries.push({ slug, url });
    }
  }

  console.log(`Validating ${entries.length} image URLs (concurrency 10)...`);

  // Pool of 10 concurrent checks
  const results: Result[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < entries.length) {
      const i = cursor++;
      const { slug, url } = entries[i];
      const r = await check(slug, url);
      results.push(r);
      const tag = r.ok ? 'OK ' : 'BAD';
      console.log(`  [${tag}] ${r.status} ${slug} ${r.contentType ?? r.error ?? ''}`);
    }
  }
  await Promise.all(Array.from({ length: 10 }, () => worker()));

  results.sort((a, b) => a.slug.localeCompare(b.slug));
  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2) + '\n');

  const ok = results.filter(r => r.ok);
  const bad = results.filter(r => !r.ok);
  console.log('');
  console.log(`OK:  ${ok.length}`);
  console.log(`BAD: ${bad.length}`);
  if (bad.length) {
    console.log('');
    console.log('Failing URLs:');
    for (const r of bad) console.log(`  ${r.slug} → ${r.status} ${r.url}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
