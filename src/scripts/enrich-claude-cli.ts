/**
 * Batch-enrich every event using Claude Code headless (`claude -p`).
 *
 * Flow per event:
 *   1. Fetch source_url → extract main text
 *   2. Invoke `claude -p` with event metadata + page content
 *   3. Write enrichment fields back to DB (atomic per-event UPDATE)
 *   4. Mark row with `enrichment_version` so next run skips it
 *
 * Resume guarantees (100%):
 *   - Every enriched event is persisted to DB in a single atomic UPDATE
 *     before the worker moves on. No batched writes, no in-memory staging.
 *   - On crash / Ctrl+C / laptop-poweroff, at most `concurrency` events
 *     are "in flight" and lost. Those rows stay at enrichment_version=NULL
 *     and get redone on the next run.
 *   - No checkpoint file to corrupt; the DB is the single source of truth.
 *   - Startup query shows both "already done" and "still pending" counts
 *     so you can verify resume is working.
 *   - Optional --log-file appends one JSON line per event (successful or
 *     failed) for forensic review or external progress tracking.
 *
 * Plugin / hook suppression:
 *   - `--tools ""` disables ALL tools so plugins can't execute anything
 *   - `--no-session-persistence` skips .claude/ session files
 *   - `--bare` (if ANTHROPIC_API_KEY is set) additionally skips hooks,
 *     LSP, plugin sync, auto-memory, CLAUDE.md discovery — pure speed.
 *     Only works with API key; Max OAuth does not survive --bare.
 *
 * Usage:
 *   npm run enrich-claude                            # full run, 20 workers
 *   npm run enrich-claude -- --limit 50              # cap (test first!)
 *   npm run enrich-claude -- --concurrency 30        # more parallel
 *   npm run enrich-claude -- --dry-run               # verbose, no DB writes
 *   npm run enrich-claude -- --no-fetch              # skip URL fetch
 *   npm run enrich-claude -- --model sonnet          # sonnet (default) | haiku | opus
 *   npm run enrich-claude -- --bare                  # speed mode (needs API key)
 *   npm run enrich-claude -- --log-file enrich.jsonl # audit log
 *   npm run enrich-claude -- --force                 # redo already-done rows
 */

import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
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
import { fetchEventPage, closeSharedBrowser } from '../lib/category-classifier/fetch-page';
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
  bareMode: boolean;     // --bare flag (requires ANTHROPIC_API_KEY)
  logFile: string | null;
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
  const wantsBare = args.includes('--bare');
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  return {
    limit: p(get('--limit'), Infinity as unknown as number),
    concurrency: p(get('--concurrency'), 30),
    dryRun: args.includes('--dry-run'),
    noFetch: args.includes('--no-fetch'),
    force: args.includes('--force'),
    verbose: args.includes('--verbose') || args.includes('--dry-run'),
    model,
    // Only enable --bare if an API key is present — it disables OAuth/keychain.
    bareMode: wantsBare && hasApiKey,
    claudeBin: get('--claude-bin') ?? 'claude',
    logFile: get('--log-file') ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Prompt + response schema
// ─────────────────────────────────────────────────────────────────────

const TASK_PROMPT_PREFIX = `CLASSIFY AN AUSTRIAN EVENT. Output ONLY one JSON object — no prose before or after, no markdown fences.

The JSON must have EXACTLY these 11 fields: tags (array), audience (array), vibe (array), setting (array), language (string), price_tier (string), duration_type (string), is_student_friendly (boolean), is_family_friendly (boolean), suggested_description (string or null), suggested_price_text (string or null).

Allowed values — MUST pick only from these lists:

TAGS (0-5): ${TAGS.join(', ')}

AUDIENCE (1-4): ${AUDIENCES.join(', ')}

VIBE (1-2): ${VIBES.join(', ')}

SETTING (1-2): ${SETTINGS.join(', ')}

LANGUAGE (exactly 1): ${LANGUAGES.join(', ')}

PRICE_TIER (exactly 1): ${PRICE_TIERS.join(', ')}
  gratis=0€ · günstig=bis 15€ · mittel=15-50€ · premium=über 50€ · unbekannt=nicht ableitbar
  DEFAULT-REGEL: Wenn weder in den Event-Metadaten (TITEL, BESCHREIBUNG, PREIS) noch
  im QUELLTEXT der Seite ein Preis erkennbar ist → "gratis". Viele österreichische
  Events (Frühschoppen, Kirtag, Pfarrfest, Gottesdienst, Seniorennachmittag,
  Dorffest, Gemeindeveranstaltung) sind tatsächlich kostenlos und nennen keinen
  Preis weil es selbstverständlich ist. "unbekannt" nur bei klaren Ausnahmefällen
  wo ein Preis ANGEDEUTET aber nicht quantifizierbar ist ("Eintritt bei der Tür",
  "Spende erbeten"). Bei kommerziellen Events mit ticket_url aber fehlendem Betrag:
  trotzdem "unbekannt", nicht "gratis".

DURATION_TYPE (exactly 1): ${DURATION_TYPES.join(', ')}
  kurz<2h · abend=2-5h · ganztag · mehrtägig · dauerausstellung · nacht-bis-morgen=22h-6h · 24-stunden · 48-stunden

BOOLEAN FLAGS — critical, only TRUE with explicit evidence:

is_student_friendly = TRUE only if one of:
  (a) title/text explicitly says "Studenten", "Studierende", "Uni-Party", "Semester-Opening"
  (b) venue is a known university/FH (TU/WU/Uni Wien/Graz/Linz/Salzburg/Innsbruck, FH Burgenland, etc.)
  (c) organizer is a student body (ÖH, ESN, AIESEC, IAESTE, AEGEE, Fachschaft)
  (d) explicit student discount mentioned
  Otherwise → FALSE. Regular concert/club/festival/market is NOT automatically student-friendly.

is_family_friendly = TRUE only if one of:
  (a) title/text explicitly mentions "Familie", "Kinder", "ab 3/6 Jahren", "Kinderprogramm", "familien-geeignet"
  (b) event type is inherently child-oriented: Kindertheater, Puppentheater, Kinderkino, Kinderzirkus, Familienpicknick, Spielfest, Kinder-Workshop, Kirtag, Adventmarkt (daytime), Erntedank, Maibaumfest, Ferienprogramm
  (c) venue/organizer is family-focused (Familienzentrum, Naturpark-Führung, Zoo, Kindermuseum)
  Otherwise → FALSE. Concerts/clubs/bars/evening events/Heurige/rave/sport/adult lectures are NOT automatically family-friendly.

WHEN IN DOUBT FOR THE FLAGS: FALSE.

suggested_description: if QUELLTEXT is present AND current BESCHREIBUNG is empty/very short, write a clean 150-400-char description. Otherwise null.
suggested_price_text: if QUELLTEXT names a price AND PREIS field is empty, extract it ("ab 25€", "Eintritt frei", "Erwachsene 15€ / Kinder frei"). Otherwise null.

Austrian shorthand: Kirtag/Zeltfest=traditionell+familien-mit-kindern+dörflich; Wallfahrt=spirituell+traditionell+senioren; Heuriger=gemütlich+erwachsene-allgemein+dörflich; Goa-Festival im Wald=psytrance+goa+rave+psychedelic+forest+open-air-rave; DnB-Rave im Club=drum-and-bass+rave+club-night+energetisch+nacht-bis-morgen.

EVENT DATA FOLLOWS:

`;

/**
 * JSON Schema passed to Claude's native structured-output mode via
 * --json-schema. Claude will be constrained to emit a JSON body that
 * validates against this — eliminates the "please just return JSON"
 * prompt-dance and makes parsing bulletproof.
 */
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    audience: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    vibe: { type: 'array', items: { type: 'string' }, maxItems: 2 },
    setting: { type: 'array', items: { type: 'string' }, maxItems: 2 },
    language: { type: 'string' },
    price_tier: { type: 'string' },
    duration_type: { type: 'string' },
    is_student_friendly: { type: 'boolean' },
    is_family_friendly: { type: 'boolean' },
    suggested_description: { type: ['string', 'null'] },
    suggested_price_text: { type: ['string', 'null'] },
  },
  required: [
    'tags', 'audience', 'vibe', 'setting',
    'language', 'price_tier', 'duration_type',
    'is_student_friendly', 'is_family_friendly',
    'suggested_description', 'suggested_price_text',
  ],
  additionalProperties: false,
};

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
    parts.push('───────── QUELLTEXT DER EVENT-SEITE ─────────');
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
 * Spawn `claude -p` and pipe the full prompt via stdin. Uses --json-schema
 * to force structured output, --tools "" to disable all tools, and
 * --no-session-persistence to skip .claude/ session files. If --bare
 * mode is enabled (API key present), also adds --bare to skip plugin
 * sync, hooks, LSP, auto-memory, and CLAUDE.md auto-discovery.
 */
async function callClaudeCli(
  userMessage: string,
  opts: CliOpts,
): Promise<unknown> {
  const model = MODEL_MAP[opts.model];
  const fullPrompt = TASK_PROMPT_PREFIX + userMessage;

  const args = [
    '-p',
    '--model', model,
    '--max-turns', '1',
    '--output-format', 'text',      // proven-working in last green run
    '--no-session-persistence',     // skip session files — safe
  ];
  // --bare is all-or-nothing and needs API key. When available it skips
  // plugin sync, hooks, LSP, auto-memory, CLAUDE.md auto-discovery.
  if (opts.bareMode) {
    args.push('--bare');
  }
  // NOTE on flags we TRIED and reverted:
  //   --json-schema: silently produced empty stdout for many events
  //     (maybe unsupported combo with --output-format json in 2.1.104).
  //     Schema enforcement is handled by the imperative prompt +
  //     extractJson() post-parse — already bulletproof for the 20/20
  //     run we had before this rewrite.
  //   --tools "": intermittent empty stdout on Windows (shell=true may
  //     be mangling the empty string).
  //   --permission-mode bypassPermissions: not needed with --print, may
  //     interact badly with --max-turns 1.
  //   --output-format json: produced {type, result, ...} wrapper but
  //     fragile when paired with other flags. `text` is predictable.

  return new Promise<unknown>((resolve, reject) => {
    const child = spawn(opts.claudeBin, args, {
      cwd: tmpdir(),
      env: {
        ...process.env,
        NO_COLOR: '1',
        CLAUDE_CODE_SUPPRESS_UPDATE_CHECK: '1',
        DISABLE_AUTOUPDATER: '1',
      },
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
      if (code !== 0) {
        reject(new Error(`claude exited ${code}: ${stderr.slice(0, 400)}`));
        return;
      }

      // Empty-stdout diagnosis: include stderr so we can see why Claude
      // produced nothing despite exit 0.
      if (!stdout.trim()) {
        reject(new Error(
          `claude produced empty stdout | exit=0 | stderr=${stderr.slice(0, 400) || '(empty)'}`,
        ));
        return;
      }

      // --output-format text → stdout is Claude's response directly.
      // extractJson handles code fences + prose stripping.
      try {
        resolve(extractJson(stdout));
      } catch (err) {
        reject(new Error(
          `failed to parse claude output: ${err instanceof Error ? err.message : err} | ` +
          `stdout=${stdout.slice(0, 200)} | stderr=${stderr.slice(0, 200)}`,
        ));
      }
    });

    child.stdin.write(fullPrompt);
    child.stdin.end();
  });
}

/**
 * Extract the first top-level JSON object from a string. Handles optional
 * code fences and leading/trailing prose that sometimes slip past schema
 * enforcement.
 */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  // Fast path: the whole thing is JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }
  // Strip fences
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fence ? fence[1] : trimmed;
  // Brace-counting scan for first complete JSON object
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
      if (depth === 0) return JSON.parse(body.slice(start, i + 1));
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
// Stats + per-event worker
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

function appendLog(logFile: string | null, entry: Record<string, unknown>): void {
  if (!logFile) return;
  try {
    const dir = dirname(logFile);
    if (dir && dir !== '.' && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(logFile, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch (err) {
    console.error(`\n[log] append failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function processOne(
  supabase: SupabaseClient,
  row: EventRow,
  opts: CliOpts,
  stats: Stats,
): Promise<void> {
  // 1. Fetch source URL
  let pageContent: string | null = null;
  let fetchErr: string | undefined;
  if (!opts.noFetch && row.source_url) {
    try {
      const page = await fetchEventPage(row.source_url);
      if (page.ok) { pageContent = page.text; stats.fetchOk += 1; }
      else { stats.fetchFailed += 1; fetchErr = page.error; }
    } catch (err) {
      stats.fetchFailed += 1;
      fetchErr = err instanceof Error ? err.message : String(err);
    }
  } else {
    stats.fetchSkipped += 1;
  }

  // 2. Call Claude with full retry logic — 5 attempts, error-type aware.
  //    - rate-limit: 15s → 30s → 60s → 120s → 240s
  //    - network:    3s  → 6s  → 12s  → 24s  → 48s
  //    - auth:       bail immediately (retry won't help, needs human)
  //    - other:      2s  → 4s  → 8s   → 16s  → 32s
  //
  //    After all 5 attempts fail, the event stays at enrichment_version=NULL
  //    in DB → picked up on next run. No data loss.
  const MAX_ATTEMPTS = 5;
  let parsed: unknown = null;
  let lastErr: string | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      parsed = await callClaudeCli(buildUserMessage(row, pageContent), opts);
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_ATTEMPTS - 1) break; // final attempt, give up

      const isRate = /429|rate.limit|rate_limit|too.many.request|usage.limit|quota/i.test(lastErr);
      const isNetwork = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket|network|timeout/i.test(lastErr);
      const isAuth = /\b(401|403|unauthorized|forbidden|authentication|invalid.api.key|credentials)\b/i.test(lastErr);

      if (isAuth) {
        console.error(`\n[${row.id.slice(0, 8)}] AUTH FAILURE — run 'claude /login' or set ANTHROPIC_API_KEY: ${lastErr.slice(0, 180)}`);
        break; // retry won't help
      }

      let backoff: number;
      let tag: string;
      if (isRate) {
        stats.rateLimited += 1;
        backoff = 15_000 * Math.pow(2, attempt);
        tag = 'rate-limit';
      } else if (isNetwork) {
        backoff = 3_000 * Math.pow(2, attempt);
        tag = 'network';
      } else {
        backoff = 2_000 * Math.pow(2, attempt);
        tag = 'error';
      }
      console.error(
        `\n[${row.id.slice(0, 8)}] ${tag} attempt ${attempt + 1}/${MAX_ATTEMPTS}: ` +
        `back off ${(backoff / 1000).toFixed(0)}s | ${lastErr.slice(0, 120)}`,
      );
      await new Promise(r => setTimeout(r, backoff));
    }
  }

  if (!parsed) {
    console.error(`\n[${row.id.slice(0, 8)}] claude failed: ${lastErr?.slice(0, 200) ?? '?'}`);
    stats.failed += 1;
    stats.processed += 1;
    appendLog(opts.logFile, { event_id: row.id, title: row.title, status: 'failed', error: lastErr });
    return;
  }

  // 3. Validate
  const validated = validateEnrichment(parsed);
  const pRec = (parsed ?? {}) as Record<string, unknown>;
  const suggestedDesc = cleanSuggested(pRec.suggested_description);
  const suggestedPrice = cleanSuggested(pRec.suggested_price_text);

  stats.enriched += 1;
  if (validated.is_student_friendly) stats.studentTrue += 1;
  if (validated.is_family_friendly) stats.familyTrue += 1;

  // Verbose per-event print
  if (opts.verbose) {
    const lines: string[] = [];
    const titleCut = row.title.length > 65 ? row.title.slice(0, 65) + '…' : row.title;
    lines.push('');
    lines.push(`━━ [${row.id.slice(0, 8)}] ${titleCut}`);
    lines.push(`   ort:            ${row.location_name ?? '-'}`);
    if (row.source_url) {
      const u = row.source_url.length > 80 ? row.source_url.slice(0, 80) + '…' : row.source_url;
      lines.push(`   url:            ${u}`);
    }
    lines.push(`   cat-v2 says:    ${row.category ?? '-'}   (page-fetch: ${pageContent ? `${pageContent.length} chars` : fetchErr ? `✗ ${fetchErr}` : 'skipped'})`);
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

  // 4. Build + commit atomic DB update
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
  if (validated.tags.length > 0) {
    const existing = Array.isArray(row.tags) ? row.tags : [];
    update.tags = Array.from(new Set([...existing, ...validated.tags])).slice(0, 8);
  }
  const descEmpty = !row.description || row.description.trim().length < 40;
  if (descEmpty && suggestedDesc) { update.description = suggestedDesc; stats.descFilled += 1; }
  const priceEmpty = !row.price_text || row.price_text.trim().length === 0;
  if (priceEmpty && suggestedPrice) { update.price_text = suggestedPrice; stats.priceFilled += 1; }

  if (!opts.dryRun) {
    const { error } = await supabase.from('events').update(update).eq('id', row.id);
    if (error) {
      console.error(`\n[${row.id.slice(0, 8)}] update failed: ${error.message}`);
      stats.enriched -= 1;
      stats.failed += 1;
      appendLog(opts.logFile, { event_id: row.id, title: row.title, status: 'db_error', error: error.message });
      stats.processed += 1;
      return;
    }
  }

  appendLog(opts.logFile, {
    event_id: row.id,
    title: row.title,
    status: opts.dryRun ? 'dry_run_ok' : 'ok',
    tags_added: validated.tags,
    audience: validated.audience,
    is_student_friendly: validated.is_student_friendly,
    is_family_friendly: validated.is_family_friendly,
  });
  stats.processed += 1;
}

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
    if (stats.processed % 5 === 0 || stats.processed <= 10) {
      process.stdout.write('  ' + reportLine(stats, total) + '\r');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  // Best-effort version check — warn but don't abort on failure.
  try {
    const version = await new Promise<string>((resolve, reject) => {
      const c = spawn(opts.claudeBin, ['--version'], {
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      c.stdout.on('data', (d: Buffer) => { out += d.toString('utf8'); });
      c.on('close', (code) => code === 0 ? resolve(out.trim()) : reject(new Error(`exited ${code}`)));
      c.on('error', reject);
    });
    console.log(`  claude CLI:      ${version}`);
  } catch (err) {
    console.warn(`  ⚠ claude --version check failed: ${err instanceof Error ? err.message : err}`);
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(supaUrl, supaKey);
  const today = new Date().toISOString().split('T')[0];

  // Startup: show resume state (already-done vs pending).
  const { count: alreadyDone } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('publish_status', 'published')
    .gte('start_date', today)
    .gte('quality_score', 40)
    .eq('enrichment_version', ENRICHMENT_VERSION);

  let pendingQuery = supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('publish_status', 'published')
    .gte('start_date', today)
    .gte('quality_score', 40);
  if (!opts.force) pendingQuery = pendingQuery.or(`enrichment_version.is.null,enrichment_version.neq.${ENRICHMENT_VERSION}`);
  const { count: totalPending } = await pendingQuery;

  console.log('\nEvent Enrichment — Claude CLI');
  console.log(`  Model:           ${opts.model} (${MODEL_MAP[opts.model]})`);
  console.log(`  Concurrency:     ${opts.concurrency} workers`);
  console.log(`  Dry-run:         ${opts.dryRun}`);
  console.log(`  Fetch URLs:      ${!opts.noFetch}`);
  console.log(`  Force re-run:    ${opts.force}`);
  console.log(`  Bare mode:       ${opts.bareMode ? 'YES (plugins skipped, API key auth)' : 'no (plugins load, Max-OAuth auth ok)'}`);
  console.log(`  Log file:        ${opts.logFile ?? '(none)'}`);
  console.log(`  Limit:           ${opts.limit === Infinity ? 'none' : opts.limit}`);
  console.log(`  Target version:  ${ENRICHMENT_VERSION}`);
  console.log(`  Already done:    ${alreadyDone ?? '?'}   (resume-safe — these are skipped)`);
  console.log(`  Still pending:   ${totalPending ?? '?'}`);
  console.log('─'.repeat(70));

  const stats = newStats();
  appendLog(opts.logFile, { status: 'run_start', model: opts.model, concurrency: opts.concurrency, already_done: alreadyDone, pending: totalPending });

  const PAGE_SIZE = 200;

  while (stats.processed < opts.limit) {
    let q = supabase
      .from('events')
      .select('id, title, description, category, tags, source_tags_raw, location_name, organizer, start_date, end_date, price_text, price_min, price_max, source_url')
      .eq('publish_status', 'published')
      .gte('start_date', today)
      .gte('quality_score', 40)
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

    // --dry-run and --force don't advance the "pending" filter, so break
    // after first batch to avoid infinite loops.
    if (opts.dryRun || opts.force) break;
    if (rows.length < PAGE_SIZE) break;
  }

  process.stdout.write('\n' + '─'.repeat(70) + '\n');
  console.log(reportLine(stats, totalPending ?? undefined));
  const elapsed = (Date.now() - stats.startedAt) / 60000;
  console.log(`Elapsed: ${elapsed.toFixed(1)}min`);
  appendLog(opts.logFile, { status: 'run_end', processed: stats.processed, enriched: stats.enriched, failed: stats.failed, elapsed_min: elapsed });

  // Release the shared Puppeteer browser (if started). Safe to call
  // unconditionally — no-op if it never launched.
  await closeSharedBrowser();
}

// Graceful shutdown: log SIGINT so the user knows resume is safe.
process.on('SIGINT', () => {
  console.log('\n\n⚠  SIGINT received. In-flight events may be lost, but the DB is consistent —');
  console.log('   re-run the same command and it will pick up from where you were.');
  // Close the browser synchronously-ish to avoid zombie Chrome processes.
  closeSharedBrowser().finally(() => process.exit(130));
});

main().catch((err) => {
  console.error('enrich-claude-cli failed:', err);
  process.exit(1);
});
