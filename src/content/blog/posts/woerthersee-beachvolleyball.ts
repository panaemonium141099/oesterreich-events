import type { FestivalPost } from '../types';

// Geprüft am 2026-10-27, ob es das Turnier noch gibt, gegen vol.at (Artikel 6301507:
// Major 2017 wegen Finanzierungsproblemen von Klagenfurt nach Wien übersiedelt),
// nussli.com/en/projects/klagenfurt-beach-volleyball-major (1997 bis 2016, Tribüne ca. 5.000),
// volleynet.at/articles/769 (hitschies MASTERS Pörtschach 22. bis 25.05.2026, Werzers Arena,
// 1.000 Sitzplätze) und beach-woerthersee.at (Veranstalter Verein Union SPORTHLETIX).
// Vorher falsch: Grand Slam 2026 in Klagenfurt (29.07. bis 02.08.) erfunden, das Turnier
// findet seit 2017 nicht mehr in Klagenfurt statt; Website beachklagenfurt.at existiert
// nicht; Preise, 8.000 Zuschauer pro Tag und das Lineup ohne Beleg. Post auf den Stand
// umgeschrieben, jsonLdEvent entfernt (kein Termin 2027 veröffentlicht).
export const post: FestivalPost = {
  slug: 'woerthersee-beachvolleyball',
  title: 'Beachvolleyball am Wörthersee',
  subtitle: 'Vom legendären Grand Slam in Klagenfurt zum MASTERS in Pörtschach',
  heroImage: '/images/blog/woerthersee-beachvolleyball/hero.jpg',
  thumbnailImage: '/images/blog/woerthersee-beachvolleyball/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  readingTime: 4,
  excerpt:
    'Den Beach Volleyball Grand Slam in Klagenfurt gibt es nicht mehr: Das Turnier übersiedelte 2017 nach Wien. Am Wörthersee wird trotzdem wieder gebaggert, 2026 beim MASTERS der nationalen Tour in Pörtschach.',
  category: 'Sport & Outdoor',
  categoryColor: 'bg-blue-600 text-white',
  keyFacts: {
    dates: 'Grand Slam Klagenfurt: nicht mehr ausgetragen (bis 2016). MASTERS Pörtschach 2026: 22. bis 25. Mai, Termin 2027 folgt',
    location: 'Werzers Arena, Pörtschach am Wörthersee (Grand Slam früher in Klagenfurt)',
    address: 'Werzers Arena, 9210 Pörtschach am Wörthersee',
    genre: 'Beachvolleyball, nationale Tour',
    price: 'Infos beim Veranstalter auf beach-woerthersee.at',
    website: 'https://beach-woerthersee.at',
    capacity: '1.000 Sitzplätze (Arena Pörtschach 2026)',
  },
  lineup: [],
  lineupTitle: 'Programm-Highlights',
  lineupNote:
    'Für 2027 ist noch kein Termin und kein Teilnehmerfeld veröffentlicht. Infos kommen über beach-woerthersee.at und volleynet.at.',
  intro:
    'Wer nach dem Beach Volleyball Grand Slam am Wörthersee sucht, sucht nach einem Stück Geschichte: Von 1997 bis 2016 spielte die Weltelite am Klagenfurter Ufer des Sees, 2017 übersiedelte das Turnier nach Wien. Ganz verschwunden ist der Sand vom See aber nicht. Im Mai 2026 machte die win2day Beach Volleyball Tour PRO, die nationale Tour mit Österreichs besten Teams und internationalen Gästen, mit dem hitschies MASTERS Halt in Pörtschach.',
  historyTitle: 'Klagenfurt: 20 Jahre Beachvolleyball am See',
  history:
    'Das Turnier am Klagenfurter Wörthersee begann 1997 und wurde von Hannes Jagerhofer veranstaltet. Klagenfurt war zudem Schauplatz der Europameisterschaften 2013 und 2015, die Haupttribüne bot rund 5.000 Plätze. 2017 zog das Major nach Wien, laut Jagerhofer wegen Problemen mit der öffentlichen Finanzierung in Kärnten; eine Rückkehr nannte er mittelfristig unrealistisch. Spielerinnen wie Dorina und Ronja Klinger erzählen bis heute, dass sie als Kinder beim Grand Slam in Klagenfurt zugeschaut haben.',
  whatToExpectTitle: 'Beachvolleyball am Wörthersee heute',
  whatToExpect:
    'Das hitschies MASTERS Pörtschach powered by Kelag fand vom 22. bis 25. Mai 2026 statt. Für das Turnier wurden 275 Tonnen Sand nach Pörtschach gebracht, in der Werzers Arena standen 1.000 Sitzplätze zur Verfügung. Es war das zweite MASTERS der Saison der win2day Beach Volleyball Tour PRO. Ob und wann es 2027 wieder stattfindet, ist noch nicht veröffentlicht.',
  whatToExpectList: [
    'Österreichs beste Beachvolleyball-Teams und internationale Gäste',
    'Arena mit 1.000 Sitzplätzen direkt in Pörtschach am Wörthersee',
    'Turnier der nationalen win2day Beach Volleyball Tour PRO, nicht der Welttour',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎟️',
      label: 'Infos',
      text: 'Termine und Details zum MASTERS Pörtschach auf beach-woerthersee.at, den Tourkalender gibt es auf volleynet.at.',
    },
    {
      icon: '🚂',
      label: 'Anreise',
      text: 'Pörtschach am Wörthersee hat einen eigenen Bahnhof an der Bahnstrecke zwischen Klagenfurt und Villach.',
    },
    {
      icon: '🏐',
      label: 'Größere Turniere',
      text: 'Das frühere Klagenfurter Major lief ab 2017 in Wien weiter. Internationale Turniere in Österreich stehen im Kalender des Volleyballverbands auf volleynet.at.',
    },
  ],
  gallery: [],
  ctaText: 'Sport-Events am Wörthersee entdecken',
  ctaLink: '/map?bundesland=Kärnten&category=Sport',
  seoTitle: 'Beachvolleyball Wörthersee: Was aus dem Grand Slam wurde',
  seoDescription:
    'Den Beach Volleyball Grand Slam in Klagenfurt gibt es seit 2017 nicht mehr. 2026 spielte die nationale Tour beim MASTERS in Pörtschach am Wörthersee.',
  keywords: [
    'Beachvolleyball Wörthersee',
    'Beach Volleyball Klagenfurt',
    'Grand Slam Klagenfurt',
    'MASTERS Pörtschach',
    'Wörthersee Sport Event',
    'Beachvolleyball Kärnten',
    'Beachvolleyball Pörtschach',
    'Beachvolleyball Österreich',
    'Wörthersee Sommer',
  ],
};
