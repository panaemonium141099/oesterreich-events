/**
 * Zähler je Kalender im DE-Nachtlauf: Wurde der Kalender gelesen, mit welchem
 * Ergebnis, wie viele Termine lieferte er, wie viele davon kommend.
 *
 * Grund: abnahme-fn29.md konnte die Gemeinden ohne Termin nicht aufteilen.
 * Von außen sieht ein leerer Kalender aus wie einer, der gar nicht gelesen
 * wurde. Alle Adapter gehen denselben Weg: `DeFeedScraper.inCalendar` setzt den
 * Kalender, die Abrufe von `DeFeedScraper` zählen hinein (AsyncLocalStorage,
 * damit auch parallel lesende Adapter richtig zuordnen). Keine Sonderlisten.
 *
 * Weitergabe: je Adapter eine Datei `reports/kalender/<adapter>.json` (Artefakt
 * des Shards), die Nachbearbeitung vereint sie mit dem Stand der letzten Nacht
 * (`mergeKalenderStand`, `src/scripts/coverage-report.ts`). Bei Adaptern mit
 * Cursor gilt ein Kalender, der heute nicht dran war, weiter mit seinem
 * letzten Ergebnis; sonst stünden nach jeder Nacht fast alle auf „nicht dran“.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { viennaDayBoundsUtc } from '@/lib/pipeline/dedup-evidence';
import { calendarKey, singleGemeinde, type FeedGroup } from '@/lib/registry-de/load';
import { viennaToday } from '@/lib/utils/event-time';
import { feedGemeinden } from './kontext';

export type KalenderErgebnis =
  /** Mindestens ein Abruf kam an (auch mit 0 Terminen). */
  | 'gelesen'
  /** robots.txt sperrt jeden versuchten Abruf. */
  | 'robots'
  /** Alle Abrufe scheiterten, `grund` nennt den ersten (HTTP-Status, Timeout, …). */
  | 'fehler'
  /** Zeitbudget verbraucht, bevor der Kalender Termine lieferte. */
  | 'budget'
  /** Adapter mit Cursor: in dieser Nacht nicht an der Reihe. */
  | 'nicht_dran'
  /** Adapter ohne Cursor endete, bevor er den Kalender erreichte. */
  | 'nicht_erreicht';

export interface KalenderZeile {
  adapter: string;
  url: string;
  /** Gemeinden (AGS), für die der Kalender spricht, wie in `terminContext`. */
  gemeinden: string[];
  ergebnis: KalenderErgebnis;
  grund?: string;
  abrufe: number;
  fehlgeschlagen: number;
  termine: number;
  kommend: number;
  /** Zeitpunkt des Berichts, in dem dieses Ergebnis entstand. */
  at: string;
}

class KalenderEintrag {
  abrufe = 0;
  fehlgeschlagen = 0;
  robots = false;
  budget = false;
  ersterFehler: string | null = null;
  termine = 0;
  kommend = 0;
  betreten = false;
  /** Derselbe Kalender wie ein anderer der Liste (Startseite und /veranstaltungen). */
  gleichWie: KalenderEintrag | null = null;

  constructor(readonly group: FeedGroup) {}

  fehler(meldung: string): void {
    this.fehlgeschlagen++;
    this.ersterFehler ??= fehlerGrund(meldung);
  }
}

const aktuell = new AsyncLocalStorage<KalenderEintrag>();

/** Kalender, in dessen `inCalendar` der laufende Abruf steht (sonst undefined: Tests, Einzelaufrufe). */
export function aktuellerKalender(): KalenderEintrag | undefined {
  return aktuell.getStore();
}

/** Fehlermeldung des Abrufs als kurzer, zählbarer Grund. */
export function fehlerGrund(meldung: string): string {
  const http = /HTTP (\d{3})/.exec(meldung);
  if (http) return `HTTP ${http[1]}`;
  if (/timeout/i.test(meldung)) return 'Timeout';
  if (/kein HTML/i.test(meldung)) return 'kein HTML';
  if (/zu groß/i.test(meldung)) return 'zu groß';
  return 'Netzfehler';
}

function gemeindenOf(g: FeedGroup): string[] {
  const single = singleGemeinde(g);
  if (single) return [single.ags];
  return [...new Set([...g.own, ...g.viaVerband, ...feedGemeinden([...g.own, ...g.viaVerband])].map(e => e.ags))].sort();
}

function ergebnisOf(e: KalenderEintrag, cursor: boolean, budgetVerbraucht: boolean): { ergebnis: KalenderErgebnis; grund?: string } {
  if (!e.betreten) {
    if (cursor) return { ergebnis: 'nicht_dran' };
    return budgetVerbraucht ? { ergebnis: 'budget' } : { ergebnis: 'nicht_erreicht' };
  }
  const q = e.gleichWie ?? e;
  // Budget mitten im Kalender ohne einen Termin: er ist nicht gelesen, sondern abgebrochen.
  if (e.budget && q.termine === 0) return { ergebnis: 'budget' };
  if (e.abrufe > 0 || e.gleichWie) return { ergebnis: 'gelesen' };
  if (e.ersterFehler) return { ergebnis: 'fehler', grund: e.ersterFehler };
  if (e.robots) return { ergebnis: 'robots' };
  if (e.budget) return { ergebnis: 'budget' };
  // Keine Antwort nötig, weil der Adapter die Seite schon hatte (je URL einmal).
  return { ergebnis: 'gelesen' };
}

/** Kalender eines Adapterlaufs. */
export class KalenderZaehler {
  private eintraege = new Map<FeedGroup, KalenderEintrag>();

  /** Kalender, die der Adapter in diesem Lauf lesen will. */
  plan(groups: readonly FeedGroup[]): void {
    for (const g of groups) if (!this.eintraege.has(g)) this.eintraege.set(g, new KalenderEintrag(g));
  }

  private eintrag(g: FeedGroup): KalenderEintrag {
    this.plan([g]);
    return this.eintraege.get(g)!;
  }

  run<T>(g: FeedGroup, fn: () => Promise<T>): Promise<T> {
    const e = this.eintrag(g);
    e.betreten = true;
    return aktuell.run(e, fn);
  }

  gleichWie(g: FeedGroup, quelle: FeedGroup): void {
    this.eintrag(g).gleichWie = this.eintrag(quelle);
  }

  bericht(adapter: string, opts: { cursor: boolean; budgetVerbraucht: boolean; at: Date }): KalenderZeile[] {
    return [...this.eintraege.values()].map(e => {
      const q = e.gleichWie ?? e;
      return {
        adapter,
        url: e.group.pageUrl,
        gemeinden: gemeindenOf(e.group),
        ...ergebnisOf(e, opts.cursor, opts.budgetVerbraucht),
        abrufe: e.abrufe,
        fehlgeschlagen: e.fehlgeschlagen,
        termine: q.termine,
        kommend: q.kommend,
        at: opts.at.toISOString(),
      };
    });
  }
}

/** Termine des laufenden Kalenders zählen, bevor Adapter sie filtern oder zwischen Kalendern zusammenlegen. */
export function zaehleTermine(termine: readonly { start?: string }[], now: Date = new Date()): void {
  const e = aktuell.getStore();
  if (!e) return;
  const from = Date.parse(viennaDayBoundsUtc(viennaToday(now))[0]);
  e.termine += termine.length;
  for (const t of termine) if (t.start && Date.parse(t.start) >= from) e.kommend++;
}

const STAND_FRIST_TAGE = 45;

/**
 * Stand der letzten Nacht und Ergebnis dieser Nacht vereinen.
 * - Ein Adapter mit Bericht bestimmt seine Kalender neu; „nicht dran“ behält
 *   das letzte echte Ergebnis (höchstens 45 Tage, verwaltungsportal braucht
 *   rund zehn Nächte für eine Runde).
 * - Ein Adapter ohne Bericht (Lauf ohne Shards, Shard verloren) behält seinen Stand.
 */
export function mergeKalenderStand(vorher: readonly KalenderZeile[], heute: readonly KalenderZeile[], now: Date): KalenderZeile[] {
  const key = (z: KalenderZeile) => `${z.adapter}|${calendarKey(z.url)}`;
  const prev = new Map(vorher.map(z => [key(z), z]));
  const adapterHeute = new Set(heute.map(z => z.adapter));
  const frist = now.getTime() - STAND_FRIST_TAGE * 86_400_000;
  const out = heute.map(z => {
    const p = z.ergebnis === 'nicht_dran' ? prev.get(key(z)) : undefined;
    return p && p.ergebnis !== 'nicht_dran' && Date.parse(p.at) >= frist ? { ...p, gemeinden: z.gemeinden } : z;
  });
  for (const z of vorher) if (!adapterHeute.has(z.adapter)) out.push(z);
  return out;
}

/** Bericht eines Shards schreiben, je Adapter eine Datei (auch nach Teilergebnis oder Timeout). */
export function schreibeKalenderBericht(scrapers: readonly { name: string; kalenderBericht(at?: Date): KalenderZeile[] }[], dir = join(process.cwd(), 'reports', 'kalender')): void {
  mkdirSync(dir, { recursive: true });
  for (const s of scrapers) writeFileSync(join(dir, `${s.name}.json`), JSON.stringify(s.kalenderBericht()));
}
