import type { FestivalPost } from '../types';

// Existenz, Ort und Anreise geprüft am 2026-10-27 gegen novarock.at (Veranstalter des einzigen
// Festivals auf dem Gelände), vienna.at (APA-Berichte "Nova Rock 2026: How to Successfully
// Travel from Vienna to Nickelsdorf" und "Nova Rock startet") und Websuchen. Ein "Pannonia
// Fields Electronic Festival" gibt es nicht, die Domain pannoniafields.at existiert nicht
// (DNS-Fehler). Vorher erfunden: das Festival samt Termin 6. bis 9.08.2026, Lineup (Charlotte
// de Witte, Amelie Lens, Nina Kraviz, Ben Klock, Maceo Plex, Sven Väth), 20.000 Besucher,
// Preis, Camping inklusive, 24h-Programm, Direktzüge ab Wien Hbf. Post neu geschrieben.
export const post: FestivalPost = {
  slug: 'pannonia-fields',
  title: 'Pannonia Fields Electronic Festival: gibt es nicht',
  subtitle: 'Auf den Pannonia Fields in Nickelsdorf läuft Nova Rock, kein Techno-Festival',
  heroImage: '/images/blog/pannonia-fields/hero.jpg',
  thumbnailImage: '/images/blog/pannonia-fields/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.novarock.at',
      'https://www.vienna.at/nova-rock-2026-how-to-successfully-travel-from-vienna-to-nickelsdorf/10239974',
    ],
  },
  readingTime: 3,
  excerpt:
    'Ein „Pannonia Fields Electronic Festival“ in Nickelsdorf lässt sich in keiner Quelle finden. Das Gelände Pannonia Fields II ist die Heimat von Nova Rock, Österreichs großem Rock- und Metal-Festival im Juni.',
  category: 'Musik & Festival',
  categoryColor: 'bg-violet-700 text-white',
  keyFacts: {
    dates: 'Kein Termin: das Electronic Festival ist nicht belegt',
    location: 'Pannonia Fields II, Nickelsdorf (Burgenland)',
    address: 'Pannonia Fields II, 2425 Nickelsdorf',
    genre: 'Gelände von Nova Rock (Rock, Metal)',
    price: 'kein Festival, keine Tickets',
    website: 'https://www.novarock.at',
  },
  lineup: [],
  intro:
    'Diese Seite beschrieb früher ein „Pannonia Fields Electronic Festival“ mit Techno-Stars wie Charlotte de Witte oder Sven Väth. Wir haben das im Oktober 2026 geprüft: Ein solches Festival gibt es nicht. Die angegebene Website pannoniafields.at existiert nicht, und weder Veranstalter noch Medien berichten über ein Elektronik-Festival auf dem Gelände. Termin, Lineup, Besucherzahl und Preise waren erfunden und sind entfernt.',
  historyTitle: 'Was auf den Pannonia Fields wirklich stattfindet',
  history:
    'Die Pannonia Fields II in Nickelsdorf im Bezirk Neusiedl am See sind das Gelände von Nova Rock, einem Rock- und Metal-Festival des Veranstalters Nova Music Entertainment. 2026 fand Nova Rock vom 11. bis 14. Juni statt, laut APA rechneten die Veranstalter über die vier Tage mit mehr als 200.000 Besuchen. Alles zu Nova Rock steht in unserem eigenen Beitrag und auf novarock.at.',
  whatToExpectTitle: 'Elektronische Musik in Österreich',
  whatToExpect:
    'Wer ein Techno- oder Elektronik-Festival sucht, findet es nicht in Nickelsdorf. Aktuelle Elektronik-Events in Österreich zeigt unsere Eventsuche.',
  whatToExpectList: [
    'Kein Elektronik-Festival auf den Pannonia Fields belegt',
    'Pannonia Fields II: Gelände von Nova Rock im Juni',
    'Nova Rock 2026: 11. bis 14. Juni',
  ],
  practicalInfoTitle: 'Anreise zu den Pannonia Fields',
  practicalInfo: [
    {
      icon: '🚗',
      label: 'Auto',
      text: 'Über die Ostautobahn A4, Abfahrt Nickelsdorf, bei Stau auch Mönchhof. Im Navi „Pannonia Fields II“ eingeben.',
    },
    {
      icon: '🚂',
      label: 'Bahn bei Nova Rock',
      text: 'Zu Nova Rock 2026 fuhren ÖBB-Sonderzüge ab Wien Meidling nach Nickelsdorf, vom Bahnhof weiter per Shuttlebus.',
    },
  ],
  gallery: [],
  ctaText: 'Musik-Events im Burgenland entdecken',
  ctaLink: '/map?bundesland=Burgenland&category=Musik',
  seoTitle: 'Pannonia Fields Electronic Festival: gibt es nicht',
  seoDescription:
    'Ein Pannonia Fields Electronic Festival in Nickelsdorf gibt es nicht. Auf dem Gelände Pannonia Fields II findet Nova Rock statt, 2026 vom 11. bis 14. Juni.',
  keywords: [
    'Pannonia Fields',
    'Pannonia Fields II Nickelsdorf',
    'Pannonia Fields Festival',
    'Nickelsdorf Festival',
    'Nova Rock Gelände',
    'Electronic Festival Burgenland',
  ],
};
