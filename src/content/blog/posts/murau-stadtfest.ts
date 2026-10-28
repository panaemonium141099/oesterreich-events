import type { FestivalPost } from '../types';

// Geprüft am 2026-10-27 gegen murau.gv.at (Stadtgemeinde, Veranstaltungen),
// steiermark.com und ausflugsziele.jetzt (Eintrag "Gasseln in der Murauer Altstadt",
// 31.07.2026), meinbezirk.at (Bierstadtfest 2025, Artikel 31.01.2025) und murauerbier.at.
// Im Kern falsch: Ein "Murauer Stadtfest" am 11. und 12. Juli 2026 ist nicht belegbar.
// 11. und 12. Juli war der Termin des Bierstadtfests 2025 (530 Jahre Murauer Bier); für
// 2026 und 2027 ist kein Bierstadtfest angekündigt. Das belegbare Altstadtfest 2026 war
// das Gasseln am 31. Juli. Ebenfalls ohne Beleg und entfernt: Lineup und Bühnen
// (Burggassen-Bühne, Biergarten-Bühne), Festzug, Kunsthandwerksmarkt, "seit den
// 1990er-Jahren", "ca. 10.000 Besucher", Fahrzeit nach Graz. Website murau.at leitet
// auf eine fremde Seite um (almnest-lachtal.at); die Stadtgemeinde ist murau.gv.at.
export const post: FestivalPost = {
  slug: 'murau-stadtfest',
  title: 'Feste in der Murauer Altstadt',
  subtitle: 'Gasseln und Bierstadtfest: Feiern in der Bierstadt Murau',
  heroImage: '/images/blog/murau-stadtfest/hero.jpg',
  thumbnailImage: '/images/blog/murau-stadtfest/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  readingTime: 6,
  excerpt:
    'Ein eigenes „Murauer Stadtfest“ gibt es nicht. Gefeiert wird in der Murauer Altstadt beim Gasseln im Sommer und, in größeren Abständen, beim Bierstadtfest der Brauerei Murau.',
  category: 'Festivals & Feste',
  categoryColor: 'bg-amber-600 text-white',
  keyFacts: {
    dates: 'Gasseln: 31. Juli 2026 ab 15 Uhr (Termin 2027 folgt). Bierstadtfest: zuletzt 11. und 12. Juli 2025',
    location: 'Murauer Altstadt',
    address: 'Raffaltplatz, 8850 Murau, Steiermark',
    genre: 'Altstadtfest, Volksmusik, Kulinarik, Brauchtum',
    price: 'Gasseln: Eintritt frei',
    website: 'https://www.murau.gv.at',
  },
  lineup: [],
  lineupTitle: 'Programm-Highlights',
  intro:
    'Im Herzen der obersteirischen Berge liegt eine der schönsten mittelalterlichen Kleinstädte der Steiermark: Murau, bekannt für sein romantisches Stadtbild und das traditionsreiche Murauer Bier. Ein jährliches Fest unter dem Namen „Murauer Stadtfest“ gibt es allerdings nicht. Das Altstadtfest heißt in Murau Gasseln: 2026 fand es am Freitag, 31. Juli, ab 15 Uhr statt, veranstaltet von der Stadtgemeinde Murau, bei freiem Eintritt.',
  historyTitle: 'Bierstadt Murau: Gasseln und Bierstadtfest',
  history:
    'Das Murauer Bier wird laut Brauerei seit 1495 gebraut. Zum 530-Jahr-Jubiläum lud die Brauerei Murau am 11. und 12. Juli 2025 zum Bierstadtfest in die Altstadt: Angekündigt waren fünf Bühnen mit 49 Bands, 26 Musikkapellen beim Umzug durch die Altstadt und rund 15.000 Besucherinnen und Besucher. Das Bierstadtfest findet nicht jährlich statt, ein Termin für 2026 oder 2027 ist nicht angekündigt. Das Gasseln beschreibt der Veranstaltungseintrag von Steiermark Tourismus als traditionelles Altstadtfest.',
  whatToExpectTitle: 'Was das Gasseln bietet',
  whatToExpect:
    'Beim Gasseln 2026 standen laut Veranstaltungseintrag Musik von steirischer Musi über Austropop bis Jazz, Schuhplattler, ein Saxofonist, Zauberer und Karikaturist, heimische Kulinarik, Kinderanimation, Kunsthandel und ein Glückshafen auf dem Programm. Am selben Tag gastierte ab 13 Uhr der Radio Steiermark Heimatsommer in Murau.',
  whatToExpectList: [
    'Steirische Musi, Austropop und Jazz in der Altstadt',
    'Schuhplattler, Zauberer und Karikaturist',
    'Heimische Kulinarik und Murauer Bier',
    'Kinderanimation',
    'Kunsthandel und Glückshafen',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🍺',
      label: 'Murauer Bier',
      text: 'Die Brauerei Murau am Raffaltplatz bietet mit der „Brauerei der Sinne“ Führungen durch Schaubrauerei und Museum an, ein guter Programmpunkt rund um einen Festbesuch.',
    },
    {
      icon: '🚗',
      label: 'Anreise',
      text: 'Murau liegt im oberen Murtal und ist mit dem Auto sowie mit der Murtalbahn der Steiermarkbahn erreichbar.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Gasthaus- und Pensionsangebot in Murau und im Murtal. Bei großen Festen wie dem Bierstadtfest sind die Betten in Murau schnell vergeben, dann auf Nachbarorte wie St. Lambrecht, Neumarkt oder Oberwölz ausweichen.',
    },
    {
      icon: '🌲',
      label: 'Ausflugstipp',
      text: 'Das Murtal bietet tolle Wanderungen und Radtouren, ideal zum Kombinieren mit einem Festbesuch.',
    },
  ],
  gallery: [],
  ctaText: 'Events im Murtal entdecken',
  ctaLink: '/map?bundesland=Steiermark&category=Festival',
  seoTitle: 'Feste in Murau: Gasseln in der Altstadt und Bierstadtfest',
  seoDescription:
    'Murau feiert in der Altstadt: Gasseln 2026 am 31. Juli mit Musik und Kulinarik bei freiem Eintritt, dazu das Bierstadtfest der Brauerei Murau.',
  keywords: [
    'Murau Stadtfest',
    'Gasseln Murau',
    'Murau Altstadtfest',
    'Bierstadtfest Murau',
    'Murau Steiermark',
    'Murauer Bier Fest',
    'Volksmusik Murtal',
    'Stadtfest Steiermark',
    'Murtal Event',
    'Obersteirisches Brauchtum',
  ],
  jsonLdEvent: {
    name: 'Gasseln in der Murauer Altstadt 2026',
    startDate: '2026-07-31',
    endDate: '2026-07-31',
    location: 'Altstadt, Raffaltplatz, 8850 Murau, Steiermark, Austria',
    addressCountry: 'AT',
    url: 'https://www.murau.gv.at',
    description:
      'Gasseln ist das traditionelle Altstadtfest von Murau mit Musik, Schuhplattlern, heimischer Kulinarik und Kinderanimation, Eintritt frei.',
    image:
      'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=1600&q=85&auto=format&fit=crop',
  },
};
