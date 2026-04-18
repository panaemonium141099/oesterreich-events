/**
 * Classifier audit — read-only instrumentation against Supabase.
 *
 * Produces a JSON + text report under data/classifier-audit/<timestamp>/.
 * Required operational artefact (plan R5). Run before and after every
 * backfill to measure impact.
 *
 * Sections:
 *   1. Confidence distribution (per bucket, including NULL)
 *   2. AI escalation rate (total + per-source_name)
 *   3. Top 100 unresolved title patterns (first-5-token groups)
 *   4. Top 50 false-positive collision hotspots
 *   5. Winner-vs-runner-up histogram (from category_candidates)
 *   6. Runtime source_name registry
 *   7. (Optional) Per-gate distribution (if gate reason strings were written)
 *   8. (Optional) Rewrite rate from the most recent backfill (via file marker)
 *
 * Usage:
 *   npx tsx --env-file=.env.local src/scripts/classifier-audit.ts
 *   npx tsx --env-file=.env.local src/scripts/classifier-audit.ts --label pre-backfill
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local manually so plain tsx works without --env-file.
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* use environment directly */ }

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
}

const label = arg('--label') ?? 'audit';

interface AuditEvent {
  id: string;
  title: string | null;
  category: string | null;
  source_name: string | null;
  category_confidence: string | null;
  category_version: string | null;
  category_needs_review: boolean | null;
  category_candidates: unknown;
}

async function fetchAll(): Promise<AuditEvent[]> {
  const rows: AuditEvent[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select(
        'id, title, category, source_name, category_confidence, category_version, category_needs_review, category_candidates',
      )
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error('fetch error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as AuditEvent[]));
    from += data.length;
    process.stdout.write(`  fetched ${rows.length}...\r`);
    if (data.length < pageSize) break;
  }
  process.stdout.write('\n');
  return rows;
}

function normalizeTitle(t: string | null): string {
  if (!t) return '';
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Report {
  generated_at: string;
  total_events: number;
  confidence_distribution: Record<string, number>;
  ai_escalation: {
    total_needs_review: number;
    total_ratio: number;
    per_source: Array<{ source_name: string; total: number; needs_review: number; ratio: number }>;
  };
  top_unresolved_titles: Array<{ pattern: string; count: number; samples: string[] }>;
  collision_hotspots: Array<{ category: string; collision: string; count: number; samples: string[] }>;
  runner_up_gap_histogram: Record<string, number>;
  source_registry: Array<{ source_name: string; total: number }>;
  version_distribution: Record<string, number>;
}

function buildReport(events: AuditEvent[]): Report {
  const confDist: Record<string, number> = {};
  const versionDist: Record<string, number> = {};
  const perSource = new Map<string, { total: number; needs_review: number }>();
  const unresolvedPatterns = new Map<string, { count: number; samples: string[] }>();
  const gapBuckets: Record<string, number> = {
    '0-4': 0, '5-9': 0, '10-19': 0, '20-49': 0, '50+': 0, 'no_candidates': 0,
  };
  const collisionMap = new Map<string, { count: number; samples: string[] }>();

  // Collision heuristics: known cat-v1 false-positive patterns worth flagging.
  // If category=X but title contains a token that's a known false-positive stem
  // for X without a corresponding real keyword, flag it.
  const COLLISION_CHECKS: Array<{ category: string; collision: string; probe: (title: string) => boolean }> = [
    {
      category: 'Märkte',
      collision: 'markt-inside-placename',
      probe: t => /neckenmarkt|ennsmarkt|bruckmarkt|hofmarkt|weinmarkt/.test(t) &&
        !/weihnachtsmarkt|bauernmarkt|flohmarkt|christkindlmarkt|adventmarkt|ostermarkt|wochenmarkt|genussmarkt|handwerksmarkt|antikmarkt/.test(t),
    },
    {
      category: 'Kultur',
      collision: 'oper-inside-word',
      probe: t => /operation|kooperat|cooper/.test(t) && !/oper |oper$|operette|ballett|theater/.test(t),
    },
    {
      category: 'Nightlife',
      collision: 'club-inside-word',
      probe: t => /\bclubh\w+|clubkarte|clubraum/.test(t) && !/clubbing|dj |club night|clubnight|rave|techno/.test(t),
    },
  ];

  let totalNeedsReview = 0;

  for (const e of events) {
    const conf = e.category_confidence ?? 'NULL';
    confDist[conf] = (confDist[conf] ?? 0) + 1;

    const ver = e.category_version ?? 'NULL';
    versionDist[ver] = (versionDist[ver] ?? 0) + 1;

    const src = e.source_name ?? 'NULL';
    const bucket = perSource.get(src) ?? { total: 0, needs_review: 0 };
    bucket.total += 1;
    if (e.category_needs_review) bucket.needs_review += 1;
    perSource.set(src, bucket);

    if (e.category_needs_review) {
      totalNeedsReview += 1;
      const norm = normalizeTitle(e.title);
      const first5 = norm.split(/\s+/).slice(0, 5).join(' ');
      if (first5) {
        const p = unresolvedPatterns.get(first5) ?? { count: 0, samples: [] };
        p.count += 1;
        if (p.samples.length < 3 && e.title) p.samples.push(e.title);
        unresolvedPatterns.set(first5, p);
      }
    }

    // Runner-up gap
    const cands = Array.isArray(e.category_candidates) ? e.category_candidates as Array<{ score?: number }> : null;
    if (!cands || cands.length === 0) {
      gapBuckets.no_candidates += 1;
    } else {
      const top = cands[0]?.score ?? 0;
      const runner = cands[1]?.score ?? 0;
      const gap = top - runner;
      if (gap < 5) gapBuckets['0-4'] += 1;
      else if (gap < 10) gapBuckets['5-9'] += 1;
      else if (gap < 20) gapBuckets['10-19'] += 1;
      else if (gap < 50) gapBuckets['20-49'] += 1;
      else gapBuckets['50+'] += 1;
    }

    // Collisions
    if (e.title && e.category) {
      const norm = normalizeTitle(e.title);
      for (const check of COLLISION_CHECKS) {
        if (check.category === e.category && check.probe(norm)) {
          const key = `${check.category}::${check.collision}`;
          const bucket = collisionMap.get(key) ?? { count: 0, samples: [] };
          bucket.count += 1;
          if (bucket.samples.length < 5) bucket.samples.push(e.title);
          collisionMap.set(key, bucket);
        }
      }
    }
  }

  const perSourceArr = Array.from(perSource.entries())
    .map(([source_name, v]) => ({
      source_name,
      total: v.total,
      needs_review: v.needs_review,
      ratio: v.total > 0 ? Number((v.needs_review / v.total).toFixed(3)) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 50);

  const sourceRegistry = Array.from(perSource.entries())
    .map(([source_name, v]) => ({ source_name, total: v.total }))
    .sort((a, b) => b.total - a.total);

  const topUnresolved = Array.from(unresolvedPatterns.entries())
    .map(([pattern, v]) => ({ pattern, count: v.count, samples: v.samples }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  const collisions = Array.from(collisionMap.entries())
    .map(([key, v]) => {
      const [category, collision] = key.split('::');
      return { category, collision, count: v.count, samples: v.samples };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return {
    generated_at: new Date().toISOString(),
    total_events: events.length,
    confidence_distribution: confDist,
    version_distribution: versionDist,
    ai_escalation: {
      total_needs_review: totalNeedsReview,
      total_ratio: events.length > 0 ? Number((totalNeedsReview / events.length).toFixed(4)) : 0,
      per_source: perSourceArr,
    },
    top_unresolved_titles: topUnresolved,
    collision_hotspots: collisions,
    runner_up_gap_histogram: gapBuckets,
    source_registry: sourceRegistry,
  };
}

function formatText(r: Report): string {
  const lines: string[] = [];
  lines.push('Classifier Audit Report');
  lines.push('='.repeat(60));
  lines.push(`Generated: ${r.generated_at}`);
  lines.push(`Total events: ${r.total_events}`);
  lines.push('');

  lines.push('Confidence distribution:');
  for (const [k, v] of Object.entries(r.confidence_distribution).sort((a, b) => b[1] - a[1])) {
    const pct = r.total_events > 0 ? ((v / r.total_events) * 100).toFixed(1) : '0.0';
    lines.push(`  ${k.padEnd(16)} ${String(v).padStart(7)} (${pct}%)`);
  }
  lines.push('');

  lines.push('Version distribution:');
  for (const [k, v] of Object.entries(r.version_distribution).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${k.padEnd(30)} ${String(v).padStart(7)}`);
  }
  lines.push('');

  lines.push(`AI escalation: ${r.ai_escalation.total_needs_review} of ${r.total_events} (${(r.ai_escalation.total_ratio * 100).toFixed(1)}%)`);
  lines.push('Top 20 sources by volume:');
  for (const s of r.ai_escalation.per_source.slice(0, 20)) {
    lines.push(`  ${s.source_name.padEnd(30)} total=${String(s.total).padStart(6)} ai=${String(s.needs_review).padStart(5)} ratio=${(s.ratio * 100).toFixed(1)}%`);
  }
  lines.push('');

  lines.push('Winner-vs-runner-up gap histogram:');
  for (const [k, v] of Object.entries(r.runner_up_gap_histogram)) {
    lines.push(`  ${k.padEnd(16)} ${String(v).padStart(7)}`);
  }
  lines.push('');

  lines.push('Top 20 unresolved title patterns:');
  for (const p of r.top_unresolved_titles.slice(0, 20)) {
    lines.push(`  [${String(p.count).padStart(5)}] ${p.pattern}`);
    if (p.samples[0]) lines.push(`          e.g. "${p.samples[0]}"`);
  }
  lines.push('');

  lines.push('Collision hotspots:');
  if (r.collision_hotspots.length === 0) {
    lines.push('  (none detected)');
  } else {
    for (const c of r.collision_hotspots) {
      lines.push(`  [${String(c.count).padStart(4)}] ${c.category} <- ${c.collision}`);
      if (c.samples[0]) lines.push(`          e.g. "${c.samples[0]}"`);
    }
  }
  lines.push('');

  lines.push(`Distinct source_name values: ${r.source_registry.length}`);
  lines.push('Top 30 sources by volume:');
  for (const s of r.source_registry.slice(0, 30)) {
    lines.push(`  ${s.source_name.padEnd(40)} ${String(s.total).padStart(7)}`);
  }

  return lines.join('\n') + '\n';
}

async function main() {
  console.log('Classifier audit — read-only, no writes');
  console.log('='.repeat(60));

  const events = await fetchAll();
  console.log(`Fetched ${events.length} events. Computing report...`);

  const report = buildReport(events);

  const outDir = path.resolve(`data/classifier-audit/${Date.now()}-${label}`);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'report.json');
  const txtPath = path.join(outDir, 'report.txt');
  const registryPath = path.join(outDir, 'source-registry.json');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(txtPath, formatText(report));
  fs.writeFileSync(registryPath, JSON.stringify(report.source_registry, null, 2));

  console.log('');
  console.log(formatText(report));
  console.log(`Full report: ${txtPath}`);
  console.log(`Source registry: ${registryPath}`);
}

main().catch(err => {
  console.error('audit failed:', err);
  process.exit(1);
});
