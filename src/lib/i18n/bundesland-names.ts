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
  // Kein echtes Bundesland: BUNDESLAENDER kennt Pseudo-Regionen wie
  // 'at-de-ch' ("Österreich, Deutschland, Schweiz"). Ohne diesen Fallback
  // stünde der rohe Slug im sichtbaren Text ("Events in at-de-ch").
  // Beide Sprachen zeigen den deutschen Namen — es sind Eigennamen von
  // Regionen bzw. Länderlisten, für die es keine EN-Variante gibt.
  return BUNDESLAENDER.find(b => b.id === idOrName)?.name ?? idOrName;
}
