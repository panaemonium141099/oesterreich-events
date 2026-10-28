import type { FestivalPost } from '../types';

// Bestand geprüft am 2026-10-27 gegen marketing.lustenau.at (Lustenau Marketing, Termine
// Lange Nacht der Musik und Chrischtkendlimarkt, kein Martinimarkt) und das Märkteverzeichnis
// 2026 der WKO Vorarlberg (wko.at/vlbg/handel/markt-strassen-wanderhandel/
// maerkteverzeichnis-komplett.pdf: Lustenau ohne Novembermarkt außer Chrischtkendlimarkt,
// Martinimärkte nur in Dornbirn 6.11. und Bürs 15.11.). Vorher stand hier ein erfundener
// "Lustenauer Martinimarkt" am 6. bis 8. November 2026 auf dem Rathausplatz mit Bühnenprogramm
// (Lustenauer Musikverein, Brass-Ensemble Vorarlberg, Trachtengruppe, Kinderchor),
// Martinszug um 18 Uhr ab Kirchplatz und Tradition "seit dem 19. Jahrhundert". Post deshalb
// neu geschrieben, ohne Event-Schema.
export const post: FestivalPost = {
  slug: 'lustenauer-martinimarkt',
  title: 'Lustenauer Martinimarkt',
  subtitle: 'Warum es 2026 keinen Martinimarkt in Lustenau gibt und wo Martinimärkte stattfinden',
  heroImage: '/images/blog/lustenauer-martinimarkt/hero.jpg',
  thumbnailImage: '/images/blog/lustenauer-martinimarkt/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  readingTime: 3,
  excerpt:
    'Einen Lustenauer Martinimarkt gibt es 2026 nicht: Weder Lustenau Marketing noch das Märkteverzeichnis der Wirtschaftskammer Vorarlberg führen einen. Martinimärkte gibt es in Dornbirn und Bürs, in Lustenau folgt Ende November der Chrischtkendlimarkt.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-orange-700 text-white',
  keyFacts: {
    dates: 'Kein Martinimarkt in Lustenau 2026. Luschnouar Chrischtkendlimarkt: 26. bis 29. November 2026',
    location: 'Kirchplatz Lustenau (Chrischtkendlimarkt)',
    address: 'Kirchplatz, 6890 Lustenau',
    genre: 'Markt, Advent',
    price: 'Infos bei Lustenau Marketing',
    website: 'https://marketing.lustenau.at',
  },
  lineup: [],
  intro:
    'Rund um den Martinitag am 11. November gibt es in Vorarlberg Martinimärkte. Ein Lustenauer Martinimarkt gehört 2026 aber nicht dazu: Lustenau Marketing nennt für November die Lange Nacht der Musik am 6. November und den Luschnouar Chrischtkendlimarkt am Kirchplatz vom 26. bis 29. November. Auch das Märkteverzeichnis 2026 der Wirtschaftskammer Vorarlberg, in dem die Gemeinden ihre Markttermine melden, führt für Lustenau keinen Martinimarkt.',
  historyTitle: 'Martinitag und Märkte in Lustenau',
  history:
    'Der Martinitag geht auf den heiligen Martin von Tours zurück und wird am 11. November gefeiert. Lustenau, die größte Marktgemeinde Österreichs, hat übers Jahr viele eigene Märkte: 2026 etwa Kreativmarkt, Muttertagsmarkt, Weinfest, Markt der Kulturen, Kräutermarkt, die Luschnouar Kilbi im Oktober und den Chrischtkendlimarkt im Advent, dazu den Wochenmarkt am Donnerstag und Samstag.',
  whatToExpectTitle: 'Martinimärkte in der Nähe 2026',
  whatToExpect:
    'Wer einen Martinimarkt sucht, findet ihn laut Märkteverzeichnis der Wirtschaftskammer Vorarlberg 2026 in der Nachbarstadt Dornbirn am 6. November und in Bürs am 15. November. In Lustenau selbst folgt im Advent der Luschnouar Chrischtkendlimarkt am Kirchplatz.',
  whatToExpectList: [
    'Dornbirn: Martinimarkt am 6. November 2026',
    'Bürs: Martinimarkt am 15. November 2026',
    'Lustenau: Lange Nacht der Musik am 6. November 2026',
    'Lustenau: Luschnouar Chrischtkendlimarkt am Kirchplatz, 26. bis 29. November 2026',
    'Lustenau: Wochenmarkt jeden Donnerstag und Samstag von 8 bis 12 Uhr',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: 'ℹ️',
      label: 'Termine',
      text: 'Aktuelle Termine der Lustenauer Märkte veröffentlicht Lustenau Marketing auf marketing.lustenau.at. Die Märkte der anderen Gemeinden stehen im Märkteverzeichnis der Wirtschaftskammer Vorarlberg.',
    },
    {
      icon: '🦢',
      label: 'Martinigansl',
      text: 'Rund um den 11. November hat das Martinigansl in vielen Gasthäusern Saison. Reservierung im Voraus empfohlen.',
    },
    {
      icon: '🧣',
      label: 'Kleidung',
      text: 'November in Vorarlberg kann kalt und nass sein. Warme Kleidung und festes Schuhwerk für den Außenmarkt sind empfehlenswert.',
    },
  ],
  gallery: [],
  ctaText: 'Herbstevents in Vorarlberg entdecken',
  ctaLink: '/map?bundesland=Vorarlberg&category=Kultur',
  seoTitle: 'Martinimarkt Lustenau 2026? Termine & Alternativen',
  seoDescription:
    'Einen Lustenauer Martinimarkt gibt es 2026 nicht. Martinimärkte in Dornbirn (6.11.) und Bürs (15.11.), Chrischtkendlimarkt Lustenau vom 26. bis 29. November.',
  keywords: [
    'Lustenauer Martinimarkt 2026',
    'Martinimarkt Lustenau',
    'Martinimarkt Dornbirn',
    'Martinimarkt Vorarlberg',
    'Chrischtkendlimarkt Lustenau',
    'Martinitag Lustenau',
    'Lustenau November Events',
    'Markt Vorarlberg Herbst',
    'Lustenau Veranstaltungen',
  ],
};
