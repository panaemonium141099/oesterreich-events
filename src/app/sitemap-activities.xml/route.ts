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
 *  - Zweisprachig PRO POI (fn-17): ein POI mit `description_en` liefert
 *    DE- UND /en-URL samt xhtml:link-Alternates, ohne Uebersetzung
 *    bleibt es bei der DE-URL allein. Dieselbe Regel wie bei Events
 *    ueber `title_en` — nie zwei URLs mit identischem deutschem Text.
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
  /** fn-17: gesetzt = POI wird zweisprachig gelistet. */
  description_en: string | null;
  images: unknown;
  opening_times: unknown;
  updated_at: string | null;
}

export async function GET(): Promise<NextResponse> {
  const entries: SitemapEntry[] = [];
  const now = new Date();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fail loudly (Review-Finding R3): NIE eine stillschweigend truncierte
  // Sitemap mit 200 ausliefern — bei 5xx behaelt Google die letzte
  // bekannte Version, eine kurze Datei wuerde URLs "entfernen".
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '[sitemap-activities] Missing Supabase env vars — refusing to serve empty sitemap. ' +
      `url_set=${!!supabaseUrl} key_set=${!!supabaseKey}`,
    );
    return new NextResponse('sitemap temporarily unavailable', { status: 500 });
  }

  {
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const PAGE = 1000;
      let offset = 0;
      while (entries.length < MAX_ACTIVITIES) {
        const { data, error } = await supabase
          .from('poi_activities')
          .select('slug, description, description_en, images, opening_times, updated_at')
          // Anzeige-Bedingung (Basistabelle, Service-Role): beide explizit.
          .eq('visible', true)
          .eq('is_closed', false)
          .order('id', { ascending: true })
          .range(offset, offset + PAGE - 1);

        if (error) {
          // Kein break: eine mitten in der Pagination abgebrochene Datei
          // waere eine stillschweigend unvollstaendige Sitemap.
          console.error('[sitemap-activities] query failed:', error.message);
          return new NextResponse('sitemap temporarily unavailable', { status: 500 });
        }
        if (!data || data.length === 0) break;

        for (const row of data as unknown as ActivitySitemapRow[]) {
          // Ein uebersetzter POI belegt ZWEI Plaetze — beide muessen unter
          // den Cap passen, sonst stuende ein halbes hreflang-Paar drin.
          const slots = row.description_en ? 2 : 1;
          if (entries.length + slots > MAX_ACTIVITIES) break;
          // Noindex-Gate (E7): Thin-POIs kommen NICHT in die Sitemap.
          if (!isActivityIndexable(row)) continue;

          const path = `/aktivitaet/${row.slug}`;
          const lastmod = row.updated_at ? toISO(row.updated_at) : toISO(now);

          if (row.description_en) {
            const alternates = [
              { hreflang: 'de-AT', href: `${BASE_URL}${path}` },
              { hreflang: 'en', href: `${BASE_URL}/en${path}` },
              { hreflang: 'x-default', href: `${BASE_URL}${path}` },
            ];
            entries.push({ loc: `${BASE_URL}${path}`, lastmod, changefreq: 'weekly', priority: 0.6, alternates });
            entries.push({ loc: `${BASE_URL}/en${path}`, lastmod, changefreq: 'weekly', priority: 0.5, alternates });
          } else {
            entries.push({ loc: `${BASE_URL}${path}`, lastmod, changefreq: 'weekly', priority: 0.6 });
          }
        }

        if (data.length < PAGE) break; // last page
        offset += PAGE;
      }
    } catch (err) {
      console.error('[sitemap-activities] pagination failed:', err);
      return new NextResponse('sitemap temporarily unavailable', { status: 500 });
    }
  }

  return new NextResponse(renderUrlset(entries), {
    headers: sitemapResponseHeaders(entries.length),
  });
}
