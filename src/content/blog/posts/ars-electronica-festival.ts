import type { FestivalPost } from '../types';

// Termine 2026/2027, Thema, Spielorte, Ticketpreise und Geschichte geprüft am 2026-10-27
// gegen ars.electronica.art/festival (Termin 2027), ars.electronica.art/negotiatinghumanity/
// de/ (Rückblick 2026, /tickets/, /time-locations/), news.at (Hubs 2026), derstandard.at
// (über 122.000 Besuche 2025) und oberoesterreich.at (Adresse OK Linz). Termin 2026
// (9. bis 13.9.) stimmte. Vorher falsch bzw. erfunden: Line-up 2026 (Refik Anadol,
// teamLab, „Nonhuman Nonsense“, Quadrature, Symposion „KI & Demokratie“ in der
// Martinskirche; auf der Festivalseite 2026 nicht genannt), OK-Adresse „Domplatz 1“
// (richtig OK-Platz 1), Preise „Tagesticket ab 25 €, 5-Tages-Pass ab 80 €“ (2026: 65 €
// bzw. 180 €), 100.000 Besucher, Gründer ohne Ulli A. Rützel, Programmveröffentlichung
// „im Juni“, Simultanübersetzung, ausgedachte Intro-Szenen im „Postbahnhof“ (POSTCITY
// ist laut Festivalseite kein Spielort mehr).
export const post: FestivalPost = {
  slug: 'ars-electronica-festival',
  title: 'Ars Electronica Festival',
  subtitle: 'Wo Kunst, Technologie und Gesellschaft die Zukunft erfinden: in Linz',
  heroImage: '/images/blog/ars-electronica-festival/hero.jpg',
  thumbnailImage: '/images/blog/ars-electronica-festival/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  readingTime: 7,
  excerpt:
    'Das Ars Electronica Festival in Linz ist das weltweit führende Festival für digitale Kunst, Technologie und Gesellschaft. Jährlich im September treffen sich Künstler, Wissenschaftler und Visionäre aus aller Welt.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-purple-800 text-white',
  keyFacts: {
    dates: '8. bis 12. September 2027 (2026: 9. bis 13. September)',
    location: 'Linzer Innenstadt: OK Quarter, Danube Triangle, MED Campus (2026 über 40 Orte)',
    address: 'OK Linz, OK-Platz 1, 4020 Linz',
    genre: 'Digitale Kunst, Technologie, Gesellschaft, KI, Natur',
    price: '2026: Tagespass 65 € (ermäßigt 44 €), Festivalpass 5 Tage 180 € (ermäßigt 115 €)',
    website: 'https://ars.electronica.art/festival',
    capacity: 'über 122.000 Besuche (2025)',
    since: '1979',
  },
  lineup: [
    { name: 'Prix Ars Electronica und S+T+ARTS Prize ’26', role: 'headliner', stage: 'Lentos Kunstmuseum' },
    { name: 'Festival Walk', role: 'special', stage: 'OK Quarter' },
    { name: 'create your world', role: 'special', stage: 'MED Campus' },
    { name: 'Ars Electronica Nightline', role: 'support', day: '11. September 2026' },
  ],
  lineupTitle: 'Programm-Highlights 2026',
  lineupNote:
    'Auswahl aus dem Festival 2026 laut Ars Electronica. Das Programm für 2027 ist noch nicht veröffentlicht; der Online-Ticketverkauf startet laut Veranstalter im Juli 2027.',
  intro:
    'Hafenbecken, Industriegelände, Bergtunnel, ein ehemaliges Postverteilzentrum und zuletzt die ganze Linzer Innenstadt: Ars Electronica sucht sich für sein Festival immer wieder ungewöhnliche Orte. 2026 verteilte es sich unter dem Thema „Negotiating Humanity“ auf mehr als 40 Schauplätze zwischen OK-Platz, Hauptplatz und Donau. Seit 1979 bringt das Festival in Linz die klügsten, kreativsten und mutigsten Menschen zusammen, die fragen: Wohin entwickeln sich Kunst, Technologie und Gesellschaft?',
  historyTitle: 'Seit 1979: Linz als Labor der digitalen Zukunft',
  history:
    'Ars Electronica wurde 1979 in Linz gegründet, in einer Zeit, als "Computer" noch Nischenthema war. Die Gründer Hannes Leopoldseder, Hubert Bognermayr, Herbert W. Franke und Ulli A. Rützel hatten eine Vision: Sie wollten erforschen, was entsteht, wenn Kunst und Technologie wirklich zusammenkommen. Das Festival, das Ars Electronica Center (eröffnet 1996) und der Prix Ars Electronica (seit 1987) sind heute weltweit anerkannte Institutionen. Linz wurde durch Ars Electronica zur internationalen Hauptstadt der Medienkunst.',
  whatToExpectTitle: 'Was das Festival bietet',
  whatToExpect:
    'Nach dem Wegfall der POSTCITY verteilte sich das Festival 2026 unter dem Thema „Negotiating Humanity“ auf mehr als 40 Orte in der Linzer Innenstadt, gebündelt in drei Hubs: OK Quarter rund um den OK-Platz, das Danube Triangle mit Ars Electronica Center, Lentos und Kunstuniversität sowie der MED Campus der JKU. Dazu kamen Satelliten wie Brucknerhaus, Mariendom, Design Center Linz, Posthof und Tabakfabrik. Ausstellungen, Konzerte, Performances, Konferenzen, Workshops und der Prix Ars Electronica bilden zusammen das Programm.',
  whatToExpectList: [
    'Prix Ars Electronica: Ausstellung ausgezeichneter Projekte (2026 im Lentos)',
    'Themenausstellungen in OK Quarter, Lentos und Ursulinenhof',
    'Konferenzen, Vorträge, Networking und Workshops',
    'Ars Electronica Nightline (2026 am 11. September)',
    'create your world am MED Campus (2026 bei freiem Eintritt)',
    'Deep Space 8K im Ars Electronica Center: immersive Präsentationen',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Preise 2026: Tagespass 65 € (ermäßigt 44 €), Festivalpass für fünf Tage 180 € (ermäßigt 115 €), Festivalpass u19 19 €, Festival-Walk-Ticket 14 €. Studierende bis 26 nutzen die ermäßigten Tarife. Der Online-Verkauf für 2027 startet laut Veranstalter im Juli 2027.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Die drei Festival-Hubs liegen in der Linzer Innenstadt: OK Quarter am OK-Platz, Danube Triangle am Hauptplatz und an der Donau, MED Campus der JKU. Infodesks gibt es am OK-Platz, am MED Campus und im splace am Hauptplatz.',
    },
    {
      icon: '🗓️',
      label: 'Planung',
      text: 'Mit fünf Tagen Programm und über 40 Spielorten ist vorausschauende Planung wichtig. Programm vorab auf ars.electronica.art durchstöbern und Highlights vormerken.',
    },
    {
      icon: '🌐',
      label: 'Sprache',
      text: 'Das Festival ist international, das Programm läuft größtenteils auf Englisch und Deutsch.',
    },
  ],
  gallery: [],
  ctaText: 'Kulturevents in Linz entdecken',
  ctaLink: '/map?bundesland=Oberoesterreich&category=Kultur',
  seoTitle: 'Ars Electronica Festival Linz 2027: Termine & Tickets',
  seoDescription:
    'Ars Electronica Festival Linz 2027 von 8. bis 12. September: Festival für digitale Kunst, KI und Technologie. Termine, Spielorte, Tickets und Tipps.',
  keywords: [
    'Ars Electronica Festival 2027',
    'Ars Electronica Linz',
    'Digitale Kunst Festival Österreich',
    'Prix Ars Electronica',
    'Medienkunst Festival Linz',
    'KI Kunst Festival',
    'Linz Technologie Kultur',
    'Ars Electronica September',
    'OK Quarter Linz Festival',
    'Ars Electronica Tickets',
  ],
  jsonLdEvent: {
    name: 'Ars Electronica Festival 2027',
    startDate: '2027-09-08',
    endDate: '2027-09-12',
    location: '4020 Linz, Austria',
    addressCountry: 'AT',
    url: 'https://ars.electronica.art/festival',
    description:
      'Das Ars Electronica Festival in Linz ist das weltweit führende Festival für digitale Kunst, Technologie und Gesellschaft, seit 1979 der Treffpunkt für Visionäre.',
    image:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&q=85&auto=format&fit=crop',
  },
};
