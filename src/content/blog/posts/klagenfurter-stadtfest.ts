import type { FestivalPost } from '../types';

// Geprüft am 2026-10-27 gegen stadtrichter.at/altstadtzauber/ und
// /altstadtzauber/karte-und-programm/ (Veranstalter Die Stadtrichter zu Clagenfurth),
// die StadtZeitung auf klagenfurt.at (Ausgabe 29.07.2026) und 5min.at (30. Ausgabe).
// Im Kern falsch: Ein "Klagenfurter Stadtfest" am 26. bis 28. Juni am Neuen Platz gibt
// es nicht; das Stadtfest Klagenfurts ist der Altstadtzauber, 2026 zum 30. Mal am 6. bis
// 8. August. Ebenfalls falsch bzw. ohne Beleg: "seit 1980"/Wurzeln in den 1980ern,
// "ca. 80.000 Besucher", Bühnen in Theatergasse und Burggasse, Tanz bis in die
// Morgenstunden (Bühnen bis 22 Uhr), Website klagenfurt.at (nur Stadtportal),
// Bus- und Zugzeiten. Kein Termin 2027 veröffentlicht.
export const post: FestivalPost = {
  slug: 'klagenfurter-stadtfest',
  title: 'Klagenfurter Stadtfest: der Altstadtzauber',
  subtitle: 'Drei Tage Musik, Straßenkunst und Flohmarkt in der Klagenfurter Altstadt',
  heroImage: '/images/blog/klagenfurter-stadtfest/hero.jpg',
  thumbnailImage: '/images/blog/klagenfurter-stadtfest/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  readingTime: 6,
  excerpt:
    'Das Stadtfest der Kärntner Landeshauptstadt heißt Altstadtzauber. Jeden Sommer bespielen Bands, Straßenkünstler und ein großer Flohmarkt drei Tage lang die Plätze und Gassen der Klagenfurter Altstadt.',
  category: 'Festivals & Feste',
  categoryColor: 'bg-yellow-600 text-white',
  keyFacts: {
    dates: '6. bis 8. August 2026 (Termin 2027 folgt)',
    location: 'Klagenfurter Altstadt: Neuer Platz, Alter Platz, Heuplatz, Pfarrplatz und weitere',
    address: 'Neuer Platz, 9020 Klagenfurt am Wörthersee',
    genre: 'Stadtfest, Livemusik, Straßenkunst, Flohmarkt',
    price: 'Eintritt frei',
    website: 'https://www.stadtrichter.at/altstadtzauber/',
  },
  lineup: [
    { name: 'Die Kaiser', role: 'headliner', day: 'Donnerstag, 6. August 2026', stage: 'Kronen Zeitung Bühne, Neuer Platz' },
    { name: 'Die 3 Lavanttaler', role: 'headliner', day: 'Donnerstag, 6. August 2026', stage: 'Stadtwerke Bühne, Dr.-Arthur-Lemisch-Platz' },
    { name: 'Soul Kuch\'l', role: 'support', day: 'Freitag, 7. August 2026', stage: 'CityArkaden Bühne, Heuplatz' },
    { name: 'Seven For Tea', role: 'support', day: 'Freitag, 7. August 2026', stage: 'Kronen Zeitung Bühne, Neuer Platz' },
    { name: 'Die Elchos', role: 'support', day: 'Samstag, 8. August 2026', stage: 'CityArkaden Bühne, Heuplatz' },
    { name: 'The Shakin Cadillacs', role: 'support', day: 'Samstag, 8. August 2026', stage: 'Schleppe Bier Bühne, Pfarrplatz' },
  ],
  lineupTitle: 'Programm-Highlights',
  lineupNote:
    'Auswahl aus dem Programm 2026 laut stadtrichter.at. Bühnen 2026: CityArkaden Bühne (Heuplatz), Kronen Zeitung Bühne (Neuer Platz), Schleppe Bier Bühne (Pfarrplatz), Stadtwerke Bühne (Dr.-Arthur-Lemisch-Platz) und Superfly Summer Sessions (Alter Platz). Das Programm für 2027 ist noch nicht veröffentlicht.',
  intro:
    'Einmal im Jahr gehört die Klagenfurter Innenstadt den Bürgerinnen und Bürgern sowie ihren Gästen. Das Stadtfest der Kärntner Landeshauptstadt heißt Altstadtzauber: Drei Tage lang spielen Bands auf mehreren Bühnen in der Altstadt, Straßenkünstler unterhalten in den Gassen, und rund um den Domplatz lockt ein großer Flohmarkt. 2026 fand der Altstadtzauber von 6. bis 8. August zum 30. Mal statt, eröffnet am Donnerstagabend am Neuen Platz.',
  historyTitle: 'Drei Jahrzehnte Altstadtzauber',
  history:
    'Veranstaltet wird der Altstadtzauber von den Stadtrichtern zu Clagenfurth, einem Klagenfurter Verein, der auch den Flohmarkt und die Show „Stadtgerücht“ organisiert, in Zusammenarbeit mit der Stadt Klagenfurt. 2026 feierte das Fest seine 30. Ausgabe. Ein Gründungsjahr nennen die Veranstalter nicht. Die Stadtrichter beschreiben den Altstadtzauber als traditionelles Fest im Alpen-Adria-Raum.',
  whatToExpectTitle: 'Was der Altstadtzauber bietet',
  whatToExpect:
    'Der Altstadtzauber erstreckt sich über mehrere Plätze und Gassen der Klagenfurter Altstadt. Auf den Bühnen spielen Bands von Jazz über Rock, Soul und Funk bis zu internationaler Folklore. In Kramergasse, Wienergasse, am Alten Platz und im Landhaushof zeigen Straßenkünstler Jonglage, Akrobatik, Pantomime, Zauberei und Comedy. Am Freitag und Samstag läuft der Flohmarkt am Domplatz, im Landhaushof gibt es eine Kinderwelt.',
  whatToExpectList: [
    'Mehrere Freilichtbühnen mit Live-Konzerten unterschiedlicher Genres',
    'Straßenkunst: Jonglage, Akrobatik, Pantomime, Zauberei, Comedy und Drehorgelspieler',
    'Flohmarkt rund um den Domplatz',
    'Kinderwelt im Landhaushof',
    'Frühschoppen am Samstag',
    '„Momente für die Seele“ in der Stadtpfarrkirche',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎉',
      label: 'Eintritt',
      text: 'Der Eintritt ist frei.',
    },
    {
      icon: '🕖',
      label: 'Zeiten 2026',
      text: 'Eröffnung am Donnerstag, 6. August, um 19 Uhr am Neuen Platz. Am Freitag und Samstag spielten die Bühnen bis 22 Uhr, der Flohmarkt am Domplatz öffnete am Freitag um 7 Uhr und endete am Samstag um 16 Uhr.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Die Altstadt ist vom Klagenfurter Hauptbahnhof zu Fuß oder mit dem Stadtbus erreichbar. Öffentliche Anreise empfohlen.',
    },
    {
      icon: '🌤️',
      label: 'Wetter',
      text: 'Klagenfurt im August ist meist warm und sonnig. Sonnenschutz tagsüber empfohlen, Abende können kühler werden.',
    },
  ],
  gallery: [],
  ctaText: 'Stadtfest-Events in Kärnten entdecken',
  ctaLink: '/map?bundesland=Kärnten&category=Festival',
  seoTitle: 'Klagenfurter Stadtfest Altstadtzauber: Termin, Programm und Tipps',
  seoDescription:
    'Altstadtzauber Klagenfurt: das Stadtfest der Kärntner Landeshauptstadt, 2026 von 6. bis 8. August. Livemusik, Straßenkunst und Flohmarkt, Eintritt frei.',
  keywords: [
    'Klagenfurter Stadtfest',
    'Altstadtzauber Klagenfurt',
    'Stadtfest Klagenfurt',
    'Volksfest Kärnten',
    'Klagenfurt Sommer Event',
    'Stadtfest Kärnten',
    'Klagenfurt Altstadt Fest',
    'Flohmarkt Klagenfurt Altstadtzauber',
    'Klagenfurt Festival',
    'Kärnten Volksfest',
  ],
  jsonLdEvent: {
    name: 'Altstadtzauber Klagenfurt 2026',
    startDate: '2026-08-06',
    endDate: '2026-08-08',
    location: 'Neuer Platz, 9020 Klagenfurt am Wörthersee, Austria',
    addressCountry: 'AT',
    url: 'https://www.stadtrichter.at/altstadtzauber/',
    description:
      'Der Altstadtzauber ist das Stadtfest von Klagenfurt mit Livemusik auf mehreren Bühnen, Straßenkunst und Flohmarkt in der Altstadt, Eintritt frei.',
    image:
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&q=85&auto=format&fit=crop',
  },
};
