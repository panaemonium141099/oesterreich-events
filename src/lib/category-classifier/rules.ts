/**
 * Central rule set for the deterministic classifier.
 *
 * Organised into five groups:
 *
 *   1. Strong title phrases (+20)  — multi-word unambiguous hits
 *   2. Title / tag / description tokens (+12 / +14 / +5)
 *   3. Trusted raw-tag map (+100 or +14 depending on strength)
 *   4. Source / venue / organizer priors (+8)
 *   5. Cross-category blockers (-18)
 *
 * Keeping all keyword knowledge in one file means the rules can be audited
 * and extended without hunting through 76 scrapers.
 */

import type { Category } from '@/types/events';

export const SCORE = {
  TRUSTED_EXACT: 100,
  STRONG_TITLE_PHRASE: 20,
  TITLE_TOKEN: 12,
  EXACT_RAW_TAG_MAP: 14,
  SOURCE_PRIOR: 8,
  DESCRIPTION_SIGNAL: 5,
  BLOCKER: -18,
} as const;

/**
 * Trusted raw-tag -> category exact mapping. These are the Feratel-style
 * vocabularies where the upstream taxonomy is curated. A match here yields the
 * TRUSTED_EXACT score (100) which satisfies deterministic accept condition #1
 * on its own, provided no blocker fires against the same category.
 */
export const TRUSTED_RAW_TAG_MAP: Record<string, Category> = {
  // Feratel
  Musik: 'Musik',
  Sport: 'Sport',
  Kultur: 'Kultur',
  Kulinarium: 'Wein & Kulinarik',
  'Kinder- & Familienveranstaltungen': 'Familie',
  'Bühne & Festival': 'Kultur',
  'Brauchtum & Feste': 'Feste & Brauchtum',
  'Tradition & Brauchtum': 'Feste & Brauchtum',
  Ausstellungen: 'Kultur',
  Bauernherbst: 'Feste & Brauchtum',
  'Unterhaltung & Tanzmusik': 'Musik',
  Advent: 'Feste & Brauchtum',
  'Ostern im Ausseerland': 'Feste & Brauchtum',
  Almsommer: 'Natur',
  'Nationalpark Exkursion': 'Natur',
  AKTIV: 'Sport',
  'Aktivität / Erlebnis': 'Sport',

  // Wien VADB / OGD style vocabularies (lowercase variants handled by matcher)
  Konzert: 'Musik',
  Theater: 'Kultur',
  Oper: 'Kultur',
  Ballett: 'Kultur',
  Ausstellung: 'Kultur',
  Kabarett: 'Kultur',
  Kino: 'Kultur',
  Film: 'Kultur',
  Lesung: 'Kultur',
  Vortrag: 'Bildung',
  Workshop: 'Bildung',
  Seminar: 'Bildung',
  Markt: 'Märkte',
  Flohmarkt: 'Märkte',
  Weihnachtsmarkt: 'Märkte',
  Adventmarkt: 'Märkte',
  Bauernmarkt: 'Märkte',
  Fest: 'Feste & Brauchtum',
  Kirtag: 'Feste & Brauchtum',
  Gottesdienst: 'Religion',
  Wallfahrt: 'Religion',
  Messe: 'Wirtschaft', // ambiguous; blocker fires against Religion if liturgisch organizer
  Fachmesse: 'Wirtschaft',
  Networking: 'Wirtschaft',
};

/**
 * Strong, multi-word title phrases (+20). Order-insensitive substring match.
 * These are distinctive enough to carry the decision by themselves in most cases.
 */
export const STRONG_TITLE_PHRASES: Record<Category, string[]> = {
  Nightlife: [
    'dj set', 'dj-set', 'club night', 'clubbing nacht', 'rave nacht',
    'open air rave', 'warehouse party', 'after hour', 'afterhour', 'after party',
    'ladies night', 'sunday dance', 'pub quiz', 'karaoke abend',
  ],
  Musik: [
    'live konzert', 'open air konzert', 'sommernachtskonzert', 'benefiz konzert',
    'adventkonzert', 'weihnachtskonzert', 'kirchenkonzert', 'orgelkonzert',
    'big band', 'singer-songwriter', 'open air festival',
  ],
  Kultur: [
    'theater stuck', 'theaterstuck', 'open-air-kino', 'sommerkino',
    'artist talk', 'vernissage', 'finissage',
    'guided tour', 'stadtfuhrung', 'schlossfuhrung', 'burgfuhrung',
    'dinner theater', 'morder dinner',
  ],
  Sport: [
    'open air sport', 'trail run', 'ultra marathon', 'stadtlauf',
    'bergwanderung', 'schneeschuhwanderung', 'geful hrte wanderung',
  ],
  'Feste & Brauchtum': [
    'tag der offenen tur', 'fest des jahres', 'advent zauber',
    'adventzauber', 'erntedank fest', 'feuerwehrfest',
  ],
  Märkte: [
    'weihnachts markt', 'weihnachtsmarkt', 'adventmarkt', 'bauernmarkt',
    'flohmarkt', 'christkindl markt', 'handwerker markt', 'kunsthandwerk markt',
  ],
  'Wein & Kulinarik': [
    'wein verkostung', 'weinverkostung', 'weinfruhling', 'weinherbst',
    'gin tasting', 'whiskey tasting', 'bier verkostung', 'kulinarik wanderung',
  ],
  Familie: [
    'oster eiersuche', 'ostereiersuche', 'familien tag', 'kinder workshop',
    'kinderprogramm', 'spiel nachmittag', 'feriencamp', 'ferien programm',
    'kinder theater', 'puppen theater',
  ],
  Natur: [
    'nationalpark exkursion', 'vogel beobachtung', 'krauter wanderung',
    'pilz wanderung', 'imker fuhrung', 'sternen wanderung',
  ],
  Bildung: [
    'info abend', 'informations abend', 'podiums diskussion',
    'erste hilfe', 'buch club', 'repair cafe',
  ],
  Gesundheit: [
    'gesundheits vortrag', 'blut spende', 'pflege beratung', 'selbst hilfe',
    'achtsamkeits training',
  ],
  Religion: [
    'heilige messe', 'hl messe', 'sonntags messe', 'oster nacht',
    'karfreitag liturgie', 'palm sonntag', 'kreuz weg',
  ],
  Wirtschaft: [
    'fach messe', 'gewerbe messe', 'branchen treff', 'unternehmer tag',
    'karriere messe', 'jobs messe', 'networking event', 'start up event',
  ],
  Sonstiges: [],
};

/** Single-token hits against title / tags (+12 title, +14 exact raw tag map). */
export const CATEGORY_TOKENS: Record<Category, string[]> = {
  Nightlife: [
    'rave', 'techno', 'house', 'psytrance', 'goa', 'hardstyle', 'hardcore',
    'dubstep', 'drum-and-bass', 'dnb', 'breakbeat', 'trance', 'industrial',
    'clubbing', 'clubnight', 'djset', 'disko', 'disco', 'party', 'afterhour',
    'afterparty', 'karaoke', 'club', 'clubs', 'nightlife', 'nachtleben',
  ],
  Musik: [
    'konzert', 'concert', 'musik', 'jazz', 'klassik', 'chor', 'orchester',
    'festival', 'liveband', 'livemusik', 'rock', 'pop', 'schlager', 'blues',
    'funk', 'soul', 'metal', 'indie', 'hiphop', 'rap', 'reggae', 'folk',
    'unplugged', 'acoustic', 'symphony', 'philharmonie', 'requiem', 'kammermusik',
    'blasmusik', 'volksmusik', 'matinee', 'serenade',
  ],
  Kultur: [
    'theater', 'ausstellung', 'museum', 'galerie', 'kunst', 'lesung',
    'literatur', 'kabarett', 'comedy', 'standup', 'kino', 'film',
    'operette', 'ballett', 'musical', 'vernissage', 'finissage',
    'performance', 'installation', 'fotografie', 'zirkus', 'variete',
    'oper', 'komodie', 'satire', 'schauspiel', 'tanztheater',
  ],
  Sport: [
    'sport', 'lauf', 'marathon', 'wanderung', 'wandern', 'hiking', 'biking',
    'cycling', 'bike', 'bouldern', 'klettern', 'yoga', 'fitness', 'gymnastik',
    'turnen', 'pilates', 'tennis', 'fussball', 'schwimmen', 'triathlon',
    'golf', 'reiten', 'segeln', 'surfen', 'kampfsport', 'motorsport',
    'skifahren', 'snowboard', 'eislaufen', 'eishockey', 'volleyball',
    'basketball', 'handball', 'rugby', 'leichtathletik', 'paddeln', 'rafting',
    'trailrunning', 'turnier',
  ],
  'Feste & Brauchtum': [
    'dorffest', 'ortsfest', 'volksfest', 'stadtfest', 'kirtag', 'kirchtag',
    'kirchweih', 'pfarrfest', 'maibaum', 'sonnwendfeier', 'erntedank',
    'almabtrieb', 'fasching', 'karneval', 'grillfest', 'sommerfest',
    'oktoberfest', 'silvester', 'punschstand', 'advent', 'ball', 'galaball',
    'brauchtum', 'tradition', 'tracht', 'schutzenfest',
  ],
  Märkte: [
    'markt', 'market', 'flohmarkt', 'weihnachtsmarkt', 'adventmarkt',
    'ostermarkt', 'bauernmarkt', 'handwerksmarkt', 'christkindlmarkt',
    'trodelmarkt', 'antikmarkt', 'nachtmarkt', 'wochenmarkt', 'genussmarkt',
    'kellergassenfest',
  ],
  'Wein & Kulinarik': [
    'weinfest', 'weinverkostung', 'weinwanderung', 'weinlese', 'winzer',
    'heuriger', 'buschenschank', 'verkostung', 'tasting', 'degustation',
    'kochkurs', 'gourmet', 'bierfest', 'brauerei', 'craftbeer', 'schnaps',
    'brunch', 'sennerei',
  ],
  Familie: [
    'kinder', 'kids', 'familie', 'family', 'kindertheater', 'puppentheater',
    'kinderfest', 'familypark', 'familientag', 'ferienprogramm',
    'ferienspiel', 'spielnachmittag', 'spieleabend', 'basteln', 'kasperl',
    'marchenstunde', 'kinderdisco', 'kinderkochkurs', 'erlebnispark',
    'abenteuerspielplatz',
  ],
  Natur: [
    'natur', 'nationalpark', 'naturfuhrung', 'naturerlebnis',
    'vogelbeobachtung', 'ornithologie', 'exkursion', 'tierpark', 'zoo',
    'wildpark', 'botanik', 'naturpark', 'almsommer', 'almwanderung',
    'krauter', 'wildkrauter', 'heilkrauter', 'flurreinigung', 'umwelt',
    'klimaschutz', 'sternwarte', 'astronomie', 'schaugarten', 'permakultur',
    'imker',
  ],
  Bildung: [
    'vortrag', 'seminar', 'workshop', 'kurs', 'fortbildung', 'weiterbildung',
    'schulung', 'sprachkurs', 'malkurs', 'zeichenkurs', 'erste-hilfe',
    'rettungskurs', 'infoabend', 'informationsabend',
    'podiumsdiskussion', 'tagung', 'symposium', 'kongress', 'werkstatt',
    'repair-cafe',
  ],
  Gesundheit: [
    'gesundheit', 'sprechstunde', 'elternberatung', 'sozialberatung',
    'rechtsberatung', 'pflegeberatung', 'blutspende', 'trauercafe',
    'selbsthilfe', 'therapie', 'physiotherapie', 'massage', 'wellness',
    'therme', 'meditation', 'achtsamkeit', 'burnout', 'vorsorge',
    'impfung',
  ],
  Religion: [
    'gottesdienst', 'festmesse', 'hochamt', 'andacht', 'anbetung', 'gebet',
    'rosenkranz', 'wallfahrt', 'pilger', 'prozession', 'fronleichnam',
    'palmsonntag', 'kreuzweg', 'karfreitag', 'osternacht', 'auferstehung',
    'himmelfahrt', 'pfingsten', 'firmung', 'erstkommunion', 'taufe',
    'rorate', 'seelsorge',
  ],
  Wirtschaft: [
    'wirtschaft', 'business', 'kongress', 'konferenz', 'networking',
    'karriere', 'jobmesse', 'branchentreff', 'fachtagung', 'handelsmesse',
    'gewerbe', 'unternehmer', 'startup', 'grunder', 'innovation',
    'wirtschaftsforum', 'b2b', 'fachmesse', 'gewerbemesse',
    'wirtschaftskammer', 'wko',
  ],
  Sonstiges: [],
};

/**
 * Cross-category blockers: when a certain hint (token or source) is present,
 * subtract BLOCKER (-18) from the target category. Designed to resolve the
 * classic ambiguities identified in the taxonomy definitions.
 */
export interface CategoryBlocker {
  /** Category whose score is reduced. */
  target: Category;
  /**
   * Condition description — one must match for the blocker to fire.
   * Checked against normalized title / description / organizer / source_name.
   */
  whenAnyToken: string[];
  /** Short human reason recorded in audit log. */
  reason: string;
}

export const BLOCKERS: CategoryBlocker[] = [
  // Oper = surgery vs opera
  {
    target: 'Kultur',
    whenAnyToken: ['operation', 'op-termin', 'op termin', 'chirurgie'],
    reason: 'medical context blocks Kultur for "Oper" match',
  },
  // Messe = fair vs catholic mass
  {
    target: 'Wirtschaft',
    whenAnyToken: ['pfarre', 'pfarrkirche', 'diozese', 'seelsorge'],
    reason: 'parish organizer blocks Wirtschaft for "Messe" match',
  },
  {
    target: 'Religion',
    whenAnyToken: ['wko', 'gewerbe', 'handelsmesse', 'fachmesse', 'branchentreff'],
    reason: 'trade-fair context blocks Religion for "Messe" match',
  },
  // Konzert in a church is Musik, but the original match would be Religion if
  // body talks about "gottesdienst". We keep the default positive scoring but
  // block Nightlife when a liturgical context is obvious.
  {
    target: 'Nightlife',
    whenAnyToken: ['pfarre', 'pfarrkirche', 'gottesdienst', 'diozese'],
    reason: 'liturgical context blocks Nightlife',
  },
  // Concerts vs club night disambiguation
  {
    target: 'Musik',
    whenAnyToken: ['open decks', 'line up', 'line-up', 'resident dj'],
    reason: 'DJ/line-up context blocks Musik in favour of Nightlife',
  },
  // Kinder content strongly blocks Nightlife even when "party" appears
  {
    target: 'Nightlife',
    whenAnyToken: ['kinder', 'kids', 'familienfreundlich', 'kindergeburtstag'],
    reason: 'kids audience blocks Nightlife for "party" match',
  },
  // Kulinarik vs Markt: a focused tasting is not a market
  {
    target: 'Märkte',
    whenAnyToken: ['weinverkostung', 'degustation', 'tasting', 'kochkurs'],
    reason: 'tasting/class context blocks Märkte',
  },
];

export interface SourcePrior {
  /**
   * Match patterns checked against normalized source_name / organizer /
   * venue (location_name). Any hit adds SOURCE_PRIOR (+8) to the target.
   */
  whenAnyToken: string[];
  target: Category;
  /** If true, treat as trusted-exact (+100) instead of +8. */
  trustedExact?: boolean;
  reason: string;
}

export const SOURCE_PRIORS: SourcePrior[] = [
  // Nightclubs and club-aggregators
  {
    whenAnyToken: [
      'wien-clubs', 'graz-clubs', 'salzburg-clubs', 'linz-clubs',
      'innsbruck-clubs', 'kleinstaedte-clubs', 'partytimer',
      'resident advisor', 'clubmap',
    ],
    target: 'Nightlife',
    trustedExact: true,
    reason: 'scraper is club/nightlife-only aggregator',
  },
  {
    whenAnyToken: ['popculture'],
    target: 'Nightlife',
    reason: 'popculture scraper is nightlife-heavy',
  },
  // Concert halls / music venues
  {
    whenAnyToken: [
      'rockhouse', 'szene-salzburg', 'stadthalle', 'konzerthaus',
      'musikverein', 'posthof',
    ],
    target: 'Musik',
    reason: 'venue is a concert hall / music-focused scraper',
  },
  // Theatre / bundestheater
  {
    whenAnyToken: [
      'burgtheater', 'volksoper', 'staatsoper', 'landestheater', 'stadttheater',
      'bundestheater', 'argekultur', 'basiskultur',
    ],
    target: 'Kultur',
    reason: 'venue is a theatre / cultural institution',
  },
  // Markets / trade
  {
    whenAnyToken: ['bauernmarkt', 'flohmarkt', 'weihnachtsmarkt', 'wochenmarkt'],
    target: 'Märkte',
    reason: 'source name indicates market',
  },
  {
    whenAnyToken: ['wko', 'wirtschaftskammer', 'messegelande', 'messe-wien'],
    target: 'Wirtschaft',
    reason: 'WKO / fair grounds organizer',
  },
  // Kulinarik
  {
    whenAnyToken: ['genussregion', 'heuriger', 'weingut', 'buschenschank', 'winzer'],
    target: 'Wein & Kulinarik',
    reason: 'wine / culinary institution',
  },
  // Family parks
  {
    whenAnyToken: ['familypark', 'familienpark', 'kinderbauernhof', 'ponyhof'],
    target: 'Familie',
    reason: 'family-focused venue',
  },
  // Nature / outdoor
  {
    whenAnyToken: ['nationalpark', 'naturpark', 'alpenverein', 'naturfreunde'],
    target: 'Natur',
    reason: 'nature-focused organizer',
  },
  // Religion
  {
    whenAnyToken: ['pfarre', 'pfarrgemeinde', 'diozese', 'seelsorgeraum'],
    target: 'Religion',
    reason: 'parish organizer',
  },
  // Sport / outdoor sport
  {
    whenAnyToken: ['bergfex', 'tirol-sport', 'outdoor-sport', 'sportverein'],
    target: 'Sport',
    reason: 'sport-focused source',
  },
];
