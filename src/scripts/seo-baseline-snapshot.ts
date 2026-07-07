#!/usr/bin/env npx tsx
/**
 * SEO Baseline Snapshot — captures the current state of our public surface
 * so we can measure the impact of every fn-13 phase against a fixed point.
 *
 * Writes two files on each run:
 *   1. data/seo-baseline/<YYYY-MM-DD>-baseline.json   (full snapshot)
 *   2. data/seo-baseline/snapshots/<ISO>.json         (append-only history)
 *
 * The very first run (the one we do NOW during phase 0) is the Baseline
 * that every future phase delta is measured against.
 *
 * Runs read-only against:
 *   - production sitemap (https://lasstreffen.at/sitemap.xml)
 *   - Supabase (events table counts, analytics_events table counts)
 *   - local keyword list (data/seo-baseline/keywords-tracking.json)
 *
 * Never mutates the DB. Safe to run repeatedly.
 *
 * Usage:
 *   npx tsx src/scripts/seo-baseline-snapshot.ts                # full snapshot
 *   npx tsx src/scripts/seo-baseline-snapshot.ts --no-sitemap   # skip sitemap fetch (for offline dev)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ─── Env loader (tsx does not auto-load .env.local) ───
try {
  const env = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  env.split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq > 0) {
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  });
} catch { /* noop */ }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are in .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lasstreffen.at';
const skipSitemap = process.argv.includes('--no-sitemap');

// ─── Types ───
interface Snapshot {
  _meta: {
    version: number;
    taken_at: string;
    site_url: string;
    script: string;
    epic: string;
  };
  sitemap: {
    fetched: boolean;
    url_count: number | null;
    partitions: Array<{ loc: string; url_count: number | null }>;
    fetched_at: string | null;
    error: string | null;
  };
  database: {
    events_total: number | null;
    events_future_published: number | null;
    events_with_coords: number | null;
    events_with_null_coords: number | null;
    events_by_source: Record<string, number>;
    events_by_category: Record<string, number>;
    events_by_bundesland: Record<string, number>;
    events_with_embeddings: number | null;
    events_enriched_v2: number | null;
  };
  internal_analytics: {
    events_last_30d: number | null;
    page_views_last_30d: number | null;
    unique_sessions_last_30d: number | null;
    top_referrers: Array<{ referrer: string; count: number }>;
    top_pages: Array<{ page: string; count: number }>;
    event_types: Record<string, number>;
  };
  indexable_url_inventory: {
    event_detail_pages: number | null;
    bundesland_hubs: number | null;
    category_hubs: number | null;
    city_hubs: number | null;
    student_hubs: number | null;
    blog_posts: number | null;
    static_pages: number | null;
    estimated_total: number | null;
  };
  // Intentionally empty for phase 0 — will be filled after GSC API integration
  search_console: {
    configured: boolean;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    avg_position: number | null;
    indexed_urls: number | null;
    note: string;
  };
}

// ─── Helpers ───
async function fetchSitemapCount(): Promise<Snapshot['sitemap']> {
  if (skipSitemap) {
    return { fetched: false, url_count: null, partitions: [], fetched_at: null, error: 'skipped via --no-sitemap' };
  }
  const result: Snapshot['sitemap'] = {
    fetched: false, url_count: 0, partitions: [], fetched_at: null, error: null,
  };
  try {
    const root = await fetch(`${SITE_URL}/sitemap.xml`, { cache: 'no-store' });
    if (!root.ok) throw new Error(`sitemap.xml HTTP ${root.status}`);
    const rootXml = await root.text();
    const partitionUrls = [...rootXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

    // Case A: root is a sitemap-index pointing at sub-sitemaps
    if (partitionUrls.length > 0 && rootXml.includes('<sitemapindex')) {
      for (const url of partitionUrls) {
        try {
          const part = await fetch(url, { cache: 'no-store' });
          const partXml = await part.text();
          const count = (partXml.match(/<loc>/g) || []).length;
          result.partitions.push({ loc: url, url_count: count });
        } catch (e) {
          result.partitions.push({ loc: url, url_count: null });
          console.warn('partition fetch failed:', url, e);
        }
      }
      result.url_count = result.partitions.reduce((s, p) => s + (p.url_count ?? 0), 0);
    } else {
      // Case B: root is a single urlset
      result.url_count = partitionUrls.length;
      result.partitions = [{ loc: `${SITE_URL}/sitemap.xml`, url_count: partitionUrls.length }];
    }
    result.fetched = true;
    result.fetched_at = new Date().toISOString();
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}

async function countFromQuery(build: () => Promise<{ count: number | null; error: unknown }>): Promise<number | null> {
  try {
    const { count, error } = await build();
    if (error) { console.warn('query error', error); return null; }
    return count ?? 0;
  } catch { return null; }
}

async function captureDatabaseStats(): Promise<Snapshot['database']> {
  const today = new Date().toISOString().slice(0, 10);
  const ev = () => supabase.from('events').select('*', { count: 'exact', head: true });

  const total                     = await countFromQuery(() => ev() as any);
  const futurePublished           = await countFromQuery(() => ev().gte('start_date', today).eq('publish_status', 'published') as any);
  const withCoords                = await countFromQuery(() => ev().not('latitude', 'is', null).not('longitude', 'is', null) as any);
  const withNullCoords            = await countFromQuery(() => ev().is('latitude', null) as any);
  // events.embedding wurde 2026-07 gedroppt (KI-Ausstieg, MASTERPLAN §6)
  const withEmbeddings            = null;
  const enrichedV2                = await countFromQuery(() => ev().eq('enrichment_version', 'enrich-v2-prompt1') as any);

  // Histograms via SELECT + in-memory bucketing
  const { data: srcRows } = await supabase.from('events').select('source_name').gte('start_date', today);
  const eventsBySource: Record<string, number> = {};
  (srcRows ?? []).forEach(r => {
    const k = (r as { source_name: string | null }).source_name ?? '(null)';
    eventsBySource[k] = (eventsBySource[k] ?? 0) + 1;
  });

  const { data: catRows } = await supabase.from('events').select('category').gte('start_date', today).eq('publish_status', 'published');
  const eventsByCategory: Record<string, number> = {};
  (catRows ?? []).forEach(r => {
    const k = (r as { category: string | null }).category ?? '(null)';
    eventsByCategory[k] = (eventsByCategory[k] ?? 0) + 1;
  });

  const { data: blRows } = await supabase.from('events').select('bundesland').gte('start_date', today).eq('publish_status', 'published');
  const eventsByBundesland: Record<string, number> = {};
  (blRows ?? []).forEach(r => {
    const k = (r as { bundesland: string | null }).bundesland ?? '(null)';
    eventsByBundesland[k] = (eventsByBundesland[k] ?? 0) + 1;
  });

  return {
    events_total:                total,
    events_future_published:     futurePublished,
    events_with_coords:          withCoords,
    events_with_null_coords:     withNullCoords,
    events_by_source:            eventsBySource,
    events_by_category:          eventsByCategory,
    events_by_bundesland:        eventsByBundesland,
    events_with_embeddings:      withEmbeddings,
    events_enriched_v2:          enrichedV2,
  };
}

async function captureInternalAnalytics(): Promise<Snapshot['internal_analytics']> {
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
  const empty: Snapshot['internal_analytics'] = {
    events_last_30d: null,
    page_views_last_30d: null,
    unique_sessions_last_30d: null,
    top_referrers: [],
    top_pages: [],
    event_types: {},
  };

  try {
    const { count: totalEvents } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', cutoff);
    empty.events_last_30d = totalEvents ?? 0;

    const { data: rows } = await supabase
      .from('analytics_events')
      .select('event_type, page, referrer, session_id')
      .gte('created_at', cutoff)
      .limit(50_000);

    if (!rows) return empty;

    const types: Record<string, number> = {};
    const pages: Record<string, number> = {};
    const refs: Record<string, number> = {};
    const sessions = new Set<string>();
    let pageViews = 0;

    for (const row of rows as Array<{ event_type: string | null; page: string | null; referrer: string | null; session_id: string | null }>) {
      if (row.event_type) types[row.event_type] = (types[row.event_type] ?? 0) + 1;
      if (row.event_type === 'page_view' || row.event_type === 'event_view') pageViews += 1;
      if (row.page) pages[row.page] = (pages[row.page] ?? 0) + 1;
      if (row.referrer) {
        try {
          const host = new URL(row.referrer).hostname;
          refs[host] = (refs[host] ?? 0) + 1;
        } catch { /* invalid URL */ }
      }
      if (row.session_id) sessions.add(row.session_id);
    }

    empty.event_types = types;
    empty.page_views_last_30d = pageViews;
    empty.unique_sessions_last_30d = sessions.size;
    empty.top_pages = Object.entries(pages)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([page, count]) => ({ page, count }));
    empty.top_referrers = Object.entries(refs)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([referrer, count]) => ({ referrer, count }));
    return empty;
  } catch (e) {
    console.warn('analytics capture failed (table missing?)', e);
    return empty;
  }
}

async function estimateIndexableInventory(db: Snapshot['database']): Promise<Snapshot['indexable_url_inventory']> {
  // Event detail pages ≈ events_future_published (only these are visible + indexable right now)
  const eventDetail = db.events_future_published ?? null;

  // Bundesland hubs: 9 + "österreich"
  const bundesland = 10;
  // Category hubs (existing in src/app/[bundesland]/[category]/…): assume 11 categories × 10 bundesland = 110
  const category = 11 * bundesland;
  // Top-city hubs (wien, graz, linz, salzburg, innsbruck, klagenfurt, eisenstadt, bregenz, st-poelten, villach, wels, dornbirn, steyr) ≈ 13
  const city = 13;
  // Student hubs (/studenten/[city]): best effort 6
  const student = 6;

  // Blog posts
  let blog: number | null = null;
  try {
    const { readdirSync } = await import('node:fs');
    const postFiles = readdirSync(join(process.cwd(), 'src/content/blog/posts'));
    blog = postFiles.filter((f: string) => f.endsWith('.ts')).length;
  } catch { /* noop */ }

  // Static pages: /, /impressum, /datenschutz, /ueber-uns, /agb, /quellen, /notifications, /groups, /entdecken, /login, /register
  const staticPages = 12;

  const total =
    (eventDetail ?? 0) + bundesland + category + city + student + (blog ?? 0) + staticPages;

  return {
    event_detail_pages: eventDetail,
    bundesland_hubs: bundesland,
    category_hubs: category,
    city_hubs: city,
    student_hubs: student,
    blog_posts: blog,
    static_pages: staticPages,
    estimated_total: total,
  };
}

// ─── Main ───
async function main() {
  console.log(`\n─── SEO Baseline Snapshot ───`);
  console.log(`Site:        ${SITE_URL}`);
  console.log(`Timestamp:   ${new Date().toISOString()}`);
  console.log(`Epic:        fn-13-seo-content-parity-vs-wasmachmaat\n`);

  console.log('[1/4] Fetching sitemap …');
  const sitemap = await fetchSitemapCount();
  console.log(`      → ${sitemap.url_count ?? '(failed)'} URLs, ${sitemap.partitions.length} partitions\n`);

  console.log('[2/4] Capturing database stats …');
  const database = await captureDatabaseStats();
  console.log(`      → ${database.events_total?.toLocaleString() ?? '?'} total events, ${database.events_future_published?.toLocaleString() ?? '?'} future published\n`);

  console.log('[3/4] Capturing internal analytics (last 30d) …');
  const internal = await captureInternalAnalytics();
  console.log(`      → ${internal.events_last_30d?.toLocaleString() ?? '?'} events, ${internal.unique_sessions_last_30d?.toLocaleString() ?? '?'} sessions\n`);

  console.log('[4/4] Estimating indexable URL inventory …');
  const inventory = await estimateIndexableInventory(database);
  console.log(`      → ~${inventory.estimated_total?.toLocaleString() ?? '?'} indexable URLs currently\n`);

  const snapshot: Snapshot = {
    _meta: {
      version: 1,
      taken_at: new Date().toISOString(),
      site_url: SITE_URL,
      script: 'src/scripts/seo-baseline-snapshot.ts',
      epic: 'fn-13-seo-content-parity-vs-wasmachmaat',
    },
    sitemap,
    database,
    internal_analytics: internal,
    indexable_url_inventory: inventory,
    search_console: {
      configured: false,
      impressions: null,
      clicks: null,
      ctr: null,
      avg_position: null,
      indexed_urls: null,
      note: 'GSC API integration not yet set up. See data/seo-baseline/README.md. Fill once OAuth credentials are available.',
    },
  };

  const today = new Date().toISOString().slice(0, 10);
  const baselineDir = join(process.cwd(), 'data/seo-baseline');
  const snapshotDir = join(baselineDir, 'snapshots');
  if (!existsSync(snapshotDir)) mkdirSync(snapshotDir, { recursive: true });

  const baselinePath = join(baselineDir, `${today}-baseline.json`);
  const historicalPath = join(snapshotDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

  writeFileSync(baselinePath,    JSON.stringify(snapshot, null, 2) + '\n');
  writeFileSync(historicalPath,  JSON.stringify(snapshot, null, 2) + '\n');

  console.log(`✓ Baseline written: ${baselinePath}`);
  console.log(`✓ Historical copy:  ${historicalPath}\n`);

  // Print summary
  console.log('─── Summary ───');
  console.log(`Sitemap URLs:               ${(sitemap.url_count ?? 0).toLocaleString()}`);
  console.log(`DB future published events: ${(database.events_future_published ?? 0).toLocaleString()}`);
  console.log(`Events w/ embeddings:       ${(database.events_with_embeddings ?? 0).toLocaleString()}`);
  console.log(`Events enriched (v2):       ${(database.events_enriched_v2 ?? 0).toLocaleString()}`);
  console.log(`30d sessions:               ${(internal.unique_sessions_last_30d ?? 0).toLocaleString()}`);
  console.log(`30d analytics events:       ${(internal.events_last_30d ?? 0).toLocaleString()}`);
  console.log(`Indexable URL estimate:     ${(inventory.estimated_total ?? 0).toLocaleString()}`);
  console.log(`Top referrer:               ${internal.top_referrers[0]?.referrer ?? '(none)'}\n`);
}

main().catch(err => {
  console.error('\nSnapshot failed:', err);
  process.exit(1);
});
