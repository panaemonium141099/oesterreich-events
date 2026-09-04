/**
 * Noindex-Gate + Canonical-Regel fuer Aktivitaets-Detailseiten
 * (fn-18 Task 3, Epic E7 + E13). Pur — die Page bettet nur ein.
 *
 * E7-Gate gegen Thin-Content (70 % SEO-Traffic): indexierbar nur mit
 * Beschreibung >= 200 Zeichen ODER (Bild + Oeffnungszeiten). Die
 * Oeffnungszeiten zaehlen AUSSCHLIESSLICH ueber das normalisierte
 * `opening_times`-Feld (E8-Vertrag) — nie ueber opening_times_raw oder
 * open_status. Dauerhaft geschlossene POIs (is_closed=true) sind immer
 * noindex: sie bleiben als Seite erreichbar (Wiedereroeffnungs-Historie,
 * kein 301->404), gehoeren aber weder in den Index noch in die Sitemap.
 *
 * E13-Canonical, seit fn-17 pro POI entschieden: solange
 * `description_en` fehlt, kanonisieren /aktivitaet/* UND
 * /en/aktivitaet/* auf die DE-URL (kein hreflang-Paar, Sitemap nur
 * DE-URL). Liegt eine Uebersetzung vor, bekommt die /en-Seite ihren
 * eigenen Canonical und beide Sprachen verweisen per hreflang
 * aufeinander — dieselbe Regel wie bei Events ueber `title_en`.
 */

export const MIN_INDEXABLE_DESCRIPTION_LENGTH = 200;

const ACTIVITY_BASE_URL = 'https://lasstreffen.at';

/** Eingabe-Sicht des Gates (Teilmenge einer poi_activities-Row). */
export interface ActivityIndexabilityInput {
  description: string | null | undefined;
  /** images jsonb: Array von { urls: string[], ... } (ingest-transform). */
  images: unknown;
  /** Normalisiertes opening_times jsonb (E8) — EINZIGER Zeiten-Lesepfad. */
  opening_times: unknown;
  /** Dauerhaft geschlossen -> immer noindex. */
  is_closed?: boolean | null;
}

/**
 * Alle renderbaren Bild-URLs aus dem images-jsonb — defensiv gegen
 * malformte Rows (null-Eintraege, fehlende/nicht-Array-urls, leere
 * Strings). Gemeinsamer Helper fuer Gate, JSON-LD und Hero: das jsonb
 * kommt roh aus der DB und ist nur GECASTET, nie validiert.
 */
export function renderableImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  const result: string[] = [];
  for (const img of images) {
    if (img == null || typeof img !== 'object') continue;
    const urls = (img as { urls?: unknown }).urls;
    if (!Array.isArray(urls)) continue;
    for (const url of urls) {
      if (typeof url === 'string' && url.trim() !== '') result.push(url);
    }
  }
  return result;
}

/** True, wenn mindestens ein Bild mit nicht-leerer URL vorhanden ist. */
export function hasRenderableImage(images: unknown): boolean {
  return renderableImageUrls(images).length > 0;
}

/**
 * True, wenn das NORMALISIERTE opening_times-Feld nicht leer ist.
 * (Das Gate zaehlt Oeffnungszeiten nur bei nicht-leerem E8-Feld —
 * opening_times_raw/open_status sind hier bewusst unsichtbar.)
 */
export function hasOpeningTimes(openingTimes: unknown): boolean {
  return Array.isArray(openingTimes) && openingTimes.length > 0;
}

/** E7-Gate: Beschreibung >= 200 Zeichen ODER (Bild + Oeffnungszeiten). */
export function isActivityIndexable(input: ActivityIndexabilityInput): boolean {
  if (input.is_closed === true) return false;
  const description = (input.description ?? '').trim();
  if (description.length >= MIN_INDEXABLE_DESCRIPTION_LENGTH) return true;
  return hasRenderableImage(input.images) && hasOpeningTimes(input.opening_times);
}

/**
 * Kanonische URL einer Aktivitaet in der DE-Fassung. Bleibt der Anker
 * fuer JSON-LD und @id — die beschreiben dieselbe Entitaet, egal in
 * welcher Sprache die Seite gerade rendert.
 */
export function activityCanonicalUrl(slug: string): string {
  return `${ACTIVITY_BASE_URL}/aktivitaet/${slug}`;
}

/**
 * `alternates` fuer die Detailseite. Ohne Uebersetzung zeigt auch die
 * /en-Seite auf die DE-URL und es gibt KEIN hreflang-Paar (sonst meldet
 * man Google zwei URLs mit identischem deutschem Text). Mit
 * Uebersetzung kanonisiert jede Sprache auf sich selbst.
 */
export function activityAlternates(
  slug: string,
  locale: string,
  hasTranslation: boolean,
): { canonical: string; languages?: Record<string, string> } {
  const de = activityCanonicalUrl(slug);
  if (!hasTranslation) return { canonical: de };
  const en = `${ACTIVITY_BASE_URL}/en/aktivitaet/${slug}`;
  return {
    canonical: locale === 'en' ? en : de,
    languages: { 'de-AT': de, en, 'x-default': de },
  };
}

/** Kanonische URL der Uebersichtsseite — ebenfalls immer DE (E13). */
export function activityListCanonicalUrl(): string {
  return `${ACTIVITY_BASE_URL}/aktivitaeten`;
}
