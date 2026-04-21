/**
 * Batch-enrich every event using Claude Code headless (`claude -p`).
 *
 * Why this exists: the local Qwen run gave unreliable `is_student_friendly` /
 * `is_family_friendly` flags and was slow. Claude is smarter and the
 * headless CLI reuses the user's existing Claude Code auth (Max plan)
 * instead of needing a separate ANTHROPIC_API_KEY.
 *
 * Trade-off: per-invocation overhead is high (each call spawns a full
 * `claude` process, loads config, authenticates, one-shots the prompt).
 * That's ~3-8s of overhead per event. We compensate by running many
 * workers in parallel.
 *
 * Rate-limit reality: Claude Max plans cap messages per 5-hour session.
 * Even with 10 parallel workers you'll hit the cap on 81k events in one
 * shot. This script handles 429s by backing off exponentially and
 * resuming from the checkpoint (`enrichment_version` column). Just let
 * it run in the background — it'll grind through the backlog whenever
 * rate-limit budget refreshes.
 *
 * Usage:
 *   npm run enrich-claude                            # everything, 5 workers
 *   npm run enrich-claude -- --limit 50              # just 50 (verify first!)
 *   npm run enrich-claude -- --concurrency 10        # more parallel
 *   npm run enrich-claude -- --dry-run               # no DB writes
 *   npm run enrich-claude -- --no-fetch              # skip URL fetch (faster)
 *   npm run enrich-claude -- --model sonnet          # sonnet (default) / haiku
 *   npm run enrich-claude -- --force                 # redo already-done rows
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';

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
import { fetchEventPage } from '../lib/category-classifier/fetch-page';
import { validateEnrichment, ENRICHMENT_VERSION } from '../lib/category-classifier/enrichment-taxonomy';
import {
  TAGS, AUDIENCES, VIBES, SETTINGS,
  LANGUAGES, PRICE_TIERS, DURATION_TYPES,
} from '../lib/category-classifier/enrichment-taxonomy';

// ─────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────

interface CliOpts {
  limit: number;
  concurrency: number;
  dryRun: boolean;
  noFetch: boolean;
  force: boolean;
  verbose: boolean;
  model: 'sonnet' | 'haiku' | 'opus';
  claudeBin: string;
}

function parseArgs(): CliOpts {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
  };
  const p = (v: string | undefined, d: number) => (v ? parseInt(v, 10) : d);
  const rawModel = get('--model') ?? 'sonnet';
  const model = ['sonnet', 'haiku', 'opus'].includes(rawModel) ? rawModel as 'sonnet' | 'haiku' | 'opus' : 'sonnet';
  return {
    limit: p(get('--limit'), Infinity as unknown as number),
    concurrency: p(get('--concurrency'), 5),
    dryRun: args.includes('--dry-run'),
    noFetch: args.includes('--no-fetch'),
    force: args.includes('--force'),
    // --verbose prints each event's classification. Auto-on in dry-run
    // because otherwise there's nothing to look at.
    verbose: args.includes('--verbose') || args.includes('--dry-run'),
    model,
    // Just 'claude' on all platforms — on Windows with shell=true, PATHEXT
    // handles finding claude.exe / claude.cmd / claude.bat automatically.
    // The curl-installer variant is claude.exe; the npm-global variant is
    // claude.cmd. Both work when we let the shell resolve.
    claudeBin: get('--claude-bin') ?? 'claude',
  };
}

// ─────────────────────────────────────────────────────────────────────
// Prompt — self-contained, drops into a single `claude -p` call
// ─────────────────────────────────────────────────────────────────────

/**
 * The entire instruction set — shipped as the user message (via stdin)
 * rather than --append-system-prompt.
 *
 * Why: Windows cmd.exe has an 8191-char command-line limit and
 * `--append-system-prompt` stuffs the whole string into the argv. Even
 * when it fits, `--append-system-prompt` APPENDS to Claude Code's default
 * helpful-assistant prompt, which caused Claude to reply with clarifying
 * questions instead of JSON ("It looks like you've shared event data,
 * but I'm not sure what you'd like me to do with it").
 *
 * Stuffing everything into stdin sidesteps both problems. The first line
 * is an imperative command ("CLASSIFY THIS EVENT. OUTPUT JSON ONLY."),
 * so Claude knows exactly what to do regardless of any system prompt
 * context Claude Code loaded in front.
 */
const TASK_PROMPT_PREFIX = `CLASSIFY AN AUSTRIAN EVENT. Output ONLY one JSON object on a single line — no prose before or after, no markdown fences, no explanation. Just the JSON.

The JSON must have EXACTLY these 11 fields: tags (array), audience (array), vibe (array), setting (array), language (string), price_tier (string), duration_type (string), is_student_friendly (boolean), is_family_friendly (boolean), suggested_description (string or null), suggested_price_text (string or null).

Allowed values for each array/enum field (you MUST pick only from these lists):

TAGS (0-5 values): ${TAGS.join(', ')}

AUDIENCE (1-4 values): ${AUDIENCES.join(', ')}

VIBE (1-2 values): ${VIBES.join(', ')}

SETTING (1-2 values): ${SETTINGS.join(', ')}

LANGUAGE (exactly 1): ${LANGUAGES.join(', ')}

PRICE_TIER (exactly 1): ${PRICE_TIERS.join(', ')}
  gratis=0€ · günstig=bis 15€ · mittel=15-50€ · premium=über 50€ · unbekannt=nicht ableitbar

DURATION_TYPE (exactly 1): ${DURATION_TYPES.join(', ')}
  kurz<2h · abend=2-5h · ganztag · mehrtägig · dauerausstellung · nacht-bis-morgen=22h-6h · 24-stunden · 48-stunden

BOOLEAN FLAGS — critical, only TRUE with explicit evidence:

is_student_friendly = TRUE only if one of:
  (a) title/text explicitly says "Studenten", "Studierende", "Uni-Party", "Semester-Opening"
  (b) venue is a known university/FH (TU/WU/Uni Wien/Graz/Linz/Salzburg/Innsbruck, FH Burgenland, etc.)
  (c) organizer is a student body (ÖH, ESN, AIESEC, IAESTE, AEGEE, Fachschaft)
  (d) explicit student discount mentioned
  Otherwise → FALSE. A regular concert/club/festival/market is NOT automatically student-friendly.

is_family_friendly = TRUE only if one of:
  (a) title/text explicitly mentions "Familie", "Kinder", "ab 3/6 Jahren", "Kinderprogramm", "familien-geeignet"
  (b) event type is inherently child-oriented: Kindertheater, Puppentheater, Kinderkino, Kinderzirkus, Familienpicknick, Spielfest, Kinder-Workshop, Kirtag, Adventmarkt (daytime), Erntedank, Maibaumfest, Ferienprogramm
  (c) venue/organizer is family-focused (Familienzentrum, Naturpark-Führung, Zoo, Kindermuseum)
  Otherwise → FALSE. Concerts/clubs/bars/evening events/Heurige/rave/sport/adult lectures are NOT automatically family-friendly.

WHEN IN DOUBT FOR THE FLAGS: FALSE. A false-positive on a rave breaks the wizard filter.

suggested_description: if QUELLTEXT is present AND current BESCHREIBUNG is empty/very short, write a clean 150-400-char description. Otherwise null.
suggested_price_text: if QUELLTEXT names a price AND PREIS field is empty, extract it ("ab 25€", "Eintritt frei", "Erwachsene 15€ / Kinder frei"). Otherwise null.

Austrian shorthand: Kirtag/Zeltfest=traditionell+familien-mit-kindern+dörflich; Wallfahrt=spirituell+traditionell+senioren; Heuriger=gemütlich+erwachsene-allgemein+dörflich; Goa-Festival im Wald=psytrance+goa+rave+psychedelic+forest+open-air-rave; DnB-Rave im Club=drum-and-bass+rave+club-night+energetisch+nacht-bis-morgen.

Output the JSON on one line with no leading or trailing whitespace or prose. EVENT DATA FOLLOWS:

`;

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

function buildUserMessage(ev: EventRow, pageContent: string | null): string {
  const parts: string[] = [];
  parts.push(`TITEL: ${ev.title}`);
  parts.push(`BESCHREIBUNG: ${ev.description ? ev.description.slice(0, 600) : '(leer)'}`);
  if (ev.category) parts.push(`BISHERIGE KATEGORIE: ${ev.category}`);
  const rawTags = ev.source_tags_raw ?? ev.tags;
  if (rawTags && rawTags.length > 0) parts.push(`ROH-TAGS: ${rawTags.slice(0, 10).join(', ')}`);
  if (ev.location_name) parts.push(`ORT: ${ev.location_name}`);
  if (ev.organizer) parts.push(`VERANSTALTER: ${ev.organizer}`);
  if (ev.start_date) {
    const d = new Date(ev.start_date);
    if (!isNaN(d.getTime())) {
      const hour = d.getHours();
      const weekday = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
      parts.push(`ZEIT: ${weekday} ${hour}:${String(d.getMinutes()).padStart(2, '0')} Uhr`);
    }
  }
  parts.push(`PREIS: ${ev.price_text ?? '(leer)'}`);
  if (pageContent) {
    parts.push('');
    parts.push('───────── QUELLTEXT (extrahiert aus der Event-URL) ─────────');
    parts.push(pageContent);
  }
  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────
// Claude CLI spawner
// ─────────────────────────────────────────────────────────────────────

const CLAUDE_TIMEOUT_MS = 180_000; // 3min per call

const MODEL_MAP: Record<string, string> = {
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001',
  opus: 'claude-opus-4-1-20250805',
};

/**
 * Spawn `claude -p` and pipe the complete instruction+data prompt via
 * stdin. No --append-system-prompt (hits cmd.exe's 8191-char limit on
 * Windows and gets appended to Claude Code's default helpful-assistant
 * system prompt, causing clarifying-question replies instead of JSON).
 *
 * Returns the raw text response. Caller handles retries.
 */
async function callClaudeCli(
  userMessage: string,
  opts: CliOpts,
): Promise<string> {
  const model = MODEL_MAP[opts.model];
  // Full prompt = imperative task + allowed-value tables + event data.
  // Keeping all of this in stdin avoids Windows' command-line size limits.
  const fullPrompt = TASK_PROMPT_PREFIX + userMessage + '\n\nJSON:';

  const args = [
    '-p',
    '--model', model,
    '--max-turns', '1',
    '--output-format', 'text',
  ];

  return new Promise<string>((resolve, reject) => {
    const child = spawn(opts.claudeBin, args, {
      cwd: tmpdir(),       // avoid picking up the project's CLAUDE.md
      env: { ...process.env, NO_COLOR: '1', CLAUDE_CODE_SUPPRESS_UPDATE_CHECK: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude CLI timeout after ${CLAUDE_TIMEOUT_MS}ms`));
    }, CLAUDE_TIMEOUT_MS);

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`spawn failed: ${err.message} (is '${opts.claudeBin}' in PATH?)`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`claude exited ${code}: ${stderr.slice(0, 400)}`));
      }
    });

    child.stdin.write(fullPrompt);
    child.stdin.end();
  });
}

/**
 * Pull the first `{ ... }` JSON blob out of Claude's stdout. Claude usually
 * complies with "return only JSON" but sometimes prefixes prose or wraps
 * in code fences — this strips both.
 */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  // Strip code fences if present
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fence ? fence[1] : trimmed;
  // Find first '{' and its matching '}' — simple brace counter
  const start = body.indexOf('{');
  if (start === -1) throw new Error(`no JSON found in: ${body.slice(0, 120)}`);
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') inString = !inString;
    if (inString) continue;
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(body.slice(start, i + 1));
      }
    }
  }
  throw new Error('unterminated JSON');
}

function cleanSuggested(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || /^null$/i.test(t)) return null;
  return t;
}

// ─────────────────────────────────────────────────────────────────────
// Per-event worker
// ─────────────────────────────────────────────────────────────────────

interface Stats {
  processed: number;
  enriched: number;
  failed: number;
  fetchOk: number;
  fetchSkipped: number;
  fetchFailed: number;
  descFilled: number;
  priceFilled: number;
  rateLimited: number;
  studentTrue: number;
  familyTrue: number;
  startedAt: number;
}

function newStats(): Stats {
  return {
    processed: 0, enriched: 0, failed: 0,
    fetchOk: 0, fetchSkipped: 0, fetchFailed: 0,
    descFilled: 0, priceFilled: 0, rateLimited: 0,
    studentTrue: 0, familyTrue: 0,
    startedAt: Date.now(),
  };
}

function reportLine(s: Stats, total?: number): string {
  const elapsed = (Date.now() - s.startedAt) / 1000;
  const rate = s.processed / Math.max(elapsed, 0.001);
  const etaStr = total && rate > 0
    ? `eta=${(((total - s.processed) / rate) / 60).toFixed(0)}min`
    : '';
  return `p=${s.processed}${total ? '/' + total : ''} ✓=${s.enriched} ✗=${s.failed} ` +
    `fetch(ok=${s.fetchOk} fail=${s.fetchFailed}) ` +
    `filled(d=${s.descFilled} p=${s.priceFilled}) ` +
    `flags(stu=${s.studentTrue} fam=${s.familyTrue}) ` +
    `429=${s.rateLimited} rate=${rate.toFixed(2)}/s ${etaStr}`;
}

async function processOne(
  supabase: SupabaseClient,
  row: EventRow,
  opts: CliOpts,
  stats: Stats,
): Promise<void> {
  // 1. Fetch source URL
  let pageContent: string | null = null;
  if (!opts.noFetch && row.source_url) {
    try {
      const page = await fetchEventPage(row.source_url);
      if (page.ok) { pageContent = page.text; stats.fetchOk += 1; }
      else stats.fetchFailed += 1;
    } catch { stats.fetchFailed += 1; }
  } else {
    stats.fetchSkipped += 1;
  }

  // 2. Call Claude (with backoff on 429)
  let raw: string | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const userMsg = buildUserMessage(row, pageContent);
      raw = await callClaudeCli(userMsg, opts);
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRate = /429|rate.limit|rate_limit|too.many.request/i.test(msg);
      if (isRate) {
        stats.rateLimited += 1;
        const backoff = 15_000 * Math.pow(2, attempt); // 15s, 30s, 60s, 120s
        console.error(`\n[${row.id.slice(0, 8)}] rate limited, back off ${backoff / 1000}s`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      if (attempt === 3) {
        console.error(`\n[${row.id.slice(0, 8)}] claude failed: ${msg.slice(0, 200)}`);
        stats.failed += 1;
        stats.processed += 1;
        return;
      }
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  if (!raw) { stats.failed += 1; stats.processed += 1; return; }

  // 3. Parse + validate
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch (err) {
    console.error(`\n[${row.id.slice(0, 8)}] JSON parse failed: ${err instanceof Error ? err.message : err}`);
    stats.failed += 1;
    stats.processed += 1;
    return;
  }

  const validated = validateEnrichment(parsed);
  const pRec = (parsed ?? {}) as Record<string, unknown>;
  const suggestedDesc = cleanSuggested(pRec.suggested_description);
  const suggestedPrice = cleanSuggested(pRec.suggested_price_text);

  stats.enriched += 1;
  if (validated.is_student_friendly) stats.studentTrue += 1;
  if (validated.is_family_friendly) stats.familyTrue += 1;

  // 3b. Verbose per-event print (auto-on in --dry-run). Built as one big
  // string so 5 concurrent workers don't interleave mid-event.
  if (opts.verbose) {
    const lines: string[] = [];
    const titleCut = row.title.length > 65 ? row.title.slice(0, 65) + '…' : row.title;
    lines.push('');
    lines.push(`━━ [${row.id.slice(0, 8)}] ${titleCut}`);
    lines.push(`   ort:            ${row.location_name ?? '-'}`);
    lines.push(`   cat-v2 says:    ${row.category ?? '-'}   (page-fetch: ${pageContent ? `${pageContent.length} chars` : 'skipped'})`);
    lines.push(`   tags:           ${validated.tags.join(', ') || '(none)'}`);
    lines.push(`   audience:       ${validated.audience.join(', ') || '(none)'}`);
    lines.push(`   vibe:           ${validated.vibe.join(', ') || '(none)'}`);
    lines.push(`   setting:        ${validated.setting.join(', ') || '(none)'}`);
    lines.push(`   language:       ${validated.language ?? '-'}`);
    lines.push(`   price_tier:     ${validated.price_tier ?? '-'}`);
    lines.push(`   duration_type:  ${validated.duration_type ?? '-'}`);
    lines.push(`   flags:          student=${validated.is_student_friendly}   family=${validated.is_family_friendly}`);
    if (suggestedDesc) {
      const s = suggestedDesc.length > 120 ? suggestedDesc.slice(0, 120) + '…' : suggestedDesc;
      lines.push(`   → suggest desc: ${s}`);
    }
    if (suggestedPrice) lines.push(`   → suggest price: ${suggestedPrice}`);
    process.stdout.write(lines.join('\n') + '\n');
  }

  // 4. Build DB update — guard description/price writes on NULL/empty
  const update: Record<string, unknown> = {
    audience: validated.audience.length > 0 ? validated.audience : null,
    vibe: validated.vibe.length > 0 ? validated.vibe : null,
    setting: validated.setting.length > 0 ? validated.setting : null,
    language: validated.language,
    price_tier: validated.price_tier,
    duration_type: validated.duration_type,
    is_student_friendly: validated.is_student_friendly,
    is_family_friendly: validated.is_family_friendly,
    enrichment_version: ENRICHMENT_VERSION,
    enrichment_at: new Date().toISOString(),
  };
  // Tag union with existing (preserve cat-v2 output).
  if (validated.tags.length > 0) {
    const existing = Array.isArray(row.tags) ? row.tags : [];
    update.tags = Array.from(new Set([...existing, ...validated.tags])).slice(0, 8);
  }
  const descEmpty = !row.description || row.description.trim().length < 40;
  if (descEmpty && suggestedDesc) {
    update.description = suggestedDesc;
    stats.descFilled += 1;
  }
  const priceEmpty = !row.price_text || row.price_text.trim().length === 0;
  if (priceEmpty && suggestedPrice) {
    update.price_text = suggestedPrice;
    stats.priceFilled += 1;
  }

  if (!opts.dryRun) {
    const { error } = await supabase.from('events').update(update).eq('id', row.id);
    if (error) {
      console.error(`\n[${row.id.slice(0, 8)}] update failed: ${error.message}`);
      stats.enriched -= 1;
      stats.failed += 1;
    }
  }
  stats.processed += 1;
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function worker(queue: EventRow[], supabase: SupabaseClient, opts: CliOpts, stats: Stats, total?: number): Promise<void> {
  while (queue.length > 0) {
    const row = queue.shift();
    if (!row) break;
    try {
      await processOne(supabase, row, opts, stats);
    } catch (err) {
      stats.failed += 1;
      stats.processed += 1;
      console.error(`\nworker error on ${row.id.slice(0, 8)}: ${err instanceof Error ? err.message : err}`);
    }
    if (stats.processed % 5 === 0) {
      process.stdout.write('  ' + reportLine(stats, total) + '\r');
    }
  }
}

async function main() {
  const opts = parseArgs();

  // Best-effort sanity check. If `claude --version` fails, we warn but
  // proceed anyway — the user may have a non-standard install and the
  // real errors from the first classification call will be more useful.
  try {
    const version = await new Promise<string>((resolve, reject) => {
      const c = spawn(opts.claudeBin, ['--version'], {
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      let err = '';
      c.stdout.on('data', (d: Buffer) => { out += d.toString('utf8'); });
      c.stderr.on('data', (d: Buffer) => { err += d.toString('utf8'); });
      c.on('close', (code) => {
        if (code === 0) resolve(out.trim());
        else reject(new Error(`exited ${code}: ${err.trim() || out.trim()}`));
      });
      c.on('error', (e) => reject(e));
    });
    console.log(`  claude CLI:      ${version}`);
  } catch (err) {
    console.warn(`  ⚠ claude --version check failed: ${err instanceof Error ? err.message : err}`);
    console.warn(`    Continuing anyway — if real calls fail, check that "claude" is on PATH.`);
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(supaUrl, supaKey);
  const today = new Date().toISOString().split('T')[0];

  console.log('\nEvent Enrichment — Claude CLI');
  console.log(`  Model:           ${opts.model} (${MODEL_MAP[opts.model]})`);
  console.log(`  Concurrency:     ${opts.concurrency}`);
  console.log(`  Dry-run:         ${opts.dryRun}`);
  console.log(`  Fetch URLs:      ${!opts.noFetch}`);
  console.log(`  Force re-run:    ${opts.force}`);
  console.log(`  Limit:           ${opts.limit === Infinity ? 'none' : opts.limit}`);
  console.log(`  Target version:  ${ENRICHMENT_VERSION}`);

  let countQuery = supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('publish_status', 'published')
    .gte('start_date', today);
  if (!opts.force) countQuery = countQuery.or(`enrichment_version.is.null,enrichment_version.neq.${ENRICHMENT_VERSION}`);
  const { count: totalPending } = await countQuery;
  console.log(`  Pending:         ${totalPending ?? 'unknown'}`);
  console.log('─'.repeat(70));

  const stats = newStats();
  const PAGE_SIZE = 200;

  while (stats.processed < opts.limit) {
    let q = supabase
      .from('events')
      .select('id, title, description, category, tags, source_tags_raw, location_name, organizer, start_date, end_date, price_text, price_min, price_max, source_url')
      .eq('publish_status', 'published')
      .gte('start_date', today)
      .order('id', { ascending: true })
      .limit(PAGE_SIZE);
    if (!opts.force) q = q.or(`enrichment_version.is.null,enrichment_version.neq.${ENRICHMENT_VERSION}`);
    const { data, error } = await q;
    if (error) { console.error('\nquery:', error.message); break; }
    if (!data || data.length === 0) break;

    const rows = data as unknown as EventRow[];
    const remaining = opts.limit - stats.processed;
    const toProcess = remaining < rows.length ? rows.slice(0, remaining) : rows;
    const queue = [...toProcess];
    const workers = Array.from({ length: opts.concurrency }, () => worker(queue, supabase, opts, stats, totalPending ?? undefined));
    await Promise.all(workers);

    if (opts.dryRun || opts.force) break;
    if (rows.length < PAGE_SIZE) break;
  }

  process.stdout.write('\n' + '─'.repeat(70) + '\n');
  console.log(reportLine(stats, totalPending ?? undefined));
  console.log(`Elapsed: ${((Date.now() - stats.startedAt) / 60000).toFixed(1)}min`);
}

main().catch((err) => {
  console.error('enrich-claude-cli failed:', err);
  process.exit(1);
});
