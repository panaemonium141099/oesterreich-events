import type { FestivalPost } from '../types';

export const post: FestivalPost = {
  slug: 'villacher-fasching',
  title: 'Villacher Fasching',
  subtitle: 'Österreichs bekanntester Fasching – bunte Narren, Gaudi und kärntnerischer Humor',
  heroImage:
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=85&auto=format&fit=crop',
  thumbnailImage:
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&auto=format&fit=crop',
  publishDate: '2026-04-01',
  updatedDate: '2026-04-01',
  readingTime: 6,
  excerpt:
    'Der Villacher Fasching ist Österreichs bekanntestes Faschingsevent und eines der größten Karnevalspektakel im deutschsprachigen Raum. Wochenlang regieren Narren, Kostüme und überschäumende Gaudi die Stadt an der Drau.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-orange-600 text-white',
  keyFacts: {
    dates: '6. Jänner – 17. Februar 2026 (Faschingsdienstag)',
    location: 'Kongresshaus Villach & gesamte Innenstadt',
    address: 'Europaplatz 1, 9500 Villach',
    genre: 'Fasching, Karneval, Kostümball, Umzug',
    price: 'ab 15 € (Ballveranstaltungen); Umzug kostenlos',
    website: 'https://www.villacherfasching.at',
    capacity: 'ca. 50.000 Narrinnnen und Narren insgesamt',
    since: '1970er-Jahre',
  },
  lineup: [
    { name: 'Villacher Faschingsgilde', role: 'headliner', stage: 'Kongresshaus Villach' },
    { name: 'Großer Villacher Faschingsumzug', role: 'headliner', day: 'Faschingssonntag', stage: 'Villacher Innenstadt' },
    { name: 'Faschingsbälle im Kongresshaus', role: 'support', stage: 'Kongresshaus Ballsaal' },
    { name: 'Kinderfasching', role: 'special', stage: 'Congress Center' },
  ],
  lineupNote:
    'Das vollständige Ball- und Veranstaltungsprogramm für den Faschingsseason 2026/27 wird ab Oktober 2026 veröffentlicht.',
  intro:
    'Villach im Fasching ist wie kein anderer Ort in Österreich: Die Stadt an der Drau verwandelt sich ab dem Dreikönigstag in ein Tollhaus aus Kostümen, Musik, Tanz und kärntnerischem Humor. Der Villacher Fasching hat Tradition – und auch internationale Bekanntheit. Fernsehübertragungen, prominente Gäste und ein Faschingsumzug, der ganz Villach auf die Beine bringt, machen ihn zum einzigartigen Erlebnis, das man einmal im Leben erlebt haben sollte.',
  historyTitle: 'Villach, die Narrenhauptstadt Österreichs',
  history:
    'Die Villacher Faschingstradition reicht bis ins Mittelalter zurück, doch der moderne, überregional bekannte Villacher Fasching entwickelte sich vor allem in der zweiten Hälfte des 20. Jahrhunderts. Die Faschingsgilde, gegründet in den 1970er Jahren, professionalisierte das Event und machte es durch Fernsehauftritte österreichweit bekannt. Der ORF überträgt regelmäßig Teile des Villacher Faschings, was die Stadt zum Inbegriff österreichischer Narrenkultur gemacht hat.',
  whatToExpectTitle: 'Narrenzeit in Villach – was erwartet euch',
  whatToExpect:
    'Über mehrere Wochen bietet Villach ein abwechslungsreiches Faschingsprogramm: Kostümbälle im Kongresshaus, Kinderveranstaltungen, Straßenpartys und als Höhepunkt der große Faschingsumzug am Faschingssonntag, bei dem Tausende verkleidete Teilnehmerinnen und Teilnehmer durch die Innenstadt ziehen. Das Publikum auf den Straßen ist Teil des Spektakels.',
  whatToExpectList: [
    'Wochenlange Faschingsbälle im Kongresshaus Villach',
    'Großer Faschingsumzug am Faschingssonntag durch die Innenstadt',
    'Kinderfasching mit Verkleidungswettbewerb und Programm',
    'Faschingskonzerte und Open-Air-Events',
    'Gastronomische Specials mit kärntnerischen Narrentiraden',
    'TV-Highlights: ORF-Übertragungen aus dem Faschingsgeschehen',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎭',
      label: 'Kostüm',
      text: 'Kostüm ist erwünscht und fast Pflicht! Wer verkleidet kommt, ist sofort mittendrin. Kostümverleih in der Innenstadt verfügbar.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Villach HBF ist 10 Gehminuten vom Kongresshaus. Direktzüge aus Klagenfurt (30 min), Graz (2 h) und Wien (4,5 h).',
    },
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Ballkarten unter villacherfasching.at. Frühzeitig buchen – beliebte Bälle sind schnell ausverkauft.',
    },
    {
      icon: '🌡️',
      label: 'Klima',
      text: 'Jänner und Februar in Villach sind kalt. Warme Kostüme für den Umzug im Freien empfohlen.',
    },
  ],
  gallery: [
    {
      src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&auto=format&fit=crop',
      alt: 'Farbenfrohe Faschingskostüme auf einem Umzug',
      caption: 'Prächtige Kostüme beim Villacher Faschingsumzug',
    },
    {
      src: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80&auto=format&fit=crop',
      alt: 'Feierliche Ballveranstaltung mit Musik',
      caption: 'Faschingsbälle im Kongresshaus Villach',
    },
    {
      src: 'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=800&q=80&auto=format&fit=crop',
      alt: 'Menschenmenge auf einer Stadtstraße beim Karneval',
      caption: 'Tausende Narrinnen und Narren auf den Straßen Villachs',
    },
  ],
  ctaText: 'Fasching-Events in Kärnten entdecken',
  ctaLink: '/map?bundesland=Kärnten&category=Kultur',
  seoTitle: 'Villacher Fasching 2026 – Programm, Umzug & Tickets',
  seoDescription:
    'Villacher Fasching 2026: Österreichs bekanntester Fasching in Villach/Kärnten. Umzug, Bälle, Kinderfasching – alle Infos zu Programm und Tickets.',
  keywords: [
    'Villacher Fasching 2026',
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
    name: 'Villacher Fasching 2026',
    startDate: '2026-01-06',
    endDate: '2026-02-17',
    location: 'Kongresshaus Villach, Europaplatz 1, 9500 Villach, Austria',
    addressCountry: 'AT',
    url: 'https://www.villacherfasching.at',
    description:
      'Der Villacher Fasching ist Österreichs bekanntestes Faschingsevent mit Bällen, Umzug und Narrenveranstaltungen in Villach, Kärnten.',
    image:
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=85&auto=format&fit=crop',
  },
};
