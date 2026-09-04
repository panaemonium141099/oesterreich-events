/**
 * Kuratierte OSM-Whitelist fuer den Freizeit-POI-Bestand (fn-18 Task 7).
 *
 * ── ODbL (zentrale Vorgabe des Epics) ──────────────────────────────────────
 * OpenStreetMap-Daten stehen unter ODbL 1.0. Dieses Modul und alles, was
 * daraus in `osm_pois` landet, bleibt STRIKT getrennt vom eigenen Bestand
 * (`poi_activities`, `venues`): es gibt keinen Merge-, Dedup- oder
 * Join-SCHREIBPFAD zwischen den Tabellen. Verknuepft wird ausschliesslich zur
 * ANZEIGE-Zeit ueber eine reine Geo-Query (Gemeinde-Hub-Sektion), d. h. beide
 * Bestaende werden nebeneinander gerendert, nie ineinander gerechnet. Dadurch
 * bleibt osm_pois eine eigenstaendige, klar attribuierte ODbL-Datenbank
 * ("collective database" nach OSMF-Guideline) und die Share-Alike-Pflicht
 * greift nicht auf poi_activities/venues durch.
 * Attribution: "(c) OpenStreetMap contributors", ODbL-Link auf /quellen UND
 * an der Hub-Sektion.
 *
 * ── Warum eine Whitelist ───────────────────────────────────────────────────
 * OSM-AT enthaelt Millionen benannter Objekte. Fuer Freizeit/Ausflug ist nur
 * ein kleiner, klar umrissener Teil relevant. Die Map unten ist die EINZIGE
 * Quelle der Wahrheit fuer beides:
 *   1. die Overpass-Abfrage (Klauseln werden daraus generiert — kein zweites,
 *      driftendes Vokabular im Script), und
 *   2. die Klassifikation der zurueckkommenden Elemente in
 *      `osm_pois.category`.
 *
 * `setting` folgt derselben Semantik wie poi_activities.setting
 * (indoor/outdoor/mixed) und wird rein deterministisch aus der Kategorie
 * abgeleitet — kein KI-Enrichment (MASTERPLAN §6).
 */

export type OsmSetting = 'indoor' | 'outdoor' | 'mixed';

export interface OsmCategoryDef {
  /** Stabile interne Kategorie-ID -> osm_pois.category. */
  category: string;
  /** Deutsches Anzeige-Label (Hub-Chips / Karten-Untertitel). */
  label: string;
  setting: OsmSetting;
}

/**
 * Prioritaets-Reihenfolge der OSM-Keys bei Mehrfach-Tagging (ein Objekt kann
 * z. B. `tourism=attraction` + `leisure=park` tragen). Deterministisch: der
 * erste Key mit Whitelist-Treffer gewinnt, damit dieselbe Row bei jedem
 * Reimport dieselbe category bekommt.
 */
export const OSM_KEY_PRIORITY = [
  'attraction',
  'tourism',
  'historic',
  'natural',
  'leisure',
  'sport',
  'amenity',
] as const;

export type OsmKey = (typeof OSM_KEY_PRIORITY)[number];

/**
 * Whitelist: `key` -> `value` -> Kategorie-Definition.
 * Werte-Listen bewusst explizit (keine Praefix-/Wildcard-Matches) — nur so
 * bleibt das Import-Volumen vorhersagbar und die Kategorie stabil.
 */
export const OSM_WHITELIST: Readonly<Record<OsmKey, Readonly<Record<string, OsmCategoryDef>>>> = {
  attraction: {
    // Kirtag-/Erlebnis-Infrastruktur (Sommerrodelbahn, Wasserrutsche, ...)
    summer_toboggan: { category: 'sommerrodelbahn', label: 'Sommerrodelbahn', setting: 'outdoor' },
    water_slide: { category: 'wasserrutsche', label: 'Wasserrutsche', setting: 'mixed' },
    animal: { category: 'tierpark', label: 'Tierpark & Zoo', setting: 'outdoor' },
    big_wheel: { category: 'fahrgeschaeft', label: 'Fahrgeschäft', setting: 'outdoor' },
    roller_coaster: { category: 'fahrgeschaeft', label: 'Fahrgeschäft', setting: 'outdoor' },
    carousel: { category: 'fahrgeschaeft', label: 'Fahrgeschäft', setting: 'outdoor' },
    maze: { category: 'labyrinth', label: 'Labyrinth & Irrgarten', setting: 'outdoor' },
    train: { category: 'ausflugsbahn', label: 'Ausflugsbahn', setting: 'outdoor' },
  },
  tourism: {
    museum: { category: 'museum', label: 'Museum', setting: 'indoor' },
    gallery: { category: 'galerie', label: 'Galerie', setting: 'indoor' },
    aquarium: { category: 'aquarium', label: 'Aquarium', setting: 'indoor' },
    zoo: { category: 'tierpark', label: 'Tierpark & Zoo', setting: 'outdoor' },
    theme_park: { category: 'freizeitpark', label: 'Freizeitpark', setting: 'outdoor' },
    viewpoint: { category: 'aussichtspunkt', label: 'Aussichtspunkt', setting: 'outdoor' },
    attraction: { category: 'sehenswuerdigkeit', label: 'Sehenswürdigkeit', setting: 'outdoor' },
    picnic_site: { category: 'picknickplatz', label: 'Picknickplatz', setting: 'outdoor' },
    alpine_hut: { category: 'huette', label: 'Hütte', setting: 'mixed' },
    wilderness_hut: { category: 'huette', label: 'Hütte', setting: 'mixed' },
    camp_site: { category: 'campingplatz', label: 'Campingplatz', setting: 'outdoor' },
    caravan_site: { category: 'campingplatz', label: 'Campingplatz', setting: 'outdoor' },
  },
  historic: {
    castle: { category: 'burg-schloss', label: 'Burg & Schloss', setting: 'mixed' },
    fort: { category: 'burg-schloss', label: 'Burg & Schloss', setting: 'mixed' },
    manor: { category: 'burg-schloss', label: 'Burg & Schloss', setting: 'mixed' },
    city_gate: { category: 'burg-schloss', label: 'Burg & Schloss', setting: 'outdoor' },
    tower: { category: 'aussichtspunkt', label: 'Aussichtspunkt', setting: 'outdoor' },
    ruins: { category: 'ruine', label: 'Ruine', setting: 'outdoor' },
    monument: { category: 'denkmal', label: 'Denkmal', setting: 'outdoor' },
    memorial: { category: 'denkmal', label: 'Denkmal', setting: 'outdoor' },
    archaeological_site: { category: 'archaeologie', label: 'Archäologie', setting: 'outdoor' },
    mine: { category: 'schaubergwerk', label: 'Schaubergwerk', setting: 'mixed' },
  },
  natural: {
    peak: { category: 'gipfel', label: 'Gipfel', setting: 'outdoor' },
    saddle: { category: 'gipfel', label: 'Gipfel', setting: 'outdoor' },
    glacier: { category: 'gletscher', label: 'Gletscher', setting: 'outdoor' },
    beach: { category: 'strand', label: 'Strand & Badeplatz', setting: 'outdoor' },
    cave_entrance: { category: 'hoehle', label: 'Höhle', setting: 'mixed' },
    waterfall: { category: 'wasserfall', label: 'Wasserfall', setting: 'outdoor' },
    spring: { category: 'quelle', label: 'Quelle', setting: 'outdoor' },
  },
  leisure: {
    playground: { category: 'spielplatz', label: 'Spielplatz', setting: 'outdoor' },
    park: { category: 'park', label: 'Park', setting: 'outdoor' },
    garden: { category: 'park', label: 'Park', setting: 'outdoor' },
    nature_reserve: { category: 'naturschutzgebiet', label: 'Naturschutzgebiet', setting: 'outdoor' },
    swimming_pool: { category: 'bad', label: 'Bad & Schwimmen', setting: 'mixed' },
    swimming_area: { category: 'bad', label: 'Bad & Schwimmen', setting: 'outdoor' },
    water_park: { category: 'bad', label: 'Bad & Schwimmen', setting: 'mixed' },
    beach_resort: { category: 'strand', label: 'Strand & Badeplatz', setting: 'outdoor' },
    sauna: { category: 'sauna', label: 'Sauna', setting: 'indoor' },
    sports_centre: { category: 'sportanlage', label: 'Sportanlage', setting: 'mixed' },
    stadium: { category: 'sportanlage', label: 'Sportanlage', setting: 'mixed' },
    pitch: { category: 'sportplatz', label: 'Sportplatz', setting: 'outdoor' },
    track: { category: 'sportplatz', label: 'Sportplatz', setting: 'outdoor' },
    fitness_centre: { category: 'fitness', label: 'Fitness', setting: 'indoor' },
    ice_rink: { category: 'eislaufen', label: 'Eislaufen', setting: 'mixed' },
    golf_course: { category: 'golf', label: 'Golf', setting: 'outdoor' },
    miniature_golf: { category: 'minigolf', label: 'Minigolf', setting: 'outdoor' },
    disc_golf_course: { category: 'golf', label: 'Golf', setting: 'outdoor' },
    bowling_alley: { category: 'bowling', label: 'Bowling & Kegeln', setting: 'indoor' },
    escape_game: { category: 'escape-room', label: 'Escape Room', setting: 'indoor' },
    trampoline_park: { category: 'trampolinpark', label: 'Trampolinpark', setting: 'indoor' },
    horse_riding: { category: 'reiten', label: 'Reiten', setting: 'mixed' },
    marina: { category: 'marina', label: 'Marina & Bootsanleger', setting: 'outdoor' },
    slipway: { category: 'marina', label: 'Marina & Bootsanleger', setting: 'outdoor' },
    climbing: { category: 'klettern', label: 'Klettern', setting: 'mixed' },
    fishing: { category: 'angeln', label: 'Angeln', setting: 'outdoor' },
    bird_hide: { category: 'naturbeobachtung', label: 'Naturbeobachtung', setting: 'outdoor' },
  },
  sport: {
    climbing: { category: 'klettern', label: 'Klettern', setting: 'mixed' },
    toboggan: { category: 'rodelbahn', label: 'Rodelbahn', setting: 'outdoor' },
    canoe: { category: 'wassersport', label: 'Wassersport', setting: 'outdoor' },
    rafting: { category: 'wassersport', label: 'Wassersport', setting: 'outdoor' },
    paragliding: { category: 'flugsport', label: 'Flugsport', setting: 'outdoor' },
    equestrian: { category: 'reiten', label: 'Reiten', setting: 'mixed' },
  },
  amenity: {
    theatre: { category: 'theater', label: 'Theater', setting: 'indoor' },
    cinema: { category: 'kino', label: 'Kino', setting: 'indoor' },
    arts_centre: { category: 'kulturzentrum', label: 'Kulturzentrum', setting: 'indoor' },
    planetarium: { category: 'planetarium', label: 'Planetarium', setting: 'indoor' },
    public_bath: { category: 'bad', label: 'Bad & Schwimmen', setting: 'mixed' },
    library: { category: 'bibliothek', label: 'Bibliothek', setting: 'indoor' },
  },
};

/**
 * Overpass-Klauseln aus der Whitelist generieren (eine Klausel pro Key mit
 * Regex-Alternation der erlaubten Werte). `name` ist Pflicht — namenlose
 * Objekte sind als Ausflugsziel nicht darstellbar.
 * Rueckgabe OHNE bbox/area-Suffix und OHNE `;` — der Aufrufer haengt beides an.
 */
export function overpassClauseFor(key: OsmKey): string {
  const values = Object.keys(OSM_WHITELIST[key]).sort();
  return `nwr["name"]["${key}"~"^(${values.join('|')})$"]`;
}

/** Alle Whitelist-Keys in Prioritaets-Reihenfolge. */
export function osmKeys(): readonly OsmKey[] {
  return OSM_KEY_PRIORITY;
}

export interface OsmClassification extends OsmCategoryDef {
  /** Der Tag, der gematcht hat — Debug/Provenienz (`osm_pois.osm_tag`). */
  matchedTag: string;
}

/**
 * Kategorie fuer ein OSM-Element bestimmen. `null` = nicht in der Whitelist
 * (Element wird nicht importiert). Deterministisch ueber OSM_KEY_PRIORITY.
 */
export function classifyOsmTags(
  tags: Readonly<Record<string, string>> | undefined,
): OsmClassification | null {
  if (!tags) return null;
  for (const key of OSM_KEY_PRIORITY) {
    const raw = tags[key];
    if (!raw) continue;
    const def = OSM_WHITELIST[key][raw];
    if (def) return { ...def, matchedTag: `${key}=${raw}` };
  }
  return null;
}

/** Deutsches Anzeige-Label zu einer category-ID (Fallback: Prettifier). */
/**
 * Englische Kategorie-Labels (fn-17). Schluessel ist die Kategorie-Slug,
 * nicht der OSM-Tag — mehrere Tags teilen sich eine Kategorie. Fehlt ein
 * Eintrag, faellt `osmCategoryLabel` auf das deutsche Label zurueck.
 */
const OSM_CATEGORY_LABELS_EN: Readonly<Record<string, string>> = {
  angeln: 'Fishing',
  aquarium: 'Aquarium',
  archaeologie: 'Archaeology',
  ausflugsbahn: 'Scenic railway',
  aussichtspunkt: 'Viewpoint',
  bad: 'Pool & swimming',
  bibliothek: 'Library',
  bowling: 'Bowling & skittles',
  'burg-schloss': 'Castle & palace',
  campingplatz: 'Campsite',
  denkmal: 'Monument',
  eislaufen: 'Ice skating',
  'escape-room': 'Escape room',
  fahrgeschaeft: 'Fairground ride',
  fitness: 'Fitness',
  flugsport: 'Air sports',
  freizeitpark: 'Amusement park',
  galerie: 'Gallery',
  gipfel: 'Summit',
  gletscher: 'Glacier',
  golf: 'Golf',
  hoehle: 'Cave',
  huette: 'Mountain hut',
  kino: 'Cinema',
  klettern: 'Climbing',
  kulturzentrum: 'Cultural centre',
  labyrinth: 'Maze & labyrinth',
  marina: 'Marina & boat dock',
  minigolf: 'Mini golf',
  museum: 'Museum',
  naturbeobachtung: 'Wildlife watching',
  naturschutzgebiet: 'Nature reserve',
  park: 'Park',
  picknickplatz: 'Picnic area',
  planetarium: 'Planetarium',
  quelle: 'Spring',
  reiten: 'Horse riding',
  rodelbahn: 'Toboggan run',
  ruine: 'Ruins',
  sauna: 'Sauna',
  schaubergwerk: 'Show mine',
  sehenswuerdigkeit: 'Attraction',
  sommerrodelbahn: 'Summer toboggan run',
  spielplatz: 'Playground',
  sportanlage: 'Sports facility',
  sportplatz: 'Sports ground',
  strand: 'Beach & bathing spot',
  theater: 'Theatre',
  tierpark: 'Zoo & wildlife park',
  trampolinpark: 'Trampoline park',
  wasserfall: 'Waterfall',
  wasserrutsche: 'Water slide',
  wassersport: 'Water sports',
};

export function osmCategoryLabel(category: string, locale = 'de'): string {
  if (locale === 'en') {
    const en = OSM_CATEGORY_LABELS_EN[category];
    if (en) return en;
  }
  for (const key of OSM_KEY_PRIORITY) {
    for (const def of Object.values(OSM_WHITELIST[key])) {
      if (def.category === category) return def.label;
    }
  }
  return category
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
