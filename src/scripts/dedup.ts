// src/scripts/dedup.ts
//
// Batch-Dedup: rechnet jede Nacht alle Dubletten-Cluster aus den aktuellen
// Daten neu (je Wiener Kalendertag) und schreibt nur die Abweichungen.
//
// Usage:
//   npm run dedup -- --dry-run                      # Plan zeigen, nichts schreiben
//   npm run dedup -- --dry-run --report report.json # + vollständiger Plan zur Prüfung
//   npm run dedup                                   # schreiben (mit Sicherheitsventil)
//   npm run dedup -- --max-new-duplicates 20000 --max-releases 2000
//                                                   # Freigabe nach geprüftem Probelauf
//
// Sicherheitsventil: mehr neue Duplikate oder Freigaben als die Grenzen →
// nichts schreiben, Exit 1 (Pipeline-Schritt rot → Alarm). Massenänderungen
// sind fast immer ein Fehler; ein Mensch prüft den Probelauf und gibt frei.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { canonicalizeIds } from '@/lib/pipeline/dedup-scorer';
import { dedupDay, pairKey } from '@/lib/pipeline/dedup-engine';
import { planDedup, releaseStatus, checkSafetyValve, type DedupPlan } from '@/lib/pipeline/dedup-plan';
import { isPlausibleEventDay, viennaDayBoundsUtc, viennaDayOf } from '@/lib/pipeline/dedup-evidence';
import { isGarbageTitle } from '@/lib/pipeline/garbage-filter';
import { fetchAllRows, forEachPage } from '@/lib/db/fetch-all';
import type { DedupScoreBreakdown, EventRow } from '@/lib/pipeline/types';

/** Nur Ids + Bewertung: das Log braucht keine ganzen Zeilen im Speicher. */
interface LogPair {
  aId: string;
  bId: string;
  breakdown: DedupScoreBreakdown;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// .env.local nur ergänzend: explizit gesetzte Variablen (z. B. Prod-Ziel für
// einen Probelauf) gewinnen.
try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0 && !process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = t.slice(eq + 1);
  }
} catch { /* ignore */ }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
function numArg(name: string, fallback: number): number {
  const i = args.indexOf(name);
  const v = i >= 0 ? Number(args[i + 1]) : NaN;
  return Number.isFinite(v) ? v : fallback;
}
function strArg(name: string): string | null {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}
// Normale Nacht: ein paar hundert neue Dubletten, kaum Freigaben.
const LIMITS = {
  maxNewDuplicates: numArg('--max-new-duplicates', 1500),
  maxReleases: numArg('--max-releases', 300),
};
const REPORT_PATH = strArg('--report');
const CONCURRENCY = 8;

if (args.includes('--reset')) {
  console.log('Hinweis: --reset ist überflüssig — jeder Lauf rechnet alle Cluster neu.');
}

const EVENT_SELECT = 'id,title,description,start_date,end_date,is_all_day,location_name,address,district,postal_code,bundesland,latitude,longitude,location_precision,source_url,ticket_url,image_url,category,tags,source_id,source_name,venue_id,quality_score,publish_status,content_fingerprint,duplicate_of,dedup_score,dedup_cluster_id,organizer,price_text,created_at,last_seen_at,location_status';

// ---------------------------------------------------------------------------
// Phase 1: Garbage cleanup
// ---------------------------------------------------------------------------

async function cleanupGarbage(): Promise<number> {
  console.log('\n--- Phase 1: Garbage Cleanup ---');
  const garbageIds: string[] = [];
  await forEachPage<{ id: string; title: string | null; source_name: string | null }>(
    (from, to) => supabase
      .from('events')
      .select('id,title,source_name')
      .not('publish_status', 'in', '("suppressed","duplicate")')
      .order('id')
      .range(from, to),
    (rows) => {
      for (const e of rows) {
        if (e.title && isGarbageTitle(e.title, { sourceName: e.source_name })) garbageIds.push(e.id);
      }
    },
    { label: 'dedup: Garbage-Scan' },
  );
  console.log(`  Found ${garbageIds.length} garbage events`);

  if (garbageIds.length > 0 && !DRY_RUN) {
    for (let i = 0; i < garbageIds.length; i += 200) {
      const chunk = garbageIds.slice(i, i + 200);
      const { error } = await supabase
        .from('events')
        .update({ publish_status: 'suppressed', quality_score: 0 })
        .in('id', chunk);
      if (error) throw new Error(`Garbage update: ${error.message}`);
    }
    console.log(`  Suppressed ${garbageIds.length} garbage events`);
  }
  return garbageIds.length;
}

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

async function loadManualDecisions(): Promise<{ merges: Set<string>; splits: Set<string> }> {
  const rows = await fetchAllRows<{ id: string; event_a_id: string; event_b_id: string; decision: string }>(
    (from, to) => supabase
      .from('event_dedup_log')
      .select('id,event_a_id,event_b_id,decision')
      .in('decision', ['manual_merge', 'manual_split'])
      .order('id')
      .range(from, to),
    { label: 'dedup: manuelle Entscheidungen' },
  );
  const merges = new Set<string>();
  const splits = new Set<string>();
  for (const r of rows) (r.decision === 'manual_merge' ? merges : splits).add(pairKey(r.event_a_id, r.event_b_id));
  return { merges, splits };
}

/** Wiener Kalendertage aller nicht unterdrückten Events (inkl. Duplikate:
 *  auch sie werden neu entschieden) und je Quelle das jüngste last_seen_at
 *  (Bezug für verwaiste Zeilen). */
async function getViennaDays(): Promise<{ days: string[]; sourceLastSeen: Map<string, string> }> {
  const days = new Set<string>();
  const implausible = new Map<string, number>();
  const sourceLastSeen = new Map<string, string>();
  await forEachPage<{ id: string; start_date: string | null; source_name: string | null; last_seen_at: string | null }>(
    (from, to) => supabase
      .from('events')
      .select('id,start_date,source_name,last_seen_at')
      .not('start_date', 'is', null)
      .neq('publish_status', 'suppressed')
      .order('start_date')
      .order('id')
      .range(from, to),
    (rows) => {
      for (const e of rows) {
        if (e.source_name && e.last_seen_at) {
          const prev = sourceLastSeen.get(e.source_name);
          if (!prev || Date.parse(e.last_seen_at) > Date.parse(prev)) sourceLastSeen.set(e.source_name, e.last_seen_at);
        }
        const day = e.start_date ? viennaDayOf({ start_date: e.start_date }) : null;
        if (!day) continue;
        if (isPlausibleEventDay(day)) days.add(day);
        else implausible.set(day, (implausible.get(day) ?? 0) + 1);
      }
    },
    { label: 'dedup: Tage lesen' },
  );
  if (implausible.size > 0) {
    const n = [...implausible.values()].reduce((s, v) => s + v, 0);
    console.log(`  ${n} Events mit unplausiblem Datum übersprungen (Quellfehler): ${[...implausible.keys()].sort().join(', ')}`);
  }
  return { days: [...days].sort(), sourceLastSeen };
}

/** Bisherige Primaries, die an einem anderen Tag liegen (für die Freigabe-Prüfung). */
async function loadExternalPrimaries(events: EventRow[]): Promise<Map<string, EventRow>> {
  const inDay = new Set(events.map(e => e.id));
  const ids = [...new Set(events
    .filter(e => e.publish_status === 'duplicate' && e.duplicate_of && !inDay.has(e.duplicate_of))
    .map(e => e.duplicate_of!))];
  const out = new Map<string, EventRow>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('events').select(EVENT_SELECT).in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`dedup: frühere Primaries: ${error.message}`);
    for (const r of (data ?? []) as unknown as EventRow[]) out.set(r.id, r);
  }
  return out;
}

async function loadEventsForDay(day: string): Promise<EventRow[]> {
  const [from, to] = viennaDayBoundsUtc(day);
  return fetchAllRows<EventRow>(
    (a, b) => supabase
      .from('events')
      .select(EVENT_SELECT)
      .gte('start_date', from)
      .lt('start_date', to)
      .neq('publish_status', 'suppressed')
      .order('id')
      .range(a, b) as unknown as PromiseLike<{ data: EventRow[] | null; error: { message: string } | null }>,
    { label: `dedup: Tag ${day}` },
  );
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

async function inPool<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await work(item);
    }
  });
  await Promise.all(workers);
}

async function applyPlan(plan: DedupPlan, errors: string[]): Promise<void> {
  // 1. Freigaben: Status wie beim Upsert (Score, Quarantäne bleibt).
  if (plan.release.length > 0) {
    const ids = plan.release.map(r => r.id);
    const statusById = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase
        .from('events')
        .select('id,quality_score,location_status,admission:location_resolution->admission->>decision')
        .in('id', ids.slice(i, i + 200));
      if (error) { errors.push(`Freigabe lesen: ${error.message}`); continue; }
      for (const r of (data ?? []) as Array<{ id: string; quality_score: number | null; location_status: string | null; admission: string | null }>) {
        statusById.set(r.id, releaseStatus({ quality_score: r.quality_score, admission_decision: r.admission, location_status: r.location_status }));
      }
    }
    const byStatus = new Map<string, string[]>();
    for (const [id, status] of statusById) byStatus.set(status, [...(byStatus.get(status) ?? []), id]);
    const release = (ids: string[], status: string) => supabase
      .from('events')
      .update({ publish_status: status, duplicate_of: null, dedup_score: null, dedup_cluster_id: null })
      .in('id', ids);
    for (const [status, list] of byStatus) {
      for (let i = 0; i < list.length; i += 200) {
        const chunk = list.slice(i, i + 200);
        const { error } = await release(chunk, status);
        if (!error) continue;
        // Ein abgelehnter Datensatz darf nicht 199 andere blockieren:
        // einzeln nachschreiben und nur die echten Ausreißer melden.
        await inPool(chunk, async (id) => {
          const { error: e } = await release([id], status);
          if (e) errors.push(`Freigabe ${id}: ${e.message}`);
        });
      }
    }
  }

  // 2. Primaries vor den Duplikaten: kein Moment, in dem beide verborgen sind.
  await inPool(plan.primaries, async (p) => {
    const { error } = await supabase
      .from('events')
      .update({ dedup_cluster_id: p.clusterId, ...p.enrichments })
      .eq('id', p.id);
    if (error) errors.push(`Primary ${p.id}: ${error.message}`);
  });

  // 3. Duplikate markieren / umhängen.
  await inPool(plan.markDuplicate, async (m) => {
    const { error } = await supabase
      .from('events')
      .update({ publish_status: 'duplicate', duplicate_of: m.primaryId, dedup_score: m.score, dedup_cluster_id: m.clusterId })
      .eq('id', m.id);
    if (error) errors.push(`Duplikat ${m.id}: ${error.message}`);
  });
}

/** Paar-Log für die Admin-Prüfansicht; manuelle Entscheidungen bleiben unberührt,
 *  automatische „uncertain"-Einträge, die nicht mehr zutreffen, fliegen raus. */
async function writeLog(pairs: LogPair[], errors: string[]): Promise<number> {
  const auto = pairs.filter(p => !p.breakdown.reason?.startsWith('manual_'));
  let written = 0;
  for (let i = 0; i < auto.length; i += 200) {
    const rows = auto.slice(i, i + 200).map(p => {
      const [a, b] = canonicalizeIds(p.aId, p.bId);
      return {
        event_a_id: a,
        event_b_id: b,
        title_score: p.breakdown.titleScore,
        datetime_score: p.breakdown.datetimeScore,
        venue_score: p.breakdown.venueScore,
        geo_score: p.breakdown.geoScore,
        url_score: p.breakdown.urlScore,
        overall_score: p.breakdown.overallScore,
        decision: p.breakdown.decision,
      };
    });
    const { error } = await supabase.from('event_dedup_log').upsert(rows, { onConflict: 'event_a_id,event_b_id' });
    if (error) errors.push(`Log: ${error.message}`);
    else written += rows.length;
  }

  const current = new Set(auto.filter(p => p.breakdown.decision === 'uncertain').map(p => pairKey(p.aId, p.bId)));
  const stale: string[] = [];
  await forEachPage<{ id: string; event_a_id: string; event_b_id: string }>(
    (from, to) => supabase
      .from('event_dedup_log')
      .select('id,event_a_id,event_b_id')
      .eq('decision', 'uncertain')
      .eq('decided_by', 'auto')
      .order('id')
      .range(from, to),
    (rows) => { for (const r of rows) if (!current.has(pairKey(r.event_a_id, r.event_b_id))) stale.push(r.id); },
    { label: 'dedup: Log lesen' },
  );
  for (let i = 0; i < stale.length; i += 200) {
    const { error } = await supabase.from('event_dedup_log').delete().in('id', stale.slice(i, i + 200));
    if (error) errors.push(`Log aufräumen: ${error.message}`);
  }
  console.log(`  Log: ${written} Paare geschrieben, ${stale.length} veraltete „uncertain" entfernt`);
  return written;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface ReportEntry {
  day: string;
  action: 'duplicate' | 'repoint' | 'release';
  id: string;
  title: string;
  source: string | null;
  primaryId?: string;
  primaryTitle?: string;
  primarySource?: string | null;
  reason?: string;
}

async function main(): Promise<void> {
  const started = Date.now();
  console.log(`=== Batch Dedup ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===`);
  console.log(`  Grenzen: ${LIMITS.maxNewDuplicates} neue Duplikate, ${LIMITS.maxReleases} Freigaben`);

  const garbage = await cleanupGarbage();
  const manual = await loadManualDecisions();
  console.log(`  Manuelle Entscheidungen: ${manual.merges.size} merge, ${manual.splits.size} split`);

  console.log('\n--- Phase 2: Cluster je Wiener Tag neu berechnen ---');
  const { days, sourceLastSeen } = await getViennaDays();
  console.log(`  ${days.length} Tage, ${sourceLastSeen.size} Quellen`);

  const plan: DedupPlan = { markDuplicate: [], release: [], primaries: [] };
  const logPairs: LogPair[] = [];
  const reasons = new Map<string, number>();
  const report: ReportEntry[] = [];
  let scanned = 0, candidates = 0, clusters = 0, ambiguous = 0, blocked = 0, orphans = 0;
  const releaseReasons = new Map<string, number>();

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const events = await loadEventsForDay(day);
    scanned += events.length;
    if (events.length === 0) continue;

    const result = dedupDay(events, { manualMerges: manual.merges, manualSplits: manual.splits, sourceLastSeen });
    const dayPlan = planDedup(events, result.clusters, {
      sourceLastSeen,
      manualSplits: manual.splits,
      externalPrimaries: await loadExternalPrimaries(events),
    });
    orphans += result.orphanIds.length;
    candidates += result.stats.candidatePairs;
    ambiguous += result.stats.ambiguousDropped;
    blocked += result.stats.blockedByConflict;
    clusters += result.clusters.length;
    for (const p of result.pairs) {
      logPairs.push({ aId: p.a.id, bId: p.b.id, breakdown: p.breakdown });
      const r = `${p.breakdown.decision}:${p.breakdown.reason}`;
      reasons.set(r, (reasons.get(r) ?? 0) + 1);
    }

    plan.markDuplicate.push(...dayPlan.markDuplicate);
    plan.release.push(...dayPlan.release);
    plan.primaries.push(...dayPlan.primaries);

    const byId = new Map(events.map(e => [e.id, e]));
    for (const m of dayPlan.markDuplicate) {
      const e = byId.get(m.id)!;
      const p = byId.get(m.primaryId)!;
      report.push({ day, action: m.isNew ? 'duplicate' : 'repoint', id: m.id, title: e.title, source: e.source_name ?? null, primaryId: p.id, primaryTitle: p.title, primarySource: p.source_name ?? null });
    }
    for (const r of dayPlan.release) {
      const e = byId.get(r.id)!;
      report.push({ day, action: 'release', id: r.id, title: e.title, source: e.source_name ?? null, primaryId: r.previousPrimaryId ?? undefined, reason: r.reason });
      releaseReasons.set(r.reason, (releaseReasons.get(r.reason) ?? 0) + 1);
    }

    if ((i + 1) % 50 === 0) {
      process.stderr.write(`\r  Tage ${i + 1}/${days.length} | Events ${scanned} | Kandidaten ${candidates} | Cluster ${clusters}`);
    }
  }
  process.stderr.write('\n');

  const newDuplicates = plan.markDuplicate.filter(m => m.isNew).length;
  console.log('\n=== Plan ===');
  console.log(`  Events geprüft:        ${scanned}`);
  console.log(`  Kandidaten-Paare:      ${candidates}`);
  console.log(`  Cluster:               ${clusters}`);
  console.log(`  Neue Duplikate:        ${newDuplicates}`);
  console.log(`  Umgehängte Duplikate:  ${plan.markDuplicate.length - newDuplicates}`);
  console.log(`  Freigaben:             ${plan.release.length}  (${[...releaseReasons.entries()].map(([r, n]) => `${r} ${n}`).join(', ') || '–'})`);
  console.log(`  Verwaiste Zeilen:      ${orphans} (Quelle liefert sie nicht mehr; nie Gegenbeleg, nie freigegeben)`);
  console.log(`  Primary-Updates:       ${plan.primaries.length}`);
  console.log(`  Mehrdeutig verworfen:  ${ambiguous} Verbindungen`);
  console.log(`  Widerspruch im Cluster:${blocked} Verbindungen`);
  console.log('  Entscheidungen nach Grund:');
  for (const [r, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(7)}  ${r}`);

  for (const action of ['duplicate', 'release'] as const) {
    const sample = report.filter(r => r.action === action).sort(() => Math.random() - 0.5).slice(0, 15);
    if (sample.length === 0) continue;
    console.log(`\n  Stichprobe ${action}:`);
    for (const s of sample) {
      console.log(`    ${s.day}  [${s.source}] ${s.title.slice(0, 60)}${s.primaryTitle ? `  →  [${s.primarySource}] ${s.primaryTitle.slice(0, 60)}` : ''}`);
    }
  }
  if (REPORT_PATH) {
    writeFileSync(REPORT_PATH, JSON.stringify({ limits: LIMITS, report, reasons: Object.fromEntries(reasons) }, null, 1));
    console.log(`\n  Bericht: ${REPORT_PATH}`);
  }

  const violations = checkSafetyValve(plan, LIMITS);
  if (violations.length > 0) {
    console.log(`\n!!! Sicherheitsventil: ${violations.join('; ')}`);
    if (!DRY_RUN) {
      console.log('    Nichts geschrieben. Probelauf prüfen (--dry-run --report …) und mit höheren Grenzen freigeben.');
      process.exit(1);
    }
  }

  const errors: string[] = [];
  if (!DRY_RUN) {
    console.log('\n--- Phase 3: Schreiben ---');
    await applyPlan(plan, errors);
    await writeLog(logPairs, errors);

    const { data: rewire, error: rewireErr } = await supabase.rpc('rewire_saved_events_to_primaries');
    if (rewireErr) errors.push(`Rewire saved_events: ${rewireErr.message}`);
    else if (Array.isArray(rewire) && rewire.length > 0) {
      const row = rewire[0] as { rewired_saved_events: number; rewired_artist_notifications: number };
      console.log(`  Rewired ${row.rewired_saved_events} saved_events + ${row.rewired_artist_notifications} notifications to primaries.`);
    }
  }

  console.log('\n=== Dedup Summary ===');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | Dauer ${((Date.now() - started) / 1000).toFixed(1)} s | Garbage ${garbage}`);
  if (errors.length > 0) {
    console.log(`  Fehler: ${errors.length}`);
    for (const err of errors.slice(0, 20)) console.log(`    - ${err}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
