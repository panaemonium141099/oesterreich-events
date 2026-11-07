/**
 * Nachtlauf der DE-Gemeinde-Adapter (fn-29.18).
 *
 * Ein Adapter kommt in den Nachtlauf, wenn sein Prüfstand bestanden ist und
 * der Bericht (`docs/research/de-gemeinden/adapter-*.md`) auf master liegt:
 * eine Zeile in `DE_NACHTLAUF`. Nicht dabei: nolis (Lizenzquelle, fn-29.19)
 * und `de-amt-vg` (nur Prüfstand, die Adapter lesen ihre Amtskalender mit).
 *
 * Shards: Adapter, die eine Website gemeinsam lesen, laufen im selben Shard,
 * dort hält die Sperre je Website (`host-gate.ts`) sie auseinander. Über
 * Shards hinweg trifft so nie zweimal gleichzeitig dieselbe Website.
 * Innerhalb dieser Bedingung LPT nach Laufzeit-Gewicht wie
 * `getScrapersForShard` für Österreich.
 */
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import { loadRegistryDe } from '@/lib/registry-de/load';
import type { DeFeedScraper } from './feed-scraper';
import { DE_SCRAPERS } from './index';

/** Adapter im Nachtlauf → Prüfstand-Bericht. Neue Adapter: eine Zeile. */
export const DE_NACHTLAUF: Readonly<Record<string, string>> = {
  'de-ionas': 'adapter-ionas.md',
  'de-tribe': 'adapter-tribe.md',
  'de-eventsmanager': 'adapter-eventsmanager.md',
  'de-mec': 'adapter-mec-dpcalendar-joomla.md',
  'de-dpcalendar': 'adapter-mec-dpcalendar-joomla.md',
  'de-jevents': 'adapter-mec-dpcalendar-joomla.md',
  'de-icagenda': 'adapter-mec-dpcalendar-joomla.md',
  'de-hwveranstaltung': 'adapter-hwveranstaltung.md',
  'de-typo3': 'adapter-typo3.md',
  'de-allgemein': 'adapter-allgemein.md',
  'de-ikiss': 'adapter-ikiss.md',
  'de-kommone': 'adapter-kommone.md',
  'de-communice': 'adapter-communice.md',
  'de-ceasy': 'adapter-ceasy.md',
  'de-weblication': 'adapter-weblication.md',
  'de-digipublica': 'adapter-digipublica.md',
  'de-open2c': 'adapter-open2c.md',
  'de-activecity': 'adapter-activecity.md',
  'de-verwaltungsportal': 'adapter-verwaltungsportal.md',
  'de-deskline': 'adapter-deskline.md',
  'de-destinationone': 'adapter-destinationone.md',
  'de-lkrg': 'adapter-lkrg.md',
  'de-regiogate': 'adapter-regiogate.md',
};

export const DE_SHARD_COUNT = 3;

/**
 * Zeitbudget je Adapter in Minuten (BaseScraper.softDeadline, im Workflow
 * als SCRAPER_SOFT_BUDGET_MIN gesetzt) und harte Obergrenze darüber für den
 * Abgleich mit der Datenbank. Die DE-Shards enden damit vor den langen
 * AT-Shards (Gemeinde-Aggregatoren, rund 4 h), das Post-Processing wartet
 * nicht auf sie.
 */
export const DE_SOFT_BUDGET_MIN = 180;
export const DE_TIMEOUT_MIN = 210;

/**
 * Laufzeit-Gewichte in Minuten. Erste Werte aus den Prüfstand-Läufen
 * (iKISS 8.465 Abrufe gut zwei Stunden, allgemein 22 min mit vier Websites
 * gleichzeitig, Komm.ONE knapp 30 min bei Crawl-delay 30, communice 1.245
 * Abrufe, verwaltungsportal nutzt das ganze Budget: bei 180 min rund
 * 120 von 752 Websites je Nacht), sonst aus der Zahl der Kalender geschätzt. Nach den ersten
 * Läufen aus source_runs nachziehen (Abfrage bei SCRAPER_WEIGHTS).
 */
const DE_SCRAPER_WEIGHTS: Readonly<Record<string, number>> = {
  'de-verwaltungsportal': 180,
  'de-ikiss': 130,
  'de-communice': 40,
  'de-kommone': 30,
  'de-allgemein': 25,
  'de-ionas': 25,
  'de-tribe': 25,
  'de-hwveranstaltung': 25,
  'de-typo3': 20,
  'de-mec': 15,
  'de-ceasy': 10,
  'de-weblication': 10,
  'de-jevents': 10,
  'de-icagenda': 10,
  'de-dpcalendar': 5,
  'de-eventsmanager': 5,
  'de-digipublica': 5,
  'de-open2c': 5,
  'de-activecity': 5,
  // Prüfstand 07.11.2026: Deskline 220 Abrufe in 4 min, destination.one 278 Abrufe (große JSON-Seiten) in 10 min.
  'de-deskline': 5,
  'de-destinationone': 10,
  'de-lkrg': 5,
  'de-regiogate': 10,
};
const DEFAULT_WEIGHT = 10;

export function isDeNachtlaufAdapter(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(DE_NACHTLAUF, name);
}

/** Adapter des Nachtlaufs in der Reihenfolge von `DE_NACHTLAUF`. */
export function deNachtlaufScrapers(all: readonly DeFeedScraper[] = DE_SCRAPERS as DeFeedScraper[]): DeFeedScraper[] {
  return Object.keys(DE_NACHTLAUF).map(name => {
    const s = all.find(x => x.name === name);
    if (!s) throw new Error(`DE-Nachtlauf: Adapter ${name} fehlt in DE_SCRAPERS`);
    return s;
  });
}

function bareHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).host.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Websites, die ein Adapter laut Registry liest (eigene Kalender und Ausweichwege über Amt/VG). */
export function adapterHosts(integrations: readonly string[], entries: readonly RegistryEntryDe[] = loadRegistryDe()): Set<string> {
  const out = new Set<string>();
  const add = (...raws: (string | null | undefined)[]) => {
    for (const r of raws) {
      const h = bareHost(r);
      if (h) out.add(h);
    }
  };
  for (const e of entries) {
    if (integrations.includes(e.integration)) add(e.url, e.feed_url, e.host);
    const f = e.fallback;
    if (f?.kind === 'verband' && integrations.includes(f.integration)) add(f.url, f.feed_url, f.host);
  }
  return out;
}

/**
 * Shard-Zuteilung: Adapter mit gemeinsamer Website bilden eine Gruppe (eine
 * gemeinsame Website verbindet), Gruppen nach Gewicht absteigend in den
 * jeweils leichtesten Shard. Deterministisch, jeder Adapter in genau einem
 * Shard, alle Jobs eines Laufs rechnen dieselbe Zuteilung.
 */
export function deShardPlan(
  adapters: readonly { name: string; integrations: readonly string[] }[],
  shardCount: number,
  entries: readonly RegistryEntryDe[] = loadRegistryDe(),
  weightOf: (name: string) => number = n => DE_SCRAPER_WEIGHTS[n] ?? DEFAULT_WEIGHT,
): string[][] {
  if (shardCount < 1) throw new Error(`Ungültige Shard-Zahl: ${shardCount}`);
  const parent = adapters.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const ownerOf = new Map<string, number>();
  adapters.forEach((a, i) => {
    for (const h of adapterHosts(a.integrations, entries)) {
      const o = ownerOf.get(h);
      if (o === undefined) ownerOf.set(h, i);
      else parent[find(i)] = find(o);
    }
  });
  const groups = new Map<number, string[]>();
  adapters.forEach((a, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), a.name]));
  const weighted = [...groups.values()]
    .map(names => ({ names: [...names].sort(), weight: names.reduce((s, n) => s + weightOf(n), 0) }))
    .sort((a, b) => b.weight - a.weight || a.names[0].localeCompare(b.names[0]));
  const loads = new Array<number>(shardCount).fill(0);
  const shards: string[][] = Array.from({ length: shardCount }, () => []);
  for (const g of weighted) {
    let lightest = 0;
    for (let i = 1; i < shardCount; i++) if (loads[i] < loads[lightest]) lightest = i;
    shards[lightest].push(...g.names);
    loads[lightest] += g.weight;
  }
  return shards;
}

export function getDeScrapersForShard(shardIndex: number, shardCount: number): DeFeedScraper[] {
  if (shardIndex < 0 || shardIndex >= shardCount) throw new Error(`Ungültiger Shard: ${shardIndex}/${shardCount}`);
  const scrapers = deNachtlaufScrapers();
  const names = deShardPlan(scrapers, shardCount)[shardIndex];
  return scrapers.filter(s => names.includes(s.name));
}
