import type { FestivalPost } from '../types';

// Konzertreihen, Termine, Adresse und Geschichte geprüft am 2026-10-27 gegen esterhazy.at
// (Startseite, /classic-esterhazy, /schloss-esterhazy), herbstgold.at (Festival 2027),
// falter.at/festival/24237/herbstgold-2026 (16. bis 26.09.2026), berliner-philharmoniker.de
// (Europakonzert 01.05.2026 im Haydnsaal) und en.wikipedia.org/wiki/Schloss_Esterházy
// (Bauphase 1663 bis 1672). Vorher falsch: Website schloss-esterhazy.at existiert nicht;
// „Haydn Festspiele“ im September heißen seit Jahren Herbstgold; „Haydn Philharmoniker“ und
// „Ensemble Sonare Eisenstadt“ nicht im Programm (Residenzorchester ist das Chamber Orchestra
// of Europe); Saison „Mai bis Oktober“ (Konzerte ganzjährig), „seit 1756“, Preise ab 25/45 €,
// Rohrau „ca. 20 km“, Bahn ab „Wien Südbahnhof“ und Uraufführungen im Haydnsaal ohne Beleg.
export const post: FestivalPost = {
  slug: 'esterhazy-konzerte',
  title: 'Schloss Esterházy Konzerte 2026/27',
  subtitle: 'Haydns Heimat klingt wieder: Barockpracht im Herzen Eisenstadts',
  heroImage: '/images/blog/esterhazy-konzerte/hero.jpg',
  thumbnailImage: '/images/blog/esterhazy-konzerte/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://esterhazy.at/classic-esterhazy',
      'https://www.herbstgold.at/',
      'https://www.falter.at/festival/24237/herbstgold-2026',
      'https://en.wikipedia.org/wiki/Schloss_Esterh%C3%A1zy',
    ],
  },
  readingTime: 5,
  excerpt:
    'Im prachtvollen Haydnsaal des Schlosses Esterházy in Eisenstadt erklingt Musik in einem der schönsten Konzertsäle Österreichs. Die Reihe classic.Esterhazy, das Festival Herbstgold im September und das Chamber Orchestra of Europe als Residenzorchester machen das Burgenland zum Klangmittelpunkt.',
  category: 'Kultur & Bühne',
  categoryColor: 'bg-amber-700 text-white',
  keyFacts: {
    dates: 'Ganzjährig. Herbstgold 2027: 15. bis 26. September 2027; Keys to Heaven: 22. bis 25. April 2027',
    location: 'Schloss Esterházy, Haydnsaal und Empiresaal, Eisenstadt',
    address: 'Esterházyplatz 1, 7000 Eisenstadt',
    genre: 'Klassik, Orchester, Kammermusik, Klavier, Haydn',
    price: 'Preise je Konzert auf esterhazy.at; Herbstgold bis 31.12. mit 20 % Frühbucherrabatt',
    website: 'https://esterhazy.at/classic-esterhazy',
  },
  lineup: [
    { name: 'Berliner Philharmoniker, Europakonzert mit Kirill Petrenko', role: 'headliner', day: '1. Mai 2026', stage: 'Haydnsaal' },
    { name: 'Herbstgold Festival (Intendant Julian Rachlin)', role: 'headliner', day: '16. bis 26. September 2026' },
    { name: 'Chamber Orchestra of Europe, Sir Antonio Pappano, Alexandre Kantorow: „Große Romantik“', role: 'headliner', day: '7. November 2026, 19.30 Uhr' },
    { name: 'Pannonische Weihnachtsgala', role: 'special', day: '17. Dezember 2026' },
    { name: 'Herbstgold 2027', role: 'headliner', day: '15. bis 26. September 2027', stage: 'Haydnsaal' },
  ],
  lineupTitle: 'Programm-Highlights',
  lineupNote: 'Weitere Termine der Reihe classic.Esterhazy und das Konzertprogramm 2027 auf esterhazy.at.',
  intro:
    'Wer das Burgenland besucht und Klassikmusik liebt, kommt am Schloss Esterházy in Eisenstadt nicht vorbei. Der legendäre Haydnsaal, eines der beeindruckendsten Barockinterieurs Österreichs, war über 30 Jahre lang die Wirkungsstätte von Joseph Haydn, dem Vater der Sinfonie und des Streichquartetts. Heute erklingt in denselben Gemäuern Musik von Weltrang: Die Reihe classic.Esterhazy mit dem Chamber Orchestra of Europe als Residenzorchester und das Festival Herbstgold im September machen Eisenstadt zu einem Ziel für Klassikliebhaber aus aller Welt. Am 1. Mai 2026 spielten die Berliner Philharmoniker hier erstmals ihr Europakonzert.',
  historyTitle: 'Joseph Haydn und das Fürstenhaus Esterházy',
  history:
    'Joseph Haydn diente dem Fürsten Nikolaus I. Esterházy ab 1766 als Kapellmeister und schrieb in Eisenstadt und Schloss Esterháza einige seiner bedeutendsten Werke. Der Haydnsaal entstand in der barocken Bauphase des Schlosses von 1663 bis 1672 als Fest- und Bankettsaal und trägt heute den Namen des Komponisten, dessen Musik hier erklang. Heute ist das Schloss Esterházy ein Zentrum für Kulturtourismus und klassische Musik und bewahrt mit Konzerten und Festivals das musikalische Erbe Haydns.',
  whatToExpectTitle: 'Musik in einem Weltkultursaal',
  whatToExpect:
    'Das Konzertjahr im Schloss Esterházy ruht auf mehreren Säulen: Die ganzjährige Reihe classic.Esterhazy bringt unter anderem vier Abende des Chamber Orchestra of Europe im Haydnsaal und einen Klavier-Schwerpunkt. 2027 lädt im April das Klavierfestival Keys to Heaven, im September das von Julian Rachlin geleitete Festival Herbstgold mit Oper, Lied, Orchester- und Kammermusik, Jazz und Weltmusik. Der Haydnsaal selbst ist dabei ein Erlebnis für alle Sinne: Die goldverzierte Decke, das historische Freskenprogramm und die gerühmte Akustik machen jedes Konzert besonders.',
  whatToExpectList: [
    'Konzerte im historischen Haydnsaal mit Originalfresken',
    'Festival Herbstgold im September mit internationalem Programm',
    'Klavierfestival Keys to Heaven, 2027 vom 22. bis 25. April',
    'Führungen durch das Schloss, etwa die Sonderführung „Wein & Esterházy“',
    'Chamber Orchestra of Europe als Residenzorchester',
    'Haydns Geburtshaus in Rohrau (Niederösterreich) als Ausflugsziel',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🚂',
      label: 'Anreise mit der Bahn',
      text: 'Züge aus Wien fahren nach Eisenstadt, vom Bahnhof geht es zu Fuß durch die Innenstadt zum Schloss. Zu Herbstgold fährt ein Shuttlebus von und nach Wien.',
    },
    {
      icon: '🚗',
      label: 'Anreise mit dem Auto',
      text: 'Über A3 Abfahrt Eisenstadt, Parkplätze am Schlossplatz und in der Innenstadt vorhanden.',
    },
    {
      icon: '👔',
      label: 'Kleiderordnung',
      text: 'Konzerte im Haydnsaal: Abendgarderobe oder elegante Kleidung erwünscht.',
    },
    {
      icon: '🍷',
      label: 'Kulinarik',
      text: 'Eisenstadt bietet ausgezeichnete Weinstuben und Restaurants in der Schloss-Nähe.',
    },
  ],
  gallery: [],
  ctaText: 'Klassik-Events im Burgenland entdecken',
  ctaLink: '/map?bundesland=Burgenland&category=Kultur',
  seoTitle: 'Schloss Esterházy Konzerte: Herbstgold 2027 und classic.Esterhazy',
  seoDescription:
    'Konzerte im Haydnsaal von Schloss Esterházy in Eisenstadt: Herbstgold 15. bis 26. September 2027, classic.Esterhazy mit dem Chamber Orchestra of Europe.',
  keywords: [
    'Schloss Esterházy Konzerte',
    'Herbstgold Eisenstadt',
    'Haydnsaal Eisenstadt',
    'Klassik Burgenland',
    'Joseph Haydn Eisenstadt',
    'Konzert Schloss Esterházy',
    'classic.Esterhazy',
    'Kulturveranstaltung Burgenland',
    'Herbstgold 2027',
  ],
  jsonLdEvent: {
    name: 'Herbstgold Festival 2027',
    startDate: '2027-09-15',
    endDate: '2027-09-26',
    location: 'Schloss Esterházy, Haydnsaal, Esterházyplatz 1, 7000 Eisenstadt, Austria',
    addressCountry: 'AT',
    url: 'https://www.herbstgold.at/',
    description:
      'Herbstgold ist das Festival im Schloss Esterházy in Eisenstadt unter der Intendanz von Julian Rachlin, mit Konzerten vor allem im historischen Haydnsaal.',
    image:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&q=85&auto=format&fit=crop',
  },
};
