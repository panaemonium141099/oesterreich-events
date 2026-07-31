/**
 * Deskline-Topic-Whitelist fuer Freizeitaktivitaeten (fn-18, Epic E3).
 *
 * Eigenes Taxonomie-Modul — `enrichment-taxonomy.ts` wird NICHT angefasst
 * (fn-14-Konflikt); von dort wird nur der `Tag`-TYP read-only importiert,
 * damit TypeScript erzwingt, dass jedes Mapping-Ziel ein bestehender
 * TAGS-Wert ist.
 *
 * ── Whitelist-Review (Task-1-Acceptance: >=30 gemappte Topics) ────────────
 * Alle Topic-Namen wurden am 2026-07-24 LIVE gegen die Deskline-WebAPI
 * verprobt (`/{region}/de/infrastructures?fields=...topics{name}...`,
 * Regionen: burgenland, blsalzb, kaernten, salzkammergut, gastein,
 * zillertal; ~2.800 POIs gesampelt). Es sind ausschliesslich beobachtete
 * Topic-Namen gelistet — keine spekulativen Eintraege. Stand: 95 gemappte
 * Topics in 6 Gruppen (Baeder/Wellness, Action & Sport, Familie,
 * Kultur & Sehenswertes, Wandern & Rad, Winter).
 *
 * ── Mapping-Regeln ────────────────────────────────────────────────────────
 * - `tags`: Werte aus dem bestehenden TAGS-Vokabular. Fuer POI-Konzepte ohne
 *   passenden Event-Tag (z. B. Sommerrodelbahn, Minigolf, Kartbahn) bleibt
 *   das Array bewusst LEER — das Topic qualifiziert den POI trotzdem fuer
 *   den Import; die Smart-Suche (Task 6) findet solche POIs ueber den
 *   trgm-Index auf `name`. Kein erfundener/falscher Tag.
 * - `setting`: deterministisches WETTER-Signal (Task 6 filtert Regen-Queries
 *   ausschliesslich darueber): indoor = regensicher (auch Hoehlen/
 *   Schaubergwerke), outdoor = wetterabhaengig, mixed = teils/teils.
 * - Aggregation pro POI (mehrere gemappte Topics), deterministisch:
 *   alle indoor -> 'indoor'; alle outdoor -> 'outdoor'; irgendein Konflikt
 *   oder ein 'mixed'-Topic -> 'mixed'; keine gemappten Topics -> null.
 *
 * ── Bewusst NICHT gemappt ─────────────────────────────────────────────────
 * - Gastro (Restaurant, Gasthof, Buschenschank/Heuriger, Almwirtschaft/
 *   Jausenstation, Berghuette/Bergrestaurant, ...), Shops/Handel
 *   (Geschaefte/Shops, Supermarkt, Sportgeschaeft, ...), Weingueter
 *   (Weingut/Weinkeller, Vinothek, DAC *, ...), Infrastruktur/Services
 *   (E-Ladestationen, Tankstellen, Taxi, Banken, Aerzte, Friseur, ...):
 *   stehen zusaetzlich auf der EXCLUDED_TOPICS-Blockliste — ein POI mit
 *   so einem Topic wird auch dann NICHT importiert, wenn er daneben ein
 *   Whitelist-Topic traegt (Task-2-Acceptance "keine Gastro/Shops"; z. B.
 *   Sportshops, die Deskline mit Aktivitaets-Topics wie 'Ski fahren' taggt).
 * - Zu generische Topics (Ausflugsziel, Ausflug, Ausflugstipps, Ausflugsziel
 *   fuer Familien/Kinder, Besichtigung/Fuehrung, Sport-/Freizeitanlage,
 *   Adventuresports, ...): kein verlaessliches Import-Signal, haengen auch
 *   an Weingueter/Autohaeusern — bleiben unmapped (Skip + Log, kein Block).
 *
 * Unmapped Topics -> Skip + Log-Liste (`unmappedTopics` im Ergebnis;
 * Task 2 aggregiert daraus die Lauf-Statistik).
 */

import type { Tag } from '@/lib/category-classifier/enrichment-taxonomy';

export type ActivitySetting = 'indoor' | 'outdoor' | 'mixed';

export interface TopicMapping {
  /** Bestehende TAGS-Werte (enrichment-taxonomy). Leer erlaubt (s. Kopf). */
  tags: readonly Tag[];
  /** Wetter-Signal des Topics (regensicher/indoor vs. wetterabhaengig). */
  setting: ActivitySetting;
}

/**
 * Normalisiert einen Deskline-Topic-Namen fuer den Whitelist-Lookup:
 * NFC, lowercase, Whitespace (inkl. NBSP) kollabiert, getrimmt.
 * Faengt Deskline-Inkonsistenzen wie 'Wanderbus ' (trailing space) ab.
 */
export function normalizeTopicName(raw: string): string {
  return raw
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s ]+/g, ' ')
    .trim();
}

/** Whitelist: normalisierter Topic-Name -> Mapping. Keys via normalizeTopicName. */
export const TOPIC_WHITELIST: Readonly<Record<string, TopicMapping>> = {
  // ── Baeder & Wellness ────────────────────────────────────────────────────
  'freibad':                                { tags: ['schwimmen'], setting: 'outdoor' },
  'hallenbad':                              { tags: ['schwimmen'], setting: 'indoor' },
  'erlebnisbad':                            { tags: ['schwimmen'], setting: 'mixed' },
  'thermalbad':                             { tags: ['thermen-special', 'schwimmen'], setting: 'indoor' },
  'strandbad':                              { tags: ['schwimmen', 'wassersport'], setting: 'outdoor' },
  'badesee/baggersee':                      { tags: ['schwimmen'], setting: 'outdoor' },
  'schwimmen':                              { tags: ['schwimmen'], setting: 'mixed' },
  'sauna':                                  { tags: ['sauna-special'], setting: 'indoor' },
  'dampfbad':                               { tags: ['sauna-special'], setting: 'indoor' },
  'wellness-einrichtungen':                 { tags: ['wellness-day'], setting: 'indoor' },

  // ── Action & Sport ───────────────────────────────────────────────────────
  'kartsport/kartbahn':                     { tags: [], setting: 'mixed' },
  'kart fahren':                            { tags: [], setting: 'mixed' },
  'sommerrodelbahn':                        { tags: [], setting: 'outdoor' },
  'schlitten-/rodelbahn':                   { tags: [], setting: 'outdoor' },
  'rodeln':                                 { tags: [], setting: 'outdoor' },
  'nachtrodeln':                            { tags: [], setting: 'outdoor' },
  'rodelverleih':                           { tags: [], setting: 'outdoor' },
  'seilgarten/hochseilgarten':              { tags: ['klettern'], setting: 'outdoor' },
  'kletterwand/klettersteig':               { tags: ['klettern'], setting: 'mixed' },
  'klettern/sport-/felsklettern':           { tags: ['klettern'], setting: 'outdoor' },
  'indoor kletterwand':                     { tags: ['klettern', 'bouldern'], setting: 'indoor' },
  'eisklettern':                            { tags: ['klettern'], setting: 'outdoor' },
  'bergsteigen/klettern':                   { tags: ['klettern', 'bergtour'], setting: 'outdoor' },
  'flying fox':                             { tags: [], setting: 'outdoor' },
  'canyoning':                              { tags: ['wassersport'], setting: 'outdoor' },
  'raften':                                 { tags: ['rafting'], setting: 'outdoor' },
  'kanu/kajak':                             { tags: ['kanutour', 'kajak'], setting: 'outdoor' },
  'stand uppaddling':                       { tags: ['wassersport'], setting: 'outdoor' },
  'stand up paddlen':                       { tags: ['wassersport'], setting: 'outdoor' },
  'segeln':                                 { tags: ['segel-tour', 'wassersport'], setting: 'outdoor' },
  'eissegeln':                              { tags: ['wassersport'], setting: 'outdoor' },
  'surfen':                                 { tags: ['wassersport'], setting: 'outdoor' },
  'tauchen':                                { tags: ['wassersport'], setting: 'outdoor' },
  'boot fahren':                            { tags: ['wassersport'], setting: 'outdoor' },
  'bootverleih':                            { tags: ['wassersport'], setting: 'outdoor' },
  'angeln':                                 { tags: [], setting: 'outdoor' },
  'bogen schießen':                         { tags: [], setting: 'outdoor' },
  'minigolf':                               { tags: [], setting: 'outdoor' },
  'minigolfplatz':                          { tags: [], setting: 'outdoor' },
  'golfplatz/golfanlage/driving range':     { tags: [], setting: 'outdoor' },
  'golfen':                                 { tags: [], setting: 'outdoor' },
  'indoor golf':                            { tags: [], setting: 'indoor' },
  'kegeln':                                 { tags: [], setting: 'indoor' },
  'bowling':                                { tags: [], setting: 'indoor' },
  'trampolin':                              { tags: [], setting: 'mixed' },
  'eisbahn/eisstadion':                     { tags: [], setting: 'mixed' },
  'eislaufen':                              { tags: [], setting: 'mixed' },
  'eisstock schießen':                      { tags: [], setting: 'mixed' },
  'reiten':                                 { tags: ['reiten'], setting: 'mixed' },
  'reithalle':                              { tags: ['reiten'], setting: 'indoor' },
  'reitplatz':                              { tags: ['reiten'], setting: 'outdoor' },
  'ponyreiten':                             { tags: ['reiten'], setting: 'outdoor' },
  'reitunterricht':                         { tags: ['reiten'], setting: 'mixed' },
  'kutsch- / planwagen / pferdeschlittenfahrten': { tags: ['reiten'], setting: 'outdoor' },
  'tennis':                                 { tags: ['tennis'], setting: 'mixed' },
  'tennisplatz':                            { tags: ['tennis'], setting: 'outdoor' },
  'tennishalle':                            { tags: ['tennis'], setting: 'indoor' },
  'tischtennis':                            { tags: [], setting: 'mixed' },
  'badminton':                              { tags: [], setting: 'indoor' },
  'beach volleyball':                       { tags: [], setting: 'outdoor' },
  'skateboard':                             { tags: [], setting: 'outdoor' },

  // ── Familie ──────────────────────────────────────────────────────────────
  'spielplatz':                             { tags: [], setting: 'outdoor' },
  'kinderspielplatz':                       { tags: [], setting: 'outdoor' },
  'zoo/tierpark/wildpark/-gehege':          { tags: [], setting: 'outdoor' },
  'tierpark':                               { tags: [], setting: 'outdoor' },
  'streicheltiere':                         { tags: [], setting: 'outdoor' },
  'erlebnispark/freizeitpark':              { tags: [], setting: 'outdoor' },
  'lama trekking':                          { tags: ['wandern'], setting: 'outdoor' },

  // ── Kultur & Sehenswertes ────────────────────────────────────────────────
  'museum':                                 { tags: ['museumstour', 'ausstellung'], setting: 'indoor' },
  'museum/galerie':                         { tags: ['museumstour', 'ausstellung'], setting: 'indoor' },
  'kunst & kultur museum':                  { tags: ['museumstour', 'ausstellung'], setting: 'indoor' },
  'freilichtmuseum':                        { tags: ['museumstour'], setting: 'outdoor' },
  'galerie':                                { tags: ['ausstellung'], setting: 'indoor' },
  'ausstellungen':                          { tags: ['ausstellung'], setting: 'indoor' },
  'schlösser/burgen':                       { tags: ['burgführung'], setting: 'mixed' },
  'ruine':                                  { tags: ['burgführung'], setting: 'outdoor' },
  'bergwerk/schaubergwerk':                 { tags: ['museumstour'], setting: 'indoor' },
  'höhlen/grotten':                         { tags: ['naturführung'], setting: 'indoor' },
  'höhlenführung':                          { tags: ['naturführung'], setting: 'indoor' },
  'theater/oper':                           { tags: ['theater'], setting: 'indoor' },
  'kino':                                   { tags: ['kino', 'film'], setting: 'indoor' },
  'naturdenkmal':                           { tags: ['naturführung'], setting: 'outdoor' },
  'wasserfall':                             { tags: ['naturführung'], setting: 'outdoor' },
  'natur-/nationalpark':                    { tags: ['naturführung'], setting: 'outdoor' },
  'naturschutzgebiet':                      { tags: ['naturführung'], setting: 'outdoor' },
  'aussichtspunkte/-plattformen':           { tags: [], setting: 'outdoor' },
  'lehrpfad/-e':                            { tags: ['wandern'], setting: 'outdoor' },

  // ── Generische Ausflugs-/Freizeit-Topics (Whitelist-Runde 2, 2026-07-26) ──
  // Aus dem Skip-Log des ersten Vollimports: zusammen ~15k uebersprungene POIs.
  // Bewusst leere Tags wo kein TAGS-Wert passt (Muster: aussichtspunkte) —
  // Noindex-Gate (E7) sichert die Qualitaet der Detailseiten weiterhin ab.
  'sport-/freizeitanlage':                  { tags: [], setting: 'mixed' },
  'diverse sehenswürdigkeiten':             { tags: [], setting: 'mixed' },
  'ausflugsziel für familien/kinder':       { tags: [], setting: 'mixed' },
  'ausflug':                                { tags: [], setting: 'mixed' },
  'ausflugstipps':                          { tags: [], setting: 'mixed' },
  'bauwerke':                               { tags: [], setting: 'mixed' },

  // ── Whitelist-Runde 3 (2026-07-31, aus dem Skip-Log von Lauf 4) ───────────
  // Bewusst NUR diese vier: der Rest der ~21k uebersprungenen POIs ist
  // Gastronomie (Regionale Kueche 8.101, Oesterreichische Kueche 6.171,
  // Hausmannskost 3.343, ...) und bleibt via EXCLUDED_TOPICS/unmapped drausen.
  'kirchen/stifte/klöster':                 { tags: [], setting: 'mixed' },
  'kapelle':                                { tags: [], setting: 'mixed' },
  'e-bike':                                 { tags: ['radfahren'], setting: 'outdoor' },
  'fahrrad fahren':                         { tags: ['radfahren'], setting: 'outdoor' },

  // ── Wandern & Rad ────────────────────────────────────────────────────────
  'wandern':                                { tags: ['wandern'], setting: 'outdoor' },
  'wanderweg/-e':                           { tags: ['wandern'], setting: 'outdoor' },
  'wanderungen/bergtouren':                 { tags: ['wandern', 'bergtour'], setting: 'outdoor' },
  'themenwanderung':                        { tags: ['wandern'], setting: 'outdoor' },
  'winterwandern':                          { tags: ['wandern'], setting: 'outdoor' },
  'schneeschuh wandern':                    { tags: ['wandern'], setting: 'outdoor' },
  'radweg/radroute':                        { tags: ['radfahren'], setting: 'outdoor' },
  'mountainbike-strecken':                  { tags: ['mountainbike', 'radfahren'], setting: 'outdoor' },
  'bergbahn/seilbahn':                      { tags: [], setting: 'outdoor' },
  'berg-/seilbahn':                         { tags: [], setting: 'outdoor' },

  // ── Winter ───────────────────────────────────────────────────────────────
  'ski fahren':                             { tags: ['ski'], setting: 'outdoor' },
  'alpinski fahren':                        { tags: ['ski'], setting: 'outdoor' },
  'skitouren':                              { tags: ['ski', 'bergtour'], setting: 'outdoor' },
  'langlaufen':                             { tags: ['langlauf'], setting: 'outdoor' },
  'loipe':                                  { tags: ['langlauf'], setting: 'outdoor' },
  'snowboarden':                            { tags: ['snowboard'], setting: 'outdoor' },
};

/**
 * Blockliste: Gastro/Shops/Weingueter/Infrastruktur/Services. Ein POI mit
 * einem dieser Topics wird NICHT importiert, auch wenn er zusaetzlich ein
 * Whitelist-Topic traegt (Deskline taggt z. B. Sportshops mit 'Ski fahren').
 * Namen live beobachtet 2026-07-24 (gleiche Stichprobe wie Whitelist).
 */
export const EXCLUDED_TOPICS: ReadonlySet<string> = new Set([
  // Gastro
  'restaurant', 'gasthof/gasthaus/gaststätte', 'café-restaurant',
  'kaffeehaus/konditorei', 'bar/pub/lounge', 'bar-restaurant', 'pizzeria',
  'imbissstube/snackbar', 'bistro', 'eisdiele', 'buschenschank/heuriger',
  'almwirtschaft/jausenstation', 'berghütte/bergrestaurant', 'skihütte',
  'ausflugslokal', 'haubenlokal', 'pub/weinbar/weinstube',
  'nachtclub/nachtlokal', 'discothek/tanzlokal', 'drive-in/take-away',
  // Weingueter & Direktvermarktung
  'weingut/weinkeller', 'weinprobe/-verkostung/-verkauf', 'vinothek',
  'sektkellerei', 'brauerei', 'direktvermarkter', 'bio-direktvermarkter',
  'bauernladen / schnapsbrennerei', 'erlebnisverkostung',
  // Shops/Handel
  'geschäfte/shops', 'supermarkt', 'minimarkt', 'sportgeschäft',
  'souvenirgeschäft', 'geschenkeladen', 'boutique / modegeschäft',
  'buchhandlung/zeitschriften', 'tabak / trafik', 'shopping-center',
  'elektro - fachgeschäft', 'metzgerei', 'skiverleih', 'spielzeug',
  // Infrastruktur/Verkehr
  'e-bike ladestation', 'e-bike-ladestation', 'e-auto-tankstelle',
  'tankstelle', 'elektro-fahrzeug', 'parkhaus/-garage/-platz',
  'taxi/funktaxi', 'bus', 'busunternehmen', 'busverbindung', 'bahnhof',
  'zug/bahn', 'fähre/schiff', 'anlegestelle',
  // Services/Gesundheit/Verwaltung
  'banken/sparkassen/geldautomaten', 'finanz - dienstleistungen',
  'arzt', 'facharzt', 'zahnarzt', 'tierarzt', 'apotheke',
  'gesundheitseinrichtungen', 'ahb/reha-klinik', 'friseur', 'fußpflege',
  'nagelstudio', 'massage', 'beauty-/schönheitseinrichtungen',
  'sonnenstudio/solarium/sauna', 'dienstleistungsbetriebe', 'gewerbe',
  'auto-/kfz-werkstatt', 'auto', 'pannen-/abschleppdienst',
  'ämter/verwaltung', 'polizei', 'toiletten (öffentlich)',
  'zustellservice/zustelldienst', 'reisebüro',
]);

export interface TopicMapResult {
  /** Deduplizierte, alphabetisch sortierte Tags aller gemappten Topics. */
  tags: Tag[];
  /** Aggregiertes Wetter-Signal (Regel s. Kopfkommentar); null = unbekannt. */
  setting: ActivitySetting | null;
  /** Whitelist-Treffer: Original-Namen, dedupliziert + sortiert. */
  matchedTopics: string[];
  /** Blocklisten-Treffer (Gastro/Shops/...): dedupliziert + sortiert. */
  excludedTopics: string[];
  /** Weder gemappt noch geblockt (Skip-Log): dedupliziert + sortiert. */
  unmappedTopics: string[];
}

/** Kanonische Anzeigeform eines Topic-Namens (Original-Case, Whitespace
 *  kollabiert). Basis fuer die deterministische Spelling-Wahl. */
function displayTopicName(raw: string): string {
  return raw.normalize('NFC').replace(/[\s ]+/g, ' ').trim();
}

/** Merkt sich pro normalisiertem Key die codepoint-kleinste Anzeigeform —
 *  dadurch ist die Spelling-Wahl unabhaengig von der Input-Reihenfolge
 *  (Mirror-Regionen liefern Case-/Whitespace-Varianten in beliebiger Folge). */
function keepSmallestSpelling(store: Map<string, string>, key: string, raw: string): void {
  const display = displayTopicName(raw);
  const existing = store.get(key);
  if (existing === undefined || display < existing) store.set(key, display);
}

function dedupeSorted(rawNames: Map<string, string>): string[] {
  return [...rawNames.values()].sort();
}

/**
 * Mappt die Deskline-Topics eines POI auf Tags + Setting.
 * Deterministisch: das GESAMTE Ergebnis (inkl. der Topic-Namenslisten)
 * haengt nur von der Topic-MENGE ab, nicht von Reihenfolge, Duplikaten
 * oder Case-/Whitespace-Varianten. Input ist bewusst `unknown` —
 * Deskline-Payloads sind Fremddaten; Nicht-Arrays liefern das leere
 * Ergebnis und Nicht-String-Elemente werden uebersprungen, statt den
 * Import-Lauf zu crashen.
 */
export function mapTopics(topicNames: unknown): TopicMapResult {
  const tagSet = new Set<Tag>();
  const settings = new Set<ActivitySetting>();
  const matched = new Map<string, string>();
  const excluded = new Map<string, string>();
  const unmapped = new Map<string, string>();

  const items: readonly unknown[] = Array.isArray(topicNames) ? topicNames : [];
  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    const key = normalizeTopicName(raw);
    if (!key) continue;
    const mapping = TOPIC_WHITELIST[key];
    if (mapping) {
      keepSmallestSpelling(matched, key, raw);
      for (const t of mapping.tags) tagSet.add(t);
      settings.add(mapping.setting);
    } else if (EXCLUDED_TOPICS.has(key)) {
      keepSmallestSpelling(excluded, key, raw);
    } else {
      keepSmallestSpelling(unmapped, key, raw);
    }
  }

  let setting: ActivitySetting | null = null;
  if (settings.size === 1) {
    setting = settings.values().next().value ?? null;
  } else if (settings.size > 1) {
    // Konflikt (indoor+outdoor) oder irgendein 'mixed' dabei -> mixed.
    setting = 'mixed';
  }

  return {
    tags: [...tagSet].sort(),
    setting,
    matchedTopics: dedupeSorted(matched),
    excludedTopics: dedupeSorted(excluded),
    unmappedTopics: dedupeSorted(unmapped),
  };
}

/**
 * Import-Entscheidung fuer Task 2: mindestens ein Whitelist-Topic UND kein
 * Blocklisten-Topic (Gastro/Shops/Weingueter/Infrastruktur bleiben draussen,
 * auch wenn Deskline sie zusaetzlich mit Aktivitaets-Topics taggt).
 */
export function isImportableTopicResult(result: TopicMapResult): boolean {
  return result.matchedTopics.length > 0 && result.excludedTopics.length === 0;
}
