import type { FestivalPost } from '../types';

// Termine, Rennprogramm, Ticketpreise, Anreise, Streckendaten, Zuschauer und Chronik geprüft am
// 2026-10-27 gegen hahnenkamm.com (Startseite, /rennen-2027/sportprogramm-2027/,
// /rennen-2027/ticket-shop/, /rennen-2027/fragen-antworten/, /rennstrecken/die-streif-abfahrt/,
// /wissenswertes/hkr-die-chronik/, /en/news/thank-you-to-87-000-fans/). Sieger 2026 laut
// AP/SDA via bluewin.ch (Super-G), sportschau.de (Abfahrt) und fis-ski.com (Slalom).
// Vorher falsch: Termin 22. bis 25.1.2026 (Rennen 23. bis 25.1.), "ab 35 € (Tribüne)" (Tribüne
// ab 230 €), Streif 3.312 m und 140 km/h (3.315 m, bis 150 km/h), erstes Rennen als
// "Abfahrtslauf lokaler Skiclubs" (28./29.3.1931 als Internationales Hahnenkamm-Rennen),
// Ziel "in der Innenstadt", Super-G "Freitagnachmittag" (11:30 Uhr), "Race Village" und
// "Siegerempfang im Goldenen Horn" (nicht belegt), Adresse Hahnenkammstrasse 1, "bis zu
// 100.000 Zuschauer" (2026: 87.000), Lineup aus Vorjahres-Favoriten statt belegter Starter.
export const post: FestivalPost = {
  slug: 'hahnenkamm-rennen-kitzbuehel',
  title: 'Hahnenkamm-Rennen Kitzbühel',
  subtitle: 'Die legendäre Streif: Ski-Weltcup live erleben',
  heroImage: '/images/blog/hahnenkamm-rennen-kitzbuehel/hero.jpg',
  thumbnailImage: '/images/blog/hahnenkamm-rennen-kitzbuehel/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  readingTime: 6,
  excerpt:
    'Das Hahnenkamm-Rennen in Kitzbühel ist die begehrteste Trophäe im alpinen Skisport. Die Streif gilt als die schwierigste Abfahrtspiste der Welt, und das Rahmenprogramm macht Kitzbühel im Januar zur Partystadt.',
  category: 'Sport & Outdoor',
  categoryColor: 'bg-red-600 text-white',
  keyFacts: {
    dates: 'Rennwoche 18. bis 24. Jänner 2027, Rennen 22. bis 24. Jänner (2026: 23. bis 25. Jänner)',
    location: 'Hahnenkamm, Kitzbühel',
    address: 'Zielgelände Hahnenkamm, 6370 Kitzbühel',
    genre: 'Ski-Weltcup, Abfahrt, Slalom, Super-G',
    price: 'Zuschauerbereich 35 € (Fr, So) bzw. 45 € (Sa), Tribüne ab 230 €',
    website: 'https://www.hahnenkamm.com',
    capacity: '87.000 Zuschauer an drei Renntagen (2026)',
    since: '1931',
  },
  lineup: [
    { name: 'Marco Odermatt (SUI)', role: 'headliner', day: 'Freitag', stage: 'Super-G, Streifalm' },
    { name: 'Giovanni Franzoni (ITA)', role: 'headliner', day: 'Samstag', stage: 'Abfahrt, Streif' },
    { name: 'Manuel Feller (AUT)', role: 'headliner', day: 'Sonntag', stage: 'Slalom, Ganslern' },
  ],
  lineupTitle: 'Sieger 2026',
  lineupNote:
    'Die Sieger der 86. Hahnenkamm-Rennen im Jänner 2026. Das Starterfeld für 2027 steht noch nicht fest.',
  intro:
    'Das Hahnenkamm-Rennen in Kitzbühel ist mehr als ein Skirennen, es ist ein Mythos. Seit 1931 stürzen sich die besten Skirennläufer den Hahnenkamm hinunter, auf der Streif warten 3.315 Meter, 860 Höhenmeter und bis zu 150 km/h im Zielschuss. Schon nach rund 8,5 Sekunden kommt die Mausefalle mit Sprüngen bis zu 80 Metern, der Steilhang erreicht 85 Prozent Gefälle. Wer in Kitzbühel gewinnt, hat die Königsdisziplin des alpinen Skisports für sich entschieden. Aber Kitzbühel im Jänner ist auch ein gesellschaftliches Ereignis: Promis, CEOs und Sportfans teilen drei Tage lang die engen Gassen der charmanten Tiroler Altstadt.',
  historyTitle: 'Seit 1931: Die Geschichte der Streif',
  history:
    'Das erste Internationale Hahnenkamm-Rennen fand am 28. und 29. März 1931 statt, mit einer Abfahrt über die Fleckalm und einem Slalom am Hahnenkamm. 1933 und 1934 wurde es aus politischen Gründen nicht ausgeschrieben, von 1938 bis 1945 unterbrach der Zweite Weltkrieg die Rennfolge, 1964, 1988 und 1993 fiel es wegen Schneemangels aus. 1967 war Kitzbühel erstmals Station des neuen Weltcups. Didier Cuche gewann fünfmal in der Gamsstadt, den Streckenrekord auf der Streif hält Fritz Strobl seit 1997 mit 1:51,58 Minuten.',
  whatToExpectTitle: 'Was das Hahnenkamm-Wochenende bietet',
  whatToExpect:
    'Das Rennwochenende umfasst den Super-G auf der Streifalm (Freitag), die legendäre Streif-Abfahrt (Samstag) und den Slalom am Ganslernhang (Sonntag). Im Zielgelände gibt es ein Unterhaltungsprogramm, am Freitag und Samstag abends Siegerehrungen mit Lichtershow. Vom Zielgelände aus sieht man die letzten rund 35 Fahrsekunden ab der Hausbergkante live, Videowände zeigen die übrige Strecke.',
  whatToExpectList: [
    'Super-G auf der Streifalm: Freitag, 22. Jänner 2027, 11:30 Uhr',
    'Streif-Abfahrt: Samstag, 23. Jänner 2027, 11:30 Uhr',
    'Slalom am Ganslern: Sonntag, 24. Jänner 2027, 10:30 und 13:30 Uhr',
    'Siegerehrungen am Freitag und Samstag um 18:30 Uhr im Zielgelände, ohne Ticket',
    'Abfahrtstrainings ab Dienstag und Nachwuchsrennen der Future Hahnenkamm Champions',
    'Après-Ski und Partys in den Kitzbüheler Bars und Clubs',
  ],
  practicalInfoTitle: 'So kommst du zum Hahnenkamm-Rennen',
  practicalInfo: [
    {
      icon: '🎿',
      label: 'Tickets',
      text: 'Tickets nur im Vorverkauf unter hahnenkamm.com, keine Tageskasse. Allgemeiner Zuschauerbereich 35 € am Freitag und Sonntag, 45 € am Samstag; Zonen- und Tribünentickets kosten mehr. Jahrgang 2009 und jünger frei mit Lichtbildausweis.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Mit dem Zug bis zur Haltestelle Kitzbühel Hahnenkamm, von dort rund zwei Gehminuten ins Zielgelände. Gratis-Shuttle der ÖBB zwischen St. Johann und Kirchberg. Mit dem Auto: Großparkplätze in Oberndorf, Kirchberg und Kitzbühel Süd, am Samstag bis spätestens 9 Uhr.',
    },
    {
      icon: '🧥',
      label: 'Ausrüstung',
      text: 'Jänner in Kitzbühel: Thermounterwäsche, Handschuhe und Sonnenbrille für Stehplätze im Freien empfohlen.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Hotels in Kitzbühel für das Rennwochenende sehr früh buchen. Alternativen: Wörgl, St. Johann, Fieberbrunn.',
    },
  ],
  gallery: [],
  ctaText: 'Wintersport-Events in Tirol entdecken',
  ctaLink: '/map?bundesland=Tirol&category=Sport',
  seoTitle: 'Hahnenkamm-Rennen Kitzbühel 2027: Tickets & Tipps',
  seoDescription:
    'Hahnenkamm-Rennen Kitzbühel von 22. bis 24. Jänner 2027: Super-G, Streif-Abfahrt und Slalom. Tickets, Programm, Anreise und Tipps für das berühmteste Skirennen der Welt.',
  keywords: [
    'Hahnenkamm Rennen 2027',
    'Kitzbühel Skirennen',
    'Streif Abfahrt Kitzbühel',
    'Ski Weltcup Kitzbühel',
    'Hahnenkamm Tickets',
    'Kitzbühel Jänner 2027',
    'Ski Weltcup Tirol',
    'Kitzbühel Rennen Programm',
    'Streif Kitzbühel',
    'FIS Weltcup Österreich',
  ],
  jsonLdEvent: {
    name: 'Hahnenkamm-Rennen Kitzbühel 2027',
    startDate: '2027-01-22',
    endDate: '2027-01-24',
    location: 'Zielgelände Hahnenkamm, 6370 Kitzbühel, Austria',
    addressCountry: 'AT',
    url: 'https://www.hahnenkamm.com',
    description:
      'Das Hahnenkamm-Rennen ist der berühmteste Ski-Weltcup der Welt mit der legendären Streif-Abfahrt in Kitzbühel, Tirol.',
    image:
      'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1600&q=85&auto=format&fit=crop',
  },
};
