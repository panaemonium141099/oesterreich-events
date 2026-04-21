/**
 * Test the local-LLM enrichment against 20 diverse events.
 *
 * For each sampled event:
 *   1. Fetch source_url and extract main text
 *   2. Send metadata + page content to Qwen
 *   3. Print input + Qwen verdict side-by-side
 *
 * No DB writes. Use this to sanity-check output quality before running
 * the batch over all 81k events.
 *
 * Usage:
 *   npm run test-enrichment
 *   npm run test-enrichment -- --sample 30
 *   npm run test-enrichment -- --no-fetch      (skip URL fetch, metadata-only)
 *   npm run test-enrichment -- --model qwen2.5-7b-instruct
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

import { createClient } from '@supabase/supabase-js';
import { enrichEvent, type EnrichmentInput } from '../lib/category-classifier/enrich';
import { fetchEventPage } from '../lib/category-classifier/fetch-page';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
  };
  return {
    sample: parseInt(get('--sample') ?? '20', 10),
    model: get('--model'),
    baseUrl: get('--base-url'),
    noFetch: args.includes('--no-fetch'),
  };
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

  const categoriesToSample = [
    'Musik', 'Nightlife', 'Wein & Kulinarik', 'Kultur', 'Märkte',
    'Sport', 'Familie', 'Natur', 'Feste & Brauchtum', 'Bildung',
    'Religion', 'Wirtschaft',
  ];

  const eventsByCategory: Array<{ category: string; row: Record<string, unknown> }> = [];
  const perCategoryQuota = Math.ceil(opts.sample / categoriesToSample.length);

  for (const cat of categoriesToSample) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, description, category, tags, location_name, organizer, start_date, end_date, price_text, price_min, price_max, source_tags_raw, source_url')
      .eq('publish_status', 'published')
      .eq('category', cat)
      .gte('start_date', today)
      .not('source_url', 'is', null)
      .order('quality_score', { ascending: false, nullsFirst: false })
      .limit(perCategoryQuota);
    if (error) {
      console.error(`[sample] ${cat}: ${error.message}`);
      continue;
    }
    for (const row of data ?? []) {
      eventsByCategory.push({ category: cat, row: row as Record<string, unknown> });
    }
  }

  const sampled = eventsByCategory.slice(0, opts.sample);
  console.log(`\nTest-Enrichment gegen ${sampled.length} diverse Events`);
  console.log(`  LM Studio:  ${process.env.LOCAL_AI_BASE_URL ?? 'http://localhost:1234/v1'}`);
  console.log(`  Model:      ${opts.model ?? process.env.LOCAL_AI_MODEL ?? 'qwen2.5-14b-instruct'}`);
  console.log(`  URL fetch:  ${opts.noFetch ? 'DISABLED' : 'ENABLED'}`);
  console.log('─'.repeat(80));

  let ok = 0, failed = 0, fetchOk = 0, fetchFailed = 0;
  const totalStart = Date.now();

  for (let i = 0; i < sampled.length; i++) {
    const { row } = sampled[i];
    const sourceUrl = (row.source_url as string | null) ?? null;
    const tStart = Date.now();

    // 1. Fetch page (unless disabled)
    let pageContent: string | null = null;
    let fetchError: string | undefined;
    let fetchMs = 0;
    if (!opts.noFetch && sourceUrl) {
      const fetchStart = Date.now();
      const page = await fetchEventPage(sourceUrl);
      fetchMs = Date.now() - fetchStart;
      if (page.ok) {
        pageContent = page.text;
        fetchOk += 1;
      } else {
        fetchFailed += 1;
        fetchError = page.error;
      }
    }

    // 2. Send to Qwen
    const input: EnrichmentInput = {
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      category: (row.category as string | null) ?? null,
      tagsRaw: (row.source_tags_raw as string[] | null) ?? (row.tags as string[] | null) ?? null,
      locationName: (row.location_name as string | null) ?? null,
      organizer: (row.organizer as string | null) ?? null,
      startDate: (row.start_date as string | null) ?? null,
      endDate: (row.end_date as string | null) ?? null,
      priceText: (row.price_text as string | null) ?? null,
      priceMin: (row.price_min as number | null) ?? null,
      priceMax: (row.price_max as number | null) ?? null,
      pageContent,
    };

    const aiStart = Date.now();
    const res = await enrichEvent(input, {
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}),
    });
    const aiMs = Date.now() - aiStart;
    const totalMs = Date.now() - tStart;

    console.log(`\n[${i + 1}/${sampled.length}] total=${(totalMs / 1000).toFixed(1)}s  (fetch=${(fetchMs / 1000).toFixed(1)}s ai=${(aiMs / 1000).toFixed(1)}s)  ${res.ok ? '✓' : '✗ ' + (res.error ?? '')}`);
    console.log(`  TITEL:       ${input.title}`);
    if (input.locationName) console.log(`  ORT:         ${input.locationName}`);
    console.log(`  KATEGORIE:   ${input.category ?? '(keine)'}`);
    if (sourceUrl) {
      const shortUrl = sourceUrl.length > 70 ? sourceUrl.slice(0, 70) + '…' : sourceUrl;
      console.log(`  URL:         ${shortUrl}`);
      if (!opts.noFetch) {
        if (pageContent) {
          console.log(`  PAGE-FETCH:  ✓ ${pageContent.length} chars extracted`);
        } else {
          console.log(`  PAGE-FETCH:  ✗ ${fetchError ?? 'skipped'}`);
        }
      }
    }
    if (res.ok) {
      console.log(`  tags:               ${res.result.tags.join(', ') || '-'}`);
      console.log(`  audience:           ${res.result.audience.join(', ') || '-'}`);
      console.log(`  vibe:               ${res.result.vibe.join(', ') || '-'}`);
      console.log(`  setting:            ${res.result.setting.join(', ') || '-'}`);
      console.log(`  language:           ${res.result.language ?? '-'}`);
      console.log(`  price_tier:         ${res.result.price_tier ?? '-'}`);
      console.log(`  duration_type:      ${res.result.duration_type ?? '-'}`);
      console.log(`  student_friendly:   ${res.result.is_student_friendly}`);
      console.log(`  family_friendly:    ${res.result.is_family_friendly}`);
      if (res.result.suggested_description) {
        const s = res.result.suggested_description;
        console.log(`  → suggested_desc:   ${s.length > 120 ? s.slice(0, 120) + '…' : s}`);
      }
      if (res.result.suggested_price_text) {
        console.log(`  → suggested_price:  ${res.result.suggested_price_text}`);
      }
      ok += 1;
    } else {
      failed += 1;
    }
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  const avgPerEvent = sampled.length > 0 ? (Number(totalElapsed) / sampled.length).toFixed(2) : '-';
  const extrapolated = (81000 * Number(avgPerEvent) / 3600).toFixed(1);
  const extrapolated5x = (81000 * Number(avgPerEvent) / (3600 * 5)).toFixed(1);

  console.log('\n' + '─'.repeat(80));
  console.log(`AI:    ok=${ok}  failed=${failed}`);
  if (!opts.noFetch) {
    console.log(`Fetch: ok=${fetchOk}  failed=${fetchFailed}  (Rest wurde ohne Page-Content klassifiziert)`);
  }
  console.log(`Total: ${totalElapsed}s  avg=${avgPerEvent}s/event`);
  console.log(`Extrapoliert auf 81k Events:`);
  console.log(`  sequentiell:       ~${extrapolated} Stunden`);
  console.log(`  mit 5 parallel:    ~${extrapolated5x} Stunden (Fetch parallel, AI serialisiert durch LM Studio)`);
}

main().catch((err) => {
  console.error('test-enrichment failed:', err);
  process.exit(1);
});
