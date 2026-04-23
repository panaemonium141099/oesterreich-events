/**
 * Canonical category taxonomy — v3, 11 Hauptkategorien.
 *
 * **Single source of truth:** `docs/TAXONOMY.md`. Jede Änderung hier muss
 * dort nachgezogen werden — und umgekehrt.
 *
 * Rework note (2026-04-23): The old 14-cat taxonomy (Kultur / Nightlife /
 * Bildung + Wirtschaft separate / Gesundheit + Religion separate) has been
 * consolidated into 11 cleaner buckets. Categories = Datenrückgrat, Tags =
 * Verkaufsmaschine. Nightlife is now a Hauptkategorie called "Nightlife &
 * Party" (as an umbrella), NOT a tag — but the tag system carries the
 * emotional/discovery load (Studentenleben, Date Night, Afterwork, …).
 *
 * Migration guide (alt → neu) in docs/TAXONOMY.md §5.
 */

import type { Category } from '@/types/events';

/**
 * Compound classifier version. Three independent components allow us to
 * invalidate caches and trigger re-runs at different granularities:
 *
 * - `cat-vN`      — fundamental confidence model / category structure change
 * - `rulesN`      — lexicon, scoring weights, blocker or disambiguator change
 * - `promptN`     — OpenAI system prompt change
 *
 * Bumped to cat-v3 with the 11-category rework.
 */
export const CLASSIFIER_VERSION = 'cat-v3-rules1-prompt1' as const;

/** Prefix used by the backfill query's LIKE filter. Bump when rules change. */
export const CLASSIFIER_VERSION_PREFIX = 'cat-v3-rules1-' as const;

export const CATEGORIES: Category[] = [
  'Musik',
  'Kultur & Bühne',
  'Nightlife & Party',
  'Essen & Trinken',
  'Märkte & Feste',
  'Sport & Bewegung',
  'Natur & Abenteuer',
  'Wissen & Karriere',
  'Familie & Kinder',
  'Community & Freizeit',
  'Wellness & Spiritualität',
  'Sonstiges',
];

/**
 * Priority order for deterministic tie-breaking. Earlier wins.
 * Specific niches first, broad ones last.
 */
export const PRIORITY_ORDER: Category[] = [
  'Wellness & Spiritualität',   // Religion + Gesundheit — very specific
  'Natur & Abenteuer',          // outdoor niche
  'Familie & Kinder',           // audience-defined
  'Märkte & Feste',             // format-defined
  'Essen & Trinken',
  'Sport & Bewegung',
  'Wissen & Karriere',          // Bildung + Wirtschaft merged
  'Community & Freizeit',       // social/hobby
  'Nightlife & Party',          // now a Hauptkategorie
  'Kultur & Bühne',             // broad performing arts
  'Musik',                      // broadest, last tiebreaker winner
];

export interface CategoryDefinition {
  /** Short one-liner shown to the AI prompt. */
  summary: string;
  /** Disambiguation guidance vs confusable siblings. */
  notes: string[];
}

/**
 * Definitions the AI enrichment prompt consumes. Partial because only the
 * 11 v3-Hauptkategorien + Sonstiges need definitions — the deprecated v1/v2
 * aliases in the Category type are just DB-migration scaffolding, not AI
 * targets.
 */
export const CATEGORY_DEFINITIONS: Partial<Record<Category, CategoryDefinition>> = {
  Musik: {
    summary:
      'Konzert, Live-Musik, Orchester, Chor, Band, Singer-Songwriter, Jazz, Klassik, Open-Air-Konzert, volkstümliche/traditionelle Musik (Tamburica, Blasmusik, Chor). Hauptfokus: Musik hören.',
    notes: [
      'Musik vs Nightlife & Party: Wenn der Draw ein benannter Künstler / Band / Ensemble ist, ist es Musik. DJ-Lineup / Club-Night / Electronic-Dance-Party mit Tanzen als Fokus → Nightlife & Party.',
      'Musik vs Kultur & Bühne: Oper, Operette, Musical, Ballett sind Kultur & Bühne (inszeniert). Reines Konzert = Musik.',
      'Musik vs Wellness & Spiritualität: Kirchenkonzert / Orgelkonzert (Performance) = Musik. Gottesdienst mit Musik = Wellness & Spiritualität.',
      'Musik vs Märkte & Feste: Adventmarkt mit Live-Band = Märkte & Feste. Reines Konzert in einer Kirche = Musik.',
    ],
  },
  'Kultur & Bühne': {
    summary:
      'Theater, Kabarett, Comedy, Stand-up, Lesung, Musical, Oper, Ausstellung, Museum, Kino, Performance-Art, Improtheater, Burg-/Schloss-/Stadtführung.',
    notes: [
      'Kultur & Bühne vs Musik: Inszenierte Performances (Theater/Oper/Musical/Ballett) sind Kultur & Bühne auch wenn Musik dabei ist.',
      'Kultur & Bühne vs Familie & Kinder: Kindertheater, Puppentheater, Kinderkino → Familie & Kinder wenn Zielgruppe explizit Kinder.',
      'Kultur & Bühne vs Wissen & Karriere: Stadtführung / Burgführung = Kultur & Bühne, auch wenn edukativ. Vortrag mit Lernfokus = Wissen & Karriere.',
      'Kultur & Bühne vs Märkte & Feste: Ein kuratiertes Theaterfestival = Kultur & Bühne. Dorffest mit Puppentheater-Ecke = Märkte & Feste.',
    ],
  },
  'Nightlife & Party': {
    summary:
      'Clubbing, Rave, Afterparty, Club-Night, Cocktail-Night, Tanznacht, Pub-Crawl, DJ-Set, Motto-Party (80s/90s/Latino/Erasmus), Bar-Events mit Party-Charakter, Ladies/Student Nights, Warehouse-Parties.',
    notes: [
      'Nightlife & Party vs Musik: Band/Ensemble headlined = Musik. DJ headlined / Electronic-Music-Focus / Tanzen = Nightlife & Party.',
      'Nightlife & Party vs Essen & Trinken: Bar mit Trink-/Heurigen-Fokus ohne Tanz = Essen & Trinken. Bar mit DJ/Party-Charakter = Nightlife & Party.',
      'Nightlife & Party vs Märkte & Feste: Faschings-Ball / Feuerwehr-Ball = Märkte & Feste (Brauchtum). Club-Party im selben Venue = Nightlife & Party.',
    ],
  },
  'Essen & Trinken': {
    summary:
      'Weinverkostung, Tasting, Street Food, Brunch, Dinner Event, Kulinarik-Tour, Heuriger, Buschenschank, Food Festival, Bierverkostung, Kochkurs, Gourmet-Dinner.',
    notes: [
      'Essen & Trinken vs Märkte & Feste: Food-Markt / Bauernmarkt = Märkte & Feste. Kuratiertes Tasting / Food-Festival mit Verkostungs-Fokus = Essen & Trinken.',
      'Essen & Trinken vs Märkte & Feste: Heurigenfest mit Brauchtum-Dominanz = Märkte & Feste. Heuriger als Lokal-Abend = Essen & Trinken.',
      'Essen & Trinken vs Nightlife & Party: Weinfest mit Musik/Tanz-Fokus (DJ, spät) = Nightlife & Party. Mit Wein/Verkostungs-Fokus = Essen & Trinken.',
    ],
  },
  'Märkte & Feste': {
    summary:
      'Christkindlmarkt, Adventmarkt, Ostermarkt, Flohmarkt, Bauernmarkt, Wochenmarkt, Designmarkt, Kunsthandwerkermarkt, Dorffest, Stadtfest, Kirtag, Pfarrfest, Feuerwehrfest, Maibaumfest, Sonnwendfeier, Erntedank, Fasching, Perchtenlauf, Krampuslauf.',
    notes: [
      'Märkte & Feste vs Essen & Trinken: Weinmarkt/Bauernmarkt mit mehreren Ständen = Märkte & Feste. Weinverkostung/Kochkurs/Tasting = Essen & Trinken.',
      'Märkte & Feste vs Wellness & Spiritualität: Pfarrfest/Kirtag = Märkte & Feste (Brauchtum). Gottesdienst/Wallfahrt/Prozession = Wellness & Spiritualität.',
      'Märkte & Feste vs Wissen & Karriere: Gewerbemesse / B2B-Messe = Wissen & Karriere. Verkaufsmesse für Konsumenten mit Marktcharakter = Märkte & Feste.',
    ],
  },
  'Sport & Bewegung': {
    summary:
      'Lauf, Marathon, Radfahren, Yoga (Fitness-Fokus), Turnier, Fitness, Fußball, Eishockey, Tennis, Schwimmen, Klettern, Tanzkurs (sportlich), Vereinsaktivitäten.',
    notes: [
      'Sport & Bewegung vs Natur & Abenteuer: Reiner Stadtlauf / Fitness-Wanderung / Turnier = Sport & Bewegung. Geführte Wanderung mit Natur-Fokus / Rafting / Klettertour = Natur & Abenteuer.',
      'Sport & Bewegung vs Wellness & Spiritualität: Yoga-Kurs / Fitness-Yoga = Sport & Bewegung. Yoga-Retreat / Meditation / Breathwork = Wellness & Spiritualität.',
      'Sport & Bewegung vs Familie & Kinder: Kinderturnen / Familienwandertag skewed zu Familie & Kinder wenn Publikum explizit Kinder.',
    ],
  },
  'Natur & Abenteuer': {
    summary:
      'Wanderung, Outdoor-Tour, Klettern, Rafting, Kanutour, Naturführung, Vogelbeobachtung, Kräuterwanderung, Astronomie, Pilzwanderung, Expedition, Trekking, Erlebnistour, Escape Room (Abenteuer-Fokus).',
    notes: [
      'Natur & Abenteuer vs Sport & Bewegung: Geführte Wanderung mit Natur-Guide / Nationalpark / Botanik = Natur & Abenteuer. Stadtlauf / Marathon / reine Fitness = Sport & Bewegung.',
      'Natur & Abenteuer vs Wissen & Karriere: Vortrag über Natur = Wissen & Karriere. Draußen erlebte Naturführung = Natur & Abenteuer.',
    ],
  },
  'Wissen & Karriere': {
    summary:
      'Vortrag, Workshop, Kurs, Seminar, Fortbildung, Sprachkurs, Networking, Startup-Pitch, Tech-Meetup, Gründer-Event, Karrieremesse, Messe, Konferenz, Gewerbemesse, WKO-Event, Campus-Info, B2B-Networking.',
    notes: [
      'Wissen & Karriere vs Community & Freizeit: Pub-Quiz / Stammtisch / Hobbygruppe = Community & Freizeit. Lern-Workshop / Seminar mit Fach-Fokus = Wissen & Karriere.',
      'Wissen & Karriere vs Kultur & Bühne: Ticketed Lesung als Performance = Kultur & Bühne. Autoren-Q&A / Sachbuch-Lesung mit Diskussion = Wissen & Karriere.',
      'Wissen & Karriere vs Märkte & Feste: Gewerbe-/B2B-/Fachmesse = Wissen & Karriere. Verkaufsmesse für Konsumgüter = Märkte & Feste.',
    ],
  },
  'Familie & Kinder': {
    summary:
      'Kinderprogramm, Familiennachmittag, Basteln, Kindertheater, Puppentheater, Kinderkino, Familien-Picknick, Spielfest, Ferienprogramm, Kinder-Workshop, Osterhasenfest.',
    notes: [
      'Familie & Kinder vs Kultur & Bühne: Kindertheater / Puppentheater bleibt Familie & Kinder wenn Zielgruppe explizit Kinder.',
      'Familie & Kinder vs Märkte & Feste: Adventmarkt mit Familienprogramm = Märkte & Feste (Adventmarkt dominiert). Reines Kinderfest = Familie & Kinder.',
    ],
  },
  'Community & Freizeit': {
    summary:
      'Stammtisch, Pub Quiz, Brettspielabend, Game Night, LAN-Party, Speed Dating, Single-Night, Vereinstreffen, Community Meetup, Hobbygruppen, Nachbarschaftsevents, Stand-up-Abend.',
    notes: [
      'Community & Freizeit vs Nightlife & Party: Pub Quiz im Studentenclub = Community & Freizeit (Pub Quiz primär). Reine Club-Night im selben Venue = Nightlife & Party.',
      'Community & Freizeit vs Wissen & Karriere: Stammtisch zum Austausch = Community & Freizeit. Networking-Event mit Business-Fokus = Wissen & Karriere.',
    ],
  },
  'Wellness & Spiritualität': {
    summary:
      'Meditation, Achtsamkeit, Breathwork, Wellness, Retreat, Sound Healing, Sauna-Special, Therme-Special, Yoga-Retreat, Gottesdienst, Hochamt, Wallfahrt, Prozession, Pilgern, Selbsthilfegruppe, Gesundheitsvortrag, spirituelle Veranstaltungen.',
    notes: [
      'Wellness & Spiritualität vs Sport & Bewegung: Yoga-Retreat / Meditation / Achtsamkeit = Wellness & Spiritualität. Yoga-Fitness-Kurs = Sport & Bewegung.',
      'Wellness & Spiritualität vs Musik: Orgelkonzert als Performance = Musik. Gottesdienst mit Orgel = Wellness & Spiritualität.',
      'Wellness & Spiritualität vs Märkte & Feste: Wallfahrt/Prozession = Wellness & Spiritualität. Pfarrfest = Märkte & Feste.',
    ],
  },
  Sonstiges: {
    summary:
      'Fallback only — pick this ONLY when no other category fits the event at all. In Discovery-UI nicht anzeigen.',
    notes: ['Never pick Sonstiges to avoid having to decide.'],
  },
};

/**
 * Migration map: old 14-cat taxonomy → new 11-cat taxonomy.
 * Used by the SQL migration in supabase/migrations/20260423_taxonomy_v3.sql
 * AND by the TypeScript normalizer in migrateOldCategory() below.
 */
export const OLD_TO_NEW_CATEGORY: Record<string, Category> = {
  'Musik': 'Musik',
  'Kultur': 'Kultur & Bühne',
  'Sport': 'Sport & Bewegung',
  'Feste & Brauchtum': 'Märkte & Feste',
  'Märkte': 'Märkte & Feste',
  'Wein & Kulinarik': 'Essen & Trinken',
  'Familie': 'Familie & Kinder',
  'Natur': 'Natur & Abenteuer',
  'Nightlife': 'Nightlife & Party',
  'Bildung': 'Wissen & Karriere',
  'Wirtschaft': 'Wissen & Karriere',
  'Gesundheit': 'Wellness & Spiritualität',
  'Religion': 'Wellness & Spiritualität',
  'Sonstiges': 'Sonstiges',
};

/**
 * Normalize any category string (old or new) to the current canonical value.
 * Used by the API layer as a safety net while the migration is in flight.
 */
export function migrateOldCategory(input: string | null | undefined): Category | null {
  if (!input) return null;
  const mapped = OLD_TO_NEW_CATEGORY[input];
  if (mapped) return mapped;
  // Already a new category? Pass through.
  if ((CATEGORIES as readonly string[]).includes(input)) return input as Category;
  return null;
}

/**
 * Confidence precedence helper. Lower rank = higher priority.
 *
 * Used by `reconcile.ts` to enforce overwrite semantics centrally:
 *   manual          untouchable
 *   rules_exact     never overwritten by anything weaker
 *   enrichment      AI-derived from full-context enrichment prompt (new!)
 *   ai_low          never overwrites manual or rules_high
 */
export const CATEGORY_CONFIDENCE_RANK: Record<string, number> = {
  manual: 0,
  rules_exact: 1,
  rules_high: 2,
  rules_medium: 3,
  enrichment: 3,   // AI via enrichment prompt — same rank as rules_medium
  rules_low: 4,
  ai: 5,
  ai_low: 6,
};

export function categoryConfidenceRank(
  confidence: string | null | undefined,
): number {
  if (!confidence) return Infinity;
  return CATEGORY_CONFIDENCE_RANK[confidence] ?? Infinity;
}
