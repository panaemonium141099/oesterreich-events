import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { patchSource } from '../../../scripts/patch-next-static-search-nav.mjs';

const require = createRequire(import.meta.url);
const nextDir = dirname(require.resolve('next/package.json'));
const files = [
  'dist/esm/client/components/segment-cache/navigation.js',
  'dist/client/components/segment-cache/navigation.js',
].map((f) => join(nextDir, f));

/** Die gepatchte canonicalUrl-Berechnung als aufrufbare Funktion. */
function patchedCanonical(): (route: { canonicalUrl: string; renderedSearch: string }, url: URL) => string {
  const res = patchSource(readFileSync(files[0], 'utf8'));
  expect(res).not.toBeNull();
  const src: string = res!.src;
  const start = src.indexOf('const canonicalUrl = (function');
  const end = src.indexOf('const renderedSearch = route.renderedSearch;', start);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('route', 'url', `${src.slice(start, end)}\nreturn canonicalUrl;`) as never;
}

describe('patch-next-static-search-nav', () => {
  it('findet das Muster in der installierten Next-Version (beide Bundles)', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const res = patchSource(src);
      expect(res, f).not.toBeNull();
      // idempotent
      expect(patchSource(res!.src)).toEqual({ src: res!.src, changed: false });
    }
  });

  it('Link auf /entdecken verlässt ?saison=herbst (Prod-Befund)', () => {
    const canonical = patchedCanonical();
    const route = { canonicalUrl: '/entdecken?saison=herbst', renderedSearch: '' };
    expect(canonical(route, new URL('https://lasstreffen.at/entdecken'))).toBe('/entdecken');
    expect(canonical(route, new URL('https://lasstreffen.at/entdecken?search=bier'))).toBe('/entdecken?search=bier');
  });

  it('lässt query-abhängige Routen und Weiterleitungen auf andere Pfade unberührt', () => {
    const canonical = patchedCanonical();
    expect(canonical({ canonicalUrl: '/a?x=1', renderedSearch: '?x=1' }, new URL('https://h/a'))).toBe('/a?x=1');
    expect(canonical({ canonicalUrl: '/ziel?y=2', renderedSearch: '' }, new URL('https://h/start'))).toBe('/ziel?y=2');
    expect(canonical({ canonicalUrl: '/a', renderedSearch: '' }, new URL('https://h/a#top'))).toBe('/a#top');
  });
});
