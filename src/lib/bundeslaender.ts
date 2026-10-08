export interface Bundesland {
  id: string;
  name: string;
  shortName: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  pitch: number;
  bearing: number;
  geojsonFile: string;
  borderColor: string;
  districts: string[];
  // Bounding box for map filtering [minLng, minLat, maxLng, maxLat]
  bounds?: [number, number, number, number];
}

export const BUNDESLAENDER: Bundesland[] = [
  {
    id: 'all',
    name: 'Ganz Österreich',
    shortName: 'AT',
    center: [12.2, 47.5],
    zoom: 7.0,
    pitch: 30,
    bearing: 0,
    geojsonFile: '/oesterreich.geojson',
    borderColor: '#6366f1',
    districts: [],
  },
  {
    id: 'burgenland',
    name: 'Burgenland',
    shortName: 'Bgld',
    center: [16.5, 47.55],
    zoom: 8.8,
    pitch: 45,
    bearing: -8,
    geojsonFile: '/burgenland.geojson',
    borderColor: '#2563eb',
    districts: ['Neusiedl am See', 'Eisenstadt', 'Mattersburg', 'Oberpullendorf', 'Oberwart', 'Güssing', 'Jennersdorf'],
    bounds: [15.996, 46.831, 17.161, 48.119],
  },
  {
    id: 'wien',
    name: 'Wien',
    shortName: 'Wien',
    center: [16.37, 48.21],
    zoom: 11.5,
    pitch: 45,
    bearing: 0,
    geojsonFile: '/wien.geojson',
    borderColor: '#dc2626',
    districts: [],
    bounds: [16.182, 48.118, 16.578, 48.323],
  },
  {
    id: 'niederoesterreich',
    name: 'Niederösterreich',
    shortName: 'NÖ',
    center: [15.75, 48.1],
    zoom: 7.8,
    pitch: 40,
    bearing: 0,
    geojsonFile: '/niederoesterreich.geojson',
    borderColor: '#2563eb',
    districts: [],
    bounds: [14.453, 47.422, 17.069, 49.021],
  },
  {
    id: 'oberoesterreich',
    name: 'Oberösterreich',
    shortName: 'OÖ',
    center: [14.0, 48.2],
    zoom: 8,
    pitch: 40,
    bearing: 0,
    geojsonFile: '/oberoesterreich.geojson',
    borderColor: '#059669',
    districts: [],
    bounds: [12.749, 47.461, 14.992, 48.773],
  },
  {
    id: 'salzburg',
    name: 'Salzburg',
    shortName: 'Sbg',
    center: [13.1, 47.3],
    zoom: 8.2,
    pitch: 45,
    bearing: 0,
    geojsonFile: '/salzburg.geojson',
    borderColor: '#d97706',
    districts: [],
    bounds: [12.076, 46.944, 13.996, 48.041],
  },
  {
    id: 'steiermark',
    name: 'Steiermark',
    shortName: 'Stmk',
    center: [15.3, 47.25],
    zoom: 7.8,
    pitch: 40,
    bearing: 0,
    geojsonFile: '/steiermark.geojson',
    borderColor: '#059669',
    districts: [],
    bounds: [13.563, 46.612, 16.172, 47.828],
  },
  {
    id: 'kaernten',
    name: 'Kärnten',
    shortName: 'Ktn',
    center: [14.0, 46.75],
    zoom: 8.3,
    pitch: 45,
    bearing: 0,
    geojsonFile: '/kaernten.geojson',
    borderColor: '#eab308',
    districts: [],
    bounds: [12.657, 46.372, 15.065, 47.131],
  },
  {
    id: 'tirol',
    name: 'Tirol',
    shortName: 'Tirol',
    center: [11.4, 47.1],
    zoom: 7.8,
    pitch: 45,
    bearing: 0,
    geojsonFile: '/tirol.geojson',
    borderColor: '#dc2626',
    districts: [],
    bounds: [10.098, 46.651, 12.966, 47.743],
  },
  {
    id: 'vorarlberg',
    name: 'Vorarlberg',
    shortName: 'Vbg',
    center: [9.88, 47.25],
    zoom: 9.2,
    pitch: 45,
    bearing: 0,
    geojsonFile: '/vorarlberg.geojson',
    borderColor: '#dc2626',
    districts: [],
    bounds: [9.531, 46.841, 10.237, 47.596],
  },
];

export function getBundeslandById(id: string): Bundesland | undefined {
  return BUNDESLAENDER.find(b => b.id === id);
}

/**
 * Map any bundesland string (any case, with or without umlauts/abbreviations)
 * to the canonical id used in `BUNDESLAENDER` (`'niederoesterreich'`,
 * `'wien'`, …) or `null` if it can't be resolved.
 *
 * Why this exists: scrapers write `bundesland` in many shapes — see
 * `events.bundesland` distribution where the same Bundesland appears as
 * "Niederösterreich" (23k), "niederoesterreich" (18k), "Niederoesterreich"
 * (3) and "ooe" (52). Without a normalizer, the client-side map filter
 * compared lowercase strings with `===` / `includes`, so "niederösterreich"
 * vs "niederoesterreich" never matched and ~half the events disappeared
 * when the user picked NÖ. Same for Kärnten ("kärnten" vs "kaernten").
 *
 * Resolution order matches slugify.ts's `normalizeBundesland`:
 *   1. Shortcodes (bgld, ktn, noe, ooe, sbg, stmk, t, vbg, w)
 *   2. Strip diacritics + collapse `ae|oe|ue` → `a|o|u`, drop non-letters,
 *      then look up the canonical key.
 */
export function bundeslandToId(raw: string | null | undefined): Bundesland['id'] | null {
  if (!raw) return null;
  const lc = raw.trim().toLowerCase();
  if (!lc) return null;

  const shortcodes: Record<string, Bundesland['id']> = {
    bgld: 'burgenland',
    ktn: 'kaernten',
    noe: 'niederoesterreich',
    ooe: 'oberoesterreich',
    sbg: 'salzburg',
    stmk: 'steiermark',
    t: 'tirol',
    vbg: 'vorarlberg',
    w: 'wien',
  };
  if (shortcodes[lc]) return shortcodes[lc];

  const key = lc
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/[^a-z]/g, '');

  const map: Record<string, Bundesland['id']> = {
    burgenland: 'burgenland',
    karnten: 'kaernten',
    niederosterreich: 'niederoesterreich',
    oberosterreich: 'oberoesterreich',
    salzburg: 'salzburg',
    steiermark: 'steiermark',
    tirol: 'tirol',
    vorarlberg: 'vorarlberg',
    wien: 'wien',
  };
  return map[key] ?? null;
}
