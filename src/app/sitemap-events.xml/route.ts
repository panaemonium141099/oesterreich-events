/**
 * /sitemap-events.xml — Kind-Sitemap des Index-Splits (fn-18, Epic E12):
 * Event-Detailseiten, nach quality_score absteigend (Crawl-Budget trifft
 * die besten Events zuerst), hart gecappt auf MAX_EVENTS < 50k.
 *
 * Die Event-Logik (Sektion 7 des frueheren Single-File-sitemap.xml) ist
 * 1:1 hierher verschoben — inklusive der fn-17-Regel: Events mit
 * gecachter EN-Uebersetzung (title_en) bekommen die /en-URL als eigenen
 * Eintrag + xhtml:link-hreflang-Verknuepfung; unuebersetzte Events
 * bleiben DE-only (kein Duplicate-Content).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import {
  SITEMAP_BASE_URL as BASE_URL,
  renderUrlset,
  sitemapResponseHeaders,
  toISO,
  type SitemapEntry,
} from '@/lib/seo/sitemap-xml';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/** Google's hard limit is 50k URLs; we leave headroom. Cap zaehlt EMITTIERTE
 *  URLs (uebersetzte Events liefern DE- UND /en-URL = 2 Eintraege), nicht
 *  Quell-Rows — sonst koennte die Datei bei vielen title_en-Events die
 *  50k sprengen (Review-Finding R2). */
const MAX_URLS = 45000;

export async function GET(): Promise<NextResponse> {
  const entries: SitemapEntry[] = [];
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fail loudly (Review-Finding R3): NIE eine stillschweigend truncierte
  // Sitemap mit 200 ausliefern — Crawler wuerden fehlende URLs als
  // entfernt werten. Bei 5xx behaelt Google die letzte bekannte Version.
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '[sitemap-events] Missing Supabase env vars — refusing to serve empty sitemap. ' +
      `url_set=${!!supabaseUrl} key_set=${!!supabaseKey}`,
    );
    return new NextResponse('sitemap temporarily unavailable', { status: 500 });
  }

  {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Events — paginate the PostgREST 1000-row default limit manually so we
    // can actually ship up to MAX_URLS entries. The old single-query version
    // silently capped at 1000 per chunk.
    try {
      const PAGE = 1000;
      let offset = 0;
      let capReached = false;
      // Hard loop bound: MAX_URLS / PAGE at most.
      while (!capReached && entries.length < MAX_URLS) {
        const { data, error } = await supabase
          .from('events')
          .select('id, slug, start_date, updated_at, quality_score, postal_code, address, bundesland, location_name, title_en')
          .gte('start_date', today)
          .eq('publish_status', 'published')
          .gte('quality_score', 40)
          .order('quality_score', { ascending: false })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE - 1);

        if (error) {
          // Kein break: eine mitten in der Pagination abgebrochene Datei
          // waere eine stillschweigend unvollstaendige Sitemap.
          console.error('[sitemap-events] event query failed:', error.message);
          return new NextResponse('sitemap temporarily unavailable', { status: 500 });
        }
        if (!data || data.length === 0) break;

        for (const event of data) {
          // Uebersetzte Events emittieren 2 URLs — nur aufnehmen, wenn
          // BEIDE noch unter den Cap passen (nie ein halbes hreflang-Paar).
          const urlsForRow = event.title_en ? 2 : 1;
          if (entries.length + urlsForRow > MAX_URLS) {
            capReached = true;
            break;
          }
          const qs = event.quality_score ?? 0;
          const priority = qs >= 80 ? 0.8 : qs >= 60 ? 0.6 : 0.4;
          const path = buildEventUrlV2(event);
          const lastmod = event.updated_at ? toISO(event.updated_at) : toISO(now);
          // fn-17 Slice 3: Events mit gecachter EN-Übersetzung (title_en)
          // bekommen die /en-URL als eigenen Eintrag + hreflang-Verknüpfung.
          // Unübersetzte Events bleiben DE-only (kein Duplicate-Content).
          if (event.title_en) {
            const alternates = [
              { hreflang: 'de-AT', href: `${BASE_URL}${path}` },
              { hreflang: 'en', href: `${BASE_URL}/en${path}` },
              { hreflang: 'x-default', href: `${BASE_URL}${path}` },
            ];
            entries.push({ loc: `${BASE_URL}${path}`, lastmod, changefreq: 'daily', priority, alternates });
            entries.push({ loc: `${BASE_URL}/en${path}`, lastmod, changefreq: 'daily', priority: Math.max(0.4, priority - 0.2), alternates });
          } else {
            entries.push({ loc: `${BASE_URL}${path}`, lastmod, changefreq: 'daily', priority });
          }
        }

        if (data.length < PAGE) break; // last page
        offset += PAGE;
      }
    } catch (err) {
      console.error('[sitemap-events] event pagination failed:', err);
      return new NextResponse('sitemap temporarily unavailable', { status: 500 });
    }
  }

  return new NextResponse(renderUrlset(entries), {
    headers: sitemapResponseHeaders(entries.length),
  });
}
