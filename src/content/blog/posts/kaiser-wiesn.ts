import type { FestivalPost } from '../types';

// Termine 2026/2027, Ort/Adresse, Zelte und Almen samt Plätzen, Bands 2027, Musikzeiten,
// Gründung und Website geprüft am 2026-10-28 gegen kaiserwiesn.at (Startseite: 2027 von
// 23. September bis 10. Oktober, fünfte Ausgabe 2026 mit Besucherrekord; /wissen/: 2026 von
// 24. September bis 11. Oktober; /hausordnung/: Kaiserwiese im Prater, Oswald-Thomas-Platz 1,
// 1020 Wien, Geländeschluss 24 Uhr, Almen bis 1 Uhr; /zelte-almen/ und /dein-fest/: Gösser
// Zelt 3.136, Wiesbauer Zelt 1.384, Nordic Spirit Kaiser Zelt 1.144 Plätze, fünf Almen;
// /bands/: Musik täglich 12.15 bis 23.30 Uhr; /tickets/: Vorverkauf 2027 über wien-ticket),
// vienna.at/vienna-kaiser-wiesn-2026-breaks-all-visitor-records/10537274 (18 Tage, rund 150
// Konzerte, Bezahlkonzerte in den Festzelten, Wiesndorf frei),
// vienna.at/startschuss-fuer-die-kaiser-wiesn-2022-im-wiener-prater/7649761 (erste Kaiser
// Wiesn 2022) und vienna.at/aus-fuer-wiener-wiesn-streit-um-herbstevents-in-wien-entbrannt/
// 7384306 (Wiener Wiesn-Fest ist ein anderes Fest, 2022 ohne Platz). Der Post vermischte
// die Kaiser Wiesn mit dem früheren „Wiener Wiesn-Fest“: Website wienerwiesn.at zeigt nur
// eine Server-Platzhalterseite, Gründung „2009“, „11 Tage“, „60.000 Besucher täglich“,
// Maß „ab € 14“, Öffnungszeiten, „Kaiserzelt mit Kaffeehausflair“ und das Programm
// („Wiener Philharmoniker der Volksmusik“, „Trachten-Gala“) waren nicht belegt oder falsch.
export const post: FestivalPost = {
  slug: 'kaiser-wiesn',
  title: 'Wiener Kaiser Wiesn',
  subtitle: 'Das Oktoberfest auf der Kaiserwiese im Prater: Festzelte, Almen, Blasmusik und Schlager',
  heroImage: '/images/blog/kaiser-wiesn/hero.jpg',
  thumbnailImage: '/images/blog/kaiser-wiesn/thumb.jpg',
  publishDate: '2026-03-31',
  updatedDate: '2026-10-28',
  factSources: {
    checkedAt: '2026-10-28',
    urls: [
      'https://www.vienna.at/aus-fuer-wiener-wiesn-streit-um-herbstevents-in-wien-entbrannt/7384306',
      'https://kaiserwiesn.at/',
      'https://kaiserwiesn.at/wissen/',
      'https://kaiserwiesn.at/tickets/',
      'https://kaiserwiesn.at/hausordnung/',
      'https://www.vienna.at/startschuss-fuer-die-kaiser-wiesn-2022-im-wiener-prater/7649761',
      'https://kaiserwiesn.at/dein-fest/',
      'https://www.vienna.at/vienna-kaiser-wiesn-2026-breaks-all-visitor-records/10537274',
      'https://kaiserwiesn.at/bands/',
      'https://kaiserwiesn.at/zelte-almen/',
    ],
  },
  readingTime: 5,
  excerpt:
    'Die Wiener Kaiser Wiesn verwandelt die Kaiserwiese beim Riesenrad jeden Herbst in ein Oktoberfest. 2027 dauert sie 18 Tage, vom 23. September bis 10. Oktober, mit Festzelten, fünf Almen und Livemusik von Volksmusik bis Schlager.',
  category: 'Musik & Festival',
  categoryColor: 'bg-amber-500 text-white',
  keyFacts: {
    dates: '2027: 23. September bis 10. Oktober (2026: 24. September bis 11. Oktober)',
    location: 'Kaiserwiese im Wiener Prater, beim Riesenrad',
    address: 'Oswald-Thomas-Platz 1, 1020 Wien',
    genre: 'Oktoberfest, Volksmusik, Schlager, Blasmusik, Brauchtum',
    price: 'Konzertabende in den Festzelten mit Ticket (Vorverkauf über kaiserwiesn.at)',
    website: 'https://kaiserwiesn.at',
    capacity: 'Festzelte mit 3.136, 1.384 und 1.144 Plätzen, dazu fünf Almen',
    since: '2022',
  },
  lineup: [
    { name: 'Die Lauser', role: 'headliner', day: '23. bis 25. September 2027', stage: 'Gösser Zelt' },
    { name: 'Die Dirndl Rocker', role: 'headliner', day: '23. und 25. September 2027', stage: 'Wiesbauer Zelt' },
    { name: 'Die Draufgänger', role: 'headliner', day: '23. September 2027', stage: 'Nordic Spirit Kaiser Zelt' },
    { name: 'BEngelS Reloaded', role: 'support', day: '24. und 25. September 2027', stage: 'Nordic Spirit Kaiser Zelt' },
    { name: 'KulturErben', role: 'support', day: '24. September 2027', stage: 'Wiesbauer Zelt' },
  ],
  lineupTitle: 'Bands 2027 (Auswahl)',
  lineupNote:
    'Weitere angekündigte Bands 2027: Die Südsteirer, Die Thierseer, Die Fetzentaler, Achtung, Zwirn, Wiener Wahnsinn, BÄÄM&Brass und DJ Stevie. Das vollständige Programm steht auf kaiserwiesn.at.',
  intro:
    'Wenn auf der Kaiserwiese neben dem Riesenrad die Festzelte stehen, ist in Wien Wiesnzeit. Die Wiener Kaiser Wiesn bezeichnet sich selbst als größtes Brauchtumsfest und Oktoberfest Österreichs: drei große Festzelte, fünf Almen, Blasmusik, Volksmusik und Schlager, Dirndl und Lederhosen. 2026 lief die fünfte Ausgabe 18 Tage lang mit rund 150 Konzerten und endete laut Veranstalter mit einem Besucherrekord. 2027 geht es von 23. September bis 10. Oktober weiter.',
  historyTitle: 'Seit 2022 im Prater',
  history:
    'Die erste Wiener Kaiser Wiesn eröffnete Bürgermeister Michael Ludwig am 22. September 2022 mit dem Bieranstich, das Fest lief damals bis 9. Oktober. Sie ist nicht dasselbe wie das frühere Fest „Wiener Wiesn“: Dessen Veranstalter bekam 2022 die Kaiserwiese nicht mehr, die Kaiser Wiesn eines neuen Veranstalters übernahm den Platz. Seither findet sie jedes Jahr im Herbst statt, 2026 zum fünften Mal.',
  whatToExpectTitle: 'Was erwartet dich auf der Kaiser Wiesn?',
  whatToExpect:
    'Das Gelände besteht aus drei großen Festzelten und fünf Almhütten. Das Gösser Zelt ist mit 3.136 Plätzen das größte, dazu kommen das Wiesbauer Zelt und das Nordic Spirit Kaiser Zelt. Die Almen (Almdudler Alm, Kaktus Alm, Gasteiner Alm, Underberg Alm und die Schladming-Dachstein Hohenhaus Tenne) setzen eher auf DJs und Partystimmung. Bands und Blaskapellen spielen täglich von 12.15 bis 23.30 Uhr.',
  whatToExpectList: [
    'Drei Festzelte: Gösser Zelt, Wiesbauer Zelt und Nordic Spirit Kaiser Zelt',
    'Fünf Almen mit DJs, Livebands und Partyprogramm',
    'Livemusik täglich von 12.15 bis 23.30 Uhr, abends Konzerte mit Ticket',
    'Themen- und Sondertage, 2026 etwa Studiwiesn, Seniorentag und Nordic Walking Day',
    'Kaiser Loge, Balkone und ganze Zelte für Firmen- und Gruppenfeiern',
    'Lage direkt beim Riesenrad im Wiener Prater',
  ],
  practicalInfoTitle: 'Praktische Infos für die Kaiser Wiesn',
  practicalInfo: [
    {
      icon: '🚇',
      label: 'Anreise',
      text: 'U1 oder U2 bis Praterstern, von dort zu Fuß Richtung Riesenrad. Die Kaiserwiese liegt gleich daneben.',
    },
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Für die Konzertabende in den Festzelten gibt es Tickets im Vorverkauf über kaiserwiesn.at. Gruppen fragen Plätze, Almen oder Balkone direkt beim Veranstalter an.',
    },
    {
      icon: '🎪',
      label: 'Zeiten',
      text: 'Musikprogramm täglich von 12.15 bis 23.30 Uhr. Laut Hausordnung muss das Gelände bis 24 Uhr verlassen werden, in den Almen darf man bis 1 Uhr bleiben.',
    },
    {
      icon: '👘',
      label: 'Kleidung',
      text: 'Dirndl und Lederhose sind typisch und gern gesehen, aber keine Pflicht.',
    },
  ],
  gallery: [],
  ctaText: 'Volksfeste in Wien entdecken',
  ctaLink: '/map?category=Musik&region=Wien',
  seoTitle: 'Wiener Kaiser Wiesn 2027: Termin, Zelte und Bands im Prater',
  seoDescription:
    'Wiener Kaiser Wiesn 2027 von 23. September bis 10. Oktober auf der Kaiserwiese im Prater: Festzelte, Almen, Bands, Tickets und Anreise zum Wiener Oktoberfest.',
  keywords: [
    'Kaiser Wiesn Wien',
    'Wiener Kaiser Wiesn 2027',
    'Oktoberfest Wien',
    'Volksfest Wien Prater',
    'Wiesn Wien 2027',
    'Kaiserwiese Wien',
    'Bierzelt Wien',
    'Kaiser Wiesn Tickets',
    'Kaiser Wiesn Programm',
    'Gösser Zelt Wien',
  ],
  jsonLdEvent: {
    name: 'Wiener Kaiser Wiesn 2027',
    startDate: '2027-09-23',
    endDate: '2027-10-10',
    location: 'Kaiserwiese im Prater, Oswald-Thomas-Platz 1, 1020 Wien, Austria',
    addressCountry: 'AT',
    url: 'https://kaiserwiesn.at',
    description:
      'Die Wiener Kaiser Wiesn auf der Kaiserwiese im Prater ist ein Oktoberfest mit drei Festzelten, fünf Almen und täglicher Livemusik.',
    image:
      'https://images.unsplash.com/photo-1566842600175-97dca489844f?w=1600&q=85&auto=format&fit=crop',
  },
};
