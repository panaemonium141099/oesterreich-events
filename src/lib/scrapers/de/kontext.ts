/**
 * Kalender-Kontext der DE-Adapter (fn-29.5/6): welche Gemeinde ein Feed
 * belegt, welche ein Termin im Amtskalender selbst nennt, und Dubletten
 * innerhalb eines Feeds. Qualitätsvertrag Punkt 2: Etiketten des Kalenders
 * (Gemeinde, Amt, VG) sind nicht der Veranstaltungsort; ein Amtskalender
 * ordnet Termine nur der Gemeinde zu, die der Termin selbst nennt.
 */
import type { GemeindeContext } from '../gemeinde-context';
import { gemeindeDeByAgs, gemeindenDeByVerband, type GemeindeDe } from '@/lib/gemeinden/de';
import { singleGemeinde, type FeedGroup } from '@/lib/registry-de/load';

/**
 * Gemeinden, für die ein Amtskalender spricht: die Gemeinden der Registry
 * und alle übrigen Gemeinden ihres Amts bzw. ihrer Verbandsgemeinde laut
 * Destatis (die Registry kennt nur die mit eigener Website).
 */
export function feedGemeinden(members: { ags: string }[]): GemeindeDe[] {
  const out = new Map<string, GemeindeDe>();
  for (const m of members) {
    const g = gemeindeDeByAgs(m.ags);
    if (!g) continue;
    out.set(g.ags, g);
    if (g.verbandKey) for (const v of gemeindenDeByVerband(g.verbandKey)) out.set(v.ags, v);
  }
  return [...out.values()];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Gemeinde, die der Termin nennt (genau eine): im Ortsnamen als ganzes Wort
 * („Feuerwehrhaus Klinkrade-1"), im Titel nur nach einer Präposition
 * („Weihnachtsmarkt in Schwarzbach"), weil Gemeindenamen auch Familiennamen
 * sind („Konzert mit Hans Roth"). „Ahlden (Aller)" heißt im Termin „Ahlden";
 * „Amt Duvensee-Nord" nennt nicht Duvensee.
 */
export function namedMember(ev: { title: string; locationName?: string }, candidates: GemeindeDe[]): GemeindeDe | null {
  const hits = new Map<string, GemeindeDe>();
  for (const g of candidates) {
    const names = new Set([g.name, g.name.replace(/\s*\([^)]*\)\s*$/, '')]);
    for (const n of names) {
      const word = String.raw`${escapeRe(n)}(?!\p{L}|-\p{L})`;
      if (
        new RegExp(String.raw`(?<![\p{L}-])${word}`, 'u').test(ev.locationName ?? '') ||
        new RegExp(String.raw`(?:^|\s)(?:in|im|zu|bei|aus|nach)\s+${word}`, 'iu').test(ev.title)
      ) hits.set(g.ags, g);
    }
  }
  return hits.size === 1 ? [...hits.values()][0] : null;
}

export interface FeedTermin {
  uid: string;
  title: string;
  start: string;
  end?: string;
  locationName?: string;
  street?: string;
  locality?: string;
}

/**
 * Derselbe Termin zweimal in einem Feed (verschiedene UIDs, gleicher Titel,
 * Beginn, Ende und Ort; Bad Honnef „Bilderbuchkino", 2026-10-28): einer
 * bleibt, deterministisch die kleinste UID.
 */
export function sameTerminKey(e: FeedTermin): string {
  return JSON.stringify([e.title.toLowerCase(), e.start, e.end ?? null, e.locationName ?? null, e.street ?? null, e.locality ?? null]);
}

export function collapseSourceDuplicates<T extends FeedTermin>(events: T[]): T[] {
  const key = sameTerminKey;
  const best = new Map<string, T>();
  for (const e of events) {
    const k = key(e);
    const cur = best.get(k);
    if (!cur || e.uid < cur.uid) best.set(k, e);
  }
  return events.filter(e => best.get(key(e)) === e);
}

/**
 * Kontext eines Termins: die Gemeinde eines Feeds, den genau eine Gemeinde
 * führt (`ownGemeinde` darf das für einen Termin verneinen, z. B. wenn er
 * aus einer anderen Kommune übernommen ist); sonst die Gemeinde, die der
 * Termin selbst nennt, wenn er keinen eigenen Ort trägt; sonst nur das
 * Land, wenn alle Gemeinden des Feeds in einem liegen. Die PLZ einer
 * Mitgliedsgemeinde dient im Gebietskontext nur der Prüfung, ob eine
 * Adresse in derselben Leitregion liegt (Veranstalterbüro anderswo).
 */
export function terminContext(
  g: FeedGroup,
  ev: { title: string; locationName?: string; hasOwnPlace: boolean },
  ownGemeinde = true,
): GemeindeContext {
  const members = [...g.own, ...g.viaVerband];
  const single = ownGemeinde ? singleGemeinde(g) : null;
  const named = !single && !ev.hasOwnPlace ? namedMember(ev, feedGemeinden(members)) : null;
  const gem = single ? gemeindeDeByAgs(single.ags) : named;
  if (gem) return { name: gem.name, plz: gem.plz, lat: gem.lat, lng: gem.lng, bundesland: gem.land, bezirk: null };
  const lands = new Set(members.map(e => e.land));
  const anyMember = members.length ? gemeindeDeByAgs(members[0].ags) : null;
  return { name: '', plz: anyMember?.plz ?? '', lat: 0, lng: 0, bundesland: lands.size === 1 ? [...lands][0] : '', bezirk: null, region: true };
}
