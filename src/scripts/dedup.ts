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
//   npm run dedup -- --limits-country DE --max-inflow-duplicates 30000
//                                                   # Freigabe nur für ein Land
//   npm run dedup -- --country DE                   # nur DE-Zeilen (getrennter DE-Lauf;
//                                                   # AT = alles außer DE)
//
// Sicherheitsventil: mehr neue Duplikate oder Freigaben als die Grenzen →
// nichts schreiben, Exit 1 (Pipeline-Schritt rot → Alarm). Massenänderungen
// sind fast immer ein Fehler; ein Mensch prüft den Probelauf und gibt frei.
// Das Ventil rechnet je Land (fn-29.18): stoppt es für Deutschland, schreibt
// der Lauf Österreich trotzdem, und umgekehrt. Anker und Laufzeile
// (`dedup_runs.country`) gelten je Land. Seit AT und DE getrennt laufen
// (`--country`, PIPELINE_COUNTRY) liest und schreibt jeder Lauf nur sein Land.
// Cluster verbinden nie Zeilen zweier Länder.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { canonicalizeIds } from '@/lib/pipeline/dedup-scorer';
import { dedupDay, pairKey } from '@/lib/pipeline/dedup-engine';
import { planDedup, releaseStatus, checkSafetyValve, valveClass, dropDependentsOfFailedReleases, resolvePlanConflicts, splitPlanByCountry, type DedupPlan, type SafetyLimits, type ValveClass } from '@/lib/pipeline/dedup-plan';
import { isPlausibleEventDay, planningStartDay, viennaDayBoundsUtc, viennaDayOf } from '@/lib/pipeline/dedup-evidence';
import { isGarbageRow, namedPageKeys, surplusBrokenTitleIds, type GarbageRowInput } from '@/lib/pipeline/garbage-filter';
import { staleVersionIds } from '@/lib/pipeline/dedup-cluster';
import { fetchAllRows, forEachPage } from '@/lib/db/fetch-all';
import { reportStepReason } from '@/lib/pipeline/step-reason';
import type { DedupScoreBreakdown, EventRow } from '@/lib/pipeline/types';
import { forCountry, inRunCountry, pipelineCountry } from '@/lib/pipeline/pipeline-country';

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
/** Argument, sonst Umgebungsvariable (Freigabe aus dem CI per
 *  workflow_dispatch, siehe scrape-events.yml), sonst Standard. */
function numArg(name: string, fallback: number, envName?: string): number {
  const i = args.indexOf(name);
  const v = i >= 0 ? Number(args[i + 1]) : NaN;
  if (Number.isFinite(v)) return v;
  const e = envName && process.env[envName] ? Number(process.env[envName]) : NaN;
  return Number.isFinite(e) && e > 0 ? e : fallback;
}
function strArg(name: string): string | null {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}
// Normale Nacht: ein paar hundert neue Dubletten, kaum Freigaben.
const DEFAULT_LIMITS: Required<SafetyLimits> = {
  // Neue Duplikate am Bestand (valveClass 'stock'): eine normale Nacht
  // bringt 170 bis 330 (Prod 2026-10-10/11), der erste Lauf nach einem
  // Stopp das Doppelte. Zulauf hat einen eigenen, höheren Stolperdraht.
  maxNewDuplicates: 800,
  maxInflowDuplicates: 4000,
  maxReleases: 300,
  // Seit Müll-Titel schon im Sync verworfen werden, kommt kaum neuer dazu.
  maxGarbage: 1000,
};
/** Grenzen einer Freigabe (Argument oder workflow_dispatch). */
const RELEASED_LIMITS: Required<SafetyLimits> = {
  maxNewDuplicates: numArg('--max-new-duplicates', DEFAULT_LIMITS.maxNewDuplicates, 'DEDUP_MAX_NEW_DUPLICATES'),
  maxInflowDuplicates: numArg('--max-inflow-duplicates', DEFAULT_LIMITS.maxInflowDuplicates, 'DEDUP_MAX_INFLOW_DUPLICATES'),
  maxReleases: numArg('--max-releases', DEFAULT_LIMITS.maxReleases, 'DEDUP_MAX_RELEASES'),
  maxGarbage: numArg('--max-garbage', DEFAULT_LIMITS.maxGarbage, 'DEDUP_MAX_GARBAGE'),
};
/** Die Freigabe gilt nur diesem Land (leer: allen Ländern). */
const LIMITS_COUNTRY = strArg('--limits-country') ?? (process.env.DEDUP_LIMITS_COUNTRY?.trim() || null);
const limitsFor = (country: string) => (!LIMITS_COUNTRY || LIMITS_COUNTRY === country ? RELEASED_LIMITS : DEFAULT_LIMITS);
/** Land des Laufs (AT: alles außer DE); null = alle. */
const COUNTRY = pipelineCountry(args);
/** Länder mit Laufzeile ab Laufbeginn; ein weiteres bekommt sie am Ende. */
const RUN_COUNTRIES = ['AT', 'DE', 'CH'].filter(c => inRunCountry(c, COUNTRY));
/** Zeilen ohne Land (Prod 2026-11-02: keine). */
const FALLBACK_COUNTRY = 'AT';
const REPORT_PATH = strArg('--report') ?? process.env.DEDUP_REPORT_PATH ?? null;
// Vergangene Tage sieht niemand mehr: geplant (und gezählt) wird ab dem Vortag.
const START_DAY = planningStartDay();
const CONCURRENCY = 8;

if (args.includes('--reset')) {
  console.log('Hinweis: --reset ist überflüssig — jeder Lauf rechnet alle Cluster neu.');
}

const EVENT_SELECT = 'id,title,description,start_date,end_date,is_all_day,location_name,address,district,postal_code,bundesland,latitude,longitude,location_precision,source_url,ticket_url,image_url,category,tags,source_id,source_name,venue_id,quality_score,publish_status,content_fingerprint,duplicate_of,dedup_score,dedup_cluster_id,organizer,price_text,created_at,last_seen_at,location_status,source_type,withdrawn_at,country,admission_decision:location_resolution->admission->>decision';

// ---------------------------------------------------------------------------
// Phase 1: Garbage cleanup
// ---------------------------------------------------------------------------

/** Seiten + Tage, für die eine Quelle eine Zeile mit echtem Namen liefert
 *  (auch verborgene Duplikate). Ein Titel ohne Namen auf so einer Seite ist
 *  ein Kachelteil, sonst ein echtes Event mit kaputtem Titel (isGarbageRow). */
const NAMED_PAGES = new Set<string>();
/** Ältere Fassungen einer Seite mit genau einem Event (staleVersionIds). */
let STALE_IDS = new Set<string>();
/** Weitere Zeilen mit kaputtem Titel derselben Event-Seite am selben Tag. */
const SURPLUS_IDS = new Set<string>();
const isGarbage = (e: GarbageRowInput & { id?: string }) => isGarbageRow(e, NAMED_PAGES) || (!!e.id && SURPLUS_IDS.has(e.id));

/** Sichtbare Müll-Zeilen finden (Id → Land). Geschrieben wird erst nach dem
 *  Sicherheitsventil (suppressGarbage). */
async function scanGarbage(): Promise<Map<string, string>> {
  console.log('\n--- Phase 1: Garbage-Scan ---');
  type Row = GarbageRowInput & { id: string; publish_status: string | null; source_id: string | null; last_seen_at: string | null; country: string | null };
  const rows: Row[] = [];
  await forEachPage<Row>(
    (from, to) => forCountry(supabase
      .from('events')
      .select('id,title,source_name,source_id,source_url,ticket_url,start_date,last_seen_at,publish_status,country')
      .gte('start_date', viennaDayBoundsUtc(START_DAY)[0])
      .neq('publish_status', 'suppressed'), COUNTRY)
      .order('id')
      .range(from, to),
    (page) => { rows.push(...page); },
    { label: 'dedup: Garbage-Scan' },
  );
  for (const r of rows) for (const key of namedPageKeys(r)) NAMED_PAGES.add(key);
  for (const id of surplusBrokenTitleIds(rows.filter(r => r.publish_status !== 'duplicate'), NAMED_PAGES)) SURPLUS_IDS.add(id);
  const garbage = new Map(rows
    .filter(r => r.publish_status !== 'duplicate' && isGarbage(r))
    .map(r => [r.id, r.country ?? FALLBACK_COUNTRY] as const));
  STALE_IDS = staleVersionIds(rows as unknown as EventRow[]);
  console.log(`  ${STALE_IDS.size} ältere Fassungen von Event-Seiten (gelten wie verwaist)`);
  console.log(`  Found ${garbage.size} garbage events`);
  return garbage;
}

async function suppressGarbage(garbageIds: string[]): Promise<void> {
  for (let i = 0; i < garbageIds.length; i += 200) {
    const chunk = garbageIds.slice(i, i + 200);
    const { error } = await supabase
      .from('events')
      .update({ publish_status: 'suppressed', quality_score: 0 })
      .in('id', chunk);
    if (error) throw new Error(`Garbage update: ${error.message}`);
  }
  if (garbageIds.length > 0) console.log(`  Suppressed ${garbageIds.length} garbage events`);
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
    (from, to) => forCountry(supabase
      .from('events')
      .select('id,start_date,source_name,last_seen_at')
      .not('start_date', 'is', null)
      .neq('publish_status', 'suppressed'), COUNTRY)
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
    // Müll-Zeilen gelten schon als unterdrückt (geschrieben wird erst nach
    // dem Ventil): ihre Duplikate werden freigegeben.
    for (const r of (data ?? []) as unknown as EventRow[]) {
      out.set(r.id, isGarbage(r) ? { ...r, publish_status: 'suppressed' } : r);
    }
  }
  return out;
}

async function loadEventsForDay(day: string): Promise<EventRow[]> {
  const [from, to] = viennaDayBoundsUtc(day);
  return fetchAllRows<EventRow>(
    (a, b) => forCountry(supabase
      .from('events')
      .select(EVENT_SELECT)
      .gte('start_date', from)
      .lt('start_date', to)
      .neq('publish_status', 'suppressed'), COUNTRY)
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

async function applyPlan(fullPlan: DedupPlan, errors: string[]): Promise<void> {
  let plan = fullPlan;
  const failedReleases = new Set<string>();
  // 1. Freigaben: Status wie beim Upsert (Score, Quarantäne bleibt).
  if (plan.release.length > 0) {
    const ids = plan.release.map(r => r.id);
    const statusById = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase
        .from('events')
        .select('id,title,start_date,quality_score,location_status,admission:location_resolution->admission->>decision')
        .in('id', ids.slice(i, i + 200));
      if (error) { errors.push(`Freigabe lesen: ${error.message}`); continue; }
      for (const r of (data ?? []) as Array<{ id: string; title: string | null; start_date: string | null; quality_score: number | null; location_status: string | null; admission: string | null }>) {
        statusById.set(r.id, releaseStatus({ title: r.title, start_date: r.start_date, quality_score: r.quality_score, admission_decision: r.admission, location_status: r.location_status }));
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
          if (e) { errors.push(`Freigabe ${id}: ${e.message}`); failedReleases.add(id); }
        });
      }
    }
    for (const id of ids) if (!statusById.has(id)) failedReleases.add(id);
    // Wer nicht freigegeben werden konnte, bleibt 'duplicate': nichts daran
    // hängen, sonst ist das ganze Event unsichtbar (live1: 1.103 Events).
    plan = dropDependentsOfFailedReleases(plan, failedReleases);
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
  // Ein Paar kann mehrfach geprüft werden (Kandidaten und Vorgängerversion,
  // beide Richtungen). Ein Upsert-Batch darf jede Zeile nur einmal treffen,
  // sonst scheitert er ganz („ON CONFLICT DO UPDATE … a second time",
  // Live-Lauf 2026-10-09: 46 Batches). Der letzte Befund zählt.
  const byPair = new Map<string, LogPair>();
  for (const p of pairs) if (!p.breakdown.reason?.startsWith('manual_')) byPair.set(pairKey(p.aId, p.bId), p);
  const auto = [...byPair.values()];
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
  const stale: Array<{ id: string; event_a_id: string }> = [];
  await forEachPage<{ id: string; event_a_id: string; event_b_id: string }>(
    (from, to) => supabase
      .from('event_dedup_log')
      .select('id,event_a_id,event_b_id')
      .eq('decision', 'uncertain')
      .eq('decided_by', 'auto')
      .order('id')
      .range(from, to),
    (rows) => { for (const r of rows) if (!current.has(pairKey(r.event_a_id, r.event_b_id))) stale.push(r); },
    { label: 'dedup: Log lesen' },
  );
  // Ein Lauf eines Landes kennt die Paare des anderen nicht: nur eigene aufräumen.
  const staleIds = await ownCountryPairs(stale);
  for (let i = 0; i < staleIds.length; i += 200) {
    const { error } = await supabase.from('event_dedup_log').delete().in('id', staleIds.slice(i, i + 200));
    if (error) errors.push(`Log aufräumen: ${error.message}`);
  }
  console.log(`  Log: ${written} Paare geschrieben, ${staleIds.length} veraltete „uncertain" entfernt`);
  return written;
}

/** Log-Einträge, deren erste Zeile zum Land des Laufs gehört (ohne Land: alle;
 *  eine gelöschte Zeile darf jeder Lauf aufräumen). */
async function ownCountryPairs(rows: Array<{ id: string; event_a_id: string }>): Promise<string[]> {
  if (!COUNTRY) return rows.map(r => r.id);
  const countryOf = new Map<string, string>();
  const ids = [...new Set(rows.map(r => r.event_a_id))];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('events').select('id,country').in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`dedup: Land der Log-Paare: ${error.message}`);
    for (const r of (data ?? []) as Array<{ id: string; country: string }>) countryOf.set(r.id, r.country);
  }
  return rows.filter(r => !countryOf.has(r.event_a_id) || inRunCountry(countryOf.get(r.event_a_id), COUNTRY)).map(r => r.id);
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
  /** Ventil-Klasse eines neuen Duplikats (valveClass), zur Prüfung des Probelaufs. */
  valveClass?: ValveClass | null;
  createdAt?: string | null;
}

/** Höchstens so weit zurück gilt der Zulauf als Zulauf: bleibt der Anker
 *  stehen (Ventil-Stopps, Schreibfehler), zählt älterer Zulauf wieder als
 *  Bestand, statt dass ein wachsender Teil des Bestands unsichtbar wird. */
const MAX_ANCHOR_AGE_MS = 72 * 3_600_000;
/** Mehr Schreibfehler im Plan: der Lauf zählt nicht als geschrieben. */
const MAX_WRITE_ERRORS_FOR_WRITTEN = 20;

interface Anchor {
  /** Beginn des letzten geschriebenen Laufs (Datenbank-Uhr) oder null. */
  at: Date | null;
  /** Warum kein (voller) Anker gilt; landet im Grund eines Ventil-Stopps. */
  problem: string | null;
}

/** Anker des Ventils: Beginn des letzten Laufs, der den Plan dieses Landes
 *  geschrieben hat. Läufe ohne Land (vor fn-29.18) galten allen Ländern. */
async function loadAnchor(runStartedAt: Date, country: string): Promise<Anchor> {
  const { data, error } = await supabase
    .from('dedup_runs')
    .select('started_at')
    .eq('outcome', 'written')
    .or(`country.is.null,country.eq.${country}`)
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) return { at: null, problem: `Anker fehlt (dedup_runs: ${error.message}), jede neue Zeile zählt` };
  const last = data?.[0] ? new Date(data[0].started_at as string) : null;
  if (!last) return { at: null, problem: 'Anker fehlt (kein geschriebener Lauf), jede neue Zeile zählt' };
  const floor = new Date(runStartedAt.getTime() - MAX_ANCHOR_AGE_MS);
  if (last < floor) {
    return { at: floor, problem: `letzter geschriebener Lauf ${last.toISOString()} älter als 72 h, Zulauf davor zählt als Bestand` };
  }
  return { at: last, problem: null };
}

interface RunStats {
  newDuplicates: number;
  stock: number;
  inflow: number;
  series: number;
  repoints: number;
  releases: number;
  visibleReleases: number;
  garbage: number;
  writeErrors: number;
}

interface Runs {
  /** Laufzeile je Land. */
  ids: Map<string, string>;
  /** Beginn nach Datenbank-Uhr, für alle Länder derselbe. */
  startedAt: Date;
}

const githubRunId = () => (process.env.GITHUB_RUN_ID ? Number(process.env.GITHUB_RUN_ID) : null);

/** Laufzeilen je Land mit Beginn nach Datenbank-Uhr (created_at kommt auch
 *  von dort). Ein abgebrochener Lauf bleibt 'running' und verschiebt den
 *  Anker nicht. */
async function startRuns(): Promise<Runs | null> {
  const { data, error } = await supabase
    .from('dedup_runs')
    .insert(RUN_COUNTRIES.map(country => ({ outcome: 'running', country, github_run_id: githubRunId() })))
    .select('id,started_at,country');
  if (error || !data?.length) {
    console.warn(`  dedup_runs: Lauf nicht angelegt (${error?.message ?? 'keine Zeile'})`);
    return null;
  }
  const rows = data as Array<{ id: string; started_at: string; country: string }>;
  return { ids: new Map(rows.map(r => [r.country, r.id])), startedAt: new Date(rows[0].started_at) };
}

/** Ausgang je Land festhalten; ohne Eintrag zählt die nächste Nacht den
 *  Zulauf seit dem älteren Anker mit. Schreibfehler hier sind laut. */
async function finishRun(
  runs: Runs | null,
  country: string,
  fallbackStart: Date,
  outcome: 'written' | 'valve_stopped' | 'write_failed',
  r: RunStats,
  errors: string[],
): Promise<void> {
  const id = runs?.ids.get(country);
  const row = {
    outcome,
    finished_at: new Date().toISOString(),
    new_duplicates: r.newDuplicates,
    counted_new_duplicates: r.stock,
    inflow_duplicates: r.inflow,
    series_duplicates: r.series,
    repoints: r.repoints,
    releases: r.releases,
    visible_releases: r.visibleReleases,
    garbage: r.garbage,
    write_errors: r.writeErrors,
  };
  const { error } = id
    ? await supabase.from('dedup_runs').update(row).eq('id', id)
    : await supabase.from('dedup_runs').insert({ ...row, country, started_at: (runs?.startedAt ?? fallbackStart).toISOString(),
        github_run_id: githubRunId() });
  if (error) errors.push(`dedup_runs schreiben (${country}): ${error.message}`);
}

/** Plan, Ventil und Zahlen eines Landes. */
interface CountryResult {
  country: string;
  plan: DedupPlan;
  garbageIds: string[];
  anchor: Anchor;
  limits: Required<SafetyLimits>;
  stats: RunStats;
  violations: string[];
}

function mergePlans(plans: DedupPlan[]): DedupPlan {
  return {
    markDuplicate: plans.flatMap(p => p.markDuplicate),
    release: plans.flatMap(p => p.release),
    primaries: plans.flatMap(p => p.primaries),
  };
}

async function main(): Promise<void> {
  const started = Date.now();
  console.log(`=== Batch Dedup ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===`);
  const fmtLimits = (l: Required<SafetyLimits>) => `${l.maxNewDuplicates} neue Duplikate am Bestand, ${l.maxInflowDuplicates} im Zulauf, ${l.maxReleases} Freigaben, ${l.maxGarbage} Müll`;
  console.log(`  Grenzen je Land: ${fmtLimits(DEFAULT_LIMITS)}`);
  if (LIMITS_COUNTRY || JSON.stringify(RELEASED_LIMITS) !== JSON.stringify(DEFAULT_LIMITS)) {
    console.log(`  Freigabe ${LIMITS_COUNTRY ? `für ${LIMITS_COUNTRY}` : 'für alle Länder'}: ${fmtLimits(RELEASED_LIMITS)}`);
  }

  // Probeläufe schreiben nichts, auch keine Laufzeile.
  const runs = DRY_RUN ? null : await startRuns();
  const runStartedAt = runs?.startedAt ?? new Date(started);
  const garbageById = await scanGarbage();
  const garbage = garbageById.size;
  const manual = await loadManualDecisions();
  console.log(`  Manuelle Entscheidungen: ${manual.merges.size} merge, ${manual.splits.size} split`);

  console.log('\n--- Phase 2: Cluster je Wiener Tag neu berechnen ---');
  const { days: allDays, sourceLastSeen } = await getViennaDays();
  const days = allDays.filter(d => d >= START_DAY);
  console.log(`  ${days.length} Tage ab ${START_DAY} (${allDays.length - days.length} vergangene übersprungen), ${sourceLastSeen.size} Quellen`);

  let plan: DedupPlan = { markDuplicate: [], release: [], primaries: [] };
  // Alle geladenen Zeilen (auch anderer Tage) für die Ventil-Zählung.
  const allRows = new Map<string, EventRow>();
  const logPairs: LogPair[] = [];
  const reasons = new Map<string, number>();
  const report: ReportEntry[] = [];
  let scanned = 0, candidates = 0, clusters = 0, ambiguous = 0, blocked = 0, orphans = 0;
  const releaseReasons = new Map<string, number>();

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    // Müll nimmt am Dedup nicht teil: er wird nie Primary und verbirgt nichts.
    const events = (await loadEventsForDay(day)).filter(e => !isGarbage(e));
    scanned += events.length;
    if (events.length === 0) continue;

    const result = dedupDay(events, { manualMerges: manual.merges, manualSplits: manual.splits, sourceLastSeen, staleIds: STALE_IDS });
    const external = await loadExternalPrimaries(events);
    const dayPlan = planDedup(events, result.clusters, {
      sourceLastSeen,
      staleIds: STALE_IDS,
      manualSplits: manual.splits,
      externalPrimaries: external,
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

    // Auch Zeilen anderer Tage (verwaister Primary mit altem Datumsfehler).
    const byId = new Map([...external, ...events.map(e => [e.id, e] as const)]);
    for (const [id, e] of byId) allRows.set(id, e);
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

  const planned = plan.markDuplicate.length;
  plan = resolvePlanConflicts(plan);
  if (plan.markDuplicate.length < planned) {
    console.log(`  ${planned - plan.markDuplicate.length} tagesübergreifende Widersprüche verworfen`);
    const kept = new Set(plan.markDuplicate.map(m => `${m.id}>${m.primaryId}`));
    for (let i = report.length - 1; i >= 0; i--) {
      const r = report[i];
      if (r.action !== 'release' && !kept.has(`${r.id}>${r.primaryId}`)) report.splice(i, 1);
    }
  }
  const newDuplicates = plan.markDuplicate.filter(m => m.isNew).length;

  // Ventil je Land: eigener Anker, eigene Grenzen, eigene Laufzeile.
  const countryOf = (id: string) => allRows.get(id)?.country ?? garbageById.get(id) ?? FALLBACK_COUNTRY;
  const plansByCountry = splitPlanByCountry(plan, countryOf);
  const garbageByCountry = new Map<string, string[]>();
  for (const [id, c] of garbageById) garbageByCountry.set(c, [...(garbageByCountry.get(c) ?? []), id]);
  const countries = [...new Set([...RUN_COUNTRIES, ...plansByCountry.keys(), ...garbageByCountry.keys()])];
  const results: CountryResult[] = [];
  /** Ventil-Klasse je neuem Duplikat für den Bericht. */
  const classById = new Map<string, ValveClass | null>();
  for (const country of countries) {
    const cPlan = plansByCountry.get(country) ?? { markDuplicate: [], release: [], primaries: [] };
    const garbageIds = garbageByCountry.get(country) ?? [];
    const anchor = await loadAnchor(runStartedAt, country);
    const classify = (m: DedupPlan['markDuplicate'][number]) => valveClass(m, allRows, anchor.at);
    const byClass = new Map<ValveClass, number>();
    for (const m of cPlan.markDuplicate) {
      const c = classify(m);
      classById.set(`${m.id}>${m.primaryId}`, c);
      if (c) byClass.set(c, (byClass.get(c) ?? 0) + 1);
    }
    const cNew = cPlan.markDuplicate.filter(m => m.isNew).length;
    const limits = limitsFor(country);
    results.push({
      country, plan: cPlan, garbageIds, anchor, limits,
      stats: {
        newDuplicates: cNew,
        stock: byClass.get('stock') ?? 0,
        inflow: byClass.get('inflow') ?? 0,
        series: byClass.get('series') ?? 0,
        repoints: cPlan.markDuplicate.length - cNew,
        releases: cPlan.release.length,
        visibleReleases: cPlan.release.filter(r => r.visible !== false).length,
        garbage: garbageIds.length,
        writeErrors: 0,
      },
      violations: checkSafetyValve(cPlan, limits, garbageIds.length, classify),
    });
  }
  for (const r of report) {
    if (r.action === 'release') continue;
    r.valveClass = classById.get(`${r.id}>${r.primaryId}`) ?? null;
    r.createdAt = allRows.get(r.id)?.created_at ?? null;
  }
  const sum = (k: keyof RunStats) => results.reduce((n, r) => n + r.stats[k], 0);
  const stock = sum('stock');
  const inflow = sum('inflow');
  const series = sum('series');
  console.log('\n=== Plan ===');
  console.log(`  Events geprüft:        ${scanned}`);
  console.log(`  Kandidaten-Paare:      ${candidates}`);
  console.log(`  Cluster:               ${clusters}`);
  console.log(`  Neue Duplikate:        ${newDuplicates}  (am Bestand ${stock}, Zulauf ${inflow}, Basis hinter eigener Terminzeile ${series})`);
  console.log(`  Umgehängte Duplikate:  ${plan.markDuplicate.length - newDuplicates}`);
  console.log(`  Freigaben:             ${plan.release.length}  (${[...releaseReasons.entries()].map(([r, n]) => `${r} ${n}`).join(', ') || '–'})`);
  console.log(`  Verwaiste Zeilen:      ${orphans} (Quelle liefert sie nicht mehr; nie Gegenbeleg, nie freigegeben)`);
  console.log(`  Primary-Updates:       ${plan.primaries.length}`);
  console.log(`  Mehrdeutig verworfen:  ${ambiguous} Verbindungen`);
  console.log(`  Widerspruch im Cluster:${blocked} Verbindungen`);
  console.log('  Entscheidungen nach Grund:');
  for (const [r, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(7)}  ${r}`);
  console.log('  Je Land:');
  for (const r of results) {
    const s = r.stats;
    console.log(`    ${r.country}: neu ${s.newDuplicates} (Bestand ${s.stock}, Zulauf ${s.inflow}, Serie ${s.series}), umgehängt ${s.repoints}, Freigaben ${s.releases} (sichtbar ${s.visibleReleases}), Müll ${s.garbage}; Anker ${r.anchor.at?.toISOString() ?? 'keiner'}`);
    if (r.anchor.problem) console.log(`      !!! ${r.anchor.problem}`);
  }

  for (const action of ['duplicate', 'release'] as const) {
    const sample = report.filter(r => r.action === action).sort(() => Math.random() - 0.5).slice(0, 15);
    if (sample.length === 0) continue;
    console.log(`\n  Stichprobe ${action}:`);
    for (const s of sample) {
      console.log(`    ${s.day}  [${s.source}] ${s.title.slice(0, 60)}${s.primaryTitle ? `  →  [${s.primarySource}] ${s.primaryTitle.slice(0, 60)}` : ''}`);
    }
  }
  if (REPORT_PATH) {
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    const countryById = new Map([...allRows].map(([id, e]) => [id, e.country ?? FALLBACK_COUNTRY]));
    writeFileSync(REPORT_PATH, JSON.stringify({
      limits: Object.fromEntries(results.map(r => [r.country, r.limits])),
      perCountry: Object.fromEntries(results.map(r => [r.country, { ...r.stats, violations: r.violations, anchor: r.anchor }])),
      report: report.map(e => ({ ...e, country: countryById.get(e.id) ?? FALLBACK_COUNTRY })),
      reasons: Object.fromEntries(reasons),
    }, null, 1));
    console.log(`\n  Bericht: ${REPORT_PATH}`);
  }

  const stopped = results.filter(r => r.violations.length > 0);
  const passed = results.filter(r => r.violations.length === 0);
  const stopReasons = stopped.map(r => `${r.country}: ${[...r.violations, ...(r.anchor.problem ? [r.anchor.problem] : [])].join('; ')}`);
  for (const why of stopReasons) console.log(`\n!!! Sicherheitsventil ${why}`);

  const errors: string[] = [];
  if (!DRY_RUN) {
    if (stopped.length > 0) {
      console.log(`    Nicht geschrieben: ${stopped.map(r => r.country).join(', ')}. Probelauf prüfen (--dry-run --report …) und mit höheren Grenzen freigeben (--limits-country).`);
      for (const r of stopped) await finishRun(runs, r.country, runStartedAt, 'valve_stopped', r.stats, errors);
    }
    if (passed.length > 0) {
      console.log(`\n--- Phase 3: Schreiben (${passed.map(r => r.country).join(', ')}) ---`);
      const before = errors.length;
      await suppressGarbage(passed.flatMap(r => r.garbageIds));
      await applyPlan(mergePlans(passed.map(r => r.plan)), errors);
      const planErrors = errors.length - before;
      await writeLog(logPairs, errors);

      const { data: rewire, error: rewireErr } = await supabase.rpc('rewire_saved_events_to_primaries');
      if (rewireErr) errors.push(`Rewire saved_events: ${rewireErr.message}`);
      else if (Array.isArray(rewire) && rewire.length > 0) {
        const row = rewire[0] as { rewired_saved_events: number; rewired_artist_notifications: number };
        console.log(`  Rewired ${row.rewired_saved_events} saved_events + ${row.rewired_artist_notifications} notifications to primaries.`);
      }
      // Mit einzelnen Schreibfehlern ist der Plan geschrieben (der nächste Lauf
      // rechnet ohnehin alles neu). Scheitert ein größerer Teil, bleibt der
      // Anker stehen: der nicht verarbeitete Zulauf zählt sonst nie.
      const outcome = planErrors > MAX_WRITE_ERRORS_FOR_WRITTEN ? 'write_failed' : 'written';
      for (const r of passed) await finishRun(runs, r.country, runStartedAt, outcome, { ...r.stats, writeErrors: planErrors }, errors);
    }
  }

  console.log('\n=== Dedup Summary ===');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | Dauer ${((Date.now() - started) / 1000).toFixed(1)} s | Garbage ${garbage}`);
  const failures: string[] = [];
  if (!DRY_RUN && stopped.length > 0) failures.push(`Sicherheitsventil, nicht geschrieben: ${stopReasons.join(' | ')}`);
  if (errors.length > 0) {
    console.log(`  Fehler: ${errors.length}`);
    for (const err of errors.slice(0, 20)) console.log(`    - ${err}`);
    failures.push(`${errors.length} Schreibfehler, z. B. ${errors[0]}`);
  }
  if (failures.length > 0) {
    reportStepReason(failures.join('; '));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  reportStepReason(`Abbruch: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
