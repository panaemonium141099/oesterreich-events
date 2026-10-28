import type { FestivalPost } from '../types';

// Termine 2026/2027, Programm, Geschichte und Besucherzahlen geprüft am 2026-10-27 gegen
// bregenzerfestspiele.com (Startseite, /en/festspielzeit/la-traviata-seebuhne,
// /en/festspielzeit/80-years-new-ground), die Festspiel-Presseaussendungen auf pressefoyer.at
// (Provisional attendance figures 2026, Final figures 2026) und
// chronik.bregenzerfestspiele.com/en/tickets-visit/faq. Vorher falsch: Termin 15.7. bis
// 23.8.2026 (richtig 22.7. bis 23.8.), erfundenes Lineup ("Solisten der Staatsoper Wien",
// "Kammeroper-Ensemble", Gastdirigent TBC), erste Seeaufführung "1955" (richtig 1946),
// "Frühstück mit Aussicht" und "Meisterkonzerte" als Festspielformat, Überdachungen auf der
// Seetribüne, Preise "ab 60 €" und Zugzeiten ohne Beleg. Ende 2027: Startseite nennt
// 21. Juli bis 23. August (Browser-Check 2026-10-27), eine Presseaussendung 22. August.
export const post: FestivalPost = {
  slug: 'bregenz-festspiele',
  title: 'Bregenzer Festspiele',
  subtitle: 'Die weltberühmte Seebühne: Oper auf dem Bodensee',
  heroImage: '/images/blog/bregenz-festspiele/hero.jpg',
  thumbnailImage: '/images/blog/bregenz-festspiele/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://bregenzerfestspiele.com/de',
      'https://pressefoyer.at/media/hbinxmzv/2_press-release_provisional-attendance-figures-for-2026.pdf',
      'https://bregenzerfestspiele.com/en/festspielzeit/80-years-new-ground',
      'https://pressefoyer.at/en/news/final-figures-2026/',
      'https://de.wikipedia.org/wiki/Bregenzer_Festspiele',
      'https://chronik.bregenzerfestspiele.com/en/tickets-visit/faq',
      'https://bregenzerfestspiele.com/en/festspielzeit/la-traviata-seebuhne',
    ],
  },
  readingTime: 7,
  excerpt:
    'Die Bregenzer Festspiele sind weltberühmt für ihre spektakuläre Seebühne auf dem Bodensee. Jeden Sommer erlebt das Publikum dort Oper unter freiem Himmel, direkt über dem Wasser.',
  category: 'Musik',
  categoryColor: 'bg-blue-700 text-white',
  keyFacts: {
    dates: '2027: 21. Juli bis 23. August 2027 (2026: 22. Juli bis 23. August)',
    location: 'Seebühne Bregenz (Bodensee), Festspielhaus Bregenz',
    address: 'Platz der Wiener Symphoniker 1, 6900 Bregenz',
    genre: 'Oper, Konzert, Musiktheater',
    price: 'Preis je nach Kategorie, Karten über bregenzerfestspiele.com',
    website: 'https://www.bregenzerfestspiele.com',
    capacity: 'knapp 7.000 Plätze auf der Seetribüne; 2026 rund 275.000 Besucher gesamt',
    since: '1946',
  },
  lineup: [
    { name: 'La traviata (Giuseppe Verdi), Regie Damiano Michieletto', role: 'headliner', stage: 'Seebühne', day: 'ab 22. Juli 2027' },
    { name: 'Penthesilea (Othmar Schoeck), Regie Mariame Clément, Dirigentin Kristiina Poska', role: 'headliner', stage: 'Festspielhaus', day: 'Premiere 21. Juli 2027' },
    { name: 'Wiener Symphoniker mit Domingo Hindoyan, Giedrė Šlekytė und Petr Popelka', role: 'special', stage: 'Festspielhaus', day: '26. Juli, 1. und 8. August 2027' },
    { name: 'Camilla Nylund: The Great American Songbook', role: 'special', day: '22. August 2027' },
  ],
  lineupTitle: 'Programm-Highlights 2027',
  lineupNote:
    'Programm 2027 laut bregenzerfestspiele.com (Stand Oktober 2026). Der Vorverkauf für La traviata 2027 läuft seit 23. August 2026. 2026 waren alle Seevorstellungen schon vor Ostern ausverkauft.',
  intro:
    'Kein Festival in Österreich hat eine Bühne wie die Bregenzer Festspiele. Die Seebühne, die direkt im Bodensee steht, hat eine Tribüne mit knapp 7.000 Plätzen und bietet eine Kulisse, die kein Bühnenbildner der Welt erfinden könnte: Wasser, Berge und der unendliche Abendhimmel über dem Bodensee. Hier werden Opern zu Gesamtkunstwerken, die weit über die Musik hinausgehen: Monumentale Bühnenbilder, Pyrotechnik, Lichtshow und die akustische Perfektion moderner Beschallungstechnik verschmelzen zu einem Erlebnis, das man ein Leben lang nicht vergisst.',
  historyTitle: 'Seit 1946: Eine Bühne, die Operngeschichte schreibt',
  history:
    'Die Bregenzer Festspiele wurden 1946 gegründet, ein Jahr nach dem Ende des Zweiten Weltkriegs. Schon die erste künstlerische Aufführung am 5. August 1946 fand auf dem Wasser statt: Mozarts Singspiel "Bastien und Bastienne" auf zwei aneinandergeketteten Kieskähnen im Gondelhafen. Ab 1950 spielten die Festspiele auf einer Seebühne auf Holzpfählen, 1980 kam das Festspielhaus dazu. Weltberühmt wurde die Seebühne auch durch den James-Bond-Film "Ein Quantum Trost": Im Frühjahr 2008 wurden dort Szenen in der Kulisse der damaligen "Tosca"-Produktion gedreht. Die 80. Saison 2026 brachte mit rund 275.000 Besucherinnen und Besuchern den höchsten Wert seit der Gründung.',
  whatToExpectTitle: 'Was die Festspiele 2027 bieten',
  whatToExpect:
    'Die Produktion auf der Seebühne wechselt alle zwei Jahre. 2027 läuft Verdis "La traviata" in der Inszenierung von Damiano Michieletto zum zweiten Mal, mit Premiere am 22. Juli. 2026 sahen über 193.000 Menschen die 28 ausverkauften Seevorstellungen. Im Festspielhaus eröffnet Othmar Schoecks selten gespielte Oper "Penthesilea" am 21. Juli 2027 die Festspiele. Dazu kommen Orchesterkonzerte der Wiener Symphoniker. 2026 gehörten außerdem Musiktheater auf der Werkstattbühne, das Opernstudio im Theater am Kornmarkt und Kammerkonzerte im Seestudio und im Kunsthaus Bregenz zum Programm.',
  whatToExpectList: [
    'Spiel auf dem See 2027: "La traviata" von Giuseppe Verdi, 28 Abende ab 22. Juli',
    'Oper im Festspielhaus: "Penthesilea" von Othmar Schoeck, Premiere 21. Juli 2027',
    'Orchesterkonzerte der Wiener Symphoniker im Festspielhaus',
    'Musiktheater auf der Werkstattbühne (Programm 2027 folgt)',
    'Opernstudio mit jungen Sängerinnen und Sängern im Theater am Kornmarkt (2026)',
    'Kammerkonzerte im Seestudio und im Kunsthaus Bregenz (2026)',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Karten online unter bregenzerfestspiele.com oder telefonisch unter +43 5574 4076. Der Vorverkauf für La traviata 2027 hat am 23. August 2026 begonnen, 2026 waren alle Seevorstellungen schon vor Ostern ausverkauft. Der Preis hängt von der Kategorie ab.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Bregenz HBF liegt 10 min zu Fuß von der Seebühne entfernt. Die Seeaufführungen beginnen laut Festspielen im Juli um 21:15 Uhr und im August um 21 Uhr.',
    },
    {
      icon: '🌧️',
      label: 'Wetter',
      text: 'Das Spiel auf dem See findet grundsätzlich auch bei Regen statt, die Entscheidung fällt kurz vor Beginn. Was bei einer Absage gilt (Ersatz im Festspielhaus oder Erstattung), hängt von der Kartenkategorie ab und steht in den FAQ der Festspiele. Regenjacke empfehlenswert.',
    },
    {
      icon: '🍽️',
      label: 'Gastronomie',
      text: 'Restaurants und Caféterrassen im Festspielbereich. Reservierung für Abendessen vor der Vorstellung früh vornehmen.',
    },
  ],
  gallery: [],
  ctaText: 'Klassik-Events in Vorarlberg entdecken',
  ctaLink: '/map?bundesland=Vorarlberg&category=Musik',
  seoTitle: 'Bregenzer Festspiele 2027: La traviata, Tickets & Tipps',
  seoDescription:
    'Bregenzer Festspiele 2027 (21. Juli bis 23. August): Verdis La traviata auf der Seebühne, Schoecks Penthesilea im Festspielhaus. Tickets & Anreise-Tipps.',
  keywords: [
    'Bregenzer Festspiele 2027',
    'La traviata Bregenz',
    'Bregenz Seebühne',
    'Bregenzer Festspiele Tickets',
    'Oper Bodensee',
    'Bregenzer Festspiele Programm',
    'Seebühne Bregenz',
    'Wiener Symphoniker Bregenz',
    'Vorarlberg Kulturfestival',
    'Festspiele Bregenz Sommer',
    'Bodensee Oper Festival',
  ],
  jsonLdEvent: {
    name: 'Bregenzer Festspiele 2027',
    startDate: '2027-07-21',
    endDate: '2027-08-23',
    location: 'Seebühne Bregenz, Platz der Wiener Symphoniker 1, 6900 Bregenz, Austria',
    addressCountry: 'AT',
    url: 'https://www.bregenzerfestspiele.com',
    description:
      'Die Bregenzer Festspiele 2027 zeigen Verdis La traviata auf der Seebühne im Bodensee und Schoecks Penthesilea im Festspielhaus Bregenz.',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&q=85&auto=format&fit=crop',
  },
};
