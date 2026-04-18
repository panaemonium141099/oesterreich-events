/**
 * Submit event URLs to search-engine indexing APIs.
 *
 * Two channels:
 *   - IndexNow (Bing, Yandex, Seznam, Naver) — up to 10k URLs/request, free.
 *   - Google Indexing API — 200 URLs/day default. Requires service-account.
 *
 * Usage:
 *   npm run submit-indexing                      # last 48h, both channels
 *   npm run submit-indexing -- --dry-run         # preview, no API calls
 *   npm run submit-indexing -- --all             # all high-quality events
 *   npm run submit-indexing -- --limit 500
 *   npm run submit-indexing -- --google-only
 *   npm run submit-indexing -- --indexnow-only
 *   npm run submit-indexing -- --since 2026-04-10T00:00:00Z
 *
 * Runs in the scrape-pipeline automatically as step `indexing`. There it
 * defaults to "since the current pipeline run started" so only freshly
 * scraped/updated events get notified.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local manually — tsx doesn't do that automatically.
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* .env.local not found, use environment */ }

import { createClient } from '@supabase/supabase-js';
import { submitToIndexNow } from '../lib/indexnow';
import { submitToGoogleIndexing, isGoogleIndexingConfigured } from '../lib/indexing-api';

function parseArgs() {
  const args = process.argv.slice(2);
  const has = (flag: string) => args.includes(flag);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  const limitRaw = get('--limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
  return {
    dryRun: has('--dry-run'),
    all: has('--all'),
    googleOnly: has('--google-only'),
    indexNowOnly: has('--indexnow-only'),
    since: get('--since'),
    limit: limit && Number.isFinite(limit) && limit > 0 ? limit : undefined,
  } as const;
}

const opts = parseArgs();

// ─── Supabase client ─────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Rate-limit + URL building ───────────────────────────────────────────
const BASE_URL = 'https://lasstreffen.at';
const GOOGLE_DAILY_LIMIT = 200;
const INDEXNOW_BATCH_CAP = 10_000;
const RATE_LIMIT_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Hybrid slug URL (same shape as sitemap.ts buildEventUrl).
 * Slug may be null; we fall back to the pure short-id URL.
 */
function buildEventUrl(id: string, slug: string | null | undefined): string {
  const shortId = id.slice(0, 8);
  if (!slug) return `${BASE_URL}/events/${shortId}`;
  return `${BASE_URL}/events/${shortId}-${slug}`;
}

// ─── Event fetch ─────────────────────────────────────────────────────────
interface EventRow {
  id: string;
  slug: string | null;
  quality_score: number | null;
  updated_at: string | null;
}

async function fetchCandidates(): Promise<EventRow[]> {
  const today = new Date().toISOString().split('T')[0];
  const since = opts.since
    ? opts.since
    : opts.all
      ? undefined
      : new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('events')
    .select('id, slug, quality_score, updated_at')
    .gte('start_date', today)
    .eq('publish_status', 'published')
    .gte('quality_score', 60)  // higher bar than sitemap (40); we don't want
                                 // to spend indexing API quota on borderline rows
    .order('quality_score', { ascending: false })
    .order('id', { ascending: true });

  if (since) query = query.gte('updated_at', since);

  // Soft cap; callers can override with --limit.
  const hardLimit = opts.limit ?? (opts.all ? 5000 : 2000);
  query = query.limit(hardLimit);

  const { data, error } = await query;
  if (error) {
    console.error('[submit-indexing] fetch error:', error.message);
    return [];
  }
  return (data ?? []) as EventRow[];
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  const mode = opts.googleOnly ? 'GOOGLE-ONLY' : opts.indexNowOnly ? 'INDEXNOW-ONLY' : 'BOTH';
  console.log('\nSubmit to Indexing');
  console.log(`  Mode:        ${mode}${opts.dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`  Since:       ${opts.since ?? (opts.all ? 'ALL TIME' : 'last 48h')}`);
  console.log(`  Limit:       ${opts.limit ?? 'default'}`);
  console.log('='.repeat(60));

  const events = await fetchCandidates();
  console.log(`  Candidates:  ${events.length}`);
  if (events.length === 0) {
    console.log('\nNothing to submit.');
    return;
  }

  const urls = events.map(e => buildEventUrl(e.id, e.slug));

  // ── IndexNow (Bing/Yandex/etc) ────────────────────────────────────────
  if (!opts.googleOnly) {
    const batch = urls.slice(0, INDEXNOW_BATCH_CAP);
    console.log(`\n[IndexNow] Submitting ${batch.length} URLs...`);
    if (opts.dryRun) {
      console.log(`  DRY RUN — first 3: ${batch.slice(0, 3).join(', ')}`);
    } else {
      const result = await submitToIndexNow(batch);
      if (result.ok) {
        console.log(`  ✓ Submitted ${result.submitted} URLs (HTTP ${result.status})`);
      } else {
        console.error(`  ✗ Failed HTTP ${result.status}: ${result.error ?? 'unknown'}`);
      }
    }
  }

  // ── Google Indexing API ───────────────────────────────────────────────
  if (!opts.indexNowOnly) {
    if (!isGoogleIndexingConfigured()) {
      console.log('\n[Google] Skipped — GOOGLE_INDEXING_API_SA_KEY not set.');
      console.log('  Setup guide: src/lib/indexing-api.ts (top-of-file comment)');
    } else {
      const googleBatch = urls.slice(0, GOOGLE_DAILY_LIMIT);
      console.log(`\n[Google] Submitting ${googleBatch.length} URLs (daily cap ${GOOGLE_DAILY_LIMIT})...`);
      if (opts.dryRun) {
        console.log(`  DRY RUN — first 3: ${googleBatch.slice(0, 3).join(', ')}`);
      } else {
        let ok = 0;
        let failed = 0;
        const failures: Array<{ url: string; status: number; error?: string }> = [];

        for (let i = 0; i < googleBatch.length; i++) {
          const url = googleBatch[i];
          const result = await submitToGoogleIndexing(url, 'URL_UPDATED');
          if (result.ok) ok += 1;
          else {
            failed += 1;
            failures.push({ url, status: result.status, error: result.error });
          }
          await sleep(RATE_LIMIT_MS);
          if ((i + 1) % 25 === 0 || i === googleBatch.length - 1) {
            process.stdout.write(`  ${i + 1}/${googleBatch.length} | ok=${ok} failed=${failed}\r`);
          }
        }
        process.stdout.write('\n');

        console.log(`  ✓ Submitted ${ok}, ✗ failed ${failed}`);
        if (failures.length > 0) {
          console.log('\n  First 5 failures:');
          for (const f of failures.slice(0, 5)) {
            console.log(`    [${f.status}] ${f.url} — ${f.error ?? 'no detail'}`);
          }
          if (failures.length >= 1 && failures[0].status === 403) {
            console.log('\n  HTTP 403 usually means the service account is not listed as');
            console.log('  an Owner in Google Search Console. Fix: GSC → Settings →');
            console.log('  Users & permissions → Add user → paste the service-account email.');
          }
        }
      }
    }
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('submit-to-indexing failed:', err);
  process.exit(1);
});
