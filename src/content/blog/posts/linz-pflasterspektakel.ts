import type { FestivalPost } from '../types';

// Termine 2026/2027, Umfang, Besucherzahl und Programmformate geprüft am 2026-10-27 gegen
// pflasterspektakel.at (Startseite), pflasterspektakel.at/wp-content/uploads/Allgemeine-
// Presseinfo_Linzer-Pflasterspektakel-2026.pdf und .../Bilanz_38_Pflasterspektakel.pdf
// (Stadt Linz, Linz Kultur). Termin 23. bis 25. Juli 2026 war richtig. Vorher falsch:
// Gründung "1985" (Stadt Linz nennt rund 40 Jahre, 2026 war die 38. Ausgabe; Gründungsjahr
// in Quellen uneinheitlich, deshalb weggelassen), erfundenes Lineup (Circa, Gravity & Other
// Myths, Les Grandes Personnes u. a.), "über 30 Länder", "mehr als 20 Auftrittsorte",
// "ca. 100.000 Besucher" (2026: rund 250.000), "Europas größtes Straßenkunstfestival".
export const post: FestivalPost = {
  slug: 'linz-pflasterspektakel',
  title: 'Linz Pflasterspektakel',
  subtitle: 'Eines der größten Straßenkunstfestivals Europas mitten im Herzen von Linz',
  heroImage: '/images/blog/linz-pflasterspektakel/hero.jpg',
  thumbnailImage: '/images/blog/linz-pflasterspektakel/thumb.jpg',
  publishDate: '2026-04-01',
  updatedDate: '2026-10-27',
  factSources: {
    checkedAt: '2026-10-27',
    urls: [
      'https://pflasterspektakel.at/wp-content/uploads/Bilanz_38_Pflasterspektakel.pdf',
      'https://pflasterspektakel.at/wp-content/uploads/Allgemeine-Presseinfo_Linzer-Pflasterspektakel-2026.pdf',
    ],
  },
  readingTime: 6,
  excerpt:
    'Drei Tage lang verwandeln Akrobaten, Clowns, Musiker und Zauberer die Linzer Innenstadt in eine riesige Freilichtbühne. Das Pflasterspektakel ist kostenlos, bunt und für alle.',
  category: 'Festivals',
  categoryColor: 'bg-orange-600 text-white',
  keyFacts: {
    dates: '15. bis 17. Juli 2027 (2026: 23. bis 25. Juli)',
    location: 'Linzer Innenstadt, rund 40 Spielorte (u. a. Altstadt, rund ums Schloss, Donaupark)',
    address: 'Linzer Innenstadt, 4020 Linz',
    genre: 'Straßenkunst, Artistik, Musik, Theater',
    price: 'Eintritt frei, Hutgeld für die Künstler',
    website: 'https://www.pflasterspektakel.at',
    capacity: 'rund 250.000 Besucher (2026)',
  },
  lineup: [
    { name: 'Cia. Cop D’Ull: "Show to go", Stadtrundgang mit dem Clown-Paar', role: 'special', stage: 'Innenstadt', day: '2026' },
  ],
  lineupTitle: 'Programm-Highlights',
  lineupNote:
    'Die Künstlerinnen und Künstler 2027 stellt die Stadt Linz laut Veranstalterin Mitte Juni vor. Auftrittszeiten und Spielorte wählen sie am Festivaltag selbst, sie stehen im täglichen Tagesprogramm. Alle Aufführungen sind kostenlos und erfordern keine Reservierung.',
  intro:
    'Wenn die Linzer Innenstadt im Juli zur großen Freiluftbühne wird, dann ist Pflasterspektakel-Zeit. Über 100 Solokünstlerinnen, Solokünstler und Compagnien aus aller Welt zeigen drei Tage lang Akrobatik, Jonglage, Clownerie, Magie, Figurentheater, Feuershows und Musik auf Plätzen und in Gassen. Was das Pflasterspektakel so besonders macht: Der Eintritt ist frei. Wer möchte, gibt nach der Vorstellung Hutgeld und bekommt dafür Straßenkunst mitten im Alltag.',
  historyTitle: 'Rund 40 Jahre Straßenkunst in Linz',
  history:
    'Das Linzer Pflasterspektakel wird von der Stadt Linz (Linz Kultur) veranstaltet und hat sich in rund 40 Jahren zu einem der bedeutendsten Straßenkunstfestivals Europas entwickelt. 2026 fand es zum 38. Mal statt: Vom 23. bis 25. Juli kamen laut Stadt rund 250.000 Besucherinnen und Besucher, mehr als 300 Künstlerinnen und Künstler aus über 40 Ländern traten auf. Neu waren Spielorte rund um das Schloss, das Kinderspektakel auf der Terrasse vor dem Schlossmuseum und die "Show to go", ein Stadtrundgang mit dem Clown-Paar Cia. Cop D’Ull. Rund die Hälfte der eingeladenen Künstlerinnen und Künstler feiert jedes Jahr ihre Premiere beim Pflasterspektakel.',
  whatToExpectTitle: 'Was das Pflasterspektakel 2027 bietet',
  whatToExpect:
    'Das 39. Pflasterspektakel findet vom 15. bis 17. Juli 2027 statt, wie gewohnt von Donnerstag bis Samstag. 2026 wurden rund 40 Spielorte in der Innenstadt stündlich bespielt, insgesamt standen mehr als 800 Auftritte am Programm. Dazu kamen Revueshows im Spektakelzelt, der "Bildergarten" mit Straßenmalerei in der Altstadt und das Kinderspektakel im Donaupark.',
  whatToExpectList: [
    'Über 100 Solokünstlerinnen, Solokünstler und Compagnien, 2026 aus über 40 Ländern',
    'Eintritt frei, Hutgeld für die Künstlerinnen und Künstler',
    'Feuershows bei Einbruch der Dunkelheit',
    'Revueshows "Kaleidoskopnachmittage" und "Kaleidoskopnächte" im Spektakelzelt',
    'Über 25 Musik-Acts, Samba Session und musikalische Nightline in Innenstadtlokalen',
    'Kinderspektakel mit Spiel- und Kreativstationen im Donaupark',
  ],
  practicalInfoTitle: 'Praktische Informationen',
  practicalInfo: [
    {
      icon: '🎪',
      label: 'Eintritt',
      text: 'Alle Vorstellungen sind kostenlos. Eine freiwillige Spende nach der Aufführung ist die übliche Geste der Wertschätzung für die Künstler.',
    },
    {
      icon: '🚊',
      label: 'Anreise',
      text: 'Linz HBF ist mit Straßenbahn Linie 1 oder 2 direkt mit dem Hauptplatz verbunden (ca. 10 min). Parkplätze in der Tiefgarage Schillerpark.',
    },
    {
      icon: '🗺️',
      label: 'Orientierung',
      text: 'Das Festival verteilt sich auf rund 40 Spielorte in der Innenstadt. Das Tagesprogramm mit Auftrittszeiten und Spielorten gibt es gedruckt am Festival.',
    },
    {
      icon: '🌤️',
      label: 'Wetter',
      text: 'Das Pflasterspektakel ist ein Freiluftfestival. Für heiße Tage gab es 2026 Rückzugsorte wie die Spektakel-Rast in drei Kirchen und die Ruheinsel im Innenhof des Alten Rathauses.',
    },
  ],
  gallery: [],
  ctaText: 'Events in Oberösterreich entdecken',
  ctaLink: '/map?bundesland=Oberoesterreich&category=Festivals',
  seoTitle: 'Linz Pflasterspektakel 2027: Termin, Programm & Tipps',
  seoDescription:
    'Linz Pflasterspektakel 2027 (15. bis 17. Juli): drei Tage Straßenkunst bei freiem Eintritt in der Linzer Innenstadt. 2026 kamen rund 250.000 Besucher.',
  keywords: [
    'Linz Pflasterspektakel 2027',
    'Straßenkunstfestival Linz',
    'Pflasterspektakel Programm',
    'Straßenkunst Österreich',
    'Festival Linz kostenlos',
    'Pflasterspektakel Hauptplatz',
    'Linz Sommer Festival',
    'Akrobatik Festival Linz',
    'Oberösterreich Kulturveranstaltung',
    'Pflasterspektakel Juli',
  ],
  jsonLdEvent: {
    name: 'Linz Pflasterspektakel 2027',
    startDate: '2027-07-15',
    endDate: '2027-07-17',
    location: 'Linzer Innenstadt, 4020 Linz, Austria',
    addressCountry: 'AT',
    url: 'https://www.pflasterspektakel.at',
    description:
      'Das Linzer Pflasterspektakel ist eines der größten Straßenkunstfestivals Europas, mit über 100 Solokünstlern und Compagnien in der Linzer Innenstadt bei freiem Eintritt.',
    image:
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1600&q=85&auto=format&fit=crop',
  },
};
