/**
 * Namensabgleich des Follow-Pfads (fn-10): Kleinschreibung, Leerraum,
 * Diakritika weg. Liegt hier ohne weitere Importe, damit Client-Inseln
 * (ArtistsLive auf der Startseite) denselben Normalisierer verwenden wie
 * die Follow-API und `/api/me/landing`, ohne die Matching-Engine samt
 * Mailversand in den Browser zu ziehen. `@/lib/artist-matching`
 * re-exportiert beide Funktionen, bestehende Importe bleiben gültig.
 */

/** Diakritika entfernen: „Hubert von Goisern" bleibt, „Beyoncé" wird „Beyonce". */
export function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Kleinschreibung, getrimmt, ohne Diakritika. */
export function normalizeArtistName(name: string): string {
  return stripDiacritics(name.toLowerCase().trim());
}
