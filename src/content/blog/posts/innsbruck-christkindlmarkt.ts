import type { FestivalPost } from '../types';

// Märkte, Termine und Öffnungszeiten 2026 geprüft am 2026-10-27 gegen
// innsbruck.info/events/christkindlmaerkte-innsbruck.html (Innsbruck Tourismus, sieben
// Märkte). Vorher standen hier im April geschätzte Werte (20.11. bis 6.1., Markt am
// Landhausplatz, den es laut Innsbruck Tourismus nicht gibt).
export const post: FestivalPost = {
  slug: 'innsbruck-christkindlmarkt',
  title: 'Innsbrucker Christkindlmarkt',
  subtitle: 'Advent auf dem Marktplatz mit Blick auf die verschneiten Nordkette-Gipfel',
  heroImage: '/images/blog/innsbruck-christkindlmarkt/hero.jpg',
  thumbnailImage: '/images/blog/innsbruck-christkindlmarkt/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  readingTime: 5,
  excerpt:
    'Der Innsbrucker Christkindlmarkt gehört zu den schönsten Weihnachtsmärkten Österreichs. Auf dem historischen Marktplatz umrahmt von der Nordkette und der mittelalterlichen Altstadt entsteht jedes Jahr ein unvergesslicher Adventzauber.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-red-700 text-white',
  keyFacts: {
    dates: 'Altstadt und Marktplatz: 13. November bis 23. Dezember 2026. Maria-Theresien-Straße und Hungerburg bis 6. Jänner 2027',
    location: 'Altstadt, Marktplatz und fünf weitere Plätze, Innsbruck',
    address: 'Herzog-Friedrich-Straße, 6020 Innsbruck',
    genre: 'Weihnachtsmarkt, Advent, Handwerk, Kulinarik',
    price: 'Eintritt frei',
    website: 'https://www.innsbruck.info/events/christkindlmaerkte-innsbruck.html',
    capacity: 'bis zu 600.000 Besucher pro Saison',
    since: '1970er Jahre',
  },
  lineup: [
    { name: 'Tiroler Volksmusikgruppe Nordkette', role: 'special', stage: 'Marktplatz-Bühne' },
    { name: 'Stadtkapelle Innsbruck', role: 'special', stage: 'Marktplatz-Bühne' },
    { name: 'Adventkonzert Tiroler Landestheater', role: 'support', stage: 'Landhausplatz' },
    { name: 'Kinderchorkonzerte Wiltener Sängerknaben', role: 'support', stage: 'Marktplatz-Bühne' },
  ],
  lineupTitle: 'Programm-Highlights',
  lineupNote:
    'Das tägliche Bühnenprogramm mit Volksmusik, Chören und Kinderprogramm wird im Oktober auf der Website von Innsbruck Tourismus veröffentlicht.',
  intro:
    'Kein Christkindlmarkt in Österreich hat eine imposantere Naturkulisse: In Innsbruck leuchten Hunderte Stände auf dem historischen Marktplatz, während die schneebedeckten Gipfel der Nordkette und des Karwendels den Horizont rahmen. Die Tiroler Hauptstadt verwandelt sich ab Mitte November in eine Adventsstadt, die zu Fuß in kleinen Gassen erkundet werden will. Sieben Märkte verteilen sich über die Stadt, von der Altstadt vor dem Goldenen Dachl über den Marktplatz am Inn bis hinauf zur Hungerburg.',
  historyTitle: 'Tiroler Adventtradition im Herzen der Alpen',
  history:
    'Die Geschichte des Innsbrucker Weihnachtsmarkts reicht bis in die frühen 1970er Jahre zurück, als auf dem Marktplatz erste festliche Stände aufgebaut wurden. Über die Jahrzehnte wuchs der Markt von einem lokalen Handwerksmarkt zu einem international bekannten Adventereignis. Heute erstreckt er sich über mehrere Plätze in der Innenstadt. Besonders charakteristisch für Innsbruck ist die Einbindung echter Tiroler Handwerkstradition: Holzschnitzereien aus dem Grödnertal, Trachtenmode und regionale Lebensmittel vom Bergbauern stehen neben internationalem Weihnachtsschmuck.',
  whatToExpectTitle: 'Was der Innsbrucker Christkindlmarkt 2026 bietet',
  whatToExpect:
    'Über 80 Stände präsentieren auf verschiedenen Plätzen der Innsbrucker Altstadt ihr Angebot: vom Tiroler Speck und Käse über handgeschnitzte Krippenfiguren bis zu Woll- und Lederhandwerk aus der Region. Ein abwechslungsreiches Bühnenprogramm mit Volksmusik, Chören und Kindertheaterstücken ergänzt das Markterlebnis täglich.',
  whatToExpectList: [
    'Über 80 Stände auf mehreren Plätzen der Altstadt',
    'Tiroler Handwerk: Holzschnitzerei, Krippen, Trachten, Wollwaren',
    'Regionale Kulinarik: Tiroler Speck, Strudel, Glühwein und Feuerzangenbowle',
    'Tägliches Bühnenprogramm: Volksmusik, Chöre, Kinderprogramm',
    'Historische Kulisse: Goldenes Dachl, Triumphpforte, Nordkette als Panorama',
    'Rund-um-die-Uhr-Atmosphäre bis Weihnachten und darüber hinaus',
  ],
  practicalInfoTitle: 'Praktische Infos zum Innsbrucker Christkindlmarkt',
  practicalInfo: [
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Innsbruck HBF, dann 10 Minuten Fußweg in die Altstadt. Tram Linie 1 bis Marktplatz. Parkplätze im Stadtbereich begrenzt — Öffis empfohlen.',
    },
    {
      icon: '🕐',
      label: 'Öffnungszeiten',
      text: 'Altstadt, Marktplatz und Maria-Theresien-Straße täglich 11 bis 21 Uhr, St. Nikolaus 16 bis 21 Uhr, Wiltener Platzl 16 bis 20 Uhr. Hungerburg werktags 13 bis 19 Uhr, am Wochenende 12 bis 19 Uhr.',
    },
    {
      icon: '❄️',
      label: 'Wetter & Kleidung',
      text: 'Innsbruck im Dezember: -5 bis +5 °C, oft Schnee. Festes, warmes Schuhwerk und Winterkleidung sind Pflicht.',
    },
    {
      icon: '🗺️',
      label: 'Markt-Locations',
      text: 'Altstadt und Marktplatz 13.11. bis 23.12., Maria-Theresien-Straße 25.11. bis 6.1., Hungerburg 20.11. bis 6.1., St. Nikolaus und Wiltener Platzl 20.11. bis 23.12., Bergisel 13.11. bis 20.12. (Freitag bis Sonntag).',
    },
  ],
  gallery: [],
  ctaText: 'Advent-Events in Tirol entdecken',
  ctaLink: '/map?bundesland=Tirol&category=Kultur',
  seoTitle: 'Innsbrucker Christkindlmarkt 2026: Termine aller 7 Märkte',
  seoDescription:
    'Innsbrucker Christkindlmärkte 2026: Altstadt und Marktplatz 13. November bis 23. Dezember, täglich 11 bis 21 Uhr, Maria-Theresien-Straße bis 6. Jänner.',
  keywords: [
    'Innsbrucker Christkindlmarkt 2026',
    'Weihnachtsmarkt Innsbruck',
    'Advent Innsbruck',
    'Marktplatz Innsbruck Weihnachten',
    'Tiroler Christkindlmarkt',
    'Innsbruck Dezember',
    'Weihnachtsmarkt Tirol',
    'Advent Tirol 2026',
    'Christmas market Innsbruck',
    'Innsbruck Weihnacht Programm',
  ],
  jsonLdEvent: {
    name: 'Innsbrucker Christkindlmarkt 2026',
    startDate: '2026-11-13',
    endDate: '2027-01-06',
    location: 'Herzog-Friedrich-Straße, 6020 Innsbruck, Austria',
    addressCountry: 'AT',
    url: 'https://www.innsbruck.info/events/christkindlmaerkte-innsbruck.html',
    description:
      'Die Innsbrucker Christkindlmärkte in der Altstadt, am Marktplatz und an fünf weiteren Plätzen bieten Tiroler Handwerk, Kulinarik und Adventstimmung.',
    image:
      'https://images.unsplash.com/photo-1543933441-92abb7bd2ca2?w=1600&q=85&auto=format&fit=crop',
  },
};
