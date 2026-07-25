/**
 * /sitemap-activities.xml — Kind-Sitemap des Index-Splits (fn-18,
 * Epic E12): Freizeitaktivitaeten (/aktivitaet/[slug]).
 *
 * Regeln:
 *  - NUR indexierbare POIs (Noindex-Gate E7 via isActivityIndexable:
 *    Beschreibung >= 200 Zeichen ODER Bild + Oeffnungszeiten) — die
 *    Sitemap darf keine noindex-URLs anbieten.
 *  - Basistabelle via Service-Role -> visible=true UND is_closed=false
 *    EXPLIZIT filtern (Anzeige-Bedingung; dauerhaft geschlossene POIs
 *    rendern zwar, sind aber noindex und gehoeren nicht hierher).
 *  - DE-only (Epic E13): keine /en-URLs, keine xhtml:link-Alternates,
 *    solange keine EN-Uebersetzung der Aktivitaetsinhalte existiert.
 *  - 1000er-Batches (PostgREST-Limit), harter Cap < 50k URLs.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isActivityIndexable } from '@/lib/activities/indexability';
import {
  SITEMAP_BASE_URL as BASE_URL,
  renderUrlset,
  sitemapResponseHeaders,
  toISO,
  type SitemapEntry,
} from '@/lib/seo/sitemap-xml';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/** Google-Hard-Limit 50k; Headroom wie bei den Events. */
const MAX_ACTIVITIES = 45000;

interface ActivitySitemapRow {
  slug: string;
  description: string | null;
  images: unknown;
  opening_times: unknown;
  updated_at: string | null;
}

export async function GET(): Promise<NextResponse> {
  const entries: SitemapEntry[] = [];
  const now = new Date();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const PAGE = 1000;
      let offset = 0;
      while (entries.length < MAX_ACTIVITIES) {
        const { data, error } = await supabase
          .from('poi_activities')
          .select('slug, description, images, opening_times, updated_at')
          // Anzeige-Bedingung (Basistabelle, Service-Role): beide explizit.
          .eq('visible', true)
          .eq('is_closed', false)
          .order('id', { ascending: true })
          .range(offset, offset + PAGE - 1);

        if (error) {
          console.error('[sitemap-activities] query failed:', error.message);
          break;
        }
        if (!data || data.length === 0) break;

        for (const row of data as unknown as ActivitySitemapRow[]) {
          if (entries.length >= MAX_ACTIVITIES) break;
          // Noindex-Gate (E7): Thin-POIs kommen NICHT in die Sitemap.
          if (!isActivityIndexable(row)) continue;
          entries.push({
            loc: `${BASE_URL}/aktivitaet/${row.slug}`,
            lastmod: row.updated_at ? toISO(row.updated_at) : toISO(now),
            changefreq: 'weekly',
            priority: 0.6,
          });
        }

        if (data.length < PAGE) break; // last page
        offset += PAGE;
      }
    } catch (err) {
      console.error('[sitemap-activities] pagination failed:', err);
    }
  } else {
    console.error(
      '[sitemap-activities] Missing Supabase env vars — activity sitemap entries skipped. ' +
      `url_set=${!!supabaseUrl} key_set=${!!supabaseKey}`,
    );
  }

  return new NextResponse(renderUrlset(entries), {
    headers: sitemapResponseHeaders(entries.length),
  });
}
