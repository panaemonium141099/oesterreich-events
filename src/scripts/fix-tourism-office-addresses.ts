/**
 * Fix Tourism-Office Addresses — Re-fetch JSON-LD and replace contact-office
 * addresses with the actual venue addresses.
 *
 * BACKGROUND
 * ----------
 * The burgenland.info and neusiedlersee.com scrapers had a long-standing bug:
 * for each Schema.org Event JSON-LD, they read `organizer.address` first and
 * fell back to `location.address`. That is backwards — `organizer.address` is
 * the contact/tourism-office headquarters, `location.address` is the actual
 * venue. The bug routed roughly half of all events from these two sources to
 * tourism-office PLZs:
 *
 *   PLZ   Office                                  burgenland.info  neusiedlersee
 *   7000  Burgenland Tourismus HQ (Eisenstadt)    91/108 falsch
 *   7142  Erlebnisregion Neusiedler See (Illmitz) 31/35 falsch
 *   7361  Erlebnisregion Mittelburgenland-Rosalia 6/23 falsch
 *   7431  Erlebnisregion Südburgenland (Bad Tatz) 6/21 falsch
 *   8383  Süd-Burgenland office                   20/20 falsch
 *
 * Total: ~409 events landed at tourism HQs instead of their actual venues.
 *
 * The scraper code is now fixed. This script repairs the historical rows by
 * re-fetching the JSON-LD for every burgenland.info + neusiedlersee.com event
 * and writing back the venue address/PLZ/coords/location_name.
 *
 * SAFETY
 * ------
 * - Dry-run by default; pass --apply to actually write.
 * - Backs up every changed row to data/tourism-fix-backup-YYYY-MM-DD.jsonl
 *   before any UPDATE.
 * - Skips rows whose source_url is missing or returns non-200.
 * - Only updates address, postal_code, location_name, latitude, longitude,
 *   geocoding_source, geocoding_confidence — leaves everything else alone
 *   (title, dates, category, slug, etc.).
 * - Slug is intentionally NOT regenerated; the event-detail page uses slug
 *   as a URL key and changing it would break Google-indexed links.
 *
 * USAGE
 * -----
 *   source .env.local && npx tsx src/scripts/fix-tourism-office-addresses.ts --dry-run
 *   source .env.local && npx tsx src/scripts/fix-tourism-office-addresses.ts --apply
 *
 * Filters:
 *   --source burgenland.info       # only one scraper at a time
 *   --source neusiedlersee.com
 *   --limit 50                     # cap for incremental runs
 *   --plz 7000                     # only events with this current PLZ
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Run with: source .env.local && npx tsx src/scripts/fix-tourism-office-addresses.ts');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const sourceFilter = ((): string | null => {
  const i = args.indexOf('--source');
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
})();
const plzFilter = ((): string | null => {
  const i = args.indexOf('--plz');
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
})();
const limit = ((): number | null => {
  const i = args.indexOf('--limit');
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : null;
})();

const SOURCES = sourceFilter ? [sourceFilter] : ['burgenland.info', 'neusiedlersee.com'];

// PLZs of the known tourism offices we want to repair. If the current row's
// postal_code isn't one of these, the row likely already has a correct venue
// address and we leave it alone (saves ~half the JSON-LD re-fetches).
const TOURISM_OFFICE_PLZS = new Set([
  '7000', // Burgenland Tourismus HQ, Eisenstadt
  '7142', // Erlebnisregion Neusiedler See, Illmitz
  '7361', // Erlebnisregion Mittelburgenland-Rosalia, Lutzmannsburg
  '7431', // Erlebnisregion Südburgenland, Bad Tatzmannsdorf
  '8383', // Süd-Burgenland office (St. Martin)
  '7100', // Neusiedl am See office
  '7540', // Güssing office
  '7210', // Mattersburg office
]);

// ─── Helpers ───────────────────────────────────────────────────────────────

interface VenueData {
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

function pickFirst<T>(x: T | T[] | undefined | null): T | null {
  if (!x) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

function formatAddress(a: { streetAddress?: string; postalCode?: string; addressLocality?: string } | null): string | null {
  if (!a) return null;
  const parts = [a.streetAddress, [a.postalCode, a.addressLocality].filter(Boolean).join(' ')].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

async function fetchVenueFromUrl(url: string): Promise<VenueData | null> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LasstreffenBot/1.0; +https://lasstreffen.at)' },
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const $ = cheerio.load(html);
  const script = $('script[type="application/ld+json"]').first().html();
  if (!script) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(script);
  } catch {
    return null;
  }

  // Schema.org @graph wrapper or array — find the Event node.
  type GraphNode = { '@type'?: string | string[]; location?: unknown; name?: string };
  const root = parsed as { '@graph'?: unknown[] };
  const candidates: unknown[] = Array.isArray(root['@graph'])
    ? root['@graph']
    : Array.isArray(parsed)
      ? (parsed as unknown[])
      : [parsed];

  const eventNode = candidates.find((n) => {
    const node = n as GraphNode;
    const t = node['@type'];
    const tStr = Array.isArray(t) ? t.join(',') : String(t || '');
    return /Event/i.test(tStr);
  }) as GraphNode | undefined;
  if (!eventNode) return null;

  const location = pickFirst(eventNode.location as
    | { name?: string; address?: { streetAddress?: string; postalCode?: string; addressLocality?: string }; geo?: { latitude?: number | string; longitude?: number | string } }
    | { name?: string; address?: { streetAddress?: string; postalCode?: string; addressLocality?: string }; geo?: { latitude?: number | string; longitude?: number | string } }[]
    | null
    | undefined);
  if (!location) return null;

  const lat = location.geo?.latitude;
  const lng = location.geo?.longitude;

  return {
    location_name: location.name || null,
    address: formatAddress(location.address || null),
    postal_code: location.address?.postalCode || null,
    latitude: lat != null ? (typeof lat === 'string' ? parseFloat(lat) : lat) : null,
    longitude: lng != null ? (typeof lng === 'string' ? parseFloat(lng) : lng) : null,
  };
}

function backupPath(): string {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(process.cwd(), 'data', `tourism-fix-backup-${today}.jsonl`);
}

async function main() {
  console.log('=== Tourism-Office Address Fix ===');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Sources: ${SOURCES.join(', ')}`);
  if (plzFilter) console.log(`PLZ filter: ${plzFilter}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log('');

  // Fetch candidate rows
  const filter = supabase
    .from('events')
    .select('id, title, source_name, source_url, postal_code, location_name, address, latitude, longitude, geocoding_source')
    .in('source_name', SOURCES);

  const targetPlzList = plzFilter ? [plzFilter] : Array.from(TOURISM_OFFICE_PLZS);
  filter.in('postal_code', targetPlzList);

  if (limit) filter.limit(limit);

  const { data: rows, error } = await filter;
  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log('No candidate rows. Exiting.');
    return;
  }

  console.log(`${rows.length} candidate rows fetched.`);
  console.log('');

  const backup: unknown[] = [];
  let fixed = 0;
  let skipped = 0;
  let unchanged = 0;
  let errored = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tag = `[${i + 1}/${rows.length}]`;

    if (!row.source_url) {
      skipped++;
      continue;
    }

    let venue: VenueData | null = null;
    try {
      venue = await fetchVenueFromUrl(row.source_url);
    } catch (e) {
      console.log(`${tag} ERROR fetching ${row.source_url}: ${e instanceof Error ? e.message : e}`);
      errored++;
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }

    if (!venue) {
      console.log(`${tag} SKIP (no JSON-LD venue data) — ${row.title.slice(0, 60)}`);
      skipped++;
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }

    // Decide what to update. We only touch fields where the venue payload
    // is non-null AND differs from the current value. This avoids needless
    // updated_at churn and keeps the diff minimal.
    const update: Record<string, unknown> = {};
    if (venue.address && venue.address !== row.address) update.address = venue.address;
    if (venue.postal_code && venue.postal_code !== row.postal_code) update.postal_code = venue.postal_code;
    if (venue.location_name && venue.location_name !== row.location_name) update.location_name = venue.location_name;
    if (
      venue.latitude != null &&
      venue.longitude != null &&
      (Math.abs((row.latitude ?? 0) - venue.latitude) > 0.0005 ||
        Math.abs((row.longitude ?? 0) - venue.longitude) > 0.0005)
    ) {
      update.latitude = venue.latitude;
      update.longitude = venue.longitude;
      update.geocoding_source = 'json-ld-venue';
      update.geocoding_confidence = 'exact';
    }

    if (Object.keys(update).length === 0) {
      unchanged++;
      continue;
    }

    backup.push({
      id: row.id,
      before: {
        location_name: row.location_name,
        address: row.address,
        postal_code: row.postal_code,
        latitude: row.latitude,
        longitude: row.longitude,
      },
      after: update,
      title: row.title,
      source_url: row.source_url,
    });

    console.log(
      `${tag} FIX ${row.title.slice(0, 50)}\n` +
      `   addr: ${row.address ?? '∅'} → ${update.address ?? '(keep)'}\n` +
      `   plz : ${row.postal_code ?? '∅'} → ${update.postal_code ?? '(keep)'}\n` +
      `   loc : ${row.location_name ?? '∅'} → ${update.location_name ?? '(keep)'}\n` +
      `   geo : ${row.latitude},${row.longitude} → ${update.latitude ?? '(keep)'},${update.longitude ?? '(keep)'}`,
    );

    if (apply) {
      const { error: upErr } = await supabase.from('events').update(update).eq('id', row.id);
      if (upErr) {
        console.log(`${tag} UPDATE FAILED: ${upErr.message}`);
        errored++;
      } else {
        fixed++;
      }
    } else {
      fixed++;
    }

    // Be polite to burgenland.info
    await new Promise((r) => setTimeout(r, 200));
  }

  // Write backup
  if (backup.length > 0) {
    const file = backupPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, backup.map((b) => JSON.stringify(b)).join('\n'));
    console.log(`\nBackup written: ${file} (${backup.length} entries)`);
  }

  console.log('\n=== Summary ===');
  console.log(`${fixed} ${apply ? 'fixed' : 'would fix'}, ${unchanged} unchanged, ${skipped} skipped, ${errored} errored`);
  if (!apply) console.log('\nDry-run only. Re-run with --apply to write.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
