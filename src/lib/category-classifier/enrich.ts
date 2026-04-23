/**
 * Local-LLM event enrichment client.
 *
 * Talks to an OpenAI-compatible endpoint (typically LM Studio at
 * http://localhost:1234/v1, serving Qwen 2.5 14B Instruct Q4_K_M) and
 * returns a validated `EnrichmentResult` per event. If a `pageContent`
 * is provided, Qwen reads the fetched source page alongside the DB
 * metadata — produces noticeably better tagging and lets us fill in
 * missing description/price from the upstream source.
 *
 * Design:
 * - Prompt embeds the FULL allowed vocabularies so Qwen sees every valid
 *   tag/audience/vibe/etc. at inference time. Stable prefix = KV-cache
 *   hit across events.
 * - `response_format: json_schema` enforces the output shape; the closed
 *   vocabularies are enforced post-hoc in `validateEnrichment()` (too
 *   expensive to encode 180 tags as enum in the grammar).
 * - `suggested_description` / `suggested_price_text` are OPTIONAL — only
 *   populated when Qwen reads the page and thinks it has better info.
 *   Caller decides whether to persist (typically only when DB is NULL).
 * - One retry on failure, conservative empty result on permanent failure.
 */

import {
  TAGS,
  AUDIENCES,
  VIBES,
  SETTINGS,
  LANGUAGES,
  PRICE_TIERS,
  DURATION_TYPES,
  validateEnrichment,
  type EnrichmentResult,
} from './enrichment-taxonomy';

export interface EnrichmentInput {
  title: string;
  description: string | null;
  category: string | null;        // existing cat-v2 output
  tagsRaw: string[] | null;       // raw source tags (sometimes useful)
  locationName: string | null;
  organizer: string | null;
  startDate: string | null;       // ISO, helps with time-of-day hints
  endDate: string | null;
  priceText: string | null;
  priceMin: number | null;
  priceMax: number | null;
  /** Optional extracted main-text from the event's source URL. */
  pageContent: string | null;
}

/**
 * What Qwen returns. Extends the base enrichment with optional page-derived
 * fills. The batch runner decides whether to persist them (typically only
 * when the DB column is NULL / empty).
 */
export interface EnrichmentOutput extends EnrichmentResult {
  suggested_description: string | null;
  suggested_price_text: string | null;
}

export interface LocalAiConfig {
  baseUrl: string;                // e.g. 'http://localhost:1234/v1'
  apiKey: string;                 // LM Studio accepts any string
  model: string;                  // e.g. 'qwen2.5-14b-instruct'
  timeoutMs?: number;
}

const DEFAULT_CONFIG: LocalAiConfig = {
  baseUrl: process.env.LOCAL_AI_BASE_URL ?? 'http://localhost:1234/v1',
  apiKey: process.env.LOCAL_AI_KEY ?? 'lm-studio',
  model: process.env.LOCAL_AI_MODEL ?? 'qwen2.5-14b-instruct',
  timeoutMs: 120_000,  // 2min — with page content the prompt can be long
};

/**
 * JSON schema forcing the exact shape we want Qwen to produce.
 *
 * Enum values are NOT listed in the schema (grammar-guided decoding with
 * 180 tag enums is too slow). The prompt tells Qwen which values are
 * allowed; `validateEnrichment()` post-filters anything invalid.
 *
 * The two suggested_* fields can be null (when Qwen has nothing to add).
 */
const RESPONSE_JSON_SCHEMA = {
  name: 'event_enrichment',
  strict: false,
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

/**
 * Module-level system prompt — built once. The taxonomy is static, so
 * there's no reason to regenerate per event. Also keeps the prompt prefix
 * identical across calls so LM Studio can KV-cache it.
 */
const SYSTEM_PROMPT = buildSystemPrompt();

function buildSystemPrompt(): string {
  return `Du bist ein Klassifikator für österreichische Veranstaltungen. Deine Aufgabe: analysiere ein Event und gib strukturierte JSON-Metadaten zurück, die wir in einer Datenbank speichern.

WICHTIG: Du darfst für tags/audience/vibe/setting/language/price_tier/duration_type ausschließlich Werte aus den untenstehenden Listen verwenden. Wenn etwas nicht in der Liste ist, lasse es weg — erfinde nichts. Für suggested_description/suggested_price_text darfst du frei formulieren, aber nur füllen wenn der Quelltext tatsächlich brauchbare Info enthält.

────────── ERLAUBTE TAGS (tags, 0-5 Stück) ──────────
${TAGS.join(', ')}

────────── ERLAUBTE AUDIENCE (audience, 1-4 Stück) ──────────
${AUDIENCES.join(', ')}

────────── ERLAUBTE VIBE (vibe, 1-2 Stück) ──────────
${VIBES.join(', ')}

────────── ERLAUBTE SETTING (setting, 1-2 Stück) ──────────
${SETTINGS.join(', ')}

────────── ERLAUBTE LANGUAGE (language, genau 1) ──────────
${LANGUAGES.join(', ')}

────────── ERLAUBTE PRICE_TIER (price_tier, genau 1) ──────────
${PRICE_TIERS.join(', ')}
- gratis: Eintritt ist frei (0€)
- günstig: bis 15€
- mittel: 15-50€
- premium: über 50€
- unbekannt: Preis ist nicht erkennbar

────────── ERLAUBTE DURATION_TYPE (duration_type, genau 1) ──────────
${DURATION_TYPES.join(', ')}
- kurz: unter 2h
- abend: 2-5h
- ganztag: ganzer Tag
- mehrtägig: mehrere Tage
- dauerausstellung: permanent (Ausstellung, Museum)
- nacht-bis-morgen: typische Rave-Dauer 22h-6h
- 24-stunden: Wochenend-Rave
- 48-stunden: Festival-Weekender

────────── BOOLEAN-FLAGS (KRITISCH: nur TRUE bei expliziter Evidenz) ──────────

is_student_friendly → TRUE nur wenn MINDESTENS EINE dieser Bedingungen erfüllt ist:
  1. Titel/Beschreibung erwähnt explizit "Studenten", "Studierende", "Uni-Party", "Semester-Opening"
  2. Veranstaltungsort ist nachweislich eine Universität/FH/Hochschule (TU Wien, WU, FH Burgenland, etc.)
  3. Veranstalter ist eine Studentenvereinigung (ÖH, ESN, AIESEC, IAESTE, AEGEE, Fachschaft, Studiengang)
  4. Explizite Studenten-Ermäßigung oder Studenten-Sonderpreis im Preistext
Andernfalls FALSE. Ein normales Konzert, Theater, Club-Event, Festival oder Markt ist NICHT automatisch "student-friendly" nur weil Studenten hingehen könnten. IM ZWEIFEL: FALSE.

is_family_friendly → TRUE nur wenn MINDESTENS EINE dieser Bedingungen erfüllt ist:
  1. Titel/Beschreibung erwähnt explizit "Familie", "Kinder", "familien-geeignet", "ab 0/3/6 Jahren", "Kinderprogramm"
  2. Event-Typ ist inhärent kinderorientiert: Kindertheater, Puppentheater, Kinderkino, Kinderzirkus, Familien-Picknick, Spielfest, Kinder-Workshop, Adventmarkt/Christkindlmarkt (tagsüber), Kirtag, Erntedank, Maibaumfest, Ferienprogramm
  3. Veranstaltungsort/Veranstalter ist explizit familienorientiert (Familienzentrum, Naturpark-Führung, Zoo, Kindermuseum)
Andernfalls FALSE. Konzerte/Club-Events/Bar-Events/Abend-Events/Weinverkostungen/Heurige/Sportwettkämpfe/Bildungsvorträge für Erwachsene sind NICHT automatisch family-friendly nur weil sie nicht explizit 18+ sind. IM ZWEIFEL: FALSE.

Diese beiden Flags werden später im Wizard-Filter verwendet — ein false-positive "ist familienfreundlich" auf einem DnB-Rave zerstört das Vertrauen des Nutzers. Lieber zurückhaltend flaggen.

────────── SUGGESTED_DESCRIPTION ──────────
Wenn dir der Quelltext (QUELLTEXT-Abschnitt unten) vorliegt UND die bisherige BESCHREIBUNG leer oder sehr kurz ist: schreibe eine saubere, informative Beschreibung (150-400 Zeichen) aus dem Quelltext. Sonst: null.

────────── SUGGESTED_PRICE_TEXT ──────────
Wenn dir der Quelltext vorliegt UND dort ein Preis steht UND im PREIS-Feld oben nichts ist: extrahiere den Preis-Text (z.B. "ab 25€", "Erwachsene 15€, Kinder frei", "Eintritt frei"). Sonst: null.

────────── OUTPUT ──────────
Gib ausschließlich ein JSON-Objekt mit genau diesen 11 Feldern zurück — keine Erklärung, kein Text drumherum.

Denk an österreichische Kultur: Kirtag ist Dorffest mit Musik/Essen (traditionell, familien-mit-kindern). Wallfahrt ist religiös (spirituell, traditionell). Heuriger ist Weinlokal (gemütlich, erwachsene-allgemein). Ein Goa-Festival im Wald ist psytrance+goa+rave+psychedelic+forest+open-air-rave. Ein DnB-Rave ist drum-and-bass+rave+club-night / underground / energetisch / nacht-bis-morgen.`;
}

/**
 * Per-event user message. Pattern: event metadata block first, then the
 * fetched QUELLTEXT block if present, so Qwen can cross-check what the
 * scraper captured against what the source actually says.
 */
function buildUserMessage(input: EnrichmentInput): string {
  const parts: string[] = [];
  parts.push(`TITEL: ${input.title}`);
  if (input.description) {
    const desc = input.description.slice(0, 600);
    parts.push(`BESCHREIBUNG: ${desc}${input.description.length > 600 ? '…' : ''}`);
  } else {
    parts.push('BESCHREIBUNG: (leer)');
  }
  if (input.category) parts.push(`BISHERIGE KATEGORIE: ${input.category}`);
  if (input.tagsRaw && input.tagsRaw.length > 0) {
    parts.push(`ROH-TAGS VOM SCRAPER: ${input.tagsRaw.slice(0, 10).join(', ')}`);
  }
  if (input.locationName) parts.push(`ORT: ${input.locationName}`);
  if (input.organizer) parts.push(`VERANSTALTER: ${input.organizer}`);
  if (input.startDate) {
    const d = new Date(input.startDate);
    if (!isNaN(d.getTime())) {
      const hour = d.getHours();
      const weekday = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
      parts.push(`ZEIT: ${weekday} ${hour}:${String(d.getMinutes()).padStart(2, '0')} Uhr`);
    }
  }
  if (input.priceText) parts.push(`PREIS: ${input.priceText}`);
  else if (input.priceMin != null || input.priceMax != null) {
    parts.push(`PREIS: ab ${input.priceMin ?? '?'}€ bis ${input.priceMax ?? '?'}€`);
  } else {
    parts.push('PREIS: (leer)');
  }

  if (input.pageContent) {
    parts.push('');
    parts.push('────────── QUELLTEXT DER EVENT-SEITE (extrahiert) ──────────');
    parts.push(input.pageContent);
  }

  return parts.join('\n');
}

async function callLocalAi(
  userMessage: string,
  cfg: LocalAiConfig,
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 120_000);

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_schema', json_schema: RESPONSE_JSON_SCHEMA },
        temperature: 0.2,
        max_tokens: 600,   // bumped for suggested_description
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LM Studio HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('LM Studio returned no content');

    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Post-validate suggested text — Qwen sometimes returns "" or "null" as
 * a string when it means "nothing". Coerce those to real null.
 */
function cleanSuggested(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^null$/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Classify + optionally enrich description/price. Never throws, never
 * returns invalid fields. On hard failure returns a no-op result.
 */
export async function enrichEvent(
  input: EnrichmentInput,
  config: Partial<LocalAiConfig> = {},
): Promise<{ result: EnrichmentOutput; ok: boolean; error?: string }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const userMessage = buildUserMessage(input);

  let lastErr: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callLocalAi(userMessage, cfg);
      const validated = validateEnrichment(raw);
      const rawObj = (raw ?? {}) as Record<string, unknown>;
      const output: EnrichmentOutput = {
        ...validated,
        suggested_description: cleanSuggested(rawObj.suggested_description),
        suggested_price_text: cleanSuggested(rawObj.suggested_price_text),
      };
      return { result: output, ok: true };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    result: {
      primary_category: null,
      tags: [], audience: [], vibe: [], occasion: [], setting: [],
      language: null, price_tier: null, price_flags: [], duration_type: null,
      is_student_friendly: false, is_family_friendly: false,
      suggested_description: null, suggested_price_text: null,
    },
    ok: false,
    error: lastErr,
  };
}
