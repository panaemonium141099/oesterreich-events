/**
 * check-event-images.ts
 *
 * Audits events with a set image_url to check whether the URL is still reachable.
 * Does NOT modify any DB data unless --fix is passed.
 *
 * Usage:
 *   npx tsx src/scripts/check-event-images.ts                # audit only
 *   npx tsx src/scripts/check-event-images.ts --fix           # nullify broken URLs
 *   npx tsx src/scripts/check-event-images.ts --limit 500     # check first 500
 *   npx tsx src/scripts/check-event-images.ts --json          # JSON output
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const REQUEST_TIMEOUT_MS = 8_000;
const CONCURRENCY = 20;
const DEFAULT_LIMIT = 2000;

interface AuditResult {
  id: string;
  image_url: string;
  status: 'ok' | 'broken' | 'timeout' | 'error';
  httpStatus?: number;
  contentType?: string;
  error?: string;
}

async function checkUrl(url: string): Promise<{ ok: boolean; httpStatus?: number; contentType?: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'EventImageChecker/1.0' },
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') || '';
    const isImage = contentType.startsWith('image/') || res.ok;

    return {
      ok: res.ok && isImage,
      httpStatus: res.status,
      contentType,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort')) {
      return { ok: false, error: 'timeout' };
    }
    return { ok: false, error: message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const jsonOutput = args.includes('--json');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : DEFAULT_LIMIT;

  if (!jsonOutput) {
    console.log(`\n🔍 Event Image Audit`);
    console.log(`   Mode: ${fix ? 'FIX (will nullify broken URLs)' : 'AUDIT ONLY (read-only)'}`);
    console.log(`   Limit: ${limit}\n`);
  }

  // Fetch events with image_url set
  const { data: events, error } = await supabase
    .from('events')
    .select('id, image_url')
    .not('image_url', 'is', null)
    .neq('image_url', '')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch events:', error.message);
    process.exit(1);
  }

  if (!events || events.length === 0) {
    console.log('No events with image_url found.');
    return;
  }

  if (!jsonOutput) {
    console.log(`Found ${events.length} events with image_url. Checking...\n`);
  }

  const results: AuditResult[] = [];
  let checked = 0;

  // Process in batches for concurrency control
  for (let i = 0; i < events.length; i += CONCURRENCY) {
    const batch = events.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (event) => {
        const check = await checkUrl(event.image_url);
        checked++;
        if (!jsonOutput && checked % 100 === 0) {
          process.stdout.write(`  Checked ${checked}/${events.length}\r`);
        }
        const result: AuditResult = {
          id: event.id,
          image_url: event.image_url,
          status: check.ok ? 'ok' : check.error === 'timeout' ? 'timeout' : check.error ? 'error' : 'broken',
          httpStatus: check.httpStatus,
          contentType: check.contentType,
          error: check.error,
        };
        return result;
      }),
    );
    results.push(...batchResults);
  }

  const okCount = results.filter((r) => r.status === 'ok').length;
  const brokenCount = results.filter((r) => r.status === 'broken').length;
  const timeoutCount = results.filter((r) => r.status === 'timeout').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const failedResults = results.filter((r) => r.status !== 'ok');

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          total: results.length,
          ok: okCount,
          broken: brokenCount,
          timeout: timeoutCount,
          error: errorCount,
          failed: failedResults,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n\n📊 Results:`);
    console.log(`   Total checked: ${results.length}`);
    console.log(`   ✅ OK:         ${okCount}`);
    console.log(`   ❌ Broken:     ${brokenCount}`);
    console.log(`   ⏱️  Timeout:    ${timeoutCount}`);
    console.log(`   ⚠️  Error:      ${errorCount}`);

    if (failedResults.length > 0 && failedResults.length <= 50) {
      console.log(`\n   Failed URLs:`);
      for (const r of failedResults) {
        console.log(`   - [${r.status}] ${r.image_url.substring(0, 80)} (${r.httpStatus || r.error})`);
      }
    }
  }

  // Fix mode: nullify broken URLs
  if (fix && failedResults.length > 0) {
    const brokenIds = failedResults.map((r) => r.id);
    if (!jsonOutput) {
      console.log(`\n🔧 Nullifying image_url for ${brokenIds.length} broken events...`);
    }

    // Batch update in chunks of 100
    for (let i = 0; i < brokenIds.length; i += 100) {
      const chunk = brokenIds.slice(i, i + 100);
      const { error: updateError } = await supabase
        .from('events')
        .update({ image_url: null })
        .in('id', chunk);
      if (updateError) {
        console.error(`  Failed to update batch ${i}: ${updateError.message}`);
      }
    }

    if (!jsonOutput) {
      console.log(`   Done. ${brokenIds.length} URLs nullified.`);
      console.log(`   These events will now show category fallback images.`);
    }
  } else if (fix && failedResults.length === 0) {
    if (!jsonOutput) console.log('\n✅ No broken URLs found — nothing to fix.');
  }
}

main().catch(console.error);
