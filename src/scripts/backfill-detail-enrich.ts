// src/scripts/backfill-detail-enrich.ts
//
// Offline replay: pulls future events with source_url + missing address,
// fetches detail HTML, runs enrichFromDetailHtml + mergeEnrichment, writes
// back to Supabase. Per-host throttling + global concurrency + resume.
//
// Examples:
//   npm run backfill:detail
//   npm run backfill:detail -- --source falter
//   npm run backfill:detail -- --source meinbezirk --limit 100 --dry-run
//   npm run backfill:detail -- --concurrency 6 --per-host 2
//   npm run backfill:detail -- --retry-failed
//
// Spec: docs/superpowers/specs/2026-05-21-detail-fetch-system-design.md §10

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { enrichFromDetailHtml } from '../lib/scrapers/detail-extract/extract';
import { mergeEnrichment } from '../lib/scrapers/detail-extract/merge';
import type { ScrapedEvent } from '@/types/events';

const CHECKPOINT_PATH = 'data/backfill-detail-checkpoint.json';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

interface Row {
  id: string;
  source_name: string;
  source_url: string;
  title: string;
  address: string | null;
  description: string | null;
  price_text: string | null;
  location_name: string | null;
  postal_code: string | null;
  price_min: number | null;
  price_max: number | null;
  organizer: string | null;
  image_url: string | null;
  last_detail_fetch_status: string | null;
}

interface Stats {
  fetched: number;
  success: number;
  no_change: number;
  http_error: number;
  timeout: number;
  invalid_html: number;
  parse_empty: number;
}

const PUBLISH_STATUSES = ['published', 'published_low_confidence', 'draft', 'needs_review'];

async function main() {
  const source = arg('source');
  const limit = parseInt(arg('limit', '0')!, 10);
  const concurrency = parseInt(arg('concurrency', '4')!, 10);
  const perHostMax = parseInt(arg('per-host', '2')!, 10);
  const since = arg('since');
  const dryRun = hasFlag('dry-run');
  const retryFailed = hasFlag('retry-failed');
  const verbose = hasFlag('verbose');
  const detailTimeoutMs = parseInt(arg('detail-timeout', '10000')!, 10);

  console.log(`mode: ${dryRun ? 'dry-run' : 'WRITE'}  source=${source ?? 'ALL'}  limit=${limit || '∞'}  concurrency=${concurrency}/per-host=${perHostMax}`);

  const today = new Date().toISOString().slice(0, 10);

  // Fetch eligible events. Paginated because PostgREST caps single queries.
  const events: Row[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    let q = sb.from('events')
      .select('id,source_name,source_url,title,address,description,price_text,location_name,postal_code,price_min,price_max,organizer,image_url,last_detail_fetch_status')
      .gte('start_date', today)
      .in('publish_status', PUBLISH_STATUSES)
      .not('source_url', 'is', null)
      .is('address', null)
      .range(from, from + pageSize - 1);
    if (source) q = q.eq('source_name', source);
    if (since) q = q.gte('updated_at', since);
    if (!retryFailed) {
      q = q.or('last_detail_fetch_status.is.null,last_detail_fetch_status.in.(success,no_change)');
    }
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    events.push(...(data as Row[]));
    if (data.length < pageSize) break;
    from += pageSize;
    if (limit > 0 && events.length >= limit) break;
  }

  const work = limit > 0 ? events.slice(0, limit) : events;
  console.log(`loaded ${work.length} eligible events`);
  if (work.length === 0) return;

  // Group by host for per-host throttling
  work.sort((a, b) => safeHost(a.source_url).localeCompare(safeHost(b.source_url)));

  // Resume checkpoint
  let resumeIdx = 0;
  if (existsSync(CHECKPOINT_PATH) && !dryRun) {
    try {
      const cp = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8'));
      if (cp.runId === checksum(work) && cp.lastIndex) {
        resumeIdx = cp.lastIndex;
        console.log(`resuming from index ${resumeIdx}`);
      }
    } catch { /* no resume */ }
  }

  const stats: Stats = { fetched: 0, success: 0, no_change: 0, http_error: 0, timeout: 0, invalid_html: 0, parse_empty: 0 };
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const hostCounts = new Map<string, number>();
  const queue = work.slice(resumeIdx);
  let processed = resumeIdx;
  let active = 0;

  await new Promise<void>((resolve) => {
    const tick = () => {
      while (active < concurrency && queue.length) {
        const idx = queue.findIndex((e) => (hostCounts.get(safeHost(e.source_url)) ?? 0) < perHostMax);
        if (idx === -1) break;
        const [next] = queue.splice(idx, 1);
        const host = safeHost(next.source_url);
        hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
        active++;
        void process(next).finally(async () => {
          hostCounts.set(host, (hostCounts.get(host) ?? 1) - 1);
          active--;
          processed++;
          if (processed % 50 === 0) await flushUpdates(processed);
          if (active === 0 && queue.length === 0) {
            await flushUpdates(processed);
            resolve();
          } else tick();
        });
      }
      if (active === 0 && queue.length === 0) resolve();
    };
    tick();
  });

  console.log(`\n=== DONE ===\n${JSON.stringify(stats, null, 2)}`);
  if (!dryRun) {
    if (existsSync(CHECKPOINT_PATH)) {
      try { writeFileSync(CHECKPOINT_PATH, JSON.stringify({ runId: '', lastIndex: 0 })); } catch { /* ignore */ }
    }
  }

  async function process(e: Row): Promise<void> {
    stats.fetched++;
    const evt: ScrapedEvent = {
      source_id: e.id,
      source_name: e.source_name,
      source_url: e.source_url,
      title: e.title,
      start_date: '',
      address: e.address ?? undefined,
      description: e.description ?? undefined,
      price_text: e.price_text ?? undefined,
      location_name: e.location_name ?? undefined,
      postal_code: e.postal_code ?? undefined,
      price_min: e.price_min ?? undefined,
      price_max: e.price_max ?? undefined,
      organizer: e.organizer ?? undefined,
      image_url: e.image_url ?? undefined,
    };
    try {
      const html = await fetchHtml(e.source_url, detailTimeoutMs);
      if (!html) { stats.parse_empty++; queueUpdate(e.id, 'parse_empty'); return; }
      const enrichment = enrichFromDetailHtml(e.source_name, e.source_url, html);
      if (enrichment.layersHit.length === 0) { stats.invalid_html++; queueUpdate(e.id, 'invalid_html'); return; }
      const before = JSON.stringify({ a: evt.address, d: evt.description, p: evt.price_text });
      mergeEnrichment(evt, enrichment);
      const after = JSON.stringify({ a: evt.address, d: evt.description, p: evt.price_text });
      // Only claim confidence when the post-merge event actually carries
      // the extracted address. Otherwise the merge rejected it (invalid
      // street text) and we shouldn't persist a stale "high" confidence.
      const persistedConfidence = evt.address ? enrichment.address_confidence : undefined;
      if (before === after) {
        stats.no_change++;
        queueUpdate(e.id, 'no_change', persistedConfidence);
      } else {
        stats.success++;
        queueUpdate(e.id, 'success', persistedConfidence, {
          address: evt.address,
          postal_code: evt.postal_code,
          location_name: evt.location_name,
          description: evt.description,
          price_text: evt.price_text,
          price_min: evt.price_min,
          price_max: evt.price_max,
          organizer: evt.organizer,
          image_url: evt.image_url,
        });
      }
      if (verbose) {
        const ttl = (e.title ?? '').slice(0, 40);
        const layers = enrichment.layersHit.join(',');
        const addr = (evt.address ?? '∅').slice(0, 30);
        console.log(`  ✓ [${layers.padEnd(20)}] ${ttl.padEnd(40)} → ${addr}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/timeout|abort/i.test(msg)) { stats.timeout++; queueUpdate(e.id, 'timeout'); }
      else { stats.http_error++; queueUpdate(e.id, 'http_error'); }
      if (verbose) console.log(`  ✗ ${msg.slice(0, 80)}`);
    }
  }

  function queueUpdate(
    id: string,
    status: string,
    confidence?: string,
    patch?: Partial<ScrapedEvent>,
  ): void {
    updates.push({
      id,
      patch: {
        ...(patch ?? {}),
        last_detail_fetch_at: new Date().toISOString(),
        last_detail_fetch_status: status,
        ...(confidence ? { address_confidence: confidence } : {}),
      },
    });
  }

  async function flushUpdates(idx: number): Promise<void> {
    if (dryRun) {
      if (updates.length > 0) console.log(`  [dry-run] would persist ${updates.length} updates  (processed=${idx})`);
      updates.length = 0;
      return;
    }
    if (updates.length === 0) return;
    const batch = updates.splice(0, updates.length);
    let okCount = 0;
    let failCount = 0;
    await Promise.all(batch.map(async (u) => {
      const { error } = await sb.from('events').update(u.patch).eq('id', u.id);
      if (error) { failCount++; console.error(`update ${u.id} failed: ${error.message}`); }
      else okCount++;
    }));
    console.log(`  flushed ${okCount} updates (${failCount} failed)  processed=${idx}/${work.length}  stats=${JSON.stringify(stats)}`);
    saveCheckpoint(idx);
  }

  function saveCheckpoint(idx: number): void {
    if (!existsSync(dirname(CHECKPOINT_PATH))) mkdirSync(dirname(CHECKPOINT_PATH), { recursive: true });
    writeFileSync(CHECKPOINT_PATH, JSON.stringify({ runId: checksum(work), lastIndex: idx, savedAt: new Date().toISOString() }));
  }
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'osterreich-events-backfill/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}

function safeHost(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

function checksum(rows: Row[]): string {
  return rows.length + ':' + (rows[0]?.id ?? '') + ':' + (rows[rows.length - 1]?.id ?? '');
}

main().catch((e) => { console.error(e); process.exit(1); });
