import type { FestivalPost } from '../types';

// Termine, Line-up, Spielorte, Preise und Geschichte geprüft am 2026-10-27 gegen
// snowbombing.com (Startseite, /book, /experience/venues), tirol.at/aktivitaeten/events/
// alle-events/snowbombing (Termin 2026, Veranstalter SBH Events Ltd) und
// inthesnow.com/25-years-of-snowbombing (Risoul, Umzug nach Mayrhofen 2005). Vorher stand
// hier im April Geschätztes und Erfundenes: 30. März bis 4. April 2026 (tatsächlich 6. bis
// 11. April), Gründung 1999 durch zwei „Musikjournalisten“ Gareth Cooper und Ed Cole
// (offiziell „since 2000“, Start in Frankreich), ein Line-up 2026 aus Chase & Status,
// Annie Mac, The Blessed Madonna, Jamie Jones u. a., Bühnen „Stadium“ und Igluzelt
// „Arctic Disco“ (auf der Spielort-Seite nicht vorhanden), 10.000 Besucher, Festival-Pass
// ab 250 €, Adresse Hauptstraße 428, Bahnzeiten und Pistenkilometer ohne Beleg.
export const post: FestivalPost = {
  slug: 'snowbombing-mayrhofen',
  title: 'Snowbombing Festival Mayrhofen',
  subtitle: 'Das Schneefestival in Mayrhofen: Electronic Music, Live-Acts und Skifahren im Zillertal',
  heroImage: '/images/blog/snowbombing-mayrhofen/hero.jpg',
  thumbnailImage: '/images/blog/snowbombing-mayrhofen/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.snowbombing.com/',
      'https://www.tirol.at/aktivitaeten/events/alle-events/snowbombing',
      'https://inthesnow.com/25-years-of-snowbombing',
      'https://www.snowbombing.com/experience/venues',
      'https://www.snowbombing.com/book',
    ],
  },
  readingTime: 6,
  excerpt:
    'Snowbombing in Mayrhofen verbindet Skifahren im Zillertal mit Musik bis in die Nacht: tagsüber Pisten und Bergpartys, abends DJs und Live-Acts im Wald, auf der Straße und in Clubs. Die 27. Ausgabe findet von 5. bis 10. April 2027 statt.',
  category: 'Musik & Konzerte',
  categoryColor: 'bg-cyan-600 text-white',
  keyFacts: {
    dates: '5. bis 10. April 2027 (2026: 6. bis 11. April)',
    location: 'Mayrhofen im Zillertal',
    address: '6290 Mayrhofen, Zillertal',
    genre: 'Electronic, House, Techno, Drum & Bass, Live-Konzerte',
    price: 'Pakete mit Unterkunft ab 399 £ pro Person, inklusive Festivalband (249 £)',
    website: 'https://www.snowbombing.com',
    since: '2000 (in Mayrhofen seit 2005)',
  },
  lineup: [
    { name: 'Bicep (Live)', role: 'headliner' },
    { name: 'Fatboy Slim', role: 'headliner' },
    { name: '2manydjs (DJ Set)', role: 'headliner' },
    { name: 'Basement Jaxx (DJ Set)', role: 'special' },
    { name: 'Groove Armada (DJ Set)', role: 'special' },
    { name: 'Andy C', role: 'special' },
    { name: 'Skream', role: 'support' },
    { name: 'Wilkinson', role: 'support' },
  ],
  lineupNote:
    'Auswahl aus dem bisher angekündigten Line-up 2027 laut snowbombing.com; weitere Acts folgen. Tage und Bühnen sind noch nicht veröffentlicht.',
  intro:
    'Mayrhofen im Zillertal wird jeden April zum Schauplatz einer besonderen Mischung: Snowbombing verbindet elektronische Musik und Live-Acts mit Skifahren in den Tiroler Alpen. Das Konzept: tagsüber auf die Piste und zu Partys am Berg, abends Konzerte und DJ-Sets an ungewöhnlichen Orten, von der Bühne im Wald bis zur Straßenparty im Ortszentrum. Bekannt ist das Festival auch für seine Kostümpartys. Veranstalter ist das britische Unternehmen SBH Events Ltd.',
  historyTitle: 'Von Frankreich ins Zillertal: Snowbombing seit 2000',
  history:
    'Snowbombing gibt es laut Veranstalter seit 2000. Die ersten Ausgaben fanden in Frankreich statt, zuerst im Skiort Risoul, später in Les Arcs und im schweizerischen Villars. 2005 zog das Festival nach Mayrhofen in Tirol und ist seither dort zu Hause. 2027 steht die 27. Ausgabe an.',
  whatToExpectTitle: 'Was Snowbombing bietet',
  whatToExpect:
    'Snowbombing dauert sechs Tage. Tagsüber stehen Skifahren, Snowboarden und Partys am Berg auf dem Programm, dazu Wellness und Yoga. Abends und nachts verteilt sich die Musik auf Spielorte im ganzen Ort: The Forest Stage im Wald, die große Open-Air-Party The Street Party im Ortszentrum, Clubs wie The Racket Club und The Vault sowie Pop-up-Partys.',
  whatToExpectList: [
    'The Forest Stage: Bühne mitten im Wald',
    'The Street Party: Open-Air-Party im Ortszentrum von Mayrhofen',
    'Pilz Bar und Mountaintop Brunch am Berg',
    'Clubs: The Racket Club, The Fun Haus, The Vault, Rompa’s Reggae Shack',
    'Kostümpartys, Pop-up-Partys und Bongo’s Bingo',
    'Wellness: Yoga am Berg und Rooftop-Pools',
  ],
  practicalInfoTitle: 'Alles Wichtige zu Snowbombing',
  practicalInfo: [
    {
      icon: '🎫',
      label: 'Tickets & Pakete',
      text: 'Gebucht wird über snowbombing.com, meist als Paket mit Unterkunft. Pakete starten bei 399 £ pro Person, darin enthalten ist das Festivalband um 249 £. Anzahlung 50 £ pro Person, der Rest in Raten bis 1. März.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Mit dem Zug nach Jenbach im Inntal, dann mit der Zillertalbahn bis Mayrhofen.',
    },
    {
      icon: '🎿',
      label: 'Skipass',
      text: 'Die Paketpreise auf der Buchungsseite nennen keinen Skipass.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Snowbombing bietet Pakete in Hotels, Chalets und Apartments in Mayrhofen an; einzelne Unterkünfte sind früh ausgebucht.',
    },
  ],
  gallery: [],
  ctaText: 'Musik-Events in Tirol entdecken',
  ctaLink: '/map?bundesland=Tirol&category=Musik',
  seoTitle: 'Snowbombing Mayrhofen 2027: Line-up, Pakete & Tipps',
  seoDescription:
    'Snowbombing Mayrhofen 2027 von 5. bis 10. April: Skifahren tagsüber, DJs und Live-Acts nachts. Line-up, Pakete und Tipps zum Schneefestival im Zillertal.',
  keywords: [
    'Snowbombing 2027',
    'Snowbombing Mayrhofen',
    'Musik Festival Tirol Winter',
    'Ski Festival Österreich',
    'Electronic Music Festival Alpen',
    'Mayrhofen Festival April',
    'Snowbombing Line-up',
    'Snowbombing Tickets',
    'Zillertal Festival',
    'Snow Festival Mayrhofen Programm',
  ],
  jsonLdEvent: {
    name: 'Snowbombing Festival Mayrhofen 2027',
    startDate: '2027-04-05',
    endDate: '2027-04-10',
    location: '6290 Mayrhofen, Austria',
    addressCountry: 'AT',
    url: 'https://www.snowbombing.com',
    description:
      'Snowbombing ist ein Schneefestival in Mayrhofen, Tirol: Skifahren im Zillertal kombiniert mit internationalen DJs und Live-Acts.',
    image:
      'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1600&q=85&auto=format&fit=crop',
  },
};
