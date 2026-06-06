/**
 * Bundesland → tourism-region data for the v4 "Events nach Bundesland" landing
 * section (design section 02b). Each Bundesland is a clickable tile; the hybrid
 * sheet offers "Alle Events in <BL>" plus a region picker. Both routes land on
 * the existing /entdecken list, pre-scoped.
 *
 * `id` matches the real bundesland id used everywhere else (BUNDESLAENDER +
 * /entdecken ?bl). Region names are Austrian tourism regions (from the design
 * brief); they are used as a soft search-narrower on /entdecken for now — true
 * region→district filtering is a follow-up (needs a region→places mapping).
 */
export interface BundeslandRegion {
  name: string;
}

export interface BundeslandHubEntry {
  /** Real bundesland id — matches BUNDESLAENDER + /entdecken ?bl. */
  id: string;
  name: string;
  tagline: string;
  /** Wien is the visually featured tile (spans 2 columns). */
  feature?: boolean;
  /** Optional background photo path; falls back to a gradient tile. */
  img?: string;
  regions: BundeslandRegion[];
}

export const BUNDESLAND_HUBS: BundeslandHubEntry[] = [
  {
    id: 'wien', name: 'Wien', tagline: 'Die Hauptstadt feiert', feature: true,
    regions: [
      { name: 'Innere Stadt' }, { name: 'Leopoldstadt & Prater' },
      { name: 'Neubau & Mariahilf' }, { name: 'Donaukanal' },
      { name: 'Am Gürtel' }, { name: 'Donauinsel' },
    ],
  },
  {
    id: 'niederoesterreich', name: 'Niederösterreich', tagline: 'Wachau bis Waldviertel',
    regions: [
      { name: 'Wachau & Donau' }, { name: 'Wienerwald' }, { name: 'Waldviertel' },
      { name: 'Weinviertel' }, { name: 'Wiener Alpen' }, { name: 'Mostviertel' },
    ],
  },
  {
    id: 'burgenland', name: 'Burgenland', tagline: 'Seefestspiele & Wein',
    regions: [
      { name: 'Neusiedler See' }, { name: 'Mittelburgenland' },
      { name: 'Südburgenland' }, { name: 'Rosalia-Kogelberg' },
    ],
  },
  {
    id: 'oberoesterreich', name: 'Oberösterreich', tagline: 'Linz, Seen & Mühlviertel',
    regions: [
      { name: 'Linz & Umgebung' }, { name: 'Salzkammergut' }, { name: 'Mühlviertel' },
      { name: 'Donauregion' }, { name: 'Pyhrn-Priel' },
    ],
  },
  {
    id: 'steiermark', name: 'Steiermark', tagline: 'Graz & das grüne Herz',
    regions: [
      { name: 'Graz & Umgebung' }, { name: 'Südsteiermark' },
      { name: 'Schladming-Dachstein' }, { name: 'Thermen- & Vulkanland' },
      { name: 'Ausseerland' },
    ],
  },
  {
    id: 'salzburg', name: 'Salzburg', tagline: 'Festspiele & Berge',
    regions: [
      { name: 'Stadt Salzburg' }, { name: 'Salzkammergut' }, { name: 'Pinzgau' },
      { name: 'Pongau' }, { name: 'Lungau' },
    ],
  },
  {
    id: 'tirol', name: 'Tirol', tagline: 'Innsbruck bis Osttirol',
    regions: [
      { name: 'Innsbruck & Umgebung' }, { name: 'Zillertal' }, { name: 'Kitzbühel' },
      { name: 'Osttirol' }, { name: 'Ötztal' },
    ],
  },
  {
    id: 'kaernten', name: 'Kärnten', tagline: 'Seen & Sommerbühnen',
    regions: [
      { name: 'Wörthersee' }, { name: 'Klagenfurt' }, { name: 'Villach' },
      { name: 'Nockberge' }, { name: 'Gailtal' },
    ],
  },
  {
    id: 'vorarlberg', name: 'Vorarlberg', tagline: 'Bregenz am Bodensee',
    regions: [
      { name: 'Bodensee-Vorarlberg' }, { name: 'Bregenzerwald' },
      { name: 'Montafon' }, { name: 'Arlberg' },
    ],
  },
];
