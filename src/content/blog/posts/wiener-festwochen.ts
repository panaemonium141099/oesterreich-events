import type { FestivalPost } from '../types';

// Termine, Spielorte, Eröffnung, Preise, Zahlen, Adresse und Geschichte geprüft am
// 2026-10-28 gegen festwochen.at: /programm/produktionen (im Browser, Zeitraum
// 15. Mai bis 21. Juni 2026, Spielorte), /eroeffnung-2026 (22. Mai, Heldenplatz, freier
// Eintritt), /mythen-des-alltags (Preise 4 bis 55 Euro), /en/vienna-festival-in-numbers
// (38 Tage, 35 Produktionen, 170 Vorstellungen, 89 Gratis-Veranstaltungen, 35 Spielorte),
// /impressum (Lehárgasse 11/1/6, 1060 Wien; Intendant Milo Rau), /en/75-years-vienna-festival
// (Gründung 1951), /en/join-the-peoples-republic (2027 ohne Termin); Intendanz-Jahre laut
// de.wikipedia.org/wiki/Wiener_Festwochen. Falsch waren: „über 100 Produktionen“ und
// „sechs Wochen“ (2026: 35 Produktionen mit Eintritt, 38 Tage), „Tickets ab ca. 15 Euro“,
// „Eröffnungskonzert am Rathausplatz“ (2026 Heldenplatz), „Festwochen Junior“, Spielorte
// Prater/Stadtpark, „Festival of Resistance ab 2021“ (Milo Rau ist seit 2024 Intendant),
// „von der Stadt Wien gegründet“ (nicht belegt) und jsonLd 8. Mai bis 21. Juni 2026.
// Termin 2027 ist noch nicht veröffentlicht.
export const post: FestivalPost = {
  slug: 'wiener-festwochen',
  title: 'Wiener Festwochen',
  subtitle: 'Internationales Festival für Musik, Theater und Performance im Mai und Juni',
  heroImage: '/images/blog/wiener-festwochen/hero.jpg',
  thumbnailImage: '/images/blog/wiener-festwochen/thumb.jpg',
  publishDate: '2026-03-31',
  updatedDate: '2026-10-28',
  factSources: {
    checkedAt: '2026-10-28',
    urls: [
      'https://www.festwochen.at/programm/produktionen',
      'https://www.festwochen.at/en/vienna-festival-in-numbers',
      'https://www.festwochen.at/impressum',
      'https://www.festwochen.at/mythen-des-alltags',
      'https://www.festwochen.at/eroeffnung-2026',
      'https://de.wikipedia.org/wiki/Wiener_Festwochen',
      'https://www.festwochen.at/en/join-the-peoples-republic',
    ],
  },
  readingTime: 6,
  excerpt:
    'Jedes Jahr im Mai und Juni bespielen die Wiener Festwochen Theater, Hallen und Plätze in ganz Wien. 2026 feierte das Festival vom 15. Mai bis 21. Juni sein 75-Jahr-Jubiläum, die Termine 2027 folgen.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-teal-700 text-white',
  keyFacts: {
    dates: '2026: 15. Mai bis 21. Juni (Eröffnung am 22. Mai). Termine 2027 folgen',
    location: 'Rund 35 Spielorte in ganz Wien (2026 u. a. Volkstheater, Odeon, Akademietheater, MuseumsQuartier, Festivalzentrum am Badeschiff)',
    address: 'Büro: Lehárgasse 11/1/6, 1060 Wien',
    genre: 'Oper, Musiktheater, Theater, Tanz, Performance, Konzert',
    price: 'je nach Produktion (2026 z. B. Volkstheater: 4 Euro Stehplatz bis 55 Euro) | Eröffnung und viele Formate bei freiem Eintritt',
    website: 'https://www.festwochen.at',
    capacity: '2026: 35 Produktionen mit Eintritt, 170 Vorstellungen, 89 Veranstaltungen bei freiem Eintritt',
    since: '1951',
  },
  lineup: [],
  intro:
    'Seit 1951 gehören die Wiener Festwochen zum Wiener Frühsommer. Jedes Jahr im Mai und Juni bringen Regisseurinnen, Choreografen und Musikerinnen aus aller Welt ihre Produktionen auf die Bühnen der Stadt, vom Musiktheater im Odeon bis zur Performance in einer Halle des MuseumsQuartiers. 2026 feierte das Festival unter dem Motto „Republic of Gods“ sein 75-Jahr-Jubiläum, mit einer Eröffnung bei freiem Eintritt am Heldenplatz.',
  historyTitle: '75 Jahre Festwochen',
  history:
    'Erste Festwochen-Veranstaltungen gab es bereits 1927; 1951, noch in der Besatzungszeit, wurden die Wiener Festwochen neu begründet. Seither hat sich das Festival immer stärker für internationale Gastspiele und Koproduktionen geöffnet. Geprägt haben es Intendanten wie Klaus Bachler (1991 bis 1996), Luc Bondy (2002 bis 2013), Markus Hinterhäuser (2014 bis 2016) und Christophe Slagmuylder (2019 bis 2023). Seit 2024 leitet Milo Rau die Festwochen; im ersten Jahr rief er die „Freie Republik Wien“ aus, 2026 folgte das Jubiläumsprogramm „Republic of Gods“.',
  whatToExpectTitle: 'Was erwartet dich bei den Festwochen?',
  whatToExpect:
    'Das Programm reicht von Oper und Musiktheater über Schauspiel und Tanz bis zu Performance, Konzert, Film und Debatte. Den Kern bilden Eigen- und Koproduktionen sowie Uraufführungen. Dazu kommen Formate bei freiem Eintritt, vor allem rund um das Festivalzentrum, das 2026 als „Haus der Republik“ am Badeschiff lag.',
  whatToExpectList: [
    '2026: 35 Produktionen mit Eintritt, davon 13 Uraufführungen',
    '21 Eigen- und Koproduktionen im Jubiläumsjahr 2026',
    'Eröffnung bei freiem Eintritt, 2026 am Heldenplatz mit Patti Smith, übertragen von ORF 2 und 3sat',
    'Festivalzentrum mit Konzerten, Partys und Debatten, vieles bei freiem Eintritt',
    'Spielorte 2026 u. a. Volkstheater, Odeon, Akademietheater, Schauspielhaus und MuseumsQuartier',
    'Workshops für Kinder und Jugendliche, Filmreihen und Gespräche',
  ],
  practicalInfoTitle: 'Praktische Infos zu den Wiener Festwochen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Karten gibt es über festwochen.at, die Preise hängen von Produktion und Spielort ab. Viele Vorstellungen sind ausverkauft: 2026 waren es 119 von 170.',
    },
    {
      icon: '🆓',
      label: 'Gratis-Events',
      text: 'Die Eröffnung und viele Formate im Festivalzentrum, etwa Konzerte, Partys und Debatten, sind bei freiem Eintritt.',
    },
    {
      icon: '🚇',
      label: 'Anreise',
      text: 'Die Spielorte liegen über die ganze Stadt verteilt; welche es sind, steht bei jeder Produktion auf festwochen.at.',
    },
    {
      icon: '📅',
      label: 'Programm 2027',
      text: 'Termine und Programm 2027 sind noch nicht veröffentlicht. Sobald sie feststehen, früh buchen: gefragte Produktionen sind rasch vergriffen.',
    },
  ],
  gallery: [],
  ctaText: 'Theater- und Kultur-Events in Wien',
  ctaLink: '/map?category=Kultur&region=Wien',
  seoTitle: 'Wiener Festwochen: Programm, Tickets & Infos',
  seoDescription:
    'Wiener Festwochen: jedes Jahr im Mai und Juni internationales Theater, Musiktheater, Tanz und Performance in Wien. Rückblick 2026, Tickets und Gratis-Formate.',
  keywords: [
    'Wiener Festwochen',
    'Festwochen Wien 2026',
    'Theater Festival Wien',
    'Wien Kultur Mai',
    'Milo Rau Festwochen',
    'Vienna Festival Weeks',
    'Festwochen Programm',
    'Wien Theaterkultur',
    'Festwochen Tickets',
    'Wien Kultur Juni',
  ],
  jsonLdEvent: {
    name: 'Wiener Festwochen 2026',
    startDate: '2026-05-15',
    endDate: '2026-06-21',
    location: 'Wien, Austria',
    addressCountry: 'AT',
    url: 'https://www.festwochen.at',
    description:
      'Die Wiener Festwochen sind Wiens internationales Festival für Musik, Theater und Performance; 2026 mit 35 Produktionen mit Eintritt an rund 35 Spielorten.',
    image:
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1600&q=85&auto=format&fit=crop',
  },
};
