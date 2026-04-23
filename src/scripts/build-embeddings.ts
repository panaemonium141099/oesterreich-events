/**
 * Build OpenAI embeddings for every event and store in events.embedding.
 *
 * Feeds the semantic-search endpoint (/api/search/semantic) which
 * answers natural-language queries like:
 *   "Ich bin Student und will heute abend billig saufen gehen"
 *
 * The query is embedded at request-time with the same model and cosine-
 * matched against pre-computed event embeddings via the pgvector index.
 *
 * Source text composed per event:
 *   title
 *   description (HTML-stripped, first 500 chars)
 *   category
 *   tags (comma-joined)
 *   audience + vibe + occasion_tags (comma-joined)
 *
 * This gives the embedding enough context to differentiate "billig
 * saufen" ≈ "shot-night studenten günstig bar-night" without needing
 * every such phrase as an explicit tag.
 *
 * Cost (text-embedding-3-small): $0.02 per 1M input tokens.
 * ≈ 300 tokens/event × 42k events × $0.02 / 1M = $0.25 total.
 *
 * Resume-safe via embedding_hash — only re-embeds rows whose source
 * text hash differs from what's stored.
 *
 * Usage:
 *   npm run build-embeddings                    # all events
 *   npm run build-embeddings -- --dry-run       # preview, no writes
 *   npm run build-embeddings -- --limit 1000    # batch test
 *   npm run build-embeddings -- --force         # re-embed every row
 *                                                 (e.g. after model switch)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

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

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;
const BATCH_SIZE = 100; // OpenAI accepts up to 2048 inputs per call; 100 keeps memory reasonable

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  audience: string[] | null;
  vibe: string[] | null;
  occasion_tags: string[] | null;
  embedding_hash: string | null;
}

interface Opts {
  dryRun: boolean;
  limit: number | null;
  force: boolean;
}

function parseArgs(): Opts {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
  };
  return {
    dryRun: args.includes('--dry-run'),
    limit: get('--limit') ? parseInt(get('--limit')!, 10) : null,
    force: args.includes('--force'),
  };
}

/**
 * Build the canonical source text for an event's embedding.
 * Order-independent fields joined with newlines so the model sees clear
 * boundaries. HTML and excessive whitespace stripped.
 */
function buildSourceText(ev: EventRow): string {
  const strip = (s: string | null) =>
    (s ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

  const parts = [
    ev.title?.trim() ?? '',
    ev.category ?? '',
    strip(ev.description),
    (ev.tags ?? []).join(', '),
    (ev.audience ?? []).join(', '),
    (ev.vibe ?? []).join(', '),
    (ev.occasion_tags ?? []).join(', '),
  ].filter(Boolean);
  return parts.join('\n');
}

function hashText(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

async function main() {
  const opts = parseArgs();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OPENAI_API_KEY');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const openai = new OpenAI({ apiKey: openaiKey });

  console.log(`\nBuild embeddings (${EMBEDDING_MODEL})`);
  console.log(`  Dry-run:   ${opts.dryRun}`);
  console.log(`  Force:     ${opts.force}`);
  console.log(`  Limit:     ${opts.limit ?? 'none'}`);
  console.log('─'.repeat(60));

  // Fetch events that need (re-)embedding. In force mode, every event.
  // In normal mode, only those with null embedding OR null hash.
  let query = supabase
    .from('events')
    .select('id, title, description, category, tags, audience, vibe, occasion_tags, embedding_hash');
  if (!opts.force) {
    query = query.or('embedding.is.null,embedding_hash.is.null');
  }
  if (opts.limit) query = query.limit(opts.limit);

  const { data: rows, error } = await query;
  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
  if (!rows || rows.length === 0) {
    console.log('Nothing to embed — all rows up-to-date.');
    return;
  }

  console.log(`Loaded ${rows.length} events to process.\n`);

  const stats = {
    total: rows.length,
    skipped_unchanged: 0,
    embedded: 0,
    failed: 0,
    tokens_in: 0,
    cost_usd: 0,
  };

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE) as EventRow[];

    // Prepare source texts + hashes, filter out rows whose hash matches
    // (they're already up-to-date, someone just hit --force)
    const pending: Array<{ row: EventRow; text: string; hash: string }> = [];
    for (const row of batch) {
      const text = buildSourceText(row);
      if (!text.trim()) { stats.skipped_unchanged += 1; continue; }
      const hash = hashText(text);
      if (!opts.force && row.embedding_hash === hash) {
        stats.skipped_unchanged += 1;
        continue;
      }
      pending.push({ row, text, hash });
    }
    if (pending.length === 0) continue;

    // Call OpenAI
    try {
      const t0 = Date.now();
      const resp = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: pending.map(p => p.text),
      });
      const elapsed = Date.now() - t0;
      stats.tokens_in += resp.usage.total_tokens;
      stats.cost_usd += (resp.usage.total_tokens / 1_000_000) * 0.02;

      // Persist
      if (!opts.dryRun) {
        for (let j = 0; j < pending.length; j++) {
          const { row, hash } = pending[j];
          const vec = resp.data[j]?.embedding;
          if (!vec || vec.length !== EMBEDDING_DIM) {
            console.error(`  ✗ ${row.id.slice(0, 8)} bad embedding dim: ${vec?.length}`);
            stats.failed += 1;
            continue;
          }
          // Supabase-js doesn't have a native vector helper; pass the array
          // as JSON and cast on the server side. pgvector accepts the
          // '[0.1,0.2,...]' string literal format for text→vector cast.
          const { error: updErr } = await supabase
            .from('events')
            .update({
              embedding: `[${vec.join(',')}]`,
              embedding_hash: hash,
            })
            .eq('id', row.id);
          if (updErr) {
            console.error(`  ✗ ${row.id.slice(0, 8)} update failed: ${updErr.message}`);
            stats.failed += 1;
          } else {
            stats.embedded += 1;
          }
        }
      } else {
        stats.embedded += pending.length;
      }

      process.stdout.write(
        `  batch ${i / BATCH_SIZE + 1}: ${pending.length} embedded in ${elapsed}ms, ` +
        `tokens=${resp.usage.total_tokens}, running cost=$${stats.cost_usd.toFixed(4)}\r`,
      );
    } catch (e) {
      console.error(`\n  ✗ batch ${i / BATCH_SIZE + 1} failed:`, e instanceof Error ? e.message : e);
      stats.failed += pending.length;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Total:             ${stats.total}`);
  console.log(`Embedded:          ${stats.embedded}${opts.dryRun ? ' (dry-run, no writes)' : ''}`);
  console.log(`Skipped unchanged: ${stats.skipped_unchanged}`);
  console.log(`Failed:            ${stats.failed}`);
  console.log(`Tokens:            ${stats.tokens_in.toLocaleString()}`);
  console.log(`Cost:              $${stats.cost_usd.toFixed(4)}`);
  console.log();
}

main().catch(e => { console.error(e); process.exit(1); });
