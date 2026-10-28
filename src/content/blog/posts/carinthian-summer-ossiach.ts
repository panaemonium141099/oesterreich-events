import type { FestivalPost } from '../types';

// Termin, Spielstätten, Programm, Preise und Geschichte geprüft am 2026-10-27 gegen
// carinthischersommer.at (/programm/, /unser-sommer/chronik/, /ihr-besuch/spielstaetten/,
// /ihr-besuch/verkaufsinformationen/) und die APA-Bilanz auf vienna.at (19.200 Besucher,
// 52 Veranstaltungen). Termin 2026 (2. Juli bis 2. August) stimmte. Vorher falsch: die
// Website carinthiansummer.at (Fremd-Domain, falsches Zertifikat; offiziell ist
// carinthischersommer.at), Gründer "Miljenko Grgic" (erster Intendant war Helmuth
// Wobisch), "Kärntner Sinfonieorchester", "Ensemble Wien-Berlin" und "Renate Ackermann"
// (nicht im Programm 2026), Open-Air-Gala am Seeufer, Kreuzgang-Kammermusik,
// Meisterkurse, Frühbucherrabatt, Preise 20 bis 90 Euro, "1.200 pro Konzert" und Schiffe
// ab Velden/Klagenfurt (die fahren auf dem Wörthersee). Kein Termin 2027 veröffentlicht.
export const post: FestivalPost = {
  slug: 'carinthian-summer-ossiach',
  title: 'Carinthischer Sommer in Ossiach und Villach',
  subtitle: 'Klassikfestival rund um den Ossiacher See, seit 1969 mit Wurzeln im Stift Ossiach',
  heroImage: '/images/blog/carinthian-summer-ossiach/hero.jpg',
  thumbnailImage: '/images/blog/carinthian-summer-ossiach/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://carinthischersommer.at/',
      'https://carinthischersommer.at/unser-sommer/chronik/',
      'https://carinthischersommer.at/programm/',
      'https://www.vienna.at/carinthischer-sommer-erzielte-2026-auslastung-von-96-prozent/10362938',
      'https://carinthischersommer.at/ihr-besuch/verkaufsinformationen/',
      'https://carinthischersommer.at/ihr-besuch/spielstaetten/',
    ],
  },
  readingTime: 7,
  excerpt:
    'Der Carinthische Sommer ist eines der traditionsreichsten Klassikfestivals Österreichs. Gespielt wird in der Stiftskirche Ossiach, im Congress Center Villach und an weiteren Orten in Kärnten.',
  category: 'Musik & Konzerte',
  categoryColor: 'bg-teal-700 text-white',
  keyFacts: {
    dates: '2. Juli bis 2. August 2026 (Termin 2027 folgt)',
    location: 'Stift Ossiach, Congress Center Villach und weitere Spielstätten in Kärnten',
    address: 'Stift Ossiach, Ossiach 1, 9570 Ossiach, Kärnten',
    genre: 'Klassik, Kammermusik, Orchesterkonzerte, Kirchenmusik',
    price: 'Abos 2026 von 99 bis 145 Euro; Kinder bis 12 Jahre frei',
    website: 'https://carinthischersommer.at/',
    capacity: '19.200 Besucherinnen und Besucher bei 52 Veranstaltungen (2026)',
    since: '1969',
  },
  lineup: [
    { name: 'Hilary Hahn & Die Deutsche Kammerphilharmonie Bremen', role: 'headliner', day: '22. Juli 2026', stage: 'Congress Center Villach' },
    { name: 'Rudolf Buchbinder', role: 'headliner', day: '11. Juli 2026', stage: 'Congress Center Villach' },
    { name: 'Il Giardino Armonico & Julia Lezhneva', role: 'headliner', day: '15. Juli 2026', stage: 'Stiftskirche Ossiach' },
    { name: 'ORF Radio-Symphonieorchester Wien', role: 'special', day: '4. Juli 2026 (Eröffnungskonzert)', stage: 'Congress Center Villach' },
    { name: 'Avi Avital', role: 'special', day: '27. Juli 2026', stage: 'Konzerthaus Klagenfurt' },
    { name: 'Camerata Salzburg', role: 'special', day: '2. August 2026 (Finale)', stage: 'Congress Center Villach' },
  ],
  lineupTitle: 'Programm-Highlights 2026',
  lineupNote:
    'Auswahl aus dem Programm 2026 laut carinthischersommer.at. Das Programm für 2027 ist noch nicht veröffentlicht.',
  intro:
    'Am Ufer des Ossiacher Sees liegt der Ursprung eines der ältesten Musikfestivals Österreichs: des Carinthischen Sommers. Seit 1969 erklingt hier im Sommer Klassik in der Stiftskirche Ossiach, dazu kommen das Congress Center Villach und weitere Spielstätten in Kärnten. 2026 lief das Festival vom 2. Juli bis 2. August unter dem Motto „fern & nah“ und unter der Leitung von Nadja Kayali.',
  historyTitle: 'Ossiach und die Musik: Geschichte seit 1969',
  history:
    'Der Carinthische Sommer wurde 1969 als Musikfestival im Stift Ossiach gegründet. Erster Intendant war Helmuth Wobisch (1969 bis 1979), ihm folgten Gerda Fröhlich (1980 bis 2003), Thomas Daniel Schlee (2004 bis 2015) und Holger Bleck (2016 bis 2023). Seit Oktober 2023 leitet Nadja Kayali das Festival. Wobisch und Fröhlich begründeten die Tradition der Kirchenoper, beginnend 1975 mit der österreichischen Erstaufführung von Benjamin Brittens „Der verlorene Sohn“. 1977 dirigierte Leonard Bernstein im Kongresshaus Villach die Uraufführung der revidierten Fassung seiner Dritten Symphonie „Kaddish“.',
  whatToExpectTitle: 'Konzerte, See und Stille',
  whatToExpect:
    'Das Festival bietet über rund fünf Wochen Orchesterkonzerte, Kammermusik und Kirchenmusik. Die Stiftskirche Ossiach ist der historische Kern, große Orchesterabende finden im Congress Center Villach statt. Weitere Spielstätten waren 2026 unter anderem der Alban Berg Konzertsaal im Stift Ossiach, das Domenig Steinhaus in Steindorf, der Klagenfurter Dom, das Konzerthaus Klagenfurt und die Burgarena Finkenstein.',
  whatToExpectList: [
    'Konzerte in der Stiftskirche Ossiach',
    'Orchesterabende im Congress Center Villach',
    'Kammermusik im Alban Berg Konzertsaal des Stifts',
    'Konzerte in Klagenfurt, Steindorf und Finkenstein',
    'Abonnements für Eröffnungswochenende, Kammermusik und Orchester',
    'Seeerlebnis: Konzertbesuch kombinierbar mit Baden und Wandern',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Karten im Webshop auf carinthischersommer.at, im Kartenbüro am Hans-Gasser-Platz 5 in Villach (Montag bis Freitag 10 bis 17 Uhr), bei oeticket und an der Abendkasse. 2026 gab es Abos von 99 bis 145 Euro, für Studierende und Lehrlinge unter 26 Karten um 15 Euro bei ausgewählten Konzerten, Kinder bis 12 Jahre frei.',
    },
    {
      icon: '🚌',
      label: 'Anreise',
      text: 'Ossiach liegt am Südufer des Ossiacher Sees nahe Villach und ist über die A10 gut erreichbar. Das Congress Center Villach liegt am Europaplatz 1 in Villach.',
    },
    {
      icon: '🏊',
      label: 'Kombinierbar',
      text: 'Ossiacher See bietet exzellente Bademöglichkeiten direkt neben dem Festivalgelände. Kombination aus Konzertbesuch und Seeurlaub ideal.',
    },
    {
      icon: '👔',
      label: 'Dresscode',
      text: 'Abendveranstaltungen: elegante Kleidung empfohlen. Open-Air-Events: sommerlich-legere Kleidung. Immer etwas Wärmeres einpacken.',
    },
  ],
  gallery: [],
  ctaText: 'Musik-Events in Kärnten entdecken',
  ctaLink: '/map?bundesland=Kärnten&category=Kultur',
  seoTitle: 'Carinthischer Sommer 2026: Programm, Termin und Tickets',
  seoDescription:
    'Carinthischer Sommer 2026 (2. Juli bis 2. August): Klassikfestival in Ossiach und Villach mit Hilary Hahn, Rudolf Buchbinder und Il Giardino Armonico.',
  keywords: [
    'Carinthischer Sommer 2026',
    'Carinthian Summer Ossiach',
    'Klassikfestival Kärnten',
    'Ossiacher See Konzert',
    'Stift Ossiach Musik',
    'Kammermusik Ossiach',
    'Carinthischer Sommer Tickets',
    'Klassik Sommer Kärnten',
    'Congress Center Villach Konzert',
    'Musik Ossiacher See',
  ],
  jsonLdEvent: {
    name: 'Carinthischer Sommer 2026',
    startDate: '2026-07-02',
    endDate: '2026-08-02',
    location: 'Stift Ossiach, Ossiach 1, 9570 Ossiach, Kärnten, Austria',
    addressCountry: 'AT',
    url: 'https://carinthischersommer.at/',
    description:
      'Der Carinthische Sommer ist ein Klassikfestival in Kärnten mit Konzerten in der Stiftskirche Ossiach, im Congress Center Villach und an weiteren Spielstätten.',
    image:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=85&auto=format&fit=crop',
  },
};
