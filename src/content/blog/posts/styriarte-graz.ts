import type { FestivalPost } from '../types';

// Termine, Spielstätten, Gründung, Intendanz, Programm und Besucherzahl geprüft am
// 2026-10-27 gegen styriarte.com (/en/news/styriarte-2026-a-festival-in-review,
// /en/productions/de-profundis, /en/productions/zauberfloete, /en/artists/mathis-huber-en),
// steiermark.com (Styriarte_ed_75776609, Termin 2027) und austria-forum.org/af/AustriaWiki/Styriarte.
// Vorher falsch: Lineup erfunden (Concentus Musicus, Chamber Orchestra of Europe,
// Orozco-Estrada, Prégardien, Röschmann standen 2026 nicht im Programm),
// Adresse der Helmut-List-Halle falsch, Harnoncourt als Gründer (gegründet 1985 auf
// Initiative des Landes rund um Harnoncourt), Stadtpfarrkirche als Spielstätte,
// Frühbucherrabatt und Festival-Pass ohne Beleg, Anreise-/Parkangaben passten nicht zur Halle.
export const post: FestivalPost = {
  slug: 'styriarte-graz',
  title: 'styriarte Graz',
  subtitle: 'Nikolaus Harnoncourts Vermächtnis: Klassikfestival mit Seele in der Grazer Altstadt',
  heroImage: '/images/blog/styriarte-graz/hero.jpg',
  thumbnailImage: '/images/blog/styriarte-graz/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.steiermark.com/de/Region-Graz/Urlaub-planen/Veranstaltungen/Styriarte_ed_75776609',
      'https://www.steiermark.com/lp/pl/Urlop-letni/Region-Graz/Helmut-List-Halle_isd_74306196',
      'https://austria-forum.org/af/AustriaWiki/Styriarte',
      'https://styriarte.com/en/productions/de-profundis',
      'https://styriarte.com/en/news/styriarte-2026-a-festival-in-review',
      'https://www.kaernten.at/nachhaltiges-kaernten/informationen/koralmbahn',
    ],
  },
  readingTime: 7,
  excerpt:
    'Das styriarte Graz verbindet historische Aufführungspraxis mit dem Geist Nikolaus Harnoncourts. Jeden Sommer im Juni und Juli spielt das Festival in Grazer Sälen, im Schloss Eggenberg und an besonderen Orten der Steiermark. Die nächste Ausgabe läuft vom 25. Juni bis 25. Juli 2027.',
  category: 'Musik & Konzerte',
  categoryColor: 'bg-indigo-700 text-white',
  keyFacts: {
    dates: '25. Juni bis 25. Juli 2027 (Motto „Phantastisch!“). 2026: 26. Juni bis 26. Juli',
    location: 'Graz (u. a. Helmut-List-Halle, Stefaniensaal, Schloss Eggenberg) und Orte in der Steiermark',
    address: 'Helmut-List-Halle, Waagner-Biro-Straße 98a, 8020 Graz',
    genre: 'Klassik, Barockmusik, Kammermusik, Oper',
    price: 'je nach Konzert, 2026 z. B. 26 bis 156 €; unter 27 Jahren 50 % Ermäßigung',
    website: 'https://www.styriarte.com',
    capacity: '30.537 Besucherinnen und Besucher (2026)',
    since: '1985',
  },
  lineup: [
    { name: 'Jordi Savall mit Le Concert des Nations und La Capella Reial de Catalunya', role: 'headliner', day: '26. Juli 2026', stage: 'Helmut-List-Halle' },
    { name: 'Mei-Ann Chen dirigiert Mahlers Zweite Symphonie', role: 'special', day: 'Juli 2026' },
    { name: 'Zefiro: Mozarts Zauberflöte für Bläser', role: 'support', day: '27. und 28. Juni 2026', stage: 'Schloss Eggenberg, Planetensaal' },
  ],
  lineupTitle: 'Rückblick: Programm 2026',
  lineupNote:
    'Drei Produktionen der styriarte 2026 („Licht-Spiele“). Die styriarte 2027 läuft vom 25. Juni bis 25. Juli 2027 unter dem Motto „Phantastisch!“, das Programm erscheint auf styriarte.com.',
  intro:
    'Das styriarte Graz ist mehr als ein Klassikfestival: Es ist das lebendige Vermächtnis von Nikolaus Harnoncourt, dem Pionier der historischen Aufführungspraxis. Seit 1985 lädt das Festival Musikerinnen und Musiker aus aller Welt nach Graz ein, um Werke des Barock, der Klassik und Romantik mit Leidenschaft und Authentizität neu zu entdecken. Die Spielstätten, von der modernen Helmut-List-Halle über den Stefaniensaal bis zum Schloss Eggenberg, machen jedes Konzert zu einem Gesamterlebnis, bei dem Raum und Klang eine besondere Einheit bilden.',
  historyTitle: 'Harnoncourts Idee: Musik als Dialog mit der Geschichte',
  history:
    'Die styriarte fand 1985 zum ersten Mal statt. Sie ging auf eine Initiative des steirischen Kulturlandesrats Kurt Jungwirth zurück, der den Dirigenten Nikolaus Harnoncourt enger an seine Heimatstadt Graz binden wollte. Harnoncourt prägte das Festival von Beginn an: Die erste Ausgabe stand im Zeichen Bachs, mit seinem Ensemble Concentus Musicus Wien, 1987 brachte er das Chamber Orchestra of Europe nach Graz. Auch nach Harnoncourts Tod 2016 lebt sein Ansatz der historisch informierten Aufführungspraxis im Festival weiter. Intendant ist seit Oktober 1990 Mathis Huber.',
  whatToExpectTitle: 'Ein Festival für alle Sinne',
  whatToExpect:
    'Jede Ausgabe hat ein Motto: 2026 hieß es „Licht-Spiele“, 2027 lautet es „Phantastisch!“. Das Programm reicht vom Barock bis in die Gegenwart, von großen Orchesterabenden in der Helmut-List-Halle bis zu Kammermusik im Planetensaal von Schloss Eggenberg. 2026 standen 32 Projekte auf dem Plan, wegen der Nachfrage wurden daraus 72 Vorstellungen; die Auslastung lag laut Veranstalter bei 94 Prozent.',
  whatToExpectList: [
    'Orchesterkonzerte in der Helmut-List-Halle',
    'Kammermusik im Planetensaal von Schloss Eggenberg, teils mit Picknick im Park',
    'Konzerte im Stefaniensaal und an Spielorten in der ganzen Steiermark',
    'Sonnenaufgangskonzerte in freier Landschaft',
    'Halber Preis für alle unter 27 Jahren und mit Ö1-Intro-Karte',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Karten unter styriarte.com oder im Kartenbüro im Palais Attems, Sackstraße 17, Graz. Unter 27 Jahren und mit Ö1-Intro-Karte gibt es 50 % Ermäßigung.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Die Helmut-List-Halle liegt in Gehweite vom Grazer Hauptbahnhof. Railjets aus Wien brauchen rund 2,5 Stunden, aus Klagenfurt seit der Koralmbahn rund 42 Minuten.',
    },
    {
      icon: '🅿️',
      label: 'Spielorte',
      text: 'Die Konzerte verteilen sich über mehrere Säle in Graz und Orte in der Steiermark. Welche Spielstätte gilt, steht bei jeder Produktion auf styriarte.com.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Graz bietet ein breites Hotelangebot. Im Juli frühzeitig buchen, denn das Festival zieht viele Besucherinnen und Besucher von außerhalb an.',
    },
  ],
  gallery: [],
  ctaText: 'Klassik-Events in Graz entdecken',
  ctaLink: '/map?bundesland=Steiermark&category=Kultur',
  seoTitle: 'styriarte Graz 2027: Termin, Programm und Tickets',
  seoDescription:
    'styriarte Graz 2027 vom 25. Juni bis 25. Juli unter dem Motto „Phantastisch!“. Klassikfestival in Helmut-List-Halle, Stefaniensaal und Schloss Eggenberg.',
  keywords: [
    'styriarte Graz 2027',
    'styriarte Programm',
    'Klassikfestival Graz',
    'Nikolaus Harnoncourt Festival',
    'Helmut-List-Halle Konzert',
    'Schloss Eggenberg Konzert',
    'Barockmusik Graz',
    'Graz Klassik Sommer',
    'styriarte Tickets',
    'Klassikfestival Steiermark',
  ],
  jsonLdEvent: {
    name: 'styriarte Graz 2027',
    startDate: '2027-06-25',
    endDate: '2027-07-25',
    location: 'Helmut-List-Halle, Waagner-Biro-Straße 98a, 8020 Graz, Austria',
    addressCountry: 'AT',
    url: 'https://www.styriarte.com',
    description:
      'Das styriarte Graz ist ein internationales Klassikfestival, das im Geist von Nikolaus Harnoncourt historische Aufführungspraxis mit modernem Musikerleben verbindet.',
    image:
      'https://images.unsplash.com/photo-1465225314224-587cd83d322b?w=1600&q=85&auto=format&fit=crop',
  },
};
