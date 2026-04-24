/**
 * SEO A/B title-variant framework — **time-based rotation**, not user-based.
 *
 * ## Why time-based?
 *
 * For SEO title experiments (the primary MVP use case — compare H1/title
 * variants on /gemeinde/* and /thema/* hubs) the industry-standard
 * pattern is alternating periods, not per-visitor cookies:
 *
 *   1. Per-visitor cookie-based A/B on static hub pages would require
 *      writing a cookie in middleware, which poisons Next.js ISR
 *      (Cache-Control: private) and kills Google indexability. We
 *      learned this the hard way in fn-13 phase 0.5 — 9/45 656 pages
 *      indexed until we stopped writing cookies on anon requests.
 *
 *   2. Google crawls each page periodically. If it sees variant B for
 *      two weeks and variant A for the next two, it records the
 *      ranking performance of each. We compare 28-day GSC windows
 *      before/after the switchover to pick a winner.
 *
 *   3. No cookies = no CDN-cache poisoning, no privacy surface, no
 *      per-request DB lookup latency. The function runs on the
 *      snapshot_date to pick a variant deterministically.
 *
 * ## How it works
 *
 *   1. Admin creates an experiment with scope ('gemeinde' / 'thema' /
 *      'bundesland' / 'event_detail'), two JSON variant payloads, and
 *      lets it run. Default period is 14 days per variant.
 *
 *   2. Hub pages call `pickExperimentVariant(experiment, now)` which
 *      returns 'A' or 'B' based on:
 *
 *        period_index = floor((now - started_at) / period_days)
 *        variant      = period_index % 2 === 0 ? 'A' : 'B'
 *
 *      First period A, then B, then A again, until concluded.
 *
 *   3. Hub page inlines a one-line impression log (via a client island
 *      that fires a keepalive fetch on mount) so we can tally variant
 *      × impression counts against GSC clicks during the same period.
 *
 * ## Schema mapping
 *
 * Uses the existing `seo_experiments` table from the phase-10 migration.
 * `split_b_pct` is ignored for time-based scopes — it's kept on the
 * schema in case we ever want to add UX A/B later that does use cookies.
 */

export interface ExperimentRow {
  id: string;
  name: string;
  scope: 'gemeinde' | 'thema' | 'bundesland' | 'event_detail';
  status: 'running' | 'paused' | 'concluded';
  variant_a: Record<string, unknown>;
  variant_b: Record<string, unknown>;
  winner: 'A' | 'B' | null;
  split_b_pct: number;
  started_at: string;
  concluded_at: string | null;
}

export type Variant = 'A' | 'B';

/** How long each period (A or B) lasts. MVP value; per-experiment tuning
 *  can be added later via a `period_days` column. Two weeks gives Google
 *  enough time to re-crawl + re-rank on each variant. */
export const DEFAULT_PERIOD_DAYS = 14;

/**
 * Pick A or B for the current moment, given when the experiment started.
 *
 * Deterministic — the same `now` always produces the same variant, so
 * ISR caching stays effective (adjacent requests for the same hub URL
 * within a single period render identical HTML).
 */
export function pickExperimentVariant(
  exp: ExperimentRow,
  now: Date = new Date(),
  periodDays: number = DEFAULT_PERIOD_DAYS,
): Variant {
  if (exp.status !== 'running') return 'A';
  const started = new Date(exp.started_at).getTime();
  const elapsedMs = now.getTime() - started;
  if (elapsedMs < 0) return 'A';
  const periodMs = periodDays * 86400_000;
  const periodIndex = Math.floor(elapsedMs / periodMs);
  return periodIndex % 2 === 0 ? 'A' : 'B';
}

export interface RenderContext {
  name?: string;
  count?: number;
  plz?: string;
  bundesland?: string;
}

/**
 * Interprets a variant payload against context. Supported keys:
 *   - `title_template`: string with `{name}` / `{count}` / `{plz}` /
 *     `{bundesland}` placeholders. Rendered to the final page title.
 *   - `heading_prefix`: string prepended to the h1 (without replacing
 *     the original headline).
 *
 * Unknown keys are ignored — safe to evolve.
 */
export function renderTemplate(
  template: string,
  ctx: RenderContext,
): string {
  return template
    .replace(/\{name\}/g, ctx.name ?? '')
    .replace(/\{count\}/g, ctx.count !== undefined ? String(ctx.count) : '')
    .replace(/\{plz\}/g, ctx.plz ?? '')
    .replace(/\{bundesland\}/g, ctx.bundesland ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ResolvedPayload {
  title?: string;
  heading_prefix?: string;
}

export function renderVariantPayload(
  raw: Record<string, unknown>,
  ctx: RenderContext,
): ResolvedPayload {
  const out: ResolvedPayload = {};
  if (typeof raw.title_template === 'string') {
    out.title = renderTemplate(raw.title_template, ctx);
  }
  if (typeof raw.heading_prefix === 'string') {
    out.heading_prefix = renderTemplate(raw.heading_prefix, ctx);
  }
  return out;
}
