import 'server-only';
/**
 * Server-side helpers for the SEO experiments framework.
 *
 * Split from `experiments.ts` so the pure rendering helpers can be
 * imported by client code too (impression-logging island) without
 * pulling in the Supabase service client.
 *
 * Primary entry-point for hub pages:
 *   `resolveExperimentForScope(scope, context)`
 *
 * Returns either null (no active experiment for this scope) or the
 * resolved payload + the variant name + experiment id so the caller
 * can log an impression via the public `/api/seo/experiment-impression`
 * route.
 *
 * In-memory cache:
 *   Experiments change rarely (admin creates one every few days at
 *   most) but hub pages render thousands of times an hour. We cache
 *   "list of running experiments for scope X" in-process with a 60s
 *   TTL, balancing freshness vs RPC overhead. Vercel Fluid Compute
 *   reuses instances so the cache sees a decent hit rate.
 */

import { createClient } from '@supabase/supabase-js';
import {
  pickExperimentVariant,
  renderVariantPayload,
  type ExperimentRow,
  type RenderContext,
  type ResolvedPayload,
  type Variant,
} from './experiments';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; rows: ExperimentRow[] }>();

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function getRunningExperimentsForScope(
  scope: ExperimentRow['scope'],
): Promise<ExperimentRow[]> {
  const entry = cache.get(scope);
  if (entry && Date.now() - entry.at < CACHE_TTL_MS) return entry.rows;

  const sb = serviceClient();
  const { data } = await sb
    .from('seo_experiments')
    .select('*')
    .eq('scope', scope)
    .eq('status', 'running');
  const rows = (data ?? []) as ExperimentRow[];
  cache.set(scope, { at: Date.now(), rows });
  return rows;
}

/** Invalidate cache — called from the admin API when experiments change. */
export function invalidateExperimentsCache(scope?: ExperimentRow['scope']) {
  if (scope) cache.delete(scope);
  else cache.clear();
}

export interface ResolvedExperiment {
  experimentId: string;
  name: string;
  variant: Variant;
  payload: ResolvedPayload;
}

/**
 * Resolves the first running experiment for this scope. MVP allows
 * only ONE concurrent experiment per scope — if multiple are in the
 * table, we take whatever the DB returns first (order-independent
 * works fine for single-experiment-per-scope).
 *
 * Returns null when no running experiment exists — hub pages treat
 * that as "render the default static title".
 */
export async function resolveExperimentForScope(
  scope: ExperimentRow['scope'],
  context: RenderContext,
  now: Date = new Date(),
): Promise<ResolvedExperiment | null> {
  const experiments = await getRunningExperimentsForScope(scope);
  if (experiments.length === 0) return null;

  const exp = experiments[0];
  const variant = pickExperimentVariant(exp, now);
  const raw = variant === 'A' ? exp.variant_a : exp.variant_b;
  return {
    experimentId: exp.id,
    name: exp.name,
    variant,
    payload: renderVariantPayload(raw, context),
  };
}
