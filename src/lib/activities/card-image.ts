/**
 * Bildauswahl für Aktivitäts-Karten: erstes brauchbares Bild aus dem
 * images-jsonb samt Bildnachweis. Pur, damit Karte (Client-Komponente
 * ActivityCardImage) und App-API (src/lib/app-api) dasselbe Bild und
 * denselben Nachweis zeigen. `images` kommt roh und ungeprüft aus dem jsonb.
 */
export interface PickedActivityImage {
  url: string;
  /** Copyright und Urheber, dedupliziert, „ · "-getrennt; null ohne Angabe. */
  credit: string | null;
}

export function pickActivityImage(images: unknown): PickedActivityImage | null {
  if (!Array.isArray(images)) return null;
  for (const img of images) {
    if (img == null || typeof img !== 'object') continue;
    const cand = img as { urls?: unknown; copyright?: unknown; author?: unknown };
    if (!Array.isArray(cand.urls)) continue;
    const url = cand.urls.find((u): u is string => typeof u === 'string' && u.trim() !== '');
    if (!url) continue;
    const creditParts = [cand.copyright, cand.author]
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .map((v) => v.trim());
    return { url, credit: [...new Set(creditParts)].join(' · ') || null };
  }
  return null;
}
