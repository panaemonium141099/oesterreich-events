import type { FestivalPost } from '../types';

// Geprüft am 2026-10-27 gegen den Regattakalender 2026 des Kärntner Segelverbands
// (kyck.at/wp-content/uploads/2026/02/Regattakalender-2026.pdf, Stand 27.01.2026, verlinkt
// von landessegelverband.at), uycwoe.at (Union Yacht Club Wörthersee, seit 1886) und yca.at.
// Vorher falsch: eine „Klagenfurter Wörthersee Regatta“ am 7. bis 9. August 2026 gibt es im
// Kalender nicht; der Yacht Club Austria (yca.at) sitzt in Linz und ist kein Wörthersee-
// Club; „Segelclub Klagenfurt, Metnitzstrand“, 400 Boote, Nenngeld ab 60 €, „seit den
// 1960ern“ und die Seelänge von 19 km ohne Beleg. Post auf die tatsächliche Regattaszene
// (Wörthersee Cup, Wörthersee-Segelwoche) umgeschrieben; Kalender 2027 noch nicht veröffentlicht.
export const post: FestivalPost = {
  slug: 'woerthersee-regatta',
  title: 'Segelregatten am Wörthersee',
  subtitle: 'Wörthersee Cup und Wörthersee-Segelwoche: der Regattasommer am größten See Kärntens',
  heroImage: '/images/blog/woerthersee-regatta/hero.jpg',
  thumbnailImage: '/images/blog/woerthersee-regatta/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://kyck.at/wp-content/uploads/2026/02/Regattakalender-2026.pdf',
      'https://www.yca.at',
    ],
  },
  readingTime: 5,
  excerpt:
    'Eine einzelne große „Wörthersee Regatta“ gibt es nicht, dafür einen dichten Regattasommer: Acht Segelclubs am See laden von April bis September zu Wettfahrten, mit dem Wörthersee Cup und der Wörthersee-Segelwoche des Union Yacht Club Wörthersee als Höhepunkten.',
  category: 'Sport & Outdoor',
  categoryColor: 'bg-cyan-700 text-white',
  keyFacts: {
    dates: 'Saison 2026: April bis September, Wörthersee-Segelwoche 14. bis 16. August. Kalender 2027 folgt',
    location: 'Wörthersee: Klagenfurt, Krumpendorf, Pörtschach, Velden, Dellach (Maria Wörth), Schiefling',
    address: 'Union Yacht Club Wörthersee, Süduferstraße 236, 9082 Maria Wörth',
    genre: 'Segeln, Regatta, Yardstick, Clubsport',
    price: 'Nenngeld laut Ausschreibung des jeweiligen Clubs',
    website: 'https://www.landessegelverband.at',
  },
  lineup: [
    { name: '24 Stunden Regatta (KYCK)', role: 'headliner', day: '26. bis 27. Juni 2026' },
    { name: 'Veldener Goldpokal (Yacht Club Velden)', role: 'support', day: '12. Juli 2026' },
    { name: 'Silberner Schwan und Hafenfest (Klagenfurter Segelverein Loretto)', role: 'support', day: '25. Juli 2026' },
    { name: 'Wörthersee-Segelwoche mit Elschnig Slalom (UYCWö)', role: 'headliner', day: '14. bis 16. August 2026' },
    { name: 'Cup Weißes Rössl (Yacht Club Schiefling Wörthersee)', role: 'support', day: '29. August 2026' },
    { name: 'Preis von Pörtschach (Kärntner Yacht Club Pörtschach)', role: 'support', day: '5. September 2026' },
  ],
  lineupTitle: 'Rückblick: Wörthersee Cup und Segelwoche 2026',
  lineupNote:
    'Termine laut Regattakalender 2026 des Kärntner Segelverbands. Der Kalender für 2027 ist noch nicht veröffentlicht, er erscheint auf landessegelverband.at.',
  intro:
    'Der Wörthersee ist der größte See Kärntens und ein Revier mit langer Segeltradition. Statt einer einzelnen großen Regatta gibt es hier einen ganzen Regattasommer: Zehn Clubs des Kärntner Segelverbands, die meisten davon am Wörthersee, tragen zwischen April und September Wettfahrten aus, von der Jollenregatta über Jugendwochen bis zur 24-Stunden-Regatta. Ausgewählte Wettfahrten zählen zum Wörthersee Cup, und im August lädt der Union Yacht Club Wörthersee zur Wörthersee-Segelwoche.',
  historyTitle: 'Segel-Tradition am Wörthersee',
  history:
    'Der Union Yacht Club Wörthersee in Dellach am Südufer wurde 1886 gegründet und ist nach eigenen Angaben der zweitälteste Segelclub Österreichs; 2026 feierte er sein 140-jähriges Bestehen. Daneben segeln am See unter anderem der Kärntner Yacht Club Klagenfurt mit Clubgelände in Krumpendorf, der Kärntner Yacht Club Pörtschach, der Klagenfurter Segelverein Loretto, der Yacht Club Velden, die Carinthian Fleet Techelsberg-Wörthersee und der Yacht Club Schiefling Wörthersee. Ihre Termine stimmt der Kärntner Segelverband in einem gemeinsamen Regattakalender ab.',
  whatToExpectTitle: 'Segelsport, Seeufer und Sommerfreude',
  whatToExpect:
    'Die meisten Wettfahrten am Wörthersee sind Yardstick-Regatten, bei denen unterschiedliche Bootstypen über eine Ausgleichszahl gegeneinander antreten. Dazu kommen Klassenregatten, Landesmeisterschaften und 2026 sogar die Finn-Staatsmeisterschaft beim UYCWö. Den Wörthersee Cup bilden sechs ausgewählte Regatten, zu denen laut Verband immer ein Schlepp organisiert wird. Die Wörthersee-Segelwoche im August verbindet kurze Wettfahrten, eine lange Wettfahrt und den Elschnig Slalom.',
  whatToExpectList: [
    'Wörthersee Cup: sechs Regatten von Juni bis September',
    'Wörthersee-Segelwoche des UYCWö im August',
    'Freitagsregatten im Wörthersee West Freitags Cup',
    'Jugendwochen für Opti, 29er, Laser, 420er und 470er',
    'Landesmeisterschaften und Klassenregatten',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '⛵',
      label: 'Für Segler',
      text: 'Ausschreibung, Nennung und Startzeiten veröffentlicht der jeweils veranstaltende Club. Für alle Yachten ist eine gültige Haftpflichtversicherung Pflicht.',
    },
    {
      icon: '📅',
      label: 'Regattakalender',
      text: 'Alle Termine der Kärntner Clubs stehen im Regattakalender des Kärntner Segelverbands auf landessegelverband.at.',
    },
    {
      icon: '🚗',
      label: 'Anreise',
      text: 'Die Clubs liegen rund um den See, von Klagenfurt und Krumpendorf über Pörtschach bis Velden und Dellach. Welcher Hafen gilt, steht in der Ausschreibung.',
    },
    {
      icon: '🌤️',
      label: 'Wetter',
      text: 'Kärntner Sommer mit bis zu 35 °C. Sonnenschutz, ausreichend Wasser und Badekleidung für den anschließenden Seebad empfohlen.',
    },
  ],
  gallery: [],
  ctaText: 'Wassersport-Events am Wörthersee entdecken',
  ctaLink: '/map?bundesland=Kärnten&category=Sport',
  seoTitle: 'Segelregatten am Wörthersee: Wörthersee Cup und Segelwoche',
  seoDescription:
    'Regatten am Wörthersee: Wörthersee Cup mit sechs Wettfahrten, Wörthersee-Segelwoche des UYCWö im August, Clubs und Regattakalender des Kärntner Segelverbands.',
  keywords: [
    'Wörthersee Regatta',
    'Segeln Wörthersee',
    'Wörthersee Cup',
    'Wörthersee-Segelwoche',
    'Union Yacht Club Wörthersee',
    'Regatta Kärnten',
    'Kärntner Segelverband Regattakalender',
    'Wassersport Wörthersee',
    'Kärntner Yacht Club Klagenfurt',
    'Wörthersee Sommer Sport',
  ],
  jsonLdEvent: {
    name: 'Wörthersee-Segelwoche 2026',
    startDate: '2026-08-14',
    endDate: '2026-08-16',
    location: 'Union Yacht Club Wörthersee, Süduferstraße 236, 9082 Maria Wörth, Austria',
    addressCountry: 'AT',
    url: 'https://www.landessegelverband.at',
    description:
      'Die Wörthersee-Segelwoche des Union Yacht Club Wörthersee mit kurzen Wettfahrten, langer Wettfahrt und Elschnig Slalom; der Slalom zählt zum Wörthersee Cup.',
    image:
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1600&q=85&auto=format&fit=crop',
  },
};
