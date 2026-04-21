/**
 * Batch-enrich every event with Qwen (via LM Studio).
 *
 * Flow per event:
 *   1. Fetch source_url → extract main text (cheerio)
 *   2. Call Qwen with metadata + page content
 *   3. Write enrichment fields back to DB. description/price_text are only
 *      overwritten when the DB currently has NULL/empty and Qwen returned
 *      something plausible.
 *   4. Mark the row with `enrichment_version` so resume skips it next run.
 *
 * Concurrency: N workers pull from a shared queue. Each worker does
 * fetch + AI + DB-write sequentially; across workers they overlap.
 * Inference in LM Studio is single-GPU so it serializes, but the network
 * fetch parallelism gives a ~3x throughput boost anyway.
 *
 * Resume: query filters `enrichment_version IS NULL OR != current`. A hard
 * kill mid-batch is fine — next run picks up where we left off.
 *
 * Usage:
 *   npm run enrich-batch                        # enrich every future+published event
 *   npm run enrich-batch -- --limit 100         # just 100 events
 *   npm run enrich-batch -- --concurrency 3     # fewer parallel workers
 *   npm run enrich-batch -- --dry-run           # no DB writes
 *   npm run enrich-batch -- --no-fetch          # skip URL fetch, faster but worse
 *   npm run enrich-batch -- --force             # re-enrich even if already done
 */

import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const envPath = join(process.cwd(), '.env.local');
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.substring(0, i).trim();
    const v = t.substring(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* absent */ }

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { enrichEvent, type EnrichmentInput } from '../lib/category-classifier/enrich';
import { fetchEventPage } from '../lib/category-classifier/fetch-page';
import { ENRICHMENT_VERSION } from '../lib/category-classifier/enrichment-taxonomy';

interface CliOpts {
  limit: number;
  concurrency: number;
  dryRun: boolean;
  noFetch: boolean;
  force: boolean;
}

function parseArgs(): CliOpts {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
  };
  const parseInt10 = (v: string | undefined, d: number) =>
    v ? parseInt(v, 10) : d;
  return {
    limit: parseInt10(get('--limit'), Infinity as unknown as number),
    concurrency: parseInt10(get('--concurrency'), 5),
    dryRun: args.includes('--dry-run'),
    noFetch: args.includes('--no-fetch'),
    force: args.includes('--force'),
  };
}

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  source_tags_raw: string[] | null;
  location_name: string | null;
  organizer: string | null;
  start_date: string | null;
  end_date: string | null;
  price_text: string | null;
  price_min: number | null;
  price_max: number | null;
  source_url: string | null;
}

const FETCH_COLS =
  'id, title, description, category, tags, source_tags_raw, ' +
  'location_name, organizer, start_date, end_date, ' +
  'price_text, price_min, price_max, source_url';

class Stats {
  processed = 0;
  enriched = 0;
  failed = 0;
  fetchOk = 0;
  fetchSkipped = 0;
  fetchFailed = 0;
  descFilled = 0;
  priceFilled = 0;
  startedAt = Date.now();

  reportLine(total: number | undefined): string {
    const elapsed = (Date.now() - this.startedAt) / 1000;
    const rate = this.processed / Math.max(elapsed, 0.001);
    const etaStr = total && rate > 0
      ? `eta=${(((total - this.processed) / rate) / 60).toFixed(1)}min`
      : '';
    return `p=${this.processed}${total ? '/' + total : ''} ✓=${this.enriched} ✗=${this.failed} ` +
      `fetch(ok=${this.fetchOk} fail=${this.fetchFailed} skip=${this.fetchSkipped}) ` +
      `filled(desc=${this.descFilled} price=${this.priceFilled}) ` +
      `rate=${rate.toFixed(1)}/s ${etaStr}`;
  }
}

async function processOne(
  supabase: SupabaseClient,
  row: EventRow,
  opts: CliOpts,
  stats: Stats,
): Promise<void> {
  // 1. Fetch page (unless disabled or no URL)
  let pageContent: string | null = null;
  if (!opts.noFetch && row.source_url) {
    try {
      const page = await fetchEventPage(row.source_url);
      if (page.ok) {
        pageContent = page.text;
        stats.fetchOk += 1;
      } else {
        stats.fetchFailed += 1;
      }
    } catch {
      stats.fetchFailed += 1;
    }
  } else {
    stats.fetchSkipped += 1;
  }

  // 2. Call Qwen
  const input: EnrichmentInput = {
    title: row.title,
    description: row.description,
    category: row.category,
    tagsRaw: row.source_tags_raw ?? row.tags ?? null,
    locationName: row.location_name,
    organizer: row.organizer,
    startDate: row.start_date,
    endDate: row.end_date,
    priceText: row.price_text,
    priceMin: row.price_min,
    priceMax: row.price_max,
    pageContent,
  };
  const res = await enrichEvent(input);
  if (!res.ok) {
    stats.failed += 1;
    return;
  }
  stats.enriched += 1;

  // 3. Build update payload.
  // description/price_text only filled if DB is empty AND Qwen returned something.
  const update: Record<string, unknown> = {
    audience: res.result.audience.length > 0 ? res.result.audience : null,
    vibe: res.result.vibe.length > 0 ? res.result.vibe : null,
    setting: res.result.setting.length > 0 ? res.result.setting : null,
    language: res.result.language,
    price_tier: res.result.price_tier,
    duration_type: res.result.duration_type,
    is_student_friendly: res.result.is_student_friendly,
    is_family_friendly: res.result.is_family_friendly,
    enrichment_version: ENRICHMENT_VERSION,
    enrichment_at: new Date().toISOString(),
  };

  // Merge Qwen's richer tags with whatever the deterministic classifier already put there.
  // Union, capped at 8 total. Preserves cat-v2 output (useful for backwards compat).
  if (res.result.tags.length > 0) {
    const existing = Array.isArray(row.tags) ? row.tags : [];
    const merged = Array.from(new Set([...existing, ...res.result.tags])).slice(0, 8);
    update.tags = merged;
  }

  const dbDescEmpty = !row.description || row.description.trim().length < 40;
  if (dbDescEmpty && res.result.suggested_description) {
    update.description = res.result.suggested_description;
    stats.descFilled += 1;
  }

  const dbPriceEmpty = !row.price_text || row.price_text.trim().length === 0;
  if (dbPriceEmpty && res.result.suggested_price_text) {
    update.price_text = res.result.suggested_price_text;
    stats.priceFilled += 1;
  }

  // 4. Write
  if (!opts.dryRun) {
    const { error } = await supabase
      .from('events')
      .update(update)
      .eq('id', row.id);
    if (error) {
      stats.failed += 1;
      stats.enriched -= 1;
      console.error(`\nupdate ${row.id}: ${error.message}`);
    }
  }

  stats.processed += 1;
}

async function worker(
  queue: EventRow[],
  supabase: SupabaseClient,
  opts: CliOpts,
  stats: Stats,
  total: number | undefined,
): Promise<void> {
  while (queue.length > 0) {
    const row = queue.shift();
    if (!row) break;
    try {
      await processOne(supabase, row, opts, stats);
    } catch (err) {
      stats.failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\nworker error on ${row.id}: ${msg}`);
    }
    if (stats.processed % 20 === 0 || stats.processed <= 5) {
      process.stdout.write('  ' + stats.reportLine(total) + '\r');
    }
  }
}

async function main() {
  const opts = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const today = new Date().toISOString().split('T')[0];

  console.log('\nEvent Enrichment Batch');
  console.log(`  Concurrency:      ${opts.concurrency}`);
  console.log(`  Dry-run:          ${opts.dryRun}`);
  console.log(`  Fetch URLs:       ${!opts.noFetch}`);
  console.log(`  Force re-run:     ${opts.force}`);
  console.log(`  Limit:            ${opts.limit === Infinity ? 'none' : opts.limit}`);
  console.log(`  Target version:   ${ENRICHMENT_VERSION}`);
  console.log(`  LM Studio:        ${process.env.LOCAL_AI_BASE_URL ?? 'http://localhost:1234/v1'}`);
  console.log(`  Model:            ${process.env.LOCAL_AI_MODEL ?? 'qwen2.5-14b-instruct'}`);

  // Count pending work — gives us ETA and nice progress bar.
  let countQuery = supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('publish_status', 'published')
    .gte('start_date', today);
  if (!opts.force) {
    countQuery = countQuery.or(`enrichment_version.is.null,enrichment_version.neq.${ENRICHMENT_VERSION}`);
  }
  const { count: totalPending } = await countQuery;
  console.log(`  Pending events:   ${totalPending ?? 'unknown'}`);
  console.log('─'.repeat(70));

  const stats = new Stats();
  const PAGE_SIZE = 200;  // fetch this many at a time, workers drain it

  // Drain-the-set loop: always ask for the next N events still needing enrichment.
  while (stats.processed < opts.limit) {
    let query = supabase
      .from('events')
      .select(FETCH_COLS)
      .eq('publish_status', 'published')
      .gte('start_date', today)
      .order('id', { ascending: true })
      .limit(PAGE_SIZE);
    if (!opts.force) {
      query = query.or(`enrichment_version.is.null,enrichment_version.neq.${ENRICHMENT_VERSION}`);
    }
    const { data, error } = await query;
    if (error) {
      console.error('\nquery error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    const rows = data as unknown as EventRow[];
    // If opts.limit caps us in the middle of this page, trim.
    const remaining = opts.limit - stats.processed;
    const toProcess = remaining < rows.length ? rows.slice(0, remaining) : rows;

    // Spawn workers on this page.
    const queue = [...toProcess];
    const workers = Array.from({ length: opts.concurrency }, () =>
      worker(queue, supabase, opts, stats, totalPending ?? undefined),
    );
    await Promise.all(workers);

    // Safety: if we're not actually advancing the "pending" set (dry-run,
    // or all rows in this page failed to update), break to avoid infinite
    // loop. In --dry-run the rows never leave the filter set because we
    // don't write enrichment_version, so this check is the sole exit.
    if (opts.dryRun || opts.force) break;
    if (rows.length < PAGE_SIZE) break;
  }

  process.stdout.write('\n');
  console.log('─'.repeat(70));
  console.log(stats.reportLine(totalPending ?? undefined));
  const elapsed = (Date.now() - stats.startedAt) / 1000;
  console.log(`Elapsed: ${(elapsed / 60).toFixed(1)}min`);
}

main().catch((err) => {
  console.error('enrich-batch failed:', err);
  process.exit(1);
});
