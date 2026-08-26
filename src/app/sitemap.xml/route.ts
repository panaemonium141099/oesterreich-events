/**
 * /sitemap.xml — Sitemap-INDEX (fn-18 Task 3, Epic E12).
 *
 * Vorher: eine Single-File-Sitemap mit allen ~45k URLs. Jetzt ein
 * <sitemapindex> auf Kind-Sitemaps (jede <50k URLs):
 *   - /sitemap-core.xml           Statisch/Hubs/Themen/Studenten/Venues + Blog
 *   - /sitemap-events*.xml        Event-Detailseiten, gesharded ueber den
 *                                 uuid-Raum (2026-08-26, alle ~82k Events
 *                                 statt der frueheren 15k-Cap-Auswahl;
 *                                 Begruendung: sitemap-events-shard.ts)
 *   - /sitemap-activities.xml     Freizeitaktivitaeten (nur indexierbare,
 *                                 DE-only — Epic E7/E13)
 *
 * robots.txt zeigt weiter auf /sitemap.xml; neue Kind-Sitemaps werden
 * von Google ueber diesen Index entdeckt (keine Neueinreichung noetig).
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
import {
  SITEMAP_EVENTS_SHARD_COUNT,
  sitemapEventsShardPath,
} from '@/lib/seo/sitemap-events-shard';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(): Promise<NextResponse> {
  const lastmod = toISO(new Date());
  const sitemaps = [
    { loc: `${SITEMAP_BASE_URL}/sitemap-core.xml`, lastmod },
    ...Array.from({ length: SITEMAP_EVENTS_SHARD_COUNT }, (_, shard) => ({
      loc: `${SITEMAP_BASE_URL}${sitemapEventsShardPath(shard)}`,
      lastmod,
    })),
    { loc: `${SITEMAP_BASE_URL}/sitemap-activities.xml`, lastmod },
  ];
  const body = renderSitemapIndex(sitemaps);

  return new NextResponse(body, { headers: sitemapResponseHeaders(sitemaps.length) });
}
