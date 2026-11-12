import { describe, it, expect } from 'vitest';
import { extractFacts, diffSnapshots } from '@/scripts/seo-vergleich';

// Feste Beispielseite; die Domain ist hier Testdatum, keine Konfiguration.
const HOST = 'https://example.test';
const HTML = `<html><head>
<link rel="canonical" href="${HOST}/wien"/>
<link rel="alternate" hreflang="en" href="${HOST}/en/wien"/>
<link rel="alternate" hreflang="de-AT" href="${HOST}/wien"/>
<meta name="robots" content="index, follow"/>
<meta property="og:url" content="${HOST}/wien"/>
<meta property="og:locale" content="de_AT"/>
<script type="application/ld+json">{"@type":"WebSite","dateModified":"2026-11-12T10:00:00Z"}</script>
</head></html>`;

describe('seo-vergleich', () => {
  it('liest Canonical, hreflang, robots, OpenGraph und JSON-LD', () => {
    const f = extractFacts(200, HTML, false);
    expect(f.canonical).toBe(`${HOST}/wien`);
    expect(f.hreflang).toEqual([`de-AT ${HOST}/wien`, `en ${HOST}/en/wien`]);
    expect(f.robots).toBe('index, follow');
    expect(f.ogUrl).toBe(`${HOST}/wien`);
    expect(f.ogLocale).toBe('de_AT');
    expect(f.jsonLd).toEqual(['{"@type":"WebSite","dateModified":""}']);
  });

  it('gleiche Seiten ergeben keine Abweichung, Zeitstempel zählen nicht', () => {
    const a = { '/wien': extractFacts(200, HTML, false) };
    const b = { '/wien': extractFacts(200, HTML.replace('10:00:00', '11:30:00'), false) };
    expect(diffSnapshots(a, b)).toEqual([]);
  });

  it('ein anderer Canonical und eine fehlende Seite fallen auf', () => {
    const a = { '/wien': extractFacts(200, HTML, false), '/graz': extractFacts(200, HTML, false) };
    const changed = HTML.replace(`rel="canonical" href="${HOST}/wien"`, 'rel="canonical" href="https://other.test/wien"');
    const diff = diffSnapshots(a, { '/wien': extractFacts(200, changed, false) });
    expect(diff.some(l => l.startsWith('/wien: canonical'))).toBe(true);
    expect(diff.some(l => l.startsWith('/graz: nur vorher'))).toBe(true);
  });

  it('Sitemaps vergleichen Hosts und hreflang, nicht den wechselnden Bestand', () => {
    const map = (path: string, host = HOST, lang = 'de-AT') =>
      `<urlset><url><loc>${host}/${path}</loc><xhtml:link rel="alternate" hreflang="${lang}" href="${host}/${path}"/></url></urlset>`;
    const x = extractFacts(200, map('a'), true);
    expect(diffSnapshots({ s: x }, { s: extractFacts(200, map('b'), true) })).toEqual([]);
    expect(diffSnapshots({ s: x }, { s: extractFacts(200, map('a', 'https://other.test'), true) })).toHaveLength(1);
    expect(diffSnapshots({ s: x }, { s: extractFacts(200, map('a', HOST, 'de-DE'), true) })).toHaveLength(1);
  });

  it('robots.txt und der Sitemap-Index bleiben wörtlich, ohne lastmod', () => {
    const x = extractFacts(200, `<sitemapindex><sitemap><loc>${HOST}/a.xml</loc><lastmod>2026-11-12</lastmod></sitemap></sitemapindex>`, true);
    const y = extractFacts(200, `<sitemapindex><sitemap><loc>${HOST}/a.xml</loc><lastmod>2026-11-13</lastmod></sitemap></sitemapindex>`, true);
    expect(diffSnapshots({ s: x }, { s: y })).toEqual([]);
  });
});
