/**
 * The canonical list of place hubs surfaced in discovery UI (landing-page
 * "nach Stadt & Region" block + /entdecken region rail). Single source so the
 * two surfaces never drift.
 *
 * City links point at the canonical /gemeinde/{slug} city hubs (CITY_HUBS is
 * the source of truth); bundesland links at the /{id} bundesland hubs.
 */
import { CITY_HUBS } from './city-hubs';
import { BUNDESLAENDER } from '@/lib/bundeslaender';

export interface HubLink {
  name: string;
  href: string;
}

/** The 5 major-city hubs → /gemeinde/{slug}. */
export const CITY_HUB_LINKS: HubLink[] = Object.values(CITY_HUBS).map((c) => ({
  name: c.name,
  href: `/gemeinde/${c.slug}`,
}));

/** The 9 Bundesland hubs → /{id}. */
export const BUNDESLAND_HUB_LINKS: HubLink[] = BUNDESLAENDER
  .filter((b) => b.id !== 'all')
  .map((b) => ({ name: b.name, href: `/${b.id}` }));
