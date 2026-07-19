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

async function translateViaGemini(
  title: string,
  description: string | null,
  apiKey: string,
): Promise<EventTranslation | null> {
  const ai = new GoogleGenAI({ apiKey });
  const desc = description ? description.slice(0, MAX_DESC_CHARS) : null;

  const systemInstruction =
`You translate Austrian event listings from German to natural English for an event-discovery website.

Rules:
- Keep proper nouns unchanged: venue names, band/artist names, place names (Gemeinde/city names), festival brand names. "Heuriger"/"Kirtag" may be kept with a short English gloss on first use, e.g. "Kirtag (traditional fair)".
- Translate faithfully — do NOT add, embellish or omit information. No marketing language that is not in the source.
- Keep the original paragraph/line-break structure of the description.
- title_en: concise translated title. If the title is a proper name that needs no translation, return it unchanged.
- description_en: full translation of the description. If no description is provided, return null.`;

  const contents = desc
    ? `Titel: ${title}\n\nBeschreibung:\n${desc}`
    : `Titel: ${title}\n\n(keine Beschreibung vorhanden)`;

  const resp = await withTimeout(
    ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title_en: { type: Type.STRING },
            description_en: { type: Type.STRING, nullable: true },
          },
        },
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 2048,
        temperature: 0,
      },
    }),
    TIMEOUT_MS,
  );

  const text = resp?.text;
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
