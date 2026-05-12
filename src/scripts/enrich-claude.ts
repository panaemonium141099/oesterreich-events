/**
 * Batch-enrich events using Claude Code headless (`claude -p`) — v2.
 *
 * NEW DESIGN (fn-14.3) — replaces the per-event `enrich-claude-cli.ts`
 * subprocess + single-row UPDATE pipeline. Key differences:
 *   - Multiple events per `claude -p` invocation (default 20).
 *   - Output is a JSON array; per-event Zod-style validation runs against
 *     the same closed vocabulary (`enrichment-taxonomy.ts`) the OpenAI
 *     pipeline uses, so results are schema-compatible.
 *   - DB writes go through `bulk_update_event_enrichment` RPC via the
 *     `BulkUpdater` helper — same path as `enrich-openai.ts`.
 *   - Per-event 3-strikes counter (`enrichment_failure_count`) →
 *     poison-pill (`enrichment_failed=TRUE`) so persistently bad rows
 *     stop burning quota.
 *   - Selection contract is explicit: published / published_low_confidence /
 *     needs_review only, no start_date/quality_score filter.
 *
 * ────────────────────────────────────────────────────────────────────
 * Spike result (fn-14.3 Step 1, 2026-05-07)
 * ────────────────────────────────────────────────────────────────────
 * `claude -p --output-format json --no-session-persistence --max-turns 1`
 * produces a JSON envelope with these load-bearing fields:
 *
 *   {
 *     "type": "result",
 *     "subtype": "success",          // or "error"
 *     "is_error": false,             // critical: success-without-content
 *                                    // (e.g. "Not logged in") still has
 *                                    // is_error:true even when subtype=success
 *     "result": "{...escaped JSON...}",   // the model's actual response
 *     "stop_reason": "end_turn",
 *     "total_cost_usd": 0.268718...,      // verified present
 *     "usage": {
 *       "input_tokens": 5,
 *       "cache_creation_input_tokens": 42927,
 *       "cache_read_input_tokens": 0,
 *       "output_tokens": 16,
 *       ...
 *     },
 *     "modelUsage": { "<model-id>": { "costUSD": ..., ... } }
 *   }
 *
 * Both `total_cost_usd` and the `usage.*` token counts are first-class
 * fields, so we can use both as primary signals for quota tracking.
 *
 * `--bare` only works when ANTHROPIC_API_KEY is set. Without an API key
 * it produces is_error:true / result:"Not logged in · Please run /login"
 * and `usage.*` all zero. So `--bare` is conditional below.
 */

import { readFileSync, appendFileSync, mkdirSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { jsonrepair } from 'jsonrepair';
import { join, dirname, isAbsolute, delimiter as pathDelimiter } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// ─────────────────────────────────────────────────────────────────────
// Resolve `claude` binary on disk. Prefer .exe direct-spawn on Windows
// to dodge the cmd.exe wrapper window flash.
// ─────────────────────────────────────────────────────────────────────
function resolveClaudeBinary(prefBin: string): { path: string; useShell: boolean } {
  if (isAbsolute(prefBin) && existsSync(prefBin)) {
    return { path: prefBin, useShell: false };
  }
  const pathDirs = (process.env.PATH ?? '').split(pathDelimiter).filter(Boolean);
  const extensions = process.platform === 'win32'
    ? ['.exe', '.cmd', '.bat', '']
    : [''];
  for (const dir of pathDirs) {
    for (const ext of extensions) {
      const candidate = join(dir, prefBin + ext);
      if (existsSync(candidate)) {
        const useShell = process.platform === 'win32' && ext !== '.exe';
        return { path: candidate, useShell };
      }
    }
  }
  return { path: prefBin, useShell: process.platform === 'win32' };
}

// Load .env.local manually so we don't depend on tsx's --env-file flag
// for run-from-script invocations.
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
} catch { /* .env.local absent — fine if env is provided externally */ }

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetchEventPage, closeSharedBrowser } from '../lib/category-classifier/fetch-page';
import Anthropic from '@anthropic-ai/sdk';
import { makeBulkUpdater } from '../lib/db/bulk-update';
import {
  TAGS, AUDIENCES, VIBES, SETTINGS, OCCASIONS, PRICE_FLAGS,
  LANGUAGES, PRICE_TIERS, DURATION_TYPES, PRIMARY_CATEGORIES,
} from '../lib/category-classifier/enrichment-taxonomy';
import {
  validateClaudeBatch,
  type ClaudeEnrichmentResult,
  DESC_MIN, DESC_MAX,
} from '../lib/category-classifier/enrichment-validate';

// ─────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────

/**
 * Bumped per fn-14 epic — re-running this script after a successful
 * earlier run is a no-op for rows already at this version. Re-runs
 * after `--retry-failed` reset the poison-pill flag and pick up.
 */
export const ENRICHMENT_VERSION_CLAUDE_V1 = 'claude-v1';

/**
 * Kill subprocess after this many ms. Per fn-14.3 spec — the upstream
 * claude-code#28482 hang issue means we MUST own a hard timeout, not
 * trust the CLI to terminate cleanly.
 */
const CLAUDE_TIMEOUT_MS = 180_000;

/**
 * Hard cap on raw page-text fed to the prompt (per-event slice).
 * fn-14.3 Interview: 8000 chars max, tail-truncate marker if exceeded.
 * Note: `fetchEventPage` already caps internally at 4000, so this is a
 * belt-and-suspenders safety on top.
 */
const MAX_PAGE_CHARS = 8000;

const MODEL_MAP: Record<string, string> = {
  // fn-14.3 spec — Sonnet 4.6 default, Opus 4.7 fallback, Haiku for cheap.
  // ENRICH_MODEL env var can override the CLI flag.
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
  haiku: 'claude-haiku-4-5-20251001',
};

// Anthropic API requires fully-qualified model IDs (with date suffix). The CLI
// accepts aliases like 'claude-sonnet-4-6' but the API does not. Use the same
// concrete model name we already pass to --model, then fall back to the alias
// for unknown shortcuts.
const MODEL_API_MAP: Record<string, string> = {
  sonnet: 'claude-sonnet-4-6-20260201',
  opus: 'claude-opus-4-7-20260201',
  haiku: 'claude-haiku-4-5-20251001',
};

/**
 * Per-million-token pricing in USD for the Anthropic API path. Verified
 * against console.anthropic.com pricing as of 2026-05. If Anthropic changes
 * rates, update this table — costs are read in `calculateApiCost()` and
 * surfaced via `stats.costUsd` + the `--cost-cap` halt.
 *
 * `cache_create` and `cache_read` differ from `input` by Anthropic's published
 * surcharge/discount factors. We log them separately so an operator can
 * verify spend against the dashboard.
 */
const API_PRICING_PER_MTOK: Record<'sonnet' | 'opus' | 'haiku', {
  input: number; cache_create: number; cache_read: number; output: number;
}> = {
  haiku:  { input: 1.00, cache_create: 1.25, cache_read: 0.10, output: 5.00 },
  sonnet: { input: 3.00, cache_create: 3.75, cache_read: 0.30, output: 15.00 },
  opus:   { input: 15.00, cache_create: 18.75, cache_read: 1.50, output: 75.00 },
};

/**
 * Hard USD cost cap default. €185 ≈ $200 budget; default to $150 so the script
 * stops with 25% buffer before draining the credit balance. Override with
 * --cost-cap. Set to 0 for unlimited (NOT recommended).
 */
const DEFAULT_COST_CAP_USD = 150;

/**
 * Quota threshold for the weekly token budget. Tunable via
 * --weekly-token-cap CLI flag. Default is conservative — Anthropic's
 * MAX-plan weekly cap is undocumented so we set a defensive ~40M
 * tokens/week as the default and expect operators to override after
 * one full bulk run gives us real numbers.
 */
const DEFAULT_WEEKLY_TOKEN_CAP = 40_000_000;

// ─────────────────────────────────────────────────────────────────────
// CLI arg parsing
// ─────────────────────────────────────────────────────────────────────

interface CliOpts {
  batchSize: number;
  concurrency: number;
  limit: number;
  force: boolean;
  retryFailed: boolean;
  dryRun: boolean;
  verbose: boolean;
  noFetch: boolean;
  /** When true, only enrich events with `start_date >= NOW()` (skip past events). */
  futureOnly: boolean;
  model: 'sonnet' | 'opus' | 'haiku';
  claudeBin: string;
  bareMode: boolean;
  logFile: string | null;
  /** RFC-3339 duration filter on `updated_at` (e.g. "24h", "7d"). null = no filter. */
  since: string | null;
  weeklyTokenCap: number;
  alertEmail: string | null;
  /**
   * When true, route batches via the Anthropic SDK (tool_use mode, strict
   * JSON schema, pay-per-token from credit balance) instead of spawning the
   * `claude -p` subprocess. Default: true if ANTHROPIC_API_KEY is set and
   * neither --cli nor --no-api was passed. The API path bypasses the
   * Max-subscription weekly cap and avoids HOME-isolation races.
   */
  useApi: boolean;
  /**
   * Hard USD cost cap for the API path. Halts the run cleanly when reached.
   * 0 = unlimited (not recommended). Default: $150 (≈€140) which leaves
   * a buffer below a typical €185 Anthropic credit balance.
   */
  costCapUsd: number;
}

/**
 * Look up the value of a flag in argv, supporting BOTH common shapes:
 *   --flag value       (split form)
 *   --flag=value       (joined form, common with `--since=24h`)
 * Returns undefined if the flag is missing.
 *
 * Exported for unit-test coverage of the argv parser.
 */
export function getArg(args: string[], flag: string, alt?: string): string | undefined {
  for (const f of [flag, alt].filter((x): x is string => !!x)) {
    // Joined form: --flag=value
    const prefix = f + '=';
    for (const a of args) {
      if (a.startsWith(prefix)) return a.slice(prefix.length);
    }
    // Split form: --flag value
    const i = args.indexOf(f);
    if (i !== -1 && args[i + 1] !== undefined && !args[i + 1].startsWith('--')) {
      return args[i + 1];
    }
  }
  return undefined;
}

/**
 * Parse a numeric flag with bounds enforcement. Exits non-zero on
 * NaN / out-of-range — silently accepting --batch-size 0 was an
 * infinite-loop trap (the for-loop incrementing by zero never
 * terminates), reported by codex review iteration #7.
 *
 * `requireFinite=true` rejects `Infinity` (used for batch-size,
 * concurrency, cap). `requireFinite=false` allows the sentinel
 * `Infinity` value used by --limit when the operator omits it.
 */
function parseIntArg(
  raw: string | undefined,
  fallback: number,
  fieldName: string,
  opts: { min: number; max: number; requireFinite: boolean },
): number {
  if (raw === undefined) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) {
    if (opts.requireFinite || raw.toLowerCase() !== 'infinity') {
      console.error(`Error: ${fieldName}="${raw}" is not a valid integer.`);
      process.exit(1);
    }
    return Infinity as unknown as number;
  }
  if (n < opts.min || n > opts.max) {
    console.error(`Error: ${fieldName}=${n} out of range [${opts.min}, ${opts.max}].`);
    process.exit(1);
  }
  return n;
}

function parseArgs(): CliOpts {
  const args = process.argv.slice(2);
  const get = (flag: string, alt?: string) => getArg(args, flag, alt);

  // ENV override for model (fn-14.3 spec — `ENRICH_MODEL=opus npm run enrich:claude`)
  const envModel = process.env.ENRICH_MODEL?.toLowerCase();
  const cliModel = (get('--model') ?? envModel ?? 'sonnet').toLowerCase();
  const model: 'sonnet' | 'opus' | 'haiku' =
    cliModel === 'opus' ? 'opus' : cliModel === 'haiku' ? 'haiku' : 'sonnet';

  const wantsBare = args.includes('--bare');
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  return {
    // fn-14.3 Interview: conservative defaults (User-Wahl)
    // batchSize/concurrency MUST be positive finite — parseIntArg
    // exits 1 on 0/negative/NaN to avoid the infinite-loop trap codex
    // flagged in iteration #7.
    batchSize: parseIntArg(get('--batch-size'), 20, '--batch-size',
      { min: 1, max: 1000, requireFinite: true }),
    concurrency: parseIntArg(get('--concurrency'), 4, '--concurrency',
      { min: 1, max: 64, requireFinite: true }),
    // --limit and --max-events are aliases (Codex-Finding from fn-14.8 ↔ fn-14.3).
    // --limit accepts 0+; "no limit" path uses the JS Infinity sentinel
    // when operator omits the flag.
    limit: parseIntArg(get('--limit', '--max-events'),
      Infinity as unknown as number, '--limit',
      { min: 0, max: Number.MAX_SAFE_INTEGER, requireFinite: false }),
    force: args.includes('--force'),
    retryFailed: args.includes('--retry-failed'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('--dry-run'),
    noFetch: args.includes('--no-fetch'),
    futureOnly: args.includes('--future-only'),
    model,
    claudeBin: get('--claude-bin') ?? 'claude',
    // --bare is conditional on API key (Codex-Finding) — MAX-OAuth doesn't
    // survive --bare. Empirically verified again on claude-cli 2.1.116 (2026-05-07):
    // `--bare` with MAX-OAuth produces immediate `claude exited 1` (empty stderr).
    // Until Anthropic fixes this, MAX-OAuth users pay the 3-5s startup overhead
    // for skills/MCP/CLAUDE.md loading per call.
    bareMode: wantsBare && hasApiKey,
    logFile: get('--log-file') ?? null,
    // Validate --since up-front: a typo would silently process the
    // entire pending set instead of the 24h delta the operator wanted.
    // parseSince returns null for bad input; we require a parseable value
    // when --since was supplied at all.
    since: (() => {
      const raw = get('--since');
      if (raw == null) return null;
      if (parseSince(raw) === null) {
        console.error(`Error: --since "${raw}" is not a valid duration (use e.g. 24h, 7d, 30m).`);
        process.exit(1);
      }
      return raw;
    })(),
    weeklyTokenCap: parseIntArg(get('--weekly-token-cap'), DEFAULT_WEEKLY_TOKEN_CAP,
      '--weekly-token-cap', { min: 1, max: Number.MAX_SAFE_INTEGER, requireFinite: true }),
    alertEmail: get('--alert-email') ?? process.env.ENRICH_ALERT_EMAIL ?? null,
    // API-mode routing (fn-14.4 — bypasses Max-Subscription weekly cap):
    //   --api     → force API (errors if no key)
    //   --cli / --no-api → force subprocess (legacy path)
    //   default   → API when ANTHROPIC_API_KEY is set, CLI otherwise
    useApi: (() => {
      if (args.includes('--api')) {
        if (!process.env.ANTHROPIC_API_KEY) {
          console.error('Error: --api requires ANTHROPIC_API_KEY in env (.env.local).');
          process.exit(1);
        }
        return true;
      }
      if (args.includes('--cli') || args.includes('--no-api')) return false;
      return !!process.env.ANTHROPIC_API_KEY;
    })(),
    costCapUsd: (() => {
      const raw = get('--cost-cap');
      if (raw === undefined) return DEFAULT_COST_CAP_USD;
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) {
        console.error(`Error: --cost-cap="${raw}" is not a non-negative number.`);
        process.exit(1);
      }
      return n;
    })(),
  };
}

/** Parse "24h" / "7d" / "30m" → milliseconds. Returns null on bad input. */
function parseSince(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d+)\s*([smhd])$/i.exec(s.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(n) || n < 0) return null;
  switch (unit) {
    case 's': return n * 1_000;
    case 'm': return n * 60_000;
    case 'h': return n * 3_600_000;
    case 'd': return n * 86_400_000;
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Prompt builder — generated from code constants, no hardcoded duplicate
// ─────────────────────────────────────────────────────────────────────

/**
 * Build the system-prompt body. Generated from `enrichment-taxonomy.ts`
 * exports so a vocabulary change in code does NOT require a code-side
 * prompt edit (and thereby NEVER produces silent-drop drift).
 *
 * Per fn-14.3 Interview decisions:
 *   - Description: 400-1000 Zeichen, erzählend, Hintergrund erlaubt für
 *     Venues/Gebäude/Städte (verifizierbare Fakten), NICHT für
 *     Personen/Bands/Künstler (only what's in the source text).
 *   - Anti-Bleed: kein "Kategorie X / Tag Y" in der Beschreibung.
 *   - Price-Edge-Cases: "ab 25€" → 25; Spende erbeten → 0 + flag; Mehrfach → Erwachsenen-Preis.
 *   - 3 neue Boolean-Flags: dog_friendly, wheelchair_accessible, outdoor.
 */
function buildSystemPrompt(): string {
  return `Du bist der Event-Klassifikator für LassTreffen.at, eine österreichische Event-Discovery-Plattform.

Du bekommst eine BATCH von Events als JSON-Array (Feld "events" im Input). Du gibst GENAU EIN JSON-Objekt zurück mit dem Feld "results", einem Array gleicher Länge wie der Input. Keine Markdown-Fences, kein Erklärungstext, kein Prefix wie "hier ist die Antwort". NUR das JSON-Objekt.

PFLICHT — INDEX-RÜCKGABE: Jedes Result-Objekt MUSS das Feld "index" enthalten, das exakt dem "index"-Feld des entsprechenden Input-Events entspricht. Reihenfolge im "results"-Array darf abweichen, aber jedes Input-Event MUSS genau einmal in "results" auftauchen. Wenn du einen Index doppelt oder gar nicht zurückgibst, wird der gesamte Batch als fehlerhaft verworfen.

Jedes Result-Objekt hat EXAKT diese Felder:
  index              number   PFLICHT, identisch mit Input.index
  primary_category   string   PFLICHT, EINER aus der Liste (kein null!)
  tags               string[] 0..5
  audience           string[] 0..3
  vibe               string[] 0..3
  occasion           string[] 0..3
  setting            string[] 0..3
  language           string   PFLICHT, EINER aus der Liste
  price_tier         string   PFLICHT, EINER aus der Liste
  price_flags        string[] 0..6
  duration_type      string   PFLICHT, EINER aus der Liste
  is_student_friendly       boolean
  is_family_friendly        boolean
  is_dog_friendly           boolean    NEU
  is_wheelchair_accessible  boolean    NEU
  is_outdoor                boolean    NEU
  suggested_description     string|null
  suggested_price_text      string|null
  suggested_price_min       number|null

══════════════════════════════════════════════════════════════
PRIMARY_CATEGORY (genau 1) — die 11 Hauptkategorien
══════════════════════════════════════════════════════════════
Wähle EINE aus diesen exakten Strings (case-sensitive!):
  ${PRIMARY_CATEGORIES.join(' | ')}

Kurz-Entscheidungen:
  Konzert / Live-Musik / Chor / Tamburica → Musik
  DJ-Set / Rave / Club / Motto-Party → Nightlife & Party
  Theater / Kabarett / Oper / Comedy / Lesung → Kultur & Bühne
  Adventmarkt / Kirtag / Pfarrfest / Brauchtum → Märkte & Feste
  Yoga-Retreat / Meditation / Wallfahrt / Sauna → Wellness & Spiritualität
  Yoga-Kurs / Marathon / Fitness / Tanzkurs → Sport & Bewegung
  Wanderung / Naturführung / Klettern / Bergtour → Natur & Abenteuer
  Vortrag / Workshop / Networking / Tech-Meetup → Wissen & Karriere
  Kindertheater / Spielfest / Ferienprogramm → Familie & Kinder
  Pub Quiz / Brettspiel / Stammtisch / Game-Night → Community & Freizeit
  Weinverkostung / Tasting / Heuriger / Kochkurs → Essen & Trinken

Wenn ein Event zu zwei Kategorien passt → die PRIMÄRE Absicht (was würde groß auf dem Flyer stehen?). "Sonstiges" NUR wenn wirklich nichts passt.

Beispiele zum Einprägen:
- "Tamburicaabend am Sportplatz Trausdorf" → Musik (Sportplatz ist nur der Ort)
- "Pub Quiz im Studentenclub" → Community & Freizeit
- "Weinwanderung mit Verkostung" → Natur & Abenteuer (Wandern dominiert)
- "Adventmarkt mit Live-Band" → Märkte & Feste (Markt dominiert)
- "Rave im Wald" → Nightlife & Party
- "Yoga-Retreat am Wochenende" → Wellness & Spiritualität (NICHT Sport)

══════════════════════════════════════════════════════════════
TAGS (0..5) — Aktivitäts-/Genre-Tags. ERLAUBT NUR aus dieser Liste:
══════════════════════════════════════════════════════════════
${TAGS.join(', ')}

══════════════════════════════════════════════════════════════
AUDIENCE (0..3) — ERLAUBT NUR aus dieser Liste:
══════════════════════════════════════════════════════════════
${AUDIENCES.join(', ')}

══════════════════════════════════════════════════════════════
VIBE (0..3) — emotionaler Ton. ERLAUBT NUR:
══════════════════════════════════════════════════════════════
${VIBES.join(', ')}

══════════════════════════════════════════════════════════════
OCCASION (0..3) — Anlass-Tags ("wofür ist das gut?"). ERLAUBT NUR:
══════════════════════════════════════════════════════════════
${OCCASIONS.join(', ')}

Hinweise:
- "saufen-gehen" → Bar-Events, Club-Nights mit Drink-Fokus, Heurigen-Abende, Weinverkostung mit Party
- "date-night" → romantisch, Dinner, Weinverkostung für Paare, Konzerte mit intimer Stimmung
- "afterwork" → ab 17-19h, Wochentag, relaxed
- "tagesausflug" → ganztägig, außerhalb des Wohnorts, Natur/Sightseeing
- "regentag" → Indoor-Event, gut bei schlechtem Wetter

══════════════════════════════════════════════════════════════
SETTING (0..3) — Ort + Format + Zeit. ERLAUBT NUR:
══════════════════════════════════════════════════════════════
${SETTINGS.join(', ')}

══════════════════════════════════════════════════════════════
PRICE_TIER (genau 1): ${PRICE_TIERS.join(' | ')}
══════════════════════════════════════════════════════════════
gratis=0€ · günstig=bis 15€ · mittel=15-50€ · premium=über 50€

DEFAULT-REGEL: Wenn weder Metadaten noch Quelltext einen Preis zeigen → "gratis". Viele AT-Events sind frei (Frühschoppen, Kirtag, Pfarrfest, Gottesdienst, Dorffest, Gemeindeveranstaltung). "unbekannt" NUR bei klarer Ambiguität.

══════════════════════════════════════════════════════════════
PRICE_FLAGS (0..6) — ERLAUBT NUR:
══════════════════════════════════════════════════════════════
${PRICE_FLAGS.join(', ')}

══════════════════════════════════════════════════════════════
DURATION_TYPE (genau 1): ${DURATION_TYPES.join(' | ')}
══════════════════════════════════════════════════════════════
kurz=<2h · abend=2-5h · ganztag · mehrtägig · dauerausstellung · nacht-bis-morgen=22h-6h · 24-stunden · 48-stunden

══════════════════════════════════════════════════════════════
LANGUAGE (genau 1): ${LANGUAGES.join(' | ')}
══════════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════════
BOOLEAN FLAGS (KRITISCH — TRUE nur bei EXPLIZITER Evidenz)
══════════════════════════════════════════════════════════════

is_student_friendly = TRUE nur wenn:
  (a) Titel/Text nennt "Studenten", "Studierende", "Uni-Party", "Semester-Opening"
  (b) Ort ist Uni/FH (TU, WU, Uni Wien/Graz/Linz/Salzburg/Innsbruck, FH Burgenland)
  (c) Veranstalter ist Studentenvereinigung (ÖH, ESN, AIESEC, IAESTE, AEGEE)
  (d) Explizite Studenten-Ermäßigung
  Sonst → FALSE.

is_family_friendly = TRUE nur wenn:
  (a) Titel/Text nennt "Familie", "Kinder", "ab 3/6 Jahren", "Kinderprogramm"
  (b) Inhärent kinderorientiert: Kindertheater, Puppentheater, Kinderkino, Familien-Picknick, Spielfest, Kirtag, Adventmarkt tagsüber, Erntedank, Maibaumfest, Ferienprogramm
  (c) Ort/Veranstalter familienorientiert (Familienzentrum, Zoo, Kindermuseum)
  Sonst → FALSE.

is_dog_friendly = TRUE nur wenn:
  Quelltext explizit "Hunde willkommen", "hundefreundlich", "Hund OK" o.ä. nennt, oder Outdoor-Event mit eindeutigem Hunde-Bezug (Hundewanderung, Gassi-Treff). Outdoor-Wanderungen alleine reichen NICHT.
  Im Zweifel → FALSE.

is_wheelchair_accessible = TRUE nur wenn:
  Quelltext "barrierefrei", "rollstuhlgerecht", "wheelchair accessible" o.ä. nennt. Im Zweifel → FALSE.

is_outdoor = TRUE wenn:
  Event hauptsächlich draußen stattfindet (Open-Air, Park, Wald, Berg, Stadtfest am Platz). NICHT für Indoor-Veranstaltungen mit Garten-Aufenthalt. Im Zweifel → FALSE.

══════════════════════════════════════════════════════════════
SUGGESTED_DESCRIPTION (string oder null — KRITISCH)
══════════════════════════════════════════════════════════════
LÄNGE: 400 bis 1000 Zeichen. Wenn du eine Beschreibung lieferst, MUSS sie in diesem Bereich liegen.

WANN NULL ZURÜCKGEBEN: Wenn die existierende BESCHREIBUNG ≥ 400 Zeichen UND keine HTML-Tags hat UND inhaltlich solide ist, gib **null** zurück (= "alte Beschreibung gut, in Ruhe lassen"). Bei kürzer als 40 Zeichen oder fast leer: schreib eine neue. Bei 40..400 Zeichen: ergänze und poliere auf 400+ Zeichen.

STIL: ERZÄHLEND, in fließendem Deutsch (nicht Bullet-Liste). Kein Marketing-Geschwurbel. Kein HTML.

HINTERGRUND-WISSEN: Du DARFST verifizierbare Fakten über VENUES, historische Gebäude, Städte und Regionen einbauen (z.B. "die Pfarrkirche stammt aus dem 18. Jahrhundert", "das Schloss Schlaining ist ein Friedensburg-Standort"). Du DARFST KEINE Hintergrund-Behauptungen über PERSONEN, BANDS oder KÜNSTLER machen — dort schreibst du nur das, was im Quelltext steht. Erfinde KEINE Diskografien, Tour-Stationen, Mitglieder.

ANTI-BLEED-REGEL (wichtig!): Erwähne in der Beschreibung NIE die Kategorie ("Dies ist ein Musik-Event", "ein Sport & Bewegung-Event") und KEINE Tag-Namen ("psytrance-Vibe", "audience: studenten"). Das sind interne Klassifikations-Felder, kein Marketing-Text.

JSON-VALIDITÄT (KRITISCH): Verwende KEINE doppelten Anführungszeichen (") und KEINE typografischen Anführungszeichen („ "" » «) INNERHALB des description-Texts. Das macht die JSON-Antwort ungültig.
  - FALSCH: "Die Band „Die Mayrhofner" tritt auf"
  - FALSCH: "Die Band \"Die Mayrhofner\" tritt auf" (nicht escapen — komplett vermeiden)
  - RICHTIG: "Die Band Die Mayrhofner tritt auf"
  - RICHTIG: "Auf der Bühne stehen die Bands Die Mayrhofner, Johannes Niggl und das Kreuzberger Trio"
Bandnamen, Zitate, Buchtitel etc. einfach OHNE Quotation-Marks formulieren. Wenn unbedingt Hervorhebung nötig: nutze Doppelpunkt oder Umschreibung. KEINE Anführungszeichen aller Art im suggested_description String.

══════════════════════════════════════════════════════════════
SUGGESTED_PRICE_TEXT + SUGGESTED_PRICE_MIN
══════════════════════════════════════════════════════════════
suggested_price_text: kurzer Originaltext aus dem Quelltext, wenn ein Preis genannt wird ("ab 25€", "Eintritt frei", "Erwachsene 15€ / Kinder frei", "Spende erbeten"). Wenn das PREIS-Feld bereits gefüllt ist, gib null zurück. Maximal 200 Zeichen.

suggested_price_min: NUMERISCHER Preis in EUR (Untergrenze).
  - "ab 25€"                            → 25
  - "Eintritt frei" / "kostenlos"       → 0
  - "Spende erbeten" / "Auf Spendenbasis" → 0  (UND price_flags enthält 'spende-erbeten')
  - "Erwachsene 15€ / Kinder 8€"        → 15  (Erwachsenen-Preis ist Standard, NICHT Kinder-Discount)
  - "20€ - 35€"                         → 20  (Untergrenze)
  - "65€"                               → 65
  - kein Preis ableitbar                → null

KEIN Preis im Text → suggested_price_min = null.

══════════════════════════════════════════════════════════════
OUTPUT-FORMAT (genau dieses und kein anderes):
══════════════════════════════════════════════════════════════
{
  "results": [
    { ...result for input[0]... },
    { ...result for input[1]... },
    ...
  ]
}

KEIN Markdown, KEINE Code-Fences, KEIN Erklärungstext davor oder danach.`;
}

// ─────────────────────────────────────────────────────────────────────
// Per-event input row + user-message builder
// ─────────────────────────────────────────────────────────────────────

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  category_locked: boolean | null;
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
  enrichment_failure_count: number | null;
}

interface BatchInputItem {
  index: number;
  TITEL: string;
  BESCHREIBUNG: string;
  BISHERIGE_KATEGORIE?: string;
  ROH_TAGS?: string[];
  ORT?: string;
  VERANSTALTER?: string;
  ZEIT?: string;
  PREIS?: string;
  PREIS_MIN_EUR?: number;
  QUELLTEXT?: string;
}

function buildBatchInput(events: EventRow[], pages: Array<string | null>): BatchInputItem[] {
  return events.map((ev, i) => {
    const item: BatchInputItem = {
      index: i,
      TITEL: ev.title,
      BESCHREIBUNG: ev.description ? ev.description.slice(0, 600) : '(leer)',
    };
    if (ev.category) item.BISHERIGE_KATEGORIE = ev.category;
    const rawTags = ev.source_tags_raw ?? ev.tags;
    if (rawTags && rawTags.length > 0) item.ROH_TAGS = rawTags.slice(0, 10);
    if (ev.location_name) item.ORT = ev.location_name;
    if (ev.organizer) item.VERANSTALTER = ev.organizer;
    if (ev.start_date) {
      const d = new Date(ev.start_date);
      if (!isNaN(d.getTime())) {
        const hour = d.getHours();
        const weekday = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
        item.ZEIT = `${weekday} ${hour}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    }
    if (ev.price_text) item.PREIS = ev.price_text;
    if (ev.price_min != null) item.PREIS_MIN_EUR = ev.price_min;

    const page = pages[i];
    if (page) {
      // fn-14.3 Interview: cap at MAX_PAGE_CHARS, tail-truncate marker.
      // "Tail-truncate" here means "drop the tail" → keep the HEAD of
      // the page text (where headline/description/lineup typically
      // sit on Austrian event pages), append marker. Codex review
      // pointed out the previous comment claimed the opposite of what
      // the code did — keeping head is the correct behavior, comment
      // is now precise.
      const trimmed = page.length > MAX_PAGE_CHARS
        ? page.slice(0, MAX_PAGE_CHARS) + '\n... [truncated]'
        : page;
      item.QUELLTEXT = trimmed;
    }
    return item;
  });
}

// ─────────────────────────────────────────────────────────────────────
// Spawn `claude -p` subprocess with hard timeout + SIGKILL
// ─────────────────────────────────────────────────────────────────────

interface ClaudeCallResult {
  parsed: unknown;
  tokensIn: number;
  tokensOut: number;
  cacheReadIn: number;
  cacheCreateIn: number;
  costUsd: number;
  /** stop_reason or "error_<api status>" */
  stopReason: string;
  isError: boolean;
  errorMessage?: string;
  /** Raw envelope for debugging. */
  envelope: unknown;
}

let cachedResolvedClaude: { path: string; useShell: boolean } | null = null;
// Module-scoped so the SIGINT handler can flush pending updates before exit.
// fn-14.4 Codex finding: previously the SIGINT handler closed the browser but
// left BulkUpdater's queue in-memory → all unflushed events lost. Now we
// explicitly flush on graceful shutdown.
let activeBulkUpdater: { flush: () => Promise<number> } | null = null;

/**
 * Cache the path to a temp file containing the system prompt, written
 * once at the start of the run and reused across every batch call.
 *
 * Why a file instead of inline `--append-system-prompt <text>`?
 *   The full system prompt embeds the v2 taxonomy: PRIMARY_CATEGORIES
 *   + ~316 TAGS + AUDIENCES + VIBES + SETTINGS + PRICE_FLAGS + decision
 *   rules. That's 8-12 KB depending on locale. On Windows, command-line
 *   length is capped at 32k chars per arg — close, but combined with
 *   PowerShell escape multipliers it's a fragile path. Using
 *   `--append-system-prompt-file <path>` skips the issue entirely.
 *
 * Lifecycle: written by `getOrCreateSystemPromptFile()` on first call,
 * deleted by `cleanupSystemPromptFile()` in the finally-path of main()
 * + on SIGINT.
 */
let systemPromptFilePath: string | null = null;

function getOrCreateSystemPromptFile(systemPrompt: string): string {
  if (systemPromptFilePath && existsSync(systemPromptFilePath)) {
    return systemPromptFilePath;
  }
  const fname = `enrich-claude-sysprompt-${process.pid}-${randomBytes(4).toString('hex')}.txt`;
  const fpath = join(tmpdir(), fname);
  writeFileSync(fpath, systemPrompt, { encoding: 'utf8' });
  systemPromptFilePath = fpath;
  return fpath;
}

function cleanupSystemPromptFile(): void {
  if (!systemPromptFilePath) return;
  try { unlinkSync(systemPromptFilePath); } catch { /* already gone */ }
  systemPromptFilePath = null;
}

/**
 * HOME-isolation pool: at high concurrency (>=4) parallel claude-CLI
 * subprocesses race on the global ~/.claude.json (telemetry, oauth-refresh,
 * plugin-sync writes). Race-corruption manifests as "Configuration file
 * corrupted: JSON Parse error: Unexpected EOF" → claude exit 1 → 90% fail
 * rate (observed in fn-14.4 production run, ~58k events lost).
 *
 * Fix: per-concurrency-slot isolated HOME directory, each with its own
 * `.claude.json` copy. Subprocesses round-robin through the pool — at most
 * one subprocess writes to any given config file, so no race.
 *
 * Pool size = concurrency. OAuth token is preserved across copies (no
 * re-auth needed). Cleanup on graceful shutdown.
 */
let isolatedHomePool: string[] = [];
let isolatedHomeCounter = 0;

function setupIsolatedHomePool(concurrency: number): void {
  if (isolatedHomePool.length > 0) return;
  const userHome = process.env.USERPROFILE || process.env.HOME || tmpdir();
  const sourceConfig = join(userHome, '.claude.json');
  const sourceCredentials = join(userHome, '.claude', '.credentials.json');
  if (!existsSync(sourceConfig)) {
    console.warn(`  ⚠ ${sourceConfig} not found — skipping HOME-pool isolation (race-condition risk at concurrency >=4)`);
    return;
  }
  if (!existsSync(sourceCredentials)) {
    console.warn(`  ⚠ ${sourceCredentials} not found — claude not logged in? Skipping HOME-pool.`);
    return;
  }
  const cfgContent = readFileSync(sourceConfig, 'utf8');
  const credContent = readFileSync(sourceCredentials, 'utf8');
  for (let i = 0; i < concurrency; i++) {
    const isoDir = join(tmpdir(), `enrich-claude-home-${process.pid}-${i}`);
    const isoClaudeDir = join(isoDir, '.claude');
    try {
      mkdirSync(isoDir, { recursive: true });
      mkdirSync(isoClaudeDir, { recursive: true });
      // .claude.json — root-level config (the file that races on writes)
      writeFileSync(join(isoDir, '.claude.json'), cfgContent);
      // .claude/.credentials.json — OAuth tokens. Without this claude exits
      // with "Not logged in · Please run /login" (was discovered fn-14.4
      // 2026-05-10 after several hours of head-scratching: empty .claude/
      // dir was the silent kill, not the race we initially diagnosed).
      writeFileSync(join(isoClaudeDir, '.credentials.json'), credContent);
      // Other .claude/ subdirs (plugins, projects, cache, etc) intentionally
      // missing — claude lazy-loads them or skips, no plugin SessionEnd hook
      // → no further race surfaces. That's exactly what we want for batch.
    } catch (err) {
      console.warn(`  ⚠ failed to seed iso-home ${i}: ${err instanceof Error ? err.message : err}`);
    }
    isolatedHomePool.push(isoDir);
  }
  console.log(`  HOME-pool:        ${concurrency} isolated dirs in ${tmpdir()} (cfg + credentials seeded, no plugin race)`);
}

function pickIsolatedHome(): string | null {
  if (isolatedHomePool.length === 0) return null;
  const dir = isolatedHomePool[isolatedHomeCounter % isolatedHomePool.length];
  isolatedHomeCounter++;
  return dir;
}

function cleanupIsolatedHomePool(): void {
  for (const dir of isolatedHomePool) {
    try {
      // Remove the .claude.json + the dir; ignore if claude wrote other files
      try { unlinkSync(join(dir, '.claude.json')); } catch { /* gone */ }
    } catch { /* swallow — temp cleanup */ }
  }
  isolatedHomePool = [];
}

// ─────────────────────────────────────────────────────────────────────
// Anthropic API path (fn-14.4) — paranoid replacement for the CLI subprocess.
//
// Why this exists: the `claude -p` CLI subprocess path has three hard
// limitations that hurt at bulk-migration scale:
//   1) Max-subscription weekly cap (undocumented, ~200-500M tok/week).
//      When exhausted, the CLI exits 1 with empty stderr — opaque failure.
//   2) HOME-isolation race when concurrency > 1 (claude writes to
//      ~/.claude.json mid-run, racing parallel subprocesses).
//   3) 3-5s startup overhead per call (skills/MCP/CLAUDE.md loading).
//
// The API path solves all three:
//   - Pay-per-token from credit balance, no weekly cap.
//   - No global config file → no race surface; supports any concurrency.
//   - <100ms cold start, just HTTPS round-trip + model inference.
//
// PARANOIA: we use `tool_use` mode with a fully-typed JSON schema. The API
// physically cannot return an enum value outside our taxonomy (e.g. `48-stunden`
// when the DB only allows `24-stunden`) — Anthropic enforces the schema before
// returning the tool block. Our validator still runs as defense-in-depth for
// free-text fields like `suggested_description`.
// ─────────────────────────────────────────────────────────────────────

let cachedAnthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (cachedAnthropicClient) return cachedAnthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AuthError('ANTHROPIC_API_KEY missing — add to .env.local or set in environment.');
  }
  cachedAnthropicClient = new Anthropic({
    apiKey,
    // We own retry/backoff at the batch level; disable the SDK's built-in
    // retries to avoid double-counting and to surface RateLimitError quickly.
    maxRetries: 0,
    // Per-call timeout: the model can stream tool_use outputs for up to ~60s
    // on a large batch. Set 180s to match CLAUDE_TIMEOUT_MS so failure mode
    // is consistent across paths.
    timeout: CLAUDE_TIMEOUT_MS,
  });
  return cachedAnthropicClient;
}

/**
 * Build the `tool_use` schema for the enrichment tool. Every enum is
 * spread from `enrichment-taxonomy.ts` so the schema and the validator stay
 * in lockstep — if a vocab list changes, both update from the same source.
 *
 * The API rejects tool inputs that violate the schema: enum mismatches, missing
 * required fields, wrong types. So invalid enum values (the `48-stunden`-style
 * bug that killed the CLI run) cannot reach our validator.
 *
 * `suggested_description`, `suggested_price_text`, `suggested_price_min` are
 * the only free-form fields — those go through `validateClaudeBatch` for
 * length/HTML/numeric sanity.
 */
function buildEnrichmentToolSchema(): Record<string, unknown> {
  const stringEnum = (vals: readonly string[], maxItems?: number) =>
    maxItems !== undefined
      ? { type: 'array', items: { type: 'string', enum: [...vals] }, maxItems, default: [] }
      : { type: 'string', enum: [...vals] };

  return {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        description:
          'One entry per input event. Every input index MUST appear exactly once. ' +
          'Order may differ from input — the `index` field is what matters.',
        items: {
          type: 'object',
          properties: {
            index: {
              type: 'integer',
              minimum: 0,
              description: 'Matches the `index` field of the corresponding input event exactly.',
            },
            primary_category: stringEnum(PRIMARY_CATEGORIES),
            tags: stringEnum(TAGS, 5),
            audience: stringEnum(AUDIENCES, 3),
            vibe: stringEnum(VIBES, 3),
            occasion: stringEnum(OCCASIONS, 3),
            setting: stringEnum(SETTINGS, 3),
            language: stringEnum(LANGUAGES),
            price_tier: stringEnum(PRICE_TIERS),
            price_flags: stringEnum(PRICE_FLAGS, 6),
            duration_type: stringEnum(DURATION_TYPES),
            is_student_friendly: { type: 'boolean' },
            is_family_friendly: { type: 'boolean' },
            is_dog_friendly: { type: 'boolean' },
            is_wheelchair_accessible: { type: 'boolean' },
            is_outdoor: { type: 'boolean' },
            suggested_description: {
              type: ['string', 'null'],
              description:
                'Erzählender Fließtext, 400-1000 Zeichen. KEINE Anführungszeichen aller Art im Text. ' +
                'Null = bestehende Beschreibung in Ruhe lassen (≥400 Zeichen, kein HTML, inhaltlich solide).',
            },
            suggested_price_text: {
              type: ['string', 'null'],
              maxLength: 200,
              description: 'Kurz-Original-Text wenn Preis genannt wird (z.B. "ab 25€", "Eintritt frei").',
            },
            suggested_price_min: {
              type: ['number', 'null'],
              minimum: 0,
              description: 'Numerischer Preis-Untergrenzwert in EUR. null wenn kein Preis ableitbar.',
            },
          },
          required: [
            'index', 'primary_category', 'tags', 'audience', 'vibe', 'occasion',
            'setting', 'language', 'price_tier', 'price_flags', 'duration_type',
            'is_student_friendly', 'is_family_friendly', 'is_dog_friendly',
            'is_wheelchair_accessible', 'is_outdoor',
            'suggested_description', 'suggested_price_text', 'suggested_price_min',
          ],
        },
      },
    },
    required: ['results'],
  };
}

/**
 * Compute USD cost for one API call using cached per-model rates.
 * Mirrors what console.anthropic.com bills, so `stats.costUsd` should
 * track the dashboard to ~$0.01 precision over a run.
 */
function calculateApiCost(
  model: 'sonnet' | 'opus' | 'haiku',
  usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null },
): number {
  const r = API_PRICING_PER_MTOK[model];
  return (
    (usage.input_tokens * r.input) +
    (usage.output_tokens * r.output) +
    ((usage.cache_creation_input_tokens ?? 0) * r.cache_create) +
    ((usage.cache_read_input_tokens ?? 0) * r.cache_read)
  ) / 1_000_000;
}

/**
 * Cached singleton schema. We build once at first use because constructing
 * the object every call is wasted work — the enums never change at runtime.
 */
let cachedToolSchema: Record<string, unknown> | null = null;
function getToolSchema(): Record<string, unknown> {
  if (!cachedToolSchema) cachedToolSchema = buildEnrichmentToolSchema();
  return cachedToolSchema;
}

/**
 * Anthropic-API replacement for `callClaudeBatch`. Returns the same
 * `ClaudeCallResult` shape so all downstream code (validator, BulkUpdater,
 * stats) works unchanged.
 *
 * Error taxonomy mapped to our retry/abort policy:
 *   - AuthenticationError, PermissionDeniedError → throw AuthError (fatal,
 *     bails the run with clean message).
 *   - RateLimitError → return isError=true, errorMessage contains retry hint.
 *     The batch retry loop in callClaudeBatch handles backoff.
 *   - APIConnectionError, InternalServerError → return isError=true (retryable).
 *   - BadRequestError → throw immediately (likely a schema/prompt bug; not
 *     worth retrying, and we want loud failure for diagnosis).
 *   - Anything unexpected → propagate.
 */
async function callClaudeApi(
  systemPrompt: string,
  batchInput: BatchInputItem[],
  opts: CliOpts,
): Promise<ClaudeCallResult> {
  const client = getAnthropicClient();
  const model = MODEL_API_MAP[opts.model] ?? MODEL_MAP[opts.model];

  // Output-token budget: each event produces ~600 tokens (description 400-1000
  // chars ≈ 250 tok + tags/enums ≈ 200 tok + tool wrapper ≈ 150 tok). Reserve
  // 1200 tok/event for headroom on Sonnet/Opus which write longer descriptions.
  // Hard cap at 32k — that's well below Haiku 4.5's 64k output ceiling.
  const maxTokens = Math.min(32000, Math.max(4096, batchInput.length * 1200));

  const userMessage = JSON.stringify({ events: batchInput });

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      // Prompt-caching (ephemeral, 5-min TTL): system prompt + tool schema are
      // identical across every batch in a run. Marking them cacheable means
      // subsequent calls pay $0.10/Mtok (Haiku) instead of $1/Mtok for those
      // ~4000 prefix tokens — saves ~10% on a full bulk-migration run. Each
      // cache_control marker adds a 25% surcharge on the FIRST creation, then
      // 90% discount on every read within 5min. Anthropic caps marker count
      // at 4 per request; we use 2 (system + tool).
      system: [{
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      }],
      messages: [{ role: 'user', content: userMessage }],
      tools: [{
        name: 'submit_enrichments',
        description:
          'Submit enriched event metadata for the entire input batch. MUST be called EXACTLY ONCE with all input events in the `results` array. Do not call any other tool, do not produce free text.',
        input_schema: getToolSchema() as unknown as Anthropic.Tool.InputSchema,
        cache_control: { type: 'ephemeral' },
      }],
      tool_choice: { type: 'tool', name: 'submit_enrichments' },
    });
  } catch (err) {
    // ── Typed error routing (paranoid: cover every documented SDK error). ──
    if (err instanceof Anthropic.AuthenticationError) {
      throw new AuthError(`API auth failed: ${err.message}`);
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      throw new AuthError(`API permission denied: ${err.message}`);
    }
    if (err instanceof Anthropic.RateLimitError) {
      // The SDK wraps the `retry-after` header on the response. Parse it
      // (seconds) so the batch retry loop can honor it instead of using its
      // exponential default. headers may be missing on synthetic errors.
      const retryAfterSec = parseRetryAfterFromError(err);
      return {
        parsed: null,
        tokensIn: 0, tokensOut: 0, cacheReadIn: 0, cacheCreateIn: 0, costUsd: 0,
        stopReason: 'rate_limited',
        isError: true,
        errorMessage: `429 rate_limited${retryAfterSec ? ` retry_after=${retryAfterSec}s` : ''}: ${err.message.slice(0, 200)}`,
        envelope: { error: 'RateLimitError', retryAfterSec },
      };
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return {
        parsed: null,
        tokensIn: 0, tokensOut: 0, cacheReadIn: 0, cacheCreateIn: 0, costUsd: 0,
        stopReason: 'timeout',
        isError: true,
        errorMessage: `connection timeout after ${CLAUDE_TIMEOUT_MS}ms: ${err.message.slice(0, 200)}`,
        envelope: { error: 'APIConnectionTimeoutError' },
      };
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return {
        parsed: null,
        tokensIn: 0, tokensOut: 0, cacheReadIn: 0, cacheCreateIn: 0, costUsd: 0,
        stopReason: 'connection_error',
        isError: true,
        errorMessage: `connection error: ${err.message.slice(0, 200)}`,
        envelope: { error: 'APIConnectionError' },
      };
    }
    if (err instanceof Anthropic.InternalServerError) {
      return {
        parsed: null,
        tokensIn: 0, tokensOut: 0, cacheReadIn: 0, cacheCreateIn: 0, costUsd: 0,
        stopReason: '5xx',
        isError: true,
        errorMessage: `5xx server error: ${err.message.slice(0, 200)}`,
        envelope: { error: 'InternalServerError' },
      };
    }
    if (err instanceof Anthropic.BadRequestError) {
      // 400 — almost always a schema/prompt code bug. Fail loudly so we
      // see it on first batch instead of poison-pilling thousands of events.
      throw new Error(`API 400 bad_request (likely schema/prompt bug, not retryable): ${err.message}`);
    }
    if (err instanceof Anthropic.NotFoundError) {
      // 404 on /messages usually means the model ID is invalid.
      throw new Error(`API 404 not_found (likely invalid model "${model}"): ${err.message}`);
    }
    if (err instanceof Anthropic.UnprocessableEntityError) {
      throw new Error(`API 422 unprocessable: ${err.message}`);
    }
    if (err instanceof Anthropic.APIError) {
      // Catch-all for other typed API errors we haven't enumerated.
      return {
        parsed: null,
        tokensIn: 0, tokensOut: 0, cacheReadIn: 0, cacheCreateIn: 0, costUsd: 0,
        stopReason: `api_${err.status ?? 'unknown'}`,
        isError: true,
        errorMessage: `API ${err.status ?? '?'}: ${err.message.slice(0, 200)}`,
        envelope: { error: 'APIError', status: err.status },
      };
    }
    // Unknown error type — re-throw so it surfaces (not silently dropped).
    throw err;
  }

  const usage = response.usage;
  const tokensIn = usage.input_tokens ?? 0;
  const tokensOut = usage.output_tokens ?? 0;
  const cacheCreateIn = usage.cache_creation_input_tokens ?? 0;
  const cacheReadIn = usage.cache_read_input_tokens ?? 0;
  const costUsd = calculateApiCost(opts.model, {
    input_tokens: tokensIn,
    output_tokens: tokensOut,
    cache_creation_input_tokens: cacheCreateIn,
    cache_read_input_tokens: cacheReadIn,
  });

  // The model MUST call our tool. If `tool_choice` forced it, the response
  // should contain exactly one tool_use block. We still defensively check
  // because Anthropic's API has historically allowed `stop_reason='max_tokens'`
  // before the tool block completed, leaving us with truncated output.
  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_enrichments',
  );

  if (!toolBlock) {
    // No tool block — could be max_tokens truncation, stop_reason='refusal', or
    // model produced text instead of the tool call. All are recoverable: surface
    // as isError so the batch retry loop runs.
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );
    return {
      parsed: null,
      tokensIn, tokensOut, cacheReadIn, cacheCreateIn, costUsd,
      stopReason: response.stop_reason ?? 'unknown',
      isError: true,
      errorMessage:
        `no tool_use block | stop_reason=${response.stop_reason} | ` +
        `text_head=${(textBlock?.text ?? '').slice(0, 200)}`,
      envelope: response,
    };
  }

  // `toolBlock.input` is `unknown` per SDK types but is the API's JSON-
  // schema-validated JSON object. The validator downstream still runs as
  // defense-in-depth for free-text fields. Past this point everything is
  // identical to the CLI path — caller can't distinguish API vs CLI results.
  return {
    parsed: toolBlock.input,
    tokensIn, tokensOut, cacheReadIn, cacheCreateIn, costUsd,
    stopReason: response.stop_reason ?? 'end_turn',
    isError: false,
    envelope: response,
  };
}

/**
 * Extract retry-after seconds from a RateLimitError. The SDK exposes
 * `headers` on the error object; the header is named lowercase per HTTP/2.
 * Returns 0 if header is absent or unparseable — caller falls back to its
 * exponential backoff.
 */
function parseRetryAfterFromError(err: unknown): number {
  if (!err || typeof err !== 'object') return 0;
  const headers = (err as { headers?: Record<string, string | string[] | undefined> }).headers;
  if (!headers) return 0;
  const raw = headers['retry-after'] ?? headers['Retry-After'];
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (!val) return 0;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 120) : 0;
}

async function callClaudeBatch(
  systemPrompt: string,
  batchInput: BatchInputItem[],
  opts: CliOpts,
): Promise<ClaudeCallResult> {
  // ──── API path (fn-14.4 paranoid replacement) ────
  // When opts.useApi is set, route through the Anthropic SDK using tool_use
  // mode. The downstream contract (ClaudeCallResult shape) is identical so
  // processBatch/validator/BulkUpdater don't care which path produced the
  // result. This branch is reached BEFORE we touch isolatedHomePool or the
  // CLI binary resolver so an API run has zero CLI-mode side effects.
  if (opts.useApi) {
    return callClaudeApi(systemPrompt, batchInput, opts);
  }

  const model = MODEL_MAP[opts.model];
  if (!cachedResolvedClaude) {
    cachedResolvedClaude = resolveClaudeBinary(opts.claudeBin);
  }
  const resolved = cachedResolvedClaude;

  // Build args. fn-14.3 spec: --output-format json (parsed envelope),
  // --no-session-persistence (no transcript files), --max-turns 1
  // (single round-trip, no agent loop), --append-system-prompt-file
  // (system-role prompt loaded from disk — Codex review finding:
  // passing the 8-12KB taxonomy inline as a CLI arg is fragile on
  // Windows. The file is written once per run and reused.)
  const sysPromptFile = getOrCreateSystemPromptFile(systemPrompt);
  // fn-14.3 (2026-05-07): claude CLI 2.1.116 hat einen bug bei
  // --output-format json wo lange `result` strings im envelope
  // truncated werden (~80% loss bei 2k+ token outputs, env-Tests
  // zeigen tok_out=2340 vs result_len=1400). Default: text.
  // Json-mode bleibt verfügbar via ENRICH_OUTPUT_FORMAT=json env.
  const outputFormat = process.env.ENRICH_OUTPUT_FORMAT === 'json' ? 'json' : 'text';
  const args = [
    '-p',
    '--model', model,
    '--max-turns', '1',
    '--output-format', outputFormat,
    '--no-session-persistence',
    '--append-system-prompt-file', sysPromptFile,
  ];
  if (opts.bareMode) args.push('--bare');

  const userMessage = JSON.stringify({ events: batchInput });

  // Pick an isolated HOME from the pool to avoid global-config race.
  // pickIsolatedHome() returns null if the pool wasn't initialized
  // (concurrency 1, or seeding failed) — fall back to inherited HOME.
  const isoHome = pickIsolatedHome();

  return new Promise<ClaudeCallResult>((resolve, reject) => {
    const child = spawn(resolved.path, args, {
      cwd: tmpdir(),
      env: {
        ...process.env,
        NO_COLOR: '1',
        CLAUDE_CODE_SUPPRESS_UPDATE_CHECK: '1',
        DISABLE_AUTOUPDATER: '1',
        // HOME-isolation override. Both Unix HOME and Windows USERPROFILE
        // are set so claude finds the right .claude.json regardless of
        // platform check inside the binary.
        ...(isoHome ? { HOME: isoHome, USERPROFILE: isoHome } : {}),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: resolved.useShell,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    // Hard timeout — see fn-14.3 spec on claude-code#28482.
    // Use unref() so a leaked timer won't keep Node alive after the
    // child exits early.
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude CLI timeout after ${CLAUDE_TIMEOUT_MS}ms (SIGKILL sent)`));
    }, CLAUDE_TIMEOUT_MS);

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`claude spawn failed: ${err.message} (binary='${opts.claudeBin}')`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        // Claude CLI writes quota / auth / API errors to stdout, not stderr.
        // Include stdout so the operator can distinguish quota-exhaustion
        // ("Approaching usage limit", "5-hour reset"), auth issues ("Not
        // logged in"), and real model errors. Without this the run shows
        // empty `claude exited 1:` lines and you can't tell what's wrong.
        const errParts = [
          stderr.trim() && `stderr=${stderr.slice(0, 400)}`,
          stdout.trim() && `stdout=${stdout.slice(0, 400)}`,
        ].filter(Boolean).join(' | ');
        reject(new Error(`claude exited ${code}: ${errParts || '(both stdout/stderr empty)'}`));
        return;
      }
      if (!stdout.trim()) {
        reject(new Error(`claude empty stdout | exit=0 | stderr=${stderr.slice(0, 400) || '(empty)'}`));
        return;
      }

      // Output handling depends on chosen format.
      // - 'text': stdout is the raw model output (may have ```json fences).
      //   Estimate tokens from char count (Claude tokenizer ≈ 3-4 chars/token DE).
      // - 'json': parse envelope wrapper (has usage stats but suffers from CLI
      //   bug where long `result` strings are truncated mid-write — see fn-14.3).
      let envelope: unknown = null;
      let tokensIn = 0;
      let tokensOut = 0;
      let cacheReadIn = 0;
      let cacheCreateIn = 0;
      let costUsd = 0;
      let stopReason = 'end_turn';
      let isError = false;
      let apiErrStatus: string | null = null;
      let resultStr = '';

      if (outputFormat === 'text') {
        // Raw text mode — stdout IS the model output.
        resultStr = stdout;
        // Best-effort token estimation (German is ~3.5 chars/token).
        tokensOut = Math.ceil(stdout.length / 3.5);
        // We don't know input tokens without envelope — estimate from prompt.
        tokensIn = Math.ceil((systemPrompt.length + userMessage.length) / 3.5);
        envelope = { result: stdout, _format: 'text-estimated' };
      } else {
        // Envelope-mode (json). Some tools prepend text on Windows; find first `{`.
        try {
          const start = stdout.indexOf('{');
          if (start === -1) throw new Error('no JSON envelope');
          envelope = JSON.parse(stdout.slice(start));
        } catch (err) {
          reject(new Error(
            `claude envelope parse failed: ${err instanceof Error ? err.message : err} | ` +
            `stdout=${stdout.slice(0, 300)}`,
          ));
          return;
        }

        const e = envelope as Record<string, unknown>;
        const usage = (e.usage ?? {}) as Record<string, unknown>;
        tokensIn = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
        tokensOut = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;
        cacheReadIn = typeof usage.cache_read_input_tokens === 'number' ? usage.cache_read_input_tokens : 0;
        cacheCreateIn = typeof usage.cache_creation_input_tokens === 'number' ? usage.cache_creation_input_tokens : 0;
        costUsd = typeof e.total_cost_usd === 'number' ? e.total_cost_usd : 0;
        stopReason = typeof e.stop_reason === 'string' ? e.stop_reason : 'unknown';
        isError = e.is_error === true;
        apiErrStatus = typeof e.api_error_status === 'string' ? e.api_error_status : null;
        resultStr = typeof e.result === 'string' ? e.result : '';
      }

      if (isError) {
        // Error envelopes don't need a parsed result — the caller routes
        // them to the retry path based on isError + errorMessage.
        // Most common case: "Not logged in · Please run /login" when
        // --bare is set without ANTHROPIC_API_KEY. resultStr is plain
        // text in that case, so attempting extractJson() on it would
        // throw and (before this fix) crash the whole worker.
        resolve({
          parsed: null,
          tokensIn, tokensOut, cacheReadIn, cacheCreateIn, costUsd,
          stopReason, isError: true,
          errorMessage: resultStr.slice(0, 300) || apiErrStatus || 'unknown error',
          envelope,
        });
        return;
      }

      // Success path: inner-parse the model output. extractJson can
      // throw on malformed JSON; we MUST wrap it so the failure routes
      // to the promise's reject path (→ batch retry → 3-strikes counter)
      // instead of bubbling out as an uncaught exception that would
      // crash the entire enrichment run.
      let inner: unknown;
      try {
        inner = extractJson(resultStr);
      } catch (err) {
        // Dump full result to a debug file so we can inspect where claude
        // actually stops mid-stream. Helps diagnose CLI bugs vs prompt issues.
        try {
          const debugDir = join(process.cwd(), 'logs', 'parse-fails');
          mkdirSync(debugDir, { recursive: true });
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const dumpPath = join(debugDir, `${ts}.txt`);
          writeFileSync(dumpPath,
            `STOP=${stopReason}\nTOK_OUT=${tokensOut}\nRESULT_LEN=${resultStr.length}\n` +
            `ERR=${err instanceof Error ? err.message : err}\n\n` +
            `=== FULL RESULT ===\n${resultStr}\n\n=== STDERR ===\n${stderr}`);
        } catch { /* swallow — debug-only */ }
        const head = resultStr.slice(0, 200);
        const tail = resultStr.slice(-200);
        reject(new Error(
          `claude inner-result parse failed: ${err instanceof Error ? err.message : err} | ` +
          `stop=${stopReason} | tok_out=${tokensOut} | result_len=${resultStr.length} | ` +
          `head=${head.replace(/\n/g, '\\n')} | tail=${tail.replace(/\n/g, '\\n')}`,
        ));
        return;
      }

      resolve({
        parsed: inner,
        tokensIn, tokensOut, cacheReadIn, cacheCreateIn, costUsd,
        stopReason, isError: false,
        envelope,
      });
    });

    // Stdin contract: claude -p reads the user-prompt body from stdin
    // when -p is given without an inline string argument. Cap stdin at
    // 10MB per CLI docs — at batch=20 × ~5KB each + 8KB page = ~280KB
    // per call, well under the cap.
    child.stdin.write(userMessage);
    child.stdin.end();
  });
}

/**
 * Extract the first top-level JSON object/array from a string.
 * Reused from enrich-claude-cli.ts (helper-only reuse per fn-14.3 spec).
 */
/**
 * Pre-sanitize claude output to defang typographic quotes that break
 * JSON parsing when claude embeds them in description strings.
 *
 * Claude CLI 2.1.116 will (despite explicit prompt instructions) sometimes
 * write `„Die Mayrhofner"` or `"Die Band"` directly inside a string value,
 * which makes the surrounding JSON syntactically invalid. This pass strips
 * those typographic quotes before we attempt to parse — a regular ASCII
 * `"` inside a JSON string is the actual landmine, but we also remove
 * `„ " » «` because they're cosmetic and not worth a parse-fail.
 */
function sanitizeTypographicQuotes(raw: string): string {
  return raw
    // German low/high double-quotes
    .replace(/[„“”»«]/g, '')
    // Curly single quotes → straight apostrophe
    .replace(/[‘’‚‛]/g, "'");
}

/**
 * Last-resort repair: when JSON.parse fails, find each `"key":"value"` segment
 * and escape any unescaped `"` chars inside the value. We do this with a
 * forward scan that tracks string boundaries — any `"` after the value-start
 * but before what looks like the value-end (followed by `,` `}` `\n` and a
 * key-start `"` or `}`) is escaped.
 *
 * Heuristic, not a full JSON parser, but catches the common claude failure
 * mode of bare quotes in description text.
 */
function escapeBareQuotesInStringValues(raw: string): string {
  // Replace any `"` that's NOT preceded by `\`, NOT followed by `,`, `}`, `]`,
  // `:`, `\n`, or end-of-string. That heuristic catches bare quotes inside
  // string values where the next char is alphabetic or whitespace.
  // We work on a char-by-char state machine instead of regex for correctness.
  const out: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (escape) { out.push(c); escape = false; continue; }
    if (c === '\\') { out.push(c); escape = true; continue; }
    if (c === '"') {
      if (!inString) { out.push(c); inString = true; continue; }
      // We're inside a string and hit a `"`. Is it a real string-end?
      // Look at the next non-whitespace char — if it's `,` `}` `]` `:` it's
      // an end. Otherwise, it's a bare quote that must be escaped.
      let j = i + 1;
      while (j < raw.length && (raw[j] === ' ' || raw[j] === '\n' || raw[j] === '\r' || raw[j] === '\t')) j++;
      const next = j < raw.length ? raw[j] : '';
      if (next === ',' || next === '}' || next === ']' || next === ':' || next === '') {
        out.push(c);
        inString = false;
      } else {
        // Bare quote inside string — escape it
        out.push('\\', '"');
      }
      continue;
    }
    out.push(c);
  }
  return out.join('');
}

/**
 * Extract the first top-level JSON object/array from a string.
 *
 * 4-tier defense against claude CLI quirks:
 *   1. Sanitize typographic quotes (pre-pass)
 *   2. Fast-path JSON.parse if shape looks bare object/array
 *   3. Strip ```json``` fences + brace-count scan
 *   4. jsonrepair lib (handles trailing commas, unquoted keys, single quotes)
 *   5. Custom bare-quote escape heuristic for our specific claude bug
 *
 * Reused from enrich-claude-cli.ts (helper-only reuse per fn-14.3 spec),
 * extended for claude-cli 2.1.116 compat (typographic quotes + jsonrepair).
 */
function extractJson(raw: string): unknown {
  // Tier 1: pre-sanitize
  const sanitized = sanitizeTypographicQuotes(raw);
  const trimmed = sanitized.trim();
  if (!trimmed) throw new Error('empty');

  // Tier 2: fast path for bare object/array
  const first = trimmed[0];
  if ((first === '{' || first === '[') &&
      (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }

  // Tier 3: strip fences + brace-count scan
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fence ? fence[1] : trimmed;
  let start = -1, openCh = '{', closeCh = '}';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '{' || c === '[') {
      start = i;
      openCh = c;
      closeCh = c === '{' ? '}' : ']';
      break;
    }
  }
  if (start === -1) throw new Error(`no JSON found in: ${body.slice(0, 120)}`);

  // Walk the body looking for the matching close-bracket. If we find it,
  // try JSON.parse; if that fails (bare quotes inside value), escalate.
  let candidate: string | null = null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') inString = !inString;
    if (inString) continue;
    if (c === openCh) depth += 1;
    else if (c === closeCh) {
      depth -= 1;
      if (depth === 0) {
        candidate = body.slice(start, i + 1);
        break;
      }
    }
  }
  // The brace-counter walks through bare quotes inside string values
  // (they flip `inString` incorrectly), so candidate may be partial.
  // Try parsing it; on failure, fall through to repair tiers.
  if (candidate) {
    try { return JSON.parse(candidate); } catch { /* try repair tiers */ }
  } else {
    candidate = body.slice(start);
  }

  // Tier 4: jsonrepair library
  try {
    const repaired = jsonrepair(candidate);
    return JSON.parse(repaired);
  } catch { /* try tier 5 */ }

  // Tier 5: bare-quote escape heuristic + jsonrepair again
  try {
    const escaped = escapeBareQuotesInStringValues(candidate);
    return JSON.parse(escaped);
  } catch { /* fall through */ }

  // Tier 5b: combine — escape + jsonrepair
  try {
    const escaped = escapeBareQuotesInStringValues(candidate);
    const repaired = jsonrepair(escaped);
    return JSON.parse(repaired);
  } catch { /* give up */ }

  throw new Error('unterminated JSON (after sanitize + jsonrepair + bare-quote escape)');
}

// ─────────────────────────────────────────────────────────────────────
// Stats + telemetry + alerting
// ─────────────────────────────────────────────────────────────────────

interface Stats {
  processed: number;
  enriched: number;
  failed: number;
  poisonPilled: number;
  fetchOk: number;
  fetchFailed: number;
  fetchSkipped: number;
  descFilled: number;
  descPolished: number;
  priceTextFilled: number;
  priceMinFilled: number;
  studentTrue: number;
  familyTrue: number;
  dogTrue: number;
  wheelchairTrue: number;
  outdoorTrue: number;
  tokensIn: number;
  tokensOut: number;
  cacheReadIn: number;
  cacheCreateIn: number;
  costUsd: number;
  rateLimited: number;
  validationErrors: number;
  descPolicySkipped: number;
  startedAt: number;
}

function newStats(): Stats {
  return {
    processed: 0, enriched: 0, failed: 0, poisonPilled: 0,
    fetchOk: 0, fetchFailed: 0, fetchSkipped: 0,
    descFilled: 0, descPolished: 0, priceTextFilled: 0, priceMinFilled: 0,
    studentTrue: 0, familyTrue: 0, dogTrue: 0, wheelchairTrue: 0, outdoorTrue: 0,
    tokensIn: 0, tokensOut: 0, cacheReadIn: 0, cacheCreateIn: 0, costUsd: 0,
    rateLimited: 0, validationErrors: 0, descPolicySkipped: 0,
    startedAt: Date.now(),
  };
}

/**
 * Total tokens charged against the weekly cap.
 *
 * This taxonomy-heavy prompt creates large `cache_creation_input_tokens`
 * spikes on the FIRST call and `cache_read_input_tokens` on subsequent
 * calls. Anthropic counts both against the underlying TPM/RPM budget,
 * even though they're at different price tiers. So the quota guard MUST
 * include all four counters; using only `input + output` understates by
 * an order of magnitude on first-call cache-creation. (Codex review #4.)
 */
export function totalQuotaTokens(s: Pick<Stats, 'tokensIn' | 'tokensOut' | 'cacheReadIn' | 'cacheCreateIn'>): number {
  return s.tokensIn + s.tokensOut + s.cacheReadIn + s.cacheCreateIn;
}

function reportLine(s: Stats, total: number | undefined, opts: CliOpts): string {
  const elapsed = (Date.now() - s.startedAt) / 1000;
  const rate = s.processed / Math.max(elapsed, 0.001);
  const etaStr = total && rate > 0
    ? `eta=${(((total - s.processed) / rate) / 60).toFixed(0)}min`
    : '';
  const totalToks = totalQuotaTokens(s);
  const tokenPct = (totalToks / opts.weeklyTokenCap * 100).toFixed(1);
  return `p=${s.processed}${total ? '/' + total : ''} ✓=${s.enriched} ✗=${s.failed}` +
    ` poison=${s.poisonPilled} fetch(ok=${s.fetchOk} fail=${s.fetchFailed})` +
    ` filled(d=${s.descFilled}+${s.descPolished} p=${s.priceTextFilled}/${s.priceMinFilled})` +
    ` flags(stu=${s.studentTrue} fam=${s.familyTrue} dog=${s.dogTrue} wc=${s.wheelchairTrue} out=${s.outdoorTrue})` +
    ` tok=${totalToks.toLocaleString()}(${tokenPct}%) [in=${s.tokensIn.toLocaleString()}/out=${s.tokensOut.toLocaleString()}/cache-cr=${s.cacheCreateIn.toLocaleString()}/cache-rd=${s.cacheReadIn.toLocaleString()}]` +
    ` $=${s.costUsd.toFixed(2)} rate=${rate.toFixed(1)}/s ${etaStr}`;
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

let alert80Sent = false;
async function maybeSendQuotaAlert(stats: Stats, opts: CliOpts): Promise<void> {
  if (!opts.alertEmail || alert80Sent) return;
  const used = totalQuotaTokens(stats);
  if (used / opts.weeklyTokenCap >= 0.80) {
    alert80Sent = true;
    try {
      // Lazy-import so this script doesn't drag in the email lib unless needed.
      const { sendGenericEmail } = await import('../lib/email');
      const subject = `[enrich:claude] 80% weekly token cap reached`;
      const html = `
        <h2>Token Quota Alert</h2>
        <p>Bulk enrichment has reached <b>${(used / opts.weeklyTokenCap * 100).toFixed(1)}%</b>
        of the configured weekly token cap (<b>${opts.weeklyTokenCap.toLocaleString()}</b>).</p>
        <ul>
          <li>Tokens in:           ${stats.tokensIn.toLocaleString()}</li>
          <li>Tokens out:          ${stats.tokensOut.toLocaleString()}</li>
          <li>Cache-creation in:   ${stats.cacheCreateIn.toLocaleString()}</li>
          <li>Cache-read in:       ${stats.cacheReadIn.toLocaleString()}</li>
          <li>Total counted:       ${used.toLocaleString()}</li>
          <li>Cost:                $${stats.costUsd.toFixed(2)}</li>
          <li>Processed:           ${stats.processed} events</li>
        </ul>
        <p>The script will halt cleanly at 95% so you can resume tomorrow without
        burning the cap. Re-run the same command to pick up where this run left off.</p>
      `;
      await sendGenericEmail(opts.alertEmail, subject, html);
      console.log(`\n[alert] 80% quota mail sent to ${opts.alertEmail}`);
    } catch (err) {
      console.error(`\n[alert] failed to send: ${err instanceof Error ? err.message : err}`);
    }
  }
}

function shouldHalt(stats: Stats, opts: CliOpts): boolean {
  // CLI-mode signal: weekly Max-Subscription token cap (defensive estimate).
  if (totalQuotaTokens(stats) / opts.weeklyTokenCap >= 0.95) return true;
  // API-mode signal: USD cost cap. 0 = disabled. Set DEFAULT_COST_CAP_USD
  // conservatively below the typical credit balance so we halt with buffer.
  if (opts.useApi && opts.costCapUsd > 0 && stats.costUsd >= opts.costCapUsd) return true;
  return false;
}

/** Distinguish WHY we halted for the operator-facing message. */
function haltReason(stats: Stats, opts: CliOpts): string {
  if (opts.useApi && opts.costCapUsd > 0 && stats.costUsd >= opts.costCapUsd) {
    return `cost cap $${opts.costCapUsd.toFixed(2)} reached ($${stats.costUsd.toFixed(2)} spent)`;
  }
  return `95% weekly token cap (${totalQuotaTokens(stats).toLocaleString()}/${opts.weeklyTokenCap.toLocaleString()} tok)`;
}

// ─────────────────────────────────────────────────────────────────────
// Per-batch processing — fetch, classify, validate, queue updates
// ─────────────────────────────────────────────────────────────────────

interface BatchOutcome {
  /** Per-event success indices (relative to the input batch). */
  ok: number[];
  /** Per-event validation/AI failures with raw error messages. */
  fail: Array<{ index: number; error: string }>;
}

export class SchemaMismatchError extends Error {
  constructor(message: string) { super(message); this.name = 'SchemaMismatchError'; }
}

/**
 * Auth failure (401/403, "not logged in", invalid API key, etc.).
 *
 * Auth is a process-wide problem, not a per-event problem — every
 * subsequent call will fail the same way until the operator fixes
 * credentials. Treating each event as a 1-of-3 strike on
 * enrichment_failure_count would poison-pill thousands of innocent
 * rows on a single misconfigured run.
 *
 * Caller behavior: throw out of `processBatch()`, abort `main()` with
 * a non-zero exit code, do NOT write anything to the events table.
 */
export class AuthError extends Error {
  constructor(message: string) { super(message); this.name = 'AuthError'; }
}

/**
 * Scrub Postgres-unsafe \u0000 sequences from a string. Matches the
 * scrub helper in enrich-openai.ts so the two pipelines produce
 * identical-shaped writes.
 */
function scrubNulls(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/\u0000/g, '').replace(/\\u0000/g, '');
}
function scrubArray(arr: string[]): string[] {
  return arr.map(s => s.replace(/\u0000/g, '').replace(/\\u0000/g, ''));
}

export interface DescOverride {
  policy: 'fill' | 'polish' | 'leave';
  reason: string;
}

/**
 * fn-14.3 Interview override-logic, encoded:
 *   - len < 40         → 'fill' (write whatever the AI gave us, even short)
 *   - 40 ≤ len < 400   → 'polish' (AI rewrites at 400-1000)
 *   - len ≥ 400 AND no HTML → 'leave' (skip; AI returns null in this case)
 *   - len ≥ 400 BUT has HTML → 'polish' (re-write to strip HTML)
 *
 * Exported for unit-test coverage. Used internally by `buildUpdatePayload`.
 */
export function descOverridePolicy(existing: string | null): DescOverride {
  const t = (existing ?? '').trim();
  if (t.length < 40) return { policy: 'fill', reason: 'empty/very short' };
  const hasHtml = /<[a-z][^>]*>/i.test(t);
  if (t.length < 400) return { policy: 'polish', reason: 'short non-empty' };
  if (hasHtml) return { policy: 'polish', reason: 'has HTML' };
  return { policy: 'leave', reason: 'long & clean' };
}

async function fetchPagesForBatch(
  events: EventRow[],
  opts: CliOpts,
  stats: Stats,
): Promise<Array<string | null>> {
  if (opts.noFetch) {
    stats.fetchSkipped += events.length;
    return events.map(() => null);
  }
  // Fetch in parallel inside the batch — fetchEventPage is rate-limited
  // per-host internally so we don't have to throttle here.
  const results = await Promise.all(events.map(async (ev) => {
    if (!ev.source_url) {
      stats.fetchSkipped += 1;
      return null;
    }
    try {
      const page = await fetchEventPage(ev.source_url);
      if (page.ok && page.text) {
        stats.fetchOk += 1;
        return page.text;
      }
      stats.fetchFailed += 1;
      return null;
    } catch {
      stats.fetchFailed += 1;
      return null;
    }
  }));
  return results;
}

/**
 * Build the DB update payload for one event. Mirrors enrich-openai.ts
 * write logic so both pipelines produce structurally identical updates.
 *
 * `category_locked` semantics (fn-14.3): only `category` is protected.
 * Other fields (description, tags, audience, vibe, occasion_tags,
 * setting, language, price_*, flags) are ALWAYS updated — locking the
 * category should not freeze 6-month-old metadata across all axes.
 */
function buildUpdatePayload(
  row: EventRow,
  validated: ClaudeEnrichmentResult,
  stats: Stats,
): Record<string, unknown> {
  // Array-field rule (fn-14.4 hard-learned 2026-05-07):
  //   - If the AI returned a non-empty array → send it (overwrites existing).
  //   - If empty → OMIT the key entirely. The RPC's `payload ? 'k'` guard
  //     keeps the column's existing value untouched.
  // Why we can't send `[]` or `null`:
  //   - `null` → Postgres `jsonb_array_elements_text(null)` raises
  //     "cannot extract elements from a scalar" → whole batch flush fails.
  //   - `[]` → `jsonb_array_elements_text([])` returns 0 rows →
  //     `array_agg(value)` returns NULL → NOT NULL constraint violation
  //     on price_flags / occasion_tags / etc.
  // Both modes cascade-fail an entire 50-event batch, so we MUST skip.
  const update: Record<string, unknown> = {
    is_student_friendly: validated.is_student_friendly,
    is_family_friendly: validated.is_family_friendly,
    is_dog_friendly: validated.is_dog_friendly,
    is_wheelchair_accessible: validated.is_wheelchair_accessible,
    is_outdoor: validated.is_outdoor,
    enrichment_version: ENRICHMENT_VERSION_CLAUDE_V1,
    // enrichment_at is bumped via column default in the RPC layer? — no,
    // the RPC currently doesn't set it. We set it explicitly here so the
    // client clock drives the timestamp (matches enrich-openai.ts).
    enrichment_at: new Date().toISOString(),
    // Successful validation → reset the failure counter so a row that
    // recovered from a previous AI hiccup doesn't drift toward the
    // poison-pill threshold.
    enrichment_failure_count: 0,
    enrichment_failed: false,
  };

  // Sparse array-field merge: only include the key if non-empty.
  if (validated.audience.length > 0) update.audience = scrubArray(validated.audience);
  if (validated.vibe.length > 0) update.vibe = scrubArray(validated.vibe);
  if (validated.occasion.length > 0) update.occasion_tags = scrubArray(validated.occasion);
  if (validated.setting.length > 0) update.setting = scrubArray(validated.setting);
  if (validated.price_flags.length > 0) update.price_flags = scrubArray(validated.price_flags);

  // Sparse enum-field merge (fn-14.4 paranoid pass): claude may return null
  // for required enums when the value didn't pass vocab check (now soft-
  // dropped). Sending `null` would clobber the existing column value via
  // the RPC's `payload ? 'k'` check (key exists with null → SET to null).
  // Only include the key when we have a real value.
  if (validated.language) update.language = validated.language;
  if (validated.price_tier) update.price_tier = validated.price_tier;
  if (validated.duration_type) update.duration_type = validated.duration_type;

  // Category-lock semantics: only protect `category`. Other axes
  // (audience, vibe, …) are ALWAYS updated. fn-14.3 Interview decision.
  const notLocked = !row.category_locked;
  if (validated.primary_category && notLocked) {
    update.category = validated.primary_category;
    update.category_source = 'enrichment';
  }

  // Tags merge: union with existing source-side tags, capped at 8.
  // This matches the existing pattern in enrich-openai.ts.
  if (validated.tags.length > 0) {
    const existing = Array.isArray(row.tags) ? row.tags : [];
    update.tags = scrubArray(
      Array.from(new Set([...existing, ...validated.tags])).slice(0, 8),
    );
  }

  // Description override per fn-14.3 logic.
  const policy = descOverridePolicy(row.description);
  if (validated.suggested_description) {
    if (policy.policy === 'fill') {
      update.description = scrubNulls(validated.suggested_description);
      stats.descFilled += 1;
    } else if (policy.policy === 'polish') {
      update.description = scrubNulls(validated.suggested_description);
      stats.descPolished += 1;
    }
    // 'leave' → don't touch description even if AI gave one back.
  }

  // Price text fill: only if old empty.
  if (validated.suggested_price_text) {
    const priceEmpty = !row.price_text || row.price_text.trim().length === 0;
    if (priceEmpty) {
      update.price_text = scrubNulls(validated.suggested_price_text);
      stats.priceTextFilled += 1;
    }
  }

  // Price min fill: only if old NULL AND new non-null. Manual user
  // values must never be clobbered by AI extraction.
  if (validated.suggested_price_min != null && row.price_min == null) {
    update.price_min = validated.suggested_price_min;
    stats.priceMinFilled += 1;
  }

  if (validated.is_student_friendly) stats.studentTrue += 1;
  if (validated.is_family_friendly) stats.familyTrue += 1;
  if (validated.is_dog_friendly) stats.dogTrue += 1;
  if (validated.is_wheelchair_accessible) stats.wheelchairTrue += 1;
  if (validated.is_outdoor) stats.outdoorTrue += 1;

  return update;
}

/**
 * Mutable abort signal for the worker pool. When `aborted` flips to
 * true (because some sibling batch threw AuthError/SchemaMismatchError),
 * every other in-flight processBatch checks it before queuing DB
 * writes and bails out cleanly without persisting anything.
 *
 * This is needed because Promise.allSettled lets all siblings finish
 * naturally — without an abort signal, a slow sibling could continue
 * running for several seconds after the fatal error and queue dozens
 * of partial writes via updater.add().
 */
interface AbortSignal {
  aborted: boolean;
}

async function processBatch(
  events: EventRow[],
  opts: CliOpts,
  stats: Stats,
  systemPrompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updater: any,
  abort: AbortSignal,
): Promise<BatchOutcome> {
  const outcome: BatchOutcome = { ok: [], fail: [] };

  // Early bail: if a sibling batch has already raised the abort flag,
  // skip everything (no fetch, no AI call, no DB writes). The caller
  // sees an empty outcome and counts the events under "skipped".
  if (abort.aborted) {
    return outcome;
  }

  // 1. Fetch source pages (parallel within batch).
  const pages = await fetchPagesForBatch(events, opts, stats);

  // Re-check abort after fetch — a sibling may have raised AuthError
  // while we were waiting for HTTP. Better to skip the AI call (saves
  // tokens AND avoids triggering our own AuthError on the same auth
  // problem) than to continue.
  if (abort.aborted) {
    return outcome;
  }

  // 2. Build batch input + call claude.
  const batchInput = buildBatchInput(events, pages);

  // 3. Call claude with retry loop. 5 attempts:
  //    - rate-limit: 15s → 30s → 60s → 120s → 240s
  //    - hang/network/empty:  3s → 6s → 12s → 24s → 48s
  //    - auth: throw AuthError → propagates out of processBatch and
  //            aborts the whole run. Auth is process-wide; punishing
  //            individual events with failure_count++ would poison
  //            the dataset on a single misconfigured run.
  const AUTH_RE = /\b(401|403|unauthorized|not logged in|please run \/login|invalid api key)\b/i;
  const MAX_ATTEMPTS = 5;
  let parsed: unknown = null;
  let callRes: ClaudeCallResult | null = null;
  let lastErr: string | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      callRes = await callClaudeBatch(systemPrompt, batchInput, opts);
      // Even on is_error:true, accumulate token usage so quota is
      // tracked accurately. Re-prompt if errored.
      stats.tokensIn += callRes.tokensIn;
      stats.tokensOut += callRes.tokensOut;
      stats.cacheReadIn += callRes.cacheReadIn;
      stats.cacheCreateIn += callRes.cacheCreateIn;
      stats.costUsd += callRes.costUsd;

      if (callRes.isError) {
        const msg = callRes.errorMessage ?? 'is_error true';
        lastErr = msg;
        if (AUTH_RE.test(msg)) {
          // Bail the whole RUN, not just the batch. AuthError is
          // caught at the worker-pool level in main() which then
          // exits non-zero without any DB writes.
          throw new AuthError(msg);
        }
        const isRate = /429|rate.limit|rate_limit|too.many.request|usage.limit|quota/i.test(msg);
        if (isRate) stats.rateLimited += 1;
        if (attempt === MAX_ATTEMPTS - 1) break;
        // Honor server-provided retry-after when the SDK exposed it via
        // RateLimitError.headers — only available in the API path. Falls
        // through to exponential default when missing.
        const apiRetryAfter = (() => {
          const env = callRes.envelope as { retryAfterSec?: number } | null | undefined;
          return env?.retryAfterSec && env.retryAfterSec > 0 ? env.retryAfterSec * 1000 : 0;
        })();
        const backoff = apiRetryAfter > 0
          ? apiRetryAfter
          : isRate ? 15_000 * Math.pow(2, attempt) : 3_000 * Math.pow(2, attempt);
        const tag = apiRetryAfter > 0 ? 'retry-after' : 'backoff';
        console.error(`\n[batch] is_error attempt ${attempt + 1}/${MAX_ATTEMPTS}: ${tag} ${(backoff / 1000).toFixed(0)}s | ${msg.slice(0, 120)}`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      parsed = callRes.parsed;
      break;
    } catch (err) {
      // AuthError MUST propagate — never absorbed into the per-batch
      // failure_count path. main() catches and exits the run.
      if (err instanceof AuthError) throw err;

      lastErr = err instanceof Error ? err.message : String(err);
      // Defense in depth: if some other code path throws an Error whose
      // message looks like an auth failure (e.g. claude binary stderr),
      // promote it to AuthError before deciding whether to retry.
      if (AUTH_RE.test(lastErr)) {
        throw new AuthError(lastErr);
      }
      if (attempt === MAX_ATTEMPTS - 1) break;

      const isRate = /429|rate.limit|rate_limit|too.many.request|usage.limit|quota/i.test(lastErr);
      const isHang = /timeout|SIGKILL|empty stdout/i.test(lastErr);
      if (isRate) stats.rateLimited += 1;
      const backoff = isRate ? 15_000 * Math.pow(2, attempt)
                    : isHang ? 5_000 * Math.pow(2, attempt)
                    : 2_000 * Math.pow(2, attempt);
      console.error(`\n[batch] attempt ${attempt + 1}/${MAX_ATTEMPTS}: backoff ${(backoff / 1000).toFixed(0)}s | ${lastErr.slice(0, 120)}`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }

  if (!parsed) {
    // Whole-batch hang/error: every event in this batch gets +1 to
    // failure_count. After 3 strikes, poison-pill kicks in.
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const newCount = (ev.enrichment_failure_count ?? 0) + 1;
      const failedNow = newCount >= 3;
      if (!opts.dryRun && !abort.aborted) {
        await updater.add({
          id: ev.id,
          enrichment_failure_count: newCount,
          ...(failedNow ? { enrichment_failed: true } : {}),
        });
      }
      if (failedNow) stats.poisonPilled += 1;
      stats.failed += 1;
      stats.processed += 1;
      outcome.fail.push({ index: i, error: lastErr ?? 'no parsed result' });
      appendLog(opts.logFile, {
        event_id: ev.id, title: ev.title,
        status: failedNow ? 'poison_pill' : 'batch_failed',
        error: lastErr, failure_count: newCount,
      });
    }
    return outcome;
  }

  // 4. Validate batch — top-level + cross-item index uniqueness/completeness.
  // Pass `events.length` as the expected size so the validator enforces
  // that every input index in [0, N) is echoed back exactly once. Without
  // this check, a Claude reorder/drop/duplicate would silently apply
  // result[K] to event[K] (i.e. the wrong row).
  const batchVal = validateClaudeBatch(parsed, events.length);
  if (!batchVal.ok) {
    // Whole batch structurally bad — could be wrong size, missing index,
    // duplicate index, or out-of-range. Same as a hang outcome.
    console.error(`\n[batch] top-level invalid: ${batchVal.fatalError}`);
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const newCount = (ev.enrichment_failure_count ?? 0) + 1;
      const failedNow = newCount >= 3;
      if (!opts.dryRun && !abort.aborted) {
        await updater.add({
          id: ev.id,
          enrichment_failure_count: newCount,
          ...(failedNow ? { enrichment_failed: true } : {}),
        });
      }
      if (failedNow) stats.poisonPilled += 1;
      stats.failed += 1;
      stats.processed += 1;
      outcome.fail.push({ index: i, error: batchVal.fatalError ?? 'invalid' });
      appendLog(opts.logFile, {
        event_id: ev.id, title: ev.title,
        status: 'batch_invalid',
        error: batchVal.fatalError, failure_count: newCount,
      });
    }
    return outcome;
  }

  // 5. Per-event commit. Look up by ECHOED index, never by array position
  // — Codex review finding: AI can reorder/drop/duplicate without notice.
  const itemByIndex = new Map<number, typeof batchVal.items[number]>();
  for (const it of batchVal.items) itemByIndex.set(it.index, it);

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const item = itemByIndex.get(i);
    if (!item) {
      // Should be unreachable when expectedSize is passed (validator
      // checks completeness above), but defend in depth.
      const newCount = (ev.enrichment_failure_count ?? 0) + 1;
      const failedNow = newCount >= 3;
      if (!opts.dryRun && !abort.aborted) {
        await updater.add({
          id: ev.id,
          enrichment_failure_count: newCount,
          ...(failedNow ? { enrichment_failed: true } : {}),
        });
      }
      if (failedNow) stats.poisonPilled += 1;
      stats.failed += 1;
      stats.processed += 1;
      outcome.fail.push({ index: i, error: 'missing item in batch response' });
      continue;
    }

    // Per-item validation failure is ALWAYS treated as a row-level
    // failure now (Codex review finding). The previous "commit partial
    // if not mostly-empty" path masked bad data: one missing required
    // field would null out existing data, set enrichment_version to
    // 'claude-v1', and zero the failure_count — preventing the row
    // from ever reaching the 3-strikes poison-pill threshold.
    //
    // New rule: any validation error → bump enrichment_failure_count
    // and DO NOT write the AI payload. Existing data is preserved
    // verbatim, and the row remains eligible for the next pass.
    if (!item.result.ok) {
      stats.validationErrors += 1;
      const newCount = (ev.enrichment_failure_count ?? 0) + 1;
      const failedNow = newCount >= 3;
      if (!opts.dryRun && !abort.aborted) {
        await updater.add({
          id: ev.id,
          enrichment_failure_count: newCount,
          ...(failedNow ? { enrichment_failed: true } : {}),
        });
      }
      if (failedNow) stats.poisonPilled += 1;
      stats.failed += 1;
      stats.processed += 1;
      outcome.fail.push({
        index: i,
        error: `validation: ${item.result.errors.slice(0, 3).join('; ')}`,
      });
      appendLog(opts.logFile, {
        event_id: ev.id, title: ev.title, status: 'validation_failed',
        errors: item.result.errors, failure_count: newCount,
      });
      continue;
    }

    // Item validates pristinely against the closed vocabulary, but we
    // also need a ROW-AWARE check: if the existing description is empty
    // / too short / HTML-tainted, the AI MUST have returned a usable
    // suggested_description. A null suggested_description on a row whose
    // policy is "fill" or "polish" is silently insufficient — without
    // this check, marking the row enriched would lock in the bad
    // description and remove it from the retry queue forever.
    // (Codex review iteration #4 finding.)
    const validated = item.result.value;
    const policy = descOverridePolicy(ev.description);
    // Description-policy check: if existing description is empty/short
    // but AI returned null suggested_description, we'd commit the row
    // with old (bad) description and the version filter would lock it
    // out of future runs. Trade-off:
    //   (a) commit-anyway → row enriched, description stays bad (acceptable
    //       outcome — at least all other fields are good)
    //   (b) skip-and-retry → row stays at enrichment_version=NULL, retried
    //       next run; but bumps failure_count (after 3 → poison-pill)
    // fn-14.4 hard-learned 2026-05-10 (paranoid pass): we go with (a) and
    // log it as a soft warning. Otherwise haiku's "too short (<400)" mode
    // ate ~5% of events as false poison-pills. Better to ship enriched
    // metadata for them and accept that a small fraction will have a
    // weak description.
    if ((policy.policy === 'fill' || policy.policy === 'polish') &&
        validated.suggested_description == null) {
      stats.descPolicySkipped += 1;
      appendLog(opts.logFile, {
        event_id: ev.id, title: ev.title, status: 'desc_policy_warning',
        policy: policy.policy, reason: policy.reason,
        action: 'commit_without_description_overwrite',
      });
      // Fall through — commit the row with all other enriched fields.
    }

    const update = buildUpdatePayload(ev, validated, stats);

    if (!opts.dryRun && !abort.aborted) {
      try {
        await updater.add({ id: ev.id, ...update });
      } catch (err) {
        // Supabase errors are plain objects with `message` / `details` /
        // `code` / `hint` — String(err) yields useless "[object Object]".
        // Extract structured fields explicitly.
        let msg: string;
        if (err instanceof Error) {
          msg = err.message;
        } else if (err && typeof err === 'object') {
          const e = err as Record<string, unknown>;
          const parts = [
            e.message && `msg=${e.message}`,
            e.code && `code=${e.code}`,
            e.details && `details=${e.details}`,
            e.hint && `hint=${e.hint}`,
          ].filter(Boolean);
          msg = parts.length > 0 ? parts.join(' | ') : JSON.stringify(err);
        } else {
          msg = String(err);
        }
        if (
          /Could not find.+column/i.test(msg) ||
          /schema cache/i.test(msg) ||
          /does not exist/i.test(msg) ||
          /violates check constraint/i.test(msg) ||
          /violates not-null/i.test(msg)
        ) {
          throw new SchemaMismatchError(msg);
        }
        console.error(`\n[${ev.id.slice(0, 8)}] queued update failed: ${msg}`);
        stats.failed += 1;
        stats.processed += 1;
        outcome.fail.push({ index: i, error: `db: ${msg}` });
        continue;
      }
    }
    stats.enriched += 1;
    stats.processed += 1;
    outcome.ok.push(i);

    if (opts.verbose) {
      const titleCut = ev.title.length > 65 ? ev.title.slice(0, 65) + '…' : ev.title;
      const lines: string[] = [];
      lines.push('');
      lines.push(`━━ [${ev.id.slice(0, 8)}] ${titleCut}`);
      lines.push(`   primary:        ${validated.primary_category ?? '-'}`);
      lines.push(`   tags:           ${validated.tags.join(', ') || '(none)'}`);
      lines.push(`   audience:       ${validated.audience.join(', ') || '(none)'}`);
      lines.push(`   vibe:           ${validated.vibe.join(', ') || '(none)'}`);
      lines.push(`   occasion:       ${validated.occasion.join(', ') || '(none)'}`);
      lines.push(`   setting:        ${validated.setting.join(', ') || '(none)'}`);
      lines.push(`   price:          tier=${validated.price_tier ?? '-'} min=${validated.suggested_price_min ?? '-'} flags=${validated.price_flags.join(',')}`);
      lines.push(`   flags:          stu=${validated.is_student_friendly} fam=${validated.is_family_friendly} dog=${validated.is_dog_friendly} wc=${validated.is_wheelchair_accessible} out=${validated.is_outdoor}`);
      if (validated.suggested_description) {
        const s = validated.suggested_description.length > 120
          ? validated.suggested_description.slice(0, 120) + '…'
          : validated.suggested_description;
        lines.push(`   → desc:         ${s}  (${validated.suggested_description.length} chars)`);
      }
      if (validated.suggested_price_text) lines.push(`   → price text:   ${validated.suggested_price_text}`);
      process.stdout.write(lines.join('\n') + '\n');
    }
  }

  return outcome;
}

// ─────────────────────────────────────────────────────────────────────
// Selection contract
// ─────────────────────────────────────────────────────────────────────

const SELECT_COLUMNS = [
  'id', 'title', 'description', 'category', 'category_locked',
  'tags', 'source_tags_raw', 'location_name', 'organizer',
  'start_date', 'end_date',
  'price_text', 'price_min', 'price_max',
  'source_url', 'enrichment_failure_count',
].join(', ');

const SELECTION_PUBLISH_STATUSES = [
  'published', 'published_low_confidence', 'needs_review',
];

async function fetchNextPage(
  supabase: SupabaseClient,
  opts: CliOpts,
  cursorId: string | null,
  pageSize: number,
): Promise<EventRow[]> {
  let q = supabase
    .from('events')
    .select(SELECT_COLUMNS)
    .in('publish_status', SELECTION_PUBLISH_STATUSES)
    .order('id', { ascending: true })
    .limit(pageSize);

  if (!opts.force) {
    q = q.or(
      `enrichment_version.is.null,enrichment_version.neq.${ENRICHMENT_VERSION_CLAUDE_V1}`,
    );
    // Skip poison-pills unless --retry-failed is set (which clears the
    // flag in main() before this runs anyway). --force ALSO bypasses
    // this filter — operator says "redo everything", we redo everything.
    q = q.or('enrichment_failed.is.null,enrichment_failed.eq.false');
  }

  if (opts.since) {
    const ms = parseSince(opts.since);
    if (ms != null) {
      const cutoff = new Date(Date.now() - ms).toISOString();
      q = q.gte('updated_at', cutoff);
    }
  }
  if (opts.futureOnly) {
    q = q.gte('start_date', new Date().toISOString());
  }
  if (cursorId) q = q.gt('id', cursorId);

  const { data, error } = await q;
  if (error) {
    console.error(`\n[query] ${error.message}`);
    return [];
  }
  return (data ?? []) as unknown as EventRow[];
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  // Best-effort version check + binary resolution. Logs which path will
  // be used by the worker pool.
  try {
    cachedResolvedClaude = resolveClaudeBinary(opts.claudeBin);
    const resolved = cachedResolvedClaude;
    const version = await new Promise<string>((resolve, reject) => {
      const c = spawn(resolved.path, ['--version'], {
        shell: resolved.useShell,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let out = '';
      c.stdout.on('data', (d: Buffer) => { out += d.toString('utf8'); });
      c.on('close', (code) => code === 0 ? resolve(out.trim()) : reject(new Error(`exited ${code}`)));
      c.on('error', reject);
    });
    console.log(`  claude CLI:      ${version}`);
    console.log(`  claude bin:      ${resolved.path}${resolved.useShell ? '  (via shell)' : '  (direct, no window)'}`);
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
  // fn-14.4: aggressive flush (50 statt default 500) damit bei Strg+C
  // max ~49 in-flight events verloren gehen, nicht ~499. Trade-off: mehr
  // RPC-roundtrips, aber bei concurrency 8 immer noch nur ein flush
  // pro ~16-17 batches. Resume-safe via enrichment_version filter.
  const enrichmentUpdater = makeBulkUpdater(supabase, 'bulk_update_event_enrichment', {
    flushSize: 50,
  });
  // Register for SIGINT flush so Strg+C persists in-flight rows.
  activeBulkUpdater = enrichmentUpdater;

  // Set up isolated HOME pool for concurrent claude subprocesses.
  // At concurrency >=4 the global ~/.claude.json races and claude exits 1
  // with "Configuration file corrupted". Per-slot isolated HOME avoids it.
  // Skipped in API mode — the SDK doesn't touch ~/.claude.json so the race
  // surface doesn't exist; setup would just waste tmp directories.
  if (!opts.useApi) {
    setupIsolatedHomePool(opts.concurrency);
  } else {
    // Validate the API key once at startup so we fail loudly on missing/
    // malformed keys instead of poison-pilling the first batch.
    try {
      getAnthropicClient();
      console.log(`  API mode:         enabled (model=${MODEL_API_MAP[opts.model] ?? MODEL_MAP[opts.model]}, cost-cap=$${opts.costCapUsd.toFixed(2)})`);
    } catch (err) {
      console.error(`  ✗ API mode fatal: ${err instanceof Error ? err.message : err}`);
      console.error(`    Fix: add ANTHROPIC_API_KEY=sk-ant-... to .env.local`);
      console.error(`    Or use --cli to fall back to the subprocess path.`);
      process.exit(1);
    }
  }

  if (opts.retryFailed) {
    console.log('  --retry-failed: clearing enrichment_failed=TRUE flags before run');
    if (!opts.dryRun) {
      const { error } = await supabase
        .from('events')
        .update({ enrichment_failed: false, enrichment_failure_count: 0 })
        .eq('enrichment_failed', true);
      if (error) console.error(`\nretry-failed clear: ${error.message}`);
    }
  }

  // Counts up front so the operator sees how big the run is.
  const { count: alreadyDone } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .in('publish_status', SELECTION_PUBLISH_STATUSES)
    .eq('enrichment_version', ENRICHMENT_VERSION_CLAUDE_V1);

  let pendingQuery = supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .in('publish_status', SELECTION_PUBLISH_STATUSES);
  if (!opts.force) {
    // Mirror the per-page selection contract: --force bypasses BOTH
    // version and poison-pill filters so the operator sees a count that
    // matches what the script will actually process.
    pendingQuery = pendingQuery.or(
      `enrichment_version.is.null,enrichment_version.neq.${ENRICHMENT_VERSION_CLAUDE_V1}`,
    );
    pendingQuery = pendingQuery.or('enrichment_failed.is.null,enrichment_failed.eq.false');
  }
  if (opts.since) {
    const ms = parseSince(opts.since);
    if (ms != null) {
      const cutoff = new Date(Date.now() - ms).toISOString();
      pendingQuery = pendingQuery.gte('updated_at', cutoff);
    }
  }
  if (opts.futureOnly) {
    pendingQuery = pendingQuery.gte('start_date', new Date().toISOString());
  }
  const { count: totalPending } = await pendingQuery;

  console.log('\nEvent Enrichment — Claude Code (batch v2)');
  console.log(`  Path:             ${opts.useApi ? 'Anthropic API (tool_use, paranoid schema)' : 'CLI subprocess (claude -p)'}`);
  console.log(`  Model:            ${opts.model} (${opts.useApi ? (MODEL_API_MAP[opts.model] ?? MODEL_MAP[opts.model]) : MODEL_MAP[opts.model]})`);
  console.log(`  Batch size:       ${opts.batchSize} events / call`);
  console.log(`  Concurrency:      ${opts.concurrency} parallel ${opts.useApi ? 'API requests' : 'subprocesses'}`);
  if (opts.useApi) {
    console.log(`  Cost cap:         $${opts.costCapUsd.toFixed(2)} ${opts.costCapUsd === 0 ? '(UNLIMITED — careful!)' : '(halts cleanly at this point)'}`);
  }
  console.log(`  Limit:            ${opts.limit === Infinity ? 'none' : opts.limit}`);
  console.log(`  Since:            ${opts.since ?? '(no time filter)'}`);
  console.log(`  Force:            ${opts.force}`);
  console.log(`  Retry-failed:     ${opts.retryFailed}`);
  console.log(`  Bare mode:        ${opts.bareMode ? 'YES (API-key auth)' : 'no (MAX-OAuth ok, no --bare)'}`);
  console.log(`  Dry-run:          ${opts.dryRun}`);
  console.log(`  Fetch URLs:       ${!opts.noFetch}`);
  console.log(`  Future only:      ${opts.futureOnly}`);
  console.log(`  Output format:    ${process.env.ENRICH_OUTPUT_FORMAT === 'json' ? 'json (envelope, may truncate)' : 'text (default, bypass CLI 2.1 truncation bug)'}`);
  console.log(`  Log file:         ${opts.logFile ?? '(none)'}`);
  console.log(`  Weekly token cap: ${opts.weeklyTokenCap.toLocaleString()}`);
  console.log(`  Alert email:      ${opts.alertEmail ?? '(none)'}`);
  console.log(`  Target version:   ${ENRICHMENT_VERSION_CLAUDE_V1}`);
  console.log(`  Already done:     ${alreadyDone ?? '?'}   (resume-safe — skipped)`);
  console.log(`  Still pending:    ${totalPending ?? '?'}`);
  console.log('─'.repeat(70));

  const stats = newStats();
  const systemPrompt = buildSystemPrompt();

  appendLog(opts.logFile, {
    status: 'run_start',
    model: opts.model,
    batch_size: opts.batchSize,
    concurrency: opts.concurrency,
    bare_mode: opts.bareMode,
    pending: totalPending,
    already_done: alreadyDone,
  });

  // Page through the eligible set with a forward-only cursor on `id`.
  // Same idea as enrich-openai.ts — a cursor avoids the offset-blow-up
  // problem where progressive enrichment_version writes push later
  // pages into multi-second sequential scans.
  const PAGE_SIZE = Math.max(opts.batchSize * opts.concurrency * 4, 100);
  let cursorId: string | null = null;
  let halted = false;
  // Distinguish a clean stop (--limit reached, no more pages, --dry-run
  // break, 95% quota halt) from a fatal abort (AuthError /
  // SchemaMismatchError). On fatalAbort we skip the final flush so the
  // BulkUpdater's pending queue is dropped instead of committed.
  let fatalAbort = false;

  // Shared abort signal handed to every processBatch in a cohort. When
  // a sibling raises a fatal error, we flip this flag and Promise.allSettled
  // lets in-flight batches notice it before they queue further DB writes.
  // Codex review iteration #5.
  const abort: AbortSignal = { aborted: false };

  while (stats.processed < opts.limit && !halted) {
    const page = await fetchNextPage(supabase, opts, cursorId, PAGE_SIZE);
    if (page.length === 0) break;
    cursorId = page[page.length - 1].id;

    // Slice into batch-sized chunks and run `concurrency` of them in parallel.
    const batches: EventRow[][] = [];
    for (let i = 0; i < page.length; i += opts.batchSize) {
      batches.push(page.slice(i, i + opts.batchSize));
      const sliceTotal = batches.reduce((s, b) => s + b.length, 0);
      if (stats.processed + sliceTotal >= opts.limit) {
        // Trim the last batch so we honor --limit exactly.
        const overshoot = stats.processed + sliceTotal - opts.limit;
        if (overshoot > 0) {
          batches[batches.length - 1] = batches[batches.length - 1].slice(0, batches[batches.length - 1].length - overshoot);
        }
        break;
      }
    }

    for (let i = 0; i < batches.length; i += opts.concurrency) {
      if (shouldHalt(stats, opts)) {
        console.log(`\n[halt] ${haltReason(stats, opts)} — clean halt. Re-run to resume.`);
        halted = true;
        break;
      }
      await maybeSendQuotaAlert(stats, opts);

      const slice = batches.slice(i, i + opts.concurrency);

      // Wrap each worker promise so that a fatal rejection latches the
      // shared abort signal IMMEDIATELY, not after Promise.allSettled
      // has waited for every sibling. Without this early-latch, a fast
      // sibling that hits AuthError can be rejected ms before a slow
      // sibling does its next `updater.add()` — giving the slow worker
      // a window to commit partial writes (especially via the 500-row
      // BulkUpdater auto-flush). With the early-latch, slow siblings
      // see `abort.aborted=true` on their next write-site check and
      // skip cleanly.
      // (Codex review iteration #6.)
      const wrap = (p: Promise<BatchOutcome>): Promise<BatchOutcome> =>
        p.catch((err: unknown) => {
          if (err instanceof AuthError || err instanceof SchemaMismatchError) {
            abort.aborted = true;
          }
          // Re-throw so allSettled reports it as rejected for the
          // post-settle classification below.
          throw err;
        });

      const settled = await Promise.allSettled(
        slice.map(b => wrap(processBatch(b, opts, stats, systemPrompt, enrichmentUpdater, abort))),
      );

      // Inspect rejections AFTER all settled.
      // Use a typed tuple instead of two `let` variables so TS can
      // follow the type through the forEach closure (let-assignments
      // inside closures defeat narrowing and cause TS2358 on later
      // `instanceof` checks).
      const fatals: Array<SchemaMismatchError | AuthError> = [];
      const others: Array<{ idx: number; err: Error }> = [];
      settled.forEach((s, idx) => {
        if (s.status !== 'rejected') return;
        const err = s.reason instanceof Error ? s.reason : new Error(String(s.reason));
        if (err instanceof SchemaMismatchError || err instanceof AuthError) {
          fatals.push(err);
        } else {
          others.push({ idx, err });
        }
      });

      const firstFatal = fatals[0];
      if (firstFatal) {
        // abort.aborted was already latched by `wrap`; this block just
        // surfaces the user-facing message and finalises the halt.
        if (firstFatal instanceof SchemaMismatchError) {
          console.error('\n⛔ Schema mismatch — DB migration likely missing. Bailing.');
        } else {
          console.error('\n⛔ Auth failure — `claude /login` or set ANTHROPIC_API_KEY.');
        }
        console.error(`   ${firstFatal.message.slice(0, 300)}`);
        process.exitCode = 1;
        halted = true;
        fatalAbort = true;
        break;
      }

      if (others.length > 0) {
        // Codex review iteration #6: a non-fatal rejection from
        // processBatch indicates a code bug or an unexpected runtime
        // failure that bypassed the in-batch failure_count path. The
        // events in those batches were NOT counted as failed and the
        // cursor would otherwise advance past them silently.
        //
        // Treat these as fatal for the run: stop iteration, do NOT
        // commit pending writes, exit non-zero. Operator can inspect
        // the log and re-run. The previous "log and continue" behavior
        // masked real bugs and risked enrichment gaps.
        abort.aborted = true;
        const firstOther = others[0].err;
        console.error(`\n⛔ Unexpected worker error in ${others.length}/${slice.length} batch(es) — bailing run.`);
        console.error(`   ${firstOther.message.slice(0, 300)}`);
        for (const { idx } of others) {
          const failedBatch = slice[idx];
          console.error(`   - batch with ${failedBatch.length} events starting at ${failedBatch[0].id.slice(0, 8)}`);
        }
        process.exitCode = 1;
        halted = true;
        fatalAbort = true;
        break;
      }

      // One progress line per concurrency-cohort.
      process.stdout.write('  ' + reportLine(stats, totalPending ?? undefined, opts) + '\r');
    }

    // --dry-run breaks after one page so we don't burn tokens iterating.
    // --force does NOT break: spec says "ignore filters and redo all";
    // breaking after page 1 would only ever process PAGE_SIZE rows, which
    // contradicts the documented behavior (Codex review finding).
    if (opts.dryRun) break;
    if (page.length < PAGE_SIZE) break;
  }

  // Final flush — but ONLY on a clean stop. On fatalAbort (AuthError /
  // SchemaMismatchError) we deliberately drop the pending queue:
  // committing partial work after a process-wide auth failure can
  // poison-pill innocent rows by writing enrichment_failure_count++
  // updates that other parallel workers had queued. Codex review
  // iteration #4. Sibling auto-flushes that already fired before the
  // abort can't be rolled back; we accept that as the lesser harm.
  if (!opts.dryRun && !fatalAbort) {
    try {
      await enrichmentUpdater.flush();
    } catch (err) {
      console.error(`\nFinal bulk flush failed: ${err instanceof Error ? err.message : err}`);
    }
    console.log(
      `\nBulk-RPC summary: ${enrichmentUpdater.stats.flushes} calls, ` +
      `${enrichmentUpdater.stats.affected} rows, ` +
      `${enrichmentUpdater.stats.retries} retries, ` +
      `${enrichmentUpdater.stats.errors} errors`,
    );
  } else if (fatalAbort) {
    console.error(
      `\n[fatal-abort] skipping final flush; ${enrichmentUpdater.pending} pending update(s) dropped.\n` +
      `[fatal-abort] auto-flushed batches before abort (${enrichmentUpdater.stats.flushes} calls, ` +
      `${enrichmentUpdater.stats.affected} rows) cannot be rolled back.`,
    );
  }

  process.stdout.write('\n' + '─'.repeat(70) + '\n');
  console.log(reportLine(stats, totalPending ?? undefined, opts));
  const elapsedMin = (Date.now() - stats.startedAt) / 60000;
  console.log(`Elapsed: ${elapsedMin.toFixed(1)}min`);
  appendLog(opts.logFile, {
    status: 'run_end',
    processed: stats.processed,
    enriched: stats.enriched,
    failed: stats.failed,
    poisonPilled: stats.poisonPilled,
    elapsed_min: elapsedMin,
    tokens_in: stats.tokensIn,
    tokens_out: stats.tokensOut,
    cache_read_in: stats.cacheReadIn,
    cache_create_in: stats.cacheCreateIn,
    cost_usd: stats.costUsd,
  });

  await closeSharedBrowser();
  cleanupSystemPromptFile();
}

// Re-export validation length envelope + helpers so callers/tests can assert.
export { DESC_MIN, DESC_MAX };
export { buildSystemPrompt, parseSince, MODEL_MAP };

/**
 * Run main() only when invoked as a script, not when imported by a test.
 * tsx sets `process.argv[1]` to the absolute path of the entry script;
 * a require/import from another file would set it to that other file.
 *
 * import.meta.url is more reliable across CommonJS and ESM but tsx
 * sometimes runs as CJS. The fallback compares argv[1] to __filename-ish.
 */
const isMain = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (import.meta as any);
    if (meta && typeof meta.url === 'string') {
      // ESM context: compare module URL to argv[1] resolved
      const argv1 = process.argv[1] ?? '';
      // Either exact match or (Windows) case-insensitive trailing match
      return meta.url.includes('enrich-claude.ts') &&
             (argv1.endsWith('enrich-claude.ts') || argv1.toLowerCase().endsWith('enrich-claude.ts'));
    }
  } catch { /* not ESM */ }
  return (process.argv[1] ?? '').toLowerCase().endsWith('enrich-claude.ts');
})();

if (isMain) {
  // Graceful shutdown — log resume hint, close shared browser, clean
  // up the temp system-prompt file.
  process.on('SIGINT', async () => {
    console.log('\n\n⚠ SIGINT received. Flushing in-flight enrichment rows…');
    try {
      if (activeBulkUpdater) {
        const flushed = await activeBulkUpdater.flush();
        console.log(`  ✓ flushed ${flushed} pending events to DB`);
      }
    } catch (err) {
      console.error(`  ✗ flush failed: ${err instanceof Error ? err.message : err}`);
      console.log('  Up to ~49 events may roll back to enrichment_version=NULL');
    }
    console.log('  Re-run the same command to pick up where you were (idempotent).');
    cleanupSystemPromptFile();
    cleanupIsolatedHomePool();
    closeSharedBrowser().finally(() => process.exit(130));
  });

  main().catch((err) => {
    console.error('enrich-claude failed:', err);
    cleanupSystemPromptFile();
    cleanupIsolatedHomePool();
    closeSharedBrowser().finally(() => process.exit(1));
  });
}
