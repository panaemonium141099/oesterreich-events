import type { FestivalPost } from '../types';

// Saison-Seite (fn-24), Frist laut SAISON_KALENDER: liveBy 08-15.
// Alle Termine, Preise und Öffi-Regeln stammen aus den geprüften `facts`
// des Kalenders (Primärquelle langenacht.orf.at, verifiziert am 2026-09-10),
// nicht aus einem Sprachmodell.
export const post: FestivalPost = {
  slug: 'lange-nacht-der-museen',
  title: 'ORF-Lange Nacht der Museen 2026',
  subtitle: 'Ein Ticket, eine Nacht, Museen in ganz Österreich',
  heroImage: '/images/blog/lange-nacht-der-museen/hero.jpg',
  heroImageCredit: 'Foto: AnonymousGuyFawkes, CC BY-SA 4.0, Wikimedia Commons',
  publishDate: '2026-09-10',
  updatedDate: '2026-09-10',
  readingTime: 7,
  excerpt:
    'Am Samstag, 3. Oktober 2026, sperren Österreichs Museen von 18 bis 24 Uhr auf. Ein Ticket für 19 Euro gilt in allen teilnehmenden Häusern, Kinder bis 12 zahlen nichts. Alle Infos zu Preisen, Vorverkauf und Öffis.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-slate-800 text-white',
  keyFacts: {
    dates: 'Samstag, 3. Oktober 2026, 18:00 bis 24:00 Uhr',
    location: 'Ganz Österreich, alle neun Bundesländer',
    address: 'Treffpunkt Museum in jeder Landeshauptstadt, in Vorarlberg in Dornbirn, dazu Krems',
    genre: 'Museen, Galerien, Kulturinstitutionen',
    price: '19 Euro regulär, 16 Euro ermäßigt, 7 Euro Regionalticket, Kinder bis 12 gratis',
    website: 'https://langenacht.orf.at/info',
    since: '2000',
  },
  lineup: [
    { name: 'Museen und Galerien in allen neun Bundesländern', role: 'headliner' },
    { name: 'Rund 270 Häuser mit eigenem Kinderprogramm', role: 'special' },
    { name: 'Shuttlebusse ab dem Treffpunkt Museum', role: 'support' },
    { name: 'Kinderpass mit Stempeln und Überraschung', role: 'special' },
  ],
  lineupTitle: 'Was in dieser Nacht läuft',
  lineupNote:
    'Welche Häuser konkret mitmachen und welches Programm sie zeigen, steht ab etwa zwei Wochen vor dem Termin im offiziellen Booklet und auf langenacht.orf.at.',
  intro:
    'Einmal im Jahr sperren Österreichs Museen auf, wenn sie normalerweise längst zu haben. Am Samstag, 3. Oktober 2026, findet die ORF-Lange Nacht der Museen zum 26. Mal statt: von 18 bis 24 Uhr, in allen neun Bundesländern, mit einem einzigen Ticket, das dir überall Eintritt verschafft. Vom großen Haus an der Ringstraße bis zum kleinen Regionalmuseum am Land.',
  historyTitle: 'Ein Ticket, alle Museen',
  history:
    'Das Prinzip ist seit dem Start im Jahr 2000 unverändert und der Grund, warum die Lange Nacht zur größten Kunst- und Kulturinitiative des Landes geworden ist. Du kaufst ein Ticket und kommst damit am 3. Oktober zwischen 18 und 24 Uhr in jedes teilnehmende Haus. Kein Einzelticket pro Museum, keine Reservierung, kein Nachzahlen. Realistisch schaffst du an einem Abend vier bis sechs Häuser, wenn sie nah beieinander liegen. In der Wiener Innenstadt oder im Grazer Museumsviertel auch mehr, am Land entsprechend weniger. Ein Restrisiko bleibt: Bei Kapazitätsengpässen garantiert das Ticket keinen Einlass in ein bestimmtes Haus.',
  whatToExpectTitle: 'Was das Ticket kostet und wo es gilt',
  whatToExpect:
    'Der am häufigsten missverstandene Punkt ist die Öffi-Inklusion. Sie gilt nicht österreichweit gleich. In Wien ist dein Ticket zugleich Fahrschein für die gesamte Kernzone, in allen anderen Bundesländern nur für die eigens eingerichteten Lange-Nacht-Shuttlebusse, nicht für den regulären Linienverkehr. Wer ein Museum außerhalb der Stadt ansteuert, braucht in der Regel das Auto.',
  whatToExpectList: [
    '19 Euro regulär für alle teilnehmenden Häuser in ganz Österreich',
    '16 Euro ermäßigt für Schüler:innen, Studierende, Senior:innen, Menschen mit Behinderungen, Präsenzdiener und Ö1-Club-Mitglieder',
    '7 Euro Regionalticket, gültig ausschließlich für Museen außerhalb der Landeshauptstädte',
    'Kinder bis 12 Jahre gratis, konkret alle nach dem 2. Oktober 2014 geborenen',
    'Online-Vorverkauf bis 27. September 2026 auf backstage.ORF.at, danach in den Museen und am Veranstaltungstag',
    'In Wien gilt das Ticket als Fahrschein in der Kernzone, inklusive Nightline-Busse',
  ],
  practicalInfoTitle: 'Praktische Infos für die Lange Nacht',
  practicalInfo: [
    {
      icon: '📅',
      label: 'Termin',
      text: 'Samstag, 3. Oktober 2026, von 18:00 bis 24:00 Uhr. Die 26. Ausgabe.',
    },
    {
      icon: '🎟️',
      label: 'Vorverkauf',
      text: 'Online bis 27. September 2026 auf backstage.ORF.at. Danach gibt es Tickets nur noch in den teilnehmenden Museen sowie am Veranstaltungstag an den Kassen und am Treffpunkt Museum.',
    },
    {
      icon: '🚇',
      label: 'Öffis in Wien',
      text: 'Das Ticket gilt als Fahrschein in der Kernzone Wien vom 3. Oktober 17:00 Uhr bis 4. Oktober 00:59 Uhr, inklusive Nightline-Busse.',
    },
    {
      icon: '🚌',
      label: 'Öffis außerhalb Wiens',
      text: 'In den übrigen Bundesländern gilt das Ticket nur für die Lange-Nacht-Shuttlebusse, nicht für den regulären Linienverkehr. Die Shuttles starten am jeweiligen Treffpunkt Museum.',
    },
    {
      icon: '📍',
      label: 'Treffpunkt Museum',
      text: 'In jeder Landeshauptstadt, in Vorarlberg in Dornbirn, dazu in Krems. Dort bekommst du Tickets, das gedruckte Booklet und die Routen.',
    },
    {
      icon: '👶',
      label: 'Mit Kindern',
      text: 'Rund 270 Häuser bieten ein eigenes Kinderprogramm, im Booklet und auf der Website eigens gekennzeichnet. Dazu gibt es den Kinderpass: pro besuchtem Kinderprogramm ein Stempel, ab drei Stempeln eine Überraschung am Treffpunkt Museum.',
    },
    {
      icon: '🗺️',
      label: 'Route planen',
      text: 'Sechs Stunden klingen nach viel, sind aber schnell weg. Such dir zwei Fixpunkte und lass den Rest offen. Die großen Namen sind zwischen 19 und 21 Uhr am vollsten, die kleinen spezialisierten Häuser sind oft das eigentliche Erlebnis.',
    },
  ],
  gallery: [],
  faqs: [
    {
      question: 'Wann ist die Lange Nacht der Museen 2026?',
      answer: 'Am Samstag, 3. Oktober 2026, von 18 bis 24 Uhr, in ganz Österreich.',
    },
    {
      question: 'Was kostet das Ticket?',
      answer: '19 Euro regulär, 16 Euro ermäßigt und 7 Euro für das Regionalticket. Kinder bis 12 Jahre sind gratis.',
    },
    {
      question: 'Gilt ein Ticket für alle Museen?',
      answer: 'Ja. Ein Ticket berechtigt am 3. Oktober zwischen 18 und 24 Uhr zum Eintritt in alle teilnehmenden Häuser in ganz Österreich. Bei Kapazitätsengpässen garantiert es allerdings keinen Einlass in ein bestimmtes Haus.',
    },
    {
      question: 'Sind die Öffis im Ticket enthalten?',
      answer: 'In Wien ja: Das Ticket gilt in der Kernzone vom 3. Oktober 17:00 Uhr bis 4. Oktober 00:59 Uhr, inklusive Nightline-Busse. In den anderen Bundesländern gilt es ausschließlich für die Lange-Nacht-Shuttlebusse, nicht für den regulären Linienverkehr.',
    },
    {
      question: 'Bis wann gibt es den Online-Vorverkauf?',
      answer: 'Bis 27. September 2026 auf backstage.ORF.at. Danach nur noch in den Museen und am Veranstaltungstag.',
    },
    {
      question: 'Ist die Lange Nacht der Museen etwas für Kinder?',
      answer: 'Ja. Rund 270 Häuser bieten ein eigenes Kinderprogramm. Kinder bis 12 zahlen nichts, und mit dem Kinderpass sammeln sie Stempel: ab drei Stempeln gibt es eine Überraschung.',
    },
    {
      question: 'Wie viele Museen schafft man an einem Abend?',
      answer: 'Realistisch vier bis sechs, wenn sie nah beieinander liegen. In Wien oder Graz auch mehr, in ländlichen Regionen weniger.',
    },
  ],
  ctaText: 'Alle Kultur-Events in Österreich entdecken',
  ctaLink: '/thema/kultur',
  seoTitle: 'ORF-Lange Nacht der Museen 2026: Termin, Tickets und alle Infos',
  seoDescription:
    'Am 3. Oktober 2026 öffnen Österreichs Museen von 18 bis 24 Uhr. Ein Ticket für alle Häuser: 19 Euro, Kinder gratis. Alle Infos zu Preisen, Vorverkauf und Öffis.',
  keywords: [
    'lange nacht der museen 2026',
    'lange nacht der museen',
    'lange nacht der museen wien',
    'lange nacht der museen tickets',
    'lange nacht der museen programm',
    'orf lange nacht der museen',
  ],
  relatedEvents: {
    // Bewusst ohne 'kunst' und 'führung': als Teilstring treffen die
    // "Die Kunst, Recht zu behalten" und "Vorführung".
    terms: ['museum', 'museen', 'ausstellung', 'galerie', 'sammlung', 'kunsthaus'],
    from: '2026-09-25',
    to: '2026-10-31',
    categories: ['Kultur & Bühne', 'Familie & Kinder'],
  },
  jsonLdEvent: {
    name: 'ORF-Lange Nacht der Museen 2026',
    startDate: '2026-10-03T18:00:00+02:00',
    endDate: '2026-10-04T00:00:00+02:00',
    location: 'Museen in ganz Österreich',
    addressCountry: 'AT',
    url: 'https://langenacht.orf.at/info',
    description:
      'Die ORF-Lange Nacht der Museen 2026 öffnet am 3. Oktober von 18 bis 24 Uhr Museen und Galerien in allen neun Bundesländern. Ein Ticket gilt in allen teilnehmenden Häusern.',
    image: 'https://lasstreffen.at/images/blog/lange-nacht-der-museen/hero.jpg',
  },
  stayCity: 'Wien',
};
