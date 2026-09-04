import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

/**
 * fn-17 Slice 3 — Lazy-Übersetzung von Event-Inhalten (Chrome-Prinzip:
 * übersetzt wird nur, was tatsächlich angeschaut wird).
 *
 * Ablauf beim Render einer /en-Event-Detailseite:
 *   1. `title_en`/`description_en` bereits in der DB → sofort zurückgeben
 *      (0 API-Calls; der Normalfall ab dem zweiten Aufruf).
 *   2. Sonst EIN Gemini-2.5-Flash-Call (gleicher Key wie die Smart-Suche),
 *      Ergebnis wird per Service-Role in `events` zurückgeschrieben.
 *   3. Jeder Fehler (kein Key, Timeout, Quota, Write-Fehler) degradiert
 *      still auf Deutsch — die Seite rendert IMMER.
 *
 * Guards gegen Kostenexplosion:
 *   - Nur Future-Events (vergangene Detailseiten bleiben deutsch).
 *   - Beschreibung wird auf MAX_DESC_CHARS gekappt (Gemini-Input-Budget).
 *   - Ein Event wird nur EINMAL übersetzt (DB-Cache, `translated_at`).
 */

export interface EventTranslationInput {
  id: string;
  title: string | null;
  description: string | null;
  start_date: string | null;
  title_en?: string | null;
  description_en?: string | null;
}

export interface EventTranslation {
  title_en: string | null;
  description_en: string | null;
}

const MODEL = 'gemini-2.5-flash';
const MAX_DESC_CHARS = 4000;
const TIMEOUT_MS = 8000;

/**
 * Output-Budget mit Beschreibung. 2048 war zu knapp: eine 4000-Zeichen-
 * Beschreibung braucht als Übersetzung samt JSON-Rahmen mehr, und ein
 * `finishReason: MAX_TOKENS` liefert abgeschnittenes JSON, an dem
 * JSON.parse scheitert — der Call ist bezahlt und das Ergebnis weg.
 */
const MAX_OUTPUT_TOKENS_FULL = 4096;
/** Nur ein Titel — 256 reicht mit grossem Abstand (gemessen: 11-19). */
const MAX_OUTPUT_TOKENS_TITLE = 256;

const SHARED_RULES =
`- Keep proper nouns unchanged: venue names, band/artist names, place names (Gemeinde/city names), festival brand names. "Heuriger"/"Kirtag" may be kept with a short English gloss on first use, e.g. "Kirtag (traditional fair)".
- Translate faithfully — do NOT add, embellish or omit information. No marketing language that is not in the source.
- title_en: concise translated title. If the title is a proper name that needs no translation, return it unchanged.`;

const SYSTEM_FULL =
`You translate Austrian event listings from German to natural English for an event-discovery website.

Rules:
${SHARED_RULES}
- Keep the original paragraph/line-break structure of the description.
- description_en: full translation of the description.`;

/**
 * Eigener Prompt für Events ohne Beschreibung.
 *
 * Grund (gemessen 2026-09-04): mit dem Voll-Prompt und der Eingabe
 * "(keine Beschreibung vorhanden)" degeneriert gemini-2.5-flash — es
 * hängt an `title_en` endlos Zeilenumbrüche an, bis `maxOutputTokens` greift
 * (finishReason MAX_TOKENS, ~2035 Output-Tokens, ~7,5 s) und liefert
 * abgeschnittenes JSON. Reproduzierbar bei 5 von 5 Stichproben; das
 * betrifft 25 223 der 74 767 offenen Events (34 %). Mit dem
 * Titel-only-Schema unten: 5 von 5 sauber, ~0,7 s, ~12 Output-Tokens.
 */
const SYSTEM_TITLE_ONLY =
`You translate Austrian event titles from German to natural English for an event-discovery website.

Rules:
${SHARED_RULES}
- Return only the translated title, nothing else.`;

export interface TranslateOptions {
  /** Abbruch pro Versuch. Default 8 s (Render-Budget des Lazy-Pfads). */
  timeoutMs?: number;
  /**
   * Zusätzliche Versuche nach einem Fehlschlag. Default 0.
   *
   * Auch mit Beschreibung schlagen ~15-25 % der Calls transient fehl —
   * dieselbe Zeilenumbruch-Degeneration bzw. `finishReason: RECITATION`
   * bei wörtlich von Veranstalterseiten übernommenen Texten. Bei Wiederholung
   * mit identischem Input geht der Grossteil durch, deshalb nutzt der
   * Batch retries=1. Der Lazy-Pfad bleibt bei 0: er rendert eine Seite
   * und fällt bei Fehlschlag folgenlos auf Deutsch zurück.
   */
  retries?: number;
  /**
   * Wartezeit vor jedem Wiederholungsversuch, verdoppelt sich je Versuch.
   *
   * Gemessen im Backfill am 2026-09-04: bei Concurrency 20 lief eine
   * Fehlerserie über ~470 aufeinanderfolgende Events, die sich von selbst
   * wieder fing — ein zeitlich begrenztes Fenster auf Gemini-Seite, kein
   * harter Deckel (25 parallele Test-Calls gingen währenddessen durch).
   * Ein sofortiger Retry fällt in genau dasselbe Fenster; mit Backoff
   * landet er dahinter. Default 0 — der Lazy-Pfad darf einen Render nicht
   * verzögern.
   */
  retryDelayMs?: number;
  /**
   * Wird bei jedem gescheiterten Versuch gerufen. Ohne diesen Haken
   * verschluckt der catch-Block die Ursache und ein Batch-Lauf meldet nur
   * eine Zahl — genau die Situation, in der man wissen will, ob es Quota,
   * Timeout oder kaputtes JSON war.
   */
  onAttemptError?: (reason: string, attempt: number) => void;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let t: ReturnType<typeof setTimeout> | null = null;
  return Promise.race<T | null>([
    p,
    new Promise<null>(resolve => {
      t = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => {
    if (t) clearTimeout(t);
  });
}

function isFutureEvent(startDate: string | null): boolean {
  if (!startDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return startDate.slice(0, 10) >= today;
}

function parseTranslation(text: string | undefined): EventTranslation | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { title_en?: unknown; description_en?: unknown };
    const titleEn = typeof parsed.title_en === 'string' && parsed.title_en.trim() ? parsed.title_en.trim() : null;
    const descEn = typeof parsed.description_en === 'string' && parsed.description_en.trim() ? parsed.description_en.trim() : null;
    if (!titleEn) return null;
    return { title_en: titleEn, description_en: descEn };
  } catch {
    return null;
  }
}

/**
 * EIN Übersetzungsversuch (plus optionale Retries) für ein Event.
 * Exportiert, damit der Batch-Backfill
 * (`src/scripts/translate-events-en.ts`) und der Tages-Cron
 * (`/api/cron/translate-events`) exakt denselben Prompt benutzen wie der
 * Lazy-Pfad — sonst driften die Übersetzungen je nach Herkunft
 * auseinander.
 */
export async function translateViaGemini(
  title: string,
  description: string | null,
  apiKey: string,
  options: TranslateOptions = {},
): Promise<EventTranslation | null> {
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const attempts = Math.max(1, (options.retries ?? 0) + 1);

  const ai = new GoogleGenAI({ apiKey });
  const desc = description?.trim() ? description.slice(0, MAX_DESC_CHARS) : null;

  const properties = desc
    ? {
        title_en: { type: Type.STRING },
        description_en: { type: Type.STRING, nullable: true },
      }
    : { title_en: { type: Type.STRING } };

  const request = {
    model: MODEL,
    contents: desc
      ? `Titel: ${title}\n\nBeschreibung:\n${desc}`
      : `Titel: ${title}`,
    config: {
      systemInstruction: desc ? SYSTEM_FULL : SYSTEM_TITLE_ONLY,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties,
        required: ['title_en'],
      },
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: desc ? MAX_OUTPUT_TOKENS_FULL : MAX_OUTPUT_TOKENS_TITLE,
      temperature: 0,
    },
  };

  const retryDelayMs = options.retryDelayMs ?? 0;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0 && retryDelayMs > 0) {
      await new Promise(r => setTimeout(r, retryDelayMs * 2 ** (attempt - 1)));
    }

    let resp: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    let thrown: string | null = null;
    try {
      resp = await withTimeout(ai.models.generateContent(request), timeoutMs);
      if (resp === null) thrown = 'timeout';
    } catch (err) {
      thrown = err instanceof Error ? err.message : String(err);
    }

    const parsed = parseTranslation(resp?.text);
    if (parsed) return parsed;

    options.onAttemptError?.(
      thrown ?? `finishReason=${resp?.candidates?.[0]?.finishReason ?? 'unbekannt'}`,
      attempt,
    );
  }
  return null;
}

/**
 * Liefert die EN-Übersetzung eines Events — aus dem DB-Cache oder frisch
 * via Gemini (mit Write-back). `null` = deutsch rendern (Fallback).
 */
export async function getOrTranslateEventEn(
  event: EventTranslationInput,
): Promise<EventTranslation | null> {
  // 1. Cache-Hit — Normalfall ab dem zweiten Aufruf.
  if (event.title_en) {
    return { title_en: event.title_en, description_en: event.description_en ?? null };
  }

  // 2. Guards: kein Titel, vergangenes Event oder kein API-Key → deutsch.
  if (!event.title) return null;
  if (!isFutureEvent(event.start_date)) return null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  let translation: EventTranslation | null = null;
  try {
    translation = await translateViaGemini(event.title, event.description, apiKey);
  } catch {
    return null;
  }
  if (!translation) return null;

  // 3. Write-back (best effort — Render hängt nicht am Write).
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const supabase = createClient(url, key);
      await withTimeout(
        (async () =>
          supabase
            .from('events')
            .update({
              title_en: translation!.title_en,
              description_en: translation!.description_en,
              translated_at: new Date().toISOString(),
            })
            .eq('id', event.id))(),
        3000,
      );
    }
  } catch {
    // Cache-Write fehlgeschlagen — nächster Aufruf übersetzt erneut.
  }

  return translation;
}
