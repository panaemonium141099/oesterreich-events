/**
 * smart-query — pure Logik der Smart-Suche (/api/search/semantic).
 *
 * 2026-07 Rewrite (MASTERPLAN §6): Die alte Implementierung hat pro EVENT
 * ein OpenAI-Embedding gespeichert (1,6 GB TOAST + 1,22 GB pgvector-Index
 * auf einer 256-MB-Instanz, Datenbasis seit April stale). Die neue
 * Architektur versteht stattdessen die ANFRAGE (ein Gemini-Call pro Suche,
 * Kosten ~0,02 Cent) und übersetzt sie in unsere deterministische
 * Taxonomie — gematcht wird dann live in der DB über normale Indizes.
 * KI pro Query statt KI pro Event: nie stale, kein Ballast, Kosten
 * skalieren mit Suchvolumen statt mit Datenbestand.
 *
 * Dieses Modul enthält NUR pure, testbare Funktionen (kein IO):
 *   - parseQuery()             — Regex-Pass: Datum, Preis, Ort
 *   - validateIntent()         — Whitelist-Guard für die Gemini-Antwort
 *   - rankCandidates()         — deterministisches Relevanz-Scoring
 *   - detectActivityIntent()   — LLM-freier Aktivitäts-Klassifikator (fn-18.6)
 *   - detectGemeindeInQuery()  — LLM-freier Gemeinde-Extractor (fn-18.6)
 *   - rankActivityCandidates() — Ranking der POI-Shortlist (fn-18.6)
 *
 * EINZIGE Ausnahme vom "kein IO"-Grundsatz: `ALL_GEMEINDEN` (Gemeinde-
 * Registry) liest beim Modul-Init JSON von der Platte. Das Modul ist
 * server-only (nur /api/search/semantic + Tests importieren es) — der
 * Gemeinde-Extractor braucht die 2.028 Registry-Einträge, weil die
 * kuratierte CITIES-Map nur ~20 Städte kennt.
 */

import {
  PRIMARY_CATEGORIES,
  TAGS,
  AUDIENCES,
  VIBES,
  OCCASIONS,
} from '@/lib/category-classifier/enrichment-taxonomy';
import { ALL_GEMEINDEN } from '@/lib/gemeinden/data';
import { getCityHub } from '@/lib/hubs/city-hubs';
import { bundeslandToId } from '@/lib/bundeslaender';
import { TOPIC_WHITELIST } from '@/lib/activities/taxonomy';

// ────────────────────────────────────────────────────────────────────
// Ort-Erkennung (unverändert aus der alten Route übernommen)
// ────────────────────────────────────────────────────────────────────

/**
 * DetectedLocation — was wir aus der Query extrahieren um das Result-Set
 * hart zu filtern.
 *
 *   `districts`   — events.district-Werte (Bezirks-Ebene!) die zur
 *                   genannten Stadt gehören. Städte matchen bewusst
 *                   Stadt + Umland ("graz" → 'graz (stadt)' +
 *                   'graz-umgebung'), weil User das so meinen. Wenn nur
 *                   ein Bundesland erwähnt wurde, bleibt das `null`.
 *   `bundesland`  — Bundesland-ID der `events.bundesland` matched
 *                   (z.B. `burgenland`).
 */
export interface DetectedLocation {
  districts: string[] | null;
  bundesland: string | null;
}

/**
 * Stadt-Keyword → canonical {districts, bundesland}.
 *
 * ACHTUNG Werte-Format: `events.district` enthält BEZIRKS-Namen im
 * Statistik-Austria-Stil — 'graz (stadt)', 'graz-umgebung',
 * 'wiener neustadt (stadt)' … (2026-07-07 live aus der DB gemessen;
 * die alte Map mit Stadt-Slugs wie 'graz' matchte 0 Zeilen).
 * Wien ist Sonderfall: Bezirke 1-23 sind zu granular — Filter greift
 * nur auf Bundesland-Ebene.
 */
export const CITIES: Record<string, DetectedLocation> = {
  eisenstadt:        { districts: ['eisenstadt'],                                        bundesland: 'burgenland' },
  mattersburg:       { districts: ['mattersburg'],                                       bundesland: 'burgenland' },
  graz:              { districts: ['graz (stadt)', 'graz-umgebung'],                     bundesland: 'steiermark' },
  leoben:            { districts: ['leoben'],                                            bundesland: 'steiermark' },
  kapfenberg:        { districts: ['bruck-mürzzuschlag'],                                bundesland: 'steiermark' },
  linz:              { districts: ['linz (stadt)', 'linz-land'],                         bundesland: 'oberoesterreich' },
  wels:              { districts: ['wels (stadt)', 'wels-land'],                         bundesland: 'oberoesterreich' },
  steyr:             { districts: ['steyr (stadt)', 'steyr-land'],                       bundesland: 'oberoesterreich' },
  innsbruck:         { districts: ['innsbruck (stadt)', 'innsbruck-land'],               bundesland: 'tirol' },
  kufstein:          { districts: ['kufstein'],                                          bundesland: 'tirol' },
  bregenz:           { districts: ['bregenz'],                                           bundesland: 'vorarlberg' },
  dornbirn:          { districts: ['dornbirn'],                                          bundesland: 'vorarlberg' },
  klagenfurt:        { districts: ['klagenfurt (stadt)', 'klagenfurt-land'],             bundesland: 'kaernten' },
  villach:           { districts: ['villach (stadt)', 'villach-land'],                   bundesland: 'kaernten' },
  salzburg:          { districts: ['salzburg (stadt)', 'salzburg-umgebung'],             bundesland: 'salzburg' },
  krems:             { districts: ['krems (stadt)', 'krems (land)'],                     bundesland: 'niederoesterreich' },
  wienerneustadt:    { districts: ['wiener neustadt (stadt)', 'wiener neustadt (land)'], bundesland: 'niederoesterreich' },
  'wiener neustadt': { districts: ['wiener neustadt (stadt)', 'wiener neustadt (land)'], bundesland: 'niederoesterreich' },
  baden:             { districts: ['baden'],                                             bundesland: 'niederoesterreich' },
  amstetten:         { districts: ['amstetten'],                                         bundesland: 'niederoesterreich' },
  'st pölten':       { districts: ['st. pölten (stadt)', 'st. pölten (land)'],           bundesland: 'niederoesterreich' },
  'sankt pölten':    { districts: ['st. pölten (stadt)', 'st. pölten (land)'],           bundesland: 'niederoesterreich' },
  wien:              { districts: null,                                                  bundesland: 'wien' },
  vienna:            { districts: null,                                                  bundesland: 'wien' },
};

/**
 * Source-of-Truth der 9 kanonischen Bundesland-IDs (fn-18.6).
 *
 * Exakt die `id`-Werte aus `src/lib/bundeslaender.ts` (ohne die
 * Pseudo-Scopes 'all'/'at-de-ch') und identisch mit den lowercase-Werten
 * in `events.bundesland` UND `poi_activities.bundesland`. Jede
 * Bundesland-Whitelist der Smart-Suche wird hieraus gespeist — vorher
 * war die Inline-Map unvollständig (salzburg/wien fehlten).
 */
export const BUNDESLAND_IDS = [
  'burgenland',
  'kaernten',
  'niederoesterreich',
  'oberoesterreich',
  'salzburg',
  'steiermark',
  'tirol',
  'vorarlberg',
  'wien',
] as const;

export type BundeslandId = (typeof BUNDESLAND_IDS)[number];

const BUNDESLAND_ID_SET: ReadonlySet<string> = new Set<string>(BUNDESLAND_IDS);

/** Ist der String eine der 9 kanonischen Bundesland-IDs? */
export function isBundeslandId(v: string | null | undefined): v is BundeslandId {
  return typeof v === 'string' && BUNDESLAND_ID_SET.has(v);
}

/**
 * Bundesland-Keyword → canonical Bundesland-ID (Umlaut-tolerant).
 *
 * Aus BUNDESLAND_IDS erzeugt + Umlaut-Schreibweisen als Aliase.
 * ACHTUNG Reihenfolge-Invariante: `detectLocationRegex` prüft CITIES
 * ZUERST — 'salzburg' und 'wien' matchen deshalb weiterhin auf ihren
 * Stadt-Eintrag (districts gesetzt bzw. Wien-Sonderfall), obwohl sie
 * jetzt auch hier stehen. Das Event-Verhalten bleibt damit identisch.
 */
export const BUNDESLAENDER_KEYS: Record<string, string> = {
  ...Object.fromEntries(BUNDESLAND_IDS.map(id => [id, id])),
  niederösterreich: 'niederoesterreich',
  oberösterreich: 'oberoesterreich',
  kärnten: 'kaernten',
};

export function detectLocationRegex(q: string): DetectedLocation | null {
  const lower = q.toLowerCase();
  // Stadt zuerst (spezifischer) — dadurch matched "eisenstadt" auf
  // {district:'eisenstadt'} statt nur auf burgenland.
  for (const [key, loc] of Object.entries(CITIES)) {
    const re = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(lower)) return loc;
  }
  for (const [key, bl] of Object.entries(BUNDESLAENDER_KEYS)) {
    const re = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(lower)) return { districts: null, bundesland: bl };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────
// Query-Parser (Datum/Preis unverändert aus der alten Route)
// ────────────────────────────────────────────────────────────────────

export interface ParsedFilters {
  afterDate: Date | null;
  beforeDate: Date | null;
  maxPriceTier: 'gratis' | 'günstig' | 'mittel' | null;
  keywordSignals: string[];
  location: DetectedLocation | null;
}

export function parseQuery(raw: string, now: Date = new Date()): { text: string; filters: ParsedFilters } {
  const q = raw.toLowerCase();
  const signals: string[] = [];
  const location = detectLocationRegex(raw);
  const filters: ParsedFilters = {
    afterDate: null,
    beforeDate: null,
    maxPriceTier: null,
    keywordSignals: signals,
    location,
  };
  if (location?.districts) signals.push(`location:district:${location.districts.join('|')}`);
  if (location?.bundesland) signals.push(`location:bundesland:${location.bundesland}`);

  // ─── Date signals ───
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const endOfTomorrow = new Date(endOfToday); endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  if (/\b(heute|tonight|today)\b/.test(q)) {
    filters.afterDate = startOfToday;
    filters.beforeDate = endOfToday;
    signals.push('today');
  } else if (/\b(morgen|tomorrow)\b/.test(q)) {
    filters.afterDate = startOfTomorrow;
    filters.beforeDate = endOfTomorrow;
    signals.push('tomorrow');
  } else if (/\b(wochenende|weekend)\b/.test(q)) {
    const day = now.getDay(); // 0 = Sun, 6 = Sat
    if (day === 0) {
      // Sonntag: "am Wochenende" meint das LAUFENDE Wochenende — Fenster
      // ist der heutige Sonntag. ((6-0+7)%7 = 6 würde sonst aufs nächste
      // Wochenende springen und den heutigen Abend wegfiltern.)
      filters.afterDate = startOfToday;
      filters.beforeDate = endOfToday;
    } else {
      // Mo–Sa: nächstes (bzw. am Samstag: laufendes) Sa–So-Fenster.
      const daysToSat = (6 - day + 7) % 7;
      const sat = new Date(startOfToday);
      sat.setDate(sat.getDate() + daysToSat);
      const sun = new Date(sat);
      sun.setDate(sun.getDate() + 1);
      sun.setHours(23, 59, 59, 999);
      filters.afterDate = sat;
      filters.beforeDate = sun;
    }
    signals.push('weekend');
  }

  // ─── Price signals ───
  if (/\b(gratis|kostenlos|free|umsonst)\b/.test(q)) {
    filters.maxPriceTier = 'gratis';
    signals.push('price:gratis');
  } else if (/\b(billig|günstig|cheap|sparsam|kleines budget|unter 20|unter 10|unter 15)\b/.test(q)) {
    filters.maxPriceTier = 'günstig';
    signals.push('price:günstig');
  }

  // Erkannte Datum/Preis/Orts-/Füll-Wörter aus dem Intent-Text strippen,
  // damit die Intent-Extraktion (und vor allem der deterministische
  // Volltext-Fallback) sich auf die eigentliche Aktivität konzentriert.
  // WICHTIG: Ortswörter MÜSSEN raus — der Ort wird bereits als harter
  // Filter (district/bundesland) angewendet; bliebe "wien" im Suchtext,
  // würde die Wort-UND-Semantik der search_event_ids-RPC zusätzlich
  // "wien" im Titel/Ort verlangen und das Ergebnis leer würgen.
  let stripped = raw;
  const stripPatterns = [
    /\b(heute|tonight|today|morgen|tomorrow|dieses wochenende|am wochenende|weekend)\b/gi,
    /\b(gratis|kostenlos|free|umsonst|billig|günstig|cheap)\b/gi,
    /\b(ich bin|ich will|ich möchte|ich suche|suche|will|möchte)\b/gi,
    /\b(in|im|bei|nähe|nahe|rund um|um|nach|aus)\b/gi,
  ];
  for (const re of stripPatterns) stripped = stripped.replace(re, ' ');
  if (location) {
    for (const key of [...Object.keys(CITIES), ...Object.keys(BUNDESLAENDER_KEYS)]) {
      stripped = stripped.replace(new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'gi'), ' ');
    }
  }
  stripped = stripped.replace(/\s+/g, ' ').trim();

  // Bewusst KEIN `|| raw`-Fallback: wenn die Query nur aus Datum/Preis/
  // Ort bestand ("heute in wien"), ist der Kern-Intent leer — die Route
  // nimmt dann den No-Signal-Pfad (nächste Events im Filter-Fenster).
  // `|| raw` würde die gerade entfernten Wörter als Pflicht-Suchbegriffe
  // reinjizieren ("%heute%" AND "%wien%") und das Ergebnis leeren.
  return { text: stripped, filters };
}

// ────────────────────────────────────────────────────────────────────
// Intent — die Gemini-Antwort, hart gegen die Taxonomie validiert
// ────────────────────────────────────────────────────────────────────

/**
 * Welche Bestände die Query meint (fn-18.6, Epic E9).
 *   'event'    — Veranstaltungen (`events`)
 *   'activity' — Freizeit-POIs (`poi_activities`)
 */
export type ContentType = 'event' | 'activity';

export const CONTENT_TYPES: readonly ContentType[] = ['event', 'activity'];

/** Normalisierter Default: eine leere/unbekannte Angabe heißt IMMER Events. */
export const DEFAULT_CONTENT_TYPES: readonly ContentType[] = ['event'];

export interface SearchIntent {
  categories: string[];   // ⊆ PRIMARY_CATEGORIES
  tags: string[];         // ⊆ TAGS
  audiences: string[];    // ⊆ AUDIENCES
  occasions: string[];    // ⊆ OCCASIONS
  vibes: string[];        // ⊆ VIBES
  searchTerms: string[];  // freie Suchbegriffe für die Textsuche (trgm)
  location: string | null; // Kandidat für CITIES/BUNDESLAENDER_KEYS-Lookup
  /**
   * Nicht-leer, dedupliziert, ⊆ CONTENT_TYPES. Nach validateIntent() NIE
   * `[]` — fehlendes/leeres/unbekanntes Feld wird auf ['event']
   * normalisiert, damit die Pfad-Gating-Logik in der Route nie ein leeres
   * Array sieht (kein Drift für Bestandsqueries).
   */
  contentTypes: ContentType[];
}

/** Leerer Intent im normalisierten Default-Zustand (Events). */
export function emptySearchIntent(): SearchIntent {
  return {
    categories: [], tags: [], audiences: [], occasions: [], vibes: [],
    searchTerms: [], location: null, contentTypes: ['event'],
  };
}

const CATEGORY_SET = new Set<string>(PRIMARY_CATEGORIES);
const TAG_SET = new Set<string>(TAGS);
const AUDIENCE_SET = new Set<string>(AUDIENCES);
const OCCASION_SET = new Set<string>(OCCASIONS);
const VIBE_SET = new Set<string>(VIBES);
const CONTENT_TYPE_SET = new Set<string>(CONTENT_TYPES);

function cleanList(raw: unknown, allow: Set<string>, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (allow.has(t) && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Whitelist-Guard für die LLM-Antwort: alles was nicht wörtlich in
 * unseren Vokabularen steht wird verworfen (verhindert Halluzinationen,
 * die als DB-Filter durchsickern). searchTerms werden nur längen- und
 * zeichenbegrenzt (sie landen ausschließlich im trgm-RPC, nie in
 * Filter-Klauseln).
 */
export function validateIntent(raw: unknown): SearchIntent {
  if (raw === null || typeof raw !== 'object') return emptySearchIntent();
  const o = raw as Record<string, unknown>;

  // contentTypes: Whitelist + Normalisierung. Feld fehlt / [] / nur
  // unbekannte Werte → IMMER ['event'] (siehe SearchIntent-Doku).
  const contentTypes = cleanList(o.contentTypes, CONTENT_TYPE_SET, 2) as ContentType[];
  if (contentTypes.length === 0) contentTypes.push('event');

  const searchTerms: string[] = [];
  if (Array.isArray(o.searchTerms)) {
    for (const v of o.searchTerms) {
      if (typeof v !== 'string') continue;
      const t = v.trim().slice(0, 60).replace(/[^\p{L}\p{N}\s'&.-]/gu, '');
      if (t.length >= 2 && !searchTerms.includes(t)) searchTerms.push(t);
      if (searchTerms.length >= 6) break;
    }
  }

  const location =
    typeof o.location === 'string' && o.location.trim().length > 0
      ? o.location.trim().toLowerCase()
      : null;

  return {
    categories: cleanList(o.categories, CATEGORY_SET, 3),
    tags: cleanList(o.tags, TAG_SET, 8),
    audiences: cleanList(o.audiences, AUDIENCE_SET, 3),
    occasions: cleanList(o.occasions, OCCASION_SET, 3),
    vibes: cleanList(o.vibes, VIBE_SET, 3),
    searchTerms,
    location,
    contentTypes,
  };
}

/** Weicht contentTypes vom Default ['event'] ab? (= eigenes Match-Signal) */
export function hasNonDefaultContentTypes(i: SearchIntent): boolean {
  return i.contentTypes.length !== 1 || i.contentTypes[0] !== 'event';
}

/**
 * Kein einziges FACETTEN-/Text-Signal (contentTypes bewusst ignoriert).
 *
 * Das ist die Bedingung für den deterministischen Keyword-Fallback der
 * Route: eine Event-Query mit Aktivitäts-Vokabular ("wandern in tirol")
 * bekommt dadurch ihre Suchbegriffe auch dann, wenn contentTypes wegen
 * des Aktivitäts-Signals bereits vom Default abweicht.
 */
export function intentHasNoFacets(i: SearchIntent): boolean {
  return (
    i.categories.length === 0 && i.tags.length === 0 && i.audiences.length === 0 &&
    i.occasions.length === 0 && i.vibes.length === 0 && i.searchTerms.length === 0
  );
}

/**
 * Ist überhaupt ein Match-Signal vorhanden? (Sonst Fallback: top-Score.)
 *
 * fn-18.6/E9: non-default contentTypes zählen als Signal. "was tun bei
 * Regen in Graz" liefert keine Facetten und keine searchTerms, ist aber
 * eine vollwertige Aktivitäts-Query — ohne diese Klausel wäre sie für
 * die Route "signallos".
 */
export function intentIsEmpty(i: SearchIntent): boolean {
  if (hasNonDefaultContentTypes(i)) return false;
  return intentHasNoFacets(i);
}

// ────────────────────────────────────────────────────────────────────
// Ranking — deterministisch, dokumentierte Gewichte
// ────────────────────────────────────────────────────────────────────

export interface CandidateEvent {
  id: string;
  category: string | null;
  tags: string[] | null;
  audience: string[] | null;
  vibe: string[] | null;
  occasion_tags: string[] | null;
  event_score: number | null;
  /** true wenn das Event über die Textsuche (trgm-RPC) gefunden wurde */
  _textHit?: boolean;
}

function overlapCount(a: string[] | null, b: string[]): number {
  if (!a || a.length === 0 || b.length === 0) return 0;
  const set = new Set(a);
  let n = 0;
  for (const x of b) if (set.has(x)) n++;
  return n;
}

/**
 * Relevanz 0..1. Gewichte: Kategorie-Treffer und Text-Treffer sind die
 * stärksten Signale; Tag-/Facetten-Überlappung differenziert innerhalb
 * der Kategorie; event_score (0..100) bricht Gleichstände in Richtung
 * Qualität. Die Skala ist bewusst so gebaut, dass ein Event mit
 * Kategorie- UND Text-Treffer >70 % anzeigt — das deckt sich mit dem
 * "Relevanz X%"-Label im UI.
 */
export function scoreCandidate(ev: CandidateEvent, intent: SearchIntent): number {
  let s = 0;
  if (ev.category && intent.categories.includes(ev.category)) s += 0.35;
  if (ev._textHit) s += 0.35;

  const tagHits = overlapCount(ev.tags, intent.tags);
  s += Math.min(tagHits, 3) * 0.08;                       // max 0.24

  s += Math.min(overlapCount(ev.audience, intent.audiences), 2) * 0.06;      // max 0.12
  s += Math.min(overlapCount(ev.occasion_tags, intent.occasions), 2) * 0.06; // max 0.12
  s += Math.min(overlapCount(ev.vibe, intent.vibes), 2) * 0.04;              // max 0.08

  // Qualitäts-Tiebreaker: max +0.08
  s += Math.max(0, Math.min(100, ev.event_score ?? 0)) / 100 * 0.08;

  return Math.min(0.99, s);
}

/** Dedupe (per id), score, sort desc, cap. */
export function rankCandidates<T extends CandidateEvent>(
  candidates: T[],
  intent: SearchIntent,
  limit: number,
): Array<T & { _similarity: number }> {
  const byId = new Map<string, T>();
  for (const c of candidates) {
    const prev = byId.get(c.id);
    if (!prev) byId.set(c.id, c);
    else if (c._textHit && !prev._textHit) byId.set(c.id, { ...prev, _textHit: true });
  }
  return [...byId.values()]
    .map(ev => ({ ...ev, _similarity: scoreCandidate(ev, intent) }))
    .sort((a, b) => b._similarity - a._similarity)
    .slice(0, limit);
}

// ════════════════════════════════════════════════════════════════════
// fn-18.6 — Freizeitaktivitäten (POIs)
//
// Alles ab hier gehört zum ZWEITEN Retrieval-Pfad (`poi_activities`) und
// fasst den Event-Pfad bewusst nicht an: kein gemeinsamer State, keine
// Änderung an parseQuery/scoreCandidate/rankCandidates.
// ════════════════════════════════════════════════════════════════════

/** lowercase + Umlaute + Diakritika weg + nur [a-z0-9]; "sankt" → "st". */
function normToken(raw: string): string {
  let t = raw.toLowerCase();
  t = t.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  t = t.replace(/[^a-z0-9]/g, '');
  return t === 'sankt' ? 'st' : t;
}

/** Tokenizer für Query UND Gemeindenamen — MUSS für beide identisch sein. */
function tokenize(raw: string): { rawTokens: string[]; normTokens: string[] } {
  const rawTokens: string[] = [];
  const normTokens: string[] = [];
  for (const piece of raw.split(/[\s,;:.!?/()[\]{}"'`–—-]+/)) {
    if (!piece) continue;
    const n = normToken(piece);
    if (!n) continue;
    rawTokens.push(piece);
    normTokens.push(n);
  }
  return { rawTokens, normTokens };
}

// ── Gemeinde-Extractor ──────────────────────────────────────────────

/**
 * Kontextwörter, die vor einem Ortsnamen stehen dürfen. Ein Treffer
 * hinter einem dieser Wörter gilt als Orts-Angabe (Regel i).
 */
const LOCATION_CONTEXT_WORDS: ReadonlySet<string> = new Set([
  'in', 'im', 'bei', 'beim', 'nahe', 'naehe', 'um', 'rund', 'ums',
  'nach', 'von', 'aus', 'zu', 'zum', 'zur', 'near', 'around', 'at',
]);

/**
 * Ambiguitäts-Stoplist (verbindliche Politik: im Zweifel KEIN Match).
 *
 * Einzel-Token-Gemeindenamen, die zugleich Alltagswörter, Wetterbegriffe
 * oder bekanntere Nicht-AT-Orte sind. Sie werden als EIN-Token-Treffer
 * HART geblockt — auch mit Kontextwort davor ("im Wald", "bei Regen",
 * "am See" sind fast immer generische Sprache, kein Ortsbezug). Als Teil
 * eines Mehr-Token-Namens ("Wald am Arlberg", "Zell am See") matchen sie
 * weiterhin, weil dort keine Verwechslungsgefahr besteht.
 *
 * Quelle: alle Einzel-Token-Namen aus ALL_GEMEINDEN mit ≤7 Zeichen, per
 * Hand gegen Alltagsdeutsch geprüft (2026-07-30).
 */
const GEMEINDE_COLLISION_STOPLIST: ReadonlySet<string> = new Set([
  // Gemeindenamen == Alltagswörter
  'bach', 'baden', 'berg', 'brand', 'buch', 'hard', 'horn', 'klaus',
  'lang', 'landl', 'lend', 'mils', 'muhr', 'pram', 'rum', 'rust',
  'see', 'sonntag', 'spitz', 'stall', 'stans', 'sulz', 'thal',
  'traun', 'warth', 'weiler', 'wies', 'wiesen', 'zell', 'wang',
  'gaal', 'naas', 'kaisers', 'steeg', 'schlatt', 'weiten', 'lassing',
  // Gemeindenamen == bekanntere Nicht-AT-Orte/Länder
  'malta', 'krakau',
  // Wetter/Zeit-Wörter, die als Ortsname missgedeutet würden
  'marz', 'regen', 'schnee', 'sonne', 'wetter', 'winter', 'sommer',
]);

/** Mindestlänge für einen Einzel-Token-Treffer ohne Kontextwort. */
const MIN_STANDALONE_GEMEINDE_LEN = 4;

/** Radius-Default, wenn die Gemeinde kein kuratierter City-Hub ist. */
export const DEFAULT_ACTIVITY_RADIUS_KM = 15;

export interface DetectedGemeinde {
  /** `{plz}-{name-slug}` aus der Gemeinde-Registry. */
  slug: string;
  /** Registry-Schreibweise (für Labels). */
  name: string;
  lat: number;
  lng: number;
  /** Kanonische Bundesland-ID (⊆ BUNDESLAND_IDS). */
  bundesland: BundeslandId | null;
  /** Suchradius in km — City-Hub-Radius, sonst DEFAULT_ACTIVITY_RADIUS_KM. */
  radiusKm: number;
  /**
   * Rest-Query OHNE den Ortsausdruck (und ohne ein zugehöriges
   * Kontextwort). Analog zum Location-Stripping in parseQuery: der Ort
   * ist bereits harter Radius-Filter — bliebe er im Suchtext, würde die
   * trgm-Suche auf `poi_activities.name` zusätzlich den Ortsnamen im
   * Namen verlangen ("mountaincart dorfgastein" → 0 Treffer).
   */
  restText: string;
}

interface GemeindeIndexEntry {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  bundesland: BundeslandId | null;
}

/** Lazy gebauter Name-Index. `null` als Wert = mehrdeutig → kein Match. */
let GEMEINDE_INDEX: Map<string, GemeindeIndexEntry | null> | null = null;
let GEMEINDE_MAX_TOKENS = 1;

function gemeindeIndex(): Map<string, GemeindeIndexEntry | null> {
  if (GEMEINDE_INDEX) return GEMEINDE_INDEX;
  const idx = new Map<string, GemeindeIndexEntry | null>();
  for (const g of ALL_GEMEINDEN) {
    const { normTokens } = tokenize(g.name);
    if (normTokens.length === 0) continue;
    const key = normTokens.join(' ');
    if (normTokens.length > GEMEINDE_MAX_TOKENS) GEMEINDE_MAX_TOKENS = normTokens.length;
    if (idx.has(key)) {
      // Gleicher Name in zwei Bundesländern → mehrdeutig, kein Match.
      idx.set(key, null);
      continue;
    }
    idx.set(key, {
      slug: g.slug,
      name: g.name,
      lat: g.lat,
      lng: g.lng,
      bundesland: (bundeslandToId(g.bundesland) ?? null) as BundeslandId | null,
    });
  }
  GEMEINDE_INDEX = idx;
  return idx;
}

/**
 * Deterministischer Gemeinde-Extractor über den ROHEN Query-Text.
 *
 * PRIMÄRER Location-Resolver des Aktivitäts-Pfads: läuft vor dem
 * Pfad-Gating und komplett ohne LLM (die LLM-`location` ist nur ein
 * optionaler Hint für den Event-Pfad). Scannt token-basiert gegen die
 * 2.028 normalisierten Registry-Namen, längster Name zuerst.
 *
 * Akzeptanz-Regeln (verbindliche Ambiguitäts-Politik):
 *   (i)   Kontextwort davor (in/bei/nahe/um/rund um/…), ODER
 *   (ii)  Mehr-Token-Gemeindename ("Zell am See", "Bad Ischl"), ODER
 *   (iii) eindeutiges Einzel-Token ≥4 Zeichen, NICHT auf der Stoplist.
 * Einzel-Token auf der Stoplist matchen NIE (auch nicht mit Kontextwort).
 */
export function detectGemeindeInQuery(rawQuery: string): DetectedGemeinde | null {
  const { rawTokens, normTokens } = tokenize(rawQuery ?? '');
  if (normTokens.length === 0) return null;
  const idx = gemeindeIndex();

  for (let i = 0; i < normTokens.length; i++) {
    const maxLen = Math.min(GEMEINDE_MAX_TOKENS, normTokens.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const key = normTokens.slice(i, i + len).join(' ');
      const hit = idx.get(key);
      if (hit === undefined) continue;      // kein Gemeindename
      if (hit === null) continue;           // mehrdeutig → kein Match

      const prev = i > 0 ? normTokens[i - 1] : null;
      const hasContext = prev !== null && LOCATION_CONTEXT_WORDS.has(prev);

      if (len === 1) {
        const token = normTokens[i];
        if (GEMEINDE_COLLISION_STOPLIST.has(token)) continue;
        const standaloneOk = token.length >= MIN_STANDALONE_GEMEINDE_LEN;
        if (!hasContext && !standaloneOk) continue;
      }

      // Ortsausdruck (+ Kontextwort) aus dem Suchtext strippen.
      const from = hasContext ? i - 1 : i;
      const restText = [...rawTokens.slice(0, from), ...rawTokens.slice(i + len)]
        .join(' ')
        .trim();

      return {
        slug: hit.slug,
        name: hit.name,
        lat: hit.lat,
        lng: hit.lng,
        bundesland: hit.bundesland,
        radiusKm: getCityHub(hit.slug)?.radiusKm ?? DEFAULT_ACTIVITY_RADIUS_KM,
        restText,
      };
    }
  }
  return null;
}

// ── Deterministischer Aktivitäts-Klassifikator (No-AI-Pflichtpfad) ──

/**
 * Aktivitäts-Vokabular aus der Task-1-Topic-Whitelist abgeleitet (SoT:
 * src/lib/activities/taxonomy.ts). Jeder Whitelist-Key wird tokenisiert;
 * Tokens ≥5 Zeichen, die nicht zu generisch sind, werden zu weichen
 * Aktivitäts-Signalen. Damit wächst der Klassifikator automatisch mit
 * der Whitelist mit, statt eine zweite handgepflegte Liste zu sein.
 */
const GENERIC_TOPIC_TOKENS: ReadonlySet<string> = new Set([
  'sonstige', 'sonstiges', 'weitere', 'diverse', 'anlage', 'anlagen',
  'einrichtung', 'einrichtungen', 'verleih', 'geführte', 'gefuehrte',
  'fahren', 'gehen', 'touren', 'tour',
]);

const ACTIVITY_TOPIC_TOKENS: ReadonlySet<string> = (() => {
  const out = new Set<string>();
  for (const key of Object.keys(TOPIC_WHITELIST)) {
    for (const t of tokenize(key).normTokens) {
      if (t.length >= 5 && !GENERIC_TOPIC_TOKENS.has(t)) out.add(t);
    }
  }
  return out;
})();

/**
 * Starke POI-Begriffe: ihr Auftauchen heißt "der User sucht einen ORT,
 * keine Veranstaltung" — sofern kein explizites Event-Wort danebensteht.
 */
const STRONG_POI_TOKENS: ReadonlySet<string> = new Set([
  'mountaincart', 'mountaincarts', 'mountaincarting',
  'sommerrodelbahn', 'sommerrodeln', 'rodelbahn', 'rodelbahnen',
  'klettersteig', 'klettersteige', 'kletterhalle', 'kletterpark',
  'hochseilgarten', 'waldseilgarten', 'seilgarten',
  'freibad', 'hallenbad', 'erlebnisbad', 'strandbad', 'badesee',
  'therme', 'thermen', 'thermalbad', 'aquapark', 'wasserpark',
  'minigolf', 'kartbahn', 'gokart', 'kartsport',
  'schaubergwerk', 'tropfsteinhoehle', 'eishoehle',
  'seilbahn', 'bergbahn', 'sessellift', 'aussichtsturm',
  'aussichtsplattform', 'haengebruecke', 'tierpark', 'wildpark',
  'streichelzoo', 'abenteuerspielplatz', 'erlebnisweg', 'themenweg',
  'lehrpfad', 'baumwipfelpfad', 'eislaufplatz', 'kegelbahn', 'bowling',
  'escaperoom', 'trampolinpark', 'kletterwald',
]);

/** Explizite Veranstaltungs-Wörter — blockieren den activity-only-Pfad. */
const EXPLICIT_EVENT_TOKENS: ReadonlySet<string> = new Set([
  'event', 'events', 'veranstaltung', 'veranstaltungen', 'konzert',
  'konzerte', 'party', 'partys', 'parties', 'festival', 'festivals',
  'fest', 'feste', 'kabarett', 'theater', 'kino', 'clubbing', 'disco',
  'lesung', 'auffuehrung', 'vorstellung', 'programm', 'termine',
  'flohmarkt', 'krampuslauf', 'ball', 'baelle', 'gig', 'gigs',
]);

/** POI-Frage-Muster: "wo kann ich …", "was tun …", "bei Regen", … */
const POI_QUESTION_PATTERNS: readonly RegExp[] = [
  /\bwo\s+(kann|koennen|kann\s+man|gibt|gibts|finde|findet|geht)\b/,
  /\bwas\s+(kann\s+man|kann\s+ich|soll\s+man|)?\s*(tun|machen|unternehmen)\b/,
  /\bwohin\b/,
  /\bausflug(sziel|sziele|e|stipp|stipps)?\b/,
  /\bschlechtwetter\w*\b/,
  /\bregentag\w*\b/,
  /\bbei\s+(regen|schlechtem\s+wetter|hitze|kaelte)\b/,
  /\bfreizeit(aktivitaet\w*|tipp\w*)?\b/,
  /\bunternehmen\s+mit\s+kindern\b/,
];

/** Indoor-/Regen-Muster → deterministischer setting='indoor'-Filter. */
const INDOOR_PATTERNS: readonly RegExp[] = [
  /\bregen\w*\b/, /\bregnet\b/, /\bschlechtwetter\w*\b/,
  /\bschlechtem?\s+wetter\b/, /\bdrinnen\b/, /\bindoor\b/,
  /\bregensicher\w*\b/, /\bueberdacht\w*\b/,
];

export interface ActivitySignals {
  /** Query zielt (auch) auf Freizeit-POIs. */
  isActivity: boolean;
  /** Query zielt AUSSCHLIESSLICH auf POIs → Event-Pfad wird gar nicht erst aufgerufen. */
  activityOnly: boolean;
  /** Regen-/Schlechtwetter-Signal → RPC-Filter setting='indoor'. */
  indoor: boolean;
}

/**
 * LLM-freier Aktivitäts-Klassifikator (Pflicht, Epic E9).
 *
 * Die Route degradiert bewusst, wenn GEMINI_API_KEY fehlt oder Gemini
 * timeoutet. Ohne diesen Klassifikator liefen Aktivitäts-Queries im
 * Fallback-Modus trotzdem in den Event-Pfad — deshalb läuft er IMMER,
 * vor dem Pfad-Gating, und überstimmt die LLM-Antwort (gleiche Politik
 * wie beim Ort: Deterministik gewinnt).
 */
export function detectActivityIntent(rawQuery: string): ActivitySignals {
  const raw = (rawQuery ?? '').toLowerCase();
  // Für die Muster: Umlaute normalisieren, Wortgrenzen erhalten.
  const flat = raw
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  const { normTokens } = tokenize(rawQuery ?? '');

  const hasEventWord = normTokens.some(t => EXPLICIT_EVENT_TOKENS.has(t));
  const hasStrongPoi = normTokens.some(t => STRONG_POI_TOKENS.has(t));
  const hasTopicToken = normTokens.some(t => ACTIVITY_TOPIC_TOKENS.has(t));
  const hasPoiQuestion = POI_QUESTION_PATTERNS.some(re => re.test(flat));
  const indoor = INDOOR_PATTERNS.some(re => re.test(flat));

  const isActivity = hasStrongPoi || hasTopicToken || hasPoiQuestion;
  // activity-only nur bei EINDEUTIGEM POI-Signal und ohne Event-Wort.
  const activityOnly = isActivity && !hasEventWord && (hasStrongPoi || hasPoiQuestion);

  // "konzerte wien heute" ohne jedes POI-Signal bleibt reine Event-Query.
  return { isActivity, activityOnly, indoor };
}

// ── Suchbegriff für die trgm-Suche auf poi_activities.name ──────────

/**
 * Wörter, die als trgm-Suchbegriff wertlos sind (Frage-/Füll-/Wetter-
 * wörter). Bleibt danach nichts übrig, läuft die RPC mit q=NULL rein
 * über setting + Location + Tags — die Regen-Query darf nie an einem
 * fehlenden Suchterm scheitern.
 */
const ACTIVITY_TERM_STOPWORDS: ReadonlySet<string> = new Set([
  'wo', 'was', 'wie', 'wer', 'wann', 'wohin', 'welche', 'welches', 'welcher',
  'kann', 'koennen', 'kann', 'soll', 'sollte', 'will', 'moechte', 'suche',
  'ich', 'man', 'wir', 'uns', 'mir', 'mich', 'du', 'ihr',
  'gibt', 'gibts', 'geht', 'gehen', 'machen', 'tun', 'unternehmen',
  'fahren', 'sein', 'haben', 'werden', 'finden', 'findet',
  'der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem',
  'und', 'oder', 'mit', 'ohne', 'fuer', 'auf', 'aus', 'bei', 'beim',
  'in', 'im', 'am', 'an', 'zu', 'zum', 'zur', 'von', 'vom', 'nach',
  'heute', 'morgen', 'wochenende', 'jetzt', 'gerade', 'etwas', 'gutes',
  'regen', 'regnet', 'wetter', 'schlechtwetter', 'schlechtem', 'drinnen',
  'indoor', 'outdoor', 'draussen', 'gratis', 'kostenlos', 'billig',
  'guenstig', 'schoen', 'schoene', 'toll', 'tolle', 'nahe', 'naehe',
  'the', 'and', 'for',
]);

/**
 * Bester trgm-Suchbegriff für `poi_activities.name`, oder null.
 *
 * Bevorzugt die LLM-searchTerms (sie sind bereits entrauscht), sonst die
 * Tokens des Rest-Texts. Genommen wird der LÄNGSTE Kandidat — bei POIs
 * trägt das spezifischste Wort ("mountaincart", "hochseilgarten") die
 * Bedeutung; ein Mehrwort-`q` würde die trgm-Ähnlichkeit gegen den
 * Namen nur verwässern.
 */
export function extractActivitySearchTerm(
  restText: string,
  llmSearchTerms: string[] = [],
): string | null {
  // LLM-Begriffe nur uebernehmen, wenn sie WOERTLICH in der Nutzer-Anfrage
  // vorkommen. Gemini paraphrasiert Produktnamen gern ins Oberbegriff-
  // Vokabular ("mountaincart" -> "Bergtour"/"Mountain"), was die
  // trgm-Namenssuche auf falsche POIs lenkt (auf Prod verifiziert:
  // "wo kann ich mountaincart fahren" lieferte "Active Mountains" statt der
  // Mountaincart-Bahnen). Fuer Namens-Aehnlichkeit ist das Wort des Nutzers
  // die bessere Quelle; die LLM-Leistung bleibt die AUSWAHL des richtigen
  // Tokens aus der Anfrage, nicht dessen Erfindung.
  const restNorm = new Set(tokenize(restText ?? '').normTokens);
  const candidates: string[] = [];
  for (const t of llmSearchTerms) {
    const n = normToken(t.split(/\s+/)[0] ?? '');
    if (n.length >= 4 && !ACTIVITY_TERM_STOPWORDS.has(n) && restNorm.has(n)) {
      candidates.push(t.trim());
    }
  }
  if (candidates.length === 0) {
    const { rawTokens, normTokens } = tokenize(restText ?? '');
    for (let i = 0; i < normTokens.length; i++) {
      const n = normTokens[i];
      if (n.length >= 4 && !ACTIVITY_TERM_STOPWORDS.has(n)) candidates.push(rawTokens[i]);
    }
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.length > a.length ? b : a));
}

// ── Ranking der POI-Shortlist ───────────────────────────────────────

/** Zeile wie sie die RPC `search_activities` liefert. */
export interface ActivityCandidate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  description_short: string | null;
  tags: string[] | null;
  setting: 'indoor' | 'outdoor' | 'mixed' | null;
  lat: number;
  lng: number;
  town: string | null;
  gemeinde_slug: string | null;
  bundesland: string;
  images: unknown;
  price_hint: string | null;
  online_bookable: boolean;
  /** similarity(name, q) aus der RPC — 0 im q=NULL-Zweig. */
  name_similarity: number | null;
  /** Anzahl Tag-Treffer aus der RPC. */
  tag_hits: number | null;
  /** Haversine-Distanz zum Suchzentrum (null ohne Location-Filter). */
  distance_km: number | null;
}

/**
 * Relevanz 0..0.99 für POIs. Bewusst eigene Skala (kein scoreCandidate-
 * Reuse): POIs haben weder Datum noch event_score.
 *
 *   name-trgm      max 0.45  — stärkstes Signal, kommt indexiert aus der RPC
 *   Tag-Treffer    max 0.24
 *   Description    max 0.18  — SEKUNDÄR, nur über die geladene Shortlist
 *                              (kein description-Index, Micro-Instanz)
 *   Nähe           max 0.12  — linear über den Suchradius abfallend
 */
export function scoreActivityCandidate(
  a: ActivityCandidate,
  intent: SearchIntent,
  searchTerm: string | null,
  radiusKm: number = DEFAULT_ACTIVITY_RADIUS_KM,
): number {
  let s = 0;
  s += Math.max(0, Math.min(1, a.name_similarity ?? 0)) * 0.45;
  s += Math.min(a.tag_hits ?? 0, 3) * 0.08;

  if (searchTerm) {
    const needle = normToken(searchTerm);
    if (needle.length >= 3) {
      const hay = normToken(`${a.description_short ?? ''} ${a.description ?? ''}`);
      if (hay.includes(needle)) s += 0.18;
    }
  }

  if (a.distance_km !== null && radiusKm > 0) {
    s += Math.max(0, 1 - a.distance_km / radiusKm) * 0.12;
  }

  // Facetten-Overlap mit den LLM-Tags zählt schon über tag_hits; die
  // Intent-Tags hier nur als Tiebreaker, falls die RPC ohne tag_filter lief.
  if ((a.tag_hits ?? 0) === 0 && intent.tags.length > 0) {
    s += Math.min(overlapCount(a.tags, intent.tags), 2) * 0.04;
  }

  return Math.min(0.99, s);
}

/** Dedupe (per id), score, sort desc (Name als stabiler Tiebreaker), cap. */
export function rankActivityCandidates<T extends ActivityCandidate>(
  candidates: T[],
  intent: SearchIntent,
  searchTerm: string | null,
  limit: number,
  radiusKm: number = DEFAULT_ACTIVITY_RADIUS_KM,
): Array<T & { _similarity: number }> {
  const byId = new Map<string, T>();
  for (const c of candidates) if (!byId.has(c.id)) byId.set(c.id, c);
  return [...byId.values()]
    .map(a => ({ ...a, _similarity: scoreActivityCandidate(a, intent, searchTerm, radiusKm) }))
    .sort((a, b) => (b._similarity - a._similarity) || a.name.localeCompare(b.name, 'de'))
    .slice(0, limit);
}
