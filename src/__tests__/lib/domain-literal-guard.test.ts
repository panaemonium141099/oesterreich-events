/**
 * Wächter: Domain, hreflang und Land der Seite stehen nur in src/lib/site/.
 *
 * Aus dieser Codebasis entstehen lasstreffen.at und lasstreffen.de (fn-31).
 * Eine fest eingetragene Domain, ein festes `de-AT` als hreflang oder ein
 * festes `addressCountry: 'AT'` wäre auf der jeweils anderen Seite falsch:
 * Canonical auf die fremde Domain, Sitemap mit fremden URLs.
 *
 * Der Altbestand außerhalb des SEO-Kerns steht in
 * `domain-literal-baseline.json`. Neue Fundstellen lässt der Wächter nicht
 * zu, erledigte müssen aus der Liste verschwinden (fn-31.4 baut sie ab).
 * Liste neu schreiben: `UPDATE_DOMAIN_BASELINE=1 npx vitest run <diese Datei>`.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { SITES } from '@/lib/site/sites';
import { bilingualAlternates, deOnlyAlternates } from '@/lib/seo/canonical';
import { SITEMAP_BASE_URL } from '@/lib/seo/sitemap-xml';
import { getSite } from '@/lib/site';
import robots from '@/app/robots';

const ROOTS = ['src/app', 'src/lib', 'src/components'];
const BASELINE_FILE = 'src/__tests__/lib/domain-literal-baseline.json';

/** Hier darf die Domain stehen: die Site selbst. */
const OWN = /^src\/lib\/site\//;

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'domain', re: /lasstreffen\.(at|de)/i },
  { name: 'hreflang', re: /hreflang:\s*['"]de-(AT|DE)['"]|['"]de-(AT|DE)['"]\s*:|inLanguage[^\n]*['"]de-(AT|DE)['"]|['"]de_(AT|DE)['"]/ },
  { name: 'addressCountry', re: /addressCountry['"]?\s*:\s*['"](AT|DE)['"]/ },
];

/** SEO-Kern (fn-31.3): diese Dateien sind fertig und dürfen nie in die Liste. */
const SEO_KERN = [
  'src/lib/seo/canonical.ts',
  'src/lib/seo/sitemap-xml.ts',
  'src/lib/seo/sitemap-events-shard.ts',
  'src/lib/seo/event-jsonld.ts',
  'src/app/robots.ts',
  'src/app/[locale]/layout.tsx',
  'src/app/sitemap-core.xml/route.ts',
  'src/app/sitemap-activities.xml/route.ts',
  'src/app/[locale]/events/[...slug]/page.tsx',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '__tests__') walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(p.split(sep).join('/'));
    }
  }
  return out;
}

/** Kommentarzeilen zählen nicht: sie erklären, sie spielen nichts aus. */
function codeLines(src: string): string[] {
  return src.split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line));
}

function scan(): Record<string, string[]> {
  const hits: Record<string, string[]> = {};
  for (const file of ROOTS.flatMap(r => walk(r))) {
    if (OWN.test(file)) continue;
    const lines = codeLines(readFileSync(file, 'utf8'));
    const kinds = PATTERNS.filter(p => lines.some(l => p.re.test(l))).map(p => p.name);
    if (kinds.length > 0) hits[file] = kinds;
  }
  return hits;
}

describe('Domain-Wächter (src/lib/site ist die einzige Stelle)', () => {
  const found = scan();

  if (process.env.UPDATE_DOMAIN_BASELINE === '1') {
    const sorted = Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE_FILE, JSON.stringify(sorted, null, 2) + '\n');
  }
  const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as Record<string, string[]>;

  it('keine neue Datei nennt Domain, hreflang oder Land als Literal', () => {
    const neu = Object.keys(found).filter(f => !(f in baseline));
    expect(neu).toEqual([]);
  });

  it('keine Datei der Liste bekommt eine weitere Art von Literal', () => {
    const mehr = Object.entries(found)
      .filter(([f, kinds]) => f in baseline && kinds.some(k => !baseline[f].includes(k)))
      .map(([f]) => f);
    expect(mehr).toEqual([]);
  });

  it('die Liste nennt nur Dateien, die noch ein Literal tragen', () => {
    const erledigt = Object.keys(baseline).filter(f => !(f in found));
    expect(erledigt).toEqual([]);
  });

  it('der SEO-Kern steht nicht in der Liste', () => {
    expect(SEO_KERN.filter(f => f in baseline || f in found)).toEqual([]);
  });
});

describe('Canonical-Wächter: keine URL zeigt auf die andere Seite', () => {
  const site = getSite();
  const fremd = Object.values(SITES).filter(s => s.country !== site.country).map(s => s.domain);

  it('Canonical, hreflang, Sitemap-Basis und robots nennen nur die eigene Domain', () => {
    const urls = [
      deOnlyAlternates('/wien').canonical,
      ...Object.values(bilingualAlternates('/events/x', 'de').languages),
      bilingualAlternates('/events/x', 'en').canonical,
      SITEMAP_BASE_URL,
      String(robots().sitemap),
    ];
    for (const url of urls) {
      expect(url.startsWith(site.url)).toBe(true);
      for (const d of fremd) expect(url).not.toContain(d);
    }
  });

  it('hreflang der deutschen Fassung ist der der Seite', () => {
    const languages = bilingualAlternates('/events/x', 'de').languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual([site.hreflang, 'en', 'x-default'].sort());
  });
});
