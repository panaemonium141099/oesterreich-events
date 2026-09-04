/**
 * Übersetzung der Freizeit-POI-Beschreibungen (DE → EN, fn-17).
 *
 * Warum nur die Beschreibung: POI-Namen sind Eigennamen ("Tennisplatz
 * Stumm", "Seeschloss Ort") und bleiben in beiden Sprachen gleich. Der
 * Fließtext ist dagegen das, was `/aktivitaet/<slug>` überhaupt
 * indexierbar macht — das E7-Gate in `activities/indexability.ts`
 * verlangt ≥ 200 Zeichen Beschreibung (oder Bild + Öffnungszeiten).
 * Solange `description_en` fehlt, rendert `/en/aktivitaet/<slug>`
 * deutschen Text und kanonisiert auf die DE-URL.
 *
 * Der Name geht trotzdem als Kontext in den Prompt: "Freibad Neusiedl"
 * über einem Text sagt dem Modell, worum es geht, und verhindert
 * Fehlgriffe bei mehrdeutigen Begriffen ("Bad", "Hütte", "Alm").
 */

import { Type } from '@google/genai';
import { generateJsonWithRetry, type TranslateOptions } from './gemini-json';

const MODEL = 'gemini-2.5-flash';

/**
 * Input-Deckel. Deskline-Texte sind im Schnitt 548 Zeichen, der längste
 * Ausreißer liegt weit darüber; 6000 fängt praktisch alles ab, ohne dass
 * ein einzelner POI das Output-Budget sprengt.
 */
const MAX_DESC_CHARS = 6000;

/**
 * Großzügiger als bei Events (4096): POI-Texte sind länger und in sich
 * geschlossen — eine abgeschnittene Beschreibung wäre auf der Seite
 * sichtbar, nicht nur im Snippet.
 */
const MAX_OUTPUT_TOKENS = 6144;

const SYSTEM_INSTRUCTION =
`You translate descriptions of Austrian leisure destinations (museums, pools, castles, hiking areas, thermal baths, viewpoints) from German to natural English for a travel-and-events website.

Rules:
- Keep proper nouns unchanged: the name of the destination itself, place names, mountain and lake names, operator and brand names.
- Translate faithfully — do NOT add, embellish or omit information. No marketing language that is not in the source.
- Keep the original paragraph and line-break structure.
- Convert nothing: prices, opening hours, distances and altitudes stay exactly as written.
- Austrian terms without an English equivalent may keep the German word with a short gloss on first use, e.g. "Alm (mountain pasture)", "Heuriger (wine tavern)".
- description_en: the full translation. Return nothing else.`;

export interface ActivityTranslationInput {
  name: string;
  description: string | null;
}

function parseTranslation(text: string | undefined): { description_en: string } | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { description_en?: unknown };
    const value =
      typeof parsed.description_en === 'string' && parsed.description_en.trim()
        ? parsed.description_en.trim()
        : null;
    return value ? { description_en: value } : null;
  } catch {
    return null;
  }
}

/**
 * Übersetzt EINE POI-Beschreibung. `null` = Fehlschlag; der Aufrufer
 * lässt die Zeile dann unübersetzt stehen und der nächste Lauf versucht
 * es erneut.
 */
export async function translateActivityDescription(
  input: ActivityTranslationInput,
  apiKey: string,
  options: TranslateOptions = {},
): Promise<string | null> {
  const desc = input.description?.trim();
  if (!desc) return null;

  const result = await generateJsonWithRetry(
    apiKey,
    {
      model: MODEL,
      contents: `Name: ${input.name}\n\nBeschreibung:\n${desc.slice(0, MAX_DESC_CHARS)}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { description_en: { type: Type.STRING } },
          required: ['description_en'],
        },
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0,
      },
    },
    parseTranslation,
    options,
  );

  return result?.description_en ?? null;
}
