import type { FestivalPost } from '../types';

// Termine, Formate, Teilnehmerzahl, Vortragende, Preise, Anreise und Geschichte geprüft am
// 2026-10-27 gegen alpbach.org (Startseite, /efa26, /blog/efa26-highlights, /about/purpose-history,
// /event/service, /tickets, /blog/scholarship-programme). Vorher falsch: Termin 14.8. bis 5.9.2026
// (tatsächlich 24.8. bis 4.9.2026), "drei Wochen" mit Technologie- und Gesundheitsgesprächen
// (EFA26: Academy, Euregio und Conference Days), erfundenes Lineup (EU-Kommissionspräsidentin,
// "Nobelpreisträger", "Klimaforscher IPCC"), "ca. 5.000 Teilnehmer" (2026: 4.800), Otto Molden
// als "Soziologe" (damals Student), "Kongresshaus", Anreise per Postbus ab Innsbruck und B169,
// "Akkreditierung" statt Tickets, "über 200 Referenten" und Gespräche am "Hochplateau" (unbelegt).
export const post: FestivalPost = {
  slug: 'europaeisches-forum-alpbach',
  title: 'Europäisches Forum Alpbach',
  subtitle: 'Wo Wissenschaft, Politik und Gesellschaft in den Tiroler Alpen zusammenkommen',
  heroImage: '/images/blog/europaeisches-forum-alpbach/hero.jpg',
  thumbnailImage: '/images/blog/europaeisches-forum-alpbach/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.alpbach.org/efa26',
      'https://www.alpbach.org/tickets',
      'https://www.alpbach.org/blog/efa26-highlights',
      'https://www.alpbach.org/about/purpose-history',
      'https://www.alpbach.org/event/service',
      'https://www.alpbach.org',
    ],
  },
  readingTime: 7,
  excerpt:
    'Das Europäische Forum Alpbach versammelt jedes Jahr im August Politik, Wissenschaft, Wirtschaft und junge Menschen aus ganz Europa im kleinen Tiroler Bergdorf Alpbach. Rund zwei Wochen Austausch über Europas Zukunft.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-blue-800 text-white',
  keyFacts: {
    dates: '23. August bis 3. September 2027 (Conference Days ab 29. August). 2026: 24. August bis 4. September',
    location: 'Congress Centrum Alpbach, Alpbach',
    address: 'Alpbach 246, 6236 Alpbach',
    genre: 'Kongress, Wissenschaft, Politik, Gesellschaft, Kultur',
    price: 'Academy Days oder Conference Days je 1.300 €, Tagesticket 600 €, Euregio Days frei; Stipendien für 18- bis 30-Jährige',
    website: 'https://www.alpbach.org',
    capacity: 'rund 4.800 Teilnehmende (2026)',
    since: '1945',
  },
  lineup: [
    { name: 'Alexander Van der Bellen', role: 'headliner', stage: 'EFA26' },
    { name: 'Carl Bildt', role: 'headliner', stage: 'EFA26' },
    { name: 'Mairéad McGuinness', role: 'special', stage: 'EFA26' },
    { name: 'Magnus Brunner', role: 'special', stage: 'EFA26' },
    { name: 'Ivan Krastev', role: 'special', stage: 'EFA26' },
    { name: 'Maria Kalesnikava', role: 'special', stage: 'EFA26' },
  ],
  lineupTitle: 'Vortragende 2026 (Auswahl)',
  lineupNote:
    'Auswahl der Vortragenden beim Forum 2026 laut alpbach.org. Das Programm 2027 ist noch nicht veröffentlicht. Bewerbungen für die Stipendien 2027 sind ab März 2027 möglich.',
  intro:
    'Es gibt wenige Orte der Welt, an denen ein Dorfplatz gleichzeitig Staatschefs, Forschende, Studierende und Aktivisten beherbergt. Alpbach in Tirol ist einer davon. Das Europäische Forum Alpbach entstand 1945, in den unmittelbaren Nachkriegsmonaten, als Internationale Hochschulwochen, um den Dialog über eine bessere europäische Ordnung zu beginnen. Seitdem ist das Forum gewachsen, aber seinen Charakter behalten: Es ist offen, interdisziplinär, und trotz seiner hochkarätigen Teilnehmerliste erstaunlich zugänglich. Der Ort selbst, ein kleines Tiroler Bergdorf, trägt zum besonderen Geist des Forums bei.',
  historyTitle: 'Seit 1945: Europa neu denken in den Bergen',
  history:
    'Das Europäische Forum Alpbach wurde 1945 von Otto Molden, damals Student in Wien, und Simon Moser, damals Philosophie-Dozent in Innsbruck, als Internationale Hochschulwochen gegründet. Unter den ersten Teilnehmenden waren vor allem junge Menschen, die im Widerstand gegen den Nationalsozialismus aktiv gewesen waren; die französische Besatzungsmacht und der erste Tiroler Landeshauptmann Karl Gruber unterstützten die Idee. Molden ging es um eine geistige Erneuerung und politische Einigung Europas, Moser um neue Strukturen an den Universitäten und den Austausch zwischen den Fächern. Seit 1949 heißt die Veranstaltung Europäisches Forum Alpbach.',
  whatToExpectTitle: 'Was das Forum Alpbach bietet',
  whatToExpect:
    'Das Forum 2026 stand unter dem Motto „How Europe Wins“ und gliederte sich in drei Teile: die Academy Days mit Seminaren, Labs und Studios, die Euregio Days zur grenzüberschreitenden Zusammenarbeit der Regionen und die Conference Days mit einem Fokusthema pro Tag auf der Hauptbühne. Dazu kommen Networking-Events und informelle Gespräche im Dorf.',
  whatToExpectList: [
    'Academy Days: Seminare, dreitägige Labs mit 30 Teilnehmenden und Studios',
    'Euregio Days: grenzüberschreitende Zusammenarbeit der Regionen, freier Eintritt',
    'Conference Days: Hauptbühne mit Politik, Wirtschaft und Wissenschaft',
    'Themen 2026: Klima, Finanzen und Wirtschaft, Sicherheit, Demokratie und Rechtsstaat, Kunst und Kultur',
    '2026: 700 Stipendiatinnen und Stipendiaten aus über 6.000 Bewerbungen',
    'Networking-Events und informelle Gespräche im Dorf',
  ],
  practicalInfoTitle: 'So nimmt man am Forum Alpbach teil',
  practicalInfo: [
    {
      icon: '📋',
      label: 'Tickets & Stipendien',
      text: 'Tickets unter alpbach.org: Academy Days oder Conference Days je 1.300 €, Tagesticket 600 €, Euregio Days frei. Early-Bird-Gutschein für 2027 bis 15. November 2026. Stipendien für 18- bis 30-Jährige decken Teilnahme und Unterkunft.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Mit dem Zug nach Brixlegg (oder Jenbach und weiter nach Brixlegg), dann mit dem Bus 620 oder dem Shuttle bis zur Haltestelle Alpbach Böglerhof/CCA. Mit Ticket oder Unterkunftsbestätigung sind die Regionalbusse gratis.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Alpbach ist ein kleines Dorf, Hotels und Gasthäuser früh buchen. Nach dem Ticketkauf gibt es Zugang zur Zimmerbörse mit Alpbach Tourismus, für 2027 ab April 2027. Ausweichorte: Brixlegg und Reith.',
    },
    {
      icon: '🌄',
      label: 'Bergwanderung',
      text: 'Die Wanderwege rund um das Bergdorf sind ein besonderes Plus für Pausen zwischen den Programmpunkten.',
    },
  ],
  gallery: [],
  ctaText: 'Kulturveranstaltungen in Tirol entdecken',
  ctaLink: '/map?bundesland=Tirol&category=Kultur',
  seoTitle: 'Europäisches Forum Alpbach 2027: Termin, Programm & Infos',
  seoDescription:
    'Europäisches Forum Alpbach von 23. August bis 3. September 2027: Wissenschaft, Politik & Gesellschaft im Tiroler Bergdorf. Tickets, Stipendien und Anreise-Tipps.',
  keywords: [
    'Europäisches Forum Alpbach 2027',
    'Forum Alpbach Programm',
    'Alpbach Kongress Tirol',
    'European Forum Alpbach',
    'Stipendium Alpbach Forum',
    'Wissenschaftskongress Österreich',
    'Alpbach August 2027',
    'Politisches Forum Tirol',
    'alpbach.org',
    'Europa Forum Alpbach',
  ],
  jsonLdEvent: {
    name: 'Europäisches Forum Alpbach 2027',
    startDate: '2027-08-23',
    endDate: '2027-09-03',
    location: 'Congress Centrum Alpbach, Alpbach 246, 6236 Alpbach, Austria',
    addressCountry: 'AT',
    url: 'https://www.alpbach.org',
    description:
      'Das Europäische Forum Alpbach ist ein jährliches interdisziplinäres Forum in Tirol, das Wissenschaftler, Politiker, Unternehmer und Studierende aus aller Welt zusammenbringt.',
    image:
      'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1600&q=85&auto=format&fit=crop',
  },
};
