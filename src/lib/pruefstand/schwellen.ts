/**
 * Schwellen des Qualitätsvertrags DE (Epic fn-29, Spec „Prüfstand vor
 * Nachtlauf“). Ein Adapter, der eine Schwelle reißt, geht nicht in den
 * Nachtlauf. REIN, kein I/O.
 */
import type { PruefMetrics } from './metrics';

/** Größe der manuellen Stichprobe gegen die Quellseite. */
export const SAMPLE_SIZE = 30;

/** Sichtbare Gemeinde-Dienste: absolut null. */
export const MAX_VISIBLE_MUNICIPAL_SERVICE = 0;

/**
 * Raten, die nicht schlechter als die AT-Referenz sein dürfen (gepoolter
 * Wert der Gemeinde-Scraper gem2go, gemeinde-registry, gemeinden-generic,
 * `data/pruefstand/at-referenz.json`).
 */
export const RATES_VS_AT = ['garbageTitle', 'noTimeOfDay', 'noCoords', 'duplicatesInRun'] as const;
export type RateVsAt = (typeof RATES_VS_AT)[number];

export interface AtReferenz {
  measured_at: string;
  sources: string[];
  pooled: PruefMetrics;
  bySource: Record<string, PruefMetrics>;
}

export interface Verdict {
  check: string;
  ok: boolean;
  value: string;
  limit: string;
}

const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

/** Automatische Schwellen. Die Stichprobe (30/30) prüft der Mensch im Bericht. */
export function evaluate(m: PruefMetrics, ref: AtReferenz): Verdict[] {
  const out: Verdict[] = [];
  out.push({
    check: 'sichtbare Gemeinde-Dienste',
    ok: m.n > 0 && m.rates.visibleMunicipalService * m.n <= MAX_VISIBLE_MUNICIPAL_SERVICE,
    value: String(Math.round(m.rates.visibleMunicipalService * m.n)),
    limit: String(MAX_VISIBLE_MUNICIPAL_SERVICE),
  });
  for (const k of RATES_VS_AT) {
    out.push({ check: k, ok: m.n > 0 && m.rates[k] <= ref.pooled.rates[k], value: pct(m.rates[k]), limit: `≤ ${pct(ref.pooled.rates[k])} (AT)` });
  }
  return out;
}
