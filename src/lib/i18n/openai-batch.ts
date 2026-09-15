/**
 * DE→EN-Übersetzung über die OpenAI Batch API.
 *
 * Warum ein zweiter Anbieter neben Gemini (`translate-batch.ts`):
 * Google hat am 2026-09-09 das Cloud-Projekt des Gemini-Keys gesperrt
 * ("Lightning dunning decision is deny", HTTP 403 auf jeden Aufruf). Der
 * Backfill stand damit bei 31 % der Events still, und auch vorher war er
 * durch das Free-Tier-Kontingent (10 000 Requests/Tag) auf über eine Woche
 * gestreckt.
 *
 * Warum Batch statt Einzel-Calls: die Batch API kostet die Hälfte des
 * Standardpreises, hat keine Requests-pro-Minute-Grenze und liefert
 * innerhalb von 24 h (in der Praxis Minuten bis wenige Stunden). Für
 * einen Rückstand, der niemanden wartend am Bildschirm hat, ist das die
 * richtige Form.
 *
 * Modellwahl (Stichprobe 2026-09-15, sechs echte Events, Batch-Preise
 * je 1M Tokens):
 *   gpt-4.1-nano   $0,05 / $0,20   sauber, Eigennamen bleiben, Temp 0
 *   gpt-4o-mini    $0,075 / $0,30  gleichwertig, minimal idiomatischer
 *   gpt-5-nano     $0,025 / $0,20  liess "gemütliches" deutsch stehen,
 *                                  keine Temperature, langsamer
 *   gpt-5.4-nano   $0,10 / $0,625  2,7x teurer, kein Mehrwert fürs Übersetzen
 * Hochgerechnet auf die 55 386 offenen Events (19 898 davon nur Titel,
 * Rest im Schnitt 824 Zeichen Beschreibung): ~17 M Input- und ~6,7 M
 * Output-Tokens, also rund 2,20 $ mit gpt-4.1-nano. Der zweite Versuch
 * für Zeilen, die durch die Qualitätsprüfung fallen, läuft auf gpt-4o-mini.
 *
 * Dieses Modul ist bewusst frei von I/O: Anfragen bauen, Antworten
 * lesen, Qualität prüfen, Kosten rechnen. Upload, Polling und DB-Writes
 * liegen in `src/scripts/translate-openai-batch.ts`.
 *
 * Die Prompts sind dieselben wie im Gemini-Pfad (`translate-event.ts`,
 * `translate-activity.ts`) — sonst driften die Übersetzungen je nach
 * Herkunft auseinander.
 */

import {
  MAX_DESC_CHARS as EVENT_MAX_DESC_CHARS,
  SYSTEM_FULL,
  SYSTEM_TITLE_ONLY,
} from './translate-event';
import {
  MAX_DESC_CHARS as ACTIVITY_MAX_DESC_CHARS,
  SYSTEM_INSTRUCTION as ACTIVITY_SYSTEM,
} from './translate-activity';
import { MIN_ACTIVITY_DESCRIPTION } from './translate-batch';

/** Erstversuch. Per Env umschaltbar, ohne Deploy. */
export const DEFAULT_MODEL = process.env.OPENAI_TRANSLATE_MODEL ?? 'gpt-4.1-nano';
/** Zweiter Versuch für Zeilen, die die Qualitätsprüfung nicht bestanden haben. */
export const RETRY_MODEL = process.env.OPENAI_TRANSLATE_RETRY_MODEL ?? 'gpt-4o-mini';
/** Nach so vielen Versuchen bleibt eine Zeile unübersetzt liegen. */
export const MAX_ATTEMPTS = 2;

/** Output-Budgets wie im Gemini-Pfad. */
const MAX_OUTPUT_TOKENS_FULL = 4096;
const MAX_OUTPUT_TOKENS_TITLE = 256;
const MAX_OUTPUT_TOKENS_ACTIVITY = 6144;

/**
 * Batch-Preise in USD je 1M Tokens (Stand 2026-09-15,
 * developers.openai.com/api/docs/pricing). Nur für die Kostenzeile im
 * Bericht — abgerechnet wird bei OpenAI.
 */
const BATCH_PRICE_PER_M: Record<string, { input: number; output: number }> = {
  'gpt-4.1-nano': { input: 0.05, output: 0.2 },
  'gpt-4o-mini': { input: 0.075, output: 0.3 },
  'gpt-5-nano': { input: 0.025, output: 0.2 },
  'gpt-4.1-mini': { input: 0.2, output: 0.8 },
};

export type BatchKind = 'event' | 'poi';

export interface EventSource {
  id: string;
  title: string;
  description: string | null;
}

export interface ActivitySource {
  id: string;
  name: string;
  description: string;
}

/** Eine Zeile der JSONL-Eingabedatei. */
export interface BatchRequestLine {
  custom_id: string;
  method: 'POST';
  url: '/v1/chat/completions';
  body: Record<string, unknown>;
}

export function customId(kind: BatchKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseCustomId(value: string): { kind: BatchKind; id: string } | null {
  const idx = value.indexOf(':');
  if (idx <= 0) return null;
  const kind = value.slice(0, idx);
  const id = value.slice(idx + 1);
  if ((kind !== 'event' && kind !== 'poi') || !id) return null;
  return { kind, id };
}

function jsonSchema(name: string, properties: Record<string, unknown>) {
  return {
    type: 'json_schema',
    json_schema: {
      name,
      strict: true,
      schema: {
        type: 'object',
        properties,
        required: Object.keys(properties),
        additionalProperties: false,
      },
    },
  };
}

/** Beschreibung wie im Gemini-Pfad: getrimmt, gekappt, leer → null. */
export function eventDescription(description: string | null): string | null {
  return description?.trim() ? description.slice(0, EVENT_MAX_DESC_CHARS) : null;
}

export function buildEventRequest(row: EventSource, model: string): BatchRequestLine {
  const desc = eventDescription(row.description);
  return {
    custom_id: customId('event', row.id),
    method: 'POST',
    url: '/v1/chat/completions',
    body: {
      model,
      messages: [
        { role: 'system', content: desc ? SYSTEM_FULL : SYSTEM_TITLE_ONLY },
        {
          role: 'user',
          content: desc ? `Titel: ${row.title}\n\nBeschreibung:\n${desc}` : `Titel: ${row.title}`,
        },
      ],
      response_format: desc
        ? jsonSchema('event_translation', {
            title_en: { type: 'string' },
            description_en: { type: 'string' },
          })
        : jsonSchema('event_title_translation', { title_en: { type: 'string' } }),
      temperature: 0,
      max_completion_tokens: desc ? MAX_OUTPUT_TOKENS_FULL : MAX_OUTPUT_TOKENS_TITLE,
    },
  };
}

export function buildActivityRequest(row: ActivitySource, model: string): BatchRequestLine {
  return {
    custom_id: customId('poi', row.id),
    method: 'POST',
    url: '/v1/chat/completions',
    body: {
      model,
      messages: [
        { role: 'system', content: ACTIVITY_SYSTEM },
        {
          role: 'user',
          content: `Name: ${row.name}\n\nBeschreibung:\n${row.description.trim().slice(0, ACTIVITY_MAX_DESC_CHARS)}`,
        },
      ],
      response_format: jsonSchema('activity_translation', { description_en: { type: 'string' } }),
      temperature: 0,
      max_completion_tokens: MAX_OUTPUT_TOKENS_ACTIVITY,
    },
  };
}

/** True, wenn der POI überhaupt übersetzt werden soll (Indexierungs-Gate). */
export function activityWorthTranslating(description: string | null): description is string {
  return !!description && description.trim().length >= MIN_ACTIVITY_DESCRIPTION;
}

export function toJsonl(lines: BatchRequestLine[]): string {
  return lines.map(l => JSON.stringify(l)).join('\n') + '\n';
}

export interface TokenUsage {
  input: number;
  output: number;
}

export type OutputLine =
  | { customId: string; ok: true; content: string; usage: TokenUsage }
  | { customId: string; ok: false; reason: string; usage: TokenUsage };

/**
 * Liest EINE Zeile der Ausgabe- oder Fehlerdatei. Beide haben dasselbe
 * Format: `response.status_code` + `response.body` bei einer Antwort des
 * Modells, `error` wenn die Anfrage gar nicht erst lief (Batch abgelaufen,
 * ungültige Zeile).
 */
export function parseOutputLine(line: string): OutputLine | null {
  let parsed: {
    custom_id?: unknown;
    error?: { code?: string; message?: string } | null;
    response?: {
      status_code?: number;
      body?: {
        error?: { message?: string; code?: string };
        choices?: Array<{
          finish_reason?: string;
          message?: { content?: string | null; refusal?: string | null };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
    } | null;
  };
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed.custom_id !== 'string') return null;
  const cid = parsed.custom_id;
  const body = parsed.response?.body;
  const usage: TokenUsage = {
    input: body?.usage?.prompt_tokens ?? 0,
    output: body?.usage?.completion_tokens ?? 0,
  };

  if (parsed.error) {
    return { customId: cid, ok: false, usage, reason: parsed.error.code ?? parsed.error.message ?? 'unbekannter Fehler' };
  }
  const status = parsed.response?.status_code ?? 0;
  if (status !== 200) {
    const msg = body?.error?.message ?? body?.error?.code ?? `HTTP ${status}`;
    return { customId: cid, ok: false, usage, reason: `HTTP ${status}: ${msg}` };
  }
  const choice = body?.choices?.[0];
  if (choice?.message?.refusal) {
    return { customId: cid, ok: false, usage, reason: 'Refusal' };
  }
  if (choice?.finish_reason === 'length') {
    return { customId: cid, ok: false, usage, reason: 'abgeschnitten (finish_reason=length)' };
  }
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return { customId: cid, ok: false, usage, reason: 'leere Antwort' };
  }
  return { customId: cid, ok: true, content, usage };
}

export interface EventPatch {
  title_en: string;
  description_en: string | null;
}

export function eventPatchFromContent(
  content: string,
  hasDescription: boolean,
): { patch: EventPatch } | { reason: string } {
  let parsed: { title_en?: unknown; description_en?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    return { reason: 'kein gültiges JSON' };
  }
  const titleEn = typeof parsed.title_en === 'string' ? parsed.title_en.trim() : '';
  if (!titleEn) return { reason: 'title_en leer' };
  if (!hasDescription) return { patch: { title_en: titleEn, description_en: null } };
  const descEn = typeof parsed.description_en === 'string' ? parsed.description_en.trim() : '';
  if (!descEn) return { reason: 'description_en leer' };
  return { patch: { title_en: titleEn, description_en: descEn } };
}

export function activityDescriptionFromContent(content: string): { description_en: string } | { reason: string } {
  let parsed: { description_en?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    return { reason: 'kein gültiges JSON' };
  }
  const value = typeof parsed.description_en === 'string' ? parsed.description_en.trim() : '';
  return value ? { description_en: value } : { reason: 'description_en leer' };
}

/**
 * Deutsche Funktionswörter, die in englischem Fließtext praktisch nicht
 * vorkommen. Eigennamen ("Haus der Musik") liefern vereinzelte Treffer,
 * deshalb zählt erst die Dichte.
 */
const GERMAN_MARKERS =
  /\b(und|oder|nicht|mit|für|eine|einen|einem|einer|der|die|das|ist|sind|wird|werden|auf|bei|zum|zur|auch|sich|wir|ihr|sie)\b/gi;

/**
 * Plausibilitätsprüfung einer Übersetzung. `null` = in Ordnung, sonst der
 * Grund. Bewusst grob: sie soll die Ausreißer fangen (Text nicht
 * übersetzt, halb abgebrochen, wild ausgeschmückt), nicht Stil bewerten.
 * Gemessen an sechs Stichproben liegt das Längenverhältnis EN/DE bei
 * 0,89 bis 0,95.
 */
export function qualityIssue(source: string, translated: string): string | null {
  const src = source.trim();
  const out = translated.trim();
  if (src.length < 120) return null; // zu kurz für Statistik — Titel u. ä.
  const ratio = out.length / src.length;
  if (ratio < 0.45) return `zu kurz (${ratio.toFixed(2)} der Quelle)`;
  if (ratio > 2.0) return `zu lang (${ratio.toFixed(2)} der Quelle)`;
  const words = out.split(/\s+/).filter(Boolean).length;
  if (words >= 40) {
    const hits = (out.match(GERMAN_MARKERS) ?? []).length;
    const per100 = (hits / words) * 100;
    if (per100 > 5) return `nicht übersetzt (${per100.toFixed(0)} deutsche Funktionswörter je 100)`;
  }
  return null;
}

/** Kosten in USD zu Batch-Preisen; `null` für unbekannte Modelle. */
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const price = BATCH_PRICE_PER_M[model];
  if (!price) return null;
  return (usage.input / 1_000_000) * price.input + (usage.output / 1_000_000) * price.output;
}

/** Was ein Lauf über einen abgeschickten Batch wissen muss, um ihn später einzusammeln. */
export interface BatchState {
  batchId: string;
  inputFileId: string;
  model: string;
  createdAt: string;
  /**
   * custom_ids in Auftragsreihenfolge. Die Quelltexte stehen NICHT hier:
   * für die Qualitätsprüfung liest der Sammler sie aus der DB nach —
   * 4 000 Beschreibungen im State wären Megabytes je Batch.
   */
  customIds: string[];
  /** Wievielter Versuch für diese Zeilen (1 = Erstversuch mit DEFAULT_MODEL). */
  attempt: number;
}
