import type { FestivalPost } from '../types';

// Termine 2026, Programm, Geschichte und Website geprüft am 2026-10-27 gegen
// brucknerhaus.at/das-haus/klangwolken/ (klangwolke.at leitet dorthin weiter), Nachberichte
// tt.com/artikel/30942153 (APA, rund 90.000 Besucher laut Veranstalter) und
// tips.at/nachrichten/linz/kultur/722415 (Mitwirkende). Vorher falsch: Termin 13.9.2026
// (richtig 12.9.), Website brucknerhaus.at/klangwolke (404), Klangwolke als Open-Air-Konzert
// des Bruckner Orchesters mit Chor des Landestheaters, "Solistin des Jahres" und
// Pyrotechnik-Ensemble, erste Klangwolke "anlässlich des Brucknerfestes" (richtig:
// Eröffnung der Ars Electronica), "Hunderttausende", Einlass-/Rahmenprogrammzeiten,
// Straßenbahnlinien, Extrazüge und ORF-Liveübertragung ohne Beleg.
export const post: FestivalPost = {
  slug: 'linzer-klangwolke',
  title: 'Linzer Klangwolke',
  subtitle: 'Spektakuläres Open-Air-Klangerlebnis im Donaupark: kostenlos für alle',
  heroImage: '/images/blog/linzer-klangwolke/hero.jpg',
  thumbnailImage: '/images/blog/linzer-klangwolke/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.brucknerhaus.at/das-haus/klangwolken/',
      'https://www.tips.at/nachrichten/linz/kultur/722415-attheendlinz-linzer-klangwolke-2026-erzaehlt-von-untergang-und-neubeginn',
      'https://www.tt.com/artikel/30942153/visualisierte-klangwolke-brachte-linz-den-weltuntergang',
    ],
  },
  readingTime: 6,
  excerpt:
    'Jedes Jahr im September verwandelt die Linzer Klangwolke den Donaupark in einen riesigen Klangraum aus Musik, Licht und Bildern. Die Klangwolke gibt es seit 1979, und der Eintritt ist frei.',
  category: 'Musik',
  categoryColor: 'bg-sky-700 text-white',
  keyFacts: {
    dates: '12. September 2026 (Termin 2027 noch nicht veröffentlicht)',
    location: 'Donaupark Linz (Donaulände)',
    address: 'Donaulände, 4010 Linz',
    genre: 'Klassik, Open-Air-Konzert, Multimedia',
    price: 'Eintritt frei',
    website: 'https://www.brucknerhaus.at/das-haus/klangwolken/',
    capacity: 'rund 90.000 Besucher (2026, laut Veranstalter)',
    since: '1979',
  },
  lineup: [
    { name: 'Bruckner Orchester Linz unter Markus Poschner', role: 'headliner', stage: 'Bühnenschiff auf der Donau', day: '12. September 2026' },
    { name: 'St. Florianer Sängerknaben', role: 'special', stage: 'Dach des Brucknerhauses', day: '12. September 2026' },
    { name: 'Rafael Fingerlos (Bariton)', role: 'special', stage: 'Dach des Brucknerhauses', day: '12. September 2026' },
    { name: 'Filarmonica della Scala unter Riccardo Chailly (Klassische Klangwolke)', role: 'special', stage: 'Brucknerhaus, Großer Saal', day: '4. September 2026' },
    { name: 'Kinderklangwolke', role: 'support', stage: 'Donaupark', day: '6. September 2026' },
  ],
  lineupTitle: 'Mitwirkende 2026',
  lineupNote:
    'Die visualisierte Klangwolke 2026 hieß "ATTheENDLinz" (Regie Felix Breisach, Musik Flora Marlene Geißelbrecht, Texte Natascha Gangl). Der Termin 2027 ist noch nicht veröffentlicht.',
  intro:
    'Ein Septemberabend, die Donau im letzten Licht, und Zehntausende Menschen auf den Wiesen des Donauparks: Dann beginnt die Linzer Klangwolke. Sie ist kein gewöhnliches Konzert, sondern ein Gesamtkunstwerk aus Musik, Licht und Bildern auf und an der Donau. Die Klangwolke gibt es seit 1979, der Eintritt ist frei. Laut Brucknerhaus hat sie bisher mehr als vier Millionen Menschen erreicht.',
  historyTitle: 'Seit 1979: Ein Konzert, das eine Stadt verbindet',
  history:
    'Die erste Linzer Klangwolke 1979 war die spektakuläre Eröffnung des Ars Electronica Festivals. Initiator Hannes Leopoldseder entwickelte sie gemeinsam mit Walter Haupt: Im Donaupark erklang Bruckners 8. Symphonie vom Band, in einer Aufnahme des Concertgebouw-Orchesters unter Bernard Haitink. Ein Jahr später spielte das Bruckner Orchester Linz Bruckners 4. Symphonie live. Seit 1985 gibt es zusätzlich die Klassische Klangwolke im Rahmen des Brucknerfests, bei der ein Konzert aus dem Großen Saal des Brucknerhauses in den Donaupark übertragen wird. Die Kinderklangwolke gestaltet seit 1998 das Kinderkulturzentrum KuddelMuddel. Veranstalter ist das Brucknerhaus Linz (LIVA).',
  whatToExpectTitle: 'Was die Klangwolke 2026 bot',
  whatToExpect:
    'Die visualisierte Klangwolke 2026 trug den Titel "ATTheENDLinz". Regisseur Felix Breisach erzählte vom fiktiven Untergang der Stadt Linz und ihrem Neubeginn, mit Bildern auf einer großen LED-Wand am Fluss. Das Bruckner Orchester Linz unter Markus Poschner spielte auf einem Bühnenschiff, die St. Florianer Sängerknaben und Bariton Rafael Fingerlos traten auf dem Dach des Brucknerhauses auf. Das Programm reichte von Anton Bruckner über die Beatles bis zu eigens komponierten Werken. Laut Veranstalter kamen rund 90.000 Menschen.',
  whatToExpectList: [
    'Visualisierte Klangwolke: Musik, Licht und Bilder im Donaupark (2026 am 12. September)',
    'Klassische Klangwolke: Konzert im Großen Saal des Brucknerhauses (2026 am 4. September)',
    'Kinderklangwolke im Donaupark (2026 am 6. September)',
    'Klangwolkenwoche: 2026 erstmals eine Woche mit meist kostenlosen Veranstaltungen in Linz',
    'Kostenloser Eintritt im Donaupark',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Eintritt',
      text: 'Die Klangwolke im Donaupark ist kostenlos zugänglich. Kein Ticket erforderlich. Früh kommen sichert einen guten Platz, 2026 begann die Klangwolke um 20:30 Uhr.',
    },
    {
      icon: '🚊',
      label: 'Anreise',
      text: 'Der Donaupark liegt an der Donaulände direkt beim Brucknerhaus, in Gehweite des Linzer Hauptplatzes.',
    },
    {
      icon: '🧺',
      label: 'Ausrüstung',
      text: 'Decke oder Campingstuhl mitbringen. Im September kann es kühl werden, eine Jacke ist empfehlenswert. Getränke und Snacks sind vor Ort erhältlich.',
    },
    {
      icon: '🎶',
      label: 'Klangwolkenwoche',
      text: 'Vom 7. bis 11. September 2026 gab es erstmals eine Klangwolkenwoche mit meist kostenlosen Veranstaltungen in Linz, darunter eine Ausstellung, Filmvorführungen und der SoundPark.',
    },
  ],
  gallery: [],
  ctaText: 'Musikevents in Oberösterreich entdecken',
  ctaLink: '/map?bundesland=Oberoesterreich&category=Musik',
  seoTitle: 'Linzer Klangwolke 2026: Termin, Programm & Tipps',
  seoDescription:
    'Linzer Klangwolke am 12. September 2026: "ATTheENDLinz" im Donaupark, mit Bruckner Orchester auf der Donau, Licht und Bildern. Eintritt frei.',
  keywords: [
    'Linzer Klangwolke 2026',
    'Klangwolke Linz Programm',
    'Open-Air Klassik Linz',
    'Bruckner Orchester Linz',
    'Klangwolke September',
    'Donaupark Linz Konzert',
    'Gratis Konzert Linz',
    'Oberösterreich Musikfestival',
    'Klangwolke kostenlos',
    'Linz Klassik Open Air',
  ],
  jsonLdEvent: {
    name: 'Linzer Klangwolke 2026',
    startDate: '2026-09-12',
    endDate: '2026-09-12',
    location: 'Donaupark Linz, Donaulände, 4010 Linz, Austria',
    addressCountry: 'AT',
    url: 'https://www.brucknerhaus.at/das-haus/klangwolken/',
    description:
      'Die Linzer Klangwolke ist ein kostenloses Open-Air-Gesamtkunstwerk aus Musik, Licht und Bildern im Donaupark Linz, 2026 unter dem Titel ATTheENDLinz.',
    image:
      'https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?w=1600&q=85&auto=format&fit=crop',
  },
};
