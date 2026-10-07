/**
 * „Auch gelistet bei" auf der Event-Detailseite.
 *
 * Der Batch-Dedup markiert Dubletten (`publish_status='duplicate'`,
 * `duplicate_of=<primary>`) und reichert den Primary mit deren Feldern an
 * (Beschreibung, Bild, Preistext, Ticket-Link …, computeEnrichments in
 * src/lib/pipeline/dedup-cluster.ts). Die Seite nannte bisher nur die
 * Quelle des Primarys — übernommene Inhalte standen damit unter fremder
 * Attribution. Diese Liste nennt die Quellen der Dubletten zusätzlich.
 *
 * Rein und getestet; der DB-Zugriff liegt in event-detail-loaders.ts.
 */

import { resolveSourceAttribution, type SourceAttribution } from '@/lib/source-attribution-overrides';

/** Spalten einer Dubletten-Zeile, die die Attribution braucht (inkl. der
 *  Ortsfelder für die regionalen Overrides, z. B. Ötztal Tourismus). */
export interface DuplicateSourceRow {
  source_name: string | null;
  source_url: string | null;
  postal_code?: string | null;
  location_name?: string | null;
  address?: string | null;
}

export interface ListedSource {
  label: string;
  url: string | null;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Sichtbarer Name einer Quelle: der Name, sonst der Host der URL. */
export function sourceLabelOf(attribution: SourceAttribution): string | null {
  return attribution.name?.trim() || (attribution.url ? hostnameOf(attribution.url) : null);
}

/** Nur echte Web-Links rendern; alles andere bleibt Text. */
function safeHttpUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

const keyOf = (label: string) => label.trim().toLocaleLowerCase('de');

/** Sichtbare Quelle einer Dubletten-Zeile, nach den regionalen Overrides. */
function listedSourceOf(row: DuplicateSourceRow): ListedSource | null {
  const attribution = resolveSourceAttribution(row);
  const label = sourceLabelOf(attribution);
  return label ? { label, url: safeHttpUrl(attribution.url) } : null;
}

/**
 * Eine Zeile je Quelle, bevorzugt die erste mit gültigem Link. Läuft schon
 * im Loader, damit das RSC-Payload klein bleibt: Serien-Cluster tragen bis
 * zu 155 Dubletten derselben Quelle (Prod 2026-10-07).
 */
export function uniqueSourceRows(rows: DuplicateSourceRow[]): DuplicateSourceRow[] {
  const byKey = new Map<string, { row: DuplicateSourceRow; hasUrl: boolean }>();
  for (const row of rows) {
    const listed = listedSourceOf(row);
    if (!listed) continue;
    const key = keyOf(listed.label);
    const existing = byKey.get(key);
    if (!existing || (!existing.hasUrl && listed.url)) {
      byKey.set(key, { row, hasUrl: Boolean(listed.url) });
    }
  }
  return [...byKey.values()].map(e => e.row);
}

/**
 * Quellen der Dubletten, je Quelle einmal, ohne die Quelle des Primarys,
 * alphabetisch (stabil für das ISR-HTML). Pro Quelle gewinnt die erste
 * Zeile mit gültigem Link.
 */
export function buildAlsoListedSources(
  primary: SourceAttribution,
  duplicates: DuplicateSourceRow[],
): ListedSource[] {
  const primaryLabel = sourceLabelOf(primary);
  const primaryKey = primaryLabel ? keyOf(primaryLabel) : null;
  return uniqueSourceRows(duplicates)
    .map(listedSourceOf)
    .filter((s): s is ListedSource => s !== null && keyOf(s.label) !== primaryKey)
    .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
}
