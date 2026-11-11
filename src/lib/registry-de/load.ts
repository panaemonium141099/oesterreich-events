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

/**
 * Dieselbe Kalenderadresse in zwei Schreibweisen (http/https, mit und ohne
 * www, `&amp;`, Schrägstrich am Ende): Amt Nordsee-Treene steht für Mildstedt
 * mit http, für elf Gemeinden mit https in der Registry (fn-29.17).
 */
export function calendarKey(url: string): string {
  return url.trim().replace(/&amp;/g, '&').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+(?=$|[?#])/, '').toLowerCase();
}

export interface PickOptions {
  /** Nur Kalender, die Gemeinden als Ausweichweg ihres Amts bzw. ihrer VG lesen (Prüfstand fn-29.17). */
  onlyVerband?: boolean;
  limit?: number;
  /** Schlüssel, unter dem zwei Feed-Adressen derselbe Kalender sind (Standard `calendarKey`). */
  key?: (feedUrl: string) => string;
}

/**
 * Kalender eines Adapters in Lesereihenfolge (fn-29.17):
 * - Gleicher Kalender unter zwei Adressen wird einer; liest ihn nur eine
 *   Gemeinde als eigenen Kalender und andere über ihr Amt, ist es ein
 *   Amtskalender (Lambsheim-Heßheim: Kleinniedesheim führt den Kalender der
 *   VG, sonst bekämen alle Termine der VG Kleinniedesheim als Ort).
 * - Kalender genau einer Gemeinde vor den Amtskalendern: liefert ein
 *   Amtskalender einen Termin, den die Gemeinde selbst führt (gleiche
 *   `source_id`), gilt die erste Zeile (Sync und Prüfstand behalten die erste),
 *   also die der Gemeinde (Ahlden: Grethem führt einen Ausschnitt des
 *   Samtgemeinde-Kalenders).
 */
export function pickFeedGroups(groups: FeedGroup[], opts: PickOptions = {}): FeedGroup[] {
  const key = (u: string) => calendarKey(opts.key ? opts.key(u) : u);
  const merged = new Map<string, FeedGroup>();
  for (const g of groups) {
    const k = key(g.feedUrl);
    const cur = merged.get(k);
    if (!cur) { merged.set(k, { ...g, own: [...g.own], viaVerband: [...g.viaVerband] }); continue; }
    if (!/^https:/i.test(cur.feedUrl) && /^https:/i.test(g.feedUrl)) { cur.feedUrl = g.feedUrl; cur.pageUrl = g.pageUrl; }
    for (const e of g.own) if (!cur.own.some(x => x.ags === e.ags)) cur.own.push(e);
    for (const e of g.viaVerband) if (!cur.viaVerband.some(x => x.ags === e.ags)) cur.viaVerband.push(e);
  }
  let out = [...merged.values()].map(g => ({ ...g, viaVerband: g.viaVerband.filter(e => !g.own.some(x => x.ags === e.ags)) }));
  if (opts.onlyVerband) out = out.filter(g => g.viaVerband.length > 0);
  out.sort((a, b) => Number(!singleGemeinde(a)) - Number(!singleGemeinde(b)));
  return out.slice(0, opts.limit ?? Infinity);
}
