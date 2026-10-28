import type { FestivalPost } from '../types';

// Termin, Uhrzeiten, Stationen und Regeln geprüft am 2026-10-27 gegen wien.info/de/aktuell/
// weihnachten/silvester-358870 (Silvester 2026/27: 31.12., 14 bis 2 Uhr, acht Locations) und
// wienersilvesterpfad.at (Startseite, /faq/; 35. Ausgabe, Pyrotechnikverbot). Besucherzahlen
// laut Stadt Wien via vienna.at (2025/26 rund 550.000, Vorjahr knapp 800.000), Beginn 1990 und
// Absagen 2020/2021 laut leadersnet.at/falter.at, 32. Ausgabe 2023/24 laut orf.at. Die alte
// URL wien.gv.at/freizeit/feiern/silvesterpfad/ lieferte 404. Vorher falsch: Feuerwerke am
// Prater, Rathausplatz und Stephansplatz (es gibt kein Silvesterpfad-Feuerwerk, Pyrotechnik
// ist verboten), sechs Bühnen samt erfundener Stationen (Volksgarten, Praterstern), Beginn
// 1991, "bis zu 600.000 Besucher", jsonLd-Beginn 18 Uhr (tatsächlich 14 Uhr).
export const post: FestivalPost = {
  slug: 'wiener-silvesterpfad',
  title: 'Wiener Silvesterpfad',
  subtitle: 'Wiens große Open-Air-Silvesterparty, kostenlos in der Innenstadt',
  heroImage: '/images/blog/wiener-silvesterpfad/hero.jpg',
  thumbnailImage: '/images/blog/wiener-silvesterpfad/thumb.jpg',
  publishDate: '2026-03-31',
  updatedDate: '2026-10-27',
  readingTime: 5,
  excerpt:
    'Am 31. Dezember feiert Wien beim Silvesterpfad den Jahreswechsel unter freiem Himmel. Acht Stationen von der Freyung bis zum Prater, Hunderttausende Besucher und um Mitternacht der Donauwalzer.',
  category: 'Musik & Festival',
  categoryColor: 'bg-purple-700 text-white',
  keyFacts: {
    dates: '31. Dezember 2026, 14 Uhr bis 1. Jänner 2027, 2 Uhr',
    location: 'Wiener Innenstadt (Rathausplatz, Freyung, Am Hof, Graben, Stephansplatz u.a.) und Prater',
    address: 'Rathausplatz, 1010 Wien',
    genre: 'Pop, Rock, Soul, Disco, DJ-Sets, Walzer',
    price: 'Eintritt frei',
    website: 'https://wienersilvesterpfad.at/',
    capacity: 'rund 550.000 Besucher (2025/26, laut Stadt Wien)',
    since: '1990',
  },
  lineup: [
    { name: 'Rathausplatz', role: 'headliner', stage: 'Rathausplatz' },
    { name: 'Freyung', role: 'support', stage: 'Freyung' },
    { name: 'Am Hof', role: 'support', stage: 'Am Hof' },
    { name: 'Graben mit Walzerkursen', role: 'special', stage: 'Graben' },
    { name: 'Stephansplatz', role: 'headliner', stage: 'Stephansplatz' },
    { name: 'Kärntner Straße', role: 'support', stage: 'Kärntner Straße' },
    { name: 'Neuer Markt', role: 'support', stage: 'Neuer Markt' },
    { name: 'Wintermarkt am Riesenradplatz', role: 'special', stage: 'Prater' },
  ],
  lineupTitle: 'Die acht Stationen',
  lineupNote: 'Stationen laut wienersilvesterpfad.at. Das Bühnenprogramm 2026/27 veröffentlicht stadt wien marketing auf der offiziellen Website.',
  intro:
    'Wenn die Uhr in der Nacht auf den 1. Jänner Mitternacht schlägt, feiert die Wiener Innenstadt unter freiem Himmel. Beim Wiener Silvesterpfad zogen zuletzt rund 550.000 Menschen durch die beleuchtete City, im Jahr davor waren es knapp 800.000. Der Pfad führt von der Freyung über Am Hof, Graben und Stephansplatz durch die Kärntner Straße bis zum Neuen Markt, dazu kommen der Rathausplatz und der Wintermarkt am Riesenradplatz im Prater. Livemusik, LED-Wände und um Mitternacht der Donauwalzer zum Klang der Pummerin machen den Jahreswechsel zum Erlebnis. Das Beste: Der Eintritt ist kostenlos.',
  historyTitle: 'Seit 1990: Silvester auf Wienerisch',
  history:
    'Den ersten Wiener Silvesterpfad gab es zum Jahreswechsel 1990/91. 2020 und 2021 fiel er wegen der Pandemie aus, die ersten Absagen nach 30 Jahren. Veranstaltet wird er von stadt wien marketing. Zum Jahreswechsel 2026/27 findet die 35. Ausgabe statt, an acht Stationen von der Freyung bis zum Prater.',
  whatToExpectTitle: 'Was erwartet dich am Silvesterpfad?',
  whatToExpect:
    'Der Silvesterpfad erstreckt sich über mehrere Kilometer durch die Wiener Innenstadt, dazu kommt der Wintermarkt im Prater. Entlang des Weges gibt es Livemusik verschiedener Genres, von Pop, Rock, Blues, Funk und Soul über Disco und lateinamerikanische Rhythmen bis zu DJ-Sets. Am Graben gibt es Walzerkurse, um Mitternacht tanzen alle zum Donauwalzer und zur Pummerin ins neue Jahr. Zahlreiche Glühwein- und Punschstände sorgen für Wärme.',
  whatToExpectList: [
    '8 Stationen entlang des Pfades und im Prater',
    'Um Mitternacht: Donauwalzer und Pummerin',
    'Kostenloser Eintritt für alle Bereiche',
    'Gastronomie mit warmen Getränken und Street Food, ab 11 Uhr',
    'Walzerkurse am Graben, eigenes Programm für Kinder',
    'Visual Jockeys mit Animationen und Lichteffekten auf großen LED-Wänden',
  ],
  practicalInfoTitle: 'Praktische Infos für Silvester in Wien',
  practicalInfo: [
    {
      icon: '🚇',
      label: 'Öffentliche Verkehrsmittel',
      text: 'Alle U-Bahn-Linien und zahlreiche Bus- und Straßenbahnlinien fahren die ganze Nacht. Öffis sind die beste Option.',
    },
    {
      icon: '🕙',
      label: 'Anreise-Tipp',
      text: 'Bei großem Andrang wird das Gelände für weitere Gäste gesperrt, beim letzten Jahreswechsel kurz vor Mitternacht. Früh kommen lohnt sich.',
    },
    {
      icon: '🧤',
      label: 'Kleidung',
      text: 'Silvester in Wien kann eisig sein. Sehr warme Kleidung, Handschuhe und Mütze sind Pflicht.',
    },
    {
      icon: '🚫',
      label: 'Was verboten ist',
      text: 'Feuerwerkskörper und Böller sind am Gelände verboten (erlaubt sind nur Wunderkerzen), ebenso Glasflaschen, Dosen und PET-Flaschen. Getränke gibt es in Pfandbechern.',
    },
  ],
  gallery: [],
  ctaText: 'Silvester-Events in Wien entdecken',
  ctaLink: '/map?category=Musik&region=Wien',
  seoTitle: 'Wiener Silvesterpfad 2026/27: Silvester Wien',
  seoDescription:
    'Wiener Silvesterpfad 2026/27: 8 Stationen, Donauwalzer um Mitternacht und freier Eintritt, am 31. Dezember von 14 bis 2 Uhr in der Wiener Innenstadt.',
  keywords: [
    'Wiener Silvesterpfad',
    'Silvester Wien',
    'Silvester Innenstadt Wien',
    'Silvesterparty Wien kostenlos',
    'Wien Neujahr',
    'Silvester Feuerwerk Wien',
    'New Year Vienna',
    'Silvesterpfad 2026',
    'Wien 31. Dezember',
    'Silvester Open Air Wien',
  ],
  jsonLdEvent: {
    name: 'Wiener Silvesterpfad 2026/27',
    startDate: '2026-12-31T14:00:00+01:00',
    endDate: '2027-01-01T02:00:00+01:00',
    location: 'Rathausplatz, 1010 Wien, Austria',
    addressCountry: 'AT',
    url: 'https://wienersilvesterpfad.at/',
    description:
      'Der Wiener Silvesterpfad ist die kostenlose Silvesterfeier in der Wiener Innenstadt mit acht Stationen, zuletzt rund 550.000 Besuchern und dem Donauwalzer um Mitternacht.',
    image:
      'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=1600&q=85&auto=format&fit=crop',
  },
};
