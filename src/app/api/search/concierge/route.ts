/**
 * /api/search/concierge — AI-Concierge für Smart-Suche (Phase 4.7).
 *
 * Wechsel von OpenAI Responses + Bing-backed web_search auf
 * **Google Gemini 2.5 Flash + Grounding with Google Search**.
 *
 * Warum: OpenAI's web_search_preview Tool nutzt Microsoft Bing als
 * Such-Backend. Für österreichische Lokal-Coverage (Bars in Eisenstadt,
 * Heurigen im Burgenland, etc.) ist Bing deutlich schwächer als Google.
 * Gemini Grounding ist die gleiche Engine die auch Google's AI Overviews
 * antreibt — selbe Suchindex-Qualität, sauber per API.
 *
 * Halluzinations-Guards:
 *  - LLM darf nur Events/Venues namentlich nennen, die wir mitgeben
 *    oder die das Grounding-Tool mit Quelle zurückliefert.
 *  - System-Prompt verbietet erfundene Namen jeder Art (auch Straßen,
 *    Stadtteile, Viertel).
 *  - Citations aus `groundingMetadata.groundingChunks` werden mit
 *    gestreamt → Frontend zeigt sie als „Quellen".
 *
 * Cost (Gemini 2.5 Flash mit Dynamic Retrieval):
 *  - Input: $0.075 / 1M tokens
 *  - Output: $0.30 / 1M tokens
 *  - Grounded calls: $7 / 1000 Anfragen (nur wenn Tool feuert)
 *  - Per Concierge-Call mit Grounding: ~$0.007 + token cost ~$0.0002 = $0.0072
 *  - Without grounding: nur $0.0002
 *  - Bei 10k Suchen/Monat mit ~50% grounding rate: ~$35/Monat
 *
 * Schemata bleiben unverändert (SSE-Format wie vorher):
 *  - POST body: { query, parsed?, matches?, count?, scopeLabel? }
 *  - Antwort: SSE-Stream mit deltas: "text", "done" (mit citations[]),
 *    "error"
 */

import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/** fn-19: Der Concierge ist der teuerste Call der Plattform (~0,7 Cent
 *  pro grounded Antwort) — deshalb ein eigenes, strengeres Limit
 *  ZUSÄTZLICH zum globalen Middleware-Limit (30 POST/min/IP). 10/min
 *  reicht für echte Nutzung locker, deckelt aber Bots und Bug-Loops. */
const CONCIERGE_LIMIT_PER_MIN = 10;

// Match-Subset der /api/search/semantic SearchMatch-Type — wir brauchen
// nur title/location/category/start_date/_similarity für den Prompt.
interface ConciergeMatch {
  title: string;
  location_name: string | null;
  category: string | null;
  start_date: string;
  bundesland: string | null;
  price_text: string | null;
  _similarity: number;
}

interface ConciergeActivity {
  name: string;
  town: string | null;
  bundesland: string | null;
  setting: 'indoor' | 'outdoor' | 'mixed' | null;
  tags: string[];
}

interface ConciergeBody {
  query: string;
  parsed?: {
    embedded_text?: string;
    after_date?: string | null;
    before_date?: string | null;
    max_price_tier?: string | null;
    signals?: string[];
  };
  matches?: ConciergeMatch[];
  /**
   * fn-18.6: Freizeit-POIs aus dem Aktivitaets-Pfad der Smart-Suche.
   * `count`/`matches` sind event-only — ohne diese Liste wuerde der
   * Prompt bei activity-only-Antworten "(Keine Treffer …)" behaupten.
   */
  activityMatches?: ConciergeActivity[];
  count?: number;
  scopeLabel?: string;
}

const SYSTEM_PROMPT = `Du bist ein lokaler Concierge für Veranstaltungen in Österreich auf der Plattform LassTreffen.at.

Format (STRIKT):
- PLAIN TEXT, KEIN Markdown. Keine ##-Überschriften, KEINE [text](url)-Syntax, keine Aufzählungssternchen.
- Wenn du mehrere Tipps gibst: nutze einfache Zeilenumbrüche, jeder Tipp = 1 Zeile mit Bar-Name + Kurzbeschreibung.
- KEINE URLs im Fließtext. Quellen-Links werden separat unter deiner Antwort als "Quellen"-Liste angezeigt, da brauchst du nichts beizutragen. Schreib nur die Lokal-Namen mit Beschreibung, OHNE https://... oder vertexaisearch-Links.
- 4-6 Sätze maximal. Deutsch, freundlich-österreichisch, direkt.

Strikte Regeln gegen Halluzination:
1. Du darfst NIEMALS Eigennamen erfinden — keine Bars, Cafés, Restaurants, Clubs, Lokale, Straßennamen, Plätze, Stadtteile, Viertel, Veranstaltungsorte oder Marken. NIEMALS.
2. Eigennamen dürfen nur erscheinen, wenn sie ENTWEDER in der mitgelieferten "Treffer"-Liste stehen ODER aus der Google-Suche (Grounding) mit Quelle kommen.
3. Wenn dir konkrete Eigennamen fehlen: bleib generisch ("frag deine Studi-Kollegen welche Bar gerade gut ist"). KEIN erfundener Name.

Inhalt:
4. Wenn die Google-Suche mehrere Lokale findet, gib 2-4 davon (nicht nur einen) mit kurzer Begründung warum jeder passt.
5. Erkenne wenn nichts Passendes für den exakten Zeitpunkt da ist (z.B. "heute") und sage das ehrlich — schlag dann die zeitlich nächsten Treffer aus der Liste vor.
6. Wenn die Treffer thematisch danebenliegen, sag das auch — kein Hochjubeln.
7. Kein Marketing-Sprech, keine Floskeln. Direkt, lakonisch, hilfreich.

Google-Suche (PFLICHT wenn die User-Anfrage einen Stadtnamen enthält ODER nach Bars/Lokalen/Atmosphäre fragt): Such mit konkreten Begriffen wie "günstige Studentenbar [Stadt]" oder "Happy Hour [Stadt]". Verwende die gefundenen Lokal-Namen mit Quelle.`;

function buildUserPrompt(body: ConciergeBody): string {
  const parts: string[] = [];
  parts.push(`User-Suche: "${body.query}"`);
  if (body.parsed?.signals && body.parsed.signals.length > 0) {
    parts.push(`Erkannte Signale: ${body.parsed.signals.join(', ')}`);
  }
  if (body.parsed?.after_date || body.parsed?.before_date) {
    parts.push(`Zeitraum: ${body.parsed.after_date ?? '?'} bis ${body.parsed.before_date ?? '?'}`);
  }
  if (body.scopeLabel) {
    parts.push(`Aktueller Scope: ${body.scopeLabel}`);
  }
  parts.push(`Anzahl Treffer in unserer Datenbank: ${body.count ?? 0}`);

  const matches = body.matches ?? [];
  const activities = body.activityMatches ?? [];
  if (matches.length > 0) {
    parts.push('');
    parts.push('Top-Treffer (sortiert nach Relevanz):');
    matches.slice(0, 5).forEach((m, i) => {
      const date = new Date(m.start_date).toLocaleDateString('de-AT', {
        weekday: 'short', day: 'numeric', month: 'short',
      });
      const loc = [m.location_name, m.bundesland].filter(Boolean).join(' · ');
      parts.push(`${i + 1}. "${m.title}" — ${date}${loc ? ' · ' + loc : ''}${m.category ? ' · [' + m.category + ']' : ''}${m.price_text ? ' · ' + m.price_text : ''} (Relevanz ${(m._similarity * 100).toFixed(0)}%)`);
    });
  } else if (activities.length === 0) {
    parts.push('');
    parts.push('(Keine Treffer in unserer Datenbank.)');
  } else {
    parts.push('');
    parts.push('(Keine VERANSTALTUNGEN in unserer Datenbank — dafuer die Freizeit-Ziele unten.)');
  }

  if (activities.length > 0) {
    parts.push('');
    parts.push(`Passende Freizeit-Ziele (Orte ohne fixen Termin, ganzjaehrig; Anzahl: ${activities.length}):`);
    activities.slice(0, 5).forEach((a, i) => {
      const loc = [a.town, a.bundesland].filter(Boolean).join(' · ');
      const setting = a.setting ? ` · ${a.setting}` : '';
      const tags = a.tags.length > 0 ? ` · [${a.tags.slice(0, 3).join(', ')}]` : '';
      parts.push(`${i + 1}. "${a.name}"${loc ? ' — ' + loc : ''}${setting}${tags}`);
    });
    parts.push('Diese Freizeit-Ziele sind echte Treffer aus unserer Datenbank — behandle sie wie die Event-Treffer und sag NICHT, es gaebe nichts.');
  }

  return parts.join('\n');
}

/**
 * Google-Search-Tool wird grundsätzlich aktiviert. Gemini's Dynamic
 * Retrieval entscheidet selbst pro Anfrage ob es tatsächlich sucht —
 * Cost-Optimierung ohne harte Trigger-Heuristik clientseitig.
 *
 * Heuristisch geben wir dem Modell zusätzlich einen Hinweis im
 * User-Prompt, wenn die Anfrage stark nach lokalen Tipps verlangt
 * (Bar/Club/Stadt-Erwähnung), damit es nicht aus Geiz das Tool skippt.
 */
function hasStrongLocalSignal(body: ConciergeBody): boolean {
  const q = body.query.toLowerCase();
  const hasLocationHint = /\b(in|bei|nähe|nahe|um)\s+\w/.test(q) ||
    /\b(wien|graz|linz|salzburg|innsbruck|klagenfurt|eisenstadt|st\.?\s*pölten|bregenz|villach|wels|leoben|kapfenberg|baden|krems|amstetten|burgenland|kärnten|tirol|steiermark|niederösterreich|oberösterreich|vorarlberg)\b/.test(q);
  const wantsLocalTip = /\b(bar|club|lokal|kneipe|disco|caf[eé]|pub|happy hour|fortgehen|saufen|trinken|date|romantisch|gemütlich)\b/.test(q);
  return hasLocationHint || wantsLocalTip;
}

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: 'Server misconfigured (no GEMINI_API_KEY)' }, { status: 503 });
  }

  const rl = checkRateLimit(`concierge:${getClientIp(req.headers)}`, CONCIERGE_LIMIT_PER_MIN, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) },
      },
    );
  }

  let body: ConciergeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.query?.trim()) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }
  if (body.query.length > 500) {
    return NextResponse.json({ error: 'query too long (max 500 chars)' }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const userPrompt = buildUserPrompt(body);
  const localHint = hasStrongLocalSignal(body)
    ? '\n\n[Hinweis: Diese Anfrage verlangt vermutlich nach lokalen Lokal-Tipps. Bitte aktiv Google-Suche nutzen.]'
    : '';

  // Streaming via Server-Sent-Events. Wir wandeln den Gemini-Stream in
  // unser eigenes SSE-Format (text deltas + done event mit citations).
  // Frontend (V4ConciergeCard) konsumiert das gleiche Format wie vorher
  // mit OpenAI — keine Frontend-Änderung nötig.
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const response = await ai.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents: userPrompt + localHint,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ googleSearch: {} }],
            // Wir wollen kurze direkte Antworten — kein Reasoning nötig.
            // Default hat Gemini 2.5 Flash thinking-Tokens AN, die vom
            // maxOutputTokens-Budget abgezogen werden BEVOR sichtbarer
            // Text gestreamt wird. Bei 600 token und ~500 thinking-token
            // verbrauchen war der Output mid-sentence abgewürgt.
            // thinkingBudget=0 schaltet's komplett ab.
            thinkingConfig: { thinkingBudget: 0 },
            maxOutputTokens: 1500,
            temperature: 0.4,
          },
        });

        let groundingChunks: Array<{ web?: { uri?: string; title?: string } }> | undefined;
        let finishReason: string | undefined;

        for await (const chunk of response) {
          // Gemini-streaming chunks tragen entweder text-deltas, function-calls
          // oder grounding-Metadata. Wir greppen defensiv.
          const text = chunk.text;
          if (text) {
            send('text', { delta: text });
          }
          const candidate = chunk.candidates?.[0];
          const meta = candidate?.groundingMetadata;
          if (meta?.groundingChunks) {
            // Letzter Chunk gewinnt — Gemini liefert die Grounding-Liste
            // typischerweise im finalen Chunk.
            groundingChunks = meta.groundingChunks as typeof groundingChunks;
          }
          if (candidate?.finishReason) {
            finishReason = candidate.finishReason as string;
          }
        }

        // Wenn das Modell wegen MAX_TOKENS abgewürgt wurde, in Dev loggen.
        // SAFETY/RECITATION-Reasons ebenfalls hilfreich für Debugging.
        if (process.env.NODE_ENV === 'development' && finishReason && finishReason !== 'STOP') {
          console.warn('[concierge/gemini] unusual finishReason:', finishReason);
        }

        const citations: Array<{ url: string; title: string | null }> = [];
        if (groundingChunks) {
          for (const gc of groundingChunks) {
            const url = gc.web?.uri;
            if (typeof url === 'string') {
              citations.push({ url, title: gc.web?.title ?? null });
            }
          }
        }

        send('done', { citations });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (process.env.NODE_ENV === 'development') {
          console.error('[concierge/gemini] error:', err);
        }
        send('error', { message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
