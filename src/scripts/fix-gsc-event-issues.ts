/**
 * fix-gsc-event-issues.ts — gezielter Fix nur für Events aus dem GSC-Bericht.
 *
 * Hintergrund: Google Search Console "Darstellung von Elementen verbessern"
 * meldete für ein Sample von ~1000 Events fehlende JSON-LD Felder
 * (endDate, address, description, price). Statt einer kompletten
 * enrichment-Re-Run von 67k Events (~$70 / verschwendet weil Tags etc.
 * schon korrekt sind) macht dieses Script nur **diese eine Liste**.
 *
 * Workflow:
 *   1. Lese URLs aus data/gsc-issue-urls.txt (eine pro Zeile)
 *   2. Parse jede URL → (postal_code, start_date::date, slug)
 *   3. Query Events-Tabelle nach (postal_code, start_date, slug)
 *   4. Filter: nur Events bei denen mindestens ein Stamm-Feld fehlt
 *      (description, end_date, address)
 *   5. Pro Event: fetch source_url, OpenAI focused-prompt (nur 3 Felder)
 *   6. Validate Output (Datum-Sanity, Adresse-Format)
 *   7. Bulk-Update via bulk_update_event_enrichment RPC (sparse, nur die
 *      Felder die wir wirklich füllen)
 *
 * Im Gegensatz zu enrich-openai.ts:
 *   - kein ENRICHMENT_VERSION-Bump (Tags/Audience/etc. bleiben unangetastet)
 *   - viel kürzerer System-Prompt (~500 statt ~2500 Tokens)
 *   - billiger pro Event (~$0.0003 statt $0.001)
 *   - überschreibt KEINE existierenden Werte (Sparse-Update)
 *
 * Usage:
 *   npx tsx --env-file=.env.local src/scripts/fix-gsc-event-issues.ts
 *   npx tsx --env-file=.env.local src/scripts/fix-gsc-event-issues.ts --dry-run
 *   npx tsx --env-file=.env.local src/scripts/fix-gsc-event-issues.ts --input data/my-urls.txt --limit 50
 *   npx tsx --env-file=.env.local src/scripts/fix-gsc-event-issues.ts --concurrency 4 --no-fetch
 */
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import OpenAI from 'openai';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetchEventPage, closeSharedBrowser } from '../lib/category-classifier/fetch-page';
import { makeBulkUpdater } from '../lib/db/bulk-update';

// ─── env load (tsx without --env-file) ───────────────────────────────
try {
  const envPath = join(process.cwd(), '.env.local');
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.substring(0, i).trim();
    const v = t.substring(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* env already set externally */ }

interface CliOpts {
  input: string;
  dryRun: boolean;
  noFetch: boolean;
  concurrency: number;
  model: string;
  limit: number;
  logFile: string | null;
}

function parseArgs(): CliOpts {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
  };
  const has = (flag: string): boolean => args.includes(flag);

  return {
    input: get('--input') ?? 'data/gsc-issue-urls.txt',
    dryRun: has('--dry-run'),
    noFetch: has('--no-fetch'),
    concurrency: parseInt(get('--concurrency') ?? '6', 10),
    model: get('--model') ?? 'gpt-5-mini',
    limit: parseInt(get('--limit') ?? String(Number.MAX_SAFE_INTEGER), 10),
    logFile: get('--log') ?? null,
  };
}

interface UrlParts {
  postal_code: string;
  date: string;       // YYYY-MM-DD
  slug: string;
  url: string;        // original
}

/**
 * Parse `https://lasstreffen.at/events/3370-ybbs-an-der-donau/2026-05-08/yoga-in-ybbs-ybbs-an-der-donau`
 * → { postal_code:'3370', date:'2026-05-08', slug:'yoga-in-ybbs-ybbs-an-der-donau' }
 *
 * Tolerant: ignores other URL formats (legacy /events/{id}-{slug} → returns null).
 */
function parseEventUrl(url: string): UrlParts | null {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    // ['events', '{plz}-{ort}', '{date}', '{slug}']
    if (segs.length !== 4 || segs[0] !== 'events') return null;
    const plzPart = segs[1].split('-')[0];
    if (!/^\d{4}$/.test(plzPart)) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(segs[2])) return null;
    return { postal_code: plzPart, date: segs[2], slug: segs[3], url };
  } catch {
    return null;
  }
}

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  address: string | null;
  location_name: string | null;
  source_url: string | null;
  price_text: string | null;
  price_min: number | null;
}

// ─── OpenAI ──────────────────────────────────────────────────────────

const FOCUSED_PROMPT = `Du extrahierst aus dem Quelltext einer österreichischen Event-Seite GENAU vier strukturelle Felder. Gib EIN JSON-Objekt zurück (kein Markdown, keine Code-Fences). Wenn du ein Feld nicht eindeutig aus dem Text ableiten kannst → null.

FIELDS:

1. end_date_iso — ISO-8601 String mit Zeitzone (z. B. "2026-05-22T22:00:00+02:00").
   Akzeptiere wenn der Quelltext eindeutig eine Endzeit oder ein Endedatum nennt:
     • "von 18:00 bis 22:00" → end = Start-Datum + 22:00 lokal
     • "20.-22. Mai 2026" → end = 22. Mai, gleiche Endzeit wie Start
     • "ganztägig" / "den ganzen Tag" → end = 23:59 lokal des Tages
   Wenn nur eine Start-Zeit ohne Ende erkennbar: null.

2. address — Plain-text Hausadresse mit Straße + Hausnummer.
   Beispiele: "Eisenstädter Straße 27", "Kreuzäckerweg 14, 2485 Wimpassing".
   KEINE Telefonnummern, KEINE Bushaltestellen, KEINE bloßen Ortsnamen ohne Hausnummer.
   Wenn nur Ortsname (z. B. "Wimpassing"): null.

3. description — saubere 100-300 Zeichen Beschreibung in natürlichem Deutsch.
   Ohne HTML-Tags, ohne Marketing-Geschwurbel ("einmaliges Event!"), ohne Links.
   Falls kein Quelltext oder unbrauchbar (Cookie-Banner, 404, leer): null.

4. price_text — Preisangabe als Plain-text wie sie auf der Seite steht.
   Beispiele:
     • "Eintritt frei" / "Kostenlos" / "Gratis" → "Eintritt frei"
     • "Erwachsene 15€, Kinder 8€" → "Erwachsene 15 €, Kinder 8 €"
     • "ab 25 EUR" / "Tickets ab 25€" → "ab 25 €"
     • "Spende erbeten" / "Freie Spende" → "Spende erbeten"
     • Klassischer Pfarrfest/Frühschoppen/Kirtag-Hinweis ohne Preis-Erwähnung → "Eintritt frei"
       (österreichische Convention: Gemeinde-/Pfarr-/Feuerwehr-Veranstaltungen sind
       fast immer kostenlos, das wird oft NICHT explizit erwähnt)
   Wenn der Quelltext IRGENDEINE Preis-Information enthält → extrahiere sie.
   Wenn KEIN Preis-Hinweis UND kein Indiz auf ein Frei-Event: null.
   Erfinde KEINEN Preis. Lieber null als geraten.

Output-Schema:
  { "end_date_iso": string|null, "address": string|null, "description": string|null, "price_text": string|null }`;

const OPENAI_SCHEMA = {
  name: 'gsc_structural_fix',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      end_date_iso: { type: ['string', 'null'] },
      address: { type: ['string', 'null'] },
      description: { type: ['string', 'null'] },
      price_text: { type: ['string', 'null'] },
    },
    required: ['end_date_iso', 'address', 'description', 'price_text'],
    additionalProperties: false,
  },
} as const;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60_000,
  maxRetries: 3,
});

interface ExtractResult {
  end_date_iso: string | null;
  address: string | null;
  description: string | null;
  price_text: string | null;
  tokens_in: number;
  tokens_out: number;
}

async function callOpenAI(model: string, userMsg: string): Promise<ExtractResult | null> {
  const isReasoning = /^(gpt-5|o\d)/.test(model);
  const params: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: FOCUSED_PROMPT },
      { role: 'user', content: userMsg },
    ],
    response_format: { type: 'json_schema', json_schema: OPENAI_SCHEMA },
  };
  if (isReasoning) {
    params.max_completion_tokens = 1000;
    params.reasoning_effort = 'minimal';
  } else {
    params.max_tokens = 600;
    params.temperature = 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp: any = await openai.chat.completions.create(params as any);
  const content = resp?.choices?.[0]?.message?.content ?? '';
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return {
      end_date_iso: typeof parsed.end_date_iso === 'string' ? parsed.end_date_iso : null,
      address: typeof parsed.address === 'string' ? parsed.address : null,
      description: typeof parsed.description === 'string' ? parsed.description : null,
      price_text: typeof parsed.price_text === 'string' ? parsed.price_text : null,
      tokens_in: resp.usage?.prompt_tokens ?? 0,
      tokens_out: resp.usage?.completion_tokens ?? 0,
    };
  } catch {
    return null;
  }
}

// ─── Validation ──────────────────────────────────────────────────────

function validateEndDate(iso: string | null, startDate: string | null): string | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (isNaN(end.getTime())) return null;
  if (!startDate) return null;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;
  // sanity: end within -0.1 .. +14 days of start
  const dayDiff = (end.getTime() - start.getTime()) / 86_400_000;
  if (dayDiff < -0.1 || dayDiff > 14) return null;
  return end.toISOString();
}

function validateAddress(s: string | null): string | null {
  if (!s) return null;
  const trimmed = s.replace(/\u0000/g, '').replace(/\\u0000/g, '').trim();
  if (trimmed.length < 5 || trimmed.length > 200) return null;
  // Must contain at least one letter and one digit (street + house number)
  if (!/[A-Za-zÄÖÜäöüß]/.test(trimmed) || !/\d/.test(trimmed)) return null;
  return trimmed;
}

function validateDescription(s: string | null): string | null {
  if (!s) return null;
  const cleaned = s.replace(/\u0000/g, '').replace(/\\u0000/g, '').replace(/<[^>]+>/g, '').trim();
  if (cleaned.length < 40 || cleaned.length > 600) return null;
  return cleaned.slice(0, 500);
}

/**
 * Akzeptiert Preisangaben als plain-text. Damit price_text auch ohne Zahl
 * (Eintritt frei / Spende erbeten / Gratis) durchgeht prüfen wir entweder
 * "Frei-Wort" ODER "enthält Ziffer". Sonst ist der String unbrauchbar.
 */
function validatePrice(s: string | null): string | null {
  if (!s) return null;
  const cleaned = s.replace(/\\u0000/g, '').trim();
  if (cleaned.length < 3 || cleaned.length > 200) return null;
  const lower = cleaned.toLowerCase();
  const isFreeText = /\b(frei|gratis|kostenlos|free|spende)\b/.test(lower);
  const hasNumber = /\d/.test(cleaned);
  if (!isFreeText && !hasNumber) return null;
  return cleaned;
}

// ─── Main ────────────────────────────────────────────────────────────

interface Stats {
  urls_total: number;
  url_unparseable: number;
  events_matched: number;
  events_complete_skipped: number;
  events_no_source_url: number;
  fetch_ok: number;
  fetch_failed: number;
  ai_called: number;
  ai_failed: number;
  filled_end_date: number;
  filled_address: number;
  filled_description: number;
  filled_price: number;
  filled_nothing: number;
  tokens_in: number;
  tokens_out: number;
  started_at: number;
}

function newStats(): Stats {
  return {
    urls_total: 0, url_unparseable: 0,
    events_matched: 0, events_complete_skipped: 0, events_no_source_url: 0,
    fetch_ok: 0, fetch_failed: 0,
    ai_called: 0, ai_failed: 0,
    filled_end_date: 0, filled_address: 0, filled_description: 0, filled_price: 0, filled_nothing: 0,
    tokens_in: 0, tokens_out: 0,
    started_at: Date.now(),
  };
}

const PRICING_PER_M = {
  'gpt-5-nano':  { in: 0.05, out: 0.40 },
  'gpt-4.1-nano': { in: 0.10, out: 0.40 },
  'gpt-4o-mini': { in: 0.15, out: 0.60 },
  'gpt-5-mini':  { in: 0.25, out: 2.00 },
} as const;

function estimateCostUsd(model: string, ti: number, to: number): number {
  const p = (PRICING_PER_M as Record<string, { in: number; out: number } | undefined>)[model];
  if (!p) return 0;
  return (ti / 1_000_000) * p.in + (to / 1_000_000) * p.out;
}

function appendLog(file: string | null, entry: Record<string, unknown>): void {
  if (!file) return;
  try {
    const dir = dirname(file);
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch { /* */ }
}

async function processOne(
  supabase: SupabaseClient,
  ev: EventRow,
  opts: CliOpts,
  stats: Stats,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updater: any,
): Promise<void> {
  // Skip if all 4 fields already populated
  const needEnd = !ev.end_date;
  const needAddr = !ev.address || ev.address.trim().length === 0;
  const needDesc = !ev.description || ev.description.trim().length < 40;
  const needPrice = (ev.price_text == null || ev.price_text.trim().length === 0)
    && ev.price_min == null;
  if (!needEnd && !needAddr && !needDesc && !needPrice) {
    stats.events_complete_skipped++;
    return;
  }

  // Need source_url to fetch page
  if (!ev.source_url) {
    stats.events_no_source_url++;
    return;
  }

  // Fetch page (skipped if --no-fetch)
  let pageContent: string | null = null;
  if (!opts.noFetch) {
    try {
      const fp = await fetchEventPage(ev.source_url);
      pageContent = fp.text ?? null;
      if (pageContent) stats.fetch_ok++;
      else stats.fetch_failed++;
    } catch {
      stats.fetch_failed++;
    }
  }

  if (!pageContent) {
    stats.filled_nothing++;
    return;
  }

  // Build user message
  const startInfo = ev.start_date ? ` (Startzeit: ${new Date(ev.start_date).toLocaleString('de-AT')})` : '';
  const userMsg = `EVENT: ${ev.title}${startInfo}\nORT: ${ev.location_name ?? '-'}\n\n──── QUELLTEXT ────\n${pageContent.slice(0, 12_000)}`;

  // Call OpenAI
  let result: ExtractResult | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      stats.ai_called++;
      result = await callOpenAI(opts.model, userMsg);
      if (result) {
        stats.tokens_in += result.tokens_in;
        stats.tokens_out += result.tokens_out;
        break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= 2 || /400|401|403|schema/.test(msg)) {
        appendLog(opts.logFile, { event_id: ev.id, status: 'ai_error', error: msg });
        stats.ai_failed++;
        return;
      }
      await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
    }
  }
  if (!result) {
    stats.ai_failed++;
    return;
  }

  // Validate + build sparse update payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = { id: ev.id };
  let anyFilled = false;

  if (needEnd) {
    const validEnd = validateEndDate(result.end_date_iso, ev.start_date);
    if (validEnd) {
      payload.end_date = validEnd;
      stats.filled_end_date++;
      anyFilled = true;
    }
  }
  if (needAddr) {
    const validAddr = validateAddress(result.address);
    if (validAddr) {
      payload.address = validAddr;
      stats.filled_address++;
      anyFilled = true;
    }
  }
  if (needDesc) {
    const validDesc = validateDescription(result.description);
    if (validDesc) {
      payload.description = validDesc;
      stats.filled_description++;
      anyFilled = true;
    }
  }
  if (needPrice) {
    const validPrice = validatePrice(result.price_text);
    if (validPrice) {
      payload.price_text = validPrice;
      stats.filled_price++;
      anyFilled = true;
    }
  }

  if (!anyFilled) {
    stats.filled_nothing++;
    appendLog(opts.logFile, { event_id: ev.id, status: 'nothing_extractable' });
    return;
  }

  if (opts.dryRun) {
    appendLog(opts.logFile, { event_id: ev.id, status: 'dry_run', payload });
    return;
  }

  await updater.add(payload);
  appendLog(opts.logFile, { event_id: ev.id, status: 'updated', payload });
}

async function worker(
  queue: EventRow[],
  supabase: SupabaseClient,
  opts: CliOpts,
  stats: Stats,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updater: any,
): Promise<void> {
  while (queue.length > 0) {
    const ev = queue.shift();
    if (!ev) break;
    try {
      await processOne(supabase, ev, opts, stats, updater);
    } catch (err) {
      console.error(`\nWorker error on ${ev.id.slice(0, 8)}: ${err instanceof Error ? err.message : err}`);
    }
    if ((stats.events_matched - queue.length) % 5 === 0) {
      const elapsed = (Date.now() - stats.started_at) / 1000;
      const cost = estimateCostUsd(opts.model, stats.tokens_in, stats.tokens_out);
      process.stdout.write(
        `  fetched=${stats.fetch_ok}/${stats.fetch_ok + stats.fetch_failed} ` +
        `ai=${stats.ai_called} filled(end=${stats.filled_end_date} adr=${stats.filled_address} desc=${stats.filled_description} prc=${stats.filled_price}) ` +
        `$${cost.toFixed(2)} ${elapsed.toFixed(0)}s\r`,
      );
    }
  }
}

async function main() {
  const opts = parseArgs();
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY missing');
    process.exit(1);
  }
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(supaUrl, supaKey);
  const updater = makeBulkUpdater(supabase, 'bulk_update_event_enrichment');

  // 1. Read URLs
  if (!existsSync(opts.input)) {
    console.error(`Input file not found: ${opts.input}`);
    console.error('Erst URLs aus dem GSC-xlsx-Export extrahieren (Spalte URL).');
    process.exit(1);
  }
  const lines = readFileSync(opts.input, 'utf8')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.startsWith('http'));
  const stats = newStats();
  stats.urls_total = lines.length;

  // 2. Parse URLs
  const parsed: UrlParts[] = [];
  for (const line of lines) {
    const p = parseEventUrl(line);
    if (p) parsed.push(p);
    else stats.url_unparseable++;
  }

  console.log('\nfix-gsc-event-issues');
  console.log(`  Input:           ${opts.input}`);
  console.log(`  URLs total:      ${stats.urls_total}`);
  console.log(`  Parseable:       ${parsed.length}`);
  console.log(`  Unparseable:     ${stats.url_unparseable}`);
  console.log(`  Model:           ${opts.model}`);
  console.log(`  Concurrency:     ${opts.concurrency}`);
  console.log(`  Dry-run:         ${opts.dryRun}`);
  console.log(`  No-fetch:        ${opts.noFetch}`);
  console.log(`  Limit:           ${opts.limit === Number.MAX_SAFE_INTEGER ? 'none' : opts.limit}`);
  console.log('─'.repeat(60));

  // 3. Look up events in DB. PostgREST has no JOIN, so we use IN (postal_code) +
  //    client-side filter on (date, slug).
  const ROW_FETCH_BATCH = 200;
  const allEvents: EventRow[] = [];
  for (let i = 0; i < parsed.length; i += ROW_FETCH_BATCH) {
    const slice = parsed.slice(i, i + ROW_FETCH_BATCH);
    const slugs = slice.map(p => p.slug);
    const plzs = slice.map(p => p.postal_code);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('events') as any)
      .select('id, title, description, start_date, end_date, address, location_name, source_url, price_text, price_min, postal_code, slug')
      .in('slug', slugs)
      .in('postal_code', plzs);
    if (error) {
      console.error(`Query error at slice ${i}:`, error.message);
      continue;
    }
    if (!data) continue;

    // Filter strictly: (postal_code, date::YYYY-MM-DD, slug) must match
    const wanted = new Set(slice.map(p => `${p.postal_code}::${p.date}::${p.slug}`));
    for (const row of data as Array<EventRow & { postal_code: string; slug: string }>) {
      const date = row.start_date ? row.start_date.slice(0, 10) : '';
      const key = `${row.postal_code}::${date}::${row.slug}`;
      if (wanted.has(key)) allEvents.push(row);
    }
  }
  stats.events_matched = allEvents.length;
  console.log(`  Events matched:  ${stats.events_matched}`);

  // 4. Apply --limit
  const queue = allEvents.slice(0, opts.limit);

  // 5. Workers
  const workers = Array.from({ length: opts.concurrency }, () =>
    worker(queue, supabase, opts, stats, updater),
  );
  await Promise.all(workers);

  // 6. Final flush
  if (!opts.dryRun) {
    try {
      await updater.flush();
    } catch (err) {
      console.error('Final flush error:', err instanceof Error ? err.message : err);
    }
  }

  // 7. Report
  const elapsed = ((Date.now() - stats.started_at) / 1000).toFixed(1);
  const cost = estimateCostUsd(opts.model, stats.tokens_in, stats.tokens_out);
  process.stdout.write('\n' + '─'.repeat(60) + '\n');
  console.log('Summary:');
  console.log(`  URLs total:           ${stats.urls_total}`);
  console.log(`  Unparseable:          ${stats.url_unparseable}`);
  console.log(`  Events matched:       ${stats.events_matched}`);
  console.log(`  Already complete:     ${stats.events_complete_skipped}`);
  console.log(`  No source_url:        ${stats.events_no_source_url}`);
  console.log(`  Fetch ok / failed:    ${stats.fetch_ok} / ${stats.fetch_failed}`);
  console.log(`  AI called / failed:   ${stats.ai_called} / ${stats.ai_failed}`);
  console.log(`  Filled — end_date:    ${stats.filled_end_date}`);
  console.log(`  Filled — address:     ${stats.filled_address}`);
  console.log(`  Filled — description: ${stats.filled_description}`);
  console.log(`  Filled — price_text:  ${stats.filled_price}`);
  console.log(`  Filled — nothing:     ${stats.filled_nothing}`);
  console.log(`  Tokens in / out:      ${stats.tokens_in.toLocaleString('de-AT')} / ${stats.tokens_out.toLocaleString('de-AT')}`);
  console.log(`  Cost (estimate):      $${cost.toFixed(2)}`);
  console.log(`  Elapsed:              ${elapsed}s`);
  if (opts.dryRun) console.log('\n  DRY RUN — keine DB-Writes.');
  await closeSharedBrowser();
}

main().catch((err) => {
  console.error('fix-gsc-event-issues failed:', err);
  closeSharedBrowser().finally(() => process.exit(1));
});
