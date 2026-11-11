import type { FestivalPost } from '../types';

// Bestand geprüft am 2026-10-27: feldkirchfestival.at leitet per 301 auf
// feldkirch.at/entdecken/kulturangebote/ weiter, dort kein Festival. Geschichte und Ende laut
// vol.at/feldkirch-festival-muss-pausieren/3391514 (APA, 23.10.2012: Ruhendstellung der
// Feldkirch Festival GmbH) und austria-forum.org/af/AustriaWiki/Feldkirchfestival.
// Vorher stand hier ein erfundenes Festival: Termin 7. bis 10. Mai 2026, Gründung 1999,
// Chorfestival mit Collegium Vocale Gent, Vox Luminis und ORF-Chor, ca. 3.000 Besucher,
// Website feldkirchfestival.at. Das Festival lief 2001 bis 2012 und ruht seither; Post
// deshalb als Rückblick neu geschrieben, ohne Event-Schema.
export const post: FestivalPost = {
  slug: 'feldkirch-festival',
  title: 'Feldkirch Festival',
  subtitle: 'Was aus dem Festival in Feldkirch wurde: 2001 bis 2012, seither ruhend',
  heroImage: '/images/blog/feldkirch-festival/hero.jpg',
  thumbnailImage: '/images/blog/feldkirch-festival/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.vol.at/feldkirch-festival-muss-pausieren/3391514',
      'https://www.feldkirch.at/entdecken/kulturangebote/',
      'https://austria-forum.org/af/AustriaWiki/Feldkirchfestival',
    ],
  },
  readingTime: 4,
  excerpt:
    'Das Feldkirch Festival gibt es nicht mehr. Von 2001 bis 2012 brachte es meist im Juni Konzerte und Theater nach Feldkirch. Seit Oktober 2012 ruht die Festivalgesellschaft, einen Termin 2026 gibt es nicht.',
  category: 'Musik',
  categoryColor: 'bg-amber-700 text-white',
  keyFacts: {
    dates: 'Kein Termin 2026: Das Festival fand von 2001 bis 2012 statt und ruht seither',
    location: 'Feldkirch, Vorarlberg (Hauptspielstätte war das Montforthaus)',
    address: '6800 Feldkirch',
    genre: 'Alte Musik, Musik des 20. und 21. Jahrhunderts, Theater (2001 bis 2012)',
    price: 'entfällt, kein Festival 2026',
    website: 'https://www.feldkirch.at/entdecken/kulturangebote/',
  },
  lineup: [],
  intro:
    'Wer heute nach dem Feldkirch Festival sucht, findet kein aktuelles Programm. Das Festival brachte von 2001 bis 2012 jedes Jahr, meist im Juni, Konzerte, Theater und weitere Veranstaltungen nach Feldkirch. Im Oktober 2012 beschloss die Generalversammlung der Feldkirch Festival GmbH, die Gesellschaft ruhen zu lassen. Seither gab es kein Festival unter diesem Namen mehr, die frühere Website leitet heute auf die Kulturseite der Stadt Feldkirch weiter.',
  historyTitle: 'Von 2001 bis 2012: Das Feldkirch Festival',
  history:
    'Das Feldkirch Festival folgte auf die Schubertiade, die von 1991 bis 2000 in Feldkirch stattgefunden hatte, und startete 2001. Erster künstlerischer Leiter war der Dirigent Thomas Hengelbrock (bis 2006), mit einem Schwerpunkt auf Alter Musik auf historischen Instrumenten. Ab 2007 leitete der Regisseur Philippe Arlaud das Festival und rückte Musik des 20. und 21. Jahrhunderts in den Mittelpunkt. Jedes Jahr hatte ein eigenes Motto, etwa "Amadeus!" (2006), "Feldkirch hört Russisch" (2010) oder "Sagen-haftes aus Finnland und Norwegen" (2012). Die letzte Ausgabe lief vom 6. bis 17. Juni 2012.',
  whatToExpectTitle: 'Warum es kein Festival 2026 gibt',
  whatToExpect:
    'Als Grund für die Pause nannte die Stadt 2012 den Abbruch und Neubau des Montforthauses, der Hauptspielstätte des Festivals. Die Auslastung war zuletzt auf 75 Prozent gesunken, Stadt und Land hatten jährlich rund 600.000 Euro beigesteuert. Die zunächst auf zwei Jahre angelegte Pause bedeutete de facto das Ende. Als Nachfolgeveranstaltung gelten die Montforter Zwischentöne, die es seit 2015 gibt.',
  whatToExpectList: [
    '2001: erstes Feldkirch Festival, Nachfolger der Schubertiade in Feldkirch',
    '2001 bis 2006: künstlerische Leitung Thomas Hengelbrock',
    '2007 bis 2012: künstlerische Leitung Philippe Arlaud',
    '6. bis 17. Juni 2012: letzte Ausgabe',
    'Oktober 2012: Ruhendstellung der Feldkirch Festival GmbH',
    'Seit 2015: Montforter Zwischentöne als Nachfolgeveranstaltung',
  ],
  practicalInfoTitle: 'Kultur in Feldkirch heute',
  practicalInfo: [
    {
      icon: '🎼',
      label: 'Montforter Zwischentöne',
      text: 'Die Nachfolgeveranstaltung des Feldkirch Festivals veröffentlicht ihr Programm auf montforterzwischentoene.at.',
    },
    {
      icon: '📅',
      label: 'Veranstaltungskalender',
      text: 'Aktuelle Konzerte und Kulturtermine in Feldkirch listet Stadtmarketing und Tourismus Feldkirch auf feldkirch-leben.at.',
    },
    {
      icon: '🏰',
      label: 'Altstadt erkunden',
      text: 'Feldkirch ist einer der schönsten Altstadtorte Vorarlbergs. Ein Spaziergang durch die mittelalterlichen Gassen und hinauf zur Schattenburg lohnt sich auch ohne Festival.',
    },
  ],
  gallery: [],
  ctaText: 'Kulturevents in Vorarlberg entdecken',
  ctaLink: '/map?bundesland=Vorarlberg&category=Musik',
  seoTitle: 'Feldkirch Festival: Was aus dem Festival wurde (2001 bis 2012)',
  seoDescription:
    'Das Feldkirch Festival fand von 2001 bis 2012 statt und ruht seither. Geschichte, künstlerische Leitung und die Nachfolgeveranstaltung Montforter Zwischentöne.',
  keywords: [
    'Feldkirch Festival',
    'Feldkirch Festival 2026',
    'Feldkirch Festival Geschichte',
    'Montforter Zwischentöne',
    'Thomas Hengelbrock Feldkirch',
    'Schubertiade Feldkirch',
    'Montforthaus Feldkirch',
    'Kultur Feldkirch',
    'Vorarlberg Klassik Festival',
  ],
};
