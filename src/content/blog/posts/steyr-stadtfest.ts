import type { FestivalPost } from '../types';

// Termin, Öffnungszeiten, Bühnen, Programm und Anreise 2026 geprüft am 2026-10-27 gegen
// steyr.at/stadtfest (Stadt Steyr, Programm zum 45. Steyrer Stadtfest, 26. bis 28. Juni
// 2026) sowie tips.at (Vorbericht 2026, Absage 2021). Termin 2026 stimmte. Vorher falsch:
// "seit 1990" (2026 war die 45. Ausgabe, ein Gründungsjahr nennt die Stadt nicht),
// Voodoo Jürgens, "Steyr Big Band", "Folkband aus der Steiermark" und eine
// "Ennsufer-Bühne" im Programm (alles nicht im Programm), Besucherzahl "mehrere
// zehntausend" und Fahrzeiten ohne Beleg. Ein Termin 2027 ist noch nicht veröffentlicht.
export const post: FestivalPost = {
  slug: 'steyr-stadtfest',
  title: 'Steyr Stadtfest',
  subtitle: 'Sommerfest in einer der schönsten Altstädte Österreichs',
  heroImage: '/images/blog/steyr-stadtfest/hero.jpg',
  thumbnailImage: '/images/blog/steyr-stadtfest/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://www.steyr.at/stadtfest',
      'https://www.tips.at/nachrichten/steyr/kultur/533794-steyrer-stadtfest-2021-abgesagt',
    ],
  },
  readingTime: 5,
  excerpt:
    'Das Steyr Stadtfest verwandelt die mittelalterliche Altstadt am Zusammenfluss von Enns und Steyr in eine bunte Festmeile. Musik, Kulinarik und Stadtleben unter freiem Himmel.',
  category: 'Festivals',
  categoryColor: 'bg-green-700 text-white',
  keyFacts: {
    dates: '26. bis 28. Juni 2026 (Termin 2027 folgt)',
    location: 'Steyr Stadtplatz, Ennskai und Schlosspark',
    address: 'Stadtplatz, 4400 Steyr',
    genre: 'Stadtfest, Musik, Kulinarik, Kultur',
    price: 'Eintritt frei',
    website: 'https://www.steyr.at/stadtfest',
  },
  lineup: [
    { name: 'HELP! A Beatles Tribute', role: 'headliner', stage: 'Hauptbühne', day: 'Freitag', time: '20:00 Uhr' },
    { name: 'Ecos de Siboney', role: 'headliner', stage: 'Hauptbühne', day: 'Freitag', time: '22:30 Uhr' },
    { name: 'Attwenger', role: 'headliner', stage: 'Neutorbühne', day: 'Freitag', time: '22:00 Uhr' },
    { name: 'Maxi Pongratz', role: 'support', stage: 'Neutorbühne', day: 'Freitag', time: '20:00 Uhr' },
    { name: 'Krautschädl', role: 'headliner', stage: 'Hauptbühne', day: 'Samstag', time: '21:00 Uhr' },
    { name: 'Wiener Planquadrat', role: 'headliner', stage: 'Hauptbühne', day: 'Samstag', time: '22:30 Uhr' },
    { name: 'Buntspecht', role: 'special', stage: 'Grünland Festival, Green Stage', day: 'Samstag', time: '21:35 Uhr' },
    { name: 'BigBand der Musikschule Haidershofen', role: 'support', stage: 'Hauptbühne', day: 'Sonntag', time: '11:30 Uhr' },
  ],
  lineupTitle: 'Programm-Highlights',
  lineupNote:
    'Auswahl aus dem Programm 2026 laut Stadt Steyr (steyr.at/stadtfest). Alle Konzerte waren ohne Ticket zugänglich. Das Programm für 2027 ist noch nicht veröffentlicht.',
  intro:
    'Steyr ist eine der am besten erhaltenen mittelalterlichen Altstädte Österreichs, und beim Stadtfest lebt diese Geschichte auf: Der Stadtplatz, die Gassen und das Ufer der Enns werden zur Festmeile. Drei Tage lang verwandelt sich die sonst ruhige Industriestadt in ein pulsierendes Freiluftfestival. Lokale Gastronomen, Musikbands aus der Region und internationale Gäste machen das Steyr Stadtfest zu einem Highlight des oberösterreichischen Sommers.',
  historyTitle: 'Stadtfest-Tradition am Zusammenfluss von Enns und Steyr',
  history:
    'Das Steyrer Stadtfest fand von 26. bis 28. Juni 2026 bereits zum 45. Mal statt. Ein Gründungsjahr nennt die Stadt Steyr nicht. 2020 und 2021 fiel das Fest wegen Corona aus. Die Idee ist bis heute einfach: Die schöne Altstadt soll belebt werden und Einheimische und Gäste zusammenbringen. Eröffnet wird traditionell mit dem Bieranstich durch den Bürgermeister auf der Hauptbühne am Stadtplatz.',
  whatToExpectTitle: 'Was das Stadtfest 2026 bot',
  whatToExpect:
    'Das Stadtfest 2026 bespielte den Stadtplatz mit der Hauptbühne, die Neutorbühne, eine Bühne am Ennskai (Umkehrplatz) und den Schlosspark, wo parallel das Grünland Festival mit zwei Bühnen lief. Dazu kamen das Badgassnfest mit Flohmarkt und Frühschoppen, ein Kreativmarkt mit 29 Aussteller:innen aus der Region und ein Kinderprogramm auf der Wiese vor der Orangerie. Am Sonntagvormittag startete der Stadtlauf am Stadtplatz. Geöffnet war am Freitag von 14 bis 2 Uhr, am Samstag von 10 bis 2 Uhr und am Sonntag von 9 bis 14 Uhr.',
  whatToExpectList: [
    'Hauptbühne am Stadtplatz, Neutorbühne und Bühne am Ennskai',
    'Grünland Festival im Schlosspark mit Green Stage und Charity Stage',
    'Badgassnfest mit Flohmarkt und Frühschoppen am Samstag',
    'Kreativmarkt mit Ausstellerinnen und Ausstellern aus der Region',
    'Kinderprogramm und Yoga auf der Wiese vor der Orangerie',
    'Stadtlauf am Sonntagvormittag mit Start und Ziel am Stadtplatz',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎪',
      label: 'Eintritt',
      text: 'Das Stadtfest ist kostenlos zugänglich. Alle Konzerte können ohne Ticket besucht werden.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Die Stadt empfiehlt die Öffis: Das Freizeit-Ticket OÖ kostete 2026 26,50 Euro. Die Stadtbusse fuhren in beiden Festnächten stündlich bis 0:55 Uhr ab Busbahnhof. Mit dem Auto: Stadtplatzgarage in der Dukartstraße, von dort rund fünf Minuten über den Enns-Steg. Radabstellplätze bei den Zwischenbrücken.',
    },
    {
      icon: '🍺',
      label: 'Gastronomie',
      text: 'Lokale Wirte und Stände bieten regionale Küche. Beim Badgassnfest gab es 2026 auch vegane Schmankerl. Kostenlose Trinkwasserstelle vor dem Rathaus.',
    },
    {
      icon: '🏨',
      label: 'Unterkunft',
      text: 'Hotels und Pensionen in Steyr rechtzeitig buchen, denn Festwochenenden sind begehrt. Steyr bietet charmante Altstadtunterkünfte für ein volles Erlebnis.',
    },
  ],
  gallery: [],
  ctaText: 'Sommerfeste in Oberösterreich entdecken',
  ctaLink: '/map?bundesland=Oberoesterreich&category=Festivals',
  seoTitle: 'Steyr Stadtfest 2026: Programm, Termin & Tipps',
  seoDescription:
    'Steyr Stadtfest 2026 (26. bis 28. Juni): Gratis Sommerfest in Steyrs mittelalterlicher Altstadt. Musik, Kulinarik & Kultur am Ennsufer. Programm & Tipps.',
  keywords: [
    'Steyr Stadtfest 2026',
    'Stadtfest Steyr Programm',
    'Stadtfest Oberösterreich',
    'Steyr Stadtplatz Fest',
    'Sommerfest Steyr',
    'Steyr Altstadt Events',
    'Stadtfest Österreich',
    'Steyr Juni Festival',
    'Stadtfest Oberösterreich kostenlos',
    'Events Steyr',
  ],
  jsonLdEvent: {
    name: 'Steyr Stadtfest 2026',
    startDate: '2026-06-26',
    endDate: '2026-06-28',
    location: 'Stadtplatz, 4400 Steyr, Austria',
    addressCountry: 'AT',
    url: 'https://www.steyr.at/stadtfest',
    description:
      'Das 45. Steyrer Stadtfest: drei Tage Musik auf mehreren Bühnen, Kulinarik und Stadtleben in der Steyrer Altstadt, Eintritt frei.',
    image:
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1600&q=85&auto=format&fit=crop',
  },
};
