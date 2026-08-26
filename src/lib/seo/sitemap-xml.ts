/**
 * Geteilte XML-Bausteine fuer den Sitemap-Index-Split (fn-18 Task 3,
 * Epic E12): /sitemap.xml ist ein <sitemapindex> auf die Kind-Routen
 * sitemap-core.xml / sitemap-events.xml / sitemap-activities.xml.
 *
 * Die Render-Helfer sind 1:1 aus dem frueheren Single-File-
 * src/app/sitemap.xml/route.ts uebernommen (xmlEscape/renderEntry/toISO),
 * damit die Kind-Sitemaps byte-identische <url>-Eintraege liefern —
 * volle Paritaet inkl. der xhtml:link-Alternates (fn-17 hreflang).
 */

export const SITEMAP_BASE_URL = 'https://lasstreffen.at';

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  /** fn-17: hreflang-Alternates (nur für Seiten mit echter EN-Version) */
  alternates?: ReadonlyArray<{ hreflang: string; href: string }>;
}

/** Minimal XML entity escape for loc URLs (ampersands in query strings, etc.). */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderEntry(e: SitemapEntry): string {
  const parts = [`  <url>`, `    <loc>${xmlEscape(e.loc)}</loc>`];
  if (e.alternates) {
    for (const alt of e.alternates) {
      parts.push(
        `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${xmlEscape(alt.href)}"/>`,
      );
    }
  }
  if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
  if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
  if (e.priority != null) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
  parts.push(`  </url>`);
  return parts.join('\n');
}

export function toISO(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().split('T')[0];
}

/** Komplettes <urlset>-Dokument (Kind-Sitemaps). */
export function renderUrlset(entries: SitemapEntry[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map(renderEntry),
    '</urlset>',
  ].join('\n');
}

/** Komplettes <sitemapindex>-Dokument (/sitemap.xml). */
export function renderSitemapIndex(
  sitemaps: Array<{ loc: string; lastmod?: string }>,
): string {
  const items = sitemaps.map((s) => {
    const parts = [`  <sitemap>`, `    <loc>${xmlEscape(s.loc)}</loc>`];
    if (s.lastmod) parts.push(`    <lastmod>${s.lastmod}</lastmod>`);
    parts.push(`  </sitemap>`);
    return parts.join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items,
    '</sitemapindex>',
  ].join('\n');
}

/** Einheitliche XML-Response-Header aller Sitemap-Routen. */
export function sitemapResponseHeaders(entryCount: number): Record<string, string> {
  return {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    'X-Sitemap-Entries': String(entryCount),
  };
}

/**
 * URL-Cap fuer /sitemap-events.xml. Zaehlt EMITTIERTE URLs (uebersetzte
 * Events liefern DE- UND /en-URL = 2 Eintraege), nicht Quell-Rows — sonst
 * koennte die Datei Googles 50k-Grenze sprengen (Review-Finding R2).
 *
 * Warum 15.000 und nicht mehr: Die Micro-Instanz braucht fuer diese Zeilen
 * Random-Heap-I/O, und die skaliert linear. Gemessen auf Prod (2026-08-26,
 * EXPLAIN ANALYZE, idx_events_sitemap_keyset_v2):
 *
 *   15.000 Zeilen ->  5,97 s  (18.299 Buffer)
 *   45.000 Zeilen -> 21,52 s  (61.967 Buffer)
 *
 * Mit 45.000 lief die Route ueber alle Keyset-Runden in den 500er-Zweig und
 * lieferte GAR NICHTS aus — der Zustand seit dem Sitemap-Split am 25.07.
 * 15.000 URLs nach quality_score DESC sind gegenueber null ein echter Gewinn
 * und liegen weit ueber dem, was Google bei ~6.400 Klicks/Monat crawlt.
 *
 * Bewusst hier statt in der Route: route.ts-Dateien vertragen keine freien
 * Exports (Next-Route-Segment-Validierung), und der Test soll gegen dieselbe
 * Konstante pruefen statt gegen eine kopierte Zahl.
 */
export const SITEMAP_EVENTS_MAX_URLS = 15000;
