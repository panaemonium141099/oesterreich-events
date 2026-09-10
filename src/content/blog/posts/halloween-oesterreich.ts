import type { FestivalPost } from '../types';

// Saison-Seite (fn-24), Frist laut SAISON_KALENDER: liveBy 09-20.
// Kalenderfakten (Feiertage, Herbstferien) stammen aus den geprüften `facts`
// des Kalenders, Primärquelle BMB-Ferientermine, verifiziert am 2026-09-10.
// Die genannten Veranstaltungen sind Events aus der eigenen Datenbank,
// keine Modell-Ausgabe.
export const post: FestivalPost = {
  slug: 'halloween-oesterreich',
  title: 'Halloween 2026 in Österreich',
  subtitle: 'Gruselburgen, Kürbisfelder und Partys quer durchs Land',
  heroImage: '/images/blog/halloween-oesterreich/hero.jpg',
  heroImageCredit: 'Foto: Alabama Extension, CC0, Wikimedia Commons',
  publishDate: '2026-09-10',
  updatedDate: '2026-09-10',
  readingTime: 7,
  excerpt:
    'Halloween 2026 fällt auf einen Samstag und liegt damit am Ende von zehn schulfreien Tagen. Gruselburgen, Kürbisschnitzen, Halloween-Partys und die ruhige Alternative: der Überblick über die Saison in ganz Österreich.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-orange-700 text-white',
  keyFacts: {
    dates: 'Samstag, 31. Oktober 2026, Kernsaison 24. bis 31. Oktober',
    location: 'Ganz Österreich',
    address: 'Schwerpunkte im Burgenland, in Niederösterreich, Wien, Graz und Salzburg',
    genre: 'Grusel-Events, Familienprogramm, Kürbisfeste, Partys',
    price: 'von gratis bis Eintritt je nach Veranstaltung',
    website: 'https://lasstreffen.at/entdecken',
  },
  lineup: [
    { name: 'Grusel, Hexen, Burggespenster auf Burg Forchtenstein', role: 'headliner', day: 'ab 24. Oktober', stage: 'Burgenland' },
    { name: 'Halloween im Familypark St. Margarethen', role: 'headliner', day: 'ab 23. Oktober', stage: 'Burgenland' },
    { name: 'Gruseliger Herbst auf Schloss Hof', role: 'headliner', day: 'ab 24. Oktober', stage: 'Niederösterreich' },
    { name: 'Geistertage im Schloss Esterházy', role: 'special', day: 'ab 24. Oktober', stage: 'Burgenland' },
    { name: 'Kittenbergers Halloween im Garten', role: 'special', day: 'ab 24. Oktober', stage: 'Niederösterreich' },
    { name: 'Halloween-Gruseltage Podersdorf am See', role: 'support', day: 'ab 22. Oktober', stage: 'Burgenland' },
    { name: 'Kürbisschnitzen der Kinderfreunde, vielerorts', role: 'support', day: 'ab 23. Oktober', stage: 'ganz Österreich' },
  ],
  lineupTitle: 'Die Fixpunkte der Saison',
  lineupNote:
    'Das ist ein Ausschnitt. Viele Halloween-Termine, gerade die von Vereinen und Gemeinden, werden erst Anfang Oktober veröffentlicht. Den jeweils aktuellen Stand findest du auf unserer Event-Karte.',
  intro:
    'Halloween 2026 hat die beste Konstellation seit Jahren: Der 31. Oktober fällt auf einen Samstag und liegt damit am Ende von zehn zusammenhängenden schulfreien Tagen. Nationalfeiertag am Montag, danach die Herbstferien, dann Allerheiligen am Sonntag und Allerseelen am Montag. Wer heuer Halloween feiern will, hat keine Ausrede.',
  historyTitle: 'Der Halloween-Kalender 2026',
  history:
    'Die österreichische Halloween-Saison läuft in vier Phasen ab. Ab Mitte September beginnt die Kürbisphase: Kürbisfelder und Herbstausstellungen öffnen, im Handel liegen Schnitzkürbisse. Kein Grusel, viel Familie. Ab etwa Mitte Oktober startet das Warm-Up mit den ersten Grusel-Events und Nachtführungen. Von 24. bis 31. Oktober läuft die Kernsaison, die sich heuer exakt mit Nationalfeiertag und Herbstferien deckt. Das ist die Woche, in der praktisch alles stattfindet. Der Peak liegt auf Freitag 30. und Samstag 31. Oktober: Läufe, Partys, Paraden und Führungen gleichzeitig.',
  whatToExpectTitle: 'Wo es in Österreich wirklich gruselig wird',
  whatToExpect:
    'Die dichteste Programmierung haben das Burgenland und Niederösterreich. Im Burgenland liegen mit Burg Forchtenstein, dem Familypark in St. Margarethen und Schloss Esterházy drei große Adressen dicht beieinander, alle mit Programm ausdrücklich für Kinder. In Niederösterreich sind es Schloss Hof im Marchfeld und die Kittenberger Erlebnisgärten. Dazu kommt in fast jeder Gemeinde ein Kürbisschnitzen der Kinderfreunde oder der Bäuerinnen, oft kostenlos und ohne große Ankündigung.',
  whatToExpectList: [
    'Burg Forchtenstein im Burgenland: Grusel, Hexen, Burggespenster, ab 24. Oktober, ausgelegt auf jüngere Kinder',
    'Familypark St. Margarethen: Halloween-Programm ab 23. Oktober, Österreichs größtes Familien-Gruselfest',
    'Schloss Hof im Marchfeld: Gruseliger Herbst ab 24. Oktober, dazu die Kürbisskulpturen im Park',
    'Schloss Esterházy in Eisenstadt: Geistertage mit Kinderprogramm ab 24. Oktober',
    'Kittenbergers Erlebnisgärten in Niederösterreich: Halloween im Garten ab 24. Oktober',
    'Kürbisschnitzen in vielen Gemeinden, meist Ende Oktober und häufig gratis',
    'Halloween-Partys und Clubbings vor allem am Freitag 30. und Samstag 31. Oktober',
  ],
  practicalInfoTitle: 'Praktische Infos zur Halloween-Saison',
  practicalInfo: [
    {
      icon: '📅',
      label: 'Halloween 2026',
      text: 'Samstag, 31. Oktober 2026. Die Kernsaison läuft von 24. bis 31. Oktober, die Kürbisangebote starten schon ab Mitte September.',
    },
    {
      icon: '🎒',
      label: 'Herbstferien',
      text: 'Dienstag 27. bis Samstag 31. Oktober 2026, einheitlich in allen neun Bundesländern. Mit dem Nationalfeiertag am Montag davor und Allerheiligen am Sonntag danach ergibt das zehn schulfreie Tage am Stück, von 24. Oktober bis 2. November.',
    },
    {
      icon: '🕯️',
      label: 'Danach',
      text: 'Allerheiligen am Sonntag, 1. November 2026, ist ein gesetzlicher Feiertag. Allerseelen am Montag, 2. November, ist schulfrei, aber kein gesetzlicher Feiertag.',
    },
    {
      icon: '👻',
      label: 'Die ruhige Alternative',
      text: 'Am selben Abend, dem 31. Oktober, öffnen bei der Nacht der 1.000 Lichter über 240 österreichische Pfarren ihre Kirchen: Lichterwege, Labyrinthe, Kerzenlicht. Gedacht als Gegenprogramm für alle, denen Zombies zu viel sind.',
    },
    {
      icon: '🎃',
      label: 'Kürbis schnitzen',
      text: 'Schnitzkürbisse gibt es ab Mitte September auf Kürbishöfen und im Handel. Viele Gemeinden veranstalten in der letzten Oktoberwoche ein gemeinsames Kürbisschnitzen, oft kostenlos und mit Anmeldung.',
    },
    {
      icon: '⏳',
      label: 'Früh buchen',
      text: 'Nachtführungen und Gruseldinner sind die Engpässe der Saison. Sie sind regelmäßig schon Anfang Oktober ausgebucht. Wenn du so etwas vorhast, buche sofort.',
    },
  ],
  gallery: [],
  faqs: [
    {
      question: 'Wann ist Halloween 2026?',
      answer: 'Am Samstag, 31. Oktober 2026.',
    },
    {
      question: 'Ist Halloween in Österreich ein Feiertag?',
      answer: 'Nein, der 31. Oktober ist kein Feiertag. 2026 fällt er allerdings ans Ende der Herbstferien, und der 1. November, Allerheiligen, ist ein gesetzlicher Feiertag.',
    },
    {
      question: 'Was macht man an Halloween mit kleinen Kindern?',
      answer: 'Burg Forchtenstein, der Familypark St. Margarethen, Schloss Esterházy und der Gruselige Herbst auf Schloss Hof haben Programme ausdrücklich für Kinder. Die grusel-freie Alternative ist die Nacht der 1.000 Lichter am 31. Oktober.',
    },
    {
      question: 'Wie lange dauert die Halloween-Saison in Österreich?',
      answer: 'Kürbis- und Herbstangebote laufen ab Mitte September, echte Grusel-Events ab dem dritten Oktoberwochenende. Kernzeit ist die letzte Oktoberwoche.',
    },
    {
      question: 'Wann sind die Herbstferien 2026?',
      answer: 'Von Dienstag, 27. Oktober, bis Samstag, 31. Oktober 2026, einheitlich in allen neun Bundesländern.',
    },
    {
      question: 'Wo finde ich Halloween-Events in meiner Nähe?',
      answer: 'Über unsere Event-Karte und die Suche. Viele lokale Termine von Vereinen und Gemeinden kommen erst Anfang Oktober dazu, ein zweiter Blick Mitte Oktober lohnt sich also.',
    },
  ],
  ctaText: 'Halloween-Events in deiner Nähe finden',
  ctaLink: '/entdecken',
  seoTitle: 'Halloween 2026 in Österreich: Events, Termine und Tipps',
  seoDescription:
    'Halloween 2026 fällt auf einen Samstag, mitten in die Herbstferien. Gruselburgen, Kürbisfeste, Partys und Familienprogramm in ganz Österreich im Überblick.',
  keywords: [
    'halloween 2026 österreich',
    'halloween österreich',
    'halloween events',
    'halloween wien',
    'kürbis schnitzen',
    'halloween mit kindern',
    'gruselburg österreich',
  ],
  jsonLdEvent: {
    name: 'Halloween 2026 in Österreich',
    startDate: '2026-10-24T00:00:00+02:00',
    endDate: '2026-10-31T23:59:00+01:00',
    location: 'Österreich',
    addressCountry: 'AT',
    url: 'https://lasstreffen.at/blog/halloween-oesterreich',
    description:
      'Die Halloween-Saison 2026 in Österreich: Gruselburgen, Kürbisfeste, Familienprogramm und Partys von 24. bis 31. Oktober 2026.',
    image: 'https://lasstreffen.at/images/blog/halloween-oesterreich/hero.jpg',
  },
};
