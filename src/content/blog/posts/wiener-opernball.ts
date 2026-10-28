import type { FestivalPost } from '../types';

// Termine, Ablauf, Preise, Zahlen und Geschichte geprüft am 2026-10-27 gegen opernball.at
// (Startseite, /karten/, /ballabend/, /ballabend/2026/, /ueber-den-ball/; die alte URL
// wiener-staatsoper.at/spielplan-tickets/opernball/ lieferte 404) und wien.info. Datum 2026
// (12. Februar) laut Pressekonferenz-Berichten (news.at, leadersnet.at). Vorher falsch:
// jsonLd 26.2.2026 (tatsächlich 12.2.), Eröffnung durch die "Wiener Philharmoniker" (es
// spielen Orchester der Wiener Staatsoper und Wiener Opernball Orchester), 144 statt 160
// Debütantenpaare, Preise (Logen "ab 280 €", "Stehplätze Ballsaal ab 35 €"), Einlass 20 statt
// 20:15 Uhr, "Frack oder Smoking" (Smoking ist nicht erlaubt), Geschichte (Unterbrechung
// "durch beide Weltkriege").
export const post: FestivalPost = {
  slug: 'wiener-opernball',
  title: 'Wiener Opernball',
  subtitle: 'Das glamouröseste Ballereignis der Welt in der Wiener Staatsoper',
  heroImage: '/images/blog/wiener-opernball/hero.jpg',
  thumbnailImage: '/images/blog/wiener-opernball/thumb.jpg',
  publishDate: '2026-03-31',
  updatedDate: '2026-10-27',
  readingTime: 7,
  excerpt:
    'Der Wiener Opernball ist das gesellschaftliche Ereignis des Jahres, eine Nacht in der k.k. Hofoper mit Weltprominenz, Debutantinnen und dem berühmtesten Parkett Europas.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-yellow-700 text-white',
  keyFacts: {
    dates: '69. Wiener Opernball: Donnerstag, 4. Februar 2027, Einlass 20:15 Uhr (2026: 12. Februar)',
    location: 'Wiener Staatsoper',
    address: 'Opernring 2, 1010 Wien',
    genre: 'Klassik, Ball, Gesellschaft, Debüt',
    price: 'Eintrittskarte 435 €, Tischplatz 665 €, Logen 15.000 bis 27.000 €, Zuschauerkarten 110 bis 290 €',
    website: 'https://www.opernball.at/',
    capacity: 'rund 5.500 Ballgäste',
    since: '1877 (erste Hofopern-Soirée)',
  },
  lineup: [
    { name: 'Orchester der Wiener Staatsoper', role: 'headliner', stage: 'Ballsaal' },
    { name: 'Wiener Opernball Orchester', role: 'headliner', stage: 'Ballsaal' },
    { name: 'Wiener Staatsballett', role: 'special', stage: 'Ballsaal' },
    { name: 'Eröffnungskomitee der Debütantenpaare', role: 'special', stage: 'Ballsaal' },
    { name: 'Fledermaus-Quadrille um Mitternacht', role: 'special', stage: 'Ballsaal' },
  ],
  lineupTitle: 'Programm-Highlights',
  lineupNote:
    'Die Gesangsstars der Eröffnung wechseln jedes Jahr: 2026 sangen Pretty Yende und Benjamin Bernheim. Das Eröffnungsprogramm 2027 ist noch nicht veröffentlicht (Stand Oktober 2026).',
  intro:
    'Kein Ball der Welt erzeugt so viel Aufmerksamkeit wie der Wiener Opernball. Wenn im Fasching die Sitzreihen aus dem Zuschauerraum der Staatsoper verschwinden und sich das Parkett zur Tanzfläche wandelt, beginnt eine Nacht, die zu den glanzvollsten Gesellschaftsereignissen überhaupt zählt. Rund 5.500 Gäste aus Kultur, Wirtschaft, Politik, Wissenschaft und Sport tanzen gemeinsam in einem der schönsten Gebäude der Welt. Der Wiener Opernball ist nicht nur ein Ball, er ist ein Kulturphänomen.',
  historyTitle: 'Seit 1877: Glamour und Tradition',
  history:
    'Die Wurzeln des Wiener Opernballs reichen bis ins Jahr 1877 zurück: Am 11. Dezember 1877 fand im Haus am Ring die erste Tanzveranstaltung statt, eine Hofopern-Soirée. 1878 folgte die erste offizielle Redoute unter Eduard Strauß, 1899 schaffte Gustav Mahler sie vorerst wieder ab. 1921 gab es die erste Opernredoute der Republik, 1935 hieß der Ball erstmals Wiener Opernball. Im Zweiten Weltkrieg fand kein Ball statt, nach dem Wiederaufbau der Oper verwandelte sich das Haus 1956 wieder in einen Ballsaal. Abgesagt wurde er seither 1991 wegen des Golfkriegs sowie 2021 und 2022 wegen der Pandemie. Das Eröffnungszeremoniell mit den Debütantenpaaren in weißen Kleidern und Fracks überträgt der ORF live.',
  whatToExpectTitle: 'Was erwartet dich am Opernball?',
  whatToExpect:
    'Die Eröffnung beginnt um 22 Uhr: Opern- und Ballettstars, das Orchester der Wiener Staatsoper und das Wiener Staatsballett gestalten das Programm, danach eröffnen die jungen Paare des Eröffnungskomitees mit der Polonaise den Tanz. Um 22:45 Uhr heißt es „Alles Walzer“ und das Parkett gehört allen Gästen. Bis zum offiziellen Ende um 5 Uhr früh wird getanzt, gefeiert und geflüstert.',
  whatToExpectList: [
    'Feierliche Eröffnung um 22 Uhr mit den Debütantenpaaren (2026: 160 Paare), Staatsopernorchester und Staatsballett',
    'Tanzen auf dem berühmten Parkett der Wiener Staatsoper',
    'Logen und Zuschauerplätze für Zusehende',
    'Mitternachtsquadrille: um 0 Uhr wird die Fledermaus-Quadrille getanzt',
    '20 Bars und Buffets und 5 Tanzflächen auf 9 Stockwerken',
    'Live-Übertragung in ORF 2 und 3sat',
  ],
  practicalInfoTitle: 'Praktische Infos für den Opernball',
  practicalInfo: [
    {
      icon: '👗',
      label: 'Kleidungsordnung',
      text: 'Damen: bodenlanges Ballkleid in beliebiger Farbe, Tracht und Festdirndl sind nicht erlaubt. Herren: schwarzer Frack mit weißem Frackhemd, weißer Fliege und schwarzen Lackschuhen, Galauniform optional.',
    },
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Eintrittskarten für 2027 wurden verlost: Die Registrierung lief von 1. bis 5. Juni 2026, ein Gewinn berechtigt zum Kauf. Eintrittskarte 435 €, Tischplatz 665 €, Logen 15.000 bis 27.000 €. Infos unter opernball.at.',
    },
    {
      icon: '🚇',
      label: 'Anreise',
      text: 'U1/U2/U4 Station Karlsplatz/Oper. Taxi oder Mietwagen für den festlichen Auftritt empfohlen.',
    },
    {
      icon: '🕗',
      label: 'Ablauf',
      text: 'Einlass ab 20:15 Uhr, Eröffnung um 22:00 Uhr, „Alles Walzer“ um 22:45 Uhr, Quadrille um Mitternacht. Der Ball endet offiziell um 05:00 Uhr.',
    },
  ],
  gallery: [],
  ctaText: 'Kulturevents in Wien entdecken',
  ctaLink: '/map?category=Kultur&region=Wien',
  seoTitle: 'Wiener Opernball 2027: Tickets, Termin & Infos',
  seoDescription:
    'Alles zum Wiener Opernball am 4. Februar 2027: Termin, Kleiderordnung, Tickets und was dich beim glamourösesten Ball der Welt in der Wiener Staatsoper erwartet.',
  keywords: [
    'Wiener Opernball',
    'Opernball Wien',
    'Opernball 2027',
    'Wiener Staatsoper Ball',
    'Opernball Tickets',
    'Vienna Opera Ball',
    'Ball Wien Faschingszeit',
    'Debutanten Opernball',
    'Wiener Gesellschaft Ball',
    'Opernball Kleidung',
  ],
  jsonLdEvent: {
    name: 'Wiener Opernball 2027',
    startDate: '2027-02-04T20:15:00+01:00',
    endDate: '2027-02-05T05:00:00+01:00',
    location: 'Opernring 2, 1010 Wien, Austria',
    addressCountry: 'AT',
    url: 'https://www.opernball.at/',
    description:
      'Der Wiener Opernball in der Wiener Staatsoper ist eines der bekanntesten gesellschaftlichen Ereignisse der Welt.',
    image:
      'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=1600&q=85&auto=format&fit=crop',
  },
};
