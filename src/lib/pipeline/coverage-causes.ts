/**
 * Warum hat eine Gemeinde keinen kommenden Termin? Aufteilung der Gemeinden
 * ohne Termin nach Ursache, aus dem Kalenderstand des Nachtlaufs
 * (`src/lib/scrapers/de/kalender-stand.ts`) und den zurückgehaltenen Zeilen.
 *
 * Eine Gemeinde kann an mehreren Kalendern hängen (eigener Kalender, Amt/VG);
 * es zählt die Ursache, die einem Termin am nächsten ist, in der Reihenfolge
 * von `URSACHEN`. „leer“ heißt: Abruf kam an, der Adapter erkannte keinen
 * Termin. Das schließt Kalender ein, die erst per Skript laden.
 *
 * Rein und ohne I/O. Ausführung: `src/scripts/coverage-report.ts`.
 */
import type { KalenderZeile } from '@/lib/scrapers/de/kalender-stand';

export const URSACHEN = [
  'zurueckgehalten',
  'kommend_anderswo',
  'nur_vergangene',
  'leer',
  'noch_nicht_dran',
  'nicht_gelesen',
  'nicht_im_nachtlauf',
] as const;
export type Ursache = (typeof URSACHEN)[number];

export const URSACHE_TEXT: Record<Ursache, string> = {
  zurueckgehalten: 'Termine nur zurückgehalten',
  kommend_anderswo: 'gelesen, kommende Termine, keiner bei dieser Gemeinde',
  nur_vergangene: 'gelesen mit Terminen, aber keiner kommend',
  leer: 'gelesen und leer',
  noch_nicht_dran: 'in dieser Rotation noch nicht dran',
  nicht_gelesen: 'nicht gelesen',
  nicht_im_nachtlauf: 'kein Kalender im Nachtlauf',
};

export interface UrsacheInput {
  gemeinden: readonly { id: string; region: string; integration: string }[];
  /** Gemeinden mit sichtbarem kommendem Termin. */
  sichtbar: ReadonlySet<string>;
  /** Gemeinden mit kommendem Termin in `needs_review` oder `draft`. */
  zurueckgehalten: ReadonlySet<string>;
  /**
   * Zurückgehaltene Zeilen ohne Gemeinde (Ort ungeklärt) als `adapter|website`:
   * Zählt für einen Kalender genau einer Gemeinde. Beim Amtskalender bleibt
   * offen, welche Gemeinde der Termin meint.
   */
  zurueckgehaltenWebsites?: ReadonlySet<string>;
  stand: readonly KalenderZeile[];
  /** Gemeinde → Adapter laut Registry (eigener Kalender oder Amt/VG). */
  adapterVon: ReadonlyMap<string, readonly string[]>;
}

export interface GemeindeUrsache {
  id: string;
  region: string;
  ursache: Ursache;
  /** Bei „nicht gelesen“ der Grund, bei „kein Kalender im Nachtlauf“ die Integration. */
  grund?: string;
  adapter?: string;
  url?: string;
}

export interface UrsachenBericht {
  ohneTermin: number;
  gesamt: Partial<Record<Ursache, number>>;
  /** Gründe von „nicht gelesen“. */
  nichtGelesen: Record<string, number>;
  jeAdapter: Record<string, Partial<Record<Ursache, number>>>;
  jeLand: Record<string, Partial<Record<Ursache, number>>>;
  /** Heute und in früheren Nächten gelesene Kalender, je Ergebnis. */
  kalender: Record<string, number>;
  gemeinden: GemeindeUrsache[];
}

const GRUND_TEXT: Record<string, string> = {
  robots: 'robots.txt',
  budget: 'Zeitbudget',
  nicht_erreicht: 'Lauf endete vorher',
};

const websiteOf = (url: string) => {
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Schlüssel für `zurueckgehaltenWebsites`. */
export const websiteKey = (adapter: string, url: string) => `${adapter}|${websiteOf(url)}`;

function ursacheVonZeile(z: KalenderZeile, gehaltenAuf: ReadonlySet<string> | undefined): { ursache: Ursache; grund?: string } {
  switch (z.ergebnis) {
    case 'gelesen':
      if (z.kommend > 0) return { ursache: z.gemeinden.length === 1 && gehaltenAuf?.has(websiteKey(z.adapter, z.url)) ? 'zurueckgehalten' : 'kommend_anderswo' };
      return { ursache: z.termine > 0 ? 'nur_vergangene' : 'leer' };
    case 'nicht_dran':
      return { ursache: 'noch_nicht_dran' };
    case 'fehler':
      return { ursache: 'nicht_gelesen', grund: z.grund ?? 'Fehler' };
    default:
      return { ursache: 'nicht_gelesen', grund: GRUND_TEXT[z.ergebnis] ?? z.ergebnis };
  }
}

export function buildUrsachen(input: UrsacheInput): UrsachenBericht {
  const zeilenJe = new Map<string, KalenderZeile[]>();
  const adapterMitBericht = new Set<string>();
  const kalender: Record<string, number> = {};
  for (const z of input.stand) {
    adapterMitBericht.add(z.adapter);
    kalender[z.ergebnis] = (kalender[z.ergebnis] ?? 0) + 1;
    for (const ags of z.gemeinden) zeilenJe.set(ags, [...(zeilenJe.get(ags) ?? []), z]);
  }
  const rang = (u: Ursache) => URSACHEN.indexOf(u);

  const gemeinden: GemeindeUrsache[] = [];
  for (const g of input.gemeinden) {
    if (input.sichtbar.has(g.id)) continue;
    let best: GemeindeUrsache | null = null;
    const take = (u: GemeindeUrsache) => {
      if (!best || rang(u.ursache) < rang(best.ursache)) best = u;
    };
    for (const z of zeilenJe.get(g.id) ?? []) {
      take({ id: g.id, region: g.region, ...ursacheVonZeile(z, input.zurueckgehaltenWebsites), adapter: z.adapter, url: z.url });
    }
    for (const adapter of input.adapterVon.get(g.id) ?? []) {
      if ((zeilenJe.get(g.id) ?? []).some(z => z.adapter === adapter)) continue;
      // Adapter meldet seine Kalender, diese Gemeinde ist nicht dabei: kein Feed bzw. keine Seite in der Registry.
      take({ id: g.id, region: g.region, ursache: 'nicht_gelesen', adapter, grund: adapterMitBericht.has(adapter) ? 'kein Kalender des Adapters' : 'kein Bericht des Adapters' });
    }
    best ??= { id: g.id, region: g.region, ursache: 'nicht_im_nachtlauf', grund: g.integration };
    if (input.zurueckgehalten.has(g.id)) best = { ...best, ursache: 'zurueckgehalten', grund: undefined };
    gemeinden.push(best);
  }

  const gesamt: Partial<Record<Ursache, number>> = {};
  const nichtGelesen: Record<string, number> = {};
  const jeAdapter: Record<string, Partial<Record<Ursache, number>>> = {};
  const jeLand: Record<string, Partial<Record<Ursache, number>>> = {};
  const inc = (m: Partial<Record<Ursache, number>>, u: Ursache) => { m[u] = (m[u] ?? 0) + 1; };
  for (const g of gemeinden) {
    inc(gesamt, g.ursache);
    inc(jeLand[g.region] ??= {}, g.ursache);
    inc(jeAdapter[g.adapter ?? '(keiner)'] ??= {}, g.ursache);
    if (g.ursache === 'nicht_gelesen' && g.grund) nichtGelesen[g.grund] = (nichtGelesen[g.grund] ?? 0) + 1;
  }
  return { ohneTermin: gemeinden.length, gesamt, nichtGelesen, jeAdapter, jeLand, kalender, gemeinden };
}

/** Markdown für Konsole und GitHub-Zusammenfassung. */
export function ursachenTabellen(b: UrsachenBericht): string {
  const sorted = (m: Record<string, number>) => Object.entries(m).sort(([ka, a], [kb, c]) => c - a || ka.localeCompare(kb));
  const lines = [`### DE: ${b.ohneTermin} Gemeinden ohne Termin nach Ursache`, '', '| Ursache | Gemeinden |', '|---|---:|'];
  for (const u of URSACHEN) if (b.gesamt[u]) lines.push(`| ${URSACHE_TEXT[u]} | ${b.gesamt[u]} |`);
  lines.push('', '### Nicht gelesen, Gründe', '', '| Grund | Gemeinden |', '|---|---:|');
  for (const [k, v] of sorted(b.nichtGelesen)) lines.push(`| ${k} | ${v} |`);
  const matrix = (titel: string, rows: Record<string, Partial<Record<Ursache, number>>>) => {
    lines.push('', `### ${titel}`, '', `| | ${URSACHEN.map(u => URSACHE_TEXT[u]).join(' | ')} |`, `|---|${URSACHEN.map(() => '---:').join('|')}|`);
    for (const k of Object.keys(rows).sort()) lines.push(`| ${k} | ${URSACHEN.map(u => rows[k][u] ?? 0).join(' | ')} |`);
  };
  matrix('Je Adapter', b.jeAdapter);
  matrix('Je Land', b.jeLand);
  lines.push('', '### Kalender je Ergebnis (letzter Stand)', '', '| Ergebnis | Kalender |', '|---|---:|');
  for (const [k, v] of sorted(b.kalender)) lines.push(`| ${k} | ${v} |`);
  return lines.join('\n');
}
