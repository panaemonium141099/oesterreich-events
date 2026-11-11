import type { FestivalPost } from '../types';

// Termine, Geschichte, Programm und Anreise geprüft am 2026-10-27 gegen aufsteirern.at
// (/festival, /festival/geschichte, /festival/programm), ivents.at/aufsteirern/ (Termin
// 2026) und steiermark.com (Veranstaltungseintrag 2027, Ersatzbusse). Vorher falsch:
// Termin 18. bis 20. September 2026 (tatsächlich 19. und 20. September, zwei Tage),
// Gründung 1999 (Premiere 2002), "ca. 100.000 Besucher" (laut Veranstalter über 130.000
// im Jahr 2019), erfundene Programmpunkte und Bühnen (Stadtpark-Bühne, "Klingende
// Landschaft Steiermark", Trachtenmodenschau), "Tram 1 und 3 bis Hauptplatz" (am
// Festival fahren über Hauptplatz und Herrengasse Ersatzbusse). Ergänzt: 18. und 19.
// September 2027 (offiziell angekündigt); jsonLdEvent jetzt auf 2027.
export const post: FestivalPost = {
  slug: 'grazer-aufsteirern',
  title: 'Grazer Aufsteirern',
  subtitle: 'Steirische Volkskultur pur, mitten in der Grazer Innenstadt',
  heroImage: '/images/blog/grazer-aufsteirern/hero.jpg',
  thumbnailImage: '/images/blog/grazer-aufsteirern/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.aufsteirern.at/festival',
      'https://www.aufsteirern.at/festival/geschichte',
      'https://www.aufsteirern.at/festival/programm',
      'https://www.steiermark.com/de/Region-Graz/Urlaub-planen/Veranstaltungen/Aufsteirern-2026_ed_56351214',
    ],
  },
  readingTime: 6,
  excerpt:
    'Das Grazer Aufsteirern ist das herzlichste Volksfest der Steiermark. Im September strömen Tausende in Tracht in die Grazer Innenstadt, um gemeinsam zu musizieren, zu tanzen und steirische Gastfreundschaft zu erleben.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-green-700 text-white',
  keyFacts: {
    dates: '18. und 19. September 2027 (zuletzt 19. und 20. September 2026)',
    location: 'Grazer Innenstadt, auf mehreren Plätzen und in Innenhöfen',
    address: 'Innenstadt, 8010 Graz',
    genre: 'Volksmusik, Tracht, Brauchtum, Tanz',
    price: 'Eintritt frei',
    website: 'https://www.aufsteirern.at/festival',
    capacity: 'über 130.000 Besucherinnen und Besucher (2019)',
    since: '2002',
  },
  lineup: [
    { name: 'HBT-Musi', role: 'support' },
    { name: 'Brandhof Böhmische', role: 'support' },
    { name: 'Alphorngruppe Gaflenz', role: 'support' },
    { name: 'Volkstanzgruppe St. Martin im Sulmtal', role: 'support' },
    { name: 'Chor der Kärntner in Graz', role: 'support' },
    { name: 'Ziach&Zunder', role: 'support' },
    { name: 'Werkskapelle Pöls', role: 'support' },
    { name: 'Die Stattegger Dorfmusikanten', role: 'support' },
  ],
  lineupTitle: 'Programm-Highlights',
  lineupNote:
    'Auswahl aus über 50 Acts des Aufsteirern 2026 laut aufsteirern.at. Das Bühnenprogramm für 2027 erscheint laut Veranstalter rechtzeitig vor dem Festival.',
  intro:
    'Wenn im September die Steireranzüge und Dirndlkleider in Graz die Straßen bevölkern, ist Aufsteirern-Zeit. Das Grazer Aufsteirern zählt zu den größten Volkskulturveranstaltungen Österreichs und feiert die lebendige steirische Volkskultur mit echter Herzlichkeit. Auf Plätzen und in Innenhöfen der Grazer Innenstadt spielen Musikgruppen, tanzen Volkstanzgruppen und singen Chöre, ein klingendes Fest, das zeigt, wie jung und lebendig alte Traditionen sein können.',
  historyTitle: 'Von der Idee zum Großereignis',
  history:
    'Die Idee zum Aufsteirern entstand 2001 mit dem Ziel, die steirische Volkskultur in ihrer ganzen Vielfalt sichtbar zu machen. 2002 feierte das Fest in Graz Premiere, beteiligt waren alle steirischen volkskulturellen Verbände. 2019 kamen laut Veranstalter über 130.000 Besucherinnen und Besucher. Während der Corona-Pandemie entstand ab 2020 zusätzlich ein eigenes TV-Format mit ORF 2. Veranstalter ist die Grazer ivents Kulturagentur, die Zusammenarbeit mit den volkskulturellen Verbänden ist bis heute die zentrale Säule des Festivals.',
  whatToExpectTitle: 'Was das Grazer Aufsteirern bietet',
  whatToExpect:
    'Das zweitägige Fest füllt die Grazer Innenstadt mit Volksmusik, Tanz und Kulinarik. Laut Veranstalter treten Volkstanzgruppen auf Bühnen auf, Blasmusikkapellen spielen, Chöre singen und Handwerkerinnen und Handwerker zeigen traditionelles Handwerk. 2026 standen über 50 Acts auf dem Programm, dazu ein Kinderprogramm. Das Fest findet bei jedem Wetter statt.',
  whatToExpectList: [
    'Volksmusik und Blasmusik auf mehreren Bühnen in der Innenstadt',
    'Volkstanzgruppen und Chöre',
    'Vorführungen traditioneller Handwerkskunst',
    'Regionale Kulinarik mit steirischen Spezialitäten',
    'Kinderprogramm',
    'Eintritt an beiden Tagen frei, bei jedem Wetter',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎉',
      label: 'Eintritt',
      text: 'Das Aufsteirern ist an beiden Tagen kostenlos zugänglich.',
    },
    {
      icon: '🚌',
      label: 'Anreise',
      text: 'Öffentlicher Verkehr empfohlen. Während des Festivals fahren keine Straßenbahnen über Hauptplatz und Herrengasse, stattdessen sind Ersatzbusse unterwegs.',
    },
    {
      icon: '👗',
      label: 'Dresscode',
      text: 'Tracht ist erwünscht, aber kein Muss. Wer ohne Tracht kommt, ist trotzdem herzlich willkommen und mittendrin.',
    },
    {
      icon: '🍺',
      label: 'Gastronomie',
      text: 'An den Ständen wird meist bar bezahlt, Bankomaten gibt es in der Innenstadt. Angeboten werden regionale steirische Spezialitäten.',
    },
  ],
  gallery: [],
  ctaText: 'Kultur-Events in Graz entdecken',
  ctaLink: '/map?bundesland=Steiermark&category=Kultur',
  seoTitle: 'Grazer Aufsteirern 2027: Termin, Programm und Tipps',
  seoDescription:
    'Grazer Aufsteirern 2027 (18. und 19. September): eines der größten Volkskulturfeste Österreichs in der Grazer Innenstadt. Eintritt frei, alle Infos hier.',
  keywords: [
    'Grazer Aufsteirern 2027',
    'Aufsteirern Graz',
    'Trachtenfest Graz',
    'Volkskultur Steiermark',
    'Steirische Volksmusik',
    'Volksfest Graz September',
    'Tracht Graz',
    'Aufsteirern Termin',
    'Graz Volksfest',
    'Steirisches Brauchtum',
  ],
  jsonLdEvent: {
    name: 'Grazer Aufsteirern 2027',
    startDate: '2027-09-18',
    endDate: '2027-09-19',
    location: 'Innenstadt, 8010 Graz, Austria',
    addressCountry: 'AT',
    url: 'https://www.aufsteirern.at/festival',
    description:
      'Das Grazer Aufsteirern ist eines der größten Volkskulturfeste Österreichs mit Volksmusik, Volkstanz, Chören und Handwerk in der Grazer Innenstadt, Eintritt frei.',
    image:
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1600&q=85&auto=format&fit=crop',
  },
};
