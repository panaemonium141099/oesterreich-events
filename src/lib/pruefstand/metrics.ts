/**
 * Prüfstand (fn-29.3): Qualitätsmetriken über Event-Zeilen.
 *
 * Dieselbe Funktion misst die Zeilen eines Adapters auf dem Prüfstand (wie
 * `toSupabaseRow` sie schreiben würde) und den Prod-Bestand der
 * österreichischen Gemeinde-Scraper (AT-Referenz). Nur so sind beide
 * Zahlen vergleichbar. REIN, kein I/O.
 */
import { isGarbageTitle } from '@/lib/pipeline/garbage-filter';
import { isMunicipalService } from '@/lib/category-classifier/municipal-service';
import { hasTimeOfDay, viennaCalendarDay } from '@/lib/quality/admission';
import { normalizeGemeindeName } from '@/lib/location/gemeinde-name';

/** Felder einer Event-Zeile, die der Prüfstand bewertet. */
export interface PruefRow {
  source_id: string;
  source_url?: string | null;
  title: string | null;
  start_date: string | null;
  end_date?: string | null;
  location_name?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_precision?: string | null;
  publish_status?: string | null;
  location_resolution?: { admission?: { decision?: string; reasons?: string[] } } | null;
}

export interface PruefMetrics {
  n: number;
  /** Zeilen, die öffentlich würden. */
  published: number;
  /** Zeilen mit Quarantäne-Verdikt des Freigabevertrags. */
  quarantined: number;
  quarantineReasons: Record<string, number>;
  /** Anteile an `n` (0..1). */
  rates: {
    garbageTitle: number;
    noTimeOfDay: number;
    municipalityPrecision: number;
    noCoords: number;
    visibleMunicipalService: number;
    duplicatesInRun: number;
  };
}

const PUBLISHED = new Set(['published', 'published_low_confidence']);

export function isPublished(row: Pick<PruefRow, 'publish_status'>): boolean {
  return PUBLISHED.has(row.publish_status ?? '');
}

/** Gleicher Name, gleicher Kalendertag, gleicher Ort im selben Lauf. */
function duplicateKey(r: PruefRow): string | null {
  if (!r.title || !r.start_date) return null;
  const d = new Date(r.start_date);
  if (isNaN(d.getTime())) return null;
  return `${normalizeGemeindeName(r.title)}|${viennaCalendarDay(d)}|${normalizeGemeindeName(r.location_name ?? '')}`;
}

export function measureRows(rows: readonly PruefRow[]): PruefMetrics {
  const n = rows.length;
  let published = 0, quarantined = 0, garbage = 0, noTime = 0, muni = 0, noCoords = 0, visibleService = 0, dup = 0;
  const reasons: Record<string, number> = {};
  const seen = new Set<string>();
  for (const r of rows) {
    const pub = isPublished(r);
    if (pub) published++;
    const adm = r.location_resolution?.admission;
    if (adm?.decision === 'quarantine') {
      quarantined++;
      for (const x of adm.reasons ?? []) reasons[x] = (reasons[x] ?? 0) + 1;
    }
    if (r.title && isGarbageTitle(r.title)) garbage++;
    if (!hasTimeOfDay(r.start_date)) noTime++;
    if (r.location_precision === 'municipality') muni++;
    if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') noCoords++;
    if (pub && isMunicipalService(r.title)) visibleService++;
    const k = duplicateKey(r);
    if (k) {
      if (seen.has(k)) dup++;
      else seen.add(k);
    }
  }
  const rate = (x: number) => (n === 0 ? 0 : x / n);
  return {
    n, published, quarantined, quarantineReasons: reasons,
    rates: {
      garbageTitle: rate(garbage),
      noTimeOfDay: rate(noTime),
      municipalityPrecision: rate(muni),
      noCoords: rate(noCoords),
      visibleMunicipalService: rate(visibleService),
      duplicatesInRun: rate(dup),
    },
  };
}

/**
 * Mehrere Messungen zusammenfassen: Zähler addieren, Raten nach `n`
 * gewichten. Dubletten bleiben so je Quelle gezählt (eine gemeinsame
 * Messung würde Treffer zwischen Quellen mitzählen, die erst der Dedup löst).
 */
export function poolMetrics(list: readonly PruefMetrics[]): PruefMetrics {
  const n = list.reduce((a, m) => a + m.n, 0);
  const reasons: Record<string, number> = {};
  for (const m of list) for (const [k, v] of Object.entries(m.quarantineReasons)) reasons[k] = (reasons[k] ?? 0) + v;
  const keys = Object.keys(list[0]?.rates ?? {}) as (keyof PruefMetrics['rates'])[];
  const rates = Object.fromEntries(keys.map(k => [k, n === 0 ? 0 : list.reduce((a, m) => a + m.rates[k] * m.n, 0) / n])) as PruefMetrics['rates'];
  return {
    n,
    published: list.reduce((a, m) => a + m.published, 0),
    quarantined: list.reduce((a, m) => a + m.quarantined, 0),
    quarantineReasons: reasons,
    rates,
  };
}

/** Deterministische Stichprobe (Mulberry32), damit der Bericht reproduzierbar ist. */
export function sampleRows<T>(rows: readonly T[], size: number, seed = 29): T[] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...rows];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, size);
}

export interface RunDiff {
  unchanged: number;
  changed: string[];
  carried: string[];
  gone: string[];
  added: string[];
}

/**
 * Vorher/nachher nach `source_id` (Methode aus PR #301). `carried` sind neue
 * IDs, die eine alte über `previous_source_id` übernehmen.
 */
export function diffRuns(
  before: readonly (PruefRow & { previous_source_id?: string | string[] | null })[],
  after: readonly (PruefRow & { previous_source_id?: string | string[] | null })[],
): RunDiff {
  const b = new Map(before.map(r => [r.source_id, r]));
  const a = new Map(after.map(r => [r.source_id, r]));
  const carriedOld = new Set<string>();
  const carried: string[] = [];
  for (const r of after) {
    if (b.has(r.source_id)) continue;
    const prev = ([] as string[]).concat(r.previous_source_id ?? []);
    if (prev.some(p => b.has(p))) { carried.push(r.source_id); prev.forEach(p => carriedOld.add(p)); }
  }
  const sig = (r: PruefRow) => JSON.stringify([r.title, r.start_date, r.end_date ?? null, r.location_name ?? null, r.publish_status ?? null]);
  let unchanged = 0;
  const changed: string[] = [];
  for (const [id, r] of a) {
    const old = b.get(id);
    if (!old) continue;
    if (sig(old) === sig(r)) unchanged++;
    else changed.push(id);
  }
  return {
    unchanged,
    changed,
    carried,
    gone: [...b.keys()].filter(id => !a.has(id) && !carriedOld.has(id)),
    added: [...a.keys()].filter(id => !b.has(id) && !carried.includes(id)),
  };
}
