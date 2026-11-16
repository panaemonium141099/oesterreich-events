/**
 * Datenquellen von lasstreffen.de für die Seite `/quellen` (fn-31.13).
 *
 * Genannt wird nur, was die deutsche Seite ausspielt: Gemeindekalender (die
 * Adapter des DE-Nachtlaufs, `src/lib/scrapers/de/nachtlauf.ts`), der
 * Eventim-Feed, die Eventfrog-API, die Ortsdaten (`data/gemeinden-de.json`,
 * `data/plz-de.json`, `data/stammdaten-de/`) und die Karte. Namensnennungen
 * wie in `src/scripts/build-stammdaten-de.ts`.
 */
export interface SourceEntry {
  name: string;
  url?: string;
  license?: string;
  licenseUrl?: string;
  description: string;
}

export interface SourceCategory {
  title: string;
  icon: string;
  sources: SourceEntry[];
}

const DL_DE = 'https://www.govdata.de/dl-de/by-2-0';

export const SOURCE_CATEGORIES_DE: SourceCategory[] = [
  {
    title: 'Veranstaltungskalender der Gemeinden',
    icon: '🏛️',
    sources: [
      {
        name: 'Öffentliche Kalender deutscher Städte, Gemeinden, Ämter und Verbandsgemeinden',
        description:
          'Termine aus den Veranstaltungskalendern der kommunalen Websites. Gelesen werden die öffentlichen Kalenderseiten und ihre Feeds (iCal, RSS, JSON-LD). Jede Event-Seite nennt ihre Quelle und verlinkt auf die Originalseite.',
      },
      {
        name: 'Kalender regionaler Tourismusstellen',
        description:
          'Öffentliche Veranstaltungskalender von Tourismusverbänden und Landkreisen, soweit sie Termine der Gemeinden führen.',
      },
    ],
  },
  {
    title: 'Ticketanbieter',
    icon: '🎟️',
    sources: [
      {
        name: 'Eventim',
        url: 'https://www.eventim.de/',
        license: 'Partner-Feed',
        description:
          'Konzerte, Shows und Kultur aus dem offiziellen Partner-Feed von CTS Eventim. Ticket-Links führen zum Eventim-Shop und enthalten unsere Partner-Kennung.',
      },
      {
        name: 'Eventfrog',
        url: 'https://eventfrog.de/',
        license: 'Public API',
        description:
          'Veranstaltungen aus der öffentlichen Schnittstelle von Eventfrog. Jede Event-Seite verlinkt auf den Eintrag bei Eventfrog.',
      },
    ],
  },
  {
    title: 'Ortsdaten',
    icon: '📍',
    sources: [
      {
        name: 'Gemeindeverzeichnis des Statistischen Bundesamts',
        url: 'https://www.destatis.de/',
        license: 'dl-de/by-2-0',
        licenseUrl: DL_DE,
        description:
          '© Statistisches Bundesamt (Destatis). Gemeinden, Kreise und Länder mit amtlichem Gemeindeschlüssel.',
      },
      {
        name: 'Verwaltungsgebiete VG250',
        url: 'https://gdz.bkg.bund.de/',
        license: 'dl-de/by-2-0',
        licenseUrl: DL_DE,
        description:
          '© BKG (2026). Grenzen der Länder für die Karte und die Zuordnung von Orten.',
      },
      {
        name: 'GeoNames',
        url: 'https://www.geonames.org/',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/deed.de',
        description: 'Postleitzahlen und Ortsnamen.',
      },
    ],
  },
  {
    title: 'Karte',
    icon: '🗺️',
    sources: [
      {
        name: 'Mapbox',
        url: 'https://www.mapbox.com/about/maps/',
        license: '© Mapbox',
        description: 'Kartendarstellung und Kartenkacheln.',
      },
      {
        name: 'OpenStreetMap',
        url: 'https://www.openstreetmap.org/copyright',
        license: 'ODbL 1.0',
        licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
        description: 'Kartendaten © OpenStreetMap contributors, in den Kartenkacheln von Mapbox.',
      },
    ],
  },
];
