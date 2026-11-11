import type { FestivalPost } from '../types';

// Termin 2027, Dirigenten 2026/2027, Kartenverlosung, Preise, Reichweite, Geschichte,
// Programm, Blumenschmuck, Kapazität und Anreise geprüft am 2026-10-28 gegen
// wienerphilharmoniker.at/de/neujahrskonzert (Tugan Sokhiev 2027, Anmeldung 1. bis
// 28. Februar 2026, über 150 Länder, rund 50 Millionen), /de/neujahrskonzert/karteninformation
// (1.1.2027, 11:15 Uhr; 40 bis 1.320 Euro; nur Online-Verlosung), /de/neujahrskonzert/
// neujahrskonzert2026 (Nézet-Séguin, Stadtgärten seit 2015), /de/neujahrskonzert/
// tradition-und-geschichte (31.12.1939 Krauss, 1.1.1941, Krips, Boskovsky, Maazel, ab 1987
// Karajan), wien.orf.at/stories/3335832 (Weinlich, Price; ORF 2 ab 11:15),
// orf.at/stories/3415901 (Zugaben 2026), wiener-staatsoper.at/en/magazin/detail/
// new-years-concert-2026 (Ballett: Neumeier, MAK, Hofburg), musikverein.at/en/konzertbesuch
// (Anreise) und musikverein.at/wp-content/uploads/2025/10/MV_Raumvergleich_DE.pdf
// (1.744 Sitzplätze). Falsch waren: „Anmeldung bis Oktober beim Musikverein“ (Februar, bei
// den Philharmonikern), „über 90 Länder“ (aktuell über 150), „Donauwalzer nach der Pause“
// (Zugabe am Schluss), „ausschließlich Strauß-Familie und Wiener Komponisten“ (2026 auch
// Florence Price), Straßenbahn D zur Oper (fährt zum Schwarzenbergplatz), Leinwände am
// Rathausplatz, ZDF/arte, „Europakonzert“, Bundesländer-Blumenthemen und Dirigenten-
// Bekanntgabe „im Frühling“ (nicht belegt), jsonLd noch auf 2026.
export const post: FestivalPost = {
  slug: 'wiener-neujahrskonzert',
  title: 'Wiener Neujahrskonzert',
  subtitle: 'Die Wiener Philharmoniker live aus dem Goldenen Saal, übertragen in über 150 Länder',
  heroImage: '/images/blog/wiener-neujahrskonzert/hero.jpg',
  thumbnailImage: '/images/blog/wiener-neujahrskonzert/thumb.jpg',
  publishDate: '2026-03-31',
  updatedDate: '2026-10-28',
  factSources: {
    checkedAt: '2026-10-28',
    urls: [
      'https://www.wienerphilharmoniker.at/de/neujahrskonzert/karteninformation',
      'https://www.wienerphilharmoniker.at/de/neujahrskonzert',
      'https://musikverein.at/wp-content/uploads/2025/10/MV_Raumvergleich_DE.pdf',
      'https://www.wienerphilharmoniker.at/de/neujahrskonzert/tradition-und-geschichte',
      'https://wien.orf.at/stories/3335832/',
      'https://www.wiener-staatsoper.at/en/magazin/detail/new-years-concert-2026/',
      'https://musikverein.at/en/konzertbesuch/',
    ],
  },
  readingTime: 6,
  excerpt:
    'Am 1. Jänner 2027 um 11:15 Uhr dirigiert Tugan Sokhiev das Neujahrskonzert der Wiener Philharmoniker im Goldenen Saal des Musikvereins. Übertragen wird in über 150 Länder, Karten gibt es nur über die Online-Verlosung.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-amber-600 text-white',
  keyFacts: {
    dates: '1. Jänner 2027, 11:15 Uhr (Dirigent: Tugan Sokhiev)',
    location: 'Musikverein Wien, Großer Saal (Goldener Saal)',
    address: 'Musikvereinsplatz 1, 1010 Wien',
    genre: 'Klassik, Wiener Walzer, Polka, Marsch',
    price: 'nur per Online-Verlosung der Wiener Philharmoniker (Anmeldung für 2027 war vom 1. bis 28. Februar 2026), 40 bis 1.320 Euro',
    website: 'https://www.wienerphilharmoniker.at/de/neujahrskonzert',
    capacity: '1.744 Sitzplätze im Großen Saal',
    since: '1939',
  },
  lineup: [
    { name: 'Wiener Philharmoniker', role: 'headliner', stage: 'Goldener Saal' },
    { name: 'Tugan Sokhiev (Dirigent)', role: 'headliner', day: '1. Jänner 2027', stage: 'Goldener Saal' },
  ],
  lineupTitle: 'Programm-Highlights',
  intro:
    'Jedes Jahr am Neujahrstag um 11:15 Uhr spielen die Wiener Philharmoniker im Goldenen Saal des Musikvereins ihr Neujahrskonzert: Walzer, Polkas und Märsche der Strauß-Familie und ihrer Zeitgenossen. Laut Orchester verfolgen rund 50 Millionen Menschen in über 150 Ländern das Konzert per TV und Stream. Am 1. Jänner 2027 steht Tugan Sokhiev am Pult; 2026 dirigierte Yannick Nézet-Séguin das Konzert zum ersten Mal.',
  historyTitle: 'Über 85 Jahre: eine lebende Tradition',
  history:
    'Am 31. Dezember 1939 dirigierte Clemens Krauss ein außerordentliches Konzert mit Werken der Strauß-Dynastie, dessen Erlös dem nationalsozialistischen Kriegswinterhilfswerk zufloss. Am 1. Jänner 1941 folgte eine Philharmonische Akademie als „Johann Strauss-Konzert“. Krauss leitete die Konzerte bis 1954, nur 1946 und 1947 stand Josef Krips am Pult. Danach prägten Willi Boskovsky (1955 bis 1979) und Lorin Maazel (1980 bis 1986) das Konzert. Seit 1987 wechselt der Dirigent jedes Jahr; den Anfang machte Herbert von Karajan, später folgten unter anderen Claudio Abbado, Carlos Kleiber, Zubin Mehta und Mariss Jansons. Den Blumenschmuck im Goldenen Saal gestalten seit 2015 die Wiener Stadtgärten.',
  whatToExpectTitle: 'Was erwartet dich beim Neujahrskonzert?',
  whatToExpect:
    'Das Programm stellen Dirigent und Orchester jedes Jahr neu zusammen, im Mittelpunkt stehen Walzer, Polkas und Märsche der Strauß-Familie und ihrer Zeitgenossen. 2026 waren auch Werke von zwei Komponistinnen dabei: die Polka „Sirenen Lieder“ von Josephine Weinlich und der „Rainbow Waltz“ von Florence Price. Am Schluss stehen traditionell als Zugaben der Donauwalzer und der Radetzkymarsch, bei dem der Dirigent das Klatschen des Publikums leitet. Die TV-Übertragung zeigt dazu vorab gedrehte Balletteinlagen.',
  whatToExpectList: [
    'Walzer, Polkas und Märsche der Strauß-Familie und ihrer Zeitgenossen',
    'Traditionelle Zugaben: Donauwalzer und Radetzkymarsch',
    'Balletteinlagen in der Übertragung (2026 choreografiert von John Neumeier, gedreht im MAK und in der Hofburg)',
    'Blumenschmuck der Wiener Stadtgärten im Goldenen Saal',
    'Übertragung in über 150 Länder via TV und Stream',
    'Karten nur über die Online-Verlosung der Wiener Philharmoniker',
  ],
  practicalInfoTitle: 'Praktische Infos zum Neujahrskonzert',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets & Verlosung',
      text: 'Karten gibt es ausschließlich über die Online-Verlosung auf wienerphilharmoniker.at. Für 2027 lief die Anmeldung vom 1. bis 28. Februar 2026, verständigt wurde im März. Preise 40 bis 1.320 Euro, höchstens zwei Karten.',
    },
    {
      icon: '📺',
      label: 'Live im TV & Streaming',
      text: '2026 übertrug ORF 2 live ab 11:15 Uhr, dazu ORF ON und Ö1. Weltweit ist das Konzert in über 150 Ländern zu sehen.',
    },
    {
      icon: '🎻',
      label: 'Weitere Termine',
      text: 'Ebenfalls verlost werden die Voraufführung am 30. Dezember 2026 (11 Uhr, 25 bis 545 Euro) und das Silvesterkonzert am 31. Dezember 2026 (19:30 Uhr, 30 bis 980 Euro).',
    },
    {
      icon: '🚇',
      label: 'Anreise Musikverein',
      text: 'U1, U2 und U4 bis Karlsplatz (4 bis 7 Minuten zu Fuß), Straßenbahn 1, 2 und 62 bis Oper, Karlsplatz oder 71 und D bis Schwarzenbergplatz (je etwa 4 Minuten).',
    },
  ],
  gallery: [],
  ctaText: 'Klassik-Events in Wien entdecken',
  ctaLink: '/map?category=Kultur&region=Wien',
  seoTitle: 'Wiener Neujahrskonzert 2027: Tickets, Dirigent & Infos',
  seoDescription:
    'Neujahrskonzert der Wiener Philharmoniker am 1. Jänner 2027 um 11:15 Uhr mit Tugan Sokhiev: Kartenverlosung, Preise, TV-Übertragung und Geschichte.',
  keywords: [
    'Wiener Neujahrskonzert',
    'Neujahrskonzert Wien',
    'Wiener Philharmoniker Neujahr',
    'Neujahrskonzert 2027',
    'Tugan Sokhiev',
    'Musikverein Wien',
    'New Year Concert Vienna',
    'Neujahrskonzert Tickets',
    'Goldener Saal Wien',
    'Neujahrskonzert Übertragung',
  ],
  jsonLdEvent: {
    name: 'Wiener Neujahrskonzert 2027',
    startDate: '2027-01-01T11:15:00+01:00',
    endDate: '2027-01-01',
    location: 'Musikvereinsplatz 1, 1010 Wien, Austria',
    addressCountry: 'AT',
    url: 'https://www.wienerphilharmoniker.at/de/neujahrskonzert',
    description:
      'Das Neujahrskonzert der Wiener Philharmoniker im Goldenen Saal des Musikvereins, 2027 unter der Leitung von Tugan Sokhiev.',
    image:
      'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1600&q=85&auto=format&fit=crop',
  },
};
