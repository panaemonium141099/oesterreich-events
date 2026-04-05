/**
 * Data Provenance Tracking
 *
 * Tracks which external data sources are used by the platform and their
 * license/attribution requirements. This ensures compliance with open data
 * licenses (e.g., ODbL for OpenStreetMap) and provides a single source of
 * truth for all data source metadata.
 *
 * Usage:
 *   import { DATA_SOURCES, getRequiredAttributions } from '@/lib/data-provenance';
 *
 *   // Get all sources requiring attribution
 *   const attributions = getRequiredAttributions();
 *
 *   // Check a specific source
 *   const osm = DATA_SOURCES.osm;
 */

import type { RegistrySource } from '@/types/venues';

export interface DataSourceAttribution {
  /** Machine-readable identifier matching RegistrySource or other source keys */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Short description of what data this source provides */
  description: string;
  /** SPDX license identifier or short license name */
  license: string;
  /** Full license URL */
  licenseUrl: string;
  /** URL to the source's copyright/attribution page */
  copyrightUrl: string;
  /** Required attribution text (for display in footer / about page) */
  attributionText: string;
  /** Whether this source requires visible attribution in the UI */
  requiresAttribution: boolean;
  /** Whether we use this as a "Produced Work" (display) vs "Derivative Database" */
  usageType: 'produced_work' | 'derivative_database';
}

/**
 * Registry of all external data sources and their attribution requirements.
 *
 * Key design decision: OSM data is used as a "Produced Work" (displaying venue
 * info derived from OSM), NOT as a "Derivative Database" (we don't redistribute
 * or combine OSM geodata into a new database for download). This means we need
 * attribution but do NOT need to share-alike our full database under ODbL.
 * See: https://wiki.openstreetmap.org/wiki/Legal_FAQ#3._Using
 */
export const DATA_SOURCES: Record<string, DataSourceAttribution> = {
  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    description: 'Venue locations, addresses, and metadata for bars, pubs, nightclubs, and other venues in Austria',
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    copyrightUrl: 'https://www.openstreetmap.org/copyright',
    attributionText: '\u00a9 OpenStreetMap contributors, ODbL',
    requiresAttribution: true,
    usageType: 'produced_work',
  },

  oeh: {
    id: 'oeh',
    name: '\u00d6sterreichische Hochsch\u00fcler_innenschaft (OeH)',
    description: 'Student union sections and their event pages across Austrian universities',
    license: 'Public information',
    licenseUrl: '',
    copyrightUrl: 'https://www.oeh.ac.at/',
    attributionText: 'OeH \u00d6sterreich',
    requiresAttribution: false,
    usageType: 'produced_work',
  },

  esn: {
    id: 'esn',
    name: 'Erasmus Student Network Austria',
    description: 'ESN sections and international student event listings',
    license: 'Public information',
    licenseUrl: '',
    copyrightUrl: 'https://esn.at/',
    attributionText: 'ESN Austria',
    requiresAttribution: false,
    usageType: 'produced_work',
  },

  iaeste: {
    id: 'iaeste',
    name: 'IAESTE Austria',
    description: 'IAESTE local committee event listings',
    license: 'Public information',
    licenseUrl: '',
    copyrightUrl: 'https://www.iaeste.at/',
    attributionText: 'IAESTE Austria',
    requiresAttribution: false,
    usageType: 'produced_work',
  },

  aiesec: {
    id: 'aiesec',
    name: 'AIESEC Austria',
    description: 'AIESEC local committee event listings',
    license: 'Public information',
    licenseUrl: '',
    copyrightUrl: 'https://aiesec.at/',
    attributionText: 'AIESEC Austria',
    requiresAttribution: false,
    usageType: 'produced_work',
  },

  aegee: {
    id: 'aegee',
    name: 'AEGEE Austria',
    description: 'AEGEE antenna event listings',
    license: 'Public information',
    licenseUrl: '',
    copyrightUrl: 'https://www.aegee.org/',
    attributionText: 'AEGEE Europe',
    requiresAttribution: false,
    usageType: 'produced_work',
  },

  open_data: {
    id: 'open_data',
    name: 'Open Government Data Austria',
    description: 'Austrian open data portals (data.gv.at) for event and venue information',
    license: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    copyrightUrl: 'https://www.data.gv.at/',
    attributionText: 'Open Data \u00d6sterreich, CC BY 4.0',
    requiresAttribution: true,
    usageType: 'produced_work',
  },

  manual: {
    id: 'manual',
    name: 'Manual Entry',
    description: 'Manually curated venue and event data',
    license: 'Proprietary',
    licenseUrl: '',
    copyrightUrl: '',
    attributionText: '',
    requiresAttribution: false,
    usageType: 'produced_work',
  },
} as const;

/**
 * Returns all data sources that require visible attribution in the UI.
 */
export function getRequiredAttributions(): DataSourceAttribution[] {
  return Object.values(DATA_SOURCES).filter((s) => s.requiresAttribution);
}

/**
 * Returns the attribution info for a specific registry source.
 * Returns undefined if the source is unknown.
 */
export function getSourceAttribution(
  source: RegistrySource | string,
): DataSourceAttribution | undefined {
  return DATA_SOURCES[source];
}

/**
 * Validates that all RegistrySource values have corresponding entries
 * in DATA_SOURCES. Useful for compile-time or test-time verification.
 */
export function validateProvenanceCoverage(
  registrySources: readonly string[],
): { covered: string[]; missing: string[] } {
  const covered: string[] = [];
  const missing: string[] = [];

  for (const source of registrySources) {
    if (DATA_SOURCES[source]) {
      covered.push(source);
    } else {
      missing.push(source);
    }
  }

  return { covered, missing };
}
