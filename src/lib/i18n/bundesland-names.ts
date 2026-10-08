import { BUNDESLAND_NAMES, type BundeslandId } from '@/lib/districtsAT';
import { BUNDESLAENDER } from '@/lib/bundeslaender';

/**
 * fn-17: Englische Exonyme der Bundesländer für die /en-Ansicht.
 * Datenwerte (Slugs, DB-Felder, URLs) bleiben unverändert deutsch —
 * hier wird NUR die Anzeige lokalisiert.
 */
const EN_NAMES: Record<BundeslandId, string> = {
  wien: 'Vienna',
  niederoesterreich: 'Lower Austria',
  oberoesterreich: 'Upper Austria',
  salzburg: 'Salzburg',
  steiermark: 'Styria',
  kaernten: 'Carinthia',
  tirol: 'Tyrol',
  vorarlberg: 'Vorarlberg',
  burgenland: 'Burgenland',
};

/** Deutscher Anzeigename → Slug-Id (für Aufrufer, die nur den Namen haben). */
const NAME_TO_ID: Record<string, BundeslandId> = Object.fromEntries(
  (Object.entries(BUNDESLAND_NAMES) as Array<[BundeslandId, string]>).map(
    ([id, name]) => [name.toLowerCase(), id],
  ),
) as Record<string, BundeslandId>;

function toId(idOrName: string): BundeslandId | null {
  const raw = idOrName.trim().toLowerCase();
  const folded = raw
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
  if (folded in EN_NAMES) return folded as BundeslandId;
  return NAME_TO_ID[raw] ?? null;
}

/**
 * Anzeigename eines Bundeslands für die gegebene Locale.
 * Akzeptiert Slug-Id ('niederoesterreich') ODER deutschen Namen
 * ('Niederösterreich'); unbekannte Werte kommen unverändert zurück.
 */
export function bundeslandDisplayName(idOrName: string, locale: string): string {
  const id = toId(idOrName);
  if (id) return locale === 'en' ? EN_NAMES[id] : BUNDESLAND_NAMES[id];
  // Kein echtes Bundesland: BUNDESLAENDER kennt auch den Karten-Scope
  // 'all' ("Ganz Österreich"). Ohne diesen Fallback stünde der rohe Slug
  // im sichtbaren Text ("Events in all"). Beide Sprachen zeigen hier den
  // deutschen Namen.
  return BUNDESLAENDER.find(b => b.id === idOrName)?.name ?? idOrName;
}

/**
 * Anzeigename eines ORTES (Gemeinde, Stadt) für die gegebene Locale.
 *
 * Österreichische Ortsnamen sind Eigennamen und bleiben unübersetzt — mit
 * einer Ausnahme, die im Englischen fest etabliert ist: Wien → Vienna.
 * Genau diese Fälle stehen bereits in EN_NAMES (die neun Bundesländer, von
 * denen drei zugleich Gemeindenamen sind), deshalb delegiert das hier
 * statt eine zweite Liste zu pflegen. Alles andere kommt unverändert
 * zurück.
 *
 * Ohne das stand auf /en/gemeinde/1010-wien "Events in Wien", während der
 * Bundesland-Hub /en/wien "Events in Vienna" sagte.
 */
export function placeDisplayName(name: string, locale: string): string {
  return bundeslandDisplayName(name, locale);
}
