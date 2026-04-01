import type { FestivalPost } from '../types';

export const post: FestivalPost = {
  slug: 'wiener-genussfestival',
  title: 'Wiener Genussfestival',
  subtitle: 'Österreichs größtes Kulinarik-Festival am Wiener Rathausplatz',
  heroImage:
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=85&auto=format&fit=crop',
  thumbnailImage:
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80&auto=format&fit=crop',
  publishDate: '2026-03-31',
  updatedDate: '2026-03-31',
  readingTime: 5,
  excerpt:
    'Das Wiener Genussfestival am Rathausplatz vereint Top-Köche, heimische Produzenten und Wein- sowie Bierspezialitäten unter dem Motto: Österreich schmeckt. Drei Tage Kulinarik pur.',
  category: 'Essen & Trinken',
  categoryColor: 'bg-orange-600 text-white',
  keyFacts: {
    dates: 'September/Oktober (verlängertes Wochenende, 3–4 Tage)',
    location: 'Rathausplatz Wien',
    address: 'Rathausplatz 1, 1010 Wien',
    genre: 'Kulinarik, Wein, Bier, Kochen, Slow Food',
    price: 'Eintritt frei | Speisen & Getränke vor Ort kaufen',
    website: 'https://www.genussfestival.at',
    capacity: 'über 100.000 Besucher pro Ausgabe',
    since: '2005',
  },
  lineup: [
    { name: 'Kochshows mit Spitzenköchen', role: 'headliner', stage: 'Genussbühne' },
    { name: 'Slow Food Markt Österreich', role: 'special', stage: 'Marktbereich' },
    { name: 'Österreichische Wein-Verkostung', role: 'special', stage: 'Weinzelt' },
    { name: 'Craft-Beer-Festival', role: 'support', stage: 'Biergarten' },
    { name: 'Kinder-Kochworkshops', role: 'support', stage: 'Kinderzelt' },
  ],
  lineupNote: 'Programm und teilnehmende Aussteller werden im August bekanntgegeben.',
  intro:
    'Am Wiener Rathausplatz findet alljährlich das größte Kulinarik-Festival Österreichs statt. Beim Wiener Genussfestival präsentieren über 200 Aussteller das Beste aus österreichischer Küche, Weinkultur und Lebensmittelhandwerk. Top-Köche zeigen an der Genussbühne ihre Kreationen, heimische Produzenten verkaufen direkt an Besucher und Slow-Food-Botschafter vermitteln nachhaltige Kulinarik-Philosophien. Drei Tage lang ist der Rathausplatz der duftende Mittelpunkt der österreichischen Gastronomiekultur.',
  historyTitle: 'Seit 2005 – Österreichs kulinarisches Aushängeschild',
  history:
    'Das Genussfestival wurde 2005 gegründet, um österreichischen Produzenten und Köchen eine Plattform zu geben. Der Rathausplatz wurde als Standort gewählt, weil er das repräsentative Zentrum der Stadt darstellt und ausreichend Platz für Zelte, Bühnen und Stände bietet. Im Laufe der Jahre entwickelte sich das Festival zu einer wichtigen Messe für die heimische Lebensmittelindustrie und gilt heute als Pflichttermin für Köche, Foodblogger und Genussbegeisterte aus ganz Österreich.',
  whatToExpectTitle: 'Was erwartet dich beim Genussfestival?',
  whatToExpect:
    'Über 200 Aussteller aus allen neun Bundesländern bieten hochwertige heimische Produkte an: vom Bio-Käse aus dem Bregenzerwald über steirische Kürbiskernprodukte bis zu Dessertweinen aus dem Burgenland. An der Genussbühne kochen renommierte österreichische Köche live vor Publikum. Im Weinzelt präsentieren sich die bedeutendsten Weinregionen Österreichs.',
  whatToExpectList: [
    'Über 200 Aussteller: regionale Produzenten aus allen 9 Bundesländern',
    'Genussbühne mit täglichen Kochshows österreichischer Top-Köche',
    'Österreichische Wein-Verkostungen mit Winzern vor Ort',
    'Craft-Beer-Bereich mit österreichischen Mikrobrauereien',
    'Slow Food und Nachhaltigkeit als Themen-Schwerpunkte',
    'Kinderfreundlich: Kochworkshops für die Jüngsten',
  ],
  practicalInfoTitle: 'Praktische Infos zum Genussfestival',
  practicalInfo: [
    {
      icon: '🚇',
      label: 'Anreise',
      text: 'U2 Rathaus oder Schottentor, Straßenbahn 1, 71 und D (Haltestelle Rathausplatz).',
    },
    {
      icon: '🕐',
      label: 'Öffnungszeiten',
      text: 'Freitag 14:00–22:00, Samstag 11:00–22:00, Sonntag 11:00–19:00 Uhr (Angaben ca., je nach Ausgabe).',
    },
    {
      icon: '💶',
      label: 'Kosten vor Ort',
      text: 'Eintritt frei. Speisen und Getränke werden direkt bei den Ausstellern gekauft; gutes Budget für Verkostungen einplanen.',
    },
    {
      icon: '🛍️',
      label: 'Einkauf-Tipp',
      text: 'Wiederverwendbare Tasche mitbringen – viele Aussteller verkaufen Produkte zum Mitnehmen.',
    },
  ],
  gallery: [
    {
      src: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80&auto=format&fit=crop',
      alt: 'Festlich gedeckter Tisch mit österreichischen Spezialitäten',
      caption: 'Österreichische Kulinarik auf höchstem Niveau',
    },
    {
      src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80&auto=format&fit=crop',
      alt: 'Weingläser und Weinflaschen bei einem Weinfestival',
      caption: 'Österreichische Weine von den besten Winzern',
    },
    {
      src: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80&auto=format&fit=crop',
      alt: 'Koch bei einer Live-Kochshow auf einer Bühne',
      caption: 'Kochshows mit Österreichs besten Köchen',
    },
  ],
  ctaText: 'Kulinarik-Events in Wien entdecken',
  ctaLink: '/map?category=Kulinarik&region=Wien',
  seoTitle: 'Wiener Genussfestival 2026 – Kulinarik am Rathausplatz Wien',
  seoDescription:
    'Wiener Genussfestival 2026: Österreichs größtes Kulinarik-Festival am Rathausplatz mit 200+ Ausstellern, Kochshows und heimischen Weinen.',
  keywords: [
    'Wiener Genussfestival',
    'Genussfestival Wien',
    'Kulinarik Festival Wien',
    'Wien Food Festival',
    'Rathausplatz Wien Kulinarik',
    'Österreich Foodmesse',
    'Wien Genuss 2026',
    'Genussfestival Programm',
    'Slow Food Wien',
    'Weinmesse Wien',
  ],
  jsonLdEvent: {
    name: 'Wiener Genussfestival 2026',
    startDate: '2026-10-02',
    endDate: '2026-10-04',
    location: 'Rathausplatz 1, 1010 Wien, Austria',
    url: 'https://www.genussfestival.at',
    description:
      'Das Wiener Genussfestival ist Österreichs größtes Kulinarik-Festival mit über 200 Ausstellern aus allen Bundesländern.',
  },
};
