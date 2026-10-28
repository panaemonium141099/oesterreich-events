import type { FestivalPost } from '../types';

// Termin, Route, Teilnehmerzahl und Geschichte geprüft am 2026-10-27 gegen wien.orf.at/stories/3357887/
// (30. Parade am 13.6.2026), derstandard.at (Vienna Pride 2026, erste Parade 29.6.1996),
// wien.info/de/sehen-erleben/lgbt/regenbogenparade-geschichte-356350 und vienna.at (Route und
// Sperren 2026). hosiwien.at/regenbogenparade/ leitet auf viennapride.at weiter (403 für den
// Abruf). Vorher falsch: Start am Platz der Menschenrechte/MQ mit Ziel Rathausplatz (Start und
// Ziel sind der Rathausplatz, Zug gegen die Fahrtrichtung), Kundgebung "ab 14 Uhr" (Abmarsch
// 12 Uhr), U2 Museumsquartier, unbelegte Zahlen (100 Gruppen, 5 km), After-Party im Stadtpark,
// HOSI Wien als Organisatorin der ersten Parade (nicht belegt).
export const post: FestivalPost = {
  slug: 'wiener-regenbogenparade',
  title: 'Wiener Regenbogenparade',
  subtitle: 'Österreichs größte Pride-Parade: Farben, Musik und Botschaft im Herzen Wiens',
  heroImage: '/images/blog/wiener-regenbogenparade/hero.jpg',
  thumbnailImage: '/images/blog/wiener-regenbogenparade/thumb.jpg',
  publishDate: '2026-03-31',
  updatedDate: '2026-10-27',
  readingTime: 5,
  excerpt:
    'Jedes Jahr im Juni bewegt die Wiener Regenbogenparade (Pride) laut Veranstaltern über 300.000 Menschen auf der Wiener Ringstraße. Ein Fest der Vielfalt, der Sichtbarkeit und des Feierns.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-pink-600 text-white',
  keyFacts: {
    dates: '2026: Samstag, 13. Juni (30. Parade). 2027: Juni, Termin folgt',
    location: 'Wiener Ringstraße (Start und Ziel Rathausplatz)',
    address: 'Rathausplatz, 1010 Wien',
    genre: 'Pride, Parade, Party, Musik, Community',
    price: 'Eintritt frei (kostenlose Teilnahme)',
    website: 'https://viennapride.at/',
    capacity: 'rund 320.000 Menschen 2026 (laut Veranstaltern)',
    since: '1996',
  },
  lineup: [
    { name: 'Paradezug über die Ringstraße', role: 'headliner', stage: 'Ringstraße' },
    { name: 'Pride Celebration am Rathausplatz', role: 'headliner', stage: 'Rathausplatz' },
    { name: 'JJ (2026)', role: 'special', stage: 'Rathausplatz' },
    { name: 'Conchita Wurst (2026)', role: 'special', stage: 'Rathausplatz' },
  ],
  lineupTitle: 'Programm-Highlights',
  lineupNote:
    'Die Auftritte bei der Pride Celebration 2026 laut ORF Wien. Programm und Termin 2027 veröffentlicht Vienna Pride auf viennapride.at.',
  intro:
    'Jedes Jahr im Juni verwandelt sich die Wiener Ringstraße in ein Meer aus Regenbogenfarben. Die Wiener Regenbogenparade, Höhepunkt der Vienna Pride, zieht seit 1996 über den Ring: 2026 waren es laut Veranstaltern rund 320.000 Menschen, die gemeinsam für Sichtbarkeit, Gleichberechtigung und das Recht auf Anderssein eintraten. Die Parade ist zugleich politische Kundgebung und ausgelassenes Fest, mit bunten Floats, Musiktrucks, Drag Queens und einem Publikum, das Wien an diesem Tag mit voller Herzlichkeit vereint.',
  historyTitle: 'Drei Jahrzehnte Sichtbarkeit in Wien',
  history:
    'Die erste Wiener Regenbogenparade zog am 29. Juni 1996 unter dem Motto „Sichtbar 96“ über die Ringstraße, damals noch in Fahrtrichtung vom Schwarzenbergplatz bis zum Schottentor. Die Idee hatte Mitorganisator Andreas Brunner, heute Co-Leiter des Zentrums für queere Geschichte QWIEN: Er hatte 1994 in New York das 25-Jahr-Jubiläum der Stonewall-Unruhen erlebt und wollte etwas Vergleichbares in Wien. Seit 2007 bündelt die Vienna Pride alle Veranstaltungen rund um die Parade. Die 30. Parade am 13. Juni 2026 stand unter dem Motto „Sichtbar seit 1996“.',
  whatToExpectTitle: 'Was erwartet dich bei der Regenbogenparade?',
  whatToExpect:
    'Die Parade startet zu Mittag am Rathausplatz und zieht entgegen der Fahrtrichtung über den Ring: vorbei an Parlament, Oper, Stubenring und Urania, über Schwedenplatz und Franz-Josefs-Kai bis zum Schottentor und zurück zum Rathausplatz. Dort folgt die Pride Celebration mit Auftritten, den traditionellen Abschluss bildet der Donauwalzer. Mit Floats und Fußgruppen sind NGOs, Firmen, politische Parteien und Communities dabei.',
  whatToExpectList: [
    'Paradezug mit Floats und Fußgruppen rund um die Ringstraße',
    'Musik-Trucks mit Live-DJ, Pop und Dance entlang der Ringstraße',
    'Pride Celebration am Rathausplatz mit dem Donauwalzer als Abschluss',
    'Kostenlose Teilnahme: jede und jeder ist willkommen',
    'Afterparties in vielen Wiener Clubs und Bars am Abend',
    'Vienna Pride: rund zwei Wochen Programm rund um die Parade (2026: 29. Mai bis 14. Juni)',
  ],
  practicalInfoTitle: 'Praktische Infos zur Regenbogenparade',
  practicalInfo: [
    {
      icon: '🌈',
      label: 'Mitmachen',
      text: 'Alle sind willkommen! 2026 war der Abmarsch um 12 Uhr am Rathausplatz, die Spitze des Zuges kam gegen 16 Uhr wieder dort an.',
    },
    {
      icon: '🚇',
      label: 'Anreise',
      text: 'U2 Rathaus. Die Ringstraße ist während der Parade gesperrt, Straßenbahnlinien wie 1, 2, 71 und D fahren kurz oder umgeleitet. Am besten mit der U-Bahn anreisen.',
    },
    {
      icon: '📸',
      label: 'Tipp für Zuschauer',
      text: 'Die Ringstraße bietet beste Sicht. Früh einen guten Platz sichern, entlang der ganzen Strecke wird es voll.',
    },
    {
      icon: '🎨',
      label: 'Kleidung & Mitbringen',
      text: 'Regenbogenfarben, Glitzer und Kostüme herzlich willkommen. Sonnencreme und Wasser nicht vergessen.',
    },
  ],
  gallery: [],
  ctaText: 'Community-Events in Wien entdecken',
  ctaLink: '/map?category=Kultur&region=Wien',
  seoTitle: 'Wiener Regenbogenparade: Wien Pride Infos & Programm',
  seoDescription:
    'Die Wiener Regenbogenparade: Termin, Route, Teilnahme und Programm für Österreichs größtes Pride-Event mit laut Veranstaltern über 300.000 Menschen im Juni.',
  keywords: [
    'Wiener Regenbogenparade',
    'Wien Pride 2026',
    'Regenbogenparade Wien',
    'Vienna Pride',
    'LGBTQ Wien',
    'Pride Parade Wien',
    'Ringstraße Parade',
    'Wien Pride Veranstaltung',
    'Regenbogenparade Datum',
    'HOSI Wien',
  ],
  jsonLdEvent: {
    name: 'Wiener Regenbogenparade 2026',
    startDate: '2026-06-13',
    endDate: '2026-06-13',
    location: 'Rathausplatz, 1010 Wien, Austria',
    addressCountry: 'AT',
    url: 'https://viennapride.at/',
    description:
      'Die Wiener Regenbogenparade ist Österreichs größtes Pride-Event, 2026 laut Veranstaltern mit rund 320.000 Menschen auf der Wiener Ringstraße.',
    image:
      'https://images.unsplash.com/photo-1559163474-00a5f66a4b06?w=1600&q=85&auto=format&fit=crop',
  },
};
