/**
 * /api/search/concierge — AI-Concierge für Smart-Suche.
 *
 * Nimmt die User-Anfrage + Top-Matches aus /api/search/semantic und
 * generiert eine 2-3-sätzige Concierge-Antwort. Optional mit Web-Suche
 * (über OpenAI Responses API `web_search_preview` Tool) wenn die Anfrage
 * lokale Tipps verlangt und unsere Treffer eher mau sind.
 *
 * Halluzinations-Guards:
 *  - LLM darf nur Events/Venues namentlich nennen, die wir mitgeben
 *    oder die das web_search-Tool mit Zitat zurückliefert.
 *  - System-Prompt ist explizit: keine erfundenen Bars/Restaurants.
 *  - Citations werden mit zurückgegeben → Frontend zeigt sie sichtbar
 *    als „Quellen".
 *
 * Cost:
 *  - LLM (gpt-4o-mini) ~ 500 in + 200 out tokens = ~$0.0002
 *  - Web-Search (wenn ausgelöst) ~$0.025 pro Aufruf
 *  - Wir triggern Web-Search NUR wenn count <= 5 (sparse results)
 *    UND die parsed query lokale Signale enthält (location/date).
 *
 * Schemata:
 *  - POST body: { query, parsed?, matches?, count?, scopeLabel? }
 *  - Antwort: Server-Sent-Events-Stream mit deltas: "text", "citations", "done"
 */

import { NextResponse, type NextRequest } from 'next/server';
import OpenAI from 'openai';

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
  count?: number;
  scopeLabel?: string;
}

const SYSTEM_PROMPT = `Du bist ein lokaler Concierge für Veranstaltungen in Österreich auf der Plattform LassTreffen.at.

Aufgabe: Schreibe eine SEHR kurze, hilfreiche Antwort (max. 3 Sätze, deutsch, freundlich-österreichisch) auf die User-Suche. Berücksichtige Datum, Ort und Vibe der Anfrage.

Strikte Regeln:
1. Du darfst NUR Events/Venues namentlich erwähnen, die in der mitgelieferten "Treffer"-Liste stehen ODER die das web_search-Tool mit Quelle zurückliefert. Erfinde NIE Bars, Cafés, Restaurants oder Veranstaltungsorte.
2. Erkenne wenn nichts Passendes für den exakten Zeitpunkt da ist (z.B. "heute") und sage das ehrlich — schlag dann die zeitlich nächsten Treffer aus der Liste vor.
3. Wenn die Treffer thematisch danebenliegen, sag das auch — kein Hochjubeln.
4. Tipps zu Stadtteil/Atmosphäre sind erlaubt, aber bleib allgemein ("in der Eisenstädter Hauptgasse ist abends mehr los") außer du hast eine Web-Source mit konkretem Namen.
5. Kein Marketing-Sprech, keine Floskeln. Direkt, lakonisch, hilfreich.

Web-Suche: Nutze das web_search-Tool höchstens 1× pro Antwort, und NUR wenn die Treffer aus unserer Datenbank thematisch oder örtlich nicht passen UND die User-Anfrage nach lokalen Tipps verlangt (z.B. "wo kann ich heute günstig fortgehen in X").`;

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
  } else {
    parts.push('');
    parts.push('(Keine Treffer in unserer Datenbank.)');
  }

  return parts.join('\n');
}

/**
 * Web-Search NUR ausführen wenn:
 *  - Treffer ≤ 5 (Liste ist sparse), UND
 *  - User-Query hat lokale/temporale Spezifik (Ort/Zeit) — heuristisch über
 *    parsed.signals oder Substring-Matching auf typische Ort-Wörter.
 *
 * Damit vermeiden wir teure Tool-Calls für „Konzerte" o.ä. wo wir
 * eh genug Treffer haben.
 */
function shouldUseWebSearch(body: ConciergeBody): boolean {
  const count = body.count ?? 0;
  if (count > 5) return false;
  const q = body.query.toLowerCase();
  const hasLocationHint = /\b(in|bei|nähe|nahe|um)\s+\w/.test(q) ||
    /\b(wien|graz|linz|salzburg|innsbruck|klagenfurt|eisenstadt|st\.?\s*pölten|bregenz|villach|wels|leoben|kapfenberg|baden|krems|amstetten|burgenland|kärnten|tirol|steiermark|niederösterreich|oberösterreich|vorarlberg)\b/.test(q);
  return hasLocationHint;
}

export async function POST(req: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'Server misconfigured (no OPENAI_API_KEY)' }, { status: 503 });
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

  const client = new OpenAI({ apiKey: openaiKey });
  const useWebSearch = shouldUseWebSearch(body);
  const userPrompt = buildUserPrompt(body);

  // Streaming via Server-Sent-Events. Wir wrappen den OpenAI-Stream in
  // ein einfaches eigenes SSE-Format damit das Frontend nur deltas +
  // citations + done-Event verarbeiten muss.
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const response = await client.responses.create({
          model: 'gpt-4o-mini',
          input: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          ...(useWebSearch
            ? { tools: [{ type: 'web_search_preview' as const }] }
            : {}),
          stream: true,
        });

        const citations: Array<{ url: string; title: string | null }> = [];

        for await (const event of response) {
          // OpenAI Responses streaming events:
          //  - response.output_text.delta  → token streaming
          //  - response.output_item.added  → tool calls, citations
          //  - response.completed          → final wrap
          // Schema variiert leicht nach SDK-Version — wir robust-greppen
          // nach den relevanten Feldern.
          const eventAny = event as unknown as Record<string, unknown>;
          const type = eventAny.type as string | undefined;

          if (type === 'response.output_text.delta') {
            const delta = eventAny.delta as string | undefined;
            if (delta) send('text', { delta });
          } else if (type === 'response.output_item.added' || type === 'response.output_item.done') {
            // Citation-extraction — wenn das Output-Item Annotations mit
            // URL-Citations enthält, sammeln wir sie für den done-Event.
            const item = eventAny.item as Record<string, unknown> | undefined;
            if (item && Array.isArray(item.annotations)) {
              for (const a of item.annotations as Array<Record<string, unknown>>) {
                if (a.type === 'url_citation' && typeof a.url === 'string') {
                  citations.push({ url: a.url, title: (a.title as string | null) ?? null });
                }
              }
            }
          }
        }

        send('done', { citations });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (process.env.NODE_ENV === 'development') {
          console.error('[concierge] error:', err);
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
