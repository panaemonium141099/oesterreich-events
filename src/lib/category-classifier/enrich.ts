/**
 * Local-LLM event enrichment client.
 *
 * Talks to an OpenAI-compatible endpoint (typically LM Studio at
 * http://localhost:1234/v1, serving Qwen 2.5 14B Instruct Q4_K_M) and
 * returns a validated `EnrichmentResult` per event.
 *
 * Design:
 * - The prompt embeds the FULL allowed vocabularies so Qwen literally sees
 *   every valid tag/audience/vibe/etc. at inference time. No extra
 *   reasoning needed — the model just picks applicable values.
 * - Response format is forced to JSON (LM Studio + Qwen 2.5 supports
 *   `response_format: { type: 'json_object' }`).
 * - `validateEnrichment` silently drops anything not in the closed sets,
 *   so even if Qwen hallucinates a tag we never write garbage to the DB.
 * - One retry on invalid/empty output; after that we return a conservative
 *   empty-ish result rather than throwing.
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
  timeoutMs: 60_000,
};

/**
 * Build the system prompt — the taxonomy itself is embedded here so Qwen
 * sees every allowed value. Keeps the prompt stable across events (great
 * for LM Studio's KV-cache — shared prefix means second+ events only pay
 * for the user-message tokens).
 */
function buildSystemPrompt(): string {
  return `Du bist ein Klassifikator für österreichische Veranstaltungen. Deine Aufgabe: analysiere ein Event und gib strukturierte JSON-Metadaten zurück, die wir in einer Datenbank speichern.

WICHTIG: Du darfst ausschließlich Werte aus den untenstehenden Listen verwenden. Wenn etwas nicht in der Liste ist, lasse es weg — erfinde nichts.

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

────────── BOOLEAN-FLAGS ──────────
is_student_friendly: true wenn studentenorientiert, spät, günstig, uni-nah, oder "studenten" im Titel erwähnt
is_family_friendly: true wenn Kinder willkommen, tagsüber oder frühabends, keine 18+-Inhalte

────────── OUTPUT-FORMAT ──────────
Gib ausschließlich ein JSON-Objekt mit dieser Struktur zurück (keine Erklärung, kein Text drumherum):
{
  "tags": ["..."],
  "audience": ["..."],
  "vibe": ["..."],
  "setting": ["..."],
  "language": "...",
  "price_tier": "...",
  "duration_type": "...",
  "is_student_friendly": true/false,
  "is_family_friendly": true/false
}

Denk an österreichische Kultur: Kirtag ist ein Dorffest mit Musik/Essen (traditionell, familien-mit-kindern). Wallfahrt ist religiös (spirituell, traditionell). Heuriger ist Weinlokal (gemütlich, erwachsene-allgemein). Ein Goa-Festival im Wald ist psytrance+goa+rave+psychedelic+forest+open-air-rave.`;
}

/**
 * Build the per-event user message — keeps only the fields that actually
 * help the model decide. Bloat here hurts throughput more than quality.
 */
function buildUserMessage(input: EnrichmentInput): string {
  const parts: string[] = [];
  parts.push(`TITEL: ${input.title}`);
  if (input.description) {
    const desc = input.description.slice(0, 600);
    parts.push(`BESCHREIBUNG: ${desc}${input.description.length > 600 ? '…' : ''}`);
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
  }
  return parts.join('\n');
}

async function callLocalAi(
  systemPrompt: string,
  userMessage: string,
  cfg: LocalAiConfig,
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 60_000);

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,  // low — classification is not creative writing
        max_tokens: 400,
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
 * Classify a single event. Returns a validated EnrichmentResult — never
 * throws, never returns invalid fields. On hard failure (LLM down, timeout,
 * unparseable output after retry) returns an empty result and the caller
 * decides whether to write it or skip.
 */
export async function enrichEvent(
  input: EnrichmentInput,
  config: Partial<LocalAiConfig> = {},
): Promise<{ result: EnrichmentResult; ok: boolean; error?: string }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(input);

  let lastErr: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callLocalAi(systemPrompt, userMessage, cfg);
      const validated = validateEnrichment(raw);
      return { result: validated, ok: true };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    result: {
      tags: [], audience: [], vibe: [], setting: [],
      language: null, price_tier: null, duration_type: null,
      is_student_friendly: false, is_family_friendly: false,
    },
    ok: false,
    error: lastErr,
  };
}
