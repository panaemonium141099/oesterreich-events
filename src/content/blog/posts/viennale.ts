import type { FestivalPost } from '../types';

// Termin 2026, Spielstätten mit Adressen und U-Bahn, Ticketpreise, Vorverkauf, Geschichte,
// Leitung, Programmschienen und Website geprüft am 2026-10-28 gegen viennale.at (Kopf:
// „22. Okt–3. Nov 2026“; /de/festivalkinos: Gartenbaukino Parkring 12, Stadtkino im
// Künstlerhaus Akademiestraße 13, Urania Uraniastraße 1, Österreichisches Filmmuseum
// Augustinerstraße 1, METRO Kinokulturhaus Johannesgasse 4; /de/tickets-spielorte/
// ticketpreise: Einzelticket 11,50 Euro, Mengenpreise ab 10 und 20 Tickets;
// /de/festival/Viennale: 64. Ausgabe, kein Wettbewerb, Preise FIPRESCI, Wiener Filmpreis,
// Erste Bank Filmpreis, Publikumspreis; /de/festival/geschichte: Beginn 1960, Hans Hurch
// 1997 bis 2017, Eva Sangiorgi seit 2018; /en/press/pressreleases-2026: Eröffnungsfilm
// FOREVER…FOREVER von Johann Lurf, Programmpräsentation 13.10.2026), orf.at/stories/
// 3444939/ (Abschlussfilm, Retrospektive Robert Aldrich mit dem Filmmuseum) und
// wien.orf.at/stories/3327690/ (2025: 78.600 verkaufte Tickets). Falsch waren: Termin
// 15. bis 28. Oktober (richtig 22. Oktober bis 3. November), „Internationaler Wettbewerb“
// (die Viennale hat keinen), „Festival-Pass“ (es gibt Mengenpreise), „Tickets ab ca. € 12“,
// „Weltpremieren“ (Viennale nennt nationale und zum Teil internationale Premieren),
// „Programm Anfang Oktober“ (2026 am 13. Oktober). Nicht belegt und entfernt: „ca. 100.000
// Besucher“, „rund 200 Filme“, Hausbar im Gartenbaukino, Straßenbahn 2. Termin 2027 noch
// nicht veröffentlicht.
export const post: FestivalPost = {
  slug: 'viennale',
  title: 'Viennale',
  subtitle: 'Wiens internationales Filmfestival: Kino als Ereignis, jedes Jahr Ende Oktober',
  heroImage: '/images/blog/viennale/hero.jpg',
  thumbnailImage: '/images/blog/viennale/thumb.jpg',
  publishDate: '2026-03-31',
  updatedDate: '2026-10-28',
  factSources: {
    checkedAt: '2026-10-28',
    urls: [
      'https://www.viennale.at/de/festivalkinos',
      'https://www.viennale.at/en/press/pressreleases-2026',
      'https://www.viennale.at/de/tickets-spielorte/ticketpreise',
      'https://wien.orf.at/stories/3327690/',
      'https://orf.at/stories/3444939/',
      'https://www.viennale.at/de/festival/Viennale',
      'https://www.viennale.at/de/festival/geschichte',
    ],
  },
  readingTime: 6,
  excerpt:
    'Die Viennale ist Österreichs größtes internationales Filmfestival. Die 64. Ausgabe läuft von 22. Oktober bis 3. November 2026 in fünf Wiener Kinos, mit neuen Filmen aus aller Welt, Retrospektive und vielen Gästen.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-slate-700 text-white',
  keyFacts: {
    dates: '22. Oktober bis 3. November 2026. Termin 2027 folgt',
    location: 'Gartenbaukino, Stadtkino im Künstlerhaus, Urania, Österreichisches Filmmuseum, METRO Kinokulturhaus',
    address: 'Gartenbaukino: Parkring 12, 1010 Wien (Eröffnungskino)',
    genre: 'Arthouse, Spielfilm, Dokumentarfilm, Kurzfilm, Retrospektive',
    price: 'Einzelticket € 11,50 | ermäßigt € 10,50 | günstiger ab 10 und 20 Tickets',
    website: 'https://www.viennale.at',
    capacity: '2025: 78.600 verkaufte Tickets',
    since: '1960',
  },
  lineup: [
    { name: 'Eröffnungsfilm: FOREVER…FOREVER (Johann Lurf)', role: 'headliner', day: '22. Oktober 2026', stage: 'Gartenbaukino' },
    { name: 'Abschlussfilm: Wiener Blues: The Loneliest Man in Town (Tizza Covi, Rainer Frimmel)', role: 'headliner', day: '3. November 2026' },
    { name: 'Retrospektive Robert Aldrich', role: 'special', stage: 'Österreichisches Filmmuseum' },
    { name: 'Features und Shorts aus aller Welt', role: 'support', stage: 'alle Festivalkinos' },
    { name: 'Monografien, Kinematografien, Historiografie', role: 'support', stage: 'alle Festivalkinos' },
  ],
  lineupTitle: 'Programm 2026',
  lineupNote: 'Das komplette Programm mit Spielplan und Gästen steht auf viennale.at.',
  intro:
    'Jedes Jahr Ende Oktober wird die Wiener Innenstadt zum Festivalort: Die Viennale zeigt knapp zwei Wochen lang neue Filme aus aller Welt, viele davon als Premiere in Österreich, dazu Retrospektiven und Sonderprogramme. Für viele Regisseurinnen und Regisseure ist sie die einzige Gelegenheit, ihre Arbeiten in Österreich zu zeigen, denn nur wenige Festivalfilme kommen später regulär ins Kino. Die Viennale ist kein Glamourfestival, sondern ein Publikumsfestival mit hohem cineastischem Anspruch. 2026 findet sie zum 64. Mal statt.',
  historyTitle: 'Seit 1960: von der Festwoche zum Publikumsfestival',
  history:
    'Die Viennale begann 1960 als „Internationale Festwoche der interessantesten Filme des Jahres 1959“, organisiert von österreichischen Filmjournalisten ohne öffentliche Förderung. Ab 1968 nahm sie die Retrospektiven des Österreichischen Filmmuseums auf und wuchs. Hans Hurch leitete das Festival von 1997 bis 2017 und stärkte den Dokumentarfilm. Seit 2018 ist Eva Sangiorgi Direktorin; unter ihr unterscheidet das Programm nicht mehr zwischen Spielfilm und Dokumentarfilm. Die große historische Retrospektive entsteht bis heute gemeinsam mit dem Filmmuseum.',
  whatToExpectTitle: 'Was erwartet dich bei der Viennale?',
  whatToExpect:
    'Das Hauptprogramm läuft in den fünf klassischen Kinos der Viennale in der Innenstadt: Gartenbaukino, Stadtkino im Künstlerhaus, Urania, Österreichisches Filmmuseum und METRO Kinokulturhaus. Dazu kommen Monografien, Kinematografien und Historiografien zu Persönlichkeiten, Genres und Themen sowie die große Retrospektive, 2026 über Robert Aldrich. Viele Filmschaffende sind persönlich zu Gast. Treffpunkt abseits der Kinos ist die Viennale Zentrale im Funkhaus Wien mit Gesprächen, Konzerten und Partys. Zum Abschluss vergibt eine Gala unter anderem den Preis der Filmkritik FIPRESCI, den Wiener Filmpreis und den Publikumspreis.',
  whatToExpectList: [
    'Neue Spielfilme, Dokumentarfilme und Kurzfilme aus aller Welt, oft als Premiere in Österreich',
    'Große Retrospektive gemeinsam mit dem Österreichischen Filmmuseum',
    'Gespräche mit Filmschaffenden nach vielen Vorstellungen',
    'Viennale Zentrale im Funkhaus Wien mit Talks, Konzerten und Partys',
    'Kein Wettbewerb, aber Preise: FIPRESCI Preis, Wiener Filmpreis, Erste Bank Filmpreis, Publikumspreis',
    'Fünf Festivalkinos, alle im 1. Bezirk',
  ],
  practicalInfoTitle: 'Praktische Infos zur Viennale',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Einzelticket 11,50 Euro, ab 10 und ab 20 Tickets gibt es Mengenpreise. Alle Plätze sind zugewiesen. Der Vorverkauf 2026 startete am 17. Oktober online auf viennale.at.',
    },
    {
      icon: '🚇',
      label: 'Anreise Gartenbaukino',
      text: 'Parkring 12, 1010 Wien: U3 bis Stubentor oder U4 bis Stadtpark.',
    },
    {
      icon: '📽️',
      label: 'Tipp zum Programm',
      text: 'Das Gesamtprogramm wird rund zehn Tage vor Festivalbeginn präsentiert, 2026 am 13. Oktober. Vorstellungen mit Gästen sind oft schnell ausverkauft; für Resttickets gibt es ab 30 Minuten vor Beginn Wartenummern.',
    },
    {
      icon: '🎓',
      label: 'Ermäßigung',
      text: 'Studierende, Schüler und Lehrlinge unter 27 sowie Pensionisten zahlen für Vorstellungen vor 17.30 Uhr mit dem Vermehrt Schönes! Ticket 8,50 Euro (an der Kinokasse).',
    },
  ],
  gallery: [],
  ctaText: 'Film und Kultur in Wien entdecken',
  ctaLink: '/map?category=Kultur&region=Wien',
  seoTitle: 'Viennale 2026: Wiener Filmfestival von 22. Oktober bis 3. November',
  seoDescription:
    'Die Viennale 2026 läuft von 22. Oktober bis 3. November in fünf Wiener Kinos: Programm, Retrospektive Robert Aldrich, Ticketpreise und Spielorte des Filmfestivals.',
  keywords: [
    'Viennale',
    'Wien Filmfestival',
    'Viennale 2026',
    'Internationales Filmfestival Wien',
    'Gartenbaukino',
    'Wien Kino Festival',
    'Viennale Tickets',
    'Filmfestival Oktober Wien',
    'Vienna International Film Festival',
    'Arthouse Kino Wien',
  ],
  jsonLdEvent: {
    name: 'Viennale 2026: Vienna International Film Festival',
    startDate: '2026-10-22',
    endDate: '2026-11-03',
    location: 'Parkring 12, 1010 Wien, Austria',
    addressCountry: 'AT',
    url: 'https://www.viennale.at',
    description:
      'Die Viennale ist Österreichs größtes internationales Filmfestival mit neuen Filmen aus aller Welt, Retrospektive und Gästen in fünf Wiener Kinos.',
    image:
      'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1600&q=85&auto=format&fit=crop',
  },
};
