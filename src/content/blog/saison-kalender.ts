/**
 * Saison-Kampagnen-Kalender (MASTERPLAN P3) — Config für den Autopiloten
 * (src/scripts/generate-saison-guide.ts, GitHub Action saison-guide.yml).
 * Faustregel: Publish 6–10 Wochen vor Such-Peak (Google-Vorlauf).
 * searchKeywords = wonach wirklich gesucht wird (Basis: Suchvolumen-Recherche
 * im MASTERPLAN; GSC-Query-Feintuning ist v2).
 */
export interface SaisonGuideSpec {
  /** Monat (1–12), in dem der Guide publiziert werden soll. */
  publishMonth: number;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  categoryColor: string;
  heroImage: string;
  searchKeywords: string[];
  /** Event-Recherche: Saison-Fenster relativ zum Publish [von, bis] in Monaten. */
  monthsAhead: [number, number];
  /** Event-Kategorien (Taxonomie-Werte) für die DB-Recherche. */
  categories: string[];
  /** Bestands-Posts als interne Link-Kandidaten (Slugs). */
  bestandsPosts: string[];
}

export const SAISON_KALENDER: SaisonGuideSpec[] = [
  {
    publishMonth: 8,
    slug: 'herbstfeste-erntedank-oesterreich',
    title: 'Herbstfeste & Erntedank in Österreich',
    subtitle: 'Weinlese, Almabtrieb, Erntedank — die schönsten Herbstfeste des Landes',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-amber-700 text-white',
    heroImage: '/images/categories/fest-1.jpg',
    searchKeywords: ['Herbstfeste Österreich', 'Erntedankfest', 'Almabtrieb Termine', 'Weinlesefest'],
    monthsAhead: [1, 3],
    categories: ['Märkte & Feste', 'Essen & Trinken', 'Kultur & Bühne'],
    bestandsPosts: ['kaiser-wiesn', 'aufsteirern', 'retz-weinlesefest', 'martinimarkt'],
  },
  {
    publishMonth: 9,
    slug: 'adventmaerkte-oesterreich-guide',
    title: 'Adventmärkte Österreich — der große Guide',
    subtitle: 'Alle Christkindlmärkte im Überblick: von Wien bis Bregenz',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-red-800 text-white',
    heroImage: '/images/categories/maerkte-1.jpg',
    searchKeywords: ['Adventmärkte Österreich', 'Christkindlmarkt', 'Weihnachtsmarkt Öffnungszeiten', 'Adventmarkt Termine'],
    monthsAhead: [2, 4],
    categories: ['Märkte & Feste'],
    bestandsPosts: ['wien-christkindlmarkt', 'salzburger-christkindlmarkt', 'linzer-christkindlmarkt', 'innsbruck-christkindlmarkt'],
  },
  {
    publishMonth: 10,
    slug: 'silvester-oesterreich',
    title: 'Silvester in Österreich',
    subtitle: 'Silvesterpfade, Bälle und Bergfeuer — so feiert Österreich ins neue Jahr',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-indigo-800 text-white',
    heroImage: '/images/categories/rave-1.jpg',
    searchKeywords: ['Silvester Wien', 'Silvester Österreich', 'Silvesterpfad', 'Neujahrskonzert Karten'],
    monthsAhead: [2, 3],
    categories: ['Märkte & Feste', 'Nightlife & Party', 'Musik'],
    bestandsPosts: ['wiener-silvesterpfad', 'wiener-neujahrskonzert'],
  },
  {
    publishMonth: 12,
    slug: 'ball-faschingssaison-oesterreich',
    title: 'Ball- & Faschingssaison in Österreich',
    subtitle: 'Vom Opernball bis zum Villacher Fasching — der Guide durch die fünfte Jahreszeit',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-purple-800 text-white',
    heroImage: '/images/categories/kultur-1.jpg',
    searchKeywords: ['Ballkalender Wien', 'Faschingsumzug Termine', 'Opernball', 'Bälle Österreich'],
    monthsAhead: [1, 3],
    categories: ['Kultur & Bühne', 'Märkte & Feste', 'Musik'],
    bestandsPosts: ['wiener-opernball', 'villacher-fasching'],
  },
  {
    publishMonth: 2,
    slug: 'ostermaerkte-fruehlingsfeste-oesterreich',
    title: 'Ostermärkte & Frühlingsfeste in Österreich',
    subtitle: 'Ostermärkte, Blütenfeste und Frühlingserwachen im ganzen Land',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-emerald-700 text-white',
    heroImage: '/images/categories/natur-1.jpg',
    searchKeywords: ['Ostermarkt Wien', 'Ostermärkte Österreich', 'Frühlingsfest', 'Narzissenfest'],
    monthsAhead: [1, 3],
    categories: ['Märkte & Feste', 'Familie & Kinder'],
    bestandsPosts: ['bregenzer-fruehling', 'narzissenfest'],
  },
  {
    publishMonth: 4,
    slug: 'festival-sommer-oesterreich',
    title: 'Festival-Sommer Österreich',
    subtitle: 'Nova Rock, Frequency, Donauinselfest & Co — alle großen Festivals im Überblick',
    category: 'Musik & Festivals',
    categoryColor: 'bg-pink-700 text-white',
    heroImage: '/images/categories/musik-1.jpg',
    searchKeywords: ['Festivals Österreich 2027', 'Musikfestival Sommer', 'Festival Tickets', 'Open Air Österreich'],
    monthsAhead: [1, 4],
    categories: ['Musik'],
    bestandsPosts: ['nova-rock-2026', 'frequency-festival-2026', 'donauinselfest-2026', 'salzburger-festspiele'],
  },
  {
    publishMonth: 5,
    slug: 'open-air-kino-sommernaechte-oesterreich',
    title: 'Open-Air-Kinos & Sommernächte in Österreich',
    subtitle: 'Kino unter Sternen, Sommerkonzerte und laue Nächte — der Sommer-Guide',
    category: 'Kultur & Tradition',
    categoryColor: 'bg-sky-700 text-white',
    heroImage: '/images/categories/kultur-2.jpg',
    searchKeywords: ['Open Air Kino Wien', 'Sommerkino', 'Sommernachtskonzert', 'Open Air Veranstaltungen'],
    monthsAhead: [1, 3],
    categories: ['Kultur & Bühne', 'Musik'],
    bestandsPosts: ['linzer-klangwolke', 'sommernachtskonzert-schoenbrunn'],
  },
];
