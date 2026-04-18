/**
 * Category classifier — batch runner (cat-v2).
 *
 * Two operating modes:
 *
 *   --deterministic-backfill
 *     Runs only the deterministic classifier (no OpenAI). Picks up any event
 *     with stale/missing classifier version. Idempotent; only writes rows
 *     where `changed === true` from reconcile. Free, fast, bulk.
 *
 *   (default = AI residue)
 *     Runs deterministic-first; for events the rules cannot resolve, calls
 *     OpenAI. Filters to `category_needs_review=true` OR the hard-case
 *     signals listed in the plan.
 *
 * Usage:
 *   npm run categorize-events -- --deterministic-backfill --dry-run
 *   npm run categorize-events -- --deterministic-backfill
 *   npm run categorize-events -- --dry-run --limit 200
 *   npm run categorize-events -- --retry-low
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local manually so plain tsx works without --env-file.
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
} catch { /* .env.local not found */ }

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import {
  classifyWithAiFallback,
  resolveCanonicalCategory,
  reconcile,
  CLASSIFIER_VERSION,
  CLASSIFIER_VERSION_PREFIX,
  type ClassifierOutcome,
  type AiClient,
  type ExistingCategoryRow,
  type CanonicalCategory,
} from '../lib/category-classifier';

// ─── CLI args ────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  const has = (flag: string) => args.includes(flag);
  const limitRaw = get('--limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
  return {
    dryRun: has('--dry-run'),
    resume: has('--resume'),
    all: has('--all'),
    retryLow: has('--retry-low'),
    deterministicBackfill: has('--deterministic-backfill'),
    changedSince: get('--changed-since'),
    source: get('--source'),
    limit: limit && Number.isFinite(limit) && limit > 0 ? limit : undefined,
  } as const;
}

const opts = parseArgs();

// ─── Supabase + OpenAI clients ───────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// OpenAI is ONLY needed for the AI-residue mode. Skip init for backfill.
const aiClient: AiClient | null = (() => {
  if (opts.deterministicBackfill) return null;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('ERROR: Missing OPENAI_API_KEY (needed for AI residue mode)');
    process.exit(1);
  }
  const client = new OpenAI({ apiKey: openaiApiKey });
  return client as unknown as AiClient;
})();

// ─── Constants ───────────────────────────────────────────────────────────
const RATE_LIMIT_MS = 200;
const CHECKPOINT_BATCH = 50;
const modeTag = opts.deterministicBackfill
  ? 'backfill'
  : opts.retryLow
    ? 'retrylow'
    : opts.all
      ? 'all'
      : 'needsreview';
const CHECKPOINT_FILE = path.resolve(`data/category-classifier-${modeTag}-checkpoint.json`);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Checkpoint ──────────────────────────────────────────────────────────
interface Checkpoint {
  processedIds: string[];
  timestamp: string;
}

function saveCheckpoint(processedIds: string[]): void {
  const data: Checkpoint = { processedIds, timestamp: new Date().toISOString() };
  fs.mkdirSync(path.dirname(CHECKPOINT_FILE), { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')); }
  catch { return null; }
}

function clearCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
}

// ─── Audit ───────────────────────────────────────────────────────────────
type Action =
  | 'write'
  | 'noop'
  | 'cache_hit'
  | 'kept_existing'
  | 'skip_locked'
  | 'ai_error'
  | 'needs_ai_deferred';

interface AuditEntry {
  id: string;
  action: Action;
  old_category: string | null;
  new_category: string | null;
  old_confidence: string | null;
  new_confidence: string | null;
  gate: string | null;
  reason: string;
}

// ─── Events fetcher ──────────────────────────────────────────────────────
interface EventRow {
  id: string;
  title: string;
  description: string | null;
  source_name: string | null;
  source_id: string | null;
  source_category_raw: string | null;
  source_tags_raw: string[] | null;
  location_name: string | null;
  organizer: string | null;
  category: string | null;
  tags: string[] | null;
  category_confidence: string | null;
  category_source: string | null;
  category_version: string | null;
  category_locked: boolean | null;
  category_needs_review: boolean | null;
  category_reason: string | null;
  category_candidates: unknown;
}

const FETCH_COLUMNS =
  'id, title, description, source_name, source_id, source_category_raw, source_tags_raw, ' +
  'location_name, organizer, category, tags, category_confidence, category_source, ' +
  'category_version, category_locked, category_needs_review, category_reason, category_candidates';

async function fetchEvents(): Promise<EventRow[]> {
  const out: EventRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    let query = supabase
      .from('events')
      .select(FETCH_COLUMNS)
      .eq('category_locked', false)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (opts.deterministicBackfill) {
      // Backfill: any row not at the current version prefix is stale.
      // Supabase PostgREST: OR-clause for IS NULL + version mismatch.
      query = query.or(
        `category_version.is.null,` +
        `category_version.not.ilike.${CLASSIFIER_VERSION_PREFIX}%`,
      );
    } else if (!opts.all) {
      // AI residue: needs review, stale, missing, or Sonstiges fallback.
      query = query.or(
        `category_needs_review.eq.true,` +
        `category_version.is.null,` +
        `category_version.neq.${CLASSIFIER_VERSION},` +
        `category.is.null,` +
        `category.eq.Sonstiges`,
      );
    }

    if (opts.retryLow) {
      query = query.in('category_confidence', ['ai_low']);
    }
    if (opts.source) query = query.eq('source_name', opts.source);
    if (opts.changedSince) query = query.gte('updated_at', opts.changedSince);

    const { data, error } = await query;
    if (error) {
      console.error('[categorize-events] fetch error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    out.push(...(data as unknown as EventRow[]));
    from += data.length;
    process.stdout.write(`  Fetched ${out.length}...\r`);
    if (data.length < pageSize) break;
    if (opts.limit && out.length >= opts.limit) break;
  }
  process.stdout.write('\n');
  return opts.limit ? out.slice(0, opts.limit) : out;
}

// ─── Row → ExistingCategoryRow ───────────────────────────────────────────
function asExisting(row: EventRow): ExistingCategoryRow {
  return {
    category: row.category,
    tags: row.tags,
    category_confidence: row.category_confidence,
    category_source: row.category_source,
    category_version: row.category_version,
    category_locked: row.category_locked,
    category_needs_review: row.category_needs_review,
    category_reason: row.category_reason,
    category_candidates: row.category_candidates,
  };
}

// ─── Write helper ────────────────────────────────────────────────────────
async function applyCanonical(
  eventId: string,
  canonical: CanonicalCategory,
  dryRun: boolean,
): Promise<boolean> {
  if (dryRun || !canonical.changed) return !canonical.changed || dryRun;
  const { error } = await supabase
    .from('events')
    .update({
      category: canonical.category,
      tags: canonical.tags,
      category_confidence: canonical.category_confidence,
      category_source: canonical.category_source,
      category_version: canonical.category_version,
      category_needs_review: canonical.category_needs_review,
      category_reason: canonical.category_reason,
      category_candidates: canonical.category_candidates,
    })
    .eq('id', eventId);
  if (error) {
    console.error(`[categorize-events] update ${eventId} failed: ${error.message}`);
    return false;
  }
  return true;
}

async function applyAiOutcome(
  eventId: string,
  existing: ExistingCategoryRow,
  outcome: ClassifierOutcome,
  dryRun: boolean,
): Promise<{ canonical: CanonicalCategory; written: boolean }> {
  // Run the outcome through reconcile so backfill and AI-mode use the same
  // overwrite rules (R10 — no drift between paths).
  const canonical = reconcile(existing, {
    category: outcome.category,
    tags: outcome.tags,
    confidence: outcome.confidence,
    source: outcome.source,
    version: outcome.version,
    needsReview: outcome.needsReview,
    reason: outcome.reason,
    candidates: outcome.candidates,
    needsAi: false,
  });
  const written = await applyCanonical(eventId, canonical, dryRun);
  return { canonical, written };
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  const modeLabel = opts.deterministicBackfill
    ? 'DETERMINISTIC-BACKFILL'
    : opts.retryLow
      ? 'AI RETRY-LOW'
      : opts.all
        ? 'AI ALL'
        : 'AI NEEDS-REVIEW';
  console.log(`\nCategory Classifier [${modeLabel}] — ${opts.dryRun ? 'DRY RUN' : 'LIVE'}${opts.resume ? ' (RESUME)' : ''}`);
  console.log(`  version: ${CLASSIFIER_VERSION}`);
  if (opts.source) console.log(`  source filter: ${opts.source}`);
  if (opts.changedSince) console.log(`  changed-since: ${opts.changedSince}`);
  if (opts.limit) console.log(`  limit: ${opts.limit}`);
  console.log('='.repeat(60));

  const events = await fetchEvents();
  console.log(`  Candidates: ${events.length}`);
  if (events.length === 0) {
    console.log('\nNothing to do.');
    return;
  }

  const processed = new Set<string>();
  if (opts.resume) {
    const cp = loadCheckpoint();
    if (cp) {
      cp.processedIds.forEach(id => processed.add(id));
      console.log(`  Resuming: ${processed.size} already processed.`);
    }
  }

  const pending = events.filter(e => !processed.has(e.id));
  console.log(`  Remaining: ${pending.length}`);

  const audit: AuditEntry[] = [];
  const gateCounts: Record<string, number> = {};
  let aiCalls = 0;
  let cacheHits = 0;
  let writes = 0;
  let noops = 0;
  let skippedLocked = 0;
  let needsAiDeferred = 0;
  let aiErrors = 0;
  const processedIds = Array.from(processed);

  for (let i = 0; i < pending.length; i++) {
    const e = pending[i];

    if (e.category_locked) {
      audit.push({
        id: e.id,
        action: 'skip_locked',
        old_category: e.category,
        new_category: e.category,
        old_confidence: e.category_confidence,
        new_confidence: e.category_confidence,
        gate: null,
        reason: 'category_locked=true',
      });
      skippedLocked += 1;
      processedIds.push(e.id);
      continue;
    }

    const existing = asExisting(e);
    const input = {
      title: e.title,
      description: e.description,
      source_tags_raw: e.source_tags_raw,
      source_category_raw: e.source_category_raw,
      source_name: e.source_name,
      organizer: e.organizer,
      location_name: e.location_name,
    };

    if (opts.deterministicBackfill) {
      // Pure rules pass. No AI under any circumstances.
      const canonical = resolveCanonicalCategory(input, existing);
      const written = await applyCanonical(e.id, canonical, opts.dryRun);
      const gate = extractGate(canonical.category_reason);
      gateCounts[gate] = (gateCounts[gate] ?? 0) + 1;

      if (canonical.changed) {
        if (written) writes += 1;
        else aiErrors += 1;
        audit.push({
          id: e.id,
          action: 'write',
          old_category: e.category,
          new_category: canonical.category,
          old_confidence: e.category_confidence,
          new_confidence: canonical.category_confidence,
          gate,
          reason: canonical.reconcileReason,
        });
      } else {
        noops += 1;
        audit.push({
          id: e.id,
          action: 'noop',
          old_category: e.category,
          new_category: canonical.category,
          old_confidence: e.category_confidence,
          new_confidence: canonical.category_confidence,
          gate,
          reason: canonical.reconcileReason,
        });
      }
      processedIds.push(e.id);
    } else {
      // AI-residue mode. Skip rows whose rules DID resolve already.
      if (!aiClient) {
        console.error('AI client not available in backfill-only mode.');
        process.exit(1);
      }
      let outcome: ClassifierOutcome;
      try {
        outcome = await classifyWithAiFallback(input, {
          ai: aiClient,
          useStrongModel: opts.retryLow,
        });
      } catch (err) {
        aiErrors += 1;
        audit.push({
          id: e.id,
          action: 'ai_error',
          old_category: e.category,
          new_category: e.category,
          old_confidence: e.category_confidence,
          new_confidence: e.category_confidence,
          gate: null,
          reason: `ai_error: ${err instanceof Error ? err.message : String(err)}`,
        });
        processedIds.push(e.id);
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      if (outcome.usedAi) aiCalls += 1;
      if (outcome.reason.startsWith('cached')) cacheHits += 1;

      const { canonical, written } = await applyAiOutcome(e.id, existing, outcome, opts.dryRun);

      if (canonical.changed) {
        if (written) writes += 1;
        audit.push({
          id: e.id,
          action: outcome.reason.startsWith('cached') ? 'cache_hit' : 'write',
          old_category: e.category,
          new_category: canonical.category,
          old_confidence: e.category_confidence,
          new_confidence: canonical.category_confidence,
          gate: canonical.reconcileReason,
          reason: outcome.reason.slice(0, 160),
        });
      } else {
        noops += 1;
        audit.push({
          id: e.id,
          action: outcome.needsReview ? 'needs_ai_deferred' : 'noop',
          old_category: e.category,
          new_category: canonical.category,
          old_confidence: e.category_confidence,
          new_confidence: canonical.category_confidence,
          gate: canonical.reconcileReason,
          reason: outcome.reason.slice(0, 160),
        });
        if (outcome.needsReview) needsAiDeferred += 1;
      }
      processedIds.push(e.id);
      if (outcome.usedAi && !outcome.reason.startsWith('cached')) await sleep(RATE_LIMIT_MS);
    }

    if (!opts.dryRun && (i + 1) % CHECKPOINT_BATCH === 0) {
      saveCheckpoint(processedIds);
    }
    process.stdout.write(
      `  ${i + 1}/${pending.length} | write=${writes} noop=${noops} ai=${aiCalls} cache=${cacheHits}\r`,
    );
  }

  // ── Report ─────────────────────────────────────────────────────────────
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('CATEGORY CLASSIFIER REPORT');
  console.log('='.repeat(60));
  console.log(`  Mode:             ${modeLabel}`);
  console.log(`  Version:          ${CLASSIFIER_VERSION}`);
  console.log(`  Candidates:       ${events.length}`);
  console.log(`  Writes:           ${writes}`);
  console.log(`  No-ops:           ${noops}`);
  console.log(`  Rewrite rate:     ${events.length > 0 ? ((writes / events.length) * 100).toFixed(1) : '0.0'}%`);
  if (!opts.deterministicBackfill) {
    console.log(`  AI calls:         ${aiCalls}`);
    console.log(`  Cache hits:       ${cacheHits}`);
    console.log(`  Needs-AI deferred:${needsAiDeferred}`);
  }
  console.log(`  Locked skipped:   ${skippedLocked}`);
  console.log(`  Errors:           ${aiErrors}`);

  if (Object.keys(gateCounts).length > 0) {
    console.log('\n  Gate distribution:');
    for (const [g, n] of Object.entries(gateCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${g.padEnd(32)} ${String(n).padStart(6)}`);
    }
  }

  // Persist a compact audit JSON (only for LIVE runs).
  if (!opts.dryRun) {
    const auditDir = path.resolve(`data/classifier-audit/${Date.now()}-${modeTag}`);
    fs.mkdirSync(auditDir, { recursive: true });
    fs.writeFileSync(
      path.join(auditDir, 'backfill-audit.json'),
      JSON.stringify({
        mode: modeLabel,
        version: CLASSIFIER_VERSION,
        totals: { events: events.length, writes, noops, aiCalls, cacheHits, skippedLocked, aiErrors, needsAiDeferred },
        gateCounts,
        audit_sample: audit.slice(0, 200),
      }, null, 2),
    );
    clearCheckpoint();
    console.log(`\n  Audit: ${auditDir}/backfill-audit.json`);
  } else {
    console.log('\n  DRY RUN — no writes performed.');
  }
}

function extractGate(reason: string | null): string {
  if (!reason) return 'unknown';
  const m = /^([a-z0-9_]+):/i.exec(reason);
  return m ? m[1] : reason.slice(0, 24);
}

main().catch(err => {
  console.error('categorize-events failed:', err);
  process.exit(1);
});
