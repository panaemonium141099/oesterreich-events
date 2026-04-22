/**
 * Batch-enrich events using OpenAI's API directly (no CLI subprocesses).
 *
 * Why this exists: Claude via `claude -p` hits Max-plan rate limits fast
 * and each event costs ~3s of process-spawn overhead per worker. Direct
 * OpenAI SDK skips both issues — pure async HTTPS calls at ~100ms each,
 * tier-2+ key handles ~450k tokens/min without breaking a sweat.
 *
 * Cost math (gpt-4o-mini, as of 2026-04):
 *   Per event: ~3500 input + 400 output tokens
 *   Per event: $0.00053 input + $0.00024 output = $0.00077 total
 *   80k events: ~$62 for the full run
 *
 * Uses the same taxonomy + prompt + validation as the Claude version so
 * results are schema-compatible. Same resume-safe logic via
 * enrichment_version — re-running is a no-op for already-processed rows.
 *
 * Usage:
 *   npm run enrich-openai                            # full run, gpt-4o-mini, 40 workers
 *   npm run enrich-openai -- --limit 50              # cap (verify first!)
 *   npm run enrich-openai -- --dry-run               # verbose, no DB writes
 *   npm run enrich-openai -- --concurrency 80        # go wider
 *   npm run enrich-openai -- --model gpt-4o          # use the bigger model
 *   npm run enrich-openai -- --log-file enrich.jsonl # audit log
 *   npm run enrich-openai -- --force                 # redo already-done rows
 */

import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

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
  model: string;
  logFile: string | null;
  /** OpenAI tokens-per-minute budget. Default 180k (safe for tier-1's 200k). */
  tpmLimit: number;
}

function parseArgs(): CliOpts {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
  };
  const p = (v: string | undefined, d: number) => (v ? parseInt(v, 10) : d);
  return {
    limit: p(get('--limit'), Infinity as unknown as number),
    // Default 6 workers for tier-1 (200k TPM). With ~4000-token prompts and
    // ~6s per call, 6 workers ≈ 60 events/min ≈ 240k TPM. The limiter
    // throttles below 180k → workers idle slightly but no 429s. Once on
    // tier-2 (2M TPM) bump to 40-80 via --concurrency + --tpm-limit.
    concurrency: p(get('--concurrency'), 6),
    dryRun: args.includes('--dry-run'),
    noFetch: args.includes('--no-fetch'),
    force: args.includes('--force'),
    verbose: args.includes('--verbose') || args.includes('--dry-run'),
    model: get('--model') ?? 'gpt-4o-mini',
    logFile: get('--log-file') ?? null,
    // Tier-1 default: 180k leaves 10% headroom under the 200k cap so that
    // burst variance from inaccurate token estimates doesn't overflow.
    tpmLimit: p(get('--tpm-limit'), 180_000),
  };
}

/**
 * Global client-side rate limiter. Tracks token "reservations" in the
 * last 60 seconds and throttles new requests if adding them would exceed
 * the TPM cap. Prevents the bursty-400-workers-hit-the-wall-together
 * problem where OpenAI's SDK-level retry alone isn't enough — if every
 * retry happens at the same time, they all 429 again.
 *
 * Reservations are based on ESTIMATED tokens (worst-case ~4500 per call
 * for our prompt). The actual usage from the response comes in after and
 * is ignored by the limiter — the reservation ages out of the window
 * naturally after 60s, so being slightly over-conservative is fine.
 */
class TpmLimiter {
  private readonly events: { ts: number; tokens: number }[] = [];

  constructor(private readonly tpm: number) {}

  async acquire(tokens: number): Promise<void> {
    // Sanity — don't try to reserve more than the full budget
    const need = Math.min(tokens, this.tpm);

    while (true) {
      const now = Date.now();
      // Prune entries older than 60s
      while (this.events.length > 0 && now - this.events[0].ts >= 60_000) {
        this.events.shift();
      }
      const used = this.events.reduce((s, e) => s + e.tokens, 0);
      if (used + need <= this.tpm) {
        this.events.push({ ts: now, tokens: need });
        return;
      }
      // Wait until the oldest entry falls out of the window, +100ms buffer.
      const oldestAge = now - this.events[0].ts;
      const waitMs = Math.max(100, 60_000 - oldestAge + 100);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// System + user prompt — shared structure with Claude version
// ─────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Du bist ein Klassifikator für österreichische Veranstaltungen. Gib für jedes Event GENAU EIN JSON-Objekt zurück (kein Markdown, keine Code-Fences, kein Erklärungstext drumherum). Nutze ausschließlich Werte aus den erlaubten Listen — erfinde nichts.

ERLAUBTE TAGS (0-5): ${TAGS.join(', ')}

ERLAUBTE AUDIENCE (1-4): ${AUDIENCES.join(', ')}

ERLAUBTE VIBE (1-2): ${VIBES.join(', ')}

ERLAUBTE SETTING (1-2): ${SETTINGS.join(', ')}

ERLAUBTE LANGUAGE (exactly 1): ${LANGUAGES.join(', ')}

ERLAUBTE PRICE_TIER (exactly 1): ${PRICE_TIERS.join(', ')}
  gratis=0€ · günstig=bis 15€ · mittel=15-50€ · premium=über 50€ · unbekannt=nicht ableitbar
  DEFAULT: Wenn weder im Event-Text noch im QUELLTEXT ein Preis steht → "gratis".
  Viele österreichische Events (Frühschoppen, Kirtag, Pfarrfest, Gottesdienst,
  Dorffest, Gemeindeveranstaltung) sind kostenlos. "unbekannt" nur bei klarer
  Ambiguität ("Spende erbeten", ticket_url ohne Betrag).

ERLAUBTE DURATION_TYPE (exactly 1): ${DURATION_TYPES.join(', ')}
  kurz<2h · abend=2-5h · ganztag · mehrtägig · dauerausstellung
  · nacht-bis-morgen=22h-6h · 24-stunden · 48-stunden

BOOLEAN FLAGS (KRITISCH — nur TRUE bei EXPLIZITER Evidenz):

is_student_friendly = TRUE nur bei EINER dieser Bedingungen:
  (a) Titel/Text nennt "Studenten", "Studierende", "Uni-Party", "Semester-Opening"
  (b) Veranstaltungsort ist eine Universität/FH (TU/WU/Uni Wien/Graz/Linz/Salzburg/Innsbruck, FH Burgenland, etc.)
  (c) Veranstalter ist Studentenvereinigung (ÖH, ESN, AIESEC, IAESTE, AEGEE, Fachschaft)
  (d) Explizite Studenten-Ermäßigung im Preis
  SONST → FALSE. Normales Konzert/Club/Festival/Markt ist NICHT automatisch studentfriendly.

is_family_friendly = TRUE nur bei EINER dieser Bedingungen:
  (a) Titel/Text nennt "Familie", "Kinder", "ab 3/6 Jahren", "Kinderprogramm"
  (b) Inhärent kinderorientiert: Kindertheater, Puppentheater, Kinderkino, Kinderzirkus,
      Familienpicknick, Spielfest, Kinder-Workshop, Kirtag, Adventmarkt (tagsüber),
      Erntedank, Maibaumfest, Ferienprogramm
  (c) Ort/Veranstalter ist familienorientiert (Familienzentrum, Naturpark, Zoo, Kindermuseum)
  SONST → FALSE. Konzerte/Clubs/Bars/Abend-Events/Heurige/Rave/Sport sind NICHT automatisch family-friendly.

IM ZWEIFEL für BEIDE Flags: FALSE. False-Positives zerstören den Wizard-Filter.

SUGGESTED_DESCRIPTION: wenn QUELLTEXT vorliegt UND BESCHREIBUNG leer/sehr kurz ist, schreibe saubere 150-400 Zeichen Beschreibung. Sonst null.
SUGGESTED_PRICE_TEXT: wenn QUELLTEXT einen Preis nennt UND PREIS-Feld leer ist, extrahiere ihn ("ab 25€", "Eintritt frei", "Erwachsene 15€"). Sonst null.

Österreichische Hinweise: Kirtag/Zeltfest = traditionell + familien-mit-kindern + dörflich · Wallfahrt = spirituell + traditionell + senioren · Heuriger = gemütlich + erwachsene-allgemein + dörflich · Goa-Festival im Wald = psytrance+goa+rave+psychedelic+forest+open-air-rave · DnB-Rave im Club = drum-and-bass+rave+club-night+energetisch+nacht-bis-morgen.`;

const OUTPUT_JSON_SCHEMA = {
  name: 'event_enrichment',
  strict: true,
  schema: {
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
  },
} as const;

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
// OpenAI client + call
// ─────────────────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Default timeout 60s; our page content can be long so we bump it.
  timeout: 120_000,
  maxRetries: 3, // SDK handles network blips + 429 backoff natively
});

/**
 * Two Chat Completions API dialects in the wild right now:
 *
 *   CLASSIC   (gpt-4o-mini, gpt-4.1-*, gpt-3.5-*, etc.)
 *     - `max_tokens` bounds total output
 *     - `temperature` accepts any 0..2
 *     - Response `message.content` is always populated
 *
 *   REASONING (gpt-5-*, o1-*, o3-*, o4-*)
 *     - `max_tokens` 400s → must use `max_completion_tokens`
 *     - `temperature` != 1 → 400s, must omit the key
 *     - `max_completion_tokens` INCLUDES reasoning tokens, which at
 *       the default `reasoning_effort: 'medium'` burn 200-500+ tokens
 *       before any message is produced. Low budgets → empty content.
 *     - Fix: set `reasoning_effort: 'minimal'` (sufficient for closed-
 *       vocabulary classification — there's nothing to reason about)
 *       AND give a generous budget (3000) so content survives even
 *       if the server ignores minimal and still thinks for a bit.
 *
 * Source: openai/openai-python #2546, community.openai.com threads on
 * empty GPT-5 output.
 */
const REASONING_MODEL = /^(gpt-5|o[134]-)/i;

async function classifyOpenai(
  userMessage: string,
  model: string,
): Promise<{ parsed: unknown; tokensIn: number; tokensOut: number; reasoningTokens: number }> {
  const isReasoning = REASONING_MODEL.test(model);

  // Build request body with the right dialect's keys.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_schema', json_schema: OUTPUT_JSON_SCHEMA },
  };

  if (isReasoning) {
    // Reasoning-style model: big enough budget for reasoning + JSON output,
    // and tell the server we want minimal reasoning (we're doing trivial
    // pick-from-list classification, not chain-of-thought).
    body.max_completion_tokens = 3000;
    body.reasoning_effort = 'minimal';
    // NOTE: `temperature` intentionally omitted — only default (1) is accepted.
  } else {
    // Classic model: tight budget, deterministic-ish temperature.
    body.max_tokens = 600;
    body.temperature = 0.2;
  }

  // The SDK types don't yet know about `reasoning_effort` for all model
  // families, and our body is dynamically keyed. Cast is safe — the
  // OpenAI API accepts the extra fields on reasoning-style models.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await openai.chat.completions.create(body as any);

  const content = res.choices[0]?.message?.content;
  const usage = res.usage;
  const tokensIn = usage?.prompt_tokens ?? 0;
  const tokensOut = usage?.completion_tokens ?? 0;
  const reasoningTokens =
    (usage as { completion_tokens_details?: { reasoning_tokens?: number } } | undefined)
      ?.completion_tokens_details?.reasoning_tokens ?? 0;

  if (!content) {
    // Give an actionable error: tell the caller exactly why content is empty.
    const finishReason = res.choices[0]?.finish_reason ?? 'unknown';
    throw new Error(
      `OpenAI returned empty content (finish_reason=${finishReason}, ` +
      `reasoning_tokens=${reasoningTokens}, completion_tokens=${tokensOut}). ` +
      `For reasoning models this usually means the reasoning-effort ate the ` +
      `max_completion_tokens budget before the message could be produced.`
    );
  }

  const parsed = JSON.parse(content);
  return { parsed, tokensIn, tokensOut, reasoningTokens };
}

function cleanSuggested(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || /^null$/i.test(t)) return null;
  return t;
}

// ─────────────────────────────────────────────────────────────────────
// Stats
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
  tokensIn: number;
  tokensOut: number;
  startedAt: number;
}

function newStats(): Stats {
  return {
    processed: 0, enriched: 0, failed: 0,
    fetchOk: 0, fetchSkipped: 0, fetchFailed: 0,
    descFilled: 0, priceFilled: 0, rateLimited: 0,
    studentTrue: 0, familyTrue: 0,
    tokensIn: 0, tokensOut: 0,
    startedAt: Date.now(),
  };
}

/**
 * Price per million tokens — update when switching models.
 *
 * Note on RPD strategy: OpenAI rate limits are **per-model, per-org**, so
 * hitting the daily cap on gpt-4o-mini doesn't touch gpt-4.1-nano's
 * budget. The `-nano` variants are both cheaper AND give you a fresh
 * quota when -mini is exhausted. Order here roughly reflects cost-
 * per-event ascending.
 */
const PRICING = {
  'gpt-5-nano': { in: 0.05, out: 0.40 },
  'gpt-4.1-nano': { in: 0.10, out: 0.40 },
  'gpt-4o-mini': { in: 0.15, out: 0.60 },
  'gpt-5-mini': { in: 0.25, out: 2.00 },
  'gpt-4.1-mini': { in: 0.40, out: 1.60 },
  'gpt-5': { in: 1.25, out: 10.00 },
  'gpt-4.1': { in: 2.00, out: 8.00 },
  'gpt-4o': { in: 2.50, out: 10.00 },
} as const;

function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const price = (PRICING as Record<string, { in: number; out: number } | undefined>)[model];
  if (!price) return 0;
  return (tokensIn / 1_000_000) * price.in + (tokensOut / 1_000_000) * price.out;
}

function reportLine(s: Stats, total: number | undefined, model: string): string {
  const elapsed = (Date.now() - s.startedAt) / 1000;
  const rate = s.processed / Math.max(elapsed, 0.001);
  const etaStr = total && rate > 0
    ? `eta=${(((total - s.processed) / rate) / 60).toFixed(0)}min`
    : '';
  const costUsd = estimateCostUsd(model, s.tokensIn, s.tokensOut);
  return `p=${s.processed}${total ? '/' + total : ''} ✓=${s.enriched} ✗=${s.failed} ` +
    `fetch(ok=${s.fetchOk} fail=${s.fetchFailed}) ` +
    `filled(d=${s.descFilled} p=${s.priceFilled}) ` +
    `flags(stu=${s.studentTrue} fam=${s.familyTrue}) ` +
    `429=${s.rateLimited} $=${costUsd.toFixed(2)} rate=${rate.toFixed(1)}/s ${etaStr}`;
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

// ─────────────────────────────────────────────────────────────────────
// Per-event worker
// ─────────────────────────────────────────────────────────────────────

/**
 * Thrown when we hit OpenAI's per-day request cap. Distinct from the
 * per-minute TPM/RPM caps because RPD resets only at midnight Pacific —
 * no amount of waiting within the current script run will clear it, so
 * we exit cleanly rather than burning hours of backoff loops.
 */
class RpdExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RpdExhaustedError';
  }
}

async function processOne(
  supabase: SupabaseClient,
  row: EventRow,
  opts: CliOpts,
  stats: Stats,
  limiter: TpmLimiter,
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

  // 2. Call OpenAI with client-side TPM throttle + explicit retry loop.
  //    - Estimate tokens for the reservation (generous so we don't
  //      under-book the limiter — the embedded 180-tag taxonomy pushes
  //      the system prompt to ~2500 tokens alone, far more than a naive
  //      "~1000" estimate).
  //    - Limiter blocks until tokens are available in the last-60s window.
  //    - Explicit retry loop around 429s + SDK's 3 auto-retries underneath.
  const userMsg = buildUserMessage(row, pageContent);
  // Actual measured: system ~2500 + user 0.4 tok/char + output ~400-600.
  // German tokenizes worse than English → 0.4 chars/token is closer than 0.3.
  const estimatedTokens = 2500 + Math.ceil(userMsg.length * 0.4) + 600;

  const MAX_ATTEMPTS = 6;
  let parsed: unknown = null;
  let tokensIn = 0, tokensOut = 0;
  let lastErr: string | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Reserve budget for this attempt. On retry after 429 the previous
    // reservation is still in the window (ages out naturally after 60s)
    // so this acquire naturally waits for capacity.
    await limiter.acquire(estimatedTokens);

    try {
      const result = await classifyOpenai(userMsg, opts.model);
      parsed = result.parsed;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      stats.tokensIn += tokensIn;
      stats.tokensOut += tokensOut;
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      const is429 = /429|rate.limit|Rate.limit/i.test(lastErr);
      if (is429) stats.rateLimited += 1;

      // Hard-stop on DAILY limit — retrying within the same day just
      // wastes hours of backoff against a wall that won't budge until
      // midnight Pacific (~9am CET). Bubble a special marker up and let
      // the main loop terminate cleanly with instructions.
      const isRpd = /requests per day|RPD|daily limit/i.test(lastErr);
      if (isRpd) {
        throw new RpdExhaustedError(lastErr);
      }

      if (attempt === MAX_ATTEMPTS - 1) break;

      // Respect server's "try again in Xms" hint when present, else exp backoff.
      const hintMatch = lastErr.match(/try again in (\d+)ms/i);
      const serverHintMs = hintMatch ? parseInt(hintMatch[1], 10) : 0;
      const baseBackoff = is429 ? 2000 : 1000;
      const backoffMs = Math.max(
        serverHintMs + 200,
        baseBackoff * Math.pow(2, attempt), // 2s, 4s, 8s, 16s, 32s for 429
      );
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }

  if (!parsed) {
    console.error(`\n[${row.id.slice(0, 8)}] openai failed: ${lastErr?.slice(0, 200) ?? '?'}`);
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

  if (opts.verbose) {
    const lines: string[] = [];
    const titleCut = row.title.length > 65 ? row.title.slice(0, 65) + '…' : row.title;
    lines.push('');
    lines.push(`━━ [${row.id.slice(0, 8)}] ${titleCut}`);
    lines.push(`   ort:            ${row.location_name ?? '-'}`);
    lines.push(`   cat-v2 says:    ${row.category ?? '-'}   (page-fetch: ${pageContent ? `${pageContent.length} chars` : fetchErr ? `✗ ${fetchErr}` : 'skipped'})`);
    lines.push(`   tags:           ${validated.tags.join(', ') || '(none)'}`);
    lines.push(`   audience:       ${validated.audience.join(', ') || '(none)'}`);
    lines.push(`   vibe:           ${validated.vibe.join(', ') || '(none)'}`);
    lines.push(`   setting:        ${validated.setting.join(', ') || '(none)'}`);
    lines.push(`   language:       ${validated.language ?? '-'}`);
    lines.push(`   price_tier:     ${validated.price_tier ?? '-'}`);
    lines.push(`   duration_type:  ${validated.duration_type ?? '-'}`);
    lines.push(`   flags:          student=${validated.is_student_friendly}   family=${validated.is_family_friendly}`);
    lines.push(`   tokens:         in=${tokensIn} out=${tokensOut}   cost=$${estimateCostUsd(opts.model, tokensIn, tokensOut).toFixed(4)}`);
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
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  });
  stats.processed += 1;
}

async function worker(
  queue: EventRow[],
  supabase: SupabaseClient,
  opts: CliOpts,
  stats: Stats,
  total: number | undefined,
  limiter: TpmLimiter,
): Promise<void> {
  while (queue.length > 0) {
    const row = queue.shift();
    if (!row) break;
    try {
      await processOne(supabase, row, opts, stats, limiter);
    } catch (err) {
      // RPD exhausted — drain the queue so all workers exit, then let main bubble up.
      if (err instanceof RpdExhaustedError) {
        queue.length = 0;
        throw err;
      }
      stats.failed += 1;
      stats.processed += 1;
      console.error(`\nworker error on ${row.id.slice(0, 8)}: ${err instanceof Error ? err.message : err}`);
    }
    if (stats.processed % 10 === 0 || stats.processed <= 10) {
      process.stdout.write('  ' + reportLine(stats, total, opts.model) + '\r');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY missing from env / .env.local');
    process.exit(1);
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(supaUrl, supaKey);
  const today = new Date().toISOString().split('T')[0];

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

  console.log('\nEvent Enrichment — OpenAI direct');
  console.log(`  Model:           ${opts.model}`);
  console.log(`  Concurrency:     ${opts.concurrency} workers`);
  console.log(`  TPM limit:       ${opts.tpmLimit.toLocaleString()} (client-side throttle)`);
  console.log(`  Dry-run:         ${opts.dryRun}`);
  console.log(`  Fetch URLs:      ${!opts.noFetch}`);
  console.log(`  Force re-run:    ${opts.force}`);
  console.log(`  Log file:        ${opts.logFile ?? '(none)'}`);
  console.log(`  Limit:           ${opts.limit === Infinity ? 'none' : opts.limit}`);
  console.log(`  Target version:  ${ENRICHMENT_VERSION}`);
  console.log(`  Already done:    ${alreadyDone ?? '?'}   (resume-safe — these are skipped)`);
  console.log(`  Still pending:   ${totalPending ?? '?'}`);
  const pricing = (PRICING as Record<string, { in: number; out: number } | undefined>)[opts.model];
  if (pricing && totalPending) {
    const estCost = (totalPending * (3500 * pricing.in + 400 * pricing.out)) / 1_000_000;
    console.log(`  Cost estimate:   ~$${estCost.toFixed(2)} for full run`);
  }
  console.log('─'.repeat(70));

  const stats = newStats();
  const limiter = new TpmLimiter(opts.tpmLimit);
  appendLog(opts.logFile, { status: 'run_start', model: opts.model, concurrency: opts.concurrency, tpm_limit: opts.tpmLimit, already_done: alreadyDone, pending: totalPending });

  const PAGE_SIZE = 400;

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
    const workers = Array.from({ length: opts.concurrency }, () =>
      worker(queue, supabase, opts, stats, totalPending ?? undefined, limiter),
    );

    try {
      await Promise.all(workers);
    } catch (err) {
      if (err instanceof RpdExhaustedError) {
        process.stdout.write('\n\n');
        console.log('━'.repeat(70));
        console.log('  ⏸  OPENAI DAILY REQUEST CAP REACHED (RPD)');
        console.log('━'.repeat(70));
        console.log('');
        console.log('  Tier 1 allows 10.000 Requests pro Tag über alle Modelle hinweg.');
        console.log('  Das ist ein harter Cap — Retrys helfen heute nicht mehr.');
        console.log('');
        console.log(`  Bis hierhin erfolgreich enriched:  ${stats.enriched} Events`);
        console.log(`  Verbrannt:                         $${estimateCostUsd(opts.model, stats.tokensIn, stats.tokensOut).toFixed(2)}`);
        console.log('');
        console.log('  Optionen:');
        console.log('    1) $50 Credit aufladen → Tier 2 meist binnen Stunden');
        console.log('       → RPD 10k → 30k+, TPM 200k → 2M');
        console.log('       https://platform.openai.com/settings/organization/billing');
        console.log('');
        console.log('    2) Warten: RPD resettet um 00:00 Pacific ≈ 09:00 MESZ');
        console.log('       Dann einfach Script neu starten — resume-safe.');
        console.log('');
        console.log(`  Letzter Server-Fehler:`);
        console.log(`  ${(err as Error).message.slice(0, 300)}`);
        console.log('━'.repeat(70));
        break;
      }
      throw err;
    }

    if (opts.dryRun || opts.force) break;
    if (rows.length < PAGE_SIZE) break;
  }

  process.stdout.write('\n' + '─'.repeat(70) + '\n');
  console.log(reportLine(stats, totalPending ?? undefined, opts.model));
  const elapsed = (Date.now() - stats.startedAt) / 60000;
  console.log(`Elapsed: ${elapsed.toFixed(1)}min`);
  appendLog(opts.logFile, {
    status: 'run_end',
    processed: stats.processed,
    enriched: stats.enriched,
    failed: stats.failed,
    elapsed_min: elapsed,
    total_cost_usd: estimateCostUsd(opts.model, stats.tokensIn, stats.tokensOut),
  });

  await closeSharedBrowser();
}

process.on('SIGINT', () => {
  console.log('\n\n⚠  SIGINT received. In-flight events may be lost, but DB is consistent —');
  console.log('   re-run the same command to pick up from where you were.');
  closeSharedBrowser().finally(() => process.exit(130));
});

main().catch((err) => {
  console.error('enrich-openai failed:', err);
  closeSharedBrowser().finally(() => process.exit(1));
});
