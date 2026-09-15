/**
 * DE→EN-Übersetzung über die OpenAI Batch API — Events und Freizeit-POIs.
 *
 * Löst den Gemini-Backfill (`translate-events-en.ts`,
 * `translate-activities-en.ts`) ab, seit Google das Cloud-Projekt des
 * Gemini-Keys gesperrt hat (403 seit 2026-09-09). Hintergrund, Modellwahl
 * und Kosten: Kopf von `src/lib/i18n/openai-batch.ts`.
 *
 * Ablauf eines Laufs:
 *   1. Batches, die ein früherer Lauf abgeschickt und nicht mehr
 *      eingesammelt hat (Deadline, Absturz), zuerst einsammeln.
 *   2. Dann in Schleife: Kandidaten holen (POIs zuerst, dann Events nach
 *      Startdatum), als JSONL hochladen, Batch anlegen, bis zum Abschluss
 *      pollen, Ergebnis in die DB schreiben. Bis der Rückstand leer ist
 *      oder die Deadline erreicht.
 *
 * Fortsetzbar: der Filter ist `title_en IS NULL` bzw.
 * `description_en IS NULL`; ein laufender Batch steht als Datei in
 * `<state-dir>/pending/` und wird vom nächsten Lauf abgeholt. Zeilen, die
 * zweimal scheitern (Qualitätsprüfung, Refusal, abgeschnitten), landen im
 * Versuchs-Register `attempts.json` und werden nicht mehr bezahlt.
 *
 * Usage:
 *   npm run translate:batch -- --dry-run                  # JSONL bauen, nichts hochladen
 *   npm run translate:batch -- --batch-size 300 --max-batches 1
 *   npm run translate:batch -- --status                   # offene Batches anzeigen
 *
 * Auf dem Server (Env in /opt/app/.env, State-Volume /state):
 *   npx tsx src/scripts/translate-openai-batch.ts --state-dir /state/openai-batches
 */

import OpenAI, { toFile } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fetchActivityCandidates, fetchCandidates, MIN_QUALITY_SCORE } from '../lib/i18n/translate-batch';
import {
  activityDescriptionFromContent,
  activityWorthTranslating,
  buildActivityRequest,
  buildEventRequest,
  customId,
  DEFAULT_MODEL,
  estimateCostUsd,
  eventDescription,
  eventPatchFromContent,
  MAX_ATTEMPTS,
  parseCustomId,
  parseOutputLine,
  qualityIssue,
  RETRY_MODEL,
  toJsonl,
  type BatchRequestLine,
  type BatchState,
  type OutputLine,
  type TokenUsage,
} from '../lib/i18n/openai-batch';
import { finishWorkflowRun, startWorkflowRun } from '../lib/reporting/workflow-run';

// ── Argumente ─────────────────────────────────────────────────────────

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

const dryRun = process.argv.includes('--dry-run');
const statusOnly = process.argv.includes('--status');
const stateDir = arg('state-dir') ?? 'state/openai-batches';
/**
 * Zeilen je Batch. 4 000 Events sind ~1,3 M Input-Tokens — unter dem
 * Warteschlangen-Limit der unteren Tiers (2 M). Wird das Limit trotzdem
 * gerissen, halbiert `submit` selbst.
 */
let batchSize = Number(arg('batch-size') ?? 4000);
const deadlineMin = Number(arg('deadline-min') ?? 150);
const pollSec = Number(arg('poll-sec') ?? 60);
const maxBatches = Number(arg('max-batches') ?? Number.MAX_SAFE_INTEGER);

const openaiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!openaiKey) {
  console.error('ERROR: OPENAI_API_KEY fehlt.');
  process.exit(1);
}
if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.');
  process.exit(1);
}

const client = new OpenAI({ apiKey: openaiKey });
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const startedAt = Date.now();
const deadlineAt = startedAt + deadlineMin * 60_000;
const deadlineHit = () => Date.now() >= deadlineAt;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const fmt = (n: number) => n.toLocaleString('de-AT');

// ── State auf Platte ──────────────────────────────────────────────────

const pendingDir = join(stateDir, 'pending');
const doneDir = join(stateDir, 'done');
const ledgerPath = join(stateDir, 'attempts.json');
for (const d of [pendingDir, doneDir]) mkdirSync(d, { recursive: true });

/** custom_id → Anzahl gescheiterter Versuche. */
type Ledger = Record<string, number>;
const ledger: Ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};
const saveLedger = () => writeFileSync(ledgerPath, JSON.stringify(ledger));

function loadPending(): BatchState[] {
  return readdirSync(pendingDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => JSON.parse(readFileSync(join(pendingDir, f), 'utf8')) as BatchState);
}
const savePending = (s: BatchState) => writeFileSync(join(pendingDir, `${s.batchId}.json`), JSON.stringify(s));
function markDone(s: BatchState, result: Record<string, unknown>) {
  writeFileSync(join(doneDir, `${s.batchId}.json`), JSON.stringify({ ...s, customIds: s.customIds.length, result }, null, 2));
  renameSync(join(pendingDir, `${s.batchId}.json`), join(doneDir, `${s.batchId}.input.json`));
}

// ── Zählwerk für den Bericht ──────────────────────────────────────────

const totals = {
  batches: 0,
  requests: 0,
  translated: 0,
  quality: 0,
  failed: 0,
  gaveUp: 0,
  usage: { input: 0, output: 0 } as TokenUsage,
  costUsd: 0,
  costKnown: true,
};
const errorKinds = new Map<string, number>();
const errors: string[] = [];
let backlogEmpty = false;
let leftPending = false;

function countKind(reason: string) {
  errorKinds.set(reason, (errorKinds.get(reason) ?? 0) + 1);
}

// ── Kandidaten ────────────────────────────────────────────────────────

interface Candidate {
  line: (model: string) => BatchRequestLine;
  cid: string;
}

/**
 * Holt bis zu `n` Zeilen. Zeilen mit einem gescheiterten Versuch kommen in
 * die Retry-Gruppe (anderes Modell, eigener Batch), Zeilen am Limit werden
 * übersprungen. POIs zuerst: es sind wenige, und jede übersetzte
 * Beschreibung schaltet sofort eine /en-URL frei.
 */
async function collectCandidates(n: number): Promise<{ first: Candidate[]; retry: Candidate[] }> {
  const first: Candidate[] = [];
  const retry: Candidate[] = [];
  const gaveUpIds = new Set(
    Object.entries(ledger).filter(([, c]) => c >= MAX_ATTEMPTS).map(([cid]) => parseCustomId(cid)?.id ?? ''),
  );
  const take = (cid: string, line: Candidate['line']) => {
    if ((ledger[cid] ?? 0) >= MAX_ATTEMPTS) return;
    (ledger[cid] ? retry : first).push({ cid, line });
  };

  let offset = 0;
  while (first.length < n) {
    const { rows, rawCount } = await fetchActivityCandidates(supabase, 500, offset);
    if (rawCount === 0) break;
    offset += rawCount;
    for (const row of rows) {
      if (!activityWorthTranslating(row.description)) continue;
      const description = row.description;
      take(customId('poi', row.id), model => buildActivityRequest({ id: row.id, name: row.name, description }, model));
    }
  }

  offset = 0;
  while (first.length < n) {
    const { rows, rawCount } = await fetchCandidates(supabase, 500, gaveUpIds, offset);
    if (rawCount === 0) break;
    offset += rawCount;
    for (const row of rows) {
      if (!row.title) continue;
      const title = row.title;
      take(customId('event', row.id), model =>
        buildEventRequest({ id: row.id, title, description: row.description }, model));
    }
  }
  return { first: first.slice(0, n), retry: retry.slice(0, n) };
}

// ── Abschicken ────────────────────────────────────────────────────────

/** Grobe Schätzung für die Log-Zeile — abgerechnet werden die echten Tokens. */
function estimateTokens(lines: BatchRequestLine[]): number {
  return lines.reduce((sum, l) => {
    const msgs = l.body.messages as Array<{ content: string }>;
    return sum + msgs.reduce((s, m) => s + m.content.length / 4, 0) + 20;
  }, 0);
}

async function submit(candidates: Candidate[], attempt: number): Promise<BatchState | null> {
  const model = attempt === 1 ? DEFAULT_MODEL : RETRY_MODEL;
  let rows = candidates;

  for (;;) {
    const lines = rows.map(c => c.line(model));
    const jsonl = toJsonl(lines);
    console.log(
      `  → Batch: ${fmt(lines.length)} Anfragen, ${model}, Versuch ${attempt}, ` +
      `~${fmt(Math.round(estimateTokens(lines) / 1000))}k Input-Tokens, ${fmt(Math.round(jsonl.length / 1024))} KB`,
    );
    if (dryRun) {
      const sample = join(stateDir, 'dry-run.jsonl');
      writeFileSync(sample, jsonl);
      console.log(`  DRY RUN — JSONL liegt in ${sample}, nichts hochgeladen.`);
      return null;
    }

    const file = await client.files.create({
      file: await toFile(Buffer.from(jsonl, 'utf8'), `translate-${Date.now()}.jsonl`),
      purpose: 'batch',
    });
    try {
      const batch = await client.batches.create({
        input_file_id: file.id,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
        metadata: { project: 'lasstreffen-i18n', attempt: String(attempt), rows: String(lines.length) },
      });
      const state: BatchState = {
        batchId: batch.id,
        inputFileId: file.id,
        model,
        createdAt: new Date().toISOString(),
        customIds: lines.map(l => l.custom_id),
        attempt,
      };
      savePending(state);
      console.log(`  ✓ ${batch.id} angelegt (${batch.status})`);
      return state;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Warteschlangen-Limit des Tiers: kleiner probieren statt aufgeben.
      if (/enqueued token limit|token_limit_exceeded/i.test(msg) && rows.length > 100) {
        rows = rows.slice(0, Math.floor(rows.length / 2));
        batchSize = rows.length;
        console.log(`  Warteschlangen-Limit erreicht — halbiere auf ${fmt(rows.length)} Zeilen.`);
        await client.files.delete(file.id).catch(() => undefined);
        continue;
      }
      throw err;
    }
  }
}

// ── Einsammeln ────────────────────────────────────────────────────────

const FINAL = new Set(['completed', 'failed', 'expired', 'cancelled']);

/**
 * Wartet auf den Batch und verbucht ihn. Rückgabe false, wenn die Deadline
 * vorher zuschlug — dann bleibt die State-Datei liegen und der nächste
 * Lauf holt ihn ab.
 */
async function awaitAndCollect(state: BatchState): Promise<boolean> {
  let batch = await client.batches.retrieve(state.batchId);
  let lastLine = '';
  while (!FINAL.has(batch.status)) {
    if (deadlineHit()) {
      console.log(`  Deadline — ${state.batchId} bleibt offen (${batch.status}).`);
      leftPending = true;
      return false;
    }
    // Das Log landet in einer Datei, nicht auf einem Terminal: nur bei
    // Aenderung eine neue Zeile, sonst still warten.
    const c = batch.request_counts;
    const line = `  ${state.batchId}: ${batch.status}` + (c ? ` · ${fmt(c.completed)}/${fmt(c.total)} fertig, ${fmt(c.failed)} Fehler` : '');
    if (line !== lastLine) {
      console.log(`${line} · ${new Date().toISOString().slice(11, 19)}Z`);
      lastLine = line;
    }
    await sleep(pollSec * 1000);
    batch = await client.batches.retrieve(state.batchId);
  }
  console.log(`  ${state.batchId}: ${batch.status}`);

  // Batch-weit gescheitert (ungültige Datei o. ä.): nichts wurde bezahlt,
  // nichts zählt als Versuch — aber der Lauf darf so nicht weiterdrehen.
  if (batch.status === 'failed' || batch.status === 'cancelled') {
    const detail = (batch.errors?.data ?? []).map(e => `${e.code ?? ''} ${e.message ?? ''}`.trim()).join('; ');
    const msg = `Batch ${state.batchId} ${batch.status}: ${detail || 'ohne Fehlerdetail'}`;
    errors.push(msg);
    markDone(state, { status: batch.status, detail });
    throw new Error(msg);
  }

  // Ausgabe- und Fehlerdatei zusammenführen. Ein abgelaufener Batch
  // (expired) hat beides: die fertigen Zeilen und die nicht mehr
  // bearbeiteten — bezahlt sind nur die fertigen.
  const results = new Map<string, OutputLine>();
  for (const fileId of [batch.output_file_id, batch.error_file_id]) {
    if (!fileId) continue;
    const text = await (await client.files.content(fileId)).text();
    for (const raw of text.split('\n')) {
      if (!raw.trim()) continue;
      const line = parseOutputLine(raw);
      if (line) results.set(line.customId, line);
    }
  }

  const usage: TokenUsage = { input: 0, output: 0 };
  const ok: Array<{ cid: string; content: string }> = [];
  let failed = 0;
  const fail = (cid: string, reason: string) => {
    failed++;
    countKind(reason);
    ledger[cid] = Math.max(ledger[cid] ?? 0, state.attempt);
  };

  for (const cid of state.customIds) {
    const line = results.get(cid);
    if (!line) {
      // Abgelaufen, ohne je bearbeitet zu werden: kein Versuch verbraucht.
      countKind('keine Antwort (Batch abgelaufen)');
      failed++;
      continue;
    }
    usage.input += line.usage.input;
    usage.output += line.usage.output;
    if (line.ok) ok.push({ cid, content: line.content });
    else fail(cid, line.reason);
  }

  const written = await writeTranslations(ok, fail);

  const cost = estimateCostUsd(state.model, usage);
  totals.batches++;
  totals.requests += state.customIds.length;
  totals.translated += written.translated;
  totals.quality += written.quality;
  totals.failed += failed;
  totals.usage.input += usage.input;
  totals.usage.output += usage.output;
  if (cost === null) totals.costKnown = false;
  else totals.costUsd += cost;
  saveLedger();

  console.log(
    `  ✓ ${fmt(written.translated)} übersetzt · ${fmt(written.quality)} Qualität · ${fmt(failed)} Fehler · ` +
    `Tokens ${fmt(usage.input)}/${fmt(usage.output)}` + (cost !== null ? ` · ~${cost.toFixed(3)} $` : ''),
  );
  markDone(state, { status: batch.status, ...written, failed, usage, costUsd: cost });
  return true;
}

/**
 * Schreibt die gelungenen Übersetzungen. Vorher die Quelltexte aus der DB
 * nachlesen — die Qualitätsprüfung vergleicht Länge und Sprache mit dem
 * Original. supabase-js wirft bei Schreibfehlern nicht, `error` wird
 * deshalb explizit geprüft.
 */
async function writeTranslations(
  ok: Array<{ cid: string; content: string }>,
  fail: (cid: string, reason: string) => void,
): Promise<{ translated: number; quality: number }> {
  let quality = 0;
  const rejectQuality = (cid: string, issue: string) => {
    quality++;
    fail(cid, `Qualität: ${issue}`);
  };
  const byKind = { event: new Map<string, string>(), poi: new Map<string, string>() };
  for (const { cid, content } of ok) {
    const parsed = parseCustomId(cid);
    if (parsed) byKind[parsed.kind].set(parsed.id, content);
  }

  const patches: Array<{ table: 'events' | 'poi_activities'; id: string; cid: string; patch: Record<string, unknown> }> = [];
  const now = new Date().toISOString();

  for (const ids of chunks([...byKind.event.keys()], 100)) {
    const { data, error } = await supabase.from('events').select('id, title, description').in('id', ids);
    if (error) throw new Error(`Quelltexte (events) nicht lesbar: ${error.message}`);
    for (const row of data ?? []) {
      const cid = customId('event', row.id);
      const desc = eventDescription(row.description);
      const r = eventPatchFromContent(byKind.event.get(row.id)!, desc !== null);
      if ('reason' in r) {
        fail(cid, r.reason);
        continue;
      }
      const issue = desc && r.patch.description_en ? qualityIssue(desc, r.patch.description_en) : null;
      if (issue) {
        rejectQuality(cid, issue);
        continue;
      }
      patches.push({ table: 'events', id: row.id, cid, patch: { ...r.patch, translated_at: now } });
    }
  }

  for (const ids of chunks([...byKind.poi.keys()], 100)) {
    const { data, error } = await supabase.from('poi_activities').select('id, description').in('id', ids);
    if (error) throw new Error(`Quelltexte (poi_activities) nicht lesbar: ${error.message}`);
    for (const row of data ?? []) {
      const cid = customId('poi', row.id);
      const r = activityDescriptionFromContent(byKind.poi.get(row.id)!);
      if ('reason' in r) {
        fail(cid, r.reason);
        continue;
      }
      const issue = qualityIssue(row.description ?? '', r.description_en);
      if (issue) {
        rejectQuality(cid, issue);
        continue;
      }
      patches.push({ table: 'poi_activities', id: row.id, cid, patch: { description_en: r.description_en, translated_at: now } });
    }
  }

  let translated = 0;
  let next = 0;
  const worker = async () => {
    for (let p = patches[next++]; p; p = patches[next++]) {
      const { error } = await supabase.from(p.table).update(p.patch).eq('id', p.id);
      if (error) fail(p.cid, `DB-Write: ${error.message}`);
      else translated++;
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return { translated, quality };
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Rückstand für den Bericht ─────────────────────────────────────────

async function openCounts(): Promise<{ events: number | null; pois: number | null }> {
  const today = new Date().toISOString().slice(0, 10);
  // count: 'planned' — ein exakter COUNT über events läuft in den
  // statement_timeout (CLAUDE.md, Bekannte Issues).
  const { count: events } = await supabase
    .from('events')
    .select('id', { count: 'planned', head: true })
    .is('title_en', null)
    .gte('start_date', today)
    .eq('publish_status', 'published')
    .gte('quality_score', MIN_QUALITY_SCORE);
  // POIs unter 200 Zeichen werden nie uebersetzt (Indexierungs-Gate) und
  // duerfen nicht als "offen" zaehlen — sonst steht da fuer immer ~900.
  let pois = 0;
  for (let offset = 0; ; ) {
    const { rows, rawCount } = await fetchActivityCandidates(supabase, 500, offset);
    if (rawCount === 0) break;
    offset += rawCount;
    pois += rows.filter(r => activityWorthTranslating(r.description)).length;
  }
  return { events: events ?? null, pois };
}

// ── Hauptprogramm ─────────────────────────────────────────────────────

async function showStatus() {
  const pending = loadPending();
  if (pending.length === 0) {
    console.log('Keine offenen Batches.');
    return;
  }
  for (const s of pending) {
    const b = await client.batches.retrieve(s.batchId);
    const c = b.request_counts;
    console.log(
      `${s.batchId}  ${b.status.padEnd(12)} ${s.model}  Versuch ${s.attempt}  ` +
      `${fmt(s.customIds.length)} Zeilen` + (c ? `  ${fmt(c.completed)} fertig / ${fmt(c.failed)} Fehler` : '') +
      `  seit ${s.createdAt}`,
    );
  }
}

async function main() {
  if (statusOnly) {
    await showStatus();
    return;
  }

  console.log('─── Übersetzung DE → EN via OpenAI Batch API ' + '─'.repeat(20));
  console.log(`  Modell:        ${DEFAULT_MODEL} (Retry: ${RETRY_MODEL})`);
  console.log(`  Batch-Größe:   ${fmt(batchSize)} Zeilen`);
  console.log(`  Deadline:      ${deadlineMin} min`);
  console.log(`  State:         ${stateDir}`);
  console.log(`  Modus:         ${dryRun ? 'DRY RUN (kein Upload, kein Write)' : 'schreibend'}`);
  console.log('─'.repeat(64));

  const runId = dryRun ? null : await startWorkflowRun('translate-openai-batch');
  let status: 'success' | 'partial' | 'failed' = 'success';

  try {
    // 1. Verwaiste Batches früherer Läufe.
    for (const state of loadPending()) {
      console.log(`Offener Batch aus früherem Lauf: ${state.batchId}`);
      if (!(await awaitAndCollect(state))) break;
    }

    // 2. Neue Batches, bis der Rückstand leer ist oder die Zeit um.
    while (!deadlineHit() && !leftPending && totals.batches < maxBatches) {
      const { first, retry } = await collectCandidates(batchSize);
      const group = first.length > 0 ? first : retry;
      const attempt = first.length > 0 ? 1 : 2;
      if (group.length === 0) {
        backlogEmpty = true;
        break;
      }
      const state = await submit(group, attempt);
      if (!state) break; // dry run
      if (!(await awaitAndCollect(state))) break;
    }
  } catch (err) {
    status = 'failed';
    const msg = err instanceof Error ? err.message : String(err);
    if (!errors.includes(msg)) errors.push(msg);
    console.error('\nERROR:', msg);
  }

  totals.gaveUp = Object.values(ledger).filter(c => c >= MAX_ATTEMPTS).length;
  const open = dryRun ? { events: null, pois: null } : await openCounts();
  const cost = totals.costKnown ? `~${totals.costUsd.toFixed(3)} $` : 'unbekannt (Modellpreis nicht hinterlegt)';

  console.log('─'.repeat(64));
  console.log(`  Batches:       ${fmt(totals.batches)}  (${fmt(totals.requests)} Anfragen)`);
  console.log(`  übersetzt:     ${fmt(totals.translated)}`);
  console.log(`  Qualität:      ${fmt(totals.quality)}  (zurückgestellt, nächster Versuch mit ${RETRY_MODEL})`);
  console.log(`  Fehler:        ${fmt(totals.failed - totals.quality)}`);
  console.log(`  aufgegeben:    ${fmt(totals.gaveUp)}  (insgesamt, nach ${MAX_ATTEMPTS} Versuchen)`);
  console.log(`  Tokens:        ${fmt(totals.usage.input)} in / ${fmt(totals.usage.output)} out`);
  console.log(`  Kosten:        ${cost}`);
  console.log(`  noch offen:    Events ~${open.events ?? '?'}, POIs ${open.pois ?? '?'}`);
  console.log(`  Dauer:         ${((Date.now() - startedAt) / 60_000).toFixed(1)} min`);
  if (errorKinds.size > 0) {
    console.log('  Fehlerursachen:');
    for (const [reason, count] of [...errorKinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`    ${String(count).padStart(6)} × ${reason}`);
    }
  }

  if (status !== 'failed' && totals.failed > 0) status = 'partial';
  const ende = backlogEmpty
    ? 'Rückstand abgearbeitet.'
    : leftPending
      ? 'Ein Batch läuft noch bei OpenAI und wird vom nächsten Lauf eingesammelt.'
      : deadlineHit()
        ? 'Deadline erreicht, der nächste Lauf macht weiter.'
        : '';
  await finishWorkflowRun(runId, {
    status,
    summary:
      `${fmt(totals.translated)} Zeilen übersetzt in ${fmt(totals.batches)} Batch${totals.batches === 1 ? '' : 'es'}` +
      (totals.failed > 0 ? `, ${fmt(totals.failed)} zurückgestellt` : '') +
      `, Kosten ${cost}. ${ende}`.trimEnd(),
    metrics: {
      'Batches': totals.batches,
      'Anfragen': totals.requests,
      'Übersetzt': totals.translated,
      'Qualitätsprüfung nicht bestanden': totals.quality,
      'Sonstige Fehler': totals.failed - totals.quality,
      'Endgültig aufgegeben (gesamt)': totals.gaveUp,
      'Tokens Input': totals.usage.input,
      'Tokens Output': totals.usage.output,
      'Kosten (USD, Batch-Preis)': totals.costKnown ? totals.costUsd.toFixed(3) : '?',
      'Modell': `${DEFAULT_MODEL} / Retry ${RETRY_MODEL}`,
      'Noch offen: Events (geschätzt)': open.events ?? '?',
      'Noch offen: POIs': open.pois ?? '?',
      'Dauer (min)': Math.round((Date.now() - startedAt) / 60_000),
    },
    errors: [
      ...errors,
      ...[...errorKinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([r, c]) => `${c} × ${r}`),
    ],
  });

  if (status === 'failed') process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nERROR:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
