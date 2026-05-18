/**
 * Merge data/festival-images-batch8.json (Wikipedia Commons fallback images)
 * into data/festival-overrides.json. Only writes URLs that resolve to a real
 * image (validated via HTTP GET + content-type check).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OV = resolve(process.cwd(), 'data/festival-overrides.json');
const BATCH = resolve(process.cwd(), 'data/festival-images-batch8.json');

const overrides = JSON.parse(readFileSync(OV, 'utf8')) as Record<string, unknown>;
const batch = JSON.parse(readFileSync(BATCH, 'utf8')) as Record<string, { imageUrl: string }>;

const TIMEOUT_MS = 10_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function check(url: string): Promise<boolean> {
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
  let applied = 0, failed = 0;
  const fails: string[] = [];
  for (const [slug, info] of Object.entries(batch)) {
    if (!info?.imageUrl) continue;
    const ok = await check(info.imageUrl);
    if (ok) {
      const cur = (overrides[slug] as Record<string, unknown>) ?? {};
      cur.imageUrl = info.imageUrl;
      overrides[slug] = cur;
      applied++;
      console.log(`  [OK]  ${slug}`);
    } else {
      failed++;
      fails.push(slug);
      console.log(`  [BAD] ${slug} → ${info.imageUrl}`);
    }
  }
  writeFileSync(OV, JSON.stringify(overrides, null, 2) + '\n');
  console.log('');
  console.log(`Applied: ${applied}`);
  console.log(`Failed:  ${failed}`);
  if (fails.length) console.log(`Failed slugs: ${fails.join(', ')}`);
}
main();
