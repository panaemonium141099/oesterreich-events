/**
 * fn-17 (Slice 2b/2c): Anzeige-Übersetzung der Event-Kategorien.
 *
 * Die DB/API-Werte bleiben die deutschen Strings aus
 * `src/lib/category-classifier/taxonomy.ts` ('Musik', 'Kultur & Bühne', …) —
 * NICHTS an Slugs, Filter-Werten oder Persistenz ändert sich. Dieses Modul
 * mappt nur den ANZEIGE-Namen auf einen stabilen Message-Key im
 * `Categories`-Namespace (messages/de.json = byte-identische DE-Werte,
 * messages/en.json = englische Übersetzung).
 *
 * Verwendung:
 *   const tCat = useTranslations('Categories');
 *   categoryLabel(tCat, event.category)   // → 'Musik' | 'Music' | Rohwert
 */

import { CATEGORY_KEYS } from '@/lib/category-classifier/taxonomy';

/** Message-Keys je Kategorie (Quelle: CATEGORY_KEYS in taxonomy.ts). */
export const CATEGORY_MESSAGE_KEYS = CATEGORY_KEYS as Record<string, string>;

/**
 * Übersetzter Anzeigename einer Kategorie. Unbekannte Werte (freie
 * Scraper-Kategorien, null) fallen unverändert auf den Rohwert zurück.
 */
export function categoryLabel(
  t: (key: string) => string,
  category: string | null | undefined,
): string {
  if (!category) return '';
  const key = CATEGORY_MESSAGE_KEYS[category];
  return key ? t(key) : category;
}
