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

/** Google's hard limit is 50k URLs; we leave headroom (EN-ZweitURLs zaehlen mit). */
const MAX_EVENTS = 45000;

export async function GET(): Promise<NextResponse> {
  const entries: SitemapEntry[] = [];
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Events — paginate the PostgREST 1000-row default limit manually so we
    // can actually ship up to MAX_EVENTS rows. The old single-query version
    // silently capped at 1000 per chunk.
    try {
      const PAGE = 1000;
      let offset = 0;
      let eventsAdded = 0;
      // Hard loop bound: MAX_EVENTS / PAGE at most.
      while (eventsAdded < MAX_EVENTS) {
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
          console.error('[sitemap-events] event query failed:', error.message);
          break;
        }
        if (!data || data.length === 0) break;

        for (const event of data) {
          if (eventsAdded >= MAX_EVENTS) break;
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
          eventsAdded += 1;
        }

        if (data.length < PAGE) break; // last page
        offset += PAGE;
      }
    } catch (err) {
      console.error('[sitemap-events] event pagination failed:', err);
    }
  } else {
    console.error(
      '[sitemap-events] Missing Supabase env vars — event sitemap entries skipped. ' +
      `url_set=${!!supabaseUrl} key_set=${!!supabaseKey}`,
    );
  }

  return new NextResponse(renderUrlset(entries), {
    headers: sitemapResponseHeaders(entries.length),
  });
}
