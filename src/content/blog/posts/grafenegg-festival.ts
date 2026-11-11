import type { FestivalPost } from '../types';

// Termine, Programm, Spielstätten, Kapazitäten und Anreise geprüft am 2026-10-27 gegen
// grafenegg.com (/en/mediatheque/sommer-2026/2251: 20. Festival 14.08. bis 06.09.2026;
// /en/programme-tickets/festival-eroffnung/50588; /en/anreise), news.at (Grafenegg Festival
// 2026 Finale) und de.wikipedia.org/wiki/Grafenegg_Festival (Wolkenturm 2007, 1.730 Plätze;
// Auditorium 2008, 1.300; Reitschule seit Mai 2026 Rudolf-Buchbinder-Saal; Neubert ab Oktober 2026).
// Vorher falsch: Reitschule mit 5.000 Plätzen und als wettergeschützter Saal (das ist das
// Auditorium), Kirill Petrenko, Lisa Batiashvili, Pablo Heras-Casado und Patricia
// Kopatchinskaja 2026 nicht im Programm, Yuja Wang im September statt August, Anreise
// „Strecke Krems–St. Pölten“ mit Shuttle und „A1 Abfahrt Melk oder Haag“, Preise ab 29/49 €
// ohne Beleg. Termin 2027 noch nicht veröffentlicht.
export const post: FestivalPost = {
  slug: 'grafenegg-festival',
  title: 'Grafenegg Festival 2026',
  subtitle: 'Klassik unter freiem Himmel im Herz Niederösterreichs',
  heroImage: '/images/blog/grafenegg-festival/hero.jpg',
  thumbnailImage: '/images/blog/grafenegg-festival/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.grafenegg.com/en/mediatheque/sommer-2026/2251',
      'https://de.wikipedia.org/wiki/Grafenegg_Festival',
      'https://www.grafenegg.com/en/programme-tickets/festival-eroffnung/50588',
      'https://www.news.at/specials/grafenegg-festival-2026-grosses-finale-mit-internationalen-klassikstars',
      'https://www.grafenegg.com/en/anreise',
    ],
  },
  readingTime: 6,
  excerpt:
    'Inmitten des romantischen Schlossparks Grafenegg vereinen sich Weltklasse-Orchester, renommierte Solisten und eine einzigartige Freiluftbühne zu einem der bedeutendsten Klassikfestivals Mitteleuropas.',
  category: 'Musik & Festival',
  categoryColor: 'bg-indigo-700 text-white',
  keyFacts: {
    dates: '14. August bis 6. September 2026 (20. Festival). Termin 2027 folgt',
    location: 'Schlosspark Grafenegg, Niederösterreich',
    address: 'Grafenegg 10, 3485 Grafenegg',
    genre: 'Klassik, Orchestermusik, Kammermusik',
    price: 'je nach Konzert; unter 26 Jahren 50 % Ermäßigung',
    website: 'https://www.grafenegg.com',
    capacity: 'Wolkenturm 1.730 Plätze, Auditorium bis 1.300',
    since: '2007',
  },
  lineup: [
    { name: 'Philharmonia Orchestra London, Cristian Măcelaru, Rudolf Buchbinder: Eröffnung mit Carmina Burana', role: 'headliner', day: '14. August 2026', stage: 'Wolkenturm' },
    { name: 'Royal Concertgebouw Orchestra, Santtu-Matias Rouvali, Víkingur Ólafsson', role: 'headliner', day: '29. August 2026' },
    { name: 'Münchner Philharmoniker, Lahav Shani, Martha Argerich', role: 'headliner', day: '2. September 2026', stage: 'Wolkenturm' },
    { name: 'Wiener Philharmoniker, Tugan Sokhiev', role: 'headliner', day: '3. September 2026', stage: 'Wolkenturm' },
    { name: 'Tonkünstler-Orchester Niederösterreich, Fabien Gabel, Asmik Grigorian', role: 'special', day: '4. September 2026', stage: 'Wolkenturm' },
    { name: 'Mahler Chamber Orchestra, Teddy Abrams, Yuja Wang', role: 'special', day: '5. September 2026', stage: 'Wolkenturm' },
    { name: 'Orchestra Giovanile Luigi Cherubini, Riccardo Muti, Rudolf Buchbinder', role: 'support', day: '6. September 2026', stage: 'Wolkenturm' },
  ],
  lineupTitle: 'Rückblick: Programm 2026',
  lineupNote: 'Auswahl aus dem Programm des 20. Grafenegg Festivals. Termin und Programm 2027 erscheinen auf grafenegg.com.',
  intro:
    'Im Schlosspark von Grafenegg, umgeben von jahrhundertealten Bäumen und einem der schönsten Landschaftsparks Österreichs, findet jedes Jahr ein musikalisches Ereignis statt, das Klassikliebhaber aus aller Welt anzieht. Das Grafenegg Festival gilt als einer der bedeutendsten Sommerfestivals für klassische Musik in Mitteleuropa, und das verdient es durch jede Note. Internationale Stardirigenten, Weltklasse-Solisten und erstklassige Orchester geben sich unter dem niederösterreichischen Sternenhimmel ein unvergleichliches Stelldichein.',
  historyTitle: 'Entstehung eines Klassik-Magneten',
  history:
    'Das Festival wurde 2007 gegründet und hat sich in knapp zwei Jahrzehnten zu einem Fixpunkt im europäischen Klassikkalender entwickelt; 2026 fand es zum 20. Mal statt. Herzstück ist der Wolkenturm, eine Freiluftbühne mit 1.730 Plätzen, die am 22. Juni 2007 mit der Sommernachtsgala eröffnet wurde. Seit 2008 ergänzt das Auditorium mit bis zu 1.300 Plätzen das Gelände als wettergeschützter Konzertsaal, seit Mai 2026 die umgebaute Reitschule als Rudolf-Buchbinder-Saal. Künstlerischer Leiter des Jubiläumssommers war der Pianist Rudolf Buchbinder; ab Oktober 2026 übernimmt Johannes Neubert. Das Tonkünstler-Orchester Niederösterreich ist das Residenzorchester und prägt das Festival entscheidend.',
  whatToExpectTitle: 'Klangerlebnis inmitten der Natur',
  whatToExpect:
    'Das 20. Grafenegg Festival lief vom 14. August bis 6. September 2026 und spielte am Wolkenturm, im Auditorium, im Schlosshof und erstmals im neuen Rudolf-Buchbinder-Saal. Eröffnet wurde es mit Beethovens Chorfantasie und Orffs Carmina Burana, zum Finale kamen unter anderem die Münchner und die Wiener Philharmoniker. Neu war eine Nachmittagsreihe an den Festival-Samstagen um 15.30 Uhr im Rudolf-Buchbinder-Saal. Der Wolkenturm verwandelt sich bei Sonnenuntergang in eine magische Konzertstätte, bei der Natur und Musik verschmelzen.',
  whatToExpectList: [
    'Konzerte auf dem Wolkenturm mit Blick in den Schlosspark',
    'Wettergeschütztes Auditorium mit bis zu 1.300 Plätzen',
    'Renommierte Gastorchester aus dem In- und Ausland',
    'Nachmittagskonzerte im neuen Rudolf-Buchbinder-Saal',
    'Tonkünstler-Orchester Niederösterreich als Residenzorchester',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🚂',
      label: 'Anreise mit der Bahn',
      text: 'Stündlich Züge ab Wien Franz-Josefs-Bahnhof nach Wagram-Grafenegg. Zu Grafeneggs eigenen Veranstaltungen fährt außerdem ein Bus ab dem Musikverein Wien.',
    },
    {
      icon: '🚗',
      label: 'Anreise mit dem Auto',
      text: 'Von Wien über die A22 bis Stockerau, weiter auf der S5 Richtung Krems bis zur Ausfahrt Grafenwörth, rund 60 km.',
    },
    {
      icon: '🌦️',
      label: 'Wetter & Kleidung',
      text: 'Abendveranstaltungen können kühl sein. Warme Kleidung und eine leichte Regenjacke sind empfohlen.',
    },
    {
      icon: '🎟️',
      label: 'Tickets & Reservierung',
      text: 'Online-Buchung unter grafenegg.com. Für populäre Konzerte frühzeitig buchen.',
    },
  ],
  gallery: [],
  ctaText: 'Klassik-Events in Niederösterreich entdecken',
  ctaLink: '/map?bundesland=Nieder%C3%B6sterreich&category=Kultur',
  seoTitle: 'Grafenegg Festival 2026: Klassik im Schlosspark',
  seoDescription:
    'Grafenegg Festival 2026: Weltklasse-Klassikkonzerte im Schlosspark Niederösterreichs. Termine, Programm, Tickets und Anreise zum Top-Sommerfestival.',
  keywords: [
    'Grafenegg Festival',
    'Grafenegg Festival 2026',
    'Klassik Niederösterreich',
    'Schlosspark Konzert',
    'Wolkenturm Grafenegg',
    'Tonkünstler-Orchester',
    'Klassikfestival Österreich',
    'Sommerkonzert Niederösterreich',
    'Orchesterkonzert Open Air',
  ],
  jsonLdEvent: {
    name: 'Grafenegg Festival 2026',
    startDate: '2026-08-14',
    endDate: '2026-09-06',
    location: 'Schlosspark Grafenegg, 3485 Grafenegg, Austria',
    addressCountry: 'AT',
    url: 'https://www.grafenegg.com',
    description:
      'Das Grafenegg Festival zählt zu den renommiertesten Klassikfestivals Mitteleuropas und findet im romantischen Schlosspark Grafenegg in Niederösterreich statt.',
    image:
      'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1600&q=85&auto=format&fit=crop',
  },
};
