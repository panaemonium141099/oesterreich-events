/**
 * DE-Adapter ionas (fn-29.5): liest die iCal-Exporte aller ionas-Kalender
 * der DE-Gemeinde-Registry. Ein Feed, den genau eine Gemeinde als eigenen
 * Kalender führt, bekommt deren Kontext (Ort, PLZ, Mittelpunkt als
 * Gebietsangabe); ein Amtskalender nur den Kontext des Landes, der Ort kommt
 * dann allein aus dem Termin (Etiketten-Regel des Qualitätsvertrags).
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { BaseScraper } from '../BaseScraper';
import { applyGemeindeContext, type GemeindeContext } from '../gemeinde-context';
import { gemeindeDeByAgs, gemeindenDeByVerband, type GemeindeDe } from '@/lib/gemeinden/de';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { feedGroups, singleGemeinde, type FeedGroup } from '@/lib/registry-de/load';
import { robotsAllows } from '@/lib/registry-de/robots';
import type { ScrapedEvent } from '@/types/events';
import { ionasIcsUrl, parseIonasIcs, type IonasEvent } from './ionas';

const UA_TOKEN = 'lasstreffen';

/**
 * Derselbe Termin zweimal in einem Feed (verschiedene UIDs, gleicher Titel,
 * Beginn, Ende und Ort; Bad Honnef „Bilderbuchkino", 2026-10-28): einer
 * bleibt, deterministisch die kleinste UID.
 */
export function collapseSourceDuplicates(events: IonasEvent[]): IonasEvent[] {
  const key = (e: IonasEvent) => JSON.stringify([e.title.toLowerCase(), e.start, e.end ?? null, e.locationName ?? null, e.street ?? null, e.locality ?? null]);
  const best = new Map<string, IonasEvent>();
  for (const e of events) {
    const k = key(e);
    const cur = best.get(k);
    if (!cur || e.uid < cur.uid) best.set(k, e);
  }
  return events.filter(e => best.get(key(e)) === e);
}

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
export function namedMember(ev: Pick<IonasEvent, 'title' | 'locationName'>, candidates: GemeindeDe[]): GemeindeDe | null {
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

export class IonasDeScraper extends BaseScraper {
  readonly name = 'de-ionas';
  protected userAgent = 'Mozilla/5.0 (compatible; lasstreffen/1.0; +https://lasstreffen.at)';
  protected delayMs = 1000;
  private robots = new Map<string, string | null>();

  /** Nur für den Prüfstand und Tests: Feeds einschränken. */
  constructor(private readonly limit?: number) {
    super();
  }

  private async robotsTxt(origin: string): Promise<string | null> {
    if (this.robots.has(origin)) return this.robots.get(origin)!;
    let txt: string | null = null;
    try {
      const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': this.userAgent } });
      txt = res.ok ? await res.text() : null;
    } catch {
      txt = null;
    }
    this.robots.set(origin, txt);
    return txt;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = feedGroups('ionas').slice(0, this.limit ?? Infinity);
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
    const all: ScrapedEvent[] = [];
    for (const g of groups) {
      const url = ionasIcsUrl(g.feedUrl, from, to);
      if (!robotsAllows(await this.robotsTxt(new URL(url).origin), url, UA_TOKEN)) {
        this.log(`robots.txt sperrt ${url}`);
        continue;
      }
      await this.rateLimit();
      let ics: string;
      try {
        ics = await this.fetchPage(url);
      } catch (e) {
        this.log(`nicht lesbar: ${url}: ${e instanceof Error ? e.message : e}`);
        continue;
      }
      const events = collapseSourceDuplicates(parseIonasIcs(ics));
      all.push(...events.map(ev => this.toScraped(ev, g)));
    }
    this.log(`${groups.length} Feeds, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: IonasEvent, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `ionas-${ev.uid}-${ev.localDate}`,
      source_url: g.pageUrl,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      address,
      postal_code: ev.postalCode,
      city: ev.locality,
      organizer: ev.organizer,
      category: ev.category,
      country: 'DE',
      ...(ev.lat != null && ev.lng != null ? { latitude: ev.lat, longitude: ev.lng, coords_precision: 'venue' as const } : {}),
    };
    const od = ortsdatenFor('DE')!;
    const members = [...g.own, ...g.viaVerband];
    const single = singleGemeinde(g);
    // Amtskalender ohne Ort im Termin: eine Mitgliedsgemeinde nur, wenn der
    // Termin selbst genau eine nennt („Kirche in Ahlden").
    const named = !single && !ev.locality && !ev.postalCode ? namedMember(ev, feedGemeinden(members)) : null;
    const gem = single ? gemeindeDeByAgs(single.ags) : named;
    const lands = new Set(members.map(e => e.land));
    // Amtskalender: Ort nur aus dem Termin; Land nur, wenn alle Gemeinden in
    // einem liegen. Die PLZ einer Mitgliedsgemeinde dient nur der Prüfung, ob
    // eine Adresse in derselben Leitregion liegt (Veranstalterbüro anderswo).
    const anyMember = members.length ? gemeindeDeByAgs(members[0].ags) : null;
    const ctx: GemeindeContext = gem
      ? { name: gem.name, plz: gem.plz, lat: gem.lat, lng: gem.lng, bundesland: gem.land, bezirk: null }
      : { name: '', plz: anyMember?.plz ?? '', lat: 0, lng: 0, bundesland: lands.size === 1 ? [...lands][0] : '', bezirk: null, region: true };
    const out = applyGemeindeContext(base, ctx, od);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
