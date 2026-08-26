/**
 * Geteilter Handler fuer die Event-Sitemap-SHARDS (Befund 2026-08-26).
 *
 * Vorgeschichte: /sitemap-events.xml war nach dem Keyset-Fix auf
 * SITEMAP_EVENTS_MAX_URLS = 15.000 gecappt — nicht aus SEO-Gruenden,
 * sondern weil die Micro-Instanz mehr Zeilen nicht in EINEM Request
 * schafft (Random-Heap-I/O skaliert linear: 15k Zeilen ~6 s, 45k ~21,5 s).
 * Damit fehlten ~68.000 von ~82.600 sitemap-faehigen Events.
 *
 * Loesung: Aufteilung statt Vergroesserung. SHARD_COUNT Dateien, jede ein
 * eigener Request mit eigenem CDN-Cache (s-maxage=3600). Gesharded wird
 * ueber den uuid-Raum der Event-id — random uuids verteilen sich messbar
 * gleichmaessig (Prod 2026-08-26: 10.195-10.611 Zeilen pro Achtel).
 * Innerhalb eines Shards laeuft Keyset-Pagination ueber id ASC auf dem
 * Teilindex idx_events_sitemap_shard (id, WHERE published + qs>=40 +
 * start_date-Floor). EXPLAIN ANALYZE Prod: 426 ms je 1000er-Seite kalt,
 * ~11 Seiten pro Shard.
 *
 * Die fruehere quality_score-DESC-Sortierung entfaellt bewusst: sie
 * diente der AUSWAHL der besten 15k unter dem Cap. Ohne Cap ist nichts
 * mehr auszuwaehlen — die Prioritaet transportiert weiterhin das
 * <priority>-Attribut aus dem quality_score.
 *
 * Shard-Benennung: Shard 0 bleibt unter /sitemap-events.xml (der in der
 * GSC registrierte Pfad bleibt gueltig), Shards 1..N-1 liegen unter
 * /sitemap-events-2.xml .. /sitemap-events-N.xml.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import {
  SITEMAP_BASE_URL as BASE_URL,
  SITEMAP_URLSET_HARD_LIMIT,
  renderUrlset,
  sitemapResponseHeaders,
  toISO,
  type SitemapEntry,
} from '@/lib/seo/sitemap-xml';

/** Anzahl der Event-Sitemap-Dateien. 8 Achtel a ~10,3k Zeilen (Stand
 *  2026-08-26 bei 82,6k Events) lassen Headroom bis ~200k future events,
 *  bevor ein Shard Googles 50k-URL-Grenze beruehrt (uebersetzte Events
 *  emittieren 2 URLs). */
export const SITEMAP_EVENTS_SHARD_COUNT = 8;

/** Pfad eines Shards relativ zur Domain (siehe Benennungs-Kommentar oben). */
export function sitemapEventsShardPath(shard: number): string {
  return shard === 0 ? '/sitemap-events.xml' : `/sitemap-events-${shard + 1}.xml`;
}

/** uuid-Untergrenze von Shard k: erster Hex-Nibble = k*2 (bei 8 Shards). */
function shardLowerBound(shard: number): string {
  return `${(shard * 2).toString(16)}0000000-0000-0000-0000-000000000000`;
}

export async function buildEventsShardResponse(shard: number): Promise<NextResponse> {
  const entries: SitemapEntry[] = [];
  // Datums-LITERAL statt CURRENT_DATE: nur so kann der Planner beweisen,
  // dass die Bedingung das statische start_date-Praedikat des Teilindex
  // impliziert (siehe Migration idx_events_sitemap_keyset_v2).
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fail loudly (Review-Finding R3): NIE eine stillschweigend truncierte
  // Sitemap mit 200 ausliefern — Crawler wuerden fehlende URLs als
  // entfernt werten. Bei 5xx behaelt Google die letzte bekannte Version.
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      `[sitemap-events:${shard}] Missing Supabase env vars — refusing to serve empty sitemap. ` +
      `url_set=${!!supabaseUrl} key_set=${!!supabaseKey}`,
    );
    return new NextResponse('sitemap temporarily unavailable', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const PAGE = 1000;
    // Keyset ueber id ASC innerhalb der uuid-Range des Shards. Cursor ist
    // die zuletzt gelesene id; jede Zeile wird genau einmal gelesen.
    let cursor: string | null = null;
    // Harte Schleifengrenze als Backstop, falls der Cursor je stagniert.
    const MAX_PAGES = Math.ceil(SITEMAP_URLSET_HARD_LIMIT / PAGE) + 5;
    for (let page = 0; page < MAX_PAGES; page++) {
      let query = supabase
        .from('events')
        .select('id, slug, start_date, updated_at, quality_score, postal_code, address, bundesland, location_name, title_en')
        .gte('start_date', today)
        .eq('publish_status', 'published')
        .gte('quality_score', 40)
        .order('id', { ascending: true })
        .limit(PAGE);

      // Shard-Fenster im uuid-Raum; der Keyset-Cursor liest strikt nach
      // der zuletzt gelieferten Zeile weiter (beide Filter ANDen sich).
      query = query.gte('id', shardLowerBound(shard));
      if (cursor) query = query.gt('id', cursor);
      if (shard < SITEMAP_EVENTS_SHARD_COUNT - 1) {
        query = query.lt('id', shardLowerBound(shard + 1));
      }

      const { data, error } = await query;

      if (error) {
        // Kein break: eine mitten in der Pagination abgebrochene Datei
        // waere eine stillschweigend unvollstaendige Sitemap.
        console.error(`[sitemap-events:${shard}] event query failed:`, error.message);
        return new NextResponse('sitemap temporarily unavailable', { status: 500 });
      }
      if (!data || data.length === 0) break;

      for (const event of data) {
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

      // Ein Shard DARF Googles 50k-Grenze nicht reissen. Kein stiller Cap
      // (R3): wenn das je passiert, ist SITEMAP_EVENTS_SHARD_COUNT zu
      // erhoehen — bis dahin lieber laut scheitern.
      if (entries.length > SITEMAP_URLSET_HARD_LIMIT) {
        console.error(
          `[sitemap-events:${shard}] shard exceeds ${SITEMAP_URLSET_HARD_LIMIT} URLs — ` +
          'raise SITEMAP_EVENTS_SHARD_COUNT instead of truncating.',
        );
        return new NextResponse('sitemap temporarily unavailable', { status: 500 });
      }

      cursor = data[data.length - 1].id;
      if (data.length < PAGE) break; // last page
    }
  } catch (err) {
    console.error(`[sitemap-events:${shard}] event pagination failed:`, err);
    return new NextResponse('sitemap temporarily unavailable', { status: 500 });
  }

  return new NextResponse(renderUrlset(entries), {
    headers: sitemapResponseHeaders(entries.length),
  });
}
