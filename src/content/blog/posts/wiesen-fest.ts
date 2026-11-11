import type { FestivalPost } from '../types';

// Termine, Lineup, Geschichte, Preise, Bühnen und Anreise geprüft am 2026-10-27 gegen
// onelovefestival.at (Startseite, /de/about, /de/camping), wiesen.at (Wiesen Festivals,
// Termine 2027), news.at ("One Love Wiesen feiert 50 Jahre Festivalkultur mit Reggae") und
// meinbezirk.at (Fotogalerie One Love 2026 vom 11.08.2026). Vorher falsch: "seit 1994" (One Love
// erstmals 2019, Festivals in Wiesen seit 1976), Website wiesen.at statt onelovefestival.at,
// Wiesen "im Südburgenland" und in der "Tiefebene" (Bezirk Mattersburg), Gelände seit den
// "frühen 1990ern", Bahnhof Mattersburg (Shuttle ab Wiesen-Sigleß), Preise und Tagesticket
// geschätzt, Termin 6. bis 8.08.2026 (richtig 7. und 8. August). Jetzt auf 2027 umgestellt.
export const post: FestivalPost = {
  slug: 'wiesen-fest',
  title: 'One Love Festival Wiesen 2027',
  subtitle: 'Reggae, Dub und positive Vibes auf dem Festivalgelände Wiesen im Burgenland',
  heroImage: '/images/blog/wiesen-fest/hero.jpg',
  thumbnailImage: '/images/blog/wiesen-fest/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.onelovefestival.at/de/about',
      'https://www.onelovefestival.at',
      'https://www.wiesen.at',
      'https://www.news.at/news/one-love-wiesen-feiert-50-jahre-festivalkultur-mit-reggae',
      'https://www.onelovefestival.at/de/camping',
    ],
  },
  readingTime: 6,
  excerpt:
    'Das One Love Festival in Wiesen im Bezirk Mattersburg bezeichnet sich selbst als Österreichs größtes Reggae-Festival. Seit 2019 bringt es Reggae, Roots und Dub auf das Festivalgelände Wiesen, die nächste Ausgabe läuft am 6. und 7. August 2027.',
  category: 'Musik & Festival',
  categoryColor: 'bg-green-700 text-white',
  keyFacts: {
    dates: '6. und 7. August 2027 (2026: 7. und 8. August)',
    location: 'Festivalgelände Wiesen, Burgenland',
    address: 'Festivalgelände, 7203 Wiesen',
    genre: 'Reggae, Roots, Dub, Dancehall',
    price: '2-Tages-Pass 2027: € 139 (Stand Oktober 2026), Camping-Ticket zusätzlich',
    website: 'https://www.onelovefestival.at',
    since: '2019',
  },
  lineup: [
    { name: 'Alpha Blondy', role: 'headliner', day: '2026' },
    { name: 'The Wailers', role: 'headliner', day: '2026' },
    { name: 'Alborosie', role: 'support', day: '2026' },
    { name: 'Queen Omega', role: 'support', day: '2026' },
    { name: 'Dawn Penn', role: 'support', day: '2026' },
  ],
  lineupTitle: 'Lineup 2026 (Auszug)',
  lineupNote:
    'Acts der Ausgabe 2026 laut news.at. Das Lineup 2027 ist noch nicht veröffentlicht, aktuelle Infos auf onelovefestival.at.',
  intro:
    'Im burgenländischen Wiesen spielt die Musik. Seit 1976 finden in der Gemeinde im Bezirk Mattersburg Festivals statt, angefangen mit Jazz, später kamen Funk, Reggae, Rock, Punk, Elektronik und Hip-Hop dazu. Das One Love Festival ist seit 2019 der Reggae-Termin auf dem Gelände und nennt sich selbst das größte Reggae-Festival Österreichs. Zwei Tage lang treffen sich hier Reggae-Fans zwischen Kirschgarten, Nusswald und Campingwiese.',
  historyTitle: 'Reggae in Wiesen: seit 2019 One Love',
  history:
    'Hinter dem One Love Festival steht die Wiener Bunfire Veranstaltungs GmbH, deren Bunfiresquad seit 1999 Reggae- und Dancehall-Konzerte in Wien und ganz Österreich veranstaltet. 2018 beschloss das Team, ein großes Reggae-Festival zu gründen, 2019 fand das erste One Love in Wiesen statt, laut Veranstalter mit rund 5.500 Besucherinnen und Besuchern. 2026, im 50. Jahr der Wiesen-Festivals, standen unter anderem Alpha Blondy, The Wailers, Alborosie, Queen Omega und Dawn Penn auf der Bühne.',
  whatToExpectTitle: 'Gute Vibes, positive Energie, One Love',
  whatToExpect:
    'Das One Love Festival dauert zwei Tage. Gespielt wird auf der Main Stage und der Dubstage, die mit Reggae, Roots und Dub neben Marktplatz und Campingplatz liegt. Dazu gibt es einen Markt mit Ständen, Foodtrucks und Getränken sowie ein Kinderprogramm mit Trommel-, Yoga- und Capoeira-Workshops. Gecampt wird unter Obstbäumen, wenige Schritte vom Gelände entfernt.',
  whatToExpectList: [
    'Main Stage und Dubstage für Reggae, Roots und Dub',
    'Marktplatz mit Ständen, Foodtrucks und Getränken',
    'Camping unter Obstbäumen direkt neben dem Gelände',
    'Kinderprogramm mit Trommeln, Yoga und Capoeira',
    'One-Love-Spirit: friedlich, bunt, inklusiv',
    'Gratis-Shuttle vom Bahnhof Wiesen-Sigleß',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🚗',
      label: 'Anreise mit dem Auto',
      text: 'Wiesen liegt im Bezirk Mattersburg im Nordburgenland. Das Parken ist im Festivalticket enthalten.',
    },
    {
      icon: '🚂',
      label: 'Anreise mit der Bahn',
      text: 'Vom Bahnhof Wiesen-Sigleß fährt ein kostenloser Shuttle zum Festivalgelände.',
    },
    {
      icon: '⛺',
      label: 'Camping',
      text: 'Für das Camping braucht man zusätzlich zum Festivalticket ein Camping-Ticket aus dem Ticketshop.',
    },
    {
      icon: '🌿',
      label: 'Festival-Spirit',
      text: 'One Love: Toleranz, Respekt und positive Energie sind die Grundwerte des Festivals.',
    },
  ],
  gallery: [],
  ctaText: 'Musik-Events im Burgenland entdecken',
  ctaLink: '/map?bundesland=Burgenland&category=Musik',
  seoTitle: 'One Love Festival Wiesen 2027: Reggae im Burgenland',
  seoDescription:
    'One Love Festival Wiesen 2027 am 6. und 7. August: Reggae, Roots und Dub im Burgenland. Tickets, Camping, Anreise und Rückblick auf das Lineup 2026.',
  keywords: [
    'One Love Festival Wiesen',
    'One Love Festival 2027',
    'Wiesen Festival 2027',
    'Reggae Festival Österreich',
    'Reggae Festival Burgenland',
    'Dub Festival Österreich',
    'Wiesen Burgenland',
    'Musikfestival Burgenland',
  ],
  jsonLdEvent: {
    name: 'One Love Festival Wiesen 2027',
    startDate: '2027-08-06',
    endDate: '2027-08-07',
    location: 'Festivalgelände Wiesen, 7203 Wiesen, Austria',
    addressCountry: 'AT',
    url: 'https://www.onelovefestival.at',
    description:
      'Das One Love Festival ist ein Reggae-Festival auf dem Festivalgelände Wiesen im Burgenland, die nächste Ausgabe findet am 6. und 7. August 2027 statt.',
    image:
      'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1600&q=85&auto=format&fit=crop',
  },
};
