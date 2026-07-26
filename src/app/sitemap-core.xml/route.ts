/**
 * /sitemap-core.xml — Kind-Sitemap des Index-Splits (fn-18, Epic E12):
 * Statische Seiten, Blog (/blog + ALL_POSTS), Landing-Hubs
 * (Bundesland × Kategorie × Zeit), Studenten, Themen-Hubs,
 * Gemeinde-Hubs und Venues.
 *
 * Die Sektionen 1–6 sind 1:1 aus dem frueheren Single-File-
 * src/app/sitemap.xml/route.ts hierher verschoben — inklusive der
 * fn-17 xhtml:link-Alternates fuer Seiten mit echter EN-Version
 * (volle URL- UND Metadaten-Paritaet, Task-Spec).
 *
 * Why a manual Route Handler instead of Next.js `sitemap.ts` +
 * `generateSitemaps()`:
 * - We hit a production bug where chunked sitemaps returned empty
 *   `<urlset>` even though the local invocation produced 5000 URLs per
 *   chunk. The Next.js metadata-sitemap routing + `force-dynamic`
 *   combination misbehaves here.
 * - A Route Handler gives us deterministic output: the XML we write is
 *   exactly what Google/Bing see.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ALL_POSTS } from '@/content/blog';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import {
  CATEGORY_SLUGS,
  STUDENT_CITIES,
  STUDENT_FILTERS,
} from '@/lib/landing-slugs';
import {
  SITEMAP_BASE_URL as BASE_URL,
  renderUrlset,
  sitemapResponseHeaders,
  toISO,
  type SitemapEntry,
} from '@/lib/seo/sitemap-xml';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/**
 * Harter Guard fuer die E12-Invariante "jede Kind-Datei <50k URLs":
 * der Core-Bestand ist heute ~7k statische/Hub-URLs + Venues (die
 * Venue-Query liefert via PostgREST-Default ohnehin max. 1000 Rows) —
 * weit unter dem Limit. Sollte der Bestand je darueber wachsen, wird
 * laut mit 500 gefailt statt eine >50k-Sitemap auszuliefern (dann:
 * weitere Kind-Sitemap abspalten).
 */
const MAX_CORE_URLS = 45000;

export async function GET(): Promise<NextResponse> {
  const entries: SitemapEntry[] = [];
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  // ─── 1. Static top-level pages ──────────────────────────────────────────
  // fn-17: Für Seiten mit echter EN-Version (lokalisierte Chrome + Metadata)
  // werden DE- UND EN-URL gelistet, jeweils mit hreflang-Alternates.
  // Event-/Landing-URLs bleiben DE-only, bis übersetzter Content existiert.
  const i18nAlternates = (path: string) => [
    { hreflang: 'de-AT', href: `${BASE_URL}${path}` },
    { hreflang: 'en', href: `${BASE_URL}/en${path}` },
    { hreflang: 'x-default', href: `${BASE_URL}${path}` },
  ];
  entries.push(
    { loc: BASE_URL, lastmod: toISO(now), changefreq: 'daily', priority: 1.0, alternates: i18nAlternates('') },
    { loc: `${BASE_URL}/en`, lastmod: toISO(now), changefreq: 'daily', priority: 0.9, alternates: i18nAlternates('') },
    { loc: `${BASE_URL}/map`, lastmod: toISO(now), changefreq: 'daily', priority: 0.8, alternates: i18nAlternates('/map') },
    { loc: `${BASE_URL}/en/map`, lastmod: toISO(now), changefreq: 'daily', priority: 0.7, alternates: i18nAlternates('/map') },
    { loc: `${BASE_URL}/blog`, lastmod: toISO(now), changefreq: 'weekly', priority: 0.8 },
    { loc: `${BASE_URL}/ueber-uns`, lastmod: toISO(now), changefreq: 'monthly', priority: 0.7 },
    { loc: `${BASE_URL}/quellen`, lastmod: toISO(now), changefreq: 'monthly', priority: 0.4 },
    { loc: `${BASE_URL}/impressum`, lastmod: toISO(now), changefreq: 'yearly', priority: 0.3 },
    { loc: `${BASE_URL}/datenschutz`, lastmod: toISO(now), changefreq: 'yearly', priority: 0.3 },
    { loc: `${BASE_URL}/agb`, lastmod: toISO(now), changefreq: 'yearly', priority: 0.3 },
  );

  // ─── 2. Blog posts ──────────────────────────────────────────────────────
  for (const post of ALL_POSTS) {
    entries.push({
      loc: `${BASE_URL}/blog/${post.slug}`,
      lastmod: toISO(post.updatedDate ?? post.publishDate),
      changefreq: 'monthly',
      priority: 0.7,
    });
  }

  // ─── 3. Landing pages: Bundesland × Category × Time ─────────────────────
  const bundeslaender = BUNDESLAENDER.filter((b) => b.id !== 'all');
  const categorySlugs = [...CATEGORY_SLUGS.keys()];
  const timeFilters = ['heute', 'wochenende'];

  for (const bl of bundeslaender) {
    entries.push({ loc: `${BASE_URL}/${bl.id}`, lastmod: toISO(now), changefreq: 'daily', priority: 0.8 });
    for (const tf of timeFilters) {
      entries.push({ loc: `${BASE_URL}/${bl.id}/${tf}`, lastmod: toISO(now), changefreq: 'daily', priority: 0.7 });
    }
    for (const cs of categorySlugs) {
      entries.push({ loc: `${BASE_URL}/${bl.id}/${cs}`, lastmod: toISO(now), changefreq: 'daily', priority: 0.7 });
      for (const tf of timeFilters) {
        entries.push({ loc: `${BASE_URL}/${bl.id}/${cs}/${tf}`, lastmod: toISO(now), changefreq: 'daily', priority: 0.6 });
      }
    }
  }

  // ─── 4. Stadt pages — RETIRED ───────────────────────────────────────────
  // The old /stadt/{city} hubs now 301-redirect into the /gemeinde system
  // (see next.config.ts). The 5 city hubs live as /gemeinde/{plz}-{city} and
  // are emitted in section 5b below, elevated to priority 0.8.

  // ─── 5. Student pages ───────────────────────────────────────────────────
  entries.push({ loc: `${BASE_URL}/studenten`, lastmod: toISO(now), changefreq: 'daily', priority: 0.8 });
  for (const sc of STUDENT_CITIES) {
    entries.push({ loc: `${BASE_URL}/studenten/${sc.slug}`, lastmod: toISO(now), changefreq: 'daily', priority: 0.8 });
    for (const sf of STUDENT_FILTERS) {
      entries.push({ loc: `${BASE_URL}/studenten/${sc.slug}/${sf}`, lastmod: toISO(now), changefreq: 'daily', priority: 0.7 });
    }
  }

  // ─── 5a. Theme hubs (Phase 3) ───────────────────────────────────────────
  // 12 Austria-wide category hubs (`/thema/musik`, `/thema/kultur`, …).
  // High priority — each hub aggregates thousands of events and is a
  // top-level conceptual landing for the category's core search intent.
  try {
    const { ALL_THEMES } = await import('@/lib/themes/data');
    for (const t of ALL_THEMES) {
      entries.push({
        loc: `${BASE_URL}/thema/${t.slug}`,
        lastmod: toISO(now),
        changefreq: 'daily',
        priority: 0.85,
      });
    }
  } catch (err) {
    // Fail loudly (Review-Finding R3): keine stillschweigend
    // unvollstaendige Sitemap mit 200 ausliefern.
    console.error('[sitemap-core] theme import failed:', err);
    return new NextResponse('sitemap temporarily unavailable', { status: 500 });
  }

  // ─── 5b. Gemeinde hubs (Phase 2) ────────────────────────────────────────
  // ~2 028 URLs, one per registered Austrian municipality. Each hub
  // page renders events inside a 10 km radius around the village centre.
  // Lower priority than city/bundesland hubs because the content density
  // per gemeinde is variable (many tiny villages have only a handful of
  // events). Google still gets them all in the index via ISR when the
  // page has ≥3 events; thin ones are noindex'd at the page level.
  try {
    const { ALL_GEMEINDEN } = await import('@/lib/gemeinden/data');
    const { isCityHub } = await import('@/lib/hubs/city-hubs');
    for (const g of ALL_GEMEINDEN) {
      // The 5 major-city hubs (Linz/Graz/Salzburg/Innsbruck/Klagenfurt) carry
      // the retired /stadt URLs' priority (0.8); villages stay at 0.5.
      entries.push({
        loc: `${BASE_URL}/gemeinde/${g.slug}`,
        lastmod: toISO(now),
        changefreq: 'daily',
        priority: isCityHub(g.slug) ? 0.8 : 0.5,
      });
    }
  } catch (err) {
    console.error('[sitemap-core] gemeinde import failed:', err);
    return new NextResponse('sitemap temporarily unavailable', { status: 500 });
  }

  // ─── 6. Venue pages (require Supabase) ──────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fail loudly (Review-Finding R3): fehlende Env/DB-Fehler duerfen keine
  // stillschweigend unvollstaendige Sitemap mit 200 produzieren — bei 5xx
  // behaelt Google die letzte bekannte Version.
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '[sitemap-core] Missing Supabase env vars — refusing to serve partial sitemap. ' +
      `url_set=${!!supabaseUrl} key_set=${!!supabaseKey}`,
    );
    return new NextResponse('sitemap temporarily unavailable', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Venue pages — unique venue_ids that have upcoming published events
  try {
    const { data: activeVenueIds, error: venueError } = await supabase
      .from('events')
      .select('venue_id')
      .eq('publish_status', 'published')
      .gte('start_date', today)
      .gte('quality_score', 40)
      .not('venue_id', 'is', null);

    if (venueError) {
      console.error('[sitemap-core] venue query failed:', venueError.message);
      return new NextResponse('sitemap temporarily unavailable', { status: 500 });
    }

    const uniqueVenueIds = [...new Set(
      (activeVenueIds ?? [])
        .map((e: { venue_id: string | null }) => e.venue_id)
        .filter((v): v is string => Boolean(v)),
    )];

    for (const vid of uniqueVenueIds) {
      entries.push({
        loc: `${BASE_URL}/venues/${vid}`,
        lastmod: toISO(now),
        changefreq: 'daily',
        priority: 0.6,
      });
    }
  } catch (err) {
    console.error('[sitemap-core] venue query failed:', err);
    return new NextResponse('sitemap temporarily unavailable', { status: 500 });
  }

  // E12-Invariante hart durchsetzen: lieber laut failen als eine
  // >50k-Sitemap ausliefern (dann weitere Kind-Sitemap abspalten).
  if (entries.length > MAX_CORE_URLS) {
    console.error(
      `[sitemap-core] ${entries.length} URLs > MAX_CORE_URLS (${MAX_CORE_URLS}) — ` +
      'refusing to serve oversized sitemap; split out another child sitemap.',
    );
    return new NextResponse('sitemap temporarily unavailable', { status: 500 });
  }

  return new NextResponse(renderUrlset(entries), {
    headers: sitemapResponseHeaders(entries.length),
  });
}
