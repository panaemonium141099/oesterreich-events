import type { FestivalPost } from '../types';

// Programm, Termine und Spielorte 2026 geprüft am 2026-10-27 gegen bregenzerfruehling.com
// (Startseite mit Archiv, /programm), visitbregenz.com/en/events/event-series/bregenzer-fruehling
// und die Programmankündigung auf raiffeisen.at (Raiba Bregenz, "Keep dreaming, baby").
// Vorher falsch: Termin 13.3. bis 18.4.2026 (richtig 14.3. bis 11.6.), Website
// bregenzerfruehling.at (ist heute eine Casino-Seite), erfundenes Lineup (Mamela Nyamza,
// Tanzcompagnie Vorarlberg, Schule für Tanz; Emanuel Gat war 2025), "über 20 Vorstellungen
// in fünf Wochen", Tanzpreis Vorarlberg, Workshops, Gründung 1989 als Festspiel-Ergänzung,
// Preise "ab 20 €/35 €" und Zugzeiten ohne Beleg.
export const post: FestivalPost = {
  slug: 'bregenzer-fruehling',
  title: 'Bregenzer Frühling',
  subtitle: 'Internationales Tanzfestival im Frühjahr am Bodensee',
  heroImage: '/images/blog/bregenzer-fruehling/hero.jpg',
  thumbnailImage: '/images/blog/bregenzer-fruehling/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.bregenzerfruehling.com/programm',
      'https://www.bregenzerfruehling.com',
      'https://visitbregenz.com/en/events/event-series/bregenzer-fruehling',
      'https://www.raiffeisen.at/vorarlberg/raiba-in-bregenz/de/meine-bank/aktuelles/bregenzer-fruehling-2026---keep-dreaming--baby-.html',
    ],
  },
  readingTime: 6,
  excerpt:
    'Der Bregenzer Frühling ist das internationale Festival für zeitgenössischen Tanz in Bregenz. Jedes Jahr von März bis Juni zeigt es Gastspiele internationaler Compagnien im Festspielhaus Bregenz, dazu Produktionen an weiteren Bregenzer Spielorten.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-pink-600 text-white',
  keyFacts: {
    dates: '14. März bis 11. Juni 2026 (Programm 2027 wird am 3. November 2026 vorgestellt)',
    location: 'Festspielhaus Bregenz, Kunsthaus Bregenz, Theater KOSMOS',
    address: 'Platz der Wiener Symphoniker 1, 6900 Bregenz',
    genre: 'Zeitgenössischer Tanz, Ballett, Tanztheater',
    price: 'je Vorstellung, Karten über tickets.visitbregenz.com',
    website: 'https://www.bregenzerfruehling.com',
  },
  lineup: [
    { name: 'Marie Chouinard (Kanada): MAGNIFICAT und The Rite of Spring', role: 'headliner', stage: 'Festspielhaus', day: '14. März 2026' },
    { name: 'Marie Chouinard (Kanada): In Museum', role: 'special', stage: 'Kunsthaus Bregenz', day: '15. März 2026' },
    { name: 'Hofesh Shechter Company (Großbritannien): Theatre of Dreams', role: 'headliner', stage: 'Festspielhaus', day: '28. März 2026' },
    { name: 'Nederlands Dans Theater 2 (Niederlande): Folkå und SAABA', role: 'headliner', stage: 'Festspielhaus', day: '7. Mai 2026' },
    { name: 'Cloud Gate Dance Theatre of Taiwan: Sounding Light', role: 'headliner', stage: 'Festspielhaus', day: '29. Mai 2026' },
    { name: 'aktionstheater ensemble (Österreich): HUMAN (Ich bin Mensch)', role: 'special', stage: 'Theater KOSMOS', day: 'ab 11. Juni 2026' },
  ],
  lineupTitle: 'Programm 2026',
  lineupNote:
    'Programm 2026 laut bregenzerfruehling.com, Motto "Keep Dreaming, Baby". Das Programm 2027 wird am 3. November 2026 vorgestellt.',
  intro:
    'Von März bis Juni wird Bregenz zur Tanzbühne des Bodenseeraums. Der Bregenzer Frühling, veranstaltet von der Landeshauptstadt Bregenz, holt internationale Compagnien für zeitgenössischen Tanz ins Festspielhaus. 2026 waren das unter dem Motto "Keep Dreaming, Baby" Marie Chouinard aus Kanada, die Hofesh Shechter Company aus Großbritannien, das Nederlands Dans Theater 2 und das Cloud Gate Dance Theatre of Taiwan. Dazu kamen eine neue Arbeit des aktionstheater ensemble und eine Kooperation mit dem Kunsthaus Bregenz.',
  historyTitle: 'Tanz als Sprache des Frühlings',
  history:
    'Der Bregenzer Frühling fand 2026 laut Bregenz Tourismus zum 36. Mal statt. Im Archiv des Festivals stehen große Namen des zeitgenössischen Tanzes: Akram Khan Company, Company Wayne McGregor, Ballet Preljocaj, Israel Galván, L-E-V Dance Company von Sharon Eyal und Gai Behar, Emanuel Gat Dance und immer wieder das Nederlands Dans Theater 2. Viele Stücke sind in Bregenz als österreichische Erstaufführung zu sehen, das aktionstheater ensemble zeigt jedes Jahr eine neue Arbeit.',
  whatToExpectTitle: 'Was der Bregenzer Frühling bietet',
  whatToExpect:
    'Das Festival 2026 umfasste sechs Programmpunkte zwischen 14. März und 11. Juni: vier Gastspiele internationaler Compagnien im Festspielhaus Bregenz, die Produktion "In Museum" im Kunsthaus Bregenz und eine neue Arbeit des aktionstheater ensemble im Theater KOSMOS.',
  whatToExpectList: [
    'Internationale Compagnien, 2026 aus Kanada, Großbritannien, den Niederlanden und Taiwan',
    'Zeitgenössischer Tanz im Festspielhaus Bregenz',
    'Österreichische Erstaufführungen internationaler Produktionen',
    'Jedes Jahr eine neue Arbeit des aktionstheater ensemble',
    'Kooperation mit dem Kunsthaus Bregenz (2026: "In Museum")',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Karten über bregenzerfruehling.com bzw. tickets.visitbregenz.com. Die Preise unterscheiden sich je Vorstellung.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Festspielhaus Bregenz liegt 10 min zu Fuß vom Bahnhof.',
    },
    {
      icon: '🎭',
      label: 'Dresscode',
      text: 'Das Festival ist offen und informal. Smart casual ist angemessen, Tanz-Abende sind keine Premierengalas. Bequeme Schuhe empfohlen.',
    },
    {
      icon: '🌸',
      label: 'Frühlingserlebnis',
      text: 'Bregenz im Frühjahr ist wunderschön: Bodenseepromenade, Pfänder und erste Frühlingsblüten ergänzen das Festivalprogramm.',
    },
  ],
  gallery: [],
  ctaText: 'Kulturevents in Vorarlberg entdecken',
  ctaLink: '/map?bundesland=Vorarlberg&category=Kultur',
  seoTitle: 'Bregenzer Frühling 2026: Tanzfestival, Programm & Tickets',
  seoDescription:
    'Bregenzer Frühling 2026 (14. März bis 11. Juni): Zeitgenössischer Tanz mit Marie Chouinard, Hofesh Shechter Company, NDT 2 und Cloud Gate im Festspielhaus Bregenz.',
  keywords: [
    'Bregenzer Frühling 2026',
    'Tanzfestival Bregenz',
    'Bregenzer Frühling Programm',
    'Tanz Festival Vorarlberg',
    'Zeitgenössischer Tanz Österreich',
    'Ballett Bregenz',
    'Festspielhaus Bregenz Tanz',
    'Vorarlberg Tanzveranstaltung',
    'Bregenzer Frühling Tickets',
    'Bodensee Kulturfestival',
  ],
  jsonLdEvent: {
    name: 'Bregenzer Frühling 2026',
    startDate: '2026-03-14',
    endDate: '2026-06-11',
    location: 'Festspielhaus Bregenz, Platz der Wiener Symphoniker 1, 6900 Bregenz, Austria',
    addressCountry: 'AT',
    url: 'https://www.bregenzerfruehling.com',
    description:
      'Der Bregenzer Frühling ist das internationale Festival für zeitgenössischen Tanz in Bregenz, mit Gastspielen internationaler Compagnien im Festspielhaus Bregenz.',
    image:
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1600&q=85&auto=format&fit=crop',
  },
};
