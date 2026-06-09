/**
 * Bundesland metadata for the v4 "Events nach Bundesland" landing section
 * (design section 02b). Each Bundesland is a clickable tile; the hybrid sheet
 * offers "Alle Events in <BL>" plus a Bezirk picker. Both routes land on the
 * existing /entdecken list, pre-scoped.
 *
 * `id` matches the real bundesland id used everywhere else (BUNDESLAENDER +
 * /entdecken ?bl + DISTRICTS_BY_BUNDESLAND). The Bezirk list itself comes from
 * DISTRICTS_BY_BUNDESLAND (src/lib/districtsAT.ts) — the same names the events'
 * `district` field uses, so the picker filters for real via ?district=.
 */
export interface BundeslandHubEntry {
  /** Real bundesland id — matches BUNDESLAENDER + /entdecken ?bl + districtsAT. */
  id: string;
  name: string;
  tagline: string;
  /** Wien is the visually featured tile (spans 2 columns). */
  feature?: boolean;
  /** Optional background photo override; falls back to /images/regions/{id}.jpg. */
  img?: string;
}

export const BUNDESLAND_HUBS: BundeslandHubEntry[] = [
  { id: 'wien', name: 'Wien', tagline: 'Die Hauptstadt feiert', feature: true },
  { id: 'niederoesterreich', name: 'Niederösterreich', tagline: 'Wachau bis Waldviertel' },
  { id: 'burgenland', name: 'Burgenland', tagline: 'Seefestspiele & Wein' },
  { id: 'oberoesterreich', name: 'Oberösterreich', tagline: 'Linz, Seen & Mühlviertel' },
  { id: 'steiermark', name: 'Steiermark', tagline: 'Graz & das grüne Herz' },
  { id: 'salzburg', name: 'Salzburg', tagline: 'Festspiele & Berge' },
  { id: 'tirol', name: 'Tirol', tagline: 'Innsbruck bis Osttirol' },
  { id: 'kaernten', name: 'Kärnten', tagline: 'Seen & Sommerbühnen' },
  { id: 'vorarlberg', name: 'Vorarlberg', tagline: 'Bregenz am Bodensee' },
];
