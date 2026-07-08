/**
 * Chrome UX Report (CrUX) API client.
 *
 * CrUX aggregates anonymised Core Web Vitals field data from real Chrome
 * users. We query it for:
 *   - Origin-level vitals ("how fast is lasstreffen.at overall?")
 *   - URL-pattern vitals ("how fast are /gemeinde/* pages?") — done by
 *     querying each representative URL, CrUX doesn't support wildcards
 *
 * **No auth** for the basic data endpoint beyond an API key, which is a
 * free-tier billing key (unlimited reads). Env var `CRUX_API_KEY`.
 *
 * **Quota**: 150 QPM default, effectively unlimited for our use. Each
 * query returns percentile distributions (p75 is the industry standard
 * threshold for "good/needs-improvement/poor").
 *
 * **Metrics returned**:
 *   - `largest_contentful_paint` (LCP) — p75 in milliseconds
 *   - `interaction_to_next_paint` (INP) — p75 in milliseconds (replaced FID)
 *   - `cumulative_layout_shift` (CLS) — p75 unitless score
 *   - `first_contentful_paint` (FCP) — secondary, nice to have
 *   - `experimental_time_to_first_byte` (TTFB) — secondary
 *
 * Thresholds (2025 Core Web Vitals):
 *   LCP ≤2500ms good, ≤4000ms needs-improvement, >4000ms poor
 *   INP ≤200ms good, ≤500ms needs-improvement, >500ms poor
 *   CLS ≤0.1 good, ≤0.25 needs-improvement, >0.25 poor
 */

import { fetchWithTimeout } from './http';

const CRUX_ENDPOINT = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

export interface CruxMetricHistogramBin {
  start: number;
  end?: number;
  density: number;
}

export interface CruxMetric {
  histogram: CruxMetricHistogramBin[];
  percentiles: { p75: number | string };
}

export interface CruxRecord {
  key: { origin?: string; url?: string; formFactor?: 'PHONE' | 'DESKTOP' | 'TABLET' };
  metrics: {
    largest_contentful_paint?: CruxMetric;
    interaction_to_next_paint?: CruxMetric;
    cumulative_layout_shift?: CruxMetric;
    first_contentful_paint?: CruxMetric;
    experimental_time_to_first_byte?: CruxMetric;
  };
  collectionPeriod?: {
    firstDate?: { year: number; month: number; day: number };
    lastDate?: { year: number; month: number; day: number };
  };
}

interface CruxQuery {
  origin?: string;
  url?: string;
  formFactor?: 'PHONE' | 'DESKTOP' | 'TABLET';
}

export async function queryCrux(query: CruxQuery): Promise<CruxRecord | null> {
  const apiKey = process.env.CRUX_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[seo/crux] CRUX_API_KEY env var missing. ' +
      'Get one at https://console.cloud.google.com/apis/credentials — ' +
      'no scopes, no oauth; just a raw API key for chromeuxreport.googleapis.com.',
    );
  }

  const res = await fetchWithTimeout(`${CRUX_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });

  // 404 = "origin/URL has insufficient CrUX data" — that's the common
  // outcome for low-traffic pages. Return null instead of throwing so
  // the caller can gracefully omit the widget.
  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[seo/crux] ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { record: CruxRecord };
  return json.record;
}

/**
 * Helper: returns a normalised summary of the 3 core vitals for a given
 * origin/URL, bucketed as good/ni/poor per Google's 2025 thresholds.
 */
export interface VitalsSummary {
  lcp: { p75ms: number; verdict: 'good' | 'ni' | 'poor' } | null;
  inp: { p75ms: number; verdict: 'good' | 'ni' | 'poor' } | null;
  cls: { p75: number; verdict: 'good' | 'ni' | 'poor' } | null;
  sampleDays: string | null;
}

function verdictLCP(ms: number): 'good' | 'ni' | 'poor' {
  return ms <= 2500 ? 'good' : ms <= 4000 ? 'ni' : 'poor';
}
function verdictINP(ms: number): 'good' | 'ni' | 'poor' {
  return ms <= 200 ? 'good' : ms <= 500 ? 'ni' : 'poor';
}
function verdictCLS(v: number): 'good' | 'ni' | 'poor' {
  return v <= 0.1 ? 'good' : v <= 0.25 ? 'ni' : 'poor';
}

function toNumber(p75: number | string | undefined): number | null {
  if (p75 === undefined) return null;
  const n = typeof p75 === 'string' ? parseFloat(p75) : p75;
  return Number.isFinite(n) ? n : null;
}

export async function fetchVitalsSummary(
  query: CruxQuery,
): Promise<VitalsSummary | null> {
  const record = await queryCrux(query);
  if (!record) return null;

  const lcpMs = toNumber(record.metrics.largest_contentful_paint?.percentiles.p75);
  const inpMs = toNumber(record.metrics.interaction_to_next_paint?.percentiles.p75);
  const cls = toNumber(record.metrics.cumulative_layout_shift?.percentiles.p75);

  const first = record.collectionPeriod?.firstDate;
  const last = record.collectionPeriod?.lastDate;
  const fmt = (d?: { year: number; month: number; day: number }) =>
    d ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : null;
  const sampleDays = first && last ? `${fmt(first)} → ${fmt(last)}` : null;

  return {
    lcp: lcpMs !== null ? { p75ms: Math.round(lcpMs), verdict: verdictLCP(lcpMs) } : null,
    inp: inpMs !== null ? { p75ms: Math.round(inpMs), verdict: verdictINP(inpMs) } : null,
    cls: cls !== null ? { p75: Number(cls.toFixed(3)), verdict: verdictCLS(cls) } : null,
    sampleDays,
  };
}
