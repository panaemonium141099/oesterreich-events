/**
 * Feature-Matrix (fn-31): was eine Seite nicht ausspielt, antwortet 404 und
 * steht in keiner Navigation und keiner Sitemap. lasstreffen.at hat alles an.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { SITES, type SiteFeature } from '@/lib/site/sites';
import { FEATURE_PATHS, everythingEnabled, featureOfPath, isPathEnabled } from '@/lib/site/features';

const AT = SITES.AT;
const DE = SITES.DE;

/** Kern: immer an, auf jeder Seite. */
const KERN = [
  '/', '/entdecken', '/map', '/events/1010-wien/2026-12-01/x', '/gemeinde/1010-wien', '/wien',
  '/bayern', '/impressum', '/datenschutz', '/agb', '/quellen', '/bildnachweis', '/ueber-uns',
  '/api/events', '/api/events/map-points', '/api/search/semantic', '/api/health',
  '/api/cron/revalidate-landing', '/sitemap.xml', '/sitemap-core.xml', '/sitemap-events.xml', '/robots.txt',
];

describe('Pfad zu Säule', () => {
  it('der Kern gehört zu keiner Säule', () => {
    for (const p of KERN) expect([p, featureOfPath(p)]).toEqual([p, null]);
  });

  it('Präfixe gelten für den Pfad und alles darunter, nicht für Namensanfänge', () => {
    expect(featureOfPath('/blog')).toBe('blog');
    expect(featureOfPath('/blog/ein-post')).toBe('blog');
    expect(featureOfPath('/en/blog/ein-post')).toBe('blog');
    expect(featureOfPath('/blogger')).toBe(null);
    expect(featureOfPath('/plan')).toBe('social');
    expect(featureOfPath('/plans/abc')).toBe('social');
    expect(featureOfPath('/aktivitaet/x-123')).toBe('activities');
    expect(featureOfPath('/api/me/landing')).toBe('account');
    expect(featureOfPath('/api/events/featured')).toBe(null);
  });

  it('kein Präfix steht in zwei Säulen', () => {
    const all = Object.values(FEATURE_PATHS).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('jede Seitenroute unter src/app/[locale] ist Kern oder genau einer Säule zugeordnet', () => {
    const KERN_ROUTEN = new Set([
      '[bundesland]', 'agb', 'bildnachweis', 'datenschutz', 'entdecken', 'events', 'gemeinde',
      'impressum', 'map', 'quellen', 'ueber-uns', '@modal',
    ]);
    const dirs = readdirSync('src/app/[locale]', { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    const unzugeordnet = dirs.filter(d => !KERN_ROUTEN.has(d) && featureOfPath(`/${d}`) === null);
    expect(unzugeordnet).toEqual([]);
  });
});

describe('lasstreffen.at spielt alles aus', () => {
  it('jede Säule ist an, Englisch gibt es', () => {
    expect(everythingEnabled(AT)).toBe(true);
    for (const prefixes of Object.values(FEATURE_PATHS)) {
      for (const p of prefixes) {
        expect(isPathEnabled(p, AT)).toBe(true);
        expect(isPathEnabled(`/en${p}`, AT)).toBe(true);
      }
    }
    for (const p of KERN) expect(isPathEnabled(p, AT)).toBe(true);
  });
});

describe('lasstreffen.de startet mit dem Kern', () => {
  it('der Kern ist an', () => {
    expect(everythingEnabled(DE)).toBe(false);
    for (const p of KERN) expect([p, isPathEnabled(p, DE)]).toEqual([p, true]);
  });

  it('abgeschaltete Säulen sind aus, Seite und API', () => {
    const aus = (Object.keys(DE.features) as SiteFeature[]).filter(f => !DE.features[f]);
    expect(aus.length).toBeGreaterThan(0);
    for (const f of aus) for (const p of FEATURE_PATHS[f]) expect([p, isPathEnabled(p, DE)]).toEqual([p, false]);
  });

  it('kein /en', () => {
    expect(isPathEnabled('/en', DE)).toBe(false);
    expect(isPathEnabled('/en/entdecken', DE)).toBe(false);
    expect(isPathEnabled('/entdecken', DE)).toBe(true);
    // „/entdecken“ beginnt mit „/en“, ist aber kein Sprachpräfix.
    expect(featureOfPath('/entdecken')).toBe(null);
  });

  it('eine Säule umschalten ändert genau ihre Pfade', () => {
    const mitBlog = { ...DE, features: { ...DE.features, blog: true } };
    expect(isPathEnabled('/blog/x', mitBlog)).toBe(true);
    expect(isPathEnabled('/festivals', mitBlog)).toBe(false);
  });
});

describe('Navigation und Sitemap fragen die Matrix', () => {
  it('Top-Navigation, Tab-Leiste, Footer, Sitemap-Index, Kern-Sitemap und Middleware prüfen isPathEnabled', () => {
    for (const file of [
      'src/components/Layout/v4/V4TopNav.tsx',
      'src/components/Layout/v4/V4TabBar.tsx',
      'src/components/Legal/Footer.tsx',
      'src/app/sitemap.xml/route.ts',
      'src/app/sitemap-core.xml/route.ts',
      'src/middleware.ts',
    ]) {
      expect([file, /isPathEnabled\(/.test(readFileSync(file, 'utf8'))]).toEqual([file, true]);
    }
  });

  it('jeder Link der Navigation, der zu einer Säule gehört, ist auf .de aus oder Kern', () => {
    const src = ['src/components/Layout/v4/V4TopNav.tsx', 'src/components/Layout/v4/V4TabBar.tsx']
      .map(f => readFileSync(f, 'utf8'))
      .join('\n');
    const hrefs = [...src.matchAll(/href: '([^']+)'/g)].map(m => m[1]);
    expect(hrefs.length).toBeGreaterThan(5);
    const sichtbarAufDe = [...new Set(hrefs.filter(h => isPathEnabled(h, DE)))].sort();
    expect(sichtbarAufDe).toEqual(['/entdecken', '/map']);
  });
});
