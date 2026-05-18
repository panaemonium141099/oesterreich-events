/**
 * Use the Wikipedia REST API to find a real image for each remaining festival.
 *
 * Strategy per slug: try a series of search terms (festival name, city name)
 * against the German + English Wikipedia REST API `summary` endpoint, which
 * returns `originalimage.source` if the page has one. The first hit that has
 * an image wins.
 *
 * Outputs: data/festival-wiki-api-images.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OV = resolve(process.cwd(), 'data/festival-overrides.json');
const LIST = resolve(process.cwd(), 'data/festivals-missing-lineup.json');
const OUT = resolve(process.cwd(), 'data/festival-wiki-api-images.json');

const overrides = JSON.parse(readFileSync(OV, 'utf8')) as Record<string, { imageUrl?: string }>;
const list = JSON.parse(readFileSync(LIST, 'utf8')) as Array<{ slug: string; name: string; city: string; state: string }>;

const missing = list.filter(f => !overrides[f.slug]?.imageUrl);
console.log(`Looking up ${missing.length} festivals via Wikipedia API`);

const UA = 'lasstreffen.at/1.0 (festival-image-lookup; contact@lasstreffen.at)';
const TIMEOUT_MS = 8_000;

async function tryWiki(lang: string, title: string): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json() as { originalimage?: { source?: string }; thumbnail?: { source?: string } };
    return data.originalimage?.source ?? data.thumbnail?.source ?? null;
  } catch {
    clearTimeout(t);
    return null;
  }
}

async function findImage(name: string, city: string, state: string): Promise<{ url: string | null; via: string }> {
  // Try variants
  const candidates: { term: string; label: string }[] = [
    { term: name, label: `name (de)` },
    { term: name + ' (Festival)', label: 'name+Festival (de)' },
    { term: name + ' (Salzburg)', label: 'name+state (de)' },
    { term: city, label: 'city (de)' },
  ];
  for (const c of candidates) {
    if (!c.term || c.term === 'verschiedene Orte' || c.term.includes('verschiedene')) continue;
    for (const lang of ['de', 'en']) {
      const url = await tryWiki(lang, c.term);
      if (url) return { url, via: `${lang}:${c.label}` };
    }
  }
  return { url: null, via: 'none' };
}

async function main() {
  const results: Record<string, { url: string | null; via: string }> = {};
  let cursor = 0;
  async function worker() {
    while (cursor < missing.length) {
      const i = cursor++;
      const f = missing[i];
      const r = await findImage(f.name, f.city, f.state);
      results[f.slug] = r;
      console.log(`  [${r.url ? 'OK ' : 'BAD'}] ${f.slug} (${r.via}) ${r.url ?? ''}`);
    }
  }
  await Promise.all(Array.from({ length: 5 }, () => worker()));

  writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
  const ok = Object.values(results).filter(r => r.url).length;
  console.log('');
  console.log(`Found: ${ok}/${missing.length}`);
}
main();
