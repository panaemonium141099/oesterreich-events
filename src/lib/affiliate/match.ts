/**
 * Konservatives Viator-Matching (fn-18 Task 5).
 *
 * LEITSATZ (Task-Spec): KEIN MATCH IST BESSER ALS EIN FALSCHER. Eine
 * falsche Buchungs-Box auf einer Aktivitaetsseite ist ein Vertrauens- und
 * potenziell ein Rechtsproblem; ein fehlender Affiliate-Link kostet nur
 * Umsatz. Alle Schwellen sind deshalb bewusst hoch, und jede Unsicherheit
 * fuehrt zu "kein Match".
 *
 * Drei harte Gates, alle muessen erfuellt sein:
 *   1. TAG-GATE      — die Aktivitaet traegt mindestens einen kommerziellen
 *                      Tag (Erlebnisse, die auf Viator ueberhaupt verkauft
 *                      werden). Museen/Baeder/Sportplaetze ohne Guided-Tour-
 *                      Charakter bleiben aussen vor.
 *   2. NAMENS-GATE   — Dice-Koeffizient ueber normalisierte Token >=
 *                      NAME_THRESHOLD.
 *   3. ORTS-GATE     — der Ort der Aktivitaet (town) muss im Produkt-Text
 *                      (Titel + Destination) vorkommen. Viator-Produkte
 *                      ohne erkennbaren Ortsbezug werden verworfen.
 * Zusaetzlich ein AMBIGUITAETS-GUARD: der beste Treffer muss den
 * zweitbesten um AMBIGUITY_MARGIN schlagen — sonst ist die Zuordnung
 * nicht eindeutig genug.
 *
 * Reines Modul (keine Netz-/DB-Imports) — vollstaendig unit-testbar.
 */

/**
 * Kommerzielle Tags: Kategorien, fuer die Viator real gefuehrte Erlebnisse
 * verkauft. Bewusst KLEIN gehalten (Gap-Analyse) — Erweiterung erst nach
 * ausgewerteten Match-Reports.
 * Werte stammen aus src/lib/activities/taxonomy.ts (kein Import, um die
 * Taxonomie-SoT nicht zu koppeln; Drift faellt im Test auf).
 */
export const COMMERCIAL_TAGS: readonly string[] = [
  'rafting',
  'kanutour',
  'kajak',
  'klettern',
  'bergtour',
  'segel-tour',
  'reiten',
  'thermen-special',
  'wellness-day',
  'museumstour',
];

/** Dice-Schwelle fuer die Namens-Aehnlichkeit (0..1). Dokumentiert, absichtlich hoch. */
export const NAME_THRESHOLD = 0.72;
/** Der beste Treffer muss den zweitbesten um diesen Abstand schlagen. */
export const AMBIGUITY_MARGIN = 0.08;
/** Namens-Token kuerzer als das werden ignoriert (Rauschen wie "am", "in"). */
const MIN_TOKEN_LENGTH = 3;

/** Generische Woerter, die keine Unterscheidungskraft haben. */
const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'und', 'oder', 'von', 'vom', 'zum', 'zur',
  'the', 'and', 'of', 'in', 'im', 'am', 'an', 'auf', 'bei', 'fuer', 'for',
  'gmbh', 'kg', 'og', 'ag', 'eu', 'ev', 'verein', 'betrieb', 'betriebe',
  'tour', 'tours', 'touren', 'erlebnis', 'erlebnisse', 'ticket', 'tickets',
  'experience', 'adventure', 'oesterreich', 'austria',
]);

/** Umlaut-Faltung + Kleinschreibung + Satzzeichen weg. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    // Kombinierende Diakritika (e/accent -> e) nach der Umlaut-Faltung.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Normalisierte, stopword-bereinigte Token-Menge. */
export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t));
}

/**
 * Dice-Koeffizient ueber Token-Mengen: 2*|A∩B| / (|A|+|B|).
 * Gewaehlt statt Jaccard, weil er bei unterschiedlich langen Titeln
 * ("Mountaincart Wildkogel" vs. "Mountaincart Wildkogel Arena Tour")
 * weniger hart bestraft — der Ambiguitaets-Guard faengt den Rest.
 */
export function diceSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const token of setA) if (setB.has(token)) overlap++;
  return (2 * overlap) / (setA.size + setB.size);
}

export interface MatchableActivity {
  id: string;
  name: string;
  town: string | null;
  tags: string[] | null;
  visible?: boolean;
  is_closed?: boolean;
}

export interface MatchCandidate {
  productCode: string;
  title: string | null;
  /** Destination/Ort als Freitext. */
  locationText: string | null;
}

export interface MatchDecision {
  candidate: MatchCandidate;
  score: number;
  /** Score des zweitbesten Kandidaten (Nachvollziehbarkeit im Report). */
  runnerUpScore: number;
}

export type MatchRejection =
  | 'no-commercial-tag'
  | 'not-displayable'
  | 'no-town'
  | 'no-candidates'
  | 'below-threshold'
  | 'location-mismatch'
  | 'ambiguous';

/**
 * Gate 1 + Anzeige-Bedingung. `visible AND NOT is_closed` ist die
 * kanonische Anzeige-Bedingung des Epics (Migration 20260724120000:168) —
 * geschlossene POIs bekommen NIE eine Buchungs-Box.
 */
export function isMatchEligible(activity: MatchableActivity): boolean {
  if (activity.visible === false) return false;
  if (activity.is_closed === true) return false;
  if (!activity.town || activity.town.trim() === '') return false;
  const tags = activity.tags ?? [];
  return tags.some((tag) => COMMERCIAL_TAGS.includes(tag));
}

/** Gate 3: Ort der Aktivitaet muss im Produkt-Text auftauchen. */
export function locationMatches(town: string | null, candidate: MatchCandidate): boolean {
  if (!town) return false;
  const townTokens = tokenize(town);
  if (townTokens.length === 0) return false;
  const haystack = normalizeText(`${candidate.title ?? ''} ${candidate.locationText ?? ''}`);
  if (haystack === '') return false;
  const hay = new Set(haystack.split(' '));
  // Jedes bedeutungstragende Ortstoken muss vorkommen ("Neusiedl am See"
  // -> "neusiedl" + "see"); "am" faellt schon in tokenize() weg.
  return townTokens.every((token) => hay.has(token));
}

/**
 * Die eigentliche Entscheidung. Liefert entweder einen Treffer oder den
 * GRUND fuer die Ablehnung (der Match-Report zaehlt die Gruende — so ist
 * eine Threshold-Diskussion datenbasiert statt Bauchgefuehl).
 */
export function pickBestMatch(
  activity: MatchableActivity,
  candidates: MatchCandidate[],
  options: { nameThreshold?: number; ambiguityMargin?: number } = {},
): { ok: true; decision: MatchDecision } | { ok: false; reason: MatchRejection } {
  const nameThreshold = options.nameThreshold ?? NAME_THRESHOLD;
  const ambiguityMargin = options.ambiguityMargin ?? AMBIGUITY_MARGIN;

  if (activity.visible === false || activity.is_closed === true) {
    return { ok: false, reason: 'not-displayable' };
  }
  if (!activity.town || activity.town.trim() === '') {
    return { ok: false, reason: 'no-town' };
  }
  if (!isMatchEligible(activity)) {
    return { ok: false, reason: 'no-commercial-tag' };
  }
  if (candidates.length === 0) {
    return { ok: false, reason: 'no-candidates' };
  }

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: diceSimilarity(activity.name, candidate.title ?? ''),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]!;
  const runnerUpScore = scored[1]?.score ?? 0;

  if (best.score < nameThreshold) {
    return { ok: false, reason: 'below-threshold' };
  }
  if (!locationMatches(activity.town, best.candidate)) {
    return { ok: false, reason: 'location-mismatch' };
  }
  if (scored.length > 1 && best.score - runnerUpScore < ambiguityMargin) {
    return { ok: false, reason: 'ambiguous' };
  }

  return { ok: true, decision: { candidate: best.candidate, score: best.score, runnerUpScore } };
}

/** Suchbegriff fuer die Viator-Freitextsuche (Name + Ort). */
export function buildSearchTerm(activity: MatchableActivity): string {
  return [activity.name, activity.town].filter((v) => v && v.trim() !== '').join(' ');
}
