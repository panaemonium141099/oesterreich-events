import type { Category } from '@/types/events';

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
  'Sonstiges',
];

// Keywords per category. Order matters: first match in PRIORITY_ORDER wins.
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  'Nightlife': [
    // Electronic music / rave
    'rave', 'raven', 'drum and bass', 'drum & bass', 'dnb', 'neurofunk',
    'techno', 'tech house', 'tech-house', 'hard techno', 'dark techno', 'acid techno',
    'psytrance', 'psy trance', 'goa', 'progressive trance',
    'hardstyle', 'hardcore', 'gabber', 'frenchcore',
    'dubstep', 'riddim', 'bass music', 'minimal techno', 'dub techno',
    'afterhour', 'after hour', 'afterparty', 'after party',
    'underground party', 'warehouse party', 'free party', 'tekno',
    'breakbeat', 'breaks', 'uk garage', 'trance',
    'industrial', 'ebm', 'dark electro',
    // Club / nightlife
    'clubbing', 'club night', 'dj set', 'dj-set', 'dance night', 'tanzabend',
    'party ', 'partynacht', 'nachtleben', 'nightlife',
    'discoabend', 'disko', 'disco night',
    'karaoke', 'pub quiz',
    'cocktail', 'cocktailnight', 'ladies night',
    'sunday dance', 'hangover party',
  ],
  'Sport': [
    'sport', 'lauf', 'marathon', 'radmarathon', 'radtour', 'radeln', 'losradeln',
    'radfahren', 'rad ', 'radausfahrt', 'radwandertag',
    'bike', 'biking', 'cycling', 'mountainbike', 'e-bike',
    'run ', 'running', 'parkrun', 'stadtlauf', 'volkslauf',
    'wanderung', 'wandern', 'hike', 'hiking', 'bergwanderung', 'schneeschuhwanderung',
    'fußball', 'fussball', 'tennis', 'schwimmen', 'triathlon',
    'yoga', 'fitness', 'gymnastik', 'turnen', 'pilates', 'qigong', 'tai chi',
    'golf', 'reiten', 'segeln', 'surfen', 'klettern', 'bouldern',
    'kampfsport', 'kampfkunst', 'turnier', 'meisterschaft',
    'skifahren', 'ski ', 'skitour', 'snowboard', 'eislaufen', 'eishockey', 'langlauf',
    'volleyball', 'basketball', 'handball', 'rugby', 'leichtathletik',
    'motorsport', 'motocross', 'formel', 'rally',
    'draisine', 'draisinentour',
    'kuppelcup', 'sportfest', 'sportwoche', 'sportverein',
    'schießen', 'preisschnapsen', 'kegelabend', 'kegeln',
    'krafttraining', 'workout', 'crossfit', 'zumba',
    'paddeln', 'rudern', 'rafting', 'canyoning', 'paragleit',
  ],
  'Natur': [
    'natur', 'nature', 'nationalpark', 'naturführung', 'naturerlebnis',
    'vogelbeobachtung', 'vogelkund', 'ornitholog',
    'exkursion', 'tierpark', 'zoo', 'wildpark', 'botanik',
    'naturpark', 'almsommer', 'almwanderung', 'bergwelt',
    'pilze', 'kräuter', 'wildkräuter', 'heilkräuter',
    'flurreinigung', 'umwelt', 'klimaschutz', 'nachhaltig',
    'sternwarte', 'astronomie', 'sternenwanderung',
    'garten', 'schaugarten', 'permakultur',
    'imker', 'bienen', 'honig',
  ],
  'Familie': [
    'kinder', 'kids', 'familie', 'family', 'kindertheater', 'puppentheater',
    'kinderfest', 'spielplatz', 'familientag', 'familypark', 'familienpark',
    'kinderführung', 'kinderworkshop', 'kinderprogramm',
    'ostereiersuche', 'ostereierfärben', 'osterhasenfest',
    'feriencamp', 'ferienprogramm', 'ferienwoche', 'ferienspiel',
    'spielnachmittag', 'spieleabend', 'basteln', 'bastelnachmittag',
    'jugendzentrum', 'jugendclub', 'jugendtreff',
    'zwergerltreff', 'eltern-kind', 'mutter-kind', 'mama-kind',
    'kasperl', 'kasperltheater', 'märchenstunde',
    'kinderturnen', 'babyschwimmen', 'kinderdisco',
    'kinderkochkurs', 'kinderbacken',
  ],
  'Feste & Brauchtum': [
    'dorffest', 'ortsfest', 'volksfest', 'stadtfest', 'straßenfest',
    'feuerwehrfest', 'vereinsfest', 'heurigenfest', 'gartenfest',
    'kirtag', 'kirchtag', 'kirchweih', 'pfarrfest', 'pfarrcafe',
    'maibaum', 'maibaumfest', 'maibaumaufstellen',
    'sonnwendfeier', 'sonnwendfest', 'johannisfeuer',
    'erntedankfest', 'erntedank', 'almabtrieb', 'almfest',
    'fasching', 'karneval', 'faschingsumzug', 'maskenzug',
    'grillfest', 'grillabend', 'sommerfest', 'frühlingsfest',
    'herbstfest', 'oktoberfest', 'bockbierfest',
    'osterfeuer', 'osterfest', 'osternacht',
    'frühschoppen', 'dämmerschoppen', 'heuriger',
    'hüttengaudi', 'hüttenfest', 'almhütte',
    'brauchtum', 'tradition', 'tracht', 'schützenfest',
    'jubiläum', 'jubiläumsfeier', 'geburtstag',
    'silvester', 'neujahr', 'punschstand',
    'adventfeier', 'adventzauber', 'nikolausfeier',
    'ball ', 'galaball', 'feuerwehrball', 'bäuerinnnenball',
    'stammtisch', 'seniorentreffen', 'seniorennachmittag',
    'fest des jahres', 'festveranstaltung',
    'bauernherbst',
  ],
  'Märkte': [
    'markt', 'market', 'ostermarkt', 'weihnachtsmarkt', 'adventmarkt',
    'flohmarkt', 'bauernmarkt', 'handwerksmarkt', 'christkindlmarkt',
    'frühlingsmarkt', 'herbstmarkt', 'trödelmarkt', 'antikmarkt',
    'nachtmarkt', 'wochenmarkt', 'genussmarkt',
    'kunsthandwerk', 'handwerkermarkt',
    'samentausch', 'pflanzentausch', 'pflanzenmarkt',
    'kellergasse', 'kellergassenfest',
    'messe ', 'messegelände', 'fachmesse', 'hausmesse',
  ],
  'Wein & Kulinarik': [
    'weinfrühling', 'weinherbst', 'weinverkostung', 'weinfest', 'weinwanderung',
    'weinkultur', 'weinlese', 'winzer', 'weingut', 'weinbau',
    'heuriger', 'buschenschank', 'weinstraße',
    'kulinarik', 'kulinarisch', 'verkostung', 'tasting', 'degustation',
    'genuss', 'kochen', 'kochkurs', 'kochworkshop',
    'gastronomie', 'slow food', 'gourmet',
    'bier ', 'bierfest', 'brauerei', 'braufest', 'craftbeer',
    'schnaps', 'destillerie', 'gin tasting',
    'steak', 'bbq', 'grillkurs', 'burger',
    'käse', 'käseverkostung', 'sennerei',
    'backen', 'brotbacken', 'bäckerei',
    'brunch', 'frühstück', 'mittagstisch',
  ],
  'Kultur': [
    'theater', 'theaterstück', 'theatersommer',
    'ausstellung', 'exhibition', 'museum', 'galerie', 'kunst',
    'lesung', 'literatur', 'buchpräsentation', 'buchvorstellung',
    'kabarett', 'comedy', 'stand-up', 'standup',
    'kino', 'film ', 'filmabend', 'filmvorführung', 'kurzfilm', 'dokumentarfilm',
    'oper ', 'operette', 'ballett', 'musical',
    'vernissage', 'finissage', 'artist talk',
    'performance', 'installation', 'fotografie',
    'zirkus', 'varieté', 'variete', 'akrobatik',
    'komödie', 'satire', 'kultur',
    'lesebühne', 'storytelling', 'slam', 'poetry',
    'magic', 'magie', 'zauberer', 'zaubershow',
    'clown', 'jonglage', 'jongleur',
    'burgführung', 'schlossführung', 'stadtführung', 'museumsführung',
    'besichtigung', 'führung', 'rundgang',
    'open-air-kino', 'sommerkino', 'mondscheinkino',
    'krimi', 'dinner theater', 'mörderdinner',
    'architektur', 'denkmal', 'kulturerbe',
  ],
  'Musik': [
    'konzert', 'concert', 'musik', 'music', 'jazz', 'klassik',
    'chor', 'chorkonzert', 'orchester', 'festival', 'musikfestival',
    'band ', 'liveband', 'livemusik', 'live-musik', 'live music',
    'rock', 'pop', 'symphonie', 'kammermusik', 'liederabend',
    'blasmusik', 'blasorchester', 'musikkapelle', 'trachtenkapelle',
    'duett', 'quartett', 'trio', 'quintett', 'ensemble',
    'serenade', 'matinee', 'open air', 'singabend',
    'schlager', 'volksmusik', 'volksmusikabend', 'schlagernacht',
    'kirchenkonzert', 'benefizkonzert', 'sommernachtskonzert',
    'brass', 'big band', 'swing', 'blues', 'funk', 'soul',
    'tribute', 'cover', 'unplugged', 'acoustic',
    'heavy metal', 'metal', 'indie', 'electro', 'hiphop', 'hip hop', 'rap',
    'symphony', 'philharmon', 'requiem', 'passion', 'missa',
    'tanzkapelle', 'tanzmusik', 'unterhaltungsmusik',
    'saisonkonzert', 'jahreskonzert', 'frühlingskonzert', 'herbstkonzert',
    'weihnachtskonzert', 'adventkonzert', 'sommerkonzert',
    'abschlusskonzert', 'platzkonzert', 'promenadenkonzert',
    'reggae', 'country', 'folk', 'flamenco', 'salsa',
    'singer-songwriter', 'songwriter',
    'gala nacht', 'galanacht', 'musikabend',
    'sounds', 'grooves', 'beats',
  ],
  'Bildung': [
    'vortrag', 'seminar', 'workshop', 'kurs ',
    'fortbildung', 'weiterbildung', 'schulung',
    'exkursion', 'führung',
    'sprachkurs', 'malkurs', 'zeichenkurs', 'töpferkurs',
    'erste hilfe', 'erste-hilfe', 'rettungskurs',
    'flechtenseminar', 'nähkurs', 'handarbeit',
    'informationsveranstaltung', 'informationsabend', 'infoabend',
    'podiumsdiskussion', 'diskussionsrunde',
    'autorenlesung', 'buchclub', 'lesekreis',
    'tagung', 'symposium', 'kongress',
    'offene werkstatt', 'repair café', 'repair cafe',
  ],
  'Gesundheit': [
    'gesundheit', 'sprechtag', 'sprechstunde',
    'elternberatung', 'sozialberatung', 'rechtsberatung',
    'pflegende angehörige', 'pflegeberatung',
    'blutspende', 'blutspendeaktion',
    'trauercafé', 'trauergruppe', 'selbsthilfe',
    'therapie', 'physiotherapie', 'massage',
    'wellness', 'therme', 'entspannung',
    'meditation', 'achtsamkeit', 'burnout',
    'gesundheitsvortrag', 'gesundheitsförderung',
    'impfung', 'vorsorge', 'gesundenuntersuchung',
  ],
  'Religion': [
    'gottesdienst', 'festgottesdienst', 'festmesse', 'hochamt',
    'heilige messe', 'hl. messe', 'sonntagsmesse', 'abendmesse',
    'vesper', 'andacht', 'anbetung', 'gebet', 'rosenkranz',
    'wallfahrt', 'fußwallfahrt', 'buswallfahrt', 'pilger',
    'prozession', 'fronleichnam', 'palmsonntag', 'palmweihe',
    'kreuzweg', 'kreuzwegandacht', 'karfreitag', 'osternacht',
    'auferstehung', 'himmelfahrt', 'pfingsten',
    'firmung', 'erstkommunion', 'taufe',
    'kirchenmusik', 'orgelkonzert', 'orgelmusik',
    'advent', 'adventgesang', 'rorate',
    'seelsorge', 'bibelrunde', 'bibelkreis',
    'pfarrgemeinde', 'pfarrversammlung',
    'ökumenisch', 'interreligiös',
    'herz-jesu', 'florianimesse', 'hubertusmesse',
    'speisensegnung', 'ostereinsegnung',
  ],
  'Sonstiges': [],
};

// Priority order: specific first, broad last
const PRIORITY_ORDER: Category[] = [
  'Nightlife', 'Religion', 'Gesundheit', 'Natur', 'Familie',
  'Feste & Brauchtum', 'Märkte', 'Wein & Kulinarik', 'Sport',
  'Bildung', 'Kultur', 'Musik',
];

// Feratel tag → Category mapping
const FERATEL_TAG_MAP: Record<string, Category> = {
  'Musik': 'Musik',
  'Sport': 'Sport',
  'Kultur': 'Kultur',
  'Kulinarium': 'Wein & Kulinarik',
  'Kinder- & Familienveranstaltungen': 'Familie',
  'Bühne & Festival': 'Kultur',
  'Brauchtum & Feste': 'Feste & Brauchtum',
  'Tradition & Brauchtum': 'Feste & Brauchtum',
  'Ausstellungen': 'Kultur',
  'Bauernherbst': 'Feste & Brauchtum',
  'Unterhaltung & Tanzmusik': 'Musik',
  'Advent': 'Feste & Brauchtum',
  'Ostern im Ausseerland': 'Feste & Brauchtum',
  'Almsommer': 'Natur',
  'Nationalpark Exkursion': 'Natur',
  'AKTIV': 'Sport',
  'Aktivität / Erlebnis': 'Sport',
};

export function categorizeEvent(title: string, description?: string, tags?: string[]): Category {
  const titleText = title.toLowerCase();
  const tagList = tags || [];
  const tagText = tagList.join(' ').toLowerCase();
  const descText = (description || '').toLowerCase();

  // Priority 0: Map feratel tags directly if available
  for (const tag of tagList) {
    if (FERATEL_TAG_MAP[tag]) {
      return FERATEL_TAG_MAP[tag];
    }
  }

  // Priority 1: match against title (most reliable)
  for (const category of PRIORITY_ORDER) {
    const keywords = CATEGORY_KEYWORDS[category];
    if (keywords.some(kw => titleText.includes(kw.trim()))) {
      return category;
    }
  }

  // Priority 2: match against tags
  for (const category of PRIORITY_ORDER) {
    const keywords = CATEGORY_KEYWORDS[category];
    if (keywords.some(kw => tagText.includes(kw.trim()))) {
      return category;
    }
  }

  // Priority 3: match against description (less reliable)
  for (const category of PRIORITY_ORDER) {
    const keywords = CATEGORY_KEYWORDS[category];
    if (keywords.some(kw => descText.includes(kw.trim()))) {
      return category;
    }
  }

  return 'Sonstiges';
}
