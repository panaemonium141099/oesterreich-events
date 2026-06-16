import type { PrimaryCategory } from '@/lib/category-classifier/enrichment-taxonomy';

/**
 * Eventim/oeticket category code → our primary category (+ optional genre tag).
 *
 * The FIRST code on a series determines the primary category; ALL codes
 * contribute genre tags. Source: `categories_data feed_en.xlsx` mapped onto
 * the 12 PRIMARY_CATEGORIES per docs/TAXONOMY.md §2 definitions
 * (e.g. Klassik=concert→Musik, but Oper is explicitly listed under Kultur & Bühne;
 *  Messe with business focus→Wissen & Karriere). Unknown codes → Sonstiges.
 */
interface CatEntry {
  category: PrimaryCategory;
  tag?: string;
}

const MAP: Record<string, CatEntry> = {
  // ── 1x Konzerte ──
  '1A': { category: 'Musik', tag: 'rock-pop' },
  '1B': { category: 'Musik', tag: 'schlager' },
  '1C': { category: 'Musik', tag: 'festival' },
  '1D': { category: 'Nightlife & Party', tag: 'electronic' },
  '1E': { category: 'Musik', tag: 'jazz' },
  '1F': { category: 'Nightlife & Party' },
  '1G': { category: 'Musik', tag: 'metal' },
  '1H': { category: 'Musik', tag: 'hip-hop' },
  '1I': { category: 'Musik', tag: 'gospel' },
  '1K': { category: 'Musik' },
  // ── 2x Bühne / Klassik / Film ──
  '2A': { category: 'Musik', tag: 'klassik' },
  '2B': { category: 'Kultur & Bühne', tag: 'oper' },
  '2C': { category: 'Kultur & Bühne', tag: 'ballett' },
  '2D': { category: 'Kultur & Bühne', tag: 'theater' },
  '2E': { category: 'Familie & Kinder', tag: 'theater' },
  '2F': { category: 'Kultur & Bühne', tag: 'theater' },
  '2G': { category: 'Kultur & Bühne', tag: 'ausstellung' },
  '2H': { category: 'Kultur & Bühne', tag: 'lesung' },
  '2I': { category: 'Kultur & Bühne', tag: 'kino' },
  // ── 3x Sport ──
  '3A': { category: 'Sport & Bewegung', tag: 'fussball' },
  '3B': { category: 'Sport & Bewegung', tag: 'motorsport' },
  '3C': { category: 'Sport & Bewegung', tag: 'wintersport' },
  '3D': { category: 'Sport & Bewegung', tag: 'eishockey' },
  '3E': { category: 'Sport & Bewegung', tag: 'tennis' },
  '3I': { category: 'Sport & Bewegung', tag: 'handball' },
  '3K': { category: 'Sport & Bewegung', tag: 'basketball' },
  '3L': { category: 'Sport & Bewegung', tag: 'reitsport' },
  '3M': { category: 'Sport & Bewegung', tag: 'golf' },
  '3N': { category: 'Sport & Bewegung', tag: 'kampfsport' },
  '3O': { category: 'Sport & Bewegung' },
  // ── 4x Show / Musical ──
  '4A': { category: 'Kultur & Bühne', tag: 'musical' },
  '4B': { category: 'Kultur & Bühne', tag: 'show' },
  '4C': { category: 'Familie & Kinder', tag: 'zirkus' },
  // ── 5x Kabarett / Comedy ──
  '5A': { category: 'Kultur & Bühne', tag: 'kabarett' },
  '5B': { category: 'Kultur & Bühne', tag: 'comedy' },
  // ── 6x Lifestyle ──
  '6A': { category: 'Community & Freizeit' },
  '6B': { category: 'Wellness & Spiritualität' },
  '6C': { category: 'Essen & Trinken' },
  '6D': { category: 'Märkte & Feste', tag: 'shopping' },
  '6E': { category: 'Natur & Abenteuer' },
  // ── 7x Sonstiges / Wissen ──
  '7A': { category: 'Community & Freizeit' },
  '7B': { category: 'Sonstiges' },
  '7C': { category: 'Wissen & Karriere', tag: 'vortrag' },
  '7D': { category: 'Sonstiges' },
  '7E': { category: 'Wissen & Karriere', tag: 'messe' },
  // ── Text codes seen in live data ──
  Ball: { category: 'Kultur & Bühne', tag: 'ball' },
  Podcast: { category: 'Kultur & Bühne', tag: 'podcast' },
  // 8A–8J ticketPLUS / regional packages: filtered out upstream (eventType != 1).
};

export function mapEventimCategory(codes: string[]): { category: PrimaryCategory; tags: string[] } {
  const primary = codes.map((c) => MAP[c]?.category).find((c): c is PrimaryCategory => !!c) ?? 'Sonstiges';
  const tags = [...new Set(codes.map((c) => MAP[c]?.tag).filter((t): t is string => !!t))];
  return { category: primary, tags };
}
