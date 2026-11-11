import type { FestivalPost } from '../types';

// Ort, Rhythmus, Termine 2026/2027, Öffnungszeiten, Programm und Anreise geprüft am
// 2026-10-27 gegen dult.at (Startseite, /de/kontakt-anreise/anfahrt-parken/,
// /de/fuer-besucher/faq-dult/) und die Medieninformation vom 21.05.2026
// (dult.at/fileadmin/Salzburger_Dult/2026/Presse/Pressemitteilung_vorab.pdf),
// Besucherzahl 2026 laut salzburg24.at (Bilanz vom 01.06.2026). Vorher stand hier im
// April Erfundenes: zwei Dulten pro Jahr (Frühling und Herbst) im Volksgarten, Website
// salzburg.gv.at, 80.000 Besucher pro Dult, ein ausgedachtes Musikprogramm
// (Landesmusikkapelle, Trachtenkapelle Maxglan u. a.), Flohmarkt, Busse zum Volksgarten.
// Tatsächlich: einmal jährlich um Pfingsten im Messezentrum Salzburg.
export const post: FestivalPost = {
  slug: 'salzburger-dult',
  title: 'Salzburger Dult',
  subtitle: 'Westösterreichs größtes Volksfest im Messezentrum Salzburg: Vergnügungspark, Festhalle und Thementage rund um Pfingsten',
  heroImage: '/images/blog/salzburger-dult/hero.jpg',
  thumbnailImage: '/images/blog/salzburger-dult/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.dult.at/',
      'https://www.dult.at/fileadmin/Salzburger_Dult/2026/Presse/Pressemitteilung_vorab.pdf',
      'https://www.dult.at/de/kontakt-anreise/anfahrt-parken/',
      'https://www.salzburg24.at/news/salzburg/stadt/hitze-premieren-und-180000-besucher-das-war-die-salzburger-dult-2026-im-messezentrum-art-327478',
    ],
  },
  readingTime: 5,
  excerpt:
    'Einmal im Jahr, rund um Pfingsten, wird das Messezentrum Salzburg zur Volksfeststadt: Die Salzburger Dult bringt neun Tage Vergnügungspark, Festhalle, Thementage und Feuerwerk, bei freiem Eintritt. Die nächste Dult findet von 15. bis 23. Mai 2027 statt.',
  category: 'Kultur & Tradition',
  categoryColor: 'bg-yellow-600 text-white',
  keyFacts: {
    dates: '15. bis 23. Mai 2027 (2026: 23. bis 31. Mai)',
    location: 'Messezentrum Salzburg',
    address: 'Am Messezentrum 1, 5020 Salzburg',
    genre: 'Volksfest, Vergnügungspark, Kulinarik, Brauchtum',
    price: 'Eintritt frei (einzelne Abendveranstaltungen nur mit Ticket)',
    website: 'https://www.dult.at',
    capacity: 'über 180.000 Besucher (2026, laut Veranstalter)',
  },
  lineup: [
    { name: 'Eröffnung und Tag der Vereine', role: 'special', day: 'Samstag, 23. Mai 2026', stage: 'Stiegl-Halle und Festhalle' },
    { name: 'Feuerwerk', role: 'special', day: 'Pfingstsonntag, 24. Mai 2026' },
    { name: 'Blaulichttag mit ORF Radio Salzburg', role: 'support', day: 'Pfingstmontag, 25. Mai 2026', stage: 'Stiegl-Halle' },
    { name: 'Familientag mit K-Pop-Gaudi', role: 'support', day: 'Dienstag, 26. Mai 2026', stage: 'Dult-Stadl' },
    { name: 'Dult Live: Eva Karl Faltermeier „Ding Dong“', role: 'headliner', day: 'Mittwoch, 27. Mai 2026', stage: 'Stiegl-Halle' },
    { name: 'Dult Live: Glueboys', role: 'headliner', day: 'Donnerstag, 28. Mai 2026', stage: 'Stiegl-Halle' },
  ],
  lineupTitle: 'Programm-Highlights 2026',
  lineupNote:
    'Programm der Dult 2026 laut Veranstalter. Für 2027 sind bisher die Landesmeisterschaft im Preisplatteln (15. Mai 2027, Stiegl-Halle) und „Los Brudalos X Dult Live“ (22. Mai 2027) angekündigt; das weitere Rahmenprogramm steht auf dult.at.',
  intro:
    'Die Salzburger Dult ist das große Volksfest der Stadt Salzburg und nennt sich selbst „Westösterreichs größtes Volksfest“. Einmal im Jahr, rund um Pfingsten, verwandelt sich das Messezentrum Salzburg für neun Tage in eine eigene kleine Volksfeststadt: Schausteller aus Österreich, Deutschland und den Niederlanden bauen Fahrgeschäfte, Spielbuden und Imbissstände auf, in der Stiegl-Halle spielt Live-Musik, und jeder Tag hat ein eigenes Motto. Der Eintritt auf das Gelände ist frei. 2026 kamen laut Veranstalter über 180.000 Besucherinnen und Besucher.',
  historyTitle: 'Ein Volksfest mit Wurzeln im Mittelalter',
  history:
    'Laut Veranstalter reichen die Wurzeln der Salzburger Dult bis ins Mittelalter zurück. Heute richtet die Messezentrum Salzburg GmbH das Fest auf ihrem Gelände in Salzburg aus, jedes Jahr rund um das Pfingstwochenende. 2026 kamen neue Formate dazu: der Dult-Stadl als zusätzliche Gastro- und Eventlocation und die Reihe „Dult Live“ mit Konzerten und Kabarett in der Stiegl-Halle.',
  whatToExpectTitle: 'Was die Salzburger Dult bietet',
  whatToExpect:
    'Die Dult verbindet Vergnügungspark und Feststimmung. 2026 waren unter anderem die Wildwasserbahn „Rio Rapidos“, die Erlebnisbahn „Laser PIX“, der „Bayern Tower“ sowie die Publikumslieblinge „Crazy Wave“ und „Black Out“ am Gelände. In der Stiegl-Halle spielen Live-Bands bei freiem Eintritt, der Festwirt serviert Klassiker wie Schnitzel, Grillhendl und Stelze, Tische lassen sich über dult.at reservieren.',
  whatToExpectList: [
    'Vergnügungspark mit Fahrgeschäften, Spielbuden und Imbissständen',
    'Live-Musik in der Stiegl-Halle bei freiem Eintritt',
    'Dult-Stadl: Almhütte mit DJ-Abenden und Themenpartys',
    'Thementage: Tag der Vereine, Blaulichttag, Familientag, Seniorentag',
    'Feuerwerk am Pfingstsonntag',
    '„Dult Live“: Konzerte und Kabarett mit eigenem Ticket',
  ],
  practicalInfoTitle: 'Alles Wichtige zur Salzburger Dult',
  practicalInfo: [
    {
      icon: '🎡',
      label: 'Eintritt',
      text: 'Der Eintritt auf das Gelände ist frei. Einzelne Abendveranstaltungen wie „Dult Live“ oder die Single Love Gaudi gibt es nur mit Ticket.',
    },
    {
      icon: '🚌',
      label: 'Anreise',
      text: 'Obus-Linien 1 und 8 sowie Bus 11 und 17 halten direkt am Messezentrum, die Obus-Linie 7 an der Haltestelle Bessarabierstraße. Vom Hauptbahnhof sind es rund 20 Minuten zu Fuß. Tagesparken während der Dult: 14 Euro.',
    },
    {
      icon: '👨‍👩‍👧',
      label: 'Familien',
      text: 'Am Familientag gibt es laut Veranstalter zahlreiche Aktionen und Vergünstigungen (2026 am Dienstag nach Pfingsten).',
    },
    {
      icon: '📅',
      label: 'Öffnungszeiten',
      text: '2026 war die Dult neun Tage lang täglich von 11 bis 24 Uhr geöffnet. Die Öffnungszeiten 2027 veröffentlicht der Veranstalter auf dult.at.',
    },
  ],
  gallery: [],
  ctaText: 'Volkskultur-Events in Salzburg entdecken',
  ctaLink: '/map?bundesland=Salzburg&category=Kultur',
  seoTitle: 'Salzburger Dult 2027: Volksfest im Messezentrum, Termine & Tipps',
  seoDescription:
    'Salzburger Dult 2027 von 15. bis 23. Mai im Messezentrum Salzburg: Vergnügungspark, Stiegl-Halle, Thementage und Feuerwerk bei freiem Eintritt.',
  keywords: [
    'Salzburger Dult 2027',
    'Volksfest Salzburg',
    'Dult Salzburg Pfingsten',
    'Dult Messezentrum Salzburg',
    'Salzburg Kirmes',
    'Salzburg Familienveranstaltung',
    'Salzburger Volksfest Termine',
    'Dult Fahrgeschäfte Salzburg',
    'Stiegl-Halle Dult',
    'Dult Live Salzburg',
  ],
  jsonLdEvent: {
    name: 'Salzburger Dult 2027',
    startDate: '2027-05-15',
    endDate: '2027-05-23',
    location: 'Messezentrum Salzburg, Am Messezentrum 1, 5020 Salzburg, Austria',
    addressCountry: 'AT',
    url: 'https://www.dult.at',
    description:
      'Die Salzburger Dult ist ein jährliches Volksfest rund um Pfingsten im Messezentrum Salzburg mit Vergnügungspark, Festhalle und Thementagen bei freiem Eintritt.',
    image:
      'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=1600&q=85&auto=format&fit=crop',
  },
};
