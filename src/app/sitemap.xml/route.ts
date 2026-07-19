/**
 * Single-file XML sitemap for lasstreffen.at.
 *
 * Why a manual Route Handler instead of Next.js `sitemap.ts` + `generateSitemaps()`:
 * - We hit a production bug where chunked sitemaps returned empty `<urlset>` even
 *   though the local invocation produced 5000 URLs per chunk. The Next.js
 *   metadata-sitemap routing + `force-dynamic` combination misbehaves here.
 * - A Route Handler gives us deterministic output: the XML we write is exactly
 *   what Google/Bing see. No hidden chunk indirection, no magic id serialization.
 *
 * Strategy:
 * - One `/sitemap.xml` with up to ~45k URLs (Google's hard limit is 50k URLs /
 *   50MB per sitemap; at ~200 bytes/entry 45k ≈ 9MB — comfortably inside).
 * - Order: static → blog → landing → student → venues → events ranked by
 *   quality_score desc, so Google's crawl budget hits the best events first.
 * - 300s cache + stale-while-revalidate so scrapers can re-fetch cheaply.
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
import { buildEventUrlV2 } from '@/lib/utils/slugify';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const BASE_URL = 'https://lasstreffen.at';

/** Google's hard limit is 50k URLs; we leave headroom for non-event URLs. */
const MAX_EVENTS = 45000;

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  /** fn-17: hreflang-Alternates (nur für Seiten mit echter EN-Version) */
  alternates?: ReadonlyArray<{ hreflang: string; href: string }>;
}

/** Minimal XML entity escape for loc URLs (ampersands in query strings, etc.). */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderEntry(e: SitemapEntry): string {
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

function toISO(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().split('T')[0];
}

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
    console.error('[sitemap] theme import failed:', err);
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
    console.error('[sitemap] gemeinde import failed:', err);
  }

  // ─── 6. Venue + 7. Event pages (require Supabase) ──────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Venue pages — unique venue_ids that have upcoming published events
    try {
      const { data: activeVenueIds } = await supabase
        .from('events')
        .select('venue_id')
        .eq('publish_status', 'published')
        .gte('start_date', today)
        .gte('quality_score', 40)
        .not('venue_id', 'is', null);

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
      console.error('[sitemap] venue query failed:', err);
    }

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
          console.error('[sitemap] event query failed:', error.message);
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
      console.error('[sitemap] event pagination failed:', err);
    }
  } else {
    console.error(
      '[sitemap] Missing Supabase env vars — venue + event sitemap entries skipped. ' +
      `url_set=${!!supabaseUrl} key_set=${!!supabaseKey}`,
    );
  }

  // ─── Render XML ─────────────────────────────────────────────────────────
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map(renderEntry),
    '</urlset>',
  ].join('\n');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      'X-Sitemap-Entries': String(entries.length),
    },
  });
}
