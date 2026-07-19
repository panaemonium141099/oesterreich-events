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

export const CATEGORY_MESSAGE_KEYS: Record<string, string> = {
  'Musik': 'music',
  'Kultur & Bühne': 'culture',
  'Nightlife & Party': 'nightlife',
  'Essen & Trinken': 'food',
  'Märkte & Feste': 'markets',
  'Sport & Bewegung': 'sports',
  'Natur & Abenteuer': 'nature',
  'Wissen & Karriere': 'knowledge',
  'Familie & Kinder': 'family',
  'Community & Freizeit': 'community',
  'Wellness & Spiritualität': 'wellness',
  'Sonstiges': 'other',
};

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
