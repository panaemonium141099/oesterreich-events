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
 *   - parseQuery()        — Regex-Pass: Datum, Preis, Ort
 *   - validateIntent()    — Whitelist-Guard für die Gemini-Antwort
 *   - rankCandidates()    — deterministisches Relevanz-Scoring
 */

import {
  PRIMARY_CATEGORIES,
  TAGS,
  AUDIENCES,
  VIBES,
  OCCASIONS,
} from '@/lib/category-classifier/enrichment-taxonomy';

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

/** Bundesland-Keyword → canonical Bundesland-ID (Umlaut-tolerant). */
export const BUNDESLAENDER_KEYS: Record<string, string> = {
  burgenland: 'burgenland',
  niederösterreich: 'niederoesterreich', niederoesterreich: 'niederoesterreich',
  oberösterreich: 'oberoesterreich', oberoesterreich: 'oberoesterreich',
  steiermark: 'steiermark',
  tirol: 'tirol',
  vorarlberg: 'vorarlberg',
  kärnten: 'kaernten', kaernten: 'kaernten',
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

export interface SearchIntent {
  categories: string[];   // ⊆ PRIMARY_CATEGORIES
  tags: string[];         // ⊆ TAGS
  audiences: string[];    // ⊆ AUDIENCES
  occasions: string[];    // ⊆ OCCASIONS
  vibes: string[];        // ⊆ VIBES
  searchTerms: string[];  // freie Suchbegriffe für die Textsuche (trgm)
  location: string | null; // Kandidat für CITIES/BUNDESLAENDER_KEYS-Lookup
}

const CATEGORY_SET = new Set<string>(PRIMARY_CATEGORIES);
const TAG_SET = new Set<string>(TAGS);
const AUDIENCE_SET = new Set<string>(AUDIENCES);
const OCCASION_SET = new Set<string>(OCCASIONS);
const VIBE_SET = new Set<string>(VIBES);

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
  const empty: SearchIntent = {
    categories: [], tags: [], audiences: [], occasions: [], vibes: [],
    searchTerms: [], location: null,
  };
  if (raw === null || typeof raw !== 'object') return empty;
  const o = raw as Record<string, unknown>;

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
  };
}

/** Ist überhaupt ein Match-Signal vorhanden? (Sonst Fallback: top-Score.) */
export function intentIsEmpty(i: SearchIntent): boolean {
  return (
    i.categories.length === 0 && i.tags.length === 0 && i.audiences.length === 0 &&
    i.occasions.length === 0 && i.vibes.length === 0 && i.searchTerms.length === 0
  );
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
