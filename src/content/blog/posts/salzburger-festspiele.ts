import type { FestivalPost } from '../types';

// Termine 2026/2027, Umfang, Besucherzahl, Programm und Geschichte geprüft am 2026-10-27
// gegen salzburgerfestspiele.at (Startseite, Seite /tickets, Abschlussbericht
// wp-content/uploads/2026/08/abschlussaussendung_2026_de-1.pdf) und
// salzburg.info/de/salzburg/salzburger-festspiele/chronik. Vorher stand hier im April
// Geschätztes und Erfundenes: 18. Juli bis 31. August (tatsächlich 17. Juli bis
// 30. August 2026), 267.000 Besucher (261.301 laut Bericht), Berliner Philharmoniker,
// Anna Netrebko und Jonas Kaufmann im Programm 2026 (im Abschlussbericht nicht als
// Mitwirkende genannt), Furtwängler als Intendant, Karajan „1956 bis 1989“,
// Programmveröffentlichung im Jänner (2026er Programm erschien am 4. Dezember 2025),
// Preise „Stehplätze ab 15 €, Premieren ab 350 €“ (nicht belegt), „Uraufführung“ des
// Jedermann 1920 (die Chronik nennt eine Aufführung, keine Uraufführung).
export const post: FestivalPost = {
  slug: 'salzburger-festspiele',
  title: 'Salzburger Festspiele',
  subtitle: 'Das renommierteste Klassikfestival der Welt im Herzen Salzburgs',
  heroImage: '/images/blog/salzburger-festspiele/hero.jpg',
  thumbnailImage: '/images/blog/salzburger-festspiele/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.salzburgerfestspiele.at/',
      'https://www.salzburgerfestspiele.at/wp-content/uploads/2026/08/abschlussaussendung_2026_de-1.pdf',
      'https://www.salzburgerfestspiele.at/tickets',
      'https://salzburg.info/de/salzburg/salzburger-festspiele/chronik',
    ],
  },
  readingTime: 7,
  excerpt:
    'Seit 1920 versammeln sich die besten Musikerinnen, Musiker, Dirigenten und Regisseure der Welt im Juli und August in Salzburg. Der nächste Festspielsommer läuft von 16. Juli bis 29. August 2027.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-purple-700 text-white',
  keyFacts: {
    dates: 'Sommer 2027: 16. Juli bis 29. August (2026: 17. Juli bis 30. August). Pfingsten 2027: 14. bis 17. Mai',
    location: 'Großes Festspielhaus, Haus für Mozart, Felsenreitschule, Domplatz u. a. (19 Spielstätten)',
    address: 'Hofstallgasse 1, 5020 Salzburg',
    genre: 'Oper, Konzert, Schauspiel, Dirigat',
    price: 'je nach Vorstellung und Kategorie, Karten über salzburgerfestspiele.at',
    website: 'https://www.salzburgerfestspiele.at',
    capacity: 'rund 261.300 Besucher (Sommer 2026)',
    since: '1920',
  },
  lineup: [
    { name: 'Wiener Philharmoniker (Konzertreihe)', role: 'headliner' },
    { name: 'Asmik Grigorian (Carmen, Titelrolle)', role: 'headliner' },
    { name: 'Cecilia Bartoli (Il viaggio a Reims)', role: 'special' },
    { name: 'Christian Thielemann (Matinee der Wiener Philharmoniker)', role: 'special' },
    { name: 'Martha Argerich und Renaud Capuçon', role: 'special' },
    { name: 'Jedermann', role: 'support', stage: 'Domplatz' },
  ],
  lineupTitle: 'Programm-Highlights 2026',
  lineupNote:
    'Auswahl aus dem Festspielsommer 2026 laut Abschlussbericht der Salzburger Festspiele. Das Programm 2026 wurde am 4. Dezember 2025 veröffentlicht; das Programm für den Sommer 2027 ist noch nicht erschienen.',
  intro:
    'Es gibt kein Festival der klassischen Musik, das den Salzburger Festspielen in Renommee, Geschichte und künstlerischem Anspruch gleichkommt. Jedes Jahr im Sommer verwandelt sich die Mozartstadt Salzburg in die Welthauptstadt der Hochkultur: 2026 waren es 172 Aufführungen in 45 Tagen an 19 Spielstätten, dazu 37 Vorstellungen im Jugendprogramm. Von der Oper über Konzerte bis zum Schauspiel lockt das Programm Publikum aus aller Welt. Die Festspiele sind mehr als ein kulturelles Programm, sie sind ein Gesamterlebnis, das die Stadt, ihre Architektur und den Geist ihres berühmtesten Sohnes Wolfgang Amadeus Mozart atmend lebendig macht.',
  historyTitle: 'Ein Jahrhundertereignis: Die Festspiele seit 1920',
  history:
    'Die Idee zu den Salzburger Festspielen wurde von Hugo von Hofmannsthal, Max Reinhardt und Richard Strauss geprägt. Am 22. August 1920 wurde mit Hofmannsthals „Jedermann" auf dem Domplatz in der Regie von Max Reinhardt die erste Spielzeit eröffnet, ein Stück, das bis heute jährlich aufgeführt wird. Über die Jahrzehnte wurde das Festival zum internationalen Maßstab für Opernproduktionen. Herbert von Karajan prägte die Festspiele von seiner Berufung bis zu seinem Tod 1989 wie kein anderer: Internationalisierung, Bau des Großen Festspielhauses und Gründung der Osterfestspiele gehen auf ihn zurück. Zu seinen Nachfolgern zählte Gerard Mortier.',
  whatToExpectTitle: 'Was die Salzburger Festspiele bieten',
  whatToExpect:
    'Der Festspielsommer 2026 zeigte neun Opernproduktionen, darunter die Neuinszenierungen Carmen, Ariadne auf Naxos und Saint François d’Assise, 84 Konzerte und im Schauspiel neben dem Jedermann Uraufführungen von Peter Handke und Elfriede Jelinek. Von den 15 Jedermann-Vorstellungen fanden acht am Domplatz statt, die übrigen ganz oder teilweise im Großen Festspielhaus. Mehr als 7.600 Karten gingen an Jugendliche unter 27 Jahren.',
  whatToExpectList: [
    'Opern: Neuinszenierungen, Wiederaufnahmen und konzertante Aufführungen',
    'Konzertreihen der Wiener Philharmoniker und Orchester zu Gast',
    'Jedermann auf dem Domplatz (Ausweichspielstätte: Großes Festspielhaus)',
    'Kammerkonzerte, Liederabende und Mozart-Matineen mit dem Mozarteumorchester',
    'Schauspiel mit Uraufführungen und Gastspielen',
    'Young Singers Project und Jugendprogramm „jung & jede*r“',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Karten gibt es über salzburgerfestspiele.at und das Kartenbüro (+43 662 8045 500). Die Platzauslastung lag 2026 bei über 99 Prozent, früh planen lohnt sich.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Salzburg HBF ist 15 Gehminuten von den meisten Spielstätten. IC und RJ aus Wien (2,5 h), München (1,5 h) direkt.',
    },
    {
      icon: '👔',
      label: 'Dresscode',
      text: 'Bei Premieren und Abendveranstaltungen wird elegante Kleidung erwartet. Für Matineen und Stehplätze ist smart casual üblich.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Hotels in Salzburg sind im Juli und August sehr gefragt, früh buchen. Alternativ: Unterkunft im Umland.',
    },
  ],
  gallery: [],
  ctaText: 'Klassik-Events in Salzburg entdecken',
  ctaLink: '/map?bundesland=Salzburg&category=Kultur',
  seoTitle: 'Salzburger Festspiele 2027: Termine, Tickets & Tipps',
  seoDescription:
    'Salzburger Festspiele 2027 von 16. Juli bis 29. August: Oper, Konzert, Schauspiel und Jedermann. Termine, Tickets und Tipps, dazu die Bilanz des Sommers 2026.',
  keywords: [
    'Salzburger Festspiele 2027',
    'Salzburger Festspiele Programm',
    'Salzburg Oper Sommer',
    'Jedermann Salzburg',
    'Wiener Philharmoniker Salzburg',
    'Salzburg Festspiele Tickets',
    'Klassikfestival Österreich',
    'Salzburg Sommer Kultur',
    'Festspiele Oper 2027',
    'Salzburg Festival',
  ],
  faqs: [
    {
      question: 'Wie bekomme ich Tickets für die Salzburger Festspiele?',
      answer: 'Tickets gibt es über die offizielle Website salzburgerfestspiele.at und das Kartenbüro (+43 662 8045 500). Das Programm für den Sommer 2026 wurde am 4. Dezember 2025 veröffentlicht; für 2027 steht das Programm noch aus. Weil die Auslastung 2026 bei über 99 Prozent lag, lohnt es sich, gleich nach Erscheinen des Programms zu bestellen.',
    },
    {
      question: 'Welcher Dresscode gilt bei den Salzburger Festspielen?',
      answer: 'Bei Premieren und Abendveranstaltungen wird elegante Kleidung erwartet. Abendkleid oder Anzug sind üblich. Für Matineen, Konzerte und Stehplätze reicht smart casual. Es gibt keine strenge Kleiderordnung, aber das Publikum kleidet sich traditionell festlich.',
    },
    {
      question: 'Wie lange dauern die Salzburger Festspiele?',
      answer: 'Der Festspielsommer dauert etwa sechs Wochen von Mitte Juli bis Ende August. 2026 lief er von 17. Juli bis 30. August mit 172 Aufführungen an 19 Spielstätten plus 37 Vorstellungen im Jugendprogramm. 2027 finden die Festspiele von 16. Juli bis 29. August statt, die Pfingstfestspiele 2027 von 14. bis 17. Mai.',
    },
    {
      question: 'Sind die Vorstellungen schnell ausverkauft?',
      answer: 'Die Nachfrage ist sehr hoch: 2026 lag die Platzauslastung laut Festspielen bei über 99 Prozent, rund 261.300 Gäste aus 84 Ländern kamen. Wer bestimmte Vorstellungen sehen will, sollte früh bestellen; die Festspiele veröffentlichen zudem eine Liste noch verfügbarer Karten auf ihrer Website.',
    },
  ],
  jsonLdEvent: {
    name: 'Salzburger Festspiele 2027',
    startDate: '2027-07-16',
    endDate: '2027-08-29',
    location: 'Grosses Festspielhaus, Hofstallgasse 1, 5020 Salzburg, Austria',
    addressCountry: 'AT',
    url: 'https://www.salzburgerfestspiele.at',
    description:
      'Die Salzburger Festspiele sind das weltweit renommierteste Klassikfestival mit Opern, Konzerten und Schauspielen in Salzburg, Österreich.',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&q=85&auto=format&fit=crop',
  },
};
