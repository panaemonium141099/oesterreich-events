/**
 * Deterministischer Preis-Hinweis aus Freitext (fn-18, Task 1).
 *
 * Reiner Euro-Regex — KEIN KI-Enrichment (Masterplan §6). Ein Betrag zaehlt
 * nur mit explizitem Waehrungs-Marker (€ / EUR / Euro); dadurch sind
 * Hausnummern ("Hauptstraße 12"), PLZ und nackte Jahreszahlen ("ab 2018")
 * strukturell ausgeschlossen. Zusaetzliche Anti-Patterns:
 *   - Jahreszahl-Guard: ganzzahlige Werte 1900–2099 ohne Dezimalteil werden
 *     verworfen (auch mit €-Marker, z. B. "€ 2018").
 *   - kW/kWh-Guard: Betraege direkt vor/als Energie-Rate ("€ 0,45/kWh")
 *     werden verworfen (E-Ladestationen-Sprech, kein Eintrittspreis).
 *   - Plausibilitaets-Kappe: > 5000 € ist kein Freizeit-Preishinweis.
 *
 * Ergebnis: kleinster gefundener Betrag, formatiert als '€ 12' bzw.
 * '€ 12,50'; Prefix 'ab ' wenn der Text ein ab/von-Signal traegt oder
 * mehrere unterschiedliche Betraege nennt. Null, wenn nichts Valides.
 */

const NUMBER = String.raw`\d{1,4}(?:\.\d{3})*(?:,\d{1,2})?|\d{1,4}(?:\.\d{1,2})?`;
// Betrag darf nicht Teil einer laengeren Zahl sein (Telefonnummern etc.);
// Satzpunkt nach dem Betrag ("€ 12.") bleibt erlaubt.
const NOT_IN_NUMBER_BEFORE = String.raw`(?<![\d.,])`;
const NOT_IN_NUMBER_AFTER = String.raw`(?!\d|[.,]\d)`;

// € 12 / EUR 12,50 / Euro 9,90  — Marker vor dem Betrag
const CURRENCY_BEFORE = new RegExp(
  String.raw`(?:€|eur(?:o)?\b)\s*(${NUMBER})${NOT_IN_NUMBER_AFTER}`,
  'gi',
);
// 12 € / 12,50 EUR / 9 Euro — Marker nach dem Betrag
const CURRENCY_AFTER = new RegExp(
  String.raw`${NOT_IN_NUMBER_BEFORE}(${NUMBER})${NOT_IN_NUMBER_AFTER}\s*(?:€|eur(?:o)?\b)`,
  'gi',
);
// ab/von (ca.) unmittelbar vor dem Match -> "ab €"-Semantik
const AB_PREFIX = /(?:\bab|\bvon)\s*(?:ca\.?\s*)?$/i;
// kW/kWh unmittelbar nach dem Match -> Energie-Rate, kein Preis
const KW_SUFFIX = /^\s*\/?\s*kwh?\b/i;

const MAX_PLAUSIBLE_PRICE = 5000;

interface PriceMatch {
  value: number;
  hasAbMarker: boolean;
}

/** Parst deutsche Zahlendarstellung: Punkt+3 Ziffern = Tausender, Komma = Dezimal. */
function parseGermanNumber(raw: string): number {
  let s = raw;
  if (s.includes(',')) {
    // Komma ist Dezimaltrenner, Punkte sind Tausender.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{3}(?:\.|$)/.test(s)) {
    // Nur Punkte, in Tausender-Gruppierung.
    s = s.replace(/\./g, '');
  }
  // Sonst: Punkt mit 1-2 Nachkommastellen -> bereits Dezimalpunkt.
  return Number(s);
}

function isValidPrice(value: number, textAfter: string): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  if (value > MAX_PLAUSIBLE_PRICE) return false;
  // Jahreszahl-Guard: ganzzahlig 1900-2099.
  if (Number.isInteger(value) && value >= 1900 && value <= 2099) return false;
  // Energie-Raten-Guard.
  if (KW_SUFFIX.test(textAfter)) return false;
  return true;
}

function collectMatches(text: string): PriceMatch[] {
  const matches: PriceMatch[] = [];
  for (const re of [CURRENCY_BEFORE, CURRENCY_AFTER]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const value = parseGermanNumber(m[1]);
      const textAfter = text.slice(m.index + m[0].length);
      if (!isValidPrice(value, textAfter)) continue;
      const textBefore = text.slice(0, m.index);
      matches.push({ value, hasAbMarker: AB_PREFIX.test(textBefore) });
    }
  }
  return matches;
}

/** Formatiert deutsch: ganze Betraege ohne Nachkommastellen, sonst 2. */
function formatEuro(value: number): string {
  if (Number.isInteger(value)) return `€ ${value}`;
  return `€ ${value.toFixed(2).replace('.', ',')}`;
}

/**
 * Extrahiert einen Preis-Hinweis ('€ 12' / 'ab € 9,90') aus Freitext.
 * Deterministisch; null wenn kein valider Euro-Betrag gefunden wird.
 */
export function extractPriceHint(text: string | null | undefined): string | null {
  if (!text) return null;
  const matches = collectMatches(text);
  if (matches.length === 0) return null;

  const distinctValues = new Set(matches.map((m) => m.value));
  const min = Math.min(...distinctValues);
  const hasAb = matches.some((m) => m.hasAbMarker) || distinctValues.size > 1;

  return hasAb ? `ab ${formatEuro(min)}` : formatEuro(min);
}
