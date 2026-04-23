/**
 * Category lexicon and scoring rules — cat-v2.
 *
 * The lexicon is split into precision classes per category. Matching style
 * differs per class (exact-word, word-boundary regex, curated compound regex,
 * or substring-only-for-long-stems-as-corroboration). See `signals.ts` for
 * the matcher implementations.
 *
 * Design goals (from the review):
 *   - No free substring matching. `markt` must not match inside `Neckenmarkt`.
 *   - Curated compound regex allowed so `sommerkonzert` matches Musik.
 *   - Long precise stems allowed as *corroborating* evidence only.
 *   - Stem families enable dedupe across related keywords.
 *   - Description signal never opens an accept gate alone.
 *   - Blockers are substring-OK on the full text (negative signals are less
 *     harmful when they over-fire than positive ones).
 */

import type { Category } from '@/types/events';

export const SCORE = {
  TRUSTED_EXACT: 100,
  HIGH_PRECISION_PHRASE: 20,
  HIGH_PRECISION_PATTERN: 20,
  HIGH_PRECISION_TOKEN: 14,
  WEAK_STEM_CONTAINS: 8,
  WEAK_CONTEXT_TOKEN: 6,
  DESCRIPTION_SIGNAL: 4,
  BLOCKER: -18,
} as const;

export interface CategoryLexicon {
  /** Raw-tag exact matches (case-insensitive). Worth TRUSTED_EXACT. */
  trustedRawTags: string[];
  /** Multi-word phrases matched with word boundaries. Worth HIGH_PRECISION_PHRASE. */
  highPrecisionPhrases: string[];
  /** Curated compound regex (e.g. /\bxxkonzert\b/). Worth HIGH_PRECISION_PATTERN. */
  highPrecisionPatterns: RegExp[];
  /** Exact whole-word matches. Worth HIGH_PRECISION_TOKEN. */
  highPrecisionTokens: string[];
  /** Long precise stems (>=6 chars typically) allowed as substring. CORROBORATION ONLY. */
  weakStemContains: string[];
  /** Exact whole-word tokens that provide only weak context. */
  weakContextTokens: string[];
  /**
   * Stem family declaration. Keys are stem-ids; values are the keyword
   * variants belonging to the family. Used to collapse redundant evidence
   * from the same semantic stem (e.g. konzert / sommerkonzert / konzertreihe).
   */
  stemFamilies: Record<string, string[]>;
}

/**
 * Per-category lexicon for the rule-based fallback classifier.
 *
 * Note: this still uses the legacy v1/v2 category names (Nightlife, Märkte,
 * Wein & Kulinarik, Bildung, Wirtschaft, Gesundheit, Religion). The rule-
 * based classifier is now only the backfill/fallback — the AI-enrichment
 * step (see src/scripts/enrich-openai.ts) writes the authoritative v3
 * categories from docs/TAXONOMY.md. Events processed by enrichment get
 * their legacy rule-category overwritten; events that skip enrichment
 * keep the legacy value until the SQL migration maps them over.
 *
 * Partial<Record> because the v3 target categories ("Nightlife & Party",
 * "Wissen & Karriere", etc.) have no legacy lexicon — they exist only
 * for AI output.
 */
export const LEXICON: Partial<Record<Category, CategoryLexicon>> = {
  Musik: {
    trustedRawTags: ['Musik', 'Konzert', 'Unterhaltung & Tanzmusik'],
    highPrecisionPhrases: [
      'live konzert', 'open air konzert', 'sommernachtskonzert', 'benefiz konzert',
      'kirchenkonzert', 'orgelkonzert', 'big band', 'singer songwriter',
      'chor konzert', 'jahreskonzert', 'abschlusskonzert',
    ],
    highPrecisionPatterns: [
      /\b[a-zäöüß]+konzert(e|en|s)?\b/,       // sommerkonzert, jazzkonzert, chorkonzert
      /\b[a-zäöüß]+philharmonie\b/,             // wiener philharmonie
      /\bphilharmoniker?\b/,                    // philharmoniker
      /\b[a-zäöüß]*orchester\b/,                // kammerorchester, jugendorchester
      /\b[a-zäöüß]*musikabend\b/,               // musikabend, tanzmusikabend
    ],
    highPrecisionTokens: [
      'konzert', 'concert', 'orchester', 'jazz', 'klassik', 'chor', 'matinee',
      'liederabend', 'serenade', 'symphonie', 'sinfonie', 'requiem', 'oratorium',
      'blasmusik', 'volksmusik', 'schlager', 'kammermusik', 'blueskonzert',
      'unplugged', 'livemusik', 'trachtenkapelle', 'musikkapelle',
    ],
    weakStemContains: ['konzert', 'symphon', 'philharmon'],
    weakContextTokens: ['festival', 'musik', 'music', 'live', 'band', 'open air'],
    stemFamilies: {
      konzert: ['konzert', 'concert', 'sommerkonzert', 'jazzkonzert', 'chorkonzert', 'kirchenkonzert', 'orgelkonzert', 'livekonzert', 'benefizkonzert', 'jahreskonzert', 'abschlusskonzert', 'adventkonzert', 'weihnachtskonzert', 'blueskonzert'],
      orchester: ['orchester', 'kammerorchester', 'jugendorchester', 'blasorchester', 'musikkapelle'],
      philharmon: ['philharmonie', 'philharmoniker', 'philharmonisch'],
    },
  },

  Nightlife: {
    trustedRawTags: [],
    highPrecisionPhrases: [
      'dj set', 'dj-set', 'club night', 'clubbing nacht', 'warehouse party',
      'after hour', 'afterhour', 'after party', 'afterparty', 'open decks',
      'ladies night', 'pub quiz', 'karaoke abend', 'club event',
    ],
    highPrecisionPatterns: [
      /\bdj\s+[a-zäöüß]+\b/,     // "dj xxx"
      /\bnight\s+club\b/,
    ],
    highPrecisionTokens: [
      'clubbing', 'clubnight', 'rave', 'raven', 'techno', 'psytrance', 'goa',
      'hardstyle', 'hardcore', 'dubstep', 'drum and bass', 'dnb', 'breakbeat',
      'afterhour', 'afterparty', 'karaoke', 'nightlife', 'nachtleben',
      'discoabend',
    ],
    weakStemContains: ['clubbing', 'afterhour', 'afterparty'],
    weakContextTokens: ['club', 'party', 'disco', 'disko', 'tanzabend'],
    stemFamilies: {
      club: ['club', 'clubs', 'clubbing', 'clubnight', 'club night'],
      party: ['party', 'afterparty', 'after party', 'warehouse party', 'clubbing nacht'],
      dj: ['dj', 'dj set', 'dj-set'],
      techno: ['techno', 'hard techno', 'dark techno', 'psytrance', 'goa'],
    },
  },

  Kultur: {
    trustedRawTags: ['Kultur', 'Theater', 'Oper', 'Ballett', 'Ausstellung', 'Ausstellungen', 'Kabarett', 'Kino', 'Film', 'Lesung', 'Bühne & Festival'],
    highPrecisionPhrases: [
      'theater stuck', 'open-air-kino', 'sommerkino', 'artist talk',
      'stadt fuhrung', 'stadtfuhrung', 'schloss fuhrung', 'schlossfuhrung',
      'burg fuhrung', 'burgfuhrung', 'dinner theater', 'morder dinner',
    ],
    highPrecisionPatterns: [
      /\btheater[a-zäöüß]*\b/,       // theaterstuck, theatersommer (not "theaterei" but good enough)
      /\bausstellung(en)?\b/,
      /\bmuse[au]m(s?|en)?\b/,        // museum, museen (loose form); substring-safe
    ],
    highPrecisionTokens: [
      'theater', 'theaterstuck', 'ausstellung', 'museum', 'galerie', 'lesung',
      'literatur', 'kabarett', 'comedy', 'standup', 'kino', 'kurzfilm',
      'operette', 'ballett', 'musical', 'vernissage', 'finissage',
      'performance', 'zirkus', 'variete', 'schauspiel', 'tanztheater',
      'kulturerbe',
    ],
    weakStemContains: ['theater', 'museum', 'ausstellung'],
    weakContextTokens: ['kultur', 'kunst', 'film', 'oper', 'buhne'],
    stemFamilies: {
      theater: ['theater', 'theaterstuck', 'theatersommer', 'tanztheater', 'kinder theater'],
      museum: ['museum', 'naturhistorisch', 'kunsthistorisch', 'kunsthalle'],
      kino: ['kino', 'sommerkino', 'open-air-kino', 'mondscheinkino'],
    },
  },

  Sport: {
    trustedRawTags: ['Sport', 'AKTIV', 'Aktivität / Erlebnis'],
    highPrecisionPhrases: [
      'trail run', 'ultra marathon', 'stadtlauf', 'volkslauf',
      'berg wanderung', 'bergwanderung', 'schneeschuh wanderung',
      'via ferrata', 'e-bike tour',
    ],
    highPrecisionPatterns: [
      /\b[a-zäöüß]*lauf\b/,          // marathon, stadtlauf
      /\b[a-zäöüß]*turnier\b/,
      /\b[a-zäöüß]*wanderung\b/,     // bergwanderung, themenwanderung
    ],
    highPrecisionTokens: [
      'marathon', 'wanderung', 'wandern', 'trailrunning', 'cycling', 'mountainbike',
      'e-bike', 'bouldern', 'klettern', 'yoga', 'pilates', 'fitness',
      'gymnastik', 'tennis', 'fussball', 'triathlon', 'schwimmen',
      'skifahren', 'snowboard', 'eislaufen', 'eishockey', 'volleyball',
      'basketball', 'handball', 'leichtathletik', 'turnier', 'meisterschaft',
      'motorsport', 'rafting', 'canyoning', 'paddeln',
    ],
    weakStemContains: ['wanderung', 'marathon'],
    weakContextTokens: ['sport', 'lauf', 'bike', 'hiking', 'run'],
    stemFamilies: {
      lauf: ['lauf', 'marathon', 'stadtlauf', 'volkslauf', 'trailrunning', 'ultramarathon'],
      wanderung: ['wanderung', 'wandern', 'bergwanderung', 'themenwanderung', 'schneeschuhwanderung', 'hike', 'hiking'],
      bike: ['bike', 'biking', 'cycling', 'mountainbike', 'e-bike', 'rennrad'],
      ball: ['fussball', 'volleyball', 'basketball', 'handball'],
    },
  },

  'Feste & Brauchtum': {
    trustedRawTags: [
      'Brauchtum & Feste', 'Tradition & Brauchtum', 'Bauernherbst',
      'Advent', 'Fest', 'Kirtag', 'Ostern im Ausseerland',
    ],
    highPrecisionPhrases: [
      'tag der offenen tur', 'fest des jahres', 'advent zauber', 'adventzauber',
      'erntedank fest', 'feuerwehrfest', 'sonnwend feier', 'sonnwendfeier',
      'oster feuer', 'osterfeuer',
    ],
    highPrecisionPatterns: [
      /\b(dorf|orts|volks|stadt|strassen|pfarr|gemeinde|feuerwehr|vereins|heurigen|garten|faschings|sommer|fruhlings|herbst|jubilaums|adven|neujahrs)fest\b/,
      /\b[a-zäöüß]*kirtag\b/,
      /\bmaibaum(aufstellen|fest)?\b/,
    ],
    highPrecisionTokens: [
      'dorffest', 'ortsfest', 'volksfest', 'stadtfest', 'strassenfest',
      'feuerwehrfest', 'vereinsfest', 'pfarrfest', 'kirtag', 'kirchtag',
      'maibaum', 'sonnwendfeier', 'erntedank', 'almabtrieb', 'fasching',
      'karneval', 'grillfest', 'sommerfest', 'oktoberfest', 'silvester',
      'punschstand', 'adventzauber', 'tracht', 'brauchtum', 'schutzenfest',
    ],
    weakStemContains: ['dorffest', 'feuerwehrfest', 'vereinsfest', 'erntedank'],
    weakContextTokens: ['fest', 'ball', 'galaball', 'brauchtum', 'tradition'],
    stemFamilies: {
      fest: ['fest', 'dorffest', 'ortsfest', 'volksfest', 'stadtfest', 'strassenfest', 'vereinsfest', 'pfarrfest', 'feuerwehrfest', 'grillfest', 'sommerfest', 'fruhlingsfest', 'herbstfest', 'oktoberfest', 'gartenfest'],
      kirtag: ['kirtag', 'kirchtag', 'kirchweih'],
      fasching: ['fasching', 'karneval', 'faschingsumzug', 'maskenzug'],
      advent: ['advent', 'adventzauber', 'adventfeier', 'nikolausfeier'],
    },
  },

  Märkte: {
    trustedRawTags: ['Markt', 'Flohmarkt', 'Weihnachtsmarkt', 'Adventmarkt', 'Bauernmarkt', 'Ostermarkt'],
    highPrecisionPhrases: [
      'weihnachts markt', 'advent markt', 'bauern markt', 'kunst handwerks markt',
      'hand werker markt', 'oster markt', 'christkindl markt', 'genuss markt',
      'kellergassenfest',
    ],
    highPrecisionPatterns: [
      // "Xmarkt" compounds — strict list of prefix stems to avoid matching inside place names.
      /\b(weihnachts|oster|advent|christkindl|bauern|floh|troedel|trodel|antik|nacht|wochen|genuss|handwerker|kunsthandwerks|handwerks|herbst|fruhlings|hausmesse|kellergassen|bio|samen|pflanzen)markt\b/,
    ],
    highPrecisionTokens: [
      'flohmarkt', 'weihnachtsmarkt', 'adventmarkt', 'ostermarkt', 'bauernmarkt',
      'handwerksmarkt', 'christkindlmarkt', 'trodelmarkt', 'antikmarkt',
      'nachtmarkt', 'wochenmarkt', 'genussmarkt', 'biomarkt', 'kunsthandwerk',
      'handwerkermarkt',
    ],
    // Note: `markt` alone is NOT in any list — only compound regex catches it.
    weakStemContains: [],
    weakContextTokens: ['market'],
    stemFamilies: {
      markt: [
        'flohmarkt', 'weihnachtsmarkt', 'adventmarkt', 'ostermarkt', 'bauernmarkt',
        'handwerksmarkt', 'christkindlmarkt', 'trodelmarkt', 'antikmarkt',
        'nachtmarkt', 'wochenmarkt', 'genussmarkt', 'biomarkt', 'handwerkermarkt',
        'herbstmarkt', 'fruhlingsmarkt',
      ],
    },
  },

  'Wein & Kulinarik': {
    trustedRawTags: ['Kulinarium'],
    highPrecisionPhrases: [
      'wein verkostung', 'weinverkostung', 'wein wanderung', 'weinwanderung',
      'gin tasting', 'whiskey tasting', 'bier verkostung', 'bierverkostung',
      'kulinarik wanderung', 'weinfruhling', 'weinherbst',
    ],
    highPrecisionPatterns: [
      /\b[a-zäöüß]*verkostung\b/,          // bierverkostung, schnapsverkostung
      /\b[a-zäöüß]*tasting\b/,
      /\bkoch(kurs|workshop)\b/,
    ],
    highPrecisionTokens: [
      'weinfest', 'weinverkostung', 'weinwanderung', 'weinlese', 'winzer',
      'heuriger', 'buschenschank', 'verkostung', 'tasting', 'degustation',
      'kochkurs', 'gourmet', 'bierfest', 'brauerei', 'craftbeer', 'schnaps',
      'brunch', 'sennerei', 'kase', 'kaseverkostung',
    ],
    weakStemContains: ['verkostung', 'weinfest'],
    weakContextTokens: ['wein', 'bier', 'kulinar', 'genuss', 'food', 'koch'],
    stemFamilies: {
      wein: ['wein', 'weinfest', 'weinverkostung', 'weinwanderung', 'weinlese', 'weingut', 'winzer', 'buschenschank', 'weinfruhling', 'weinherbst'],
      verkostung: ['verkostung', 'weinverkostung', 'bierverkostung', 'schnapsverkostung', 'degustation', 'tasting'],
      kochen: ['kochkurs', 'kochworkshop', 'kochabend'],
    },
  },

  Familie: {
    trustedRawTags: ['Kinder- & Familienveranstaltungen'],
    highPrecisionPhrases: [
      'oster eiersuche', 'ostereiersuche', 'familien tag', 'familientag',
      'kinder workshop', 'kinderworkshop', 'kinder programm', 'kinderprogramm',
      'spiel nachmittag', 'spielnachmittag', 'ferien camp', 'feriencamp',
      'ferien programm', 'ferienprogramm', 'kinder theater', 'kindertheater',
      'puppen theater', 'puppentheater', 'kinder fest', 'kinderfest',
    ],
    highPrecisionPatterns: [
      /\bkinder[a-zäöüß]*\b/,           // kinderfest, kinderdisco, kinderworkshop
      /\bfamilien[a-zäöüß]*\b/,          // familientag, familienpark, familienausflug
    ],
    highPrecisionTokens: [
      'kinderfest', 'kindertheater', 'puppentheater', 'familytag', 'familypark',
      'familienpark', 'familientag', 'ferienprogramm', 'ferienspiel',
      'spielnachmittag', 'spieleabend', 'basteln', 'kasperl', 'marchenstunde',
      'kinderdisco', 'kinderkochkurs', 'erlebnispark', 'abenteuerspielplatz',
    ],
    weakStemContains: ['kinder', 'familie', 'familien'],
    weakContextTokens: ['kids', 'family', 'kind'],
    stemFamilies: {
      kinder: ['kinder', 'kinderfest', 'kindertheater', 'puppentheater', 'kinderworkshop', 'kinderprogramm', 'kinderdisco', 'kinderkochkurs'],
      familie: ['familie', 'family', 'familientag', 'familypark', 'familienpark', 'familienausflug'],
      ferien: ['ferien', 'feriencamp', 'ferienprogramm', 'ferienspiel', 'ferienwoche'],
    },
  },

  Natur: {
    trustedRawTags: ['Almsommer', 'Nationalpark Exkursion'],
    highPrecisionPhrases: [
      'nationalpark exkursion', 'vogel beobachtung', 'vogelbeobachtung',
      'krauter wanderung', 'krauterwanderung', 'pilz wanderung',
      'imker fuhrung', 'imkerfuhrung', 'sternen wanderung', 'sternenwanderung',
    ],
    highPrecisionPatterns: [
      /\b(natur|national|imker)[a-zäöüß]*\b/,
    ],
    highPrecisionTokens: [
      'nationalpark', 'naturfuhrung', 'naturerlebnis', 'vogelbeobachtung',
      'ornithologie', 'naturpark', 'almsommer', 'almwanderung', 'krauter',
      'wildkrauter', 'heilkrauter', 'flurreinigung', 'sternwarte', 'astronomie',
      'schaugarten', 'permakultur', 'imker', 'tierpark', 'wildpark',
    ],
    weakStemContains: ['natur', 'nationalpark'],
    weakContextTokens: ['garten', 'umwelt', 'klimaschutz', 'botanik', 'zoo'],
    stemFamilies: {
      natur: ['natur', 'naturfuhrung', 'naturerlebnis', 'naturpark', 'nationalpark'],
      imker: ['imker', 'imkerfuhrung', 'bienen', 'honig'],
    },
  },

  Bildung: {
    trustedRawTags: ['Vortrag', 'Workshop', 'Seminar'],
    highPrecisionPhrases: [
      'info abend', 'informations abend', 'infoabend', 'informationsabend',
      'podiums diskussion', 'podiumsdiskussion', 'erste hilfe', 'erste-hilfe',
      'repair cafe', 'offene werkstatt',
    ],
    highPrecisionPatterns: [
      /\b[a-zäöüß]*workshop\b/,
      /\b[a-zäöüß]*seminar\b/,
      /\b[a-zäöüß]*vortrag\b/,
    ],
    highPrecisionTokens: [
      'vortrag', 'seminar', 'workshop', 'fortbildung', 'weiterbildung',
      'sprachkurs', 'malkurs', 'zeichenkurs', 'infoabend', 'informationsabend',
      'podiumsdiskussion', 'tagung', 'symposium', 'kongress', 'werkstatt',
    ],
    weakStemContains: ['vortrag', 'workshop', 'seminar'],
    weakContextTokens: ['kurs', 'schulung', 'bildung'],
    stemFamilies: {
      vortrag: ['vortrag', 'fachvortrag', 'autorenlesung'],
      workshop: ['workshop', 'kinderworkshop', 'fotoworkshop'],
      seminar: ['seminar', 'wochenendseminar'],
    },
  },

  Gesundheit: {
    trustedRawTags: [],
    highPrecisionPhrases: [
      'blut spende', 'blutspende', 'pflege beratung', 'pflegeberatung',
      'selbst hilfe', 'selbsthilfe', 'achtsamkeits training', 'gesundheits vortrag',
    ],
    highPrecisionPatterns: [
      /\bgesundheits[a-zäöüß]*\b/,
    ],
    highPrecisionTokens: [
      'blutspende', 'pflegeberatung', 'selbsthilfe', 'therapie', 'physiotherapie',
      'massage', 'wellness', 'therme', 'meditation', 'achtsamkeit', 'burnout',
      'vorsorge', 'impfung', 'sprechstunde',
    ],
    weakStemContains: ['gesundheit'],
    weakContextTokens: ['beratung', 'therapie', 'pflege'],
    stemFamilies: {
      gesundheit: ['gesundheit', 'gesundheitsvortrag', 'gesundheitsforderung'],
      beratung: ['beratung', 'pflegeberatung', 'sozialberatung', 'rechtsberatung'],
    },
  },

  Religion: {
    trustedRawTags: ['Gottesdienst', 'Wallfahrt'],
    highPrecisionPhrases: [
      'heilige messe', 'hl messe', 'sonntags messe', 'oster nacht',
      'karfreitag liturgie', 'palm sonntag', 'kreuz weg',
    ],
    highPrecisionPatterns: [
      /\b(gottes|fest|sonntags|hoch|werk|abend|fruh|kinder)dienst\b/,
    ],
    highPrecisionTokens: [
      'gottesdienst', 'festmesse', 'hochamt', 'andacht', 'anbetung', 'gebet',
      'rosenkranz', 'wallfahrt', 'pilger', 'prozession', 'fronleichnam',
      'palmsonntag', 'kreuzweg', 'karfreitag', 'osternacht', 'auferstehung',
      'himmelfahrt', 'pfingsten', 'firmung', 'erstkommunion', 'taufe',
      'rorate', 'seelsorge',
    ],
    weakStemContains: ['gottesdienst', 'messe', 'wallfahrt'],
    weakContextTokens: ['kirche', 'pfarre', 'liturgie', 'hochamt'],
    stemFamilies: {
      messe: ['messe', 'hlmesse', 'sonntagsmesse', 'festmesse', 'hochamt'],
      gebet: ['gebet', 'andacht', 'anbetung', 'rosenkranz'],
      ostern: ['osternacht', 'osterfeuer', 'karfreitag', 'kreuzweg', 'palmsonntag'],
    },
  },

  Wirtschaft: {
    trustedRawTags: ['Fachmesse', 'Networking'],
    highPrecisionPhrases: [
      'fach messe', 'fachmesse', 'gewerbe messe', 'gewerbemesse', 'branchen treff',
      'branchentreff', 'unternehmer tag', 'unternehmertag', 'karriere messe',
      'karrieremesse', 'networking event', 'start up event', 'startup pitch',
      'b2b networking',
    ],
    highPrecisionPatterns: [
      /\b(fach|gewerbe|handels|karriere|jobs?|hausmesse|auto)messe\b/,
    ],
    highPrecisionTokens: [
      'wirtschaftskammer', 'wko', 'fachmesse', 'gewerbemesse', 'handelsmesse',
      'karrieremesse', 'jobmesse', 'networking', 'branchentreff', 'fachtagung',
      'unternehmer', 'startup', 'grunder', 'b2b',
    ],
    weakStemContains: ['messe', 'gewerbe'],
    weakContextTokens: ['wirtschaft', 'business', 'firmenfeier'],
    stemFamilies: {
      messe: ['fachmesse', 'gewerbemesse', 'handelsmesse', 'karrieremesse', 'jobmesse'],
      unternehmer: ['unternehmer', 'unternehmertag', 'startup', 'grunder', 'b2b'],
    },
  },

  Sonstiges: {
    trustedRawTags: [],
    highPrecisionPhrases: [],
    highPrecisionPatterns: [],
    highPrecisionTokens: [],
    weakStemContains: [],
    weakContextTokens: [],
    stemFamilies: {},
  },
};

/**
 * Negative blockers. Substring-OK on the full text (title + description +
 * source context). Fire against a specific target category. Values are
 * normalized (lowercase, no diacritics) already.
 */
export interface CategoryBlocker {
  target: Category;
  whenAnyToken: string[];
  reason: string;
}

export const NEGATIVE_BLOCKERS: CategoryBlocker[] = [
  {
    target: 'Kultur',
    whenAnyToken: ['operation', 'op termin', 'op-termin', 'chirurgie'],
    reason: 'medical context blocks Kultur for "oper" matches',
  },
  {
    target: 'Wirtschaft',
    whenAnyToken: ['pfarre', 'pfarrkirche', 'diozese', 'seelsorge', 'erzdiozese'],
    reason: 'parish context blocks Wirtschaft for "messe" matches',
  },
  {
    target: 'Religion',
    whenAnyToken: ['wko', 'gewerbe', 'handelsmesse', 'fachmesse', 'branchentreff', 'startup pitch'],
    reason: 'trade-fair context blocks Religion for "messe" matches',
  },
  {
    target: 'Nightlife',
    whenAnyToken: ['pfarre', 'gottesdienst', 'kinder', 'kids', 'familienfreundlich'],
    reason: 'liturgical or kids context blocks Nightlife',
  },
  {
    target: 'Musik',
    whenAnyToken: ['open decks', 'line-up', 'resident dj', 'dj lineup'],
    reason: 'club lineup context blocks Musik in favour of Nightlife',
  },
  {
    target: 'Märkte',
    whenAnyToken: ['weinverkostung', 'degustation'],
    reason: 'dedicated tasting context blocks Märkte',
  },
];

/**
 * Pairwise disambiguator matrix. Only the six registered confusable pairs.
 * Lambdas are pure: they inspect evidence and return a category or null.
 */
export interface DisambiguatorContext {
  /** Normalized title text (post-location-detox). */
  title: string;
  /** Normalized description text (cleaned). */
  description: string;
  /** Normalized source_name. */
  sourceName: string;
  /** Normalized organizer. */
  organizer: string;
}

export interface Disambiguator {
  pair: [Category, Category];
  resolve(ctx: DisambiguatorContext): Category | null;
}

const hasAny = (text: string, needles: string[]): boolean =>
  needles.some(n => text.includes(n));

export const DISAMBIGUATOR_PAIRS: Disambiguator[] = [
  {
    pair: ['Nightlife', 'Musik'],
    resolve(ctx) {
      const nightlifeHits = hasAny(
        ctx.title + ' ' + ctx.description,
        ['dj set', 'dj-set', 'clubbing', 'rave', 'club night', 'afterparty', 'afterhour', 'techno', 'psytrance', 'hardstyle', 'warehouse party', 'resident dj', 'line-up'],
      );
      const musikHits = hasAny(
        ctx.title + ' ' + ctx.description,
        ['orchester', 'chor', 'matinee', 'philharmonie', 'philharmoniker', 'sinfonie', 'symphon', 'oratorium', 'requiem', 'liederabend', 'kirchenkonzert', 'blasmusik'],
      );
      const isClubVenue = hasAny(ctx.sourceName + ' ' + ctx.organizer, ['wien-clubs', 'graz-clubs', 'salzburg-clubs', 'linz-clubs', 'clubmap', 'ra.co', 'partytimer', 'rockhouse']);
      const isConcertVenue = hasAny(ctx.sourceName + ' ' + ctx.organizer, ['konzerthaus', 'musikverein']);
      if (isClubVenue && !musikHits) return 'Nightlife';
      if (isConcertVenue && !nightlifeHits) return 'Musik';
      if (nightlifeHits && !musikHits) return 'Nightlife';
      if (musikHits && !nightlifeHits) return 'Musik';
      return null;
    },
  },
  {
    pair: ['Märkte', 'Wein & Kulinarik'],
    resolve(ctx) {
      const marketCompound = /\b(weihnachts|oster|advent|christkindl|bauern|floh|wochen|genuss|biomarkt)markt\b/.test(ctx.title);
      const tastingFocus = hasAny(ctx.title + ' ' + ctx.description, ['verkostung', 'tasting', 'degustation', 'heuriger', 'buschenschank', 'winzer', 'kochkurs']);
      if (marketCompound && !tastingFocus) return 'Märkte';
      if (tastingFocus && !marketCompound) return 'Wein & Kulinarik';
      return null;
    },
  },
  {
    pair: ['Bildung', 'Wirtschaft'],
    resolve(ctx) {
      const educational = hasAny(ctx.title + ' ' + ctx.description, ['workshop', 'seminar', 'vortrag', 'kurs', 'fortbildung']);
      const business = hasAny(ctx.title + ' ' + ctx.description, ['networking', 'jobmesse', 'karrieremesse', 'branchentreff', 'fachmesse', 'startup pitch', 'b2b', 'gewerbemesse', 'wirtschaftskammer', 'wko']);
      if (business && !educational) return 'Wirtschaft';
      if (educational && !business) return 'Bildung';
      return null;
    },
  },
  {
    pair: ['Religion', 'Kultur'],
    resolve(ctx) {
      const liturgical = hasAny(ctx.title + ' ' + ctx.description, ['gottesdienst', 'hochamt', 'andacht', 'wallfahrt', 'prozession', 'firmung', 'osternacht', 'karfreitag', 'pfarre']);
      const cultural = hasAny(ctx.title + ' ' + ctx.description, ['theater', 'ausstellung', 'museum', 'lesung', 'kabarett', 'vernissage']);
      if (liturgical && !cultural) return 'Religion';
      if (cultural && !liturgical) return 'Kultur';
      return null;
    },
  },
  {
    pair: ['Religion', 'Musik'],
    resolve(ctx) {
      const liturgical = hasAny(ctx.title + ' ' + ctx.description, ['gottesdienst', 'hochamt', 'festmesse', 'osternacht', 'karfreitag', 'wallfahrt', 'prozession', 'firmung', 'pfarre']);
      const concert = hasAny(ctx.title, ['konzert', 'orchester', 'chor', 'matinee', 'symphon', 'philharmon']);
      if (concert && !liturgical) return 'Musik';
      if (liturgical && !concert) return 'Religion';
      return null;
    },
  },
  {
    pair: ['Feste & Brauchtum', 'Märkte'],
    resolve(ctx) {
      const festIndicator = /\b(dorf|orts|volks|stadt|pfarr|gemeinde|feuerwehr|vereins)fest\b/.test(ctx.title) || hasAny(ctx.title, ['kirtag', 'maibaum', 'fasching', 'erntedank', 'sonnwendfeier']);
      const marketIndicator = /\b(weihnachts|oster|advent|christkindl|bauern|floh|wochen|genuss)markt\b/.test(ctx.title);
      if (festIndicator && !marketIndicator) return 'Feste & Brauchtum';
      if (marketIndicator && !festIndicator) return 'Märkte';
      return null;
    },
  },
];
