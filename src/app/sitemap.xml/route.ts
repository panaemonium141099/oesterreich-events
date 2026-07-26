/**
 * /sitemap.xml — Sitemap-INDEX (fn-18 Task 3, Epic E12).
 *
 * Vorher: eine Single-File-Sitemap mit allen ~45k URLs. Jetzt ein
 * <sitemapindex> auf drei Kind-Sitemaps (jede <50k URLs):
 *   - /sitemap-core.xml       Statisch/Hubs/Themen/Studenten/Venues + Blog
 *   - /sitemap-events.xml     Event-Detailseiten (inkl. MAX_EVENTS-Cap
 *                             und fn-17-hreflang-Alternates)
 *   - /sitemap-activities.xml Freizeitaktivitaeten (nur indexierbare,
 *                             DE-only — Epic E7/E13)
 *
 * Volle URL-Paritaet: JEDE Sektion der alten Single-File-Sitemap lebt
 * unveraendert in genau einer Kind-Sitemap (Code 1:1 verschoben, inkl.
 * xhtml:link-Alternates). robots.txt zeigt weiter auf /sitemap.xml;
 * nach dem Deploy die Sitemap in der GSC neu einreichen.
 *
 * Warum weiterhin manuelle Route Handler statt Next.js `sitemap.ts` +
 * `generateSitemaps()`: siehe Historie in sitemap-core.xml/route.ts —
 * die Metadata-Sitemap-Route lieferte in Produktion leere <urlset>s.
 */

import { NextResponse } from 'next/server';
import {
  SITEMAP_BASE_URL,
  renderSitemapIndex,
  sitemapResponseHeaders,
  toISO,
} from '@/lib/seo/sitemap-xml';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(): Promise<NextResponse> {
  const lastmod = toISO(new Date());
  const body = renderSitemapIndex([
    { loc: `${SITEMAP_BASE_URL}/sitemap-core.xml`, lastmod },
    { loc: `${SITEMAP_BASE_URL}/sitemap-events.xml`, lastmod },
    { loc: `${SITEMAP_BASE_URL}/sitemap-activities.xml`, lastmod },
  ]);

  return new NextResponse(body, { headers: sitemapResponseHeaders(3) });
}
