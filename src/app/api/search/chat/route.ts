/**
 * Concierge-Chat — gemeinsam planen mit der KI (fn-19 Phase B).
 *
 * POST /api/search/chat
 * Body: { messages: [{role:'user'|'assistant', content}], locale?: 'de'|'en' }
 * Antwort: SSE-Stream — `text {delta}`, `entity {kind, card}`, `done {}`,
 * `error {message}` (gleiches Frame-Format wie /api/search/concierge).
 *
 * Architektur:
 * - STATELESS: der Verlauf kommt komplett vom Client (sessionStorage),
 *   hart gecappt via chat-validate.ts (12 Msgs, 600 Zeichen/User-Turn).
 * - Gemini 2.5 Flash mit Function-Calling: `search_events` und
 *   `search_activities` sind dünne Wrapper um runSmartSearch() — also
 *   exakt dieselbe Whitelist-validierte, indexierte Pipeline wie
 *   /api/search/semantic. Die KI hat KEINEN freien DB-Zugriff.
 * - Max 4 Tool-Runden, danach Zwangs-Antwort ohne Tools.
 * - Empfehlungen referenziert das Modell als [event:ID]/[activity:SLUG];
 *   der Server löst NUR gegen die Tool-Ergebnisse dieses Requests auf
 *   (Registry) und streamt die Karten als `entity`-Events — erfundene
 *   Referenzen fallen still weg. Kein Google-Grounding in v1: DB-only
 *   (externe Lokal-Tipps bleiben beim Einmal-Concierge).
 * - Kosten: 1 Chat-Turn = 1-5 Flash-Calls plus je 1 Intent-Call pro
 *   Tool-Aufruf (~0,02 Cent each). Eigenes Rate-Limit 6/min/IP
 *   zusätzlich zum globalen Middleware-Limit.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenAI, Type, type Content, type Part } from '@google/genai';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { runSmartSearch } from '@/lib/search/smart-search';
import { validateChatMessages, type ChatMessage } from '@/lib/search/chat-validate';
import { extractEntityRefs, stripEntityMarkers } from '@/lib/search/chat-entities';
import type { CandidateEvent } from '@/lib/search/smart-query';
import type { ActivitySearchMatch } from '@/lib/activities/public-types';
import type { ChatEventCard, ChatActivityCard } from '@/lib/search/chat-cards';

const CHAT_MODEL = 'gemini-2.5-flash';
const MAX_TOOL_ROUNDS = 4;
const CHAT_LIMIT_PER_MIN = 6;
/** Treffer pro Tool-Aufruf — klein halten, das Modell soll kuratieren. */
const TOOL_RESULT_LIMIT = 8;

function toEventCard(ev: CandidateEvent): ChatEventCard {
  // CandidateEvent deklariert nur die Ranking-Felder — die Zeilen tragen
  // physisch alle EVENT_COLS (title/start_date sind NOT NULL in der DB).
  const e = ev as CandidateEvent & {
    title?: string; start_date?: string;
    location_name?: string | null; bundesland?: string | null;
    category?: string | null; image_url?: string | null;
    price_text?: string | null; slug?: string | null;
    postal_code?: string | null; address?: string | null;
  };
  return {
    kind: 'event',
    id: String(e.id),
    title: e.title ?? '',
    start_date: e.start_date ?? '',
    location_name: e.location_name ?? null,
    bundesland: e.bundesland ?? null,
    category: e.category ?? null,
    image_url: e.image_url ?? null,
    price_text: e.price_text ?? null,
    slug: e.slug ?? null,
    postal_code: e.postal_code ?? null,
    address: e.address ?? null,
  };
}

function toActivityCard(a: ActivitySearchMatch): ChatActivityCard {
  const firstImage = Array.isArray(a.images)
    ? a.images.map(img => img?.urls?.[0]).find(u => typeof u === 'string' && u.length > 0) ?? null
    : null;
  return {
    kind: 'activity',
    id: a.id,
    slug: a.slug,
    name: a.name,
    town: a.town,
    bundesland: a.bundesland,
    setting: a.setting,
    price_hint: a.price_hint,
    image_url: firstImage,
  };
}

// ── Tools ────────────────────────────────────────────────────────────

const TOOL_DECLARATIONS = [
  {
    name: 'search_events',
    description:
      'Durchsucht die LassTreffen-Datenbank nach VERANSTALTUNGEN (Konzerte, Feste, Partys, Kultur, Sport …). Die Query ist Alltagssprache und darf Ort, Datum ("heute", "morgen", "wochenende" oder ein Wochentag wie "samstag") und Preis ("gratis", "billig") enthalten, z. B. "konzerte in wien am samstag" oder "gratis familienfest burgenland". Nenne IMMER das gewünschte Zeitfenster in der Query, wenn der User eines genannt hat.',
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING } },
      required: ['query'],
    },
  },
  {
    name: 'search_activities',
    description:
      'Durchsucht dauerhafte FREIZEIT-ZIELE ohne festen Termin (Thermen, Bäder, Museen, Sommerrodelbahnen, Klettersteige, Hochseilgärten). Query in Alltagssprache inkl. Ort — verwende KONKRETE Arten von Zielen (therme, museum, sommerrodelbahn, wandern, schwimmen, kletterpark, spielplatz), NIEMALS Oberbegriffe wie "ausflugsziel" oder "freizeitaktivität". Bei vagen Wünschen probiere 2 konkrete Arten, z. B. erst "therme salzburg", dann "museum salzburg".',
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING } },
      required: ['query'],
    },
  },
];

function buildSystemInstruction(locale: string): string {
  const lang = locale === 'en'
    ? 'Answer in English (the platform data itself is German — keep proper names as-is).'
    : 'Antworte auf Deutsch, freundlich-österreichisch, direkt.';
  return `Du bist der Concierge von LassTreffen.at und planst gemeinsam mit dem User Unternehmungen in Österreich — vom einzelnen Abend bis zum ganzen Tagesplan.

ARBEITSWEISE:
- Nutze für JEDE konkrete Empfehlung die Such-Tools (search_events für Veranstaltungen mit Termin, search_activities für dauerhafte Ausflugsziele). Rufe pro Antwort maximal 3 Suchen auf, formuliere die Tool-Query präzise (Ort + was + wann).
- Bei Nachfragen des Users ("eher indoor", "günstiger", "mit Kindern") verfeinere die vorige Suche mit einer NEUEN Tool-Query, die die Einschränkung enthält.
- RÜCKFRAGEN ZUERST bei breiten oder persönlichen Anfragen: Bei Date-Planung, Gruppen-/Familienausflügen oder vagen Wünschen ("was sollen wir machen", "plan mir was") suchst du NICHT sofort, sondern stellst zuerst 2-3 kurze, konkrete Rückfragen in EINER Nachricht — z. B. für wen ist es (Alter?), welche Interessen (Musik, Natur, Kulinarik, Action?), wann und wo, welches Budget. Alter und Interessen sind sehr verschieden — ein Date mit 20 sieht anders aus als mit 50. Erst wenn die Antworten da sind (oder der User schon alles genannt hat), suchst du. Frag NICHT in zwei aufeinanderfolgenden Antworten — nach einer Rückfragen-Runde wird gesucht, notfalls mit Annahmen.
- Wenn nur Ort oder Zeitraum fehlen, reicht EINE kurze Rückfrage.

STRIKTE REGELN:
1. Du darfst NIEMALS Veranstaltungen, Orte, Lokale oder Einrichtungen erfinden. Jede konkrete Empfehlung MUSS aus einem Tool-Ergebnis dieses Gesprächs stammen.
2. Markiere jede Empfehlung im Text mit ihrem marker aus dem Tool-Ergebnis (z. B. "… das Konzert im Stadtpark [event:abc-123] …"). Der Marker wird dem User als klickbare Karte angezeigt — nenne den Namen im Satz UND setze den Marker direkt dahinter.
3. Wenn die Tools nichts liefern, sag das ehrlich und schlag eine breitere Suche vor. Keine Ausweich-Erfindungen.
4. FORMAT: PLAIN TEXT, KEIN Markdown (keine **, #, Listen-Sternchen). Kurze Absätze mit Zeilenumbrüchen sind ok. Für einen Tagesplan gliedere mit Wörtern wie "Nachmittag:" / "Abend:".
5. Maximal 8 Sätze pro Antwort. ${lang}`;
}

// ── Route ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: 'Server misconfigured (no GEMINI_API_KEY)' }, { status: 503 });
  }

  const rl = checkRateLimit(`chat:${getClientIp(req.headers)}`, CHAT_LIMIT_PER_MIN, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) },
      },
    );
  }

  let body: { messages?: unknown; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const validated = validateChatMessages(body.messages);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const locale = body.locale === 'en' ? 'en' : 'de';

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  // Registry: NUR Entitäten aus Tool-Ergebnissen dieses Requests sind
  // referenzierbar — erfundene Marker laufen ins Leere.
  const eventRegistry = new Map<string, ChatEventCard>();
  const activityRegistry = new Map<string, ChatActivityCard>();

  async function execTool(name: string, args: Record<string, unknown> | undefined) {
    const query = String(args?.query ?? '').trim().slice(0, 300);
    if (!query) return { error: 'query fehlt' };
    try {
      if (name === 'search_events') {
        const r = await runSmartSearch(query, TOOL_RESULT_LIMIT, { forceContentTypes: ['event'] });
        const events = r.matches.slice(0, TOOL_RESULT_LIMIT).map(ev => {
          const card = toEventCard(ev);
          eventRegistry.set(card.id, card);
          return {
            marker: `[event:${card.id}]`,
            titel: card.title,
            datum: card.start_date,
            ort: [card.location_name, card.bundesland].filter(Boolean).join(', ') || null,
            preis: card.price_text,
            kategorie: card.category,
          };
        });
        return events.length > 0
          ? { events }
          : { events: [], hinweis: 'Keine Treffer. Breiter suchen (anderer Ort/Zeitraum) oder dem User ehrlich sagen, dass nichts dabei ist.' };
      }
      if (name === 'search_activities') {
        const r = await runSmartSearch(query, TOOL_RESULT_LIMIT, { forceContentTypes: ['activity'] });
        const activities = r.activityMatches.slice(0, TOOL_RESULT_LIMIT).map(a => {
          const card = toActivityCard(a);
          activityRegistry.set(card.slug, card);
          return {
            marker: `[activity:${card.slug}]`,
            name: card.name,
            ort: [card.town, card.bundesland].filter(Boolean).join(', ') || null,
            setting: card.setting,
            preis: card.price_hint,
          };
        });
        return activities.length > 0
          ? { activities }
          : { activities: [], hinweis: 'Keine Treffer. Breiter suchen oder dem User ehrlich sagen, dass nichts dabei ist.' };
      }
      return { error: `unbekanntes Tool ${name}` };
    } catch (e) {
      console.error('[chat] tool failed:', name, e);
      return { error: 'Suche derzeit nicht verfügbar' };
    }
  }

  const contents: Content[] = validated.messages.map((m: ChatMessage) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        let finalText: string | null = null;

        for (let round = 0; round < MAX_TOOL_ROUNDS && finalText === null; round++) {
          const resp = await ai.models.generateContent({
            model: CHAT_MODEL,
            contents,
            config: {
              systemInstruction: buildSystemInstruction(locale),
              tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
              thinkingConfig: { thinkingBudget: 0 },
              maxOutputTokens: 1200,
              temperature: 0.4,
            },
          });

          const calls = resp.functionCalls ?? [];
          if (calls.length === 0) {
            finalText = resp.text ?? '';
            break;
          }

          const modelContent = resp.candidates?.[0]?.content;
          if (modelContent) contents.push(modelContent);

          const responseParts: Part[] = [];
          // Max 3 Tool-Aufrufe pro Runde ausführen (Prompt sagt es dem
          // Modell; hier der harte Backstop).
          for (const call of calls.slice(0, 3)) {
            const result = await execTool(call.name ?? '', call.args as Record<string, unknown>);
            responseParts.push({
              functionResponse: { name: call.name ?? '', response: result as Record<string, unknown> },
            });
          }
          contents.push({ role: 'user', parts: responseParts });
        }

        if (finalText === null) {
          // Runden-Budget erschöpft → Zwangs-Antwort ohne Tools.
          const resp = await ai.models.generateContent({
            model: CHAT_MODEL,
            contents,
            config: {
              systemInstruction: buildSystemInstruction(locale),
              thinkingConfig: { thinkingBudget: 0 },
              maxOutputTokens: 1200,
              temperature: 0.4,
            },
          });
          finalText = resp.text ?? '';
        }

        if (!finalText.trim()) {
          send('error', { message: 'Keine Antwort vom Concierge.' });
          controller.close();
          return;
        }

        // Sichtbaren Text streamen (Marker raus), dann die referenzierten
        // Karten in Text-Reihenfolge, dann done.
        const visible = stripEntityMarkers(finalText);
        const words = visible.split(/(\s+)/);
        const CHUNK = 6;
        for (let i = 0; i < words.length; i += CHUNK) {
          send('text', { delta: words.slice(i, i + CHUNK).join('') });
        }

        for (const ref of extractEntityRefs(finalText)) {
          const card = ref.kind === 'event'
            ? eventRegistry.get(ref.ref)
            : activityRegistry.get(ref.ref);
          if (card) send('entity', { kind: card.kind, card });
        }

        send('done', {});
      } catch (e) {
        console.error('[chat] failed:', e);
        send('error', { message: 'Concierge-Chat derzeit nicht verfügbar.' });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
