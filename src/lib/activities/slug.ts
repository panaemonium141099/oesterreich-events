/**
 * Stabile Aktivitaets-Slugs (fn-18, Epic E5).
 *
 * Format: `{slugify(name)}-{shortid}` mit
 *   shortid = erste 12 Hex-Zeichen von sha1(`${source}:${source_id}`), lowercase.
 *
 * 12 Hex = 48 bit — kollisionsfest bei 20k+ Rows (8 Hex/32 bit waeren es
 * nicht). Der Slug wird beim ersten Insert fixiert und bei Re-Imports NIE
 * regeneriert (SEO-URL-Stabilitaet); der Task-3-Redirect-Resolver nutzt
 * dieselben Funktionen (exakter Slug, sonst shortid-Lookup -> 301).
 *
 * Server-only (node:crypto) — nicht in Client-Bundles importieren.
 */

import { createHash } from 'crypto';

const MAX_NAME_SLUG_LENGTH = 60;
const SHORTID_HEX_LENGTH = 12;

/** German umlaut replacements — same table as the event slugifier. */
const UMLAUT_MAP: Record<string, string> = {
  'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
  'Ä': 'ae', 'Ö': 'oe', 'Ü': 'ue',
};

/**
 * shortid = erste 12 Hex-Zeichen von sha1(`${source}:${source_id}`), lowercase.
 * Wird als EIGENE Spalte gespeichert (UNIQUE-Index) — der Resolver-Fallback
 * laeuft darueber, nie ueber Suffix-Scans auf slug.
 */
export function activityShortId(source: string, sourceId: string): string {
  return createHash('sha1')
    .update(`${source}:${sourceId}`, 'utf8')
    .digest('hex')
    .slice(0, SHORTID_HEX_LENGTH);
}

/**
 * Slugified name portion: umlauts -> ae/oe/ue, diacritics gestript,
 * lowercase, non-alphanumerics -> '-', max 60 Zeichen (nicht mitten im
 * Wort abgeschnitten). Fallback 'aktivitaet' fuer leere Ergebnisse.
 */
export function slugifyActivityName(name: string): string {
  // NFC ZUERST: dekomponierte Eingaben ('a' + U+0308) muessen die
  // Umlaut-Ersetzung genauso treffen wie praekombinierte ('ä') —
  // sonst hinge der (fixierte!) Slug von der Unicode-Normalform ab.
  let slug = name.normalize('NFC');
  for (const [char, replacement] of Object.entries(UMLAUT_MAP)) {
    slug = slug.split(char).join(replacement);
  }
  slug = slug.normalize('NFD').replace(/[̀-ͯ]/g, '');
  slug = slug.toLowerCase();
  slug = slug.replace(/[^a-z0-9]+/g, '-');
  slug = slug.replace(/^-+|-+$/g, '');

  if (slug.length > MAX_NAME_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_NAME_SLUG_LENGTH);
    // Nie mitten im Wort abschneiden: auf den letzten Hyphen zuruecktrimmen,
    // egal wo er liegt. Nur wenn das erste Wort selbst >60 Zeichen ist
    // (kein Hyphen vorhanden), bleibt der harte Schnitt.
    const lastHyphen = slug.lastIndexOf('-');
    if (lastHyphen > 0) {
      slug = slug.slice(0, lastHyphen);
    }
  }

  return slug || 'aktivitaet';
}

/** Voller Slug `{slugify(name)}-{shortid}` — beim Insert fixiert (E5). */
export function buildActivitySlug(name: string, source: string, sourceId: string): string {
  return `${slugifyActivityName(name)}-${activityShortId(source, sourceId)}`;
}

/**
 * Extrahiert die 12-Hex-shortid aus einem (ggf. veralteten) Slug-Parameter
 * fuer den Task-3-Resolver-Fallback. Null, wenn der letzte Hyphen-Token
 * keine 12-Hex-shortid ist.
 */
export function extractActivityShortId(slugParam: string): string | null {
  const lastHyphenIdx = slugParam.lastIndexOf('-');
  const tail = lastHyphenIdx === -1 ? slugParam : slugParam.slice(lastHyphenIdx + 1);
  return /^[0-9a-f]{12}$/.test(tail) ? tail : null;
}
