import type { FestivalPost } from '../types';

// Bestand geprüft am 2026-10-27: Ein Festival "Montafoner Sommertage" gibt es nicht, die
// Domain montafonersommertage.at existiert nicht (DNS-Fehler). Das Musikfestival im Montafon
// heißt Montafoner Resonanzen (früher Montafoner Sommer). Termine 2027, Themenblöcke,
// Geschichte und Kurator laut montafon.at/montafoner-resonanzen/de (Montafon Tourismus),
// Termine 2026 laut creativeaustria.at/en/2026/07/15/montafon-resonances-2026-montafon-vorarlberg/,
// Preisbeispiel laut montafon.at/en/concert-with-oslo-kammerakademi_vc23829. Vorher erfunden:
// Name, Termin 3. bis 18. Juli 2026, Gründung 1996, Lineup (Cuarteto Casals, Vilde Frang,
// Aris Quartett, Lars Vogt), Förderpreis, Wanderkonzerte, Festival-Pass, 200 bis 400
// Besucher je Konzert, Adresse Kirchplatz 2 Schruns. Post deshalb neu geschrieben.
export const post: FestivalPost = {
  slug: 'montafoner-sommertage',
  title: 'Montafoner Resonanzen',
  subtitle: 'Das Musikfestival im Montafon, früher Montafoner Sommer: Konzerte an besonderen Orten',
  heroImage: '/images/blog/montafoner-sommertage/hero.jpg',
  thumbnailImage: '/images/blog/montafoner-sommertage/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.montafon.at/montafoner-resonanzen/de',
      'https://www.creativeaustria.at/en/2026/07/15/montafon-resonances-2026-montafon-vorarlberg/',
    ],
  },
  readingTime: 4,
  excerpt:
    'Ein Festival namens "Montafoner Sommertage" gibt es nicht. Das Musikfestival im Montafon heißt Montafoner Resonanzen, früher Montafoner Sommer: Von Anfang August bis Anfang September spielen Musikerinnen und Musiker an besonderen Orten im Tal.',
  category: 'Musik',
  categoryColor: 'bg-emerald-700 text-white',
  keyFacts: {
    dates: '6. August bis 4. September 2027 (2026: 6. August bis 5. September)',
    location: 'Verschiedene Orte im Montafon, z. B. Pfarr- und Wallfahrtskirche Tschagguns',
    address: 'Montafon, Vorarlberg',
    genre: 'Bläser, Jazz, Kammermusik, Cross-Over, Volksmusik, Orgel',
    price: 'je Konzert, z. B. 27 € Abendkasse für ein Kammerkonzert',
    website: 'https://www.montafon.at/montafoner-resonanzen/de',
    since: '1977 (als Montafoner Sommerkonzerte)',
  },
  lineup: [],
  intro:
    'Wer nach den "Montafoner Sommertagen" sucht, sucht unter dem falschen Namen: Ein Festival dieses Namens gibt es nicht. Das Musikfestival im Montafon heißt Montafoner Resonanzen. Montafon Tourismus veranstaltet es jedes Jahr von Anfang August bis Anfang September an Orten, die zur Musik passen, etwa in historischen Kirchen, in der alpinen Natur oder in traditionellen Stuben. 2026 feierte das Festival sein zehnjähriges Jubiläum.',
  historyTitle: 'Seit 1977: Vom Montafoner Sommer zu den Resonanzen',
  history:
    'Die Wurzeln reichen bis 1977 zurück, als die Montafoner Sommerkonzerte begannen. Gründer Bernd-H. Becher begleitete die Reihe über 20 Jahre als künstlerischer Leiter. 2002 wurde sie neu gegründet, 2004 fand der erste Montafoner Sommer statt, den Nikolaus Netzer bis 2014 künstlerisch leitete. Seit 2015 ist Markus Felbermayer Kurator, seit 2017 heißt das Festival Montafoner Resonanzen.',
  whatToExpectTitle: 'Was die Montafoner Resonanzen 2027 bieten',
  whatToExpect:
    'Die elfte Ausgabe der Montafoner Resonanzen läuft vom 6. August bis 4. September 2027 und ist, wie schon 2026, in sechs Themenblöcke gegliedert. Kammermusik steht am 20. und 21. August 2027 auf dem Programm. Konkrete Ensembles und Spielorte für 2027 hat Montafon Tourismus noch nicht veröffentlicht.',
  whatToExpectList: [
    'Bläser: 6. und 7. August 2027',
    'Jazz: 12. bis 15. August 2027',
    'Kammermusik: 20. und 21. August 2027',
    'Cross-Over: 25. und 26. August 2027',
    'Volksmusik: 27. bis 29. August 2027',
    'Orgel: 2. bis 4. September 2027',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Programm und Karten auf montafon.at/montafoner-resonanzen. Die Preise unterscheiden sich je Konzert, ein Kammerkonzert in Tschagguns kostete z. B. 27 € an der Abendkasse.',
    },
    {
      icon: '🚗',
      label: 'Anreise',
      text: 'Schruns erreicht man mit der Montafonerbahn ab Bludenz. Mit dem Auto über die A14 bis Bludenz und weiter ins Montafon.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Übernachtung in Schruns oder einem der Montafoner Dörfer für das volle Erlebnis. Hotels und Ferienwohnungen früh buchen, August ist Hochsaison.',
    },
    {
      icon: '🥾',
      label: 'Bergwandern',
      text: 'Das Montafon ist ein Wanderparadies. Viele Besucher verbinden die Konzerte mit Bergtouren.',
    },
  ],
  gallery: [],
  ctaText: 'Klassik-Events in Vorarlberg entdecken',
  ctaLink: '/map?bundesland=Vorarlberg&category=Musik',
  seoTitle: 'Montafoner Resonanzen 2027 (früher Montafoner Sommer): Termine',
  seoDescription:
    'Die "Montafoner Sommertage" gibt es nicht: Das Musikfestival im Montafon heißt Montafoner Resonanzen, 2027 vom 6. August bis 4. September. Termine & Tipps.',
  keywords: [
    'Montafoner Resonanzen 2027',
    'Montafoner Sommertage',
    'Montafoner Sommer',
    'Kammermusik Montafon',
    'Montafon Festival Vorarlberg',
    'Konzerte Montafon August',
    'Kammermusik Schruns',
    'Vorarlberg Klassik Sommer',
  ],
  jsonLdEvent: {
    name: 'Montafoner Resonanzen 2027',
    startDate: '2027-08-06',
    endDate: '2027-09-04',
    location: 'Montafon, Vorarlberg, Austria',
    addressCountry: 'AT',
    url: 'https://www.montafon.at/montafoner-resonanzen/de',
    description:
      'Die Montafoner Resonanzen, früher Montafoner Sommer, sind das Musikfestival im Montafon mit Konzerten von Bläsermusik bis Orgel an besonderen Orten im Tal.',
    image:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&q=85&auto=format&fit=crop',
  },
};
