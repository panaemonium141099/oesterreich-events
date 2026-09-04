/**
 * Batch-Übersetzung von Event-Inhalten (DE → EN).
 *
 * Warum es das zusätzlich zum Lazy-Pfad in `translate-event.ts` gibt:
 * die Lazy-Übersetzung feuert erst, wenn jemand die /en-URL öffnet. Genau
 * das passiert aber nie, weil die /en-URL erst dann in die Sitemap kommt
 * und einen eigenen Canonical bekommt, wenn `title_en` bereits gefüllt
 * ist (siehe sitemap-events-shard.ts und events/[...slug]/generateMetadata).
 * Messung 2026-09-04: 6 172 von 81 921 sitemap-fähigen Future-Events hatten
 * eine Übersetzung — 7,5 %. Von 26 015 je erzeugten Übersetzungen waren
 * ~20 000 auf Events, die inzwischen vorbei sind: der Lazy-Pfad übersetzt
 * bevorzugt, was gerade jemand anschaut, nicht was Google indexieren soll.
 *
 * Der Batch dreht das um: er arbeitet die Events nach Startdatum
 * aufsteigend ab (das, was am ehesten noch stattfindet und Traffic
 * bekommt) und ist über den `title_en IS NULL`-Filter jederzeit
 * fortsetzbar — ein Abbruch verliert nur den laufenden Chunk.
 *
 * Die Mechanik (Worker-Pool, offsetfreies Weiterrücken, Quota-Abbruch,
 * Fehler-Buckets) ist seit den Freizeit-POIs generisch: `runBatch` kennt
 * nur noch "hole eine Seite", "übersetze eine Zeile", "schreibe zurück".
 * `runTranslationBatch` (Events) und `runActivityTranslationBatch` (POIs)
 * sind dünne Wrapper darüber.
 *
 * Genutzt von:
 *   - `src/scripts/translate-events-en.ts` (Event-Backfill, CLI)
 *   - `src/scripts/translate-activities-en.ts` (POI-Backfill, CLI)
 *   - `/api/cron/translate-events` (täglicher Nachlauf für neue Events)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { translateViaGemini } from './translate-event';
import { translateActivityDescription } from './translate-activity';

/**
 * Mindest-Qualität. Identisch zum Sitemap-Filter in
 * `sitemap-events-shard.ts` — Events darunter stehen ohnehin nicht im
 * Index, für die lohnt kein Gemini-Call.
 */
export const MIN_QUALITY_SCORE = 40;

/** Chunk-Größe der Kandidaten-Query. PostgREST cappt self-hosted bei 1000. */
const FETCH_CHUNK = 500;

/**
 * Timeout je Gemini-Versuch im Batch. Deutlich über den 8 s des
 * Lazy-Pfads: dort hängt ein Seiten-Render dran, hier nicht — und
 * abgeschnittene Antworten kosten den vollen Call ohne Ergebnis.
 */
const GEMINI_TIMEOUT_MS = 25_000;

/**
 * Wartezeit vor dem Wiederholungsversuch (verdoppelt sich, siehe
 * TranslateOptions.retryDelayMs). Ein sofortiger Retry fiel im Backfill in
 * dasselbe Fehlerfenster wie der erste Versuch.
 */
const RETRY_DELAY_MS = 2_000;

/**
 * So viele Quota-Fehler am Stueck beenden den Lauf.
 *
 * Der Gemini-Key laeuft auf dem Free Tier: 10 000 Requests pro Tag und
 * Modell. Ist der Deckel erreicht, antwortet JEDER weitere Call mit 429 —
 * am 2026-09-04 lief ein Backfill danach noch ueber 2 400 Events und
 * verbrannte mit dem Retry ~4 800 sinnlose Requests, die am naechsten Tag
 * erneut gegen das Kontingent zaehlen wuerden. 25 in Folge sind eindeutig
 * das Tageslimit und nicht mehr die vereinzelten transienten Fehler.
 */
const QUOTA_ABORT_STREAK = 25;

/**
 * Verdichtet eine Fehlermeldung auf eine handvoll Kategorien, damit die
 * Zusammenfassung eines Laufs mit 80 000 Events lesbar bleibt.
 */
export function errorBucket(reason: string): string {
  const r = reason.toLowerCase();
  if (r === 'timeout') return 'Timeout';
  if (r.includes('429') || r.includes('quota') || r.includes('rate limit')) return 'Quota/Rate-Limit';
  if (r.includes('finishreason=max_tokens')) return 'MAX_TOKENS (abgeschnittenes JSON)';
  if (r.includes('finishreason=recitation')) return 'RECITATION (Textkopie erkannt)';
  if (r.includes('finishreason=safety')) return 'SAFETY';
  if (r.startsWith('finishreason=')) return reason;
  if (r.includes('503') || r.includes('unavailable')) return 'Gemini nicht erreichbar';
  if (r.includes('500') || r.includes('internal')) return 'Gemini 500';
  return 'sonstiges: ' + reason.slice(0, 60);
}

export interface BatchCandidate {
  id: string;
  title: string | null;
  description: string | null;
  start_date: string | null;
}

export interface BatchProgress {
  processed: number;
  translated: number;
  skipped: number;
  failed: number;
}

export interface BatchOptions {
  /** Harte Obergrenze an Events für diesen Lauf. */
  limit: number;
  /** Parallele Gemini-Calls. */
  concurrency?: number;
  /** Wanduhr-Budget in ms; danach wird sauber beendet (für den Cron). */
  deadlineMs?: number;
  /** Nichts schreiben, nur zählen. */
  dryRun?: boolean;
  /** Callback nach jedem Event — für CLI-Fortschritt. */
  onProgress?: (p: BatchProgress) => void;
}

export interface BatchResult extends BatchProgress {
  /** true, wenn wegen deadlineMs abgebrochen wurde. */
  stoppedByDeadline: boolean;
  /** true, wenn das Tageskontingent von Gemini erschoepft war. */
  stoppedByQuota: boolean;
  durationMs: number;
  /** Fehlerursachen nach Kategorie, absteigend nach Haeufigkeit. */
  errorKinds: Array<{ reason: string; count: number }>;
}

/**
 * Holt eine Seite unuebersetzter Events, ab `offset` in der Reihenfolge
 * (start_date ASC, id ASC).
 *
 * Warum ein Offset noetig ist — das hat einen kompletten Backfill gekostet:
 * uebersetzte Events fallen durch `title_en IS NULL` aus dem Filter, aber
 * FEHLGESCHLAGENE nicht. Weil strikt nach Datum aufsteigend gearbeitet
 * wird, sammeln sich die Fehlschlaege am Anfang der Ergebnismenge an.
 * Sobald es mehr als eine Seite voll davon sind, liefert "immer wieder die
 * erste Seite" nur noch Zeilen, die dieser Lauf schon versucht hat — der
 * Batch hielt das faelschlich fuer "nichts mehr offen" und beendete sich.
 * Gemessen am 2026-09-04: Abbruch nach 8 994 von 75 936 Events, exakt als
 * die Fehlerzahl (502) die Chunk-Groesse (500) ueberschritt.
 *
 * `offset` = Anzahl der bereits versuchten, weiterhin unuebersetzten
 * Zeilen (failed + skipped). Da jede Zeile vor der aktuellen Position
 * schon versucht wurde, sortieren genau diese vor allen unberuehrten —
 * der Offset ueberspringt sie also exakt. `skipIds` bleibt als zweite
 * Sicherung: greift der Offset einmal daneben (z. B. weil ein Scraper
 * parallel ein Event mit frueherem Datum einfuegt), wird die Zeile nicht
 * doppelt bezahlt.
 */
export async function fetchCandidates(
  supabase: SupabaseClient,
  chunkSize: number,
  skipIds: Set<string>,
  offset = 0,
): Promise<{ rows: BatchCandidate[]; rawCount: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const size = Math.min(chunkSize, FETCH_CHUNK);
  const { data, error } = await supabase
    .from('events')
    .select('id, title, description, start_date')
    .is('title_en', null)
    .gte('start_date', today)
    .eq('publish_status', 'published')
    .gte('quality_score', MIN_QUALITY_SCORE)
    .not('title', 'is', null)
    .order('start_date', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + size - 1);

  if (error) throw new Error(`Kandidaten-Query fehlgeschlagen: ${error.message}`);
  const raw = data ?? [];
  return { rows: raw.filter(e => !skipIds.has(e.id)), rawCount: raw.length };
}


/**
 * True, wenn dieser Lauf am Gemini-Tageskontingent haengt.
 *
 * Zwei Wege dorthin: der Streak-Abbruch bei >= 25 Quota-Fehlern in Folge
 * (grosse Laeufe), oder ein kleiner Lauf, der komplett an 429 scheitert,
 * ohne die Streak-Schwelle zu erreichen. Beide sind auf dem Free Tier der
 * Normalfall und duerfen nicht als "Key kaputt" gemeldet werden — sonst
 * schlaegt der Nacht-Timer Alarm, obwohl morgen einfach weitergearbeitet
 * wird.
 */
export function isQuotaExhausted(result: BatchResult): boolean {
  if (result.stoppedByQuota) return true;
  if (result.translated > 0 || result.failed === 0) return false;
  return result.errorKinds[0]?.reason === 'Quota/Rate-Limit';
}

/** Eine Zeile, die der Batch bearbeiten kann. */
export interface BatchRow {
  id: string;
}

export interface TranslateHooks {
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
  onAttemptError: (reason: string) => void;
}

/**
 * Was ein konkreter Batch beisteuert. Der Rest — Paging, Worker-Pool,
 * Zählwerk, Quota-Abbruch — liegt in `runBatch`.
 */
export interface BatchIO<TRow extends BatchRow> {
  /** Menschenlesbar für Log-Ausgaben ("Events", "Aktivitäten"). */
  label: string;
  /** Eine Seite unübersetzter Zeilen ab `offset`, aufsteigend sortiert. */
  fetchPage(offset: number, size: number): Promise<{ rows: TRow[]; rawCount: number }>;
  /**
   * `null` → Fehlschlag (zählt als failed), `'skip'` → Zeile hat nichts zu
   * übersetzen (zählt als skipped), sonst das Update-Objekt.
   */
  translate(row: TRow, hooks: TranslateHooks): Promise<Record<string, unknown> | 'skip' | null>;
  /** Zurückschreiben. `error` MUSS geprüft werden — supabase-js wirft nicht. */
  write(row: TRow, patch: Record<string, unknown>): Promise<{ error: unknown }>;
}

/**
 * Arbeitet eine Tabelle ab. Fehler-Politik: ein fehlgeschlagener
 * Gemini-Call zählt als `failed` und die Zeile bleibt unübersetzt (der
 * nächste Lauf versucht es erneut). Ein fehlgeschlagener DB-Write wird
 * ebenfalls laut gezählt — supabase-js wirft bei Schreibfehlern NICHT,
 * `error` muss explizit geprüft werden, sonst meldet der Lauf Erfolg und
 * speichert nichts.
 */
export async function runBatch<TRow extends BatchRow>(
  io: BatchIO<TRow>,
  opts: BatchOptions,
): Promise<BatchResult> {
  const startedAt = Date.now();
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const deadline = opts.deadlineMs ? startedAt + opts.deadlineMs : null;

  const progress: BatchProgress = { processed: 0, translated: 0, skipped: 0, failed: 0 };
  const attempted = new Set<string>();
  const errorKinds = new Map<string, number>();
  let skippedPages = 0;
  let quotaStreak = 0;
  let stoppedByDeadline = false;
  let stoppedByQuota = false;

  const hooks: TranslateHooks = {
    timeoutMs: GEMINI_TIMEOUT_MS,
    retries: 1,
    retryDelayMs: RETRY_DELAY_MS,
    onAttemptError: reason => {
      const bucket = errorBucket(reason);
      errorKinds.set(bucket, (errorKinds.get(bucket) ?? 0) + 1);
      if (bucket === 'Quota/Rate-Limit') quotaStreak++;
      else quotaStreak = 0;
    },
  };

  while (progress.processed < opts.limit) {
    if (deadline && Date.now() >= deadline) {
      stoppedByDeadline = true;
      break;
    }
    if (stoppedByQuota) break;

    const remaining = opts.limit - progress.processed;
    // Fehlschlaege bleiben im Filter stehen und sortieren vor allem
    // Unberuehrten — ohne diesen Offset liefert die Query irgendwann nur
    // noch schon versuchte Zeilen (siehe fetchCandidates).
    const offset = progress.failed + progress.skipped + skippedPages;
    const { rows, rawCount } = await io.fetchPage(offset, Math.min(remaining, FETCH_CHUNK));
    const candidates = rows.filter(r => !attempted.has(r.id));
    // Leere Seite trotz voller Roh-Antwort: der Offset lag daneben, also
    // eine Seite weiterruecken statt den Lauf zu beenden.
    if (candidates.length === 0) {
      if (rawCount === 0) break;
      skippedPages += rawCount;
      continue;
    }

    // Worker-Pool statt Slice-für-Slice: bei `Promise.all` über feste
    // Scheiben wartet die ganze Scheibe auf ihren langsamsten Call, und
    // Gemini-Latenzen streuen von 0,5 s bis zum Timeout. Gemessen kostete
    // das Slice-Modell ~2,4 s pro Event bei Concurrency 5, obwohl der
    // Median-Call unter 1 s liegt.
    let next = 0;
    const takeNext = (): TRow | null => {
      if (progress.processed >= opts.limit) return null;
      if (deadline && Date.now() >= deadline) {
        stoppedByDeadline = true;
        return null;
      }
      if (quotaStreak >= QUOTA_ABORT_STREAK) {
        stoppedByQuota = true;
        return null;
      }
      return next < candidates.length ? candidates[next++] : null;
    };

    const worker = async () => {
      for (let row = takeNext(); row; row = takeNext()) {
        attempted.add(row.id);
        progress.processed++;

        let patch: Record<string, unknown> | 'skip' | null = null;
        try {
          patch = await io.translate(row, hooks);
        } catch {
          patch = null;
        }

        if (patch === 'skip') {
          progress.skipped++;
          opts.onProgress?.(progress);
          continue;
        }
        if (!patch) {
          progress.failed++;
          opts.onProgress?.(progress);
          continue;
        }
        if (opts.dryRun) {
          progress.translated++;
          opts.onProgress?.(progress);
          continue;
        }

        const { error } = await io.write(row, patch);
        if (error) progress.failed++;
        else {
          progress.translated++;
          quotaStreak = 0;
        }
        opts.onProgress?.(progress);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  }

  return {
    ...progress,
    stoppedByDeadline,
    stoppedByQuota,
    durationMs: Date.now() - startedAt,
    errorKinds: [...errorKinds.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** Event-Titel und -Beschreibungen (`events.title_en`/`description_en`). */
export function runTranslationBatch(
  supabase: SupabaseClient,
  apiKey: string,
  opts: BatchOptions,
): Promise<BatchResult> {
  return runBatch<BatchCandidate>(
    {
      label: 'Events',
      fetchPage: (offset, size) => fetchCandidates(supabase, size, new Set(), offset),
      translate: async (row, hooks) => {
        if (!row.title) return 'skip';
        // Grosszügiger als der Lazy-Pfad: hier hängt keine Seite am
        // Ergebnis, und ein zweiter Versuch holt die ~15-25 %
        // transienten Gemini-Fehlschläge zurück.
        const translation = await translateViaGemini(row.title, row.description, apiKey, {
          timeoutMs: hooks.timeoutMs,
          retries: hooks.retries,
          retryDelayMs: hooks.retryDelayMs,
          onAttemptError: hooks.onAttemptError,
        });
        if (!translation) return null;
        return {
          title_en: translation.title_en,
          description_en: translation.description_en,
          translated_at: new Date().toISOString(),
        };
      },
      // await, damit der PostgrestFilterBuilder (thenable, aber kein
      // Promise) zum erwarteten Ergebnis-Objekt wird.
      write: async (row, patch) =>
        supabase.from('events').update(patch).eq('id', row.id),
    },
    opts,
  );
}

export interface ActivityCandidate extends BatchRow {
  name: string;
  description: string | null;
}

/**
 * Unter dieser Textlänge lohnt kein Gemini-Call: das Indexierungs-Gate in
 * `activities/indexability.ts` verlangt >= 200 Zeichen Beschreibung,
 * darunter kommt die Seite ohnehin nicht in den Index.
 */
export const MIN_ACTIVITY_DESCRIPTION = 200;

/**
 * Kandidaten-Query der Freizeit-POIs. Gefiltert wie das Anzeige-Gate:
 * sichtbar und nicht dauerhaft geschlossen.
 */
export async function fetchActivityCandidates(
  supabase: SupabaseClient,
  chunkSize: number,
  offset = 0,
): Promise<{ rows: ActivityCandidate[]; rawCount: number }> {
  const size = Math.min(chunkSize, FETCH_CHUNK);
  const { data, error } = await supabase
    .from('poi_activities')
    .select('id, name, description')
    .is('description_en', null)
    .eq('visible', true)
    .eq('is_closed', false)
    .not('description', 'is', null)
    .order('id', { ascending: true })
    .range(offset, offset + size - 1);

  if (error) throw new Error(`POI-Kandidaten-Query fehlgeschlagen: ${error.message}`);
  const raw = (data ?? []) as ActivityCandidate[];
  return { rows: raw, rawCount: raw.length };
}

/** Freizeit-POI-Beschreibungen (`poi_activities.description_en`). */
export function runActivityTranslationBatch(
  supabase: SupabaseClient,
  apiKey: string,
  opts: BatchOptions,
): Promise<BatchResult> {
  return runBatch<ActivityCandidate>(
    {
      label: 'Aktivitäten',
      fetchPage: (offset, size) => fetchActivityCandidates(supabase, size, offset),
      translate: async (row, hooks) => {
        if (!row.description || row.description.trim().length < MIN_ACTIVITY_DESCRIPTION) {
          return 'skip';
        }
        const descriptionEn = await translateActivityDescription(
          { name: row.name, description: row.description },
          apiKey,
          {
            timeoutMs: hooks.timeoutMs,
            retries: hooks.retries,
            retryDelayMs: hooks.retryDelayMs,
            onAttemptError: hooks.onAttemptError,
          },
        );
        if (!descriptionEn) return null;
        return { description_en: descriptionEn, translated_at: new Date().toISOString() };
      },
      // await, damit der PostgrestFilterBuilder (thenable, aber kein
      // Promise) zum erwarteten Ergebnis-Objekt wird.
      write: async (row, patch) =>
        supabase.from('poi_activities').update(patch).eq('id', row.id),
    },
    opts,
  );
}
