/**
 * Category classification AI fallback — hard-case batch classifier.
 *
 * Selects only events the deterministic classifier could not resolve:
 *   - category_version IS NULL  (never classified)
 *   - category_version != cat-v1 (stale — reclassify)
 *   - category_needs_review = TRUE (flagged by the inline classifier)
 *   - category IS NULL / 'Sonstiges' (fallback, needs AI)
 *
 * Mirrors the robustness style of openai-geocode.ts:
 *   - Checkpoint / resume
 *   - Versioned SQLite cache
 *   - Dry-run
 *   - Rate limiting
 *   - Audit log
 *   - Strong-model retry mode (--retry-low)
 *
 * Usage:
 *   npm run categorize-events
 *   npx tsx src/scripts/categorize-events.ts --dry-run
 *   npx tsx src/scripts/categorize-events.ts --resume
 *   npx tsx src/scripts/categorize-events.ts --all
 *   npx tsx src/scripts/categorize-events.ts --changed-since 2026-04-10
 *   npx tsx src/scripts/categorize-events.ts --retry-low
 *   npx tsx src/scripts/categorize-events.ts --source wien-clubs --limit 100
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local (Next.js does this automatically, but tsx does not)
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
  CLASSIFIER_VERSION,
  categoryConfidenceRank,
  type ClassifierOutcome,
  type AiClient,
} from '../lib/category-classifier';

const openaiApiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!openaiApiKey) {
  console.error('ERROR: Missing OPENAI_API_KEY');
  process.exit(1);
}
if (!supabaseUrl) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}
if (!supabaseServiceKey) {
  console.error('ERROR: Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiApiKey });
// The AiClient surface is a narrow subset of the OpenAI SDK shape; the cast
// bridges the two because the SDK's internal response_format typing is
// stricter than we need here (see src/lib/category-classifier/ai.ts).
const aiClient = openai as unknown as AiClient;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    changedSince: get('--changed-since'),
    source: get('--source'),
    limit: limit && Number.isFinite(limit) && limit > 0 ? limit : undefined,
  } as const;
}

const opts = parseArgs();

// ─── Constants ───────────────────────────────────────────────────────────
const RATE_LIMIT_MS = 200;
const CHECKPOINT_BATCH = 50;
const CHECKPOINT_FILE = path.resolve(
  `data/category-classifier-${opts.retryLow ? 'retrylow' : opts.all ? 'all' : 'needsreview'}-checkpoint.json`,
);

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
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function clearCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
}

// ─── Audit ───────────────────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  action: 'write' | 'cache_hit' | 'kept_existing' | 'skip_locked' | 'ai_error';
  old_category: string | null;
  new_category: string | null;
  old_confidence: string | null;
  new_confidence: string;
  new_source: string;
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
}

const FETCH_COLUMNS =
  'id, title, description, source_name, source_id, source_category_raw, source_tags_raw, ' +
  'location_name, organizer, category, tags, category_confidence, category_source, ' +
  'category_version, category_locked, category_needs_review';

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

    if (!opts.all) {
      // Hard-case filter: events needing review, stale version, or missing classifier metadata.
      query = query.or(
        `category_needs_review.eq.true,` +
        `category_version.is.null,` +
        `category_version.neq.${CLASSIFIER_VERSION},` +
        `category.is.null,` +
        `category.eq.Sonstiges`,
      );
    }

    if (opts.retryLow) {
      // Only revisit rows already tagged ai_low or where the AI previously skipped.
      query = query.in('category_confidence', ['ai_low']);
    }

    if (opts.source) {
      query = query.eq('source_name', opts.source);
    }

    if (opts.changedSince) {
      query = query.gte('updated_at', opts.changedSince);
    }

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

  return opts.limit ? out.slice(0, opts.limit) : out;
}

// ─── Apply an outcome to Supabase ────────────────────────────────────────
async function applyOutcome(
  eventId: string,
  outcome: ClassifierOutcome,
  dryRun: boolean,
): Promise<boolean> {
  if (dryRun) return true;
  const { error } = await supabase
    .from('events')
    .update({
      category: outcome.category,
      tags: outcome.tags,
      category_confidence: outcome.confidence,
      category_source: outcome.source,
      category_version: outcome.version,
      category_needs_review: outcome.needsReview,
      category_reason: outcome.reason,
      category_candidates: outcome.candidates,
    })
    .eq('id', eventId);
  if (error) {
    console.error(`[categorize-events] update ${eventId} failed: ${error.message}`);
    return false;
  }
  return true;
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  const mode = opts.all
    ? 'ALL'
    : opts.retryLow
      ? 'RETRY-LOW'
      : 'NEEDS-REVIEW';
  console.log(`\nCategory Classifier [${mode}] — ${opts.dryRun ? 'DRY RUN' : 'LIVE'}${opts.resume ? ' (RESUME)' : ''}`);
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

  // Resume
  const processed = new Set<string>();
  if (opts.resume) {
    const cp = loadCheckpoint();
    if (cp) {
      cp.processedIds.forEach(id => processed.add(id));
      console.log(`  Resuming: ${processed.size} already processed.`);
    }
  }

  const pending = events.filter(e => !processed.has(e.id));
  console.log(`  Remaining to classify: ${pending.length}`);

  const audit: AuditEntry[] = [];
  let aiCalls = 0;
  let cacheHits = 0;
  let written = 0;
  let keptExisting = 0;
  let skippedLocked = 0;
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
        new_confidence: e.category_confidence ?? 'manual',
        new_source: e.category_source ?? 'manual',
        reason: 'category_locked=true',
      });
      skippedLocked++;
      processedIds.push(e.id);
      continue;
    }

    let outcome: ClassifierOutcome;
    try {
      outcome = await classifyWithAiFallback(
        {
          title: e.title,
          description: e.description,
          source_tags_raw: e.source_tags_raw,
          source_category_raw: e.source_category_raw,
          source_name: e.source_name,
          organizer: e.organizer,
          location_name: e.location_name,
        },
        { ai: aiClient, useStrongModel: opts.retryLow },
      );
    } catch (err) {
      aiErrors++;
      audit.push({
        id: e.id,
        action: 'ai_error',
        old_category: e.category,
        new_category: e.category,
        old_confidence: e.category_confidence,
        new_confidence: e.category_confidence ?? 'ai_low',
        new_source: e.category_source ?? 'ai',
        reason: `ai_error: ${err instanceof Error ? err.message : String(err)}`,
      });
      processedIds.push(e.id);
      if (!opts.dryRun) await sleep(RATE_LIMIT_MS);
      continue;
    }

    if (outcome.usedAi) {
      aiCalls++;
    } else if (outcome.reason.startsWith('cached')) {
      cacheHits++;
    }

    // Confidence-rank precedence: never downgrade silently.
    const existingRank = categoryConfidenceRank(e.category_confidence);
    const newRank = categoryConfidenceRank(outcome.confidence);
    if (
      e.category_confidence &&
      e.category_version === CLASSIFIER_VERSION &&
      existingRank < newRank &&
      !e.category_needs_review
    ) {
      audit.push({
        id: e.id,
        action: 'kept_existing',
        old_category: e.category,
        new_category: e.category,
        old_confidence: e.category_confidence,
        new_confidence: e.category_confidence,
        new_source: e.category_source ?? 'rules',
        reason: `kept existing ${e.category_confidence} over new ${outcome.confidence}`,
      });
      keptExisting++;
      processedIds.push(e.id);
    } else {
      const ok = await applyOutcome(e.id, outcome, opts.dryRun);
      if (ok) {
        written++;
        audit.push({
          id: e.id,
          action: outcome.reason.startsWith('cached') ? 'cache_hit' : 'write',
          old_category: e.category,
          new_category: outcome.category,
          old_confidence: e.category_confidence,
          new_confidence: outcome.confidence,
          new_source: outcome.source,
          reason: outcome.reason.slice(0, 160),
        });
      } else {
        aiErrors++;
      }
      processedIds.push(e.id);
    }

    if (!opts.dryRun && (i + 1) % CHECKPOINT_BATCH === 0) {
      saveCheckpoint(processedIds);
    }
    if (outcome.usedAi && !outcome.reason.startsWith('cached')) {
      await sleep(RATE_LIMIT_MS);
    }
    process.stdout.write(
      `  ${i + 1}/${pending.length} | ai=${aiCalls} cache=${cacheHits} kept=${keptExisting} wrote=${written}\r`,
    );
  }

  // Report
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('CATEGORY CLASSIFIER REPORT');
  console.log('='.repeat(60));
  console.log(`  Mode:              ${mode}`);
  console.log(`  Candidates:        ${events.length}`);
  console.log(`  AI calls:          ${aiCalls}`);
  console.log(`  Cache hits:        ${cacheHits}`);
  console.log(`  Written:           ${written}`);
  console.log(`  Kept existing:     ${keptExisting}`);
  console.log(`  Locked skipped:    ${skippedLocked}`);
  console.log(`  AI errors:         ${aiErrors}`);

  if (audit.length > 0) {
    const counts: Record<string, number> = {};
    for (const a of audit) counts[a.action] = (counts[a.action] ?? 0) + 1;
    console.log('\n  Action breakdown:');
    for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k}: ${v}`);
    }
  }

  if (!opts.dryRun) {
    clearCheckpoint();
    console.log('\n  Done. Checkpoint cleared.');
  } else {
    console.log('\n  DRY RUN complete. Re-run without --dry-run to apply.');
  }
}

main().catch(err => {
  console.error('categorize-events failed:', err);
  process.exit(1);
});
