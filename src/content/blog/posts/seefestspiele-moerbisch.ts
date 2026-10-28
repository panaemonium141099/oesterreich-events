import type { FestivalPost } from '../types';

// Termine, Produktion, Besetzung, Preise, Sitzplätze, Geschichte und Anreise geprüft am
// 2026-10-27 gegen seefestspiele-moerbisch.at (Startseite, /programm/mamma-mia-2027/,
// Kategorieübersicht-Grafik 2027, /faq/, Anreise & Parken, Über uns > Geschichte) sowie
// weekend.at und leadersnet.at (Besetzung 2026). Termin 2026 (16.07. bis 22.08.), Stück und
// Gründungsjahr 1957 stimmten. Vorher falsch: "Eröffnungsgala" (16.07. war die Premiere),
// erfundene Ensembles statt Besetzung, 6.200 Plätze (laut Chronik auf 6.100 ausgebaut),
// "größte Seebühne Europas", 200 Mitwirkende, Wasserspiele ohne Beleg, Bahn "Wien Südbahnhof
// bis Mörbisch" (Veranstalter nennt nur Shuttlebusse und Auto), Parken kostenpflichtig
// (laut Veranstalter kostenlos). Jetzt auf die Saison 2027 (MAMMA MIA!) umgestellt.
export const post: FestivalPost = {
  slug: 'seefestspiele-moerbisch',
  title: 'Seefestspiele Mörbisch 2027',
  subtitle: 'Musical und Operette auf der Seebühne am Neusiedler See',
  heroImage: '/images/blog/seefestspiele-moerbisch/hero.jpg',
  thumbnailImage: '/images/blog/seefestspiele-moerbisch/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  readingTime: 7,
  excerpt:
    'Auf der Seebühne am Neusiedler See inszenieren die Seefestspiele Mörbisch seit 1957 jeden Sommer eine große Produktion. 2026 war es „Ein Käfig voller Narren“ (La Cage aux Folles), 2027 folgt MAMMA MIA! vom 15. Juli bis 21. August.',
  category: 'Kultur & Bühne',
  categoryColor: 'bg-cyan-700 text-white',
  keyFacts: {
    dates: '15. Juli bis 21. August 2027 (2026: 16. Juli bis 22. August)',
    location: 'Seebühne Mörbisch am See, Burgenland',
    address: 'Seebühne, 7072 Mörbisch am See',
    genre: 'Musical, Operette',
    price: 'Saison 2027: € 36 bis € 129 (Loge zuzüglich Kulinarikpaket)',
    website: 'https://www.seefestspiele-moerbisch.at',
    capacity: 'rund 6.100 Sitzplätze',
    since: '1957',
  },
  lineup: [
    { name: 'MAMMA MIA!', role: 'headliner', day: '15. Juli bis 21. August 2027' },
  ],
  lineupTitle: 'Programm 2027',
  lineupNote:
    'Hauptproduktion 2027 ist MAMMA MIA! mit neuem Bühnenbild von Walter Vogelweider, die Besetzung ist noch nicht veröffentlicht. 2026 spielten in „Ein Käfig voller Narren“ Mark Seibert (Georges), Alfons Haider und Drew Sarich (Albin/Zaza), Regie führte Andreas Gergen.',
  intro:
    'Es gibt Kulturerlebnisse, die man einmal im Leben haben sollte, die Seefestspiele Mörbisch gehören unbedingt dazu. Auf der Seebühne am Neusiedler See im Burgenland wird jeden Sommer eine große Produktion gezeigt, früher vor allem Operette, heute auch Musical. Wenn sich die Sonne über dem See neigt, sitzen auf der Tribüne bis zu rund 6.100 Menschen unter freiem Himmel. 2026 lief „Ein Käfig voller Narren“ (La Cage aux Folles), 2027 kommt das ABBA-Musical MAMMA MIA! auf die Seebühne.',
  historyTitle: 'Seit 1957: Eine Sommerbühne fürs Welterbe',
  history:
    'Die Seefestspiele Mörbisch wurden 1957 von Kammersänger Herbert Alsen gegründet, die erste Produktion war „Der Zigeunerbaron“ vor rund 1.200 Gästen auf einer damals einfachen Seebühne. In den 1980er Jahren wuchs die Tribüne von 3.000 auf 3.450 Plätze, unter Intendant Harald Serafin wurde sie auf 6.100 Plätze ausgebaut. Der Neusiedler See, Teil des UNESCO-Welterbes Neusiedler See / Fertő, bildet die Kulisse. Seit Jänner 2021 leitet Alfons Haider die Seefestspiele als Generalintendant.',
  whatToExpectTitle: 'Theater, Wasser und Abendhimmel',
  whatToExpect:
    'Die Seefestspiele Mörbisch zeigen jeden Sommer eine Hauptproduktion, die über mehrere Wochen gespielt wird. 2027 ist das MAMMA MIA! mit Zusatzterminen am 25. Juli und 3. August. Das Publikum sitzt unter freiem Himmel, das Gelände öffnet im Juli um 18 Uhr und im August um 17:30 Uhr. Eine Kleiderordnung gibt es nicht, empfohlen ist wetterfeste Kleidung.',
  whatToExpectList: [
    'Seebühne direkt am Neusiedler See',
    'Hauptproduktion 2027: MAMMA MIA! mit neuem Bühnenbild',
    'Tribüne mit rund 6.100 Plätzen unter freiem Himmel',
    'Keine Kleiderordnung, Regenschirme sind auf dem Gelände nicht erlaubt',
    'Gastronomie auf dem Festivalgelände mit Blick auf den See',
    'Kombinierbar mit Ausflügen in den Nationalpark Neusiedler See',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🚌',
      label: 'Anreise mit dem Shuttlebus',
      text: 'Blaguss-Shuttlebusse fahren an Vorstellungstagen ab Wien (Oper und Erdberg) und ab Eisenstadt zur Seebühne.',
    },
    {
      icon: '🚗',
      label: 'Anreise mit dem Auto',
      text: 'Aus Wien über die A4 bis Neusiedl am See, dann am Westufer über Purbach, Rust nach Mörbisch. Parken direkt beim Festspielgelände ist kostenlos.',
    },
    {
      icon: '🌡️',
      label: 'Wetter & Mücken',
      text: 'Seenähe bedeutet: Mückenschutz und leichte Jacke für kühle Abende mitbringen.',
    },
    {
      icon: '🎟️',
      label: 'Tickets',
      text: 'Online unter seefestspiele-moerbisch.at oder telefonisch unter +43 2682 66210. Logenkarten gibt es nur telefonisch.',
    },
  ],
  gallery: [],
  ctaText: 'Kulturevents am Neusiedler See entdecken',
  ctaLink: '/map?bundesland=Burgenland&category=Kultur',
  seoTitle: 'Seefestspiele Mörbisch 2027: MAMMA MIA! am Neusiedler See',
  seoDescription:
    'Seefestspiele Mörbisch 2027: MAMMA MIA! vom 15. Juli bis 21. August auf der Seebühne am Neusiedler See. Termine, Preise, Anreise und Rückblick auf 2026.',
  keywords: [
    'Seefestspiele Mörbisch',
    'Seefestspiele Mörbisch 2027',
    'Mamma Mia Mörbisch',
    'Seebühne Mörbisch',
    'Neusiedler See Festival',
    'Operette Burgenland',
    'Freilufttheater Österreich',
    'Mörbisch am See',
    'Kulturfestival Burgenland',
    'Musical Freiluft Österreich',
  ],
  jsonLdEvent: {
    name: 'Seefestspiele Mörbisch 2027: MAMMA MIA!',
    startDate: '2027-07-15',
    endDate: '2027-08-21',
    location: 'Seebühne Mörbisch, 7072 Mörbisch am See, Austria',
    addressCountry: 'AT',
    url: 'https://www.seefestspiele-moerbisch.at',
    description:
      'Die Seefestspiele Mörbisch zeigen vom 15. Juli bis 21. August 2027 das Musical MAMMA MIA! auf der Seebühne am Neusiedler See.',
    image:
      'https://images.unsplash.com/photo-1578736641330-3155e606cd40?w=1600&q=85&auto=format&fit=crop',
  },
};
