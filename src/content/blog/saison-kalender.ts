/**
 * Saison-Kampagnen-Kalender — Config für den Autopiloten
 * (src/scripts/generate-saison-guide.ts, GitHub Action saison-guide.yml).
 *
 * Der Kalender ist FRIST-getrieben, nicht monatsgetrieben. Eine Seite muss
 * live und indexiert sein, BEVOR die Suchnachfrage anzieht — nicht wenn das
 * Event stattfindet. Bei einem neuen Beitrag sind 5–10 Tage bis zur stabilen
 * Indexierung realistisch, deshalb steht in `liveBy` der spätestmögliche
 * Livegang und in `leadDays`, wie früh der Autopilot davor loslegt.
 *
 * `liveBy` ist MM-TT ohne Jahr: der Kalender wiederholt sich jährlich, die
 * Slugs sind evergreen (die Jahreszahl gehört in H1/Title/Text, nicht in die
 * URL — sonst startet die Seite jedes Jahr ohne aufgebaute Autorität).
 *
 * ZWEI SORTEN VON EINTRÄGEN:
 *
 *   • Sammel-Guides (`categories` gesetzt): der Text entsteht aus echten
 *     Events der eigenen Datenbank. Kein Außenwissen nötig.
 *
 *   • Themen-Seiten (`brief` + `facts` gesetzt): der Text handelt von einem
 *     Ereignis in der Welt (Termine, Preise, Öffnungszeiten). Diese Fakten
 *     KOMMEN NICHT AUS DEM MODELL, sondern stehen hier geprüft in `facts`
 *     und werden wörtlich in die Seite übernommen. Gemini schreibt nur die
 *     Prosa darum herum. Grund: 2026-09 hat sich eine Veranstalterin über
 *     eine frei erfundene KI-Beschreibung beschwert (MASTERPLAN §6) — was
 *     eine Zahl behauptet, muss belegt sein.
 *
 * `factsVerified` ist das Datum der letzten Prüfung an der Primärquelle.
 * Ist es älter als FACTS_MAX_AGE_DAYS, publiziert der Autopilot NICHT mehr
 * automatisch, sondern öffnet einen PR zum Nachprüfen.
 */

/** Ein geprüfter Fakt: erscheint wörtlich in der „Auf einen Blick"-Box. */
export interface SaisonFact {
  label: string;
  value: string;
}

export interface SaisonGuideSpec {
  /** Spätester Livegang als MM-TT (jährlich wiederkehrend). */
  liveBy: string;
  /** Wie viele Tage vor `liveBy` der Autopilot den Entwurf baut. */
  leadDays: number;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  categoryColor: string;
  heroImage: string;
  /** Kuratierte Wikimedia-Commons-Suche, falls kein statisches Hero passt. */
  heroQuery?: string;
  searchKeywords: string[];
  /** Event-Recherche: Saison-Fenster relativ zum Publish [von, bis] in Monaten. */
  monthsAhead: [number, number];
  /** Event-Kategorien (Taxonomie-Werte) für die DB-Recherche. */
  categories: string[];
  /** Bestands-Posts als interne Link-Kandidaten (Slugs). */
  bestandsPosts: string[];
  /** Themen-Seiten: was die Seite abdecken muss (Recherche-Auftrag an Gemini). */
  brief?: string;
  /** Themen-Seiten: geprüfte Fakten, die wörtlich übernommen werden. */
  facts?: SaisonFact[];
  /** Datum der letzten Prüfung von `facts` an der Primärquelle (ISO). */
  factsVerified?: string;
  /** Primärquellen — landen als Grounding-Hinweis im Prompt und in der Seite. */
  sources?: string[];
}

/** Ab diesem Alter gelten `facts` als ungeprüft → PR statt Auto-Publish. */
export const FACTS_MAX_AGE_DAYS = 300;

export const SAISON_KALENDER: SaisonGuideSpec[] = [
  // ── Herbst ──────────────────────────────────────────────────────────────
  {
    liveBy: '08-15',
    leadDays: 21,
    slug: 'lange-nacht-der-museen',
    title: 'ORF-Lange Nacht der Museen',
    subtitle: 'Ein Ticket, eine Nacht, Museen in ganz Österreich',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-slate-800 text-white',
    heroImage: '/images/blog/lange-nacht-der-museen/hero.jpg',
    heroQuery: 'Kunsthistorisches Museum Wien',
    searchKeywords: [
      'lange nacht der museen', 'lange nacht der museen wien',
      'lange nacht der museen tickets', 'lange nacht der museen programm',
    ],
    monthsAhead: [0, 2],
    categories: ['Kultur & Bühne'],
    bestandsPosts: ['ars-electronica-festival', 'viennale'],
    brief: [
      'Erkläre das Prinzip (ein Ticket für alle teilnehmenden Häuser),',
      'wie viele Häuser man an einem Abend realistisch schafft,',
      'wo das Ticket zusätzlich als Öffi-Fahrschein gilt und wo nur für die',
      'Shuttlebusse, was für Familien mit Kindern drin ist, und praktische',
      'Planungstipps. Keine Museumsliste erfinden — nenne nur Häuser, die in',
      'den bereitgestellten Fakten oder Events vorkommen.',
    ].join(' '),
    facts: [
      { label: 'Termin', value: 'Samstag, 3. Oktober 2026' },
      { label: 'Uhrzeit', value: '18:00 bis 24:00 Uhr' },
      { label: 'Ausgabe', value: 'die 26.' },
      { label: 'Ticket regulär', value: '19 Euro' },
      { label: 'Ticket ermäßigt', value: '16 Euro (Schüler:innen, Studierende, Senior:innen, Menschen mit Behinderungen, Präsenzdiener, Ö1-Club)' },
      { label: 'Regionalticket', value: '7 Euro, gilt für Museen außerhalb der Landeshauptstädte' },
      { label: 'Kinder', value: 'bis 12 Jahre gratis (geboren nach dem 2. Oktober 2014)' },
      { label: 'Online-Vorverkauf', value: 'bis 27. September 2026 auf backstage.ORF.at' },
      { label: 'Kinderprogramm', value: 'rund 270 Museen mit eigenem Kinderprogramm; Kinderpass, ab drei Stempeln ein Geschenk' },
      { label: 'Öffis Wien', value: 'Ticket gilt als Fahrschein in der Kernzone Wien vom 3. Oktober 17:00 Uhr bis 4. Oktober 00:59 Uhr, inklusive Nightline-Busse' },
      { label: 'Öffis übrige Bundesländer', value: 'nur für die eigens eingerichteten Lange-Nacht-Shuttlebusse, nicht für den regulären Linienverkehr' },
      { label: 'Treffpunkt Museum', value: 'in jeder Landeshauptstadt (in Vorarlberg in Dornbirn) sowie in Krems — dort gibt es Tickets, Booklets und Routen' },
    ],
    factsVerified: '2026-09-10',
    sources: ['https://langenacht.orf.at/info', 'https://langenacht.orf.at/state/bl/wien'],
  },
  {
    liveBy: '09-20',
    leadDays: 14,
    slug: 'halloween-oesterreich',
    title: 'Halloween in Österreich',
    subtitle: 'Gruselburgen, Kürbisfelder und Partys — die Halloween-Saison im Überblick',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-orange-700 text-white',
    heroImage: '/images/blog/halloween-oesterreich/hero.jpg',
    heroQuery: 'Halloween Kürbis Jack-o-lantern',
    searchKeywords: [
      'halloween österreich', 'halloween wien', 'halloween events',
      'kürbis schnitzen kaufen', 'halloween mit kindern',
    ],
    monthsAhead: [0, 2],
    categories: ['Märkte & Feste', 'Familie & Kinder', 'Nightlife & Party'],
    bestandsPosts: ['nationalfeiertag-oesterreich'],
    brief: [
      'Gliedere die Saison in ihre Phasen (Kürbiszeit, Warm-Up, Kernwoche, Peak).',
      'Decke ab: Gruselburgen und Schlösser, Freizeitparks, Halloween-Läufe,',
      'Nachtführungen, Kürbishöfe, und die ruhige Alternative für Familien mit',
      'kleinen Kindern. Nenne nur Veranstaltungen, die in den bereitgestellten',
      'Events oder Fakten stehen — keine Termine erfinden.',
    ].join(' '),
    facts: [
      { label: 'Halloween', value: 'Samstag, 31. Oktober 2026' },
      { label: 'Kernsaison', value: '24. bis 31. Oktober 2026' },
      { label: 'Kürbis-Saison', value: 'ab Mitte September' },
      { label: 'Schulfrei am Stück', value: 'Samstag 24. Oktober bis Montag 2. November 2026, zehn Tage' },
      { label: 'Herbstferien', value: '27. bis 31. Oktober 2026, alle neun Bundesländer' },
      { label: 'Allerheiligen', value: 'Sonntag, 1. November 2026 — gesetzlicher Feiertag' },
      { label: 'Allerseelen', value: 'Montag, 2. November 2026 — schulfrei, aber kein gesetzlicher Feiertag' },
      { label: 'Nacht der 1.000 Lichter', value: '31. Oktober 2026, die grusel-freie Alternative in über 240 Pfarren' },
    ],
    factsVerified: '2026-09-10',
    sources: [
      'https://www.bmb.gv.at/Themen/schule/schulpraxis/termine/ferientermine_26_27.html',
      'https://www.nachtder1000lichter.at/',
    ],
  },
  {
    liveBy: '10-01',
    leadDays: 14,
    slug: 'nationalfeiertag-oesterreich',
    title: 'Nationalfeiertag & Herbstferien',
    subtitle: 'Was am 26. Oktober offen ist und was du in der Ferienwoche machen kannst',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-red-700 text-white',
    heroImage: '/images/blog/nationalfeiertag-oesterreich/hero.jpg',
    heroQuery: 'Heldenplatz Wien Hofburg',
    searchKeywords: [
      'nationalfeiertag was ist offen', 'nationalfeiertag österreich',
      'herbstferien ausflug', 'herbstferien 2026', '26. oktober feiertag',
    ],
    monthsAhead: [0, 2],
    categories: ['Kultur & Bühne', 'Familie & Kinder', 'Märkte & Feste'],
    bestandsPosts: ['halloween-oesterreich', 'lange-nacht-der-museen'],
    brief: [
      'Beantworte zuerst die Suchfrage: was hat offen, was nicht, wie fahren',
      'die Öffis. Erkläre dann die Herkunft des Datums, das Ferienfenster und',
      'wie man mit wenig Urlaub viele freie Tage bekommt. Räume mit dem Irrtum',
      'auf, am Nationalfeiertag sei der Eintritt in alle Bundesmuseen frei —',
      'das stimmt nicht. Nenne keine Museen mit freiem Eintritt, die nicht in',
      'den geprüften Fakten stehen.',
    ].join(' '),
    facts: [
      { label: 'Nationalfeiertag', value: 'Montag, 26. Oktober 2026 — gesetzlicher, arbeitsfreier Feiertag' },
      { label: 'Herbstferien', value: 'Dienstag 27. bis Samstag 31. Oktober 2026, alle neun Bundesländer' },
      { label: 'Allerheiligen', value: 'Sonntag, 1. November 2026 — gesetzlicher Feiertag' },
      { label: 'Allerseelen', value: 'Montag, 2. November 2026 — schulfrei, kein gesetzlicher Feiertag' },
      { label: 'Schulfrei am Stück', value: '24. Oktober bis 2. November 2026, zehn Tage' },
      { label: 'Geschäfte', value: 'Supermärkte, Geschäfte, Ämter, Banken und Post bleiben geschlossen' },
      { label: 'Offen', value: 'Gastronomie, Tankstellen, Bahnhofs- und Flughafenshops, die meisten Museen' },
      { label: 'Öffis', value: 'Betrieb nach Sonn- und Feiertagsfahrplan' },
      { label: 'Urlaubstrick', value: 'vier Urlaubstage von 27. bis 30. Oktober ergeben neun freie Tage am Stück' },
      { label: 'Warum der 26. Oktober', value: 'am 26. Oktober 1955 beschloss der Nationalrat die immerwährende Neutralität; Nationalfeiertag seit dem Bundesgesetz vom 25. Oktober 1965, arbeitsfrei erst durch das Bundesgesetz vom 28. Juni 1967' },
    ],
    factsVerified: '2026-09-10',
    sources: [
      'https://www.bmb.gv.at/Themen/schule/schulpraxis/termine/ferientermine_26_27.html',
      'https://www.ris.bka.gv.at/Dokumente/BgblPdf/1965_298_0/1965_298_0.pdf',
    ],
  },

  // ── Advent & Winter ─────────────────────────────────────────────────────
  {
    liveBy: '10-08',
    leadDays: 21,
    slug: 'christkindlmaerkte-oesterreich',
    title: 'Christkindlmärkte in Österreich',
    subtitle: 'Alle Termine und Öffnungszeiten — von Wien bis Bregenz',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-red-800 text-white',
    heroImage: '/images/categories/maerkte-1.jpg',
    heroQuery: 'Christkindlmarkt Rathausplatz Wien',
    searchKeywords: [
      'christkindlmarkt österreich', 'weihnachtsmarkt öffnungszeiten',
      'adventmarkt termine', 'christkindlmarkt wann öffnet',
    ],
    monthsAhead: [1, 4],
    categories: ['Märkte & Feste'],
    bestandsPosts: [
      'wien-christkindlmarkt', 'grazer-christkindlmarkt', 'linzer-christkindlmarkt',
      'salzburger-christkindlmarkt', 'innsbruck-christkindlmarkt',
    ],
    brief: [
      'Der Hub verteilt auf die Stadtseiten. Erkläre die zwei Startregeln:',
      'Wien hängt nicht am Advent (die Märkte starten fix Mitte November),',
      'Graz schon (eine Woche vor dem ersten Adventsonntag). Weise darauf hin,',
      'dass Salzburg als einziger großer Markt bis Anfang Jänner läuft und',
      'nicht bis 24. Dezember. Keine Termine erfinden — nur die geprüften.',
    ].join(' '),
    facts: [
      { label: '1. Adventsonntag', value: '29. November 2026' },
      { label: 'Heiliger Abend', value: 'Donnerstag, 24. Dezember 2026' },
      { label: 'Wien Rathausplatz', value: '13. November bis 26. Dezember 2026, täglich 10 bis 22 Uhr; am 24. Dezember 10 bis 18:30 Uhr' },
      { label: 'Wien Eistraum', value: '13. November 2026 bis 6. Jänner 2027, täglich 10 bis 22 Uhr' },
    ],
    factsVerified: '2026-09-10',
    sources: ['https://www.christkindlmarkt.at/', 'https://www.wien.info/'],
  },
  {
    liveBy: '10-20',
    leadDays: 14,
    slug: 'krampuslauf-perchtenlauf-oesterreich',
    title: 'Krampusläufe und Perchtenläufe',
    subtitle: 'Termine, Regionen und der Unterschied zwischen Krampus und Percht',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-amber-900 text-white',
    heroImage: '/images/categories/fest-1.jpg',
    heroQuery: 'Krampuslauf Perchten Maske',
    searchKeywords: [
      'krampuslauf termine', 'perchtenlauf', 'krampuslauf graz',
      'krampus perchten unterschied', 'krampuslauf klagenfurt',
    ],
    monthsAhead: [1, 4],
    categories: ['Märkte & Feste', 'Kultur & Bühne'],
    bestandsPosts: ['christkindlmaerkte-oesterreich'],
    brief: [
      'Der wichtigste Erklärteil ist der Unterschied zwischen Krampus',
      '(christlich, Begleiter des Nikolaus, Mitte November bis 20. Dezember)',
      'und Percht (vorchristlich, Rauhnächte, 21. Dezember bis 6. Jänner),',
      'inklusive Schiach- und Schönperchten und der regionalen Namen',
      'Klaubauf und Tuifl. Dazu praktische Hinweise fürs Zuschauen mit',
      'Kindern. Termine nur aus den bereitgestellten Events.',
    ].join(' '),
    facts: [
      { label: 'Krampusnacht', value: 'Samstag, 5. Dezember 2026' },
      { label: 'Nikolaus', value: 'Sonntag, 6. Dezember 2026 — zugleich zweiter Adventsonntag' },
      { label: 'Krampus-Saison', value: 'Mitte November bis 20. Dezember' },
      { label: 'Perchten-Saison', value: '21. Dezember bis 6. Jänner (Rauhnächte)' },
      { label: 'Gasteiner Perchtenlauf', value: 'findet nur alle vier Jahre statt; nach Jänner 2026 ist der nächste im Jänner 2030' },
    ],
    factsVerified: '2026-09-10',
    sources: ['https://www.gasteinertal.com/gasteiner-perchtenlauf/'],
  },
  {
    liveBy: '11-15',
    leadDays: 14,
    slug: 'silvester-oesterreich',
    title: 'Silvester in Österreich',
    subtitle: 'Silvesterpfade, Bälle und Bergfeuer — so feiert Österreich ins neue Jahr',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-indigo-800 text-white',
    heroImage: '/images/categories/rave-1.jpg',
    searchKeywords: ['Silvester Wien', 'Silvester Österreich', 'Silvesterpfad', 'Neujahrskonzert Karten'],
    monthsAhead: [0, 2],
    categories: ['Märkte & Feste', 'Nightlife & Party', 'Musik'],
    bestandsPosts: ['wiener-silvesterpfad', 'wiener-neujahrskonzert'],
  },

  // ── Winter & Frühjahr ───────────────────────────────────────────────────
  {
    liveBy: '12-20',
    leadDays: 21,
    slug: 'ball-faschingssaison-oesterreich',
    title: 'Ball- & Faschingssaison in Österreich',
    subtitle: 'Vom Opernball bis zum Villacher Fasching — der Guide durch die fünfte Jahreszeit',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-purple-800 text-white',
    heroImage: '/images/categories/kultur-1.jpg',
    searchKeywords: ['Ballkalender Wien', 'Faschingsumzug Termine', 'Opernball', 'Bälle Österreich'],
    monthsAhead: [1, 3],
    categories: ['Kultur & Bühne', 'Märkte & Feste', 'Musik'],
    bestandsPosts: ['wiener-opernball', 'villacher-fasching'],
  },
  {
    liveBy: '02-20',
    leadDays: 21,
    slug: 'ostermaerkte-fruehlingsfeste-oesterreich',
    title: 'Ostermärkte & Frühlingsfeste in Österreich',
    subtitle: 'Ostermärkte, Blütenfeste und Frühlingserwachen im ganzen Land',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-emerald-700 text-white',
    heroImage: '/images/categories/natur-1.jpg',
    searchKeywords: ['Ostermarkt Wien', 'Ostermärkte Österreich', 'Frühlingsfest', 'Narzissenfest'],
    monthsAhead: [1, 3],
    categories: ['Märkte & Feste', 'Familie & Kinder'],
    bestandsPosts: ['bregenzer-fruehling', 'narzissenfest'],
  },
  {
    liveBy: '04-15',
    leadDays: 21,
    slug: 'festival-sommer-oesterreich',
    title: 'Festival-Sommer Österreich',
    subtitle: 'Nova Rock, Frequency, Donauinselfest & Co — alle großen Festivals im Überblick',
    category: 'Musik & Festivals',
    categoryColor: 'bg-pink-700 text-white',
    heroImage: '/images/categories/musik-1.jpg',
    searchKeywords: ['Festivals Österreich', 'Musikfestival Sommer', 'Festival Tickets', 'Open Air Österreich'],
    monthsAhead: [1, 4],
    categories: ['Musik'],
    bestandsPosts: ['nova-rock-2026', 'frequency-festival-2026', 'donauinselfest-2026', 'salzburger-festspiele'],
  },
  {
    liveBy: '05-01',
    leadDays: 21,
    slug: 'open-air-kino-sommernaechte-oesterreich',
    title: 'Open-Air-Kinos & Sommernächte in Österreich',
    subtitle: 'Kino unter Sternen, Sommerkonzerte und laue Nächte — der Sommer-Guide',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-sky-700 text-white',
    heroImage: '/images/categories/kultur-2.jpg',
    searchKeywords: ['Open Air Kino Wien', 'Sommerkino', 'Sommernachtskonzert', 'Open Air Veranstaltungen'],
    monthsAhead: [1, 3],
    categories: ['Kultur & Bühne', 'Musik'],
    bestandsPosts: ['linzer-klangwolke', 'sommernachtskonzert-schoenbrunn'],
  },
  {
    liveBy: '08-01',
    leadDays: 21,
    slug: 'herbstfeste-erntedank-oesterreich',
    title: 'Herbstfeste & Erntedank in Österreich',
    subtitle: 'Weinlese, Almabtrieb, Erntedank — die schönsten Herbstfeste des Landes',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-amber-700 text-white',
    heroImage: '/images/categories/fest-1.jpg',
    searchKeywords: ['Herbstfeste Österreich', 'Erntedankfest', 'Almabtrieb Termine', 'Weinlesefest'],
    monthsAhead: [0, 3],
    categories: ['Märkte & Feste', 'Essen & Trinken', 'Kultur & Bühne'],
    bestandsPosts: ['kaiser-wiesn', 'aufsteirern', 'retz-weinlesefest', 'martinimarkt'],
  },
];

/**
 * Tage bis zur Frist `liveBy` — negativ, wenn die Frist schon vorbei ist.
 * Rechnet auf dem laufenden Jahr; liegt die Frist schon mehr als 90 Tage
 * zurück, zählt sie fürs nächste Jahr (sonst wäre ein Januar-Eintrag im
 * Dezember dauerhaft „überfällig").
 */
export function daysUntilDeadline(spec: SaisonGuideSpec, today = new Date()): number {
  const [month, day] = spec.liveBy.split('-').map(Number);
  const dayMs = 86_400_000;
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  let target = Date.UTC(today.getUTCFullYear(), month - 1, day);
  if ((utcToday - target) / dayMs > 90) target = Date.UTC(today.getUTCFullYear() + 1, month - 1, day);
  return Math.round((target - utcToday) / dayMs);
}

/** Steht dieser Eintrag im Arbeitsfenster (`leadDays` vor der Frist)? */
export function isDue(spec: SaisonGuideSpec, today = new Date()): boolean {
  return daysUntilDeadline(spec, today) <= spec.leadDays;
}

/** Sind die geprüften Fakten zu alt fürs automatische Publizieren? */
export function factsAreStale(spec: SaisonGuideSpec, today = new Date()): boolean {
  if (!spec.facts || spec.facts.length === 0) return false;
  if (!spec.factsVerified) return true;
  const age = (today.getTime() - new Date(spec.factsVerified).getTime()) / 86_400_000;
  return age > FACTS_MAX_AGE_DAYS;
}
