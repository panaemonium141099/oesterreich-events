/**
 * Kalender-Kontext der DE-Adapter (fn-29.5/6): welche Gemeinde ein Feed
 * belegt, welche ein Termin im Amtskalender selbst nennt, und Dubletten
 * innerhalb eines Feeds. Qualitätsvertrag Punkt 2: Etiketten des Kalenders
 * (Gemeinde, Amt, VG) sind nicht der Veranstaltungsort; ein Amtskalender
 * ordnet Termine nur der Gemeinde zu, die der Termin selbst nennt.
 */
import type { GemeindeContext } from '../gemeinde-context';
import { gemeindeDeByAgs, gemeindenDeByVerband, loadGemeindenDe, type GemeindeDe } from '@/lib/gemeinden/de';
import { normalizeGemeindeName } from '@/lib/location/gemeinde-name';
import { plzReferenceDe } from '@/lib/location/plz-reference-de';
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
  const hits = namedGemeinden(ev, candidates, 'any');
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Alle Gemeinden, die der Termin nennt. `full`: nur mit Zusatz
 * („Allendorf (Lumda)" auch als „Allendorf / Lumda" oder „Allendorf an der
 * Lumda"); `any`: auch der Name ohne Zusatz.
 */
function namedGemeinden(ev: { title: string; locationName?: string }, candidates: GemeindeDe[], mode: 'full' | 'any'): GemeindeDe[] {
  const hits = new Map<string, GemeindeDe>();
  for (const g of candidates) {
    const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(g.name);
    const names = m
      ? [String.raw`${escapeRe(m[1])}\s*(?:\(\s*${escapeRe(m[2])}\s*\)|/\s*${escapeRe(m[2])}|(?:an der|am|a\.\s?d\.)\s+${escapeRe(m[2])})`, ...(mode === 'any' ? [escapeRe(m[1])] : [])]
      : mode === 'any' ? [escapeRe(g.name)] : [];
    for (const n of names) {
      const word = String.raw`${n}(?!\p{L}|-\p{L})`;
      if (
        new RegExp(String.raw`(?<![\p{L}-])${word}`, 'u').test(ev.locationName ?? '') ||
        new RegExp(String.raw`(?:^|\s)(?:in|im|zu|bei|aus|nach)\s+${word}`, 'iu').test(ev.title)
      ) hits.set(g.ags, g);
    }
  }
  return [...hits.values()];
}

const NEAR_KM = 30;

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const nearCache = new Map<string, GemeindeDe[]>();
function nearbyGemeinden(gem: GemeindeDe): GemeindeDe[] {
  let n = nearCache.get(gem.ags);
  if (!n) {
    n = loadGemeindenDe().filter(x => x.ags !== gem.ags && km(gem, x) <= NEAR_KM);
    nearCache.set(gem.ags, n);
  }
  return n;
}

let byName: Map<string, GemeindeDe[]> | null = null;
function gemeindenNamed(name: string): GemeindeDe[] {
  if (!byName) {
    byName = new Map();
    for (const x of loadGemeindenDe()) {
      const k = normalizeGemeindeName(x.name);
      byName.set(k, [...(byName.get(k) ?? []), x]);
    }
  }
  return byName.get(normalizeGemeindeName(name)) ?? [];
}

/**
 * Orte, die die PLZ-Referenz dieser Gemeinde zuordnet (eigene Ortsteile),
 * und die Teile eines zusammengesetzten Namens („Neuenkirchen-Vörden":
 * Neuenkirchen ist dort Ortsteil, nicht die Nachbargemeinde gleichen Namens).
 */
function ownOrte(gem: GemeindeDe): Set<string> {
  const out = new Set([normalizeGemeindeName(gem.name)]);
  for (const part of gem.name.split(/\s*[-/]\s*/)) if (part.length >= 3) out.add(normalizeGemeindeName(part));
  for (const p of gem.plzAll) {
    for (const [ort, ags] of Object.entries(plzReferenceDe(p)?.orteGemeinde ?? {})) {
      if (ags === gem.ags) out.add(normalizeGemeindeName(ort));
    }
  }
  return out;
}

/**
 * Nennt ein Termin ohne Adresse im Kalender einer Gemeinde eine ANDERE
 * Gemeinde, ist der Kalender nicht sein Ort (fn-29.7: „Nikelsmarkt
 * Allendorf / Lumda" im Marburger Kalender, „Kirchenkonzert in Nördlingen"
 * in Reimlingen, „Berlinreise" mit Ort „Berlin" in Bornheim).
 *
 * - Ortsname gleich der eigenen Gemeinde oder einem eigenen Ortsteil
 *   (PLZ-Referenz): `undefined`, der Kalender gilt.
 * - Ortsname oder Titel („in X") nennt genau eine Gemeinde im Umkreis von
 *   30 km: diese.
 * - Ortsname ist genau der Name einer ferneren Gemeinde: `null`, kein Ort
 *   (der Freigabevertrag hält den Termin zurück).
 */
export function otherGemeindeNamed(gem: GemeindeDe, ev: { title: string; locationName?: string }): GemeindeDe | null | undefined {
  const own = ownOrte(gem);
  const loc = ev.locationName?.trim();
  if (loc && own.has(normalizeGemeindeName(loc))) return undefined;
  const near = nearbyGemeinden(gem).filter(x => !own.has(normalizeGemeindeName(x.name)));
  // Der eigene Name im Termin („Sporthalle Groß Rheide") geht vor.
  if (namedMember(ev, [gem])) return undefined;
  // Mit Zusatz zuerst („Allendorf / Lumda" bei Marburg: Allendorf (Lumda),
  // nicht Allendorf (Eder)); bleibt es mehrdeutig, ist es nicht der Kalenderort.
  const full = namedGemeinden(ev, near, 'full');
  if (full.length === 1) return full[0];
  const any = namedGemeinden(ev, near, 'any');
  if (any.length === 1) return any[0];
  if (any.length > 1) return null;
  if (loc && gemeindenNamed(loc).some(x => x.ags !== gem.ags) && !own.has(normalizeGemeindeName(loc))) return null;
  return undefined;
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
  let gem = single ? gemeindeDeByAgs(single.ags) : named;
  if (single && gem && !ev.hasOwnPlace) {
    const other = otherGemeindeNamed(gem, ev);
    gem = other === undefined ? gem : other;
  }
  if (gem) return { name: gem.name, plz: gem.plz, lat: gem.lat, lng: gem.lng, bundesland: gem.land, bezirk: null };
  const lands = new Set(members.map(e => e.land));
  const anyMember = members.length ? gemeindeDeByAgs(members[0].ags) : null;
  return { name: '', plz: anyMember?.plz ?? '', lat: 0, lng: 0, bundesland: lands.size === 1 ? [...lands][0] : '', bezirk: null, region: true };
}
