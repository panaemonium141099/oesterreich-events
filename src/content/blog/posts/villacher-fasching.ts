import type { FestivalPost } from '../types';

// Termine 2026/27, Spielort, Umzug und Geschichte geprüft am 2026-10-27 gegen
// villacher-fasching.at (/veranstaltungen/, /faschingssamstag/),
// visitvillach.at/en/villach-carnival.html (Faschingssamstag 14.02.2026),
// villach.at/ccv (Adresse) und de.wikipedia.org/wiki/Villacher_Fasching (1955, Gilde 1964,
// Congress Center seit 1972, ORF seit 1963). Vorher falsch: Website villacherfasching.at
// (existiert nicht, richtig villacher-fasching.at), Beginn 6. Jänner, Umzug am
// Faschingssonntag (richtig Faschingssamstag), Bälle im Kongresshaus (es sind
// Faschingssitzungen im Congress Center), Gilde „1970er Jahre“ (1964), 50.000 Narren und
// Ballpreise ab 15 € ohne Beleg.
export const post: FestivalPost = {
  slug: 'villacher-fasching',
  title: 'Villacher Fasching',
  subtitle: 'Österreichs bekanntester Fasching: bunte Narren, Gaudi und kärntnerischer Humor',
  heroImage: '/images/blog/villacher-fasching/hero.jpg',
  thumbnailImage: '/images/blog/villacher-fasching/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  readingTime: 6,
  excerpt:
    'Der Villacher Fasching ist Österreichs bekanntestes Faschingsevent und eines der größten Karnevalspektakel im deutschsprachigen Raum. Wochenlang regieren Narren, Kostüme und überschäumende Gaudi die Stadt an der Drau.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-orange-600 text-white',
  keyFacts: {
    dates: 'Saison 2026/27: Faschingssitzungen 8. bis 30. Jänner 2027, Umzug am Faschingssamstag, 6. Februar 2027',
    location: 'Congress Center Villach und Innenstadt',
    address: 'Congress Center Villach, Europaplatz 1, 9500 Villach',
    genre: 'Fasching, Faschingssitzung, Umzug',
    price: 'Kartenkauf für die Sitzungen über villacher-fasching.at',
    website: 'https://villacher-fasching.at',
    since: '1955',
  },
  lineup: [
    { name: 'Prinzenpaarvorstellung', role: 'special', day: '14. November 2026' },
    { name: 'Faschingssitzungen der Villacher Faschingsgilde (Premiere)', role: 'headliner', day: '8. Jänner 2027, 19.55 Uhr', stage: 'Congress Center Villach' },
    { name: 'Faschingssitzungen mit ORF-Aufzeichnung', role: 'headliner', day: '28. bis 30. Jänner 2027, 19.55 Uhr', stage: 'Congress Center Villach' },
    { name: 'Kindersitzungen', role: 'support', day: '16. und 17. Jänner 2027, 14 Uhr' },
    { name: 'Großer Faschingsumzug', role: 'headliner', day: 'Faschingssamstag, 6. Februar 2027, 14 Uhr', stage: 'ab Hans-Gasser-Platz' },
  ],
  lineupTitle: 'Termine 2026/27',
  lineupNote:
    'Weitere Sitzungen am 9., 15., 16., 22. und 23. Jänner 2027, jeweils 19.55 Uhr. Alle Termine laut villacher-fasching.at/veranstaltungen.',
  intro:
    'Villach im Fasching ist wie kein anderer Ort in Österreich: Ab dem 11. November haben die Villacher Narren das Sagen, und im Jänner verwandeln die Faschingssitzungen im Congress Center die Stadt an der Drau in ein Tollhaus aus Kostümen, Musik, Tanz und kärntnerischem Humor. Der Villacher Fasching hat Tradition und auch internationale Bekanntheit. Fernsehübertragungen, prominente Gäste und ein Faschingsumzug, der ganz Villach auf die Beine bringt, machen ihn zum einzigartigen Erlebnis, das man einmal im Leben erlebt haben sollte.',
  historyTitle: 'Villach, die Narrenhauptstadt Österreichs',
  history:
    'Der moderne Villacher Fasching entstand 1955 aus dem Bauernball der Villacher Bauerngman, einer karitativen Vereinigung, die seit 1910 jährlich einen Ball zugunsten Bedürftiger veranstaltet. Die Idee stammte von Rudolf Horn, im selben Jahr wurde das erste Prinzenpaar gewählt. 1964 ging aus der Bauerngman die Villacher Faschingsgilde hervor, seit 1972 finden die Sitzungen im Congress Center Villach statt. Der ORF überträgt die Höhepunkte seit 1963 jedes Jahr am Faschingsdienstag, was die Stadt zum Inbegriff österreichischer Narrenkultur gemacht hat. 2025 fielen Sitzungen, ORF-Aufzeichnung und Umzug nach dem Anschlag in Villach aus; 2026 zog der Umzug am 14. Februar wieder durch die Stadt.',
  whatToExpectTitle: 'Narrenzeit in Villach: Was euch erwartet',
  whatToExpect:
    'Die Saison beginnt mit der Vorstellung des Prinzenpaars im November. Im Jänner folgen die Faschingssitzungen der Gilde im Congress Center Villach, 2027 neun Abende vom 8. bis 30. Jänner, die letzten drei mit ORF-Aufzeichnung, dazu zwei Kindersitzungen. Höhepunkt ist der große Umzug am Faschingssamstag: 2027 am 6. Februar ab 14 Uhr vom Hans-Gasser-Platz über Hauptplatz, Draubrücke und Bahnhofstraße bis zum Bahnhofsplatz. Das Publikum auf den Straßen ist Teil des Spektakels.',
  whatToExpectList: [
    'Prinzenpaarvorstellung am 14. November 2026',
    'Neun Faschingssitzungen im Congress Center Villach, 8. bis 30. Jänner 2027',
    'Kindersitzungen am 16. und 17. Jänner 2027',
    'Großer Faschingsumzug am Faschingssamstag, 6. Februar 2027, durch die Innenstadt',
    'TV-Highlights: ORF-Übertragung am Faschingsdienstag',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎭',
      label: 'Kostüm',
      text: 'Kostüm ist erwünscht und fast Pflicht! Wer verkleidet kommt, ist sofort mittendrin.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Villach Hauptbahnhof hat direkte Verbindungen aus Klagenfurt, Graz und Wien. Der Umzug endet am Bahnhofsplatz.',
    },
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Karten für die Faschingssitzungen über villacher-fasching.at. Gruppen, die beim Umzug mitgehen wollen, melden sich dort ebenfalls an.',
    },
    {
      icon: '🌡️',
      label: 'Klima',
      text: 'Jänner und Februar in Villach sind kalt. Warme Kostüme für den Umzug im Freien empfohlen.',
    },
  ],
  gallery: [],
  ctaText: 'Fasching-Events in Kärnten entdecken',
  ctaLink: '/map?bundesland=Kärnten&category=Kultur',
  seoTitle: 'Villacher Fasching 2027: Sitzungen, Umzug und Termine',
  seoDescription:
    'Villacher Fasching 2027: Faschingssitzungen im Congress Center vom 8. bis 30. Jänner, großer Umzug am Faschingssamstag, 6. Februar 2027. Alle Termine.',
  keywords: [
    'Villacher Fasching 2027',
    'Fasching Villach',
    'Karneval Villach',
    'Faschingsumzug Villach',
    'Villacher Faschingsgilde',
    'Fasching Kärnten',
    'Villach Karneval Programm',
    'Fasching Österreich',
    'Villach Fasching Tickets',
    'Narrenzeit Villach',
  ],
  jsonLdEvent: {
    name: 'Villacher Fasching 2027',
    startDate: '2027-01-08',
    endDate: '2027-02-06',
    location: 'Congress Center Villach, Europaplatz 1, 9500 Villach, Austria',
    addressCountry: 'AT',
    url: 'https://villacher-fasching.at',
    description:
      'Der Villacher Fasching ist Österreichs bekanntestes Faschingsevent mit Faschingssitzungen im Congress Center und dem großen Umzug am Faschingssamstag in Villach, Kärnten.',
    image:
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=85&auto=format&fit=crop',
  },
};
