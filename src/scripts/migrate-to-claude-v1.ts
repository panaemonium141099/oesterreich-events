// src/scripts/migrate-to-claude-v1.ts
/**
 * Bulk-migration helper: resets `enrichment_version=NULL` for all
 * future published events that still have an old (non-claude-v1)
 * enrichment_version, so the next `enrich:claude` run picks them up.
 *
 * Why a script and not a one-shot SQL? Supabase's PostgREST/MCP layer
 * has a 60s statement timeout. Bulk-updating ~46k rows in one shot
 * trips that limit, even when the partial index makes the lookup fast.
 *
 * Approach: server-side `reset_enrichment_chunk(p_chunk_size)` RPC
 * (deployed via migration) sets `SET LOCAL statement_timeout = '300s'`
 * and updates one chunk per call. We loop until it returns 0.
 *
 * Usage:
 *   npm run migrate:claude-v1                    # default chunk 5000
 *   npm run migrate:claude-v1 -- --chunk 2000    # smaller chunks if DB is hot
 *   npm run migrate:claude-v1 -- --dry-run       # just report counts, no writes
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local manually (tsx doesn't auto-load it without --env-file)
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
} catch { /* env loaded via --env-file */ }

import { createClient } from '@supabase/supabase-js';

function parseIntArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || !process.argv[idx + 1]) return fallback;
  const n = parseInt(process.argv[idx + 1], 10);
  if (!Number.isFinite(n) || n < 1) {
    console.error(`Error: ${name} must be a positive integer`);
    process.exit(1);
  }
  return n;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const chunkSize = parseIntArg('--chunk', 1000);
  const sleepMs = parseIntArg('--sleep', 2000);
  const dryRun = process.argv.includes('--dry-run');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('Bulk-migration reset — claude-v1');
  console.log(`  Target population: future published events with old enrichment_version`);
  console.log(`  Chunk size:        ${chunkSize}`);
  console.log(`  Sleep between:     ${sleepMs}ms`);
  console.log(`  Dry-run:           ${dryRun}`);
  console.log('─'.repeat(70));

  if (dryRun) {
    console.log('Dry-run — would call reset_enrichment_chunk RPC in a loop until 0.');
    console.log('Re-run without --dry-run to actually reset.');
    return;
  }

  const startedAt = Date.now();
  let totalAffected = 0;
  let chunkCount = 0;

  // Loop until the RPC reports 0 rows touched.
  while (true) {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc('reset_enrichment_chunk', {
      p_chunk_size: chunkSize,
    });

    if (error) {
      // Exponential backoff with up to 4 retries. Long sleeps help let
      // any held postgres locks expire before we retry.
      let lastErr = error.message || '(empty)';
      let recovered = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        const wait = 5000 * Math.pow(2, attempt - 1); // 5s, 10s, 20s, 40s
        console.warn(`\n[chunk ${chunkCount + 1}] RPC failed: ${lastErr} — retry ${attempt}/4 in ${wait / 1000}s…`);
        await new Promise((r) => setTimeout(r, wait));
        const { data: retryData, error: retryErr } = await supabase.rpc(
          'reset_enrichment_chunk',
          { p_chunk_size: chunkSize },
        );
        if (!retryErr) {
          const affected = retryData as number;
          chunkCount += 1;
          totalAffected += affected;
          console.log(`  chunk ${chunkCount}: ${affected} rows (recovered, ${((Date.now() - t0) / 1000).toFixed(1)}s) | total ${totalAffected}`);
          if (affected === 0) return; // done
          recovered = true;
          break;
        }
        lastErr = retryErr.message || '(empty)';
      }
      if (!recovered) {
        console.error(`\nGiving up after 4 retries. Last error: ${lastErr}`);
        console.error(`Re-run \`npm run migrate:claude-v1\` later — it's idempotent.`);
        process.exit(1);
      }
      // Sleep between chunks to let DB breathe
      if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));
      continue;
    }

    const affected = data as number;
    chunkCount += 1;
    totalAffected += affected;
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  chunk ${chunkCount}: ${affected} rows (${dt}s) | total ${totalAffected}`);

    if (affected === 0) break;
    if (affected < chunkSize) break; // last partial chunk — done

    // Sleep between successful chunks too — keeps DB load civilized.
    if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('─'.repeat(70));
  console.log(`Done. ${totalAffected} rows reset across ${chunkCount} chunk(s) in ${elapsed}s.`);
  console.log('Next: npm run enrich:claude -- --batch-size 3 --concurrency 8 --no-fetch ...');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
