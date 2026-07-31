/**
 * Client-sichere Affiliate-Produkt-Typen (fn-18 Task 5).
 *
 * Bewusst OHNE Runtime-Imports (kein supabase-js, kein node:*) — dieses
 * Modul wird sowohl vom Matching-Script, von der API-Route als auch von
 * der Client-Komponente BookingBox importiert.
 *
 * Der Shape ist der in Task 1 eingefrorene Mindest-Contract der Spalte
 * `poi_activities.affiliate_product` (Migration 20260724120000:83):
 *   {product_code, title, teaser, image_url, price_from, currency,
 *    rating, review_count, url, matched_at, refreshed_at}
 *
 * WICHTIG (Viator-ToS, siehe viator-client.ts): Werte aus diesem Objekt
 * duerfen NICHT im serverseitig gerenderten HTML einer indexierbaren
 * Seite landen. Der einzige Lesepfad zur Anzeige ist die Client-Fetch-
 * Route /api/activities/[id]/booking.
 */

export interface AffiliateProduct {
  /** Viator-Produktcode (z. B. "5010SYDNEY"). Primaerschluessel beim Refresh. */
  product_code: string;
  title: string;
  teaser: string | null;
  image_url: string | null;
  /** "ab"-Preis. Kurzlebig — nur mit Hinweis "Preis kann abweichen" anzeigen. */
  price_from: number | null;
  /** ISO-4217 (Viator liefert bei uns EUR). */
  currency: string | null;
  rating: number | null;
  review_count: number | null;
  /** Fertiger Deeplink inkl. pid (buildViatorDeeplink). */
  url: string;
  /** ISO-Zeitstempel des Erst-Matchings (wird beim Refresh NICHT ueberschrieben). */
  matched_at: string;
  /** ISO-Zeitstempel des letzten Stammdaten/Preis-Refresh. */
  refreshed_at: string | null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  // jsonb-Zahlen kommen ueber PostgREST als number; Strings nur defensiv.
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Defensives Verengen des rohen jsonb auf den Contract.
 *
 * `affiliate_product` ist in PublicActivity als `unknown` typisiert und
 * kommt ungeprueft aus der DB — ein malformter Eintrag darf weder den
 * ISR-Render noch die API-Route crashen (Muster: renderableImageUrls in
 * indexability.ts). Pflichtfelder sind product_code, title und url;
 * fehlt eines davon, gibt es kein anzeigbares Produkt.
 */
export function parseAffiliateProduct(raw: unknown): AffiliateProduct | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;

  const productCode = str(rec.product_code);
  const title = str(rec.title);
  const url = str(rec.url);
  if (!productCode || !title || !url) return null;

  // Nur http(s) — schuetzt gegen javascript:-URLs aus kaputten Daten.
  if (!/^https?:\/\//i.test(url)) return null;

  return {
    product_code: productCode,
    title,
    teaser: str(rec.teaser),
    image_url: (() => {
      const img = str(rec.image_url);
      return img && /^https?:\/\//i.test(img) ? img : null;
    })(),
    price_from: num(rec.price_from),
    currency: str(rec.currency),
    rating: num(rec.rating),
    review_count: num(rec.review_count),
    url,
    matched_at: str(rec.matched_at) ?? '',
    refreshed_at: str(rec.refreshed_at),
  };
}

/**
 * Billiger Server-Check "gibt es ueberhaupt ein Angebot?" — liefert NUR
 * einen Boolean und kein Viator-Feld. Damit darf die ISR-Seite entscheiden,
 * ob die Client-BookingBox ueberhaupt gemountet wird, ohne Viator-Inhalte
 * ins statische HTML zu schreiben (ToS) und ohne fuer die ~95 % Aktivitaeten
 * ohne Match einen leeren API-Roundtrip zu erzeugen.
 */
export function hasAffiliateOffer(raw: unknown): boolean {
  return parseAffiliateProduct(raw) !== null;
}
