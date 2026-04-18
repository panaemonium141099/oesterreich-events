/**
 * Canonical category taxonomy used by the central classifier.
 *
 * The 14 names must exactly match the legacy values used throughout the app
 * (map filters, API query params, saved-event badges, blog schema, ...), so
 * these strings are considered a stable public API.
 *
 * `definitions` carry the disambiguation notes the AI fallback prompt reads
 * verbatim — they encode the project-specific judgement calls for the pairs
 * that confused the old keyword-only classifier.
 */

import type { Category } from '@/types/events';

/**
 * Compound classifier version. Three independent components allow us to
 * invalidate caches and trigger re-runs at different granularities:
 *
 * - `cat-vN`      — fundamental confidence model / gate structure change
 * - `rulesN`      — lexicon, scoring weights, blocker or disambiguator change
 * - `promptN`     — OpenAI system prompt change
 *
 * Events with `category_version` not matching `cat-v2-rules1-*` are considered
 * stale and are re-run by the deterministic-backfill pass. Cache keys embed
 * the full version string so any bump invalidates them automatically.
 */
export const CLASSIFIER_VERSION = 'cat-v2-rules1-prompt1' as const;

/** Prefix used by the backfill query's LIKE filter. Bump when rules change. */
export const CLASSIFIER_VERSION_PREFIX = 'cat-v2-rules1-' as const;

export const CATEGORIES: Category[] = [
  'Musik',
  'Kultur',
  'Sport',
  'Feste & Brauchtum',
  'Märkte',
  'Wein & Kulinarik',
  'Familie',
  'Natur',
  'Nightlife',
  'Bildung',
  'Gesundheit',
  'Religion',
  'Wirtschaft',
  'Sonstiges',
];

/**
 * Priority order for the deterministic tie-breaker and legacy compatibility
 * with `categorizeEventMulti`. When scores tie, earlier wins.
 *
 * Specific niches first, broad culture/music last. `Sonstiges` is never in
 * this list — it is only selected as an explicit fallback.
 */
export const PRIORITY_ORDER: Category[] = [
  'Nightlife',
  'Religion',
  'Gesundheit',
  'Natur',
  'Familie',
  'Feste & Brauchtum',
  'Märkte',
  'Wein & Kulinarik',
  'Sport',
  'Wirtschaft',
  'Bildung',
  'Kultur',
  'Musik',
];

export interface CategoryDefinition {
  /** Short one-liner shown to the AI fallback. */
  summary: string;
  /** Disambiguation guidance vs confusable siblings. */
  notes: string[];
}

/**
 * Explicit definitions the AI prompt consumes. These encode the project's
 * judgement calls for the pairs the rules layer cannot cleanly separate.
 */
export const CATEGORY_DEFINITIONS: Record<Category, CategoryDefinition> = {
  Musik: {
    summary:
      'Live concerts, orchestra, jazz, classical, choir, bands, singer-songwriter, open air concerts — music where listening is the point.',
    notes: [
      'Nightlife vs Musik: if the event centres on club culture, DJs, techno/house/electronic dance or late-night partying, pick Nightlife. Pick Musik when the draw is a named artist/band/ensemble performing a set.',
      'Kultur vs Musik: opera, operetta, musical and ballet are Kultur (staged theatre) — not Musik — unless the event is explicitly a concert performance.',
      'Religion vs Musik: Kirchenkonzert / Orgelkonzert are Musik; Gottesdienst mit Musik bleibt Religion.',
    ],
  },
  Kultur: {
    summary:
      'Theatre, opera, musical, ballet, film, kabarett, lesung, ausstellung, exhibition, museum, burg-/schloss-/stadtführung.',
    notes: [
      'Kultur vs Musik: staged performances (Theater/Oper/Musical/Ballett) are Kultur even if music is involved.',
      'Kultur vs Feste & Brauchtum: a "Kulturfest" that is really a dorffest/volksfest goes to Feste & Brauchtum; a curated festival of theatre/film goes to Kultur.',
      'Kultur vs Bildung: guided tours (Stadtführung/Burgführung) are Kultur even though they are educational.',
    ],
  },
  Sport: {
    summary:
      'Laufen, Wandern, Radfahren, Skifahren, Ballsport, Kampfsport, Yoga, Fitness, Turniere, Motorsport, Wassersport, Klettern.',
    notes: [
      'Sport vs Natur: guided hikes with a wildlife/nature educator are Natur; regular Wanderungen are Sport.',
      'Sport vs Familie: Kinderturnen and Familienwandertag skew Familie when the audience is explicitly kids.',
    ],
  },
  'Feste & Brauchtum': {
    summary:
      'Dorffest, Stadtfest, Volksfest, Kirtag, Maibaum, Fasching, Erntedank, Silvester/Punsch, Feuerwehrfest, Heurigenfest, Advent­zauber.',
    notes: [
      'Feste & Brauchtum vs Märkte: a Christkindlmarkt/Weihnachtsmarkt/Flohmarkt is Märkte. A Dorffest that merely has a market stand is Feste & Brauchtum.',
      'Feste & Brauchtum vs Religion: Pfarrfest/Kirtag are Feste & Brauchtum; Gottesdienst/Wallfahrt/Prozession are Religion.',
    ],
  },
  Märkte: {
    summary:
      'Weihnachts-, Oster-, Wochen-, Bauern-, Floh-, Trödel-, Handwerks-, Antik-, Genuss- and Kunst-handwerksmärkte.',
    notes: [
      'Märkte vs Wein & Kulinarik: a Weinmarkt/Bauernmarkt with multiple food vendors is Märkte; a Weinverkostung/Weinfest with a tasting focus is Wein & Kulinarik.',
      'Märkte vs Wirtschaft: consumer fairs (Messe als Verkaufsmesse) with generic goods are Märkte; trade fairs / B2B / Gewerbemesse are Wirtschaft.',
    ],
  },
  'Wein & Kulinarik': {
    summary:
      'Weinverkostung, Weinfest, Heuriger, Kochkurs, Kulinarik-Wanderung, Bierfest, Brauereiführung, Gin/Whiskey Tasting, Gourmet Dinner.',
    notes: [
      'Wein & Kulinarik vs Märkte: the tasting / curated-food / gastronomy-school focus is Kulinarik; the sells-many-things format is Märkte.',
      'Wein & Kulinarik vs Feste & Brauchtum: Heurigenfest/Weinlesefest leaning celebratory goes to Feste & Brauchtum when the brauchtum aspect dominates.',
    ],
  },
  Familie: {
    summary:
      'Kinderfest, Kindertheater, Familientag, Osterhasenfest, Ferienprogramm, Spielnachmittag, Eltern-Kind, Kinderworkshop.',
    notes: [
      'Familie vs Kultur: Kindertheater / Puppentheater / Kinderkonzert stay in Familie when the target audience is explicitly children.',
    ],
  },
  Natur: {
    summary:
      'Naturführung, Nationalpark, Vogelbeobachtung, Kräuterwanderung, Imkerei, Sternwarte, Botanik, Klimaschutz, Pilzwanderung.',
    notes: [
      'Natur vs Sport: "Wanderung" alone usually goes to Sport; if paired with Naturführung/Nationalpark/Botanik/Vogelbeobachtung it goes to Natur.',
      'Natur vs Bildung: a Vortrag about nature is Bildung; a guided outdoor experience is Natur.',
    ],
  },
  Nightlife: {
    summary:
      'Clubbing, DJ sets, techno, house, psytrance, rave, afterhour, karaoke, pub quiz, ladies/cocktail nights, warehouse parties.',
    notes: [
      'Nightlife vs Musik: if a specific band / ensemble / orchestra / singer headlines, prefer Musik. If the event is a DJ lineup / club night / electronic-music party with dancing as the focus, prefer Nightlife.',
      'Nightlife vs Feste & Brauchtum: Faschingsball/Feuerwehrball are Feste & Brauchtum; club parties in the same venue are Nightlife.',
    ],
  },
  Bildung: {
    summary:
      'Vortrag, Seminar, Workshop, Kurs, Fortbildung, Sprachkurs, Informationsabend, Podiumsdiskussion, offene Werkstatt.',
    notes: [
      'Bildung vs Wirtschaft: if the event is aimed at business development / networking / jobmessen / B2B, prefer Wirtschaft. Purely educational offerings without a business focus stay in Bildung.',
      'Bildung vs Kultur: Autorenlesung with Q&A is Bildung; a ticketed Lesung as a performance is Kultur.',
    ],
  },
  Gesundheit: {
    summary:
      'Blutspende, Gesundheitsvortrag, Selbsthilfegruppe, Meditation, Wellness, Vorsorgeuntersuchung, Pflegeberatung, Trauergruppe.',
    notes: [
      'Gesundheit vs Sport: Yoga/Pilates/Fitness stay in Sport; meditation / achtsamkeit / selbsthilfe sind Gesundheit.',
    ],
  },
  Religion: {
    summary:
      'Gottesdienst, Hochamt, Andacht, Wallfahrt, Prozession, Firmung, Erstkommunion, Taufe, Orgelkonzert (liturgisch), Rorate.',
    notes: [
      'Religion vs Kultur: Sakralkonzerte/Orgelkonzerte are Musik when purely performance, Religion when embedded in a Messe/Liturgie.',
      'Religion vs Feste & Brauchtum: Prozession/Wallfahrt sind Religion; Pfarrfest/Kirtag sind Feste & Brauchtum.',
    ],
  },
  Wirtschaft: {
    summary:
      'Fachmesse, Gewerbemesse, Unternehmertag, Branchentreff, Startup-Event, Karrieremesse, WKO-Veranstaltung, B2B Networking.',
    notes: [
      'Wirtschaft vs Bildung: a WKO / Gewerbe / Fachmesse / Branchentreff is Wirtschaft even if it contains seminars.',
      'Wirtschaft vs Märkte: a Verkaufsmesse with consumer goods is Märkte; B2B / Gewerbemesse is Wirtschaft.',
    ],
  },
  Sonstiges: {
    summary:
      'Fallback only — pick this ONLY when no other category fits the event at all.',
    notes: ['Never pick Sonstiges to avoid having to decide.'],
  },
};

/**
 * Confidence precedence helper. Lower rank = higher priority.
 *
 * Used by `reconcile.ts` to enforce overwrite semantics centrally:
 *   manual  untouchable
 *   rules_exact / rules_high  never overwritten by rules_low
 *   ai_low  never overwrites manual or rules_high
 *   same-rank + same-version + same-category  → no-op
 */
export const CATEGORY_CONFIDENCE_RANK: Record<string, number> = {
  manual: 0,
  rules_exact: 1,
  rules_high: 2,
  rules_medium: 3,
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
