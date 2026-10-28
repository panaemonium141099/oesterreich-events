import type { FestivalPost } from '../types';

// Termine, Spielplan, Preise, Anreise und Geschichte geprüft am 2026-10-27 gegen
// leharfestival.at (Startseite, /stuecke/2027-*, /karten/ mit Preise_2027.jpg, /besuch/,
// /ueber-uns/geschichte/, /presse/ mit PRESSEMAPPE_2026.pdf) und stadtmuseum.at (Lehárvilla).
// Vorher falsch: Programm 2026 erfunden ("Die lustige Witwe" und "Das Land des Lächelns";
// tatsächlich Boccaccio, Gräfin Mariza, Der Göttergatte), "Gala der Operette" und
// "Orchester der Lehár Festspiele" (richtig: Gala "Ein Hoch der Operette", Franz Lehár-Orchester),
// Preise geschätzt, Bahnlinie Salzburg bis Bad Ischl gibt es nicht (Umstieg Attnang-Puchheim
// bzw. Postbus aus Salzburg), Abendgarderobe-Hinweis ohne Beleg. Jetzt auf Saison 2027 umgestellt.
export const post: FestivalPost = {
  slug: 'lehar-festival-bad-ischl',
  title: 'Lehár Festival Bad Ischl 2027',
  subtitle: 'Die Operette lebt: Im Salzkammergut trifft Tradition auf Glanz',
  heroImage: '/images/blog/lehar-festival-bad-ischl/hero.jpg',
  thumbnailImage: '/images/blog/lehar-festival-bad-ischl/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.leharfestival.at',
      'https://www.leharfestival.at/stuecke/2027-die-lustige-witwe/',
      'https://www.leharfestival.at/wp-content/uploads/2026/04/PRESSEMAPPE_2026.pdf',
      'https://www.leharfestival.at/wp-content/uploads/2026/07/Preise_2027.jpg',
      'https://www.leharfestival.at/ueber-uns/geschichte/',
      'https://www.leharfestival.at/besuch/',
      'https://www.stadtmuseum.at/wp-content/uploads/2026/02/Folder-Leharvilla.pdf',
    ],
  },
  readingTime: 6,
  excerpt:
    'Im Kongress & TheaterHaus Bad Ischl erwacht jedes Jahr die Welt der Operette neu. Das Lehár Festival Bad Ischl feiert das Erbe des berühmten Komponisten mit opulenten Inszenierungen, internationalen Stars und dem Charme des Salzkammerguts.',
  category: 'Kultur & Bühne',
  categoryColor: 'bg-purple-700 text-white',
  keyFacts: {
    dates: '10. Juli bis 29. August 2027 (Saison 2026: 11. Juli bis 30. August)',
    location: 'Kongress & TheaterHaus, Bad Ischl',
    address: 'Kurhausstraße 8, 4820 Bad Ischl',
    genre: 'Operette',
    price: 'Saison 2027: € 19 bis € 106 je nach Stück und Kategorie',
    website: 'https://www.leharfestival.at',
    since: '1961',
  },
  lineup: [
    { name: 'Die lustige Witwe (Franz Lehár)', role: 'headliner', day: 'Premiere Samstag, 10. Juli 2027' },
    { name: 'Gasparone (Carl Millöcker)', role: 'headliner', day: 'Premiere Samstag, 17. Juli 2027' },
    { name: 'Die lustigen Nibelungen (Oscar Straus)', role: 'headliner', day: 'Premiere Freitag, 13. August 2027' },
  ],
  lineupTitle: 'Programm 2027',
  lineupNote:
    'Spielplan 2027 laut leharfestival.at. Die lustige Witwe kommt in der erweiterten Revue-Fassung nach Erik Charell. Gespielt wird im Kongress & TheaterHaus Bad Ischl.',
  intro:
    'Bad Ischl, die einstige Sommerresidenz von Kaiser Franz Joseph I., ist nicht nur für seine k. u. k. Geschichte berühmt, sondern auch für ein Festival, das die Seele der Operette bewahrt und neu belebt. Das Lehár Festival Bad Ischl trägt den Namen des großen Operettenkomponisten Franz Lehár, der in dieser Salzkammergut-Stadt lebte und wirkte. Jedes Jahr von Juli bis August verwandelt sich der Kurort in eine Bühne für die schönsten Melodien des Goldenen Zeitalters der Wiener Operette.',
  historyTitle: 'Franz Lehár und sein Erbe in Bad Ischl',
  history:
    'Franz Lehár (1870 bis 1948) verbrachte viele Sommer in Bad Ischl, seine Villa am Lehárkai ist heute ein Museum des Stadtmuseums Bad Ischl und nur mit Führung zu besichtigen. Das Festival begann 1961 als „Operettenwochen“. Ab 1993 hieß es Operettenfestspiele, den Namen Lehár Festival Bad Ischl bekam es unter der Intendanz von Michael Lakner (2004 bis 2016). Gespielt wurde zunächst im Kurhaus. Nach dessen Umbau steht die Bühne seit 1999 im neuen Kongress & TheaterHaus. Der Veranstalter bezeichnet es heute als das größte Operettenfestival Europas.',
  whatToExpectTitle: 'Operette, Gala und Salzkammergut-Zauber',
  whatToExpect:
    'Die Saison 2026 war die 65. des Festivals und brachte drei Operetten auf die Bühne: Franz von Suppés „Boccaccio“ (Premiere 11. Juli), Emmerich Kálmáns „Gräfin Mariza“ (Premiere 18. Juli) und Franz Lehárs „Der Göttergatte“ (Premiere 14. August). Dazu kamen das Gala-Konzert „Ein Hoch der Operette“ am 30. Juli mit dem Franz Lehár-Orchester, zwei Matineen, ein Symposium und eine Kinderfassung von Boccaccio. Für 2027 stehen „Die lustige Witwe“, „Gasparone“ und „Die lustigen Nibelungen“ auf dem Spielplan, Vorstellungen gibt es meist um 15:30 oder 19:30 Uhr.',
  whatToExpectList: [
    'Drei Operetten-Produktionen in der Saison 2027',
    '2026 gab es vor jeder Vorstellung außer den Premieren eine Werkeinführung',
    'Historisches Ambiente im Kongress & TheaterHaus',
    'Lehárvilla am Lehárkai als Museum (nur mit Führung)',
    'Rahmenprogramm 2026: Gala, Matineen, Ausstellung und Kindervorstellung',
    'Kombinierbar mit Ausflügen ins Salzkammergut (Hallstatt, Wolfgangsee)',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🚂',
      label: 'Anreise mit der Bahn',
      text: 'Aus Wien, Linz und Salzburg mit Umstieg in Attnang-Puchheim auf die Salzkammergutbahn (ab Linz rund 1,5 Stunden). Aus Salzburg fährt außerdem ein Postbus nach Bad Ischl (rund 1,5 Stunden).',
    },
    {
      icon: '🚗',
      label: 'Anreise mit dem Auto',
      text: 'Aus Salzburg über die A1 bis Thalgau, dann B158. Aus Wien und Linz über die A1 bis Regau, dann B145. Ermäßigtes Parken für Festivalgäste in der Zentrumstiefgarage beim Bahnhof (Ausfahrtsticket an der Garderobe).',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Bad Ischl bietet zahlreiche Hotels und Pensionen im Kurbereich. Buchung für Festivalwochenenden frühzeitig empfehlenswert.',
    },
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Online unter leharfestival.at oder an der Kasse im Kongress & TheaterHaus. Preise 2027 von € 19 bis € 106, Die lustigen Nibelungen günstiger als Witwe und Gasparone.',
    },
  ],
  gallery: [],
  ctaText: 'Kulturevents im Salzkammergut entdecken',
  ctaLink: '/map?bundesland=Ober%C3%B6sterreich&category=Kultur',
  seoTitle: 'Lehár Festival Bad Ischl 2027: Spielplan und Termine',
  seoDescription:
    'Lehár Festival Bad Ischl 2027 (10. Juli bis 29. August): Die lustige Witwe, Gasparone und Die lustigen Nibelungen. Termine, Preise, Anreise und Rückblick auf 2026.',
  keywords: [
    'Lehár Festival Bad Ischl',
    'Lehár Festival 2027',
    'Lehár Festival 2026',
    'Operette Österreich',
    'Bad Ischl Festival',
    'Salzkammergut Kultur',
    'Wiener Operette',
    'Franz Lehár',
    'Theater Bad Ischl',
    'Kulturveranstaltung Oberösterreich',
  ],
  jsonLdEvent: {
    name: 'Lehár Festival Bad Ischl 2027',
    startDate: '2027-07-10',
    endDate: '2027-08-29',
    location: 'Kongress & TheaterHaus, Kurhausstraße 8, 4820 Bad Ischl, Austria',
    addressCountry: 'AT',
    url: 'https://www.leharfestival.at',
    description:
      'Das Lehár Festival Bad Ischl zeigt vom 10. Juli bis 29. August 2027 im Kongress & TheaterHaus Die lustige Witwe, Gasparone und Die lustigen Nibelungen.',
    image:
      'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1600&q=85&auto=format&fit=crop',
  },
};
