/**
 * DE-Gemeinde-Registry lesen und je Feed gruppieren (fn-29.4/5).
 * SERVER-ONLY (liest per readFileSync).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RegistryEntryDe } from './build';

let cache: RegistryEntryDe[] | null = null;

export function loadRegistryDe(): RegistryEntryDe[] {
  if (cache) return cache;
  cache = JSON.parse(readFileSync(join(process.cwd(), 'data', 'de-gemeinde-registry.json'), 'utf8')) as RegistryEntryDe[];
  return cache;
}

export interface FeedGroup {
  feedUrl: string;
  /** Kalenderseite, die als Quelle angezeigt wird. */
  pageUrl: string;
  /** Gemeinden mit diesem Feed auf der eigenen Website. */
  own: RegistryEntryDe[];
  /** Gemeinden, die den Feed als Kalender ihres Amts bzw. ihrer VG nutzen. */
  viaVerband: RegistryEntryDe[];
}

/**
 * Alle Feeds einer Integration: eigene (Stufe A) und Ausweichwege über
 * Amt/VG. Ein Feed, den mehrere Gemeinden teilen, ist ein Amtskalender.
 */
export function feedGroups(integration: string, entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const group = (feedUrl: string, pageUrl: string | null) => {
    let g = groups.get(feedUrl);
    if (!g) { g = { feedUrl, pageUrl: pageUrl ?? feedUrl, own: [], viaVerband: [] }; groups.set(feedUrl, g); }
    return g;
  };
  for (const e of entries) {
    if (e.integration === integration && e.feed_url) group(e.feed_url, e.url).own.push(e);
    if (e.fallback?.kind === 'verband' && e.fallback.integration === integration && e.fallback.feed_url) {
      group(e.fallback.feed_url, e.fallback.url).viaVerband.push(e);
    }
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

/** Genau eine Gemeinde liest diesen Feed als eigenen Kalender. */
export function singleGemeinde(g: FeedGroup): RegistryEntryDe | null {
  return g.own.length === 1 && g.viaVerband.length === 0 ? g.own[0] : null;
}
