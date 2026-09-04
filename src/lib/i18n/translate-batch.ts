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
 * Genutzt von:
 *   - `src/scripts/translate-events-en.ts` (einmaliger Backfill, CLI)
 *   - `/api/cron/translate-events` (täglicher Nachlauf für neue Events)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { translateViaGemini } from './translate-event';

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
  durationMs: number;
  /** Fehlerursachen nach Kategorie, absteigend nach Haeufigkeit. */
  errorKinds: Array<{ reason: string; count: number }>;
}

/**
 * Holt die nächsten unübersetzten Events.
 *
 * Bewusst OHNE Offset-Paging: jeder übersetzte Event fällt durch das
 * `title_en IS NULL` aus dem Filter, ein Offset würde also bei jedem
 * Folgeaufruf Zeilen überspringen. Stattdessen immer wieder die erste
 * Seite — solange geschrieben wird, wandert das Fenster von allein.
 * `skipIds` fängt die Events ab, die in diesem Lauf schon versucht wurden
 * und (z. B. mangels Titel) nie ein `title_en` bekommen — ohne das würde
 * die Query sie endlos erneut liefern.
 */
export async function fetchCandidates(
  supabase: SupabaseClient,
  chunkSize: number,
  skipIds: Set<string>,
): Promise<BatchCandidate[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('events')
    .select('id, title, description, start_date')
    .is('title_en', null)
    .gte('start_date', today)
    .eq('publish_status', 'published')
    .gte('quality_score', MIN_QUALITY_SCORE)
    .not('title', 'is', null)
    .order('start_date', { ascending: true })
    .limit(Math.min(chunkSize, FETCH_CHUNK));

  if (error) throw new Error(`Kandidaten-Query fehlgeschlagen: ${error.message}`);
  return (data ?? []).filter(e => !skipIds.has(e.id));
}

/**
 * Übersetzt bis zu `limit` Events und schreibt das Ergebnis zurück.
 *
 * Fehler-Politik: ein fehlgeschlagener Gemini-Call zählt als `failed` und
 * der Event bleibt unübersetzt (nächster Lauf versucht es erneut). Ein
 * fehlgeschlagener DB-Write wird laut gezählt — supabase-js wirft bei
 * Schreibfehlern NICHT, `error` muss explizit geprüft werden, sonst
 * meldet der Lauf Erfolg und speichert nichts.
 */
export async function runTranslationBatch(
  supabase: SupabaseClient,
  apiKey: string,
  opts: BatchOptions,
): Promise<BatchResult> {
  const startedAt = Date.now();
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const deadline = opts.deadlineMs ? startedAt + opts.deadlineMs : null;

  const progress: BatchProgress = { processed: 0, translated: 0, skipped: 0, failed: 0 };
  const attempted = new Set<string>();
  const errorKinds = new Map<string, number>();
  let stoppedByDeadline = false;

  while (progress.processed < opts.limit) {
    if (deadline && Date.now() >= deadline) {
      stoppedByDeadline = true;
      break;
    }

    const remaining = opts.limit - progress.processed;
    const candidates = await fetchCandidates(supabase, Math.min(remaining, FETCH_CHUNK), attempted);
    if (candidates.length === 0) break;

    // Worker-Pool statt Slice-für-Slice: bei `Promise.all` über feste
    // Scheiben wartet die ganze Scheibe auf ihren langsamsten Call, und
    // Gemini-Latenzen streuen von 0,5 s bis zum 25-s-Timeout. Gemessen
    // kostete das Slice-Modell ~2,4 s pro Event bei Concurrency 5,
    // obwohl der Median-Call unter 1 s liegt.
    let next = 0;
    const takeNext = (): BatchCandidate | null => {
      if (progress.processed >= opts.limit) return null;
      if (deadline && Date.now() >= deadline) {
        stoppedByDeadline = true;
        return null;
      }
      return next < candidates.length ? candidates[next++] : null;
    };

    const worker = async () => {
      for (let event = takeNext(); event; event = takeNext()) {
        attempted.add(event.id);
        progress.processed++;

        if (!event.title) {
          progress.skipped++;
          opts.onProgress?.(progress);
          continue;
        }

        let translation: Awaited<ReturnType<typeof translateViaGemini>> = null;
        try {
          // Grosszügiger als der Lazy-Pfad: hier hängt keine Seite am
          // Ergebnis, und ein zweiter Versuch holt die ~15-25 %
          // transienten Gemini-Fehlschläge zurück (siehe
          // TranslateOptions in translate-event.ts).
          translation = await translateViaGemini(event.title, event.description, apiKey, {
            timeoutMs: GEMINI_TIMEOUT_MS,
            retries: 1,
            retryDelayMs: RETRY_DELAY_MS,
            onAttemptError: reason => {
              const bucket = errorBucket(reason);
              errorKinds.set(bucket, (errorKinds.get(bucket) ?? 0) + 1);
            },
          });
        } catch {
          translation = null;
        }
        if (!translation) {
          progress.failed++;
          opts.onProgress?.(progress);
          continue;
        }

        if (opts.dryRun) {
          progress.translated++;
          opts.onProgress?.(progress);
          continue;
        }

        const { error } = await supabase
          .from('events')
          .update({
            title_en: translation.title_en,
            description_en: translation.description_en,
            translated_at: new Date().toISOString(),
          })
          .eq('id', event.id);

        if (error) progress.failed++;
        else progress.translated++;
        opts.onProgress?.(progress);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  }

  return {
    ...progress,
    stoppedByDeadline,
    durationMs: Date.now() - startedAt,
    errorKinds: [...errorKinds.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
