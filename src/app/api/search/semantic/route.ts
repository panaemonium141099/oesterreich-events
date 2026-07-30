/**
 * Natural-language smart event search.
 *
 * POST /api/search/semantic
 * Body: { query: string, limit?: number }
 *
 * 2026-07 Rewrite (MASTERPLAN §6) — KI pro QUERY statt pro Event:
 *   1. Regex-Parser zieht harte Filter (Datum, Preis, Ort) aus der Anfrage
 *   2. EIN Gemini-2.5-Flash-Call übersetzt den Rest in unsere Taxonomie
 *      (Kategorien/Tags/Audiences/Occasions/Vibes + freie Suchbegriffe)
 *      — hart Whitelist-validiert gegen enrichment-taxonomy.ts
 *   3. Parallele indexierte DB-Queries (Kategorie / Facetten-Overlap /
 *      ilike-Textsuche) holen Kandidaten
 *   4. Deterministisches Ranking (smart-query.ts) → top-N
 *
 * Die alte pgvector/Embedding-Variante (OpenAI-Embedding pro Event,
 * 1,22-GB-Index bei 50 Nutzungen, Datenbasis seit April stale) wurde
 * entfernt — Spalte + Index + RPC sind gedroppt.
 *
 * Response-Shape ist ADDITIV erweitert (fn-18.6): { query, parsed,
 * matches, count, activityMatches }. `matches`/`count` bleiben
 * event-only — Consumer, die `activityMatches` nicht kennen, brechen
 * nicht. Wer einen Empty-State rendert, MUSS aber
 * `matches.length > 0 || activityMatches.length > 0` prüfen.
 *
 * fn-18.6 (Epic E9) — zweiter, additiver Retrieval-Pfad für
 * Freizeit-POIs (`poi_activities`):
 *   - `intent.contentTypes` (['event'] | ['activity'] | beides) gated die
 *     Pfade. Enthält es kein 'event', wird fetchCandidates INKLUSIVE
 *     Top-Score-Fallback GAR NICHT aufgerufen und matches bleibt [].
 *   - Der Aktivitäts-Pfad läuft über die SQL-RPC `search_activities`
 *     (indexgestütztes trgm-Ranking auf `name`), NICHT über PostgREST.
 *   - Ort und contentTypes werden DETERMINISTISCH bestimmt
 *     (detectGemeindeInQuery / detectActivityIntent) — das LLM ist nur
 *     Ergänzung, damit die Aktivitäts-Suche auch ohne Gemini funktioniert.
 * Der Event-Pfad (fetchCandidates/baseQuery/SCORE_ORDER/rankCandidates)
 * ist unverändert, inklusive der Future-only-Invariante auf start_date.
 *
 * Degradation: ohne GEMINI_API_KEY (oder bei Gemini-Fehler/-Timeout)
 * läuft die Suche rein deterministisch weiter (Regex-Filter + Volltext
 * über die Wörter der Query) — schlechter, aber nie kaputt.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  parseQuery,
  validateIntent,
  intentHasNoFacets,
  rankCandidates,
  detectActivityIntent,
  detectGemeindeInQuery,
  extractActivitySearchTerm,
  rankActivityCandidates,
  emptySearchIntent,
  isBundeslandId,
  CITIES,
  BUNDESLAENDER_KEYS,
  CONTENT_TYPES,
  DEFAULT_ACTIVITY_RADIUS_KM,
  type DetectedLocation,
  type DetectedGemeinde,
  type SearchIntent,
  type ContentType,
  type CandidateEvent,
  type ActivityCandidate,
} from '@/lib/search/smart-query';
import type { ActivitySearchMatch, PublicActivityImage } from '@/lib/activities/public-types';
import {
  PRIMARY_CATEGORIES,
  TAGS,
  AUDIENCES,
  VIBES,
  OCCASIONS,
} from '@/lib/category-classifier/enrichment-taxonomy';

const INTENT_MODEL = 'gemini-2.5-flash';
/** Kandidaten pro Retrieval-Pfad — klein genug für die Micro-Instanz,
 *  groß genug dass das Ranking echte Auswahl hat. */
const CANDIDATES_PER_PATH = 60;
/** POI-Shortlist aus der RPC (vor dem Description-Sekundär-Scoring). */
const ACTIVITY_SHORTLIST = 24;
/** Wie viele POIs maximal in `activityMatches` landen. */
const ACTIVITY_RESULT_LIMIT = 8;

const EVENT_COLS =
  'id, title, description, start_date, end_date, location_name, postal_code, address, district, bundesland, latitude, longitude, category, tags, image_url, price_text, price_tier, slug, audience, vibe, occasion_tags, is_student_friendly, is_family_friendly, duration_type, event_score';

// ────────────────────────────────────────────────────────────────────
// Intent-Extraktion — ein Gemini-Call pro Suche (~0,02 Cent), ersetzt
// sowohl das Query-Embedding als auch den separaten Location-AI-Call
// der alten Route. Whitelist-Guard: validateIntent() verwirft alles,
// was nicht wörtlich im Taxonomie-Vokabular steht.
// ────────────────────────────────────────────────────────────────────

async function extractIntentViaAI(
  query: string,
  intentText: string,
  geminiKey: string,
): Promise<SearchIntent | null> {
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const locationVocab = [
    ...new Set([...Object.keys(CITIES), ...Object.keys(BUNDESLAENDER_KEYS)]),
  ].join(', ');
  const systemInstruction =
`Du übersetzt eine österreichische Freizeit-Suchanfrage in strukturierte Facetten. Die Datenbank enthält ZWEI Bestände: Veranstaltungen (events) und dauerhafte Freizeit-Ziele/POIs (activities: Bäder, Thermen, Sommerrodelbahnen, Klettersteige, Hochseilgärten, Museen, Aussichtstürme, Erlebniswege …).

Erlaubte categories (max 3, exakte Schreibweise): ${PRIMARY_CATEGORIES.join(' | ')}
Erlaubte tags (max 8): ${TAGS.join(', ')}
Erlaubte audiences (max 3): ${AUDIENCES.join(', ')}
Erlaubte occasions (max 3): ${OCCASIONS.join(', ')}
Erlaubte vibes (max 3): ${VIBES.join(', ')}
Erlaubte contentTypes: ${CONTENT_TYPES.join(', ')}
Erlaubte locations (Städte/Bundesländer): ${locationVocab}

Regeln:
- Wähle NUR Werte aus den Listen oben, in exakt dieser Schreibweise. Nichts erfinden.
- contentTypes: ["event"] wenn nach Veranstaltungen/Terminen gefragt wird (Default). ["activity"] wenn nach einem ORT/einer Einrichtung gefragt wird, die dauerhaft existiert — "wo kann ich mountaincart fahren", "was tun bei Regen in Graz", "Ausflugsziel mit Kindern", "Therme in der Nähe". Beides, wenn wirklich beides gemeint sein kann.
- searchTerms: 1-4 konkrete Suchwörter für die Volltextsuche (Künstler, Genre, Eventart, POI-Art) — NUR wenn die Anfrage konkrete Begriffe enthält, die über die Facetten hinausgehen (z.B. Band-Name, "Flohmarkt", "Krampuslauf", "Mountaincart", "Hochseilgarten"). Allgemeine Wörter wie "Event", "etwas", "cool" weglassen.
- location: erwähnter Ort als EIN Wert aus der Location-Liste (Tippfehler korrigieren: "eisenstad" → eisenstadt, "burgnland" → burgenland). Kein Ort erwähnt oder unbekannt → null.
- Interpretiere Absichten: "saufen gehen" → Nightlife & Party + ausgehen; "was mit Kindern" → Familie & Kinder + family-Tags; "romantisch" → date-night.
- Lieber wenige treffende Facetten als viele lose.`;

  try {
    const resp = await ai.models.generateContent({
      model: INTENT_MODEL,
      contents: `Suchanfrage: "${query}"\nKern-Intent (Datum/Preis-Wörter bereits entfernt): "${intentText}"`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categories: { type: Type.ARRAY, items: { type: Type.STRING } },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            audiences: { type: Type.ARRAY, items: { type: Type.STRING } },
            occasions: { type: Type.ARRAY, items: { type: Type.STRING } },
            vibes: { type: Type.ARRAY, items: { type: Type.STRING } },
            searchTerms: { type: Type.ARRAY, items: { type: Type.STRING } },
            location: { type: Type.STRING, nullable: true },
            contentTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 400,
        temperature: 0,
      },
    });
    const text = resp.text;
    if (!text) return null;
    return validateIntent(JSON.parse(text));
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.error('[smart-search/intent]', e);
    return null;
  }
}

/** Intent-Location (String vom LLM) → DetectedLocation via Whitelist. */
function resolveIntentLocation(loc: string | null): DetectedLocation | null {
  if (!loc) return null;
  if (CITIES[loc]) return CITIES[loc];
  if (BUNDESLAENDER_KEYS[loc]) return { districts: null, bundesland: BUNDESLAENDER_KEYS[loc] };
  return null;
}

// ────────────────────────────────────────────────────────────────────
// Kandidaten-Retrieval — normale indexierte Queries statt pgvector
// ────────────────────────────────────────────────────────────────────

interface HardFilters {
  afterIso: string;
  beforeIso: string | null;
  districts: string[] | null;
  bundesland: string | null;
  priceTiers: string[] | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function baseQuery(supabase: SupabaseClient<any>, hard: HardFilters) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from('events') as any)
    .select(EVENT_COLS)
    .eq('visibility', 'public')
    .in('publish_status', ['published', 'published_low_confidence'])
    .gte('start_date', hard.afterIso);
  if (hard.beforeIso) q = q.lte('start_date', hard.beforeIso);
  // bundesland IMMER mitfiltern, auch wenn districts gesetzt sind: auf
  // district existiert kein Index — ohne den bundesland-Filter walkt der
  // Planner alle ~90k Zukunfts-Events (gemessen: statement timeout bei
  // "konzert in graz"). MIT bundesland nutzt er den Composite-Index
  // idx_events_bundesland_start_date und district wird zum billigen
  // Restfilter über wenige tausend Zeilen. Trade-off: Events mit
  // korrektem district aber NULL-bundesland fallen raus (~100/Stadt) —
  // behoben durch die Bundesland-Normalisierung in MASTERPLAN §10.4.
  // .in() quotet Werte mit Leerzeichen/Klammern ('graz (stadt)') sicher.
  if (hard.bundesland) q = q.eq('bundesland', hard.bundesland);
  if (hard.districts) q = q.in('district', hard.districts);
  if (hard.priceTiers) q = q.in('price_tier', hard.priceTiers);
  return q;
}

/**
 * Ergebnis eines PostgREST-Aufrufs entpacken: Fehler LOGGEN statt still
 * zu schlucken (ein fehlgeschlagener Pfad soll die anderen nicht killen,
 * aber sichtbar sein), dann data oder [].
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function takeData(r: any, label: string): CandidateEvent[] {
  if (r?.error) console.error(`[smart-search] ${label} failed:`, r.error);
  return (r?.data ?? []) as CandidateEvent[];
}

/**
 * WICHTIG zur Sortierung (empirisch gemessen, 2026-07-07):
 * `event_score DESC NULLS LAST` — und das `nullsFirst:false` ist hier
 * KEIN Versehen, sondern der Kern des Plans: es bricht absichtlich die
 * Sortier-Richtung des Index `idx_events_score_desc` (DESC NULLS FIRST),
 * damit der Planner ihn NICHT für einen "index-ordered scan with filter"
 * wählt. Beide index-kompatiblen Varianten (Score-Index-Walk sowie
 * ORDER BY start_date über den Datums-Index) sind auf der Micro-Instanz
 * live in den 8s-Statement-Timeout gelaufen (Code 57014), weil der
 * Planner dabei die ganze Tabelle in Index-Reihenfolge walkt und jede
 * Zeile gegen die selektiven Filter prüft. Mit gebrochener Richtung
 * nimmt er stattdessen Bitmap-Scans über die selektiven Filter
 * (bundesland/district + start_date + ilike) und macht einen billigen
 * Top-60-Sort über wenige tausend Rest-Zeilen — gemessen: Millisekunden.
 * NICHT "optimieren", ohne mit EXPLAIN auf Produktionsdaten zu messen.
 */
const SCORE_ORDER = { ascending: false, nullsFirst: false } as const;

async function fetchCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  hard: HardFilters,
  intent: SearchIntent,
): Promise<CandidateEvent[]> {
  const paths: Array<Promise<CandidateEvent[]>> = [];

  // Pfad A: Kategorie-Treffer, zeitlich nächste zuerst
  if (intent.categories.length > 0) {
    paths.push(
      baseQuery(supabase, hard)
        .in('category', intent.categories)
        .order('event_score', SCORE_ORDER)
        .limit(CANDIDATES_PER_PATH)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((r: any) => takeData(r, 'path-category')),
    );
  }

  // Pfad B: Facetten-Overlap (tags / occasions / audiences / vibes) in
  // EINER Query via or(...ov...). Alle Facetten-Werte sind kebab-case
  // aus der Taxonomie-Whitelist — keine Sonderzeichen, kein Injection-
  // Risiko in der or-Syntax.
  const ovParts: string[] = [];
  if (intent.tags.length > 0) ovParts.push(`tags.ov.{${intent.tags.join(',')}}`);
  if (intent.occasions.length > 0) ovParts.push(`occasion_tags.ov.{${intent.occasions.join(',')}}`);
  if (intent.audiences.length > 0) ovParts.push(`audience.ov.{${intent.audiences.join(',')}}`);
  if (intent.vibes.length > 0) ovParts.push(`vibe.ov.{${intent.vibes.join(',')}}`);
  if (ovParts.length > 0) {
    paths.push(
      baseQuery(supabase, hard)
        .or(ovParts.join(','))
        .order('event_score', SCORE_ORDER)
        .limit(CANDIDATES_PER_PATH)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((r: any) => takeData(r, 'path-facets')),
    );
  }

  // Pfad C: Volltext als ilike-Klauseln INNERHALB der gefilterten Query.
  // Bewusst NICHT die search_event_ids-RPC: die cappt global auf 250 ids
  // BEVOR Orts-/Datumsfilter greifen — bei "konzert in wien" enthielt der
  // Cap dann 0 Wien-Events (Kandidaten-Pool-Overshoot; dasselbe Problem
  // hatte die alte pgvector-Route dokumentiert und in der RPC gelöst).
  // Hier drehen wir es um: harte Filter zuerst (bundesland+start_date
  // Indizes), pro Suchbegriff eine AND-verknüpfte or(ilike)-Klausel.
  // searchTerms sind via validateIntent() zeichensicher (keine %,(),{}
  // — kein Injection- oder Pattern-Risiko in or-Syntax/ilike).
  if (intent.searchTerms.length > 0) {
    let q = baseQuery(supabase, hard);
    for (const term of intent.searchTerms.slice(0, 4)) {
      q = q.or(`title.ilike.%${term}%,location_name.ilike.%${term}%,category.ilike.%${term}%`);
    }
    paths.push(
      q
        .order('event_score', SCORE_ORDER)
        .limit(CANDIDATES_PER_PATH)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((r: any) =>
          takeData(r, 'path-text').map(ev => ({ ...ev, _textHit: true })),
        ),
    );
  }

  // Fallback: gar kein Signal → zeitlich nächste Events im Filter-Fenster,
  // damit der User nie eine leere Seite ohne Grund sieht (der Concierge
  // ordnet das Ergebnis ein).
  if (paths.length === 0) {
    paths.push(
      baseQuery(supabase, hard)
        .order('event_score', SCORE_ORDER)
        .limit(CANDIDATES_PER_PATH)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((r: any) => takeData(r, 'path-nextup')),
    );
  }

  const settled = await Promise.all(paths);
  return settled.flat();
}

// ────────────────────────────────────────────────────────────────────
// fn-18.6 — Aktivitäts-Pfad (poi_activities), komplett NEBEN dem
// Event-Pfad. Kein gemeinsamer Query-Builder, kein Datumsfilter (POIs
// haben kein Datum), eigene Fehlerbehandlung: ein toter Aktivitäts-Pfad
// darf die Event-Ergebnisse nie mitreißen.
// ────────────────────────────────────────────────────────────────────

interface ActivityFilters {
  /** trgm-Suchbegriff für `name`; null → Filter-only-Zweig der RPC. */
  searchTerm: string | null;
  /** Deterministischer Regen-Filter (Task-1-Feld, keine freie Tag-Deutung). */
  setting: 'indoor' | null;
  bundesland: string | null;
  gemeinde: DetectedGemeinde | null;
  tags: string[];
}

async function fetchActivityMatches(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  filters: ActivityFilters,
  intent: SearchIntent,
): Promise<ActivitySearchMatch[]> {
  const radiusKm = filters.gemeinde?.radiusKm ?? DEFAULT_ACTIVITY_RADIUS_KM;
  const { data, error } = await supabase.rpc('search_activities', {
    q: filters.searchTerm,
    tag_filter: filters.tags.length > 0 ? filters.tags : null,
    setting_filter: filters.setting,
    bundesland_filter: filters.bundesland,
    center_lat: filters.gemeinde?.lat ?? null,
    center_lng: filters.gemeinde?.lng ?? null,
    radius_km: filters.gemeinde ? radiusKm : null,
    max_results: ACTIVITY_SHORTLIST,
  });
  if (error) {
    console.error('[smart-search] search_activities failed:', error);
    return [];
  }

  const rows = (data ?? []) as ActivityCandidate[];
  // Sekundär-Scoring über die Description passiert HIER, auf der bereits
  // geladenen Shortlist — es gibt bewusst keinen description-Index.
  const ranked = rankActivityCandidates(
    rows, intent, filters.searchTerm, ACTIVITY_RESULT_LIMIT, radiusKm,
  );

  return ranked.map(a => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    description_short: a.description_short,
    tags: a.tags ?? [],
    setting: a.setting,
    town: a.town,
    gemeinde_slug: a.gemeinde_slug,
    bundesland: a.bundesland,
    images: (a.images as PublicActivityImage[] | null) ?? null,
    price_hint: a.price_hint,
    online_bookable: a.online_bookable,
    distance_km: a.distance_km,
    _similarity: a._similarity,
  }));
}

// ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Anon-Key-Fallback für lokale Dev-Setups ohne Service-Key: die Route
  // liest ohnehin nur published+public Events, mit Anon-Key greift
  // zusätzlich RLS — strikt sicherer, nur ggf. weniger Treffer.
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
  }

  let body: { query?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const rawQuery = (body.query ?? '').trim();
  if (!rawQuery) return NextResponse.json({ error: 'query required' }, { status: 400 });
  if (rawQuery.length > 500) {
    return NextResponse.json({ error: 'query too long (max 500 chars)' }, { status: 400 });
  }
  const limit = Math.min(Math.max(1, body.limit ?? 20), 50);

  // 1. Regex-Pass: Datum, Preis, Ort (schneller deterministischer Pfad)
  const { text: intentText, filters } = parseQuery(rawQuery);

  // 1b. Deterministische Aktivitäts-Signale + Gemeinde — laufen VOR dem
  //     Pfad-Gating und unabhängig vom LLM (Pflicht, Epic E9: sonst
  //     landen Aktivitäts-Queries im No-AI-Fallback doch im Event-Pfad).
  const activitySignals = detectActivityIntent(rawQuery);
  const gemeinde = detectGemeindeInQuery(rawQuery);

  // 2. Intent via Gemini (ersetzt Embedding + separaten Location-Call).
  //    4s-Timeout: eine hängende Gemini-API darf die Suche nicht bis zum
  //    Function-Timeout blockieren — nach Ablauf degradiert die Route in
  //    den deterministischen Volltext-Fallback.
  const geminiKey = process.env.GEMINI_API_KEY;
  let intent: SearchIntent | null = geminiKey
    ? await Promise.race([
        extractIntentViaAI(rawQuery, intentText, geminiKey),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
      ])
    : null;
  let intentSource: 'ai' | 'fallback' = 'ai';

  // 2b. Pfad-Gating (Epic E9). Deterministik gewinnt — gleiche Politik wie
  //     beim Ort. `activityOnly` heißt: Event-Retrieval inkl.
  //     Top-Score-Fallback wird gar nicht erst aufgerufen.
  if (intent) {
    if (activitySignals.activityOnly) {
      intent.contentTypes = ['activity'];
    } else if (activitySignals.isActivity && !intent.contentTypes.includes('activity')) {
      intent.contentTypes = [...intent.contentTypes, 'activity'];
    }
  }

  if (!intent) {
    intentSource = 'fallback';
    intent = emptySearchIntent();
    intent.contentTypes = activitySignals.activityOnly
      ? ['activity']
      : activitySignals.isActivity
        ? ['event', 'activity']
        : ['event'];
  }
  // Deterministischer Text-Fallback: die Wörter des gestrippten
  // Intent-Texts gehen als AND-verknüpfte Suchbegriffe in die
  // ilike-Suche (max 2, je ≥3 Zeichen, ohne Stoppwörter — jedes Wort
  // ist ein Pflicht-Match, zu viele Wörter würgen das Ergebnis).
  // Bedingung ist bewusst intentHasNoFacets() und NICHT intentIsEmpty():
  // sonst verlöre eine Event-Query mit Aktivitäts-Vokabular ("wandern in
  // tirol") ihre Suchbegriffe, nur weil contentTypes 'activity' enthält.
  if (intentHasNoFacets(intent) && intentText.length >= 3) {
    const STOPWORDS = new Set([
      'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem',
      'mit', 'für', 'auf', 'was', 'wer', 'wie', 'ist', 'gibt', 'geht', 'gehen', 'etwas',
      'abend', 'abends', 'bin', 'the', 'and',
    ]);
    intent.searchTerms = intentText
      .split(/\s+/)
      .map(w => w.replace(/[^\p{L}\p{N}'&.-]/gu, ''))
      .filter(w => w.length >= 3 && !STOPWORDS.has(w.toLowerCase()))
      .slice(0, 2);
  }
  if (intentSource === 'ai') filters.keywordSignals.push('intent:ai');
  intent.categories.forEach(c => filters.keywordSignals.push(`category:${c}`));
  intent.tags.forEach(t => filters.keywordSignals.push(`tag:${t}`));
  intent.audiences.forEach(a => filters.keywordSignals.push(`audience:${a}`));
  intent.occasions.forEach(o => filters.keywordSignals.push(`occasion:${o}`));

  // Ort: Regex gewinnt (deterministisch); AI ergänzt nur bei Regex-Miss
  // (Tippfehler-Fälle) — Whitelist-Guard via resolveIntentLocation.
  if (!filters.location) {
    const aiLoc = resolveIntentLocation(intent.location);
    if (aiLoc) {
      filters.location = aiLoc;
      if (aiLoc.districts) filters.keywordSignals.push(`location:district:${aiLoc.districts.join('|')}:ai`);
      if (aiLoc.bundesland) filters.keywordSignals.push(`location:bundesland:${aiLoc.bundesland}:ai`);
    }
  }

  // 3. Kandidaten holen (parallel, indexierte Queries)
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  // Future-only: nie past events durchsuchen. Default = heute 00:00.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hard: HardFilters = {
    afterIso: (filters.afterDate ?? today).toISOString(),
    beforeIso: filters.beforeDate?.toISOString() ?? null,
    districts: filters.location?.districts ?? null,
    bundesland: filters.location?.bundesland ?? null,
    priceTiers:
      filters.maxPriceTier === 'gratis' ? ['gratis']
      : filters.maxPriceTier === 'günstig' ? ['gratis', 'günstig']
      : null,
  };

  // 3b. Aktivitäts-Filter (deterministisch, LLM nur ergänzend).
  //     Bundesland: NUR kanonische IDs aus der SoT BUNDESLAND_IDS —
  //     `poi_activities.bundesland` trägt exakt diese lowercase-Werte.
  const locBundesland = filters.location?.bundesland ?? null;
  const activityBundesland: string | null =
    gemeinde?.bundesland ?? (isBundeslandId(locBundesland) ? locBundesland : null);
  const activityRestText = gemeinde?.restText ?? intentText;
  const activityFilters: ActivityFilters = {
    searchTerm: extractActivitySearchTerm(activityRestText, intent.searchTerms),
    setting: activitySignals.indoor ? 'indoor' : null,
    // Ohne Ortsbezug wäre ein reiner Bundesland-Filter zu grob nur dann,
    // wenn gar kein Bundesland erkannt wurde — dann bleibt er null.
    bundesland: gemeinde ? null : activityBundesland,
    gemeinde,
    tags: intent.tags,
  };
  const wantEvents = intent.contentTypes.includes('event');
  const wantActivities = intent.contentTypes.includes('activity');
  if (wantActivities) filters.keywordSignals.push('content:activity');
  if (gemeinde) filters.keywordSignals.push(`location:gemeinde:${gemeinde.slug}`);
  if (activityFilters.setting) filters.keywordSignals.push(`setting:${activityFilters.setting}`);

  // 3c. Retrieval. Beide Pfade parallel, aber JEDER nur wenn sein
  //     contentType gesetzt ist — bei ['activity'] wird fetchCandidates
  //     (inkl. Top-Score-Fallback) nachweislich nicht aufgerufen.
  let candidates: CandidateEvent[] = [];
  let activityMatches: ActivitySearchMatch[] = [];
  try {
    const [ev, act] = await Promise.all([
      wantEvents ? fetchCandidates(supabase, hard, intent) : Promise.resolve([]),
      wantActivities
        ? fetchActivityMatches(supabase, activityFilters, intent)
        : Promise.resolve([] as ActivitySearchMatch[]),
    ]);
    candidates = ev;
    activityMatches = act;
  } catch (e) {
    console.error('[smart-search] candidate fetch failed:', e);
    return NextResponse.json({ error: 'search unavailable' }, { status: 503 });
  }

  // 4. Ranken + Response. `matches`/`count` bleiben event-only (alter
  //    Contract), `activityMatches` ist additiv.
  const ranked = wantEvents ? rankCandidates(candidates, intent, limit) : [];

  return NextResponse.json({
    query: rawQuery,
    parsed: {
      // Key heißt aus UI-Kompat-Gründen weiterhin embedded_text —
      // inhaltlich ist es der extrahierte Kern-Intent-Text.
      embedded_text: intentText,
      after_date: filters.afterDate?.toISOString() ?? null,
      before_date: filters.beforeDate?.toISOString() ?? null,
      max_price_tier: filters.maxPriceTier,
      signals: filters.keywordSignals,
      location_district: filters.location?.districts?.join(',') ?? null,
      location_bundesland: filters.location?.bundesland ?? null,
      content_types: intent.contentTypes as ContentType[],
    },
    matches: ranked,
    count: ranked.length,
    activityMatches,
  });
}
