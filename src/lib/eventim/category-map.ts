import type { PrimaryCategory } from '@/lib/category-classifier/enrichment-taxonomy';
import { TAGS } from '@/lib/category-classifier/enrichment-taxonomy';

/**
 * Eventim/oeticket category code → our primary category (+ optional genre/content tags).
 *
 * The FIRST code on a series determines the primary category; ALL codes
 * contribute tags. Source: `categories_data feed_en.xlsx` mapped onto the
 * 12 PRIMARY_CATEGORIES per docs/TAXONOMY.md §2 (e.g. Klassik=concert→Musik,
 * but Oper is listed under Kultur & Bühne; Messe w/ business focus→Wissen).
 *
 * Tags are ONLY emitted when they exist in the canonical `TAGS` vocabulary
 * (so the existing tag filter can use them) — emitted tags are filtered
 * through TAG_SET as a safety net. Codes with no vocab match carry no tag.
 */
interface CatEntry {
  category: PrimaryCategory;
  tags?: string[];
}

const MAP: Record<string, CatEntry> = {
  // ── 1x Konzerte ──
  '1A': { category: 'Musik', tags: ['rock', 'pop'] },
  '1B': { category: 'Musik', tags: ['schlager'] },
  '1C': { category: 'Musik' },                 // "Festival" — no single vocab genre
  '1D': { category: 'Nightlife & Party', tags: ['electro'] },
  '1E': { category: 'Musik', tags: ['jazz'] },
  '1F': { category: 'Nightlife & Party' },
  '1G': { category: 'Musik', tags: ['metal'] },
  '1H': { category: 'Musik', tags: ['hip-hop'] },
  '1I': { category: 'Musik' },                 // Gospel — no vocab tag
  '1K': { category: 'Musik' },
  // ── 2x Bühne / Klassik / Film ──
  '2A': { category: 'Musik', tags: ['klassik'] },
  '2B': { category: 'Kultur & Bühne', tags: ['oper'] },
  '2C': { category: 'Kultur & Bühne', tags: ['ballett'] },
  '2D': { category: 'Kultur & Bühne', tags: ['theater'] },
  '2E': { category: 'Familie & Kinder', tags: ['kindertheater'] },
  '2F': { category: 'Kultur & Bühne', tags: ['theater'] },
  '2G': { category: 'Kultur & Bühne', tags: ['ausstellung'] },
  '2H': { category: 'Kultur & Bühne', tags: ['lesung'] },
  '2I': { category: 'Kultur & Bühne', tags: ['kino'] },
  // ── 3x Sport ──
  '3A': { category: 'Sport & Bewegung', tags: ['fussball'] },
  '3B': { category: 'Sport & Bewegung' },      // Motorsport — no vocab tag
  '3C': { category: 'Sport & Bewegung' },      // Wintersport (generic)
  '3D': { category: 'Sport & Bewegung', tags: ['eishockey'] },
  '3E': { category: 'Sport & Bewegung', tags: ['tennis'] },
  '3I': { category: 'Sport & Bewegung' },      // Handball
  '3K': { category: 'Sport & Bewegung' },      // Basketball
  '3L': { category: 'Sport & Bewegung', tags: ['reiten'] },
  '3M': { category: 'Sport & Bewegung' },      // Golf
  '3N': { category: 'Sport & Bewegung' },      // Kampfsport
  '3O': { category: 'Sport & Bewegung' },
  // ── 4x Show / Musical ──
  '4A': { category: 'Kultur & Bühne', tags: ['musical'] },
  '4B': { category: 'Kultur & Bühne' },        // Show (generic)
  '4C': { category: 'Familie & Kinder' },      // Zirkus
  // ── 5x Kabarett / Comedy ──
  '5A': { category: 'Kultur & Bühne', tags: ['kabarett'] },
  '5B': { category: 'Kultur & Bühne', tags: ['comedy'] },
  // ── 6x Lifestyle ──
  '6A': { category: 'Community & Freizeit' },  // Weekender
  '6B': { category: 'Wellness & Spiritualität', tags: ['wellness-day'] },
  '6C': { category: 'Essen & Trinken' },       // Kulinarik (generic)
  '6D': { category: 'Märkte & Feste' },        // Shopping
  '6E': { category: 'Natur & Abenteuer' },     // Abenteuer (generic)
  // ── 7x Sonstiges / Wissen ──
  '7A': { category: 'Community & Freizeit' },  // Tourismus
  '7B': { category: 'Sonstiges' },             // Eventreisen
  '7C': { category: 'Wissen & Karriere', tags: ['lecture'] },
  '7D': { category: 'Sonstiges' },
  '7E': { category: 'Wissen & Karriere', tags: ['messe'] },
  // ── Text codes seen in live data ──
  Ball: { category: 'Kultur & Bühne', tags: ['ball'] },
  Podcast: { category: 'Kultur & Bühne' },
  // 8A–8J ticketPLUS / regional packages: filtered out upstream (eventType != 1).
};

const TAG_SET = new Set<string>(TAGS);

export function mapEventimCategory(codes: string[]): { category: PrimaryCategory; tags: string[] } {
  const primary = codes.map((c) => MAP[c]?.category).find((c): c is PrimaryCategory => !!c) ?? 'Sonstiges';
  const tags = [...new Set(codes.flatMap((c) => MAP[c]?.tags ?? []))].filter((t) => TAG_SET.has(t));
  return { category: primary, tags };
}
