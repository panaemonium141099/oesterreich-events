// src/scripts/scrape-pipeline.ts
/**
 * Master scrape pipeline orchestrator.
 *
 * Usage:
 *   npx tsx src/scripts/scrape-pipeline.ts --trigger cron
 *   npx tsx src/scripts/scrape-pipeline.ts --trigger manual --source burgenland.info
 *   npx tsx src/scripts/scrape-pipeline.ts --trigger github_dispatch --skip-geocoding
 *   npx tsx src/scripts/scrape-pipeline.ts --dry-run --trigger manual
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load .env.local (Next.js does this automatically, but tsx does not)
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
} catch { /* .env.local not found, rely on environment */ }

import { execSync } from 'child_process';
import { triggerMatchArtists } from '../lib/post-scrape-hook';

// In CI there's no .env.local — env vars come from GitHub Secrets.
// Only pass --env-file flag when the file actually exists.
const envFlag = existsSync(join(process.cwd(), '.env.local')) ? '--env-file=.env.local ' : '';
import { runStep } from '../lib/pipeline/step-runner';
import {
  createPipelineRun,
  finalizePipelineRun,
  sendAlertIfNeeded,
  loadScraperResultsFromSourceRuns,
  writeGitHubSummary,
  computeFinalStatus,
} from '../lib/scrape-reporter';
import type {
  PipelineOptions,
  PipelineResults,
  StepResult,
} from '../lib/pipeline/scrape-pipeline-types';

function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  const has = (flag: string) => args.includes(flag);

  return {
    trigger: (get('--trigger') as PipelineOptions['trigger']) || 'manual',
    source: get('--source'),
    skipScrapers: has('--skip-scrapers'),
    skipVenues: has('--skip-venues'),
    skipGeocoding: has('--skip-geocoding'),
    skipScore: has('--skip-score'),
    skipCategorization: has('--skip-categorization'),
    skipCategorizationBackfill: has('--skip-categorization-backfill'),
    skipDedup: has('--skip-dedup'),
    skipIndexing: has('--skip-indexing'),
    dryRun: has('--dry-run'),
  };
}

function execStep(label: string, cmd: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(60)}\n`);
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

async function main() {
  const opts = parseArgs();
  const steps: Record<string, StepResult> = {};
  let runId: string | null = null;

  const results: PipelineResults & { _exitCode?: number } = {
    trigger: opts.trigger,
    run_id: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    steps: {},
    scraper_results: [],
    total_events_scraped: 0,
    total_events_updated: 0,
    total_errors: 0,
    github_run_id: process.env.GITHUB_RUN_ID || null,
    github_run_url: process.env.GITHUB_RUN_URL || null,
    dry_run: opts.dryRun || false,
  };

  if (!opts.dryRun) {
    try {
      runId = await createPipelineRun(
        opts.trigger,
        process.env.GITHUB_RUN_ID || null,
        process.env.GITHUB_RUN_URL || null,
      );
      results.run_id = runId;
      console.log(`[pipeline] Created pipeline_runs row: ${runId}`);
    } catch (err) {
      console.error(`[pipeline] Failed to create pipeline_runs row: ${err}`);
    }
  }

  try {
    if (!opts.skipScrapers) {
      steps.scrapers = await runStep('scrapers', async () => {
        if (opts.source) {
          execStep(`Scraping: ${opts.source}`, `npx tsx src/scripts/scrape.ts --source ${opts.source}`);
        } else {
          execStep('Running all registered scrapers', 'npx tsx src/scripts/scrape.ts');
        }
      }, steps);
    }

    if (!opts.skipVenues) {
      steps.venues = await runStep('venues', async () => {
        execStep('Venue feed ingestion', `npx tsx ${envFlag}src/scripts/scrape-venues.ts`);
      }, steps);
    }

    // Ortsdaten entscheidet allein der Schreibpfad (src/lib/location/,
    // Stammdaten data/gemeinden-at.json). Die früheren Alt-Geo-Schritte
    // (GeoNames-Normalizer, Namens-Geocoder, Master-Coords) sind gelöscht.

    // SEO-Bilder-Fix (2026-09-01): Breite der neuen/gewechselten Scraper-Bilder
    // vermessen (Range-Request-Header-Parse) — der Bild-Resolver ersetzt
    // <600px-Bilder durch grosse Kategorie-Fallbacks (Google-Thumbnail-CTR).
    // Gedeckelt, damit der Schritt nie zum Zeitfresser wird; der Rest-Backlog
    // rutscht in die Folgenaechte.
    // --requeue-failed 500 (2026-09-03): holt pro Nacht 500 Zeilen zurueck,
    // deren Probe frueher fehlschlug (image_width = -1). Ohne das blieben sie
    // fuer immer auf -1 stehen, denn der normale Lauf nimmt nur
    // image_probed_url IS NULL — und -1 gilt im Resolver als "nicht
    // vermessen", die womoeglich tote URL wurde also weiter ausgeliefert.
    // Stichprobe ueber 400 dieser Zeilen: 34 % dauerhaft tot (403/404),
    // 31 % luden einwandfrei und waren nur falsch markiert, 35 %
    // voruebergehend nicht erreichbar. Bei 500/Nacht ist der damalige
    // Bestand von ~2.600 in gut fuenf Naechten durchgesehen; danach haelt
    // der Durchlauf die Menge klein.
    // --recheck-measured 2500 (2026-09-25): Bilder verschwinden auch NACH
    // dem Messen an der Quelle (linztermine: 229 Stueck, jetzt leere
    // 200-Antwort). Bei ~73k vermessenen Zukunfts-Events ist jedes Bild
    // so etwa alle 30 Naechte erneut dran; zusammen mit ~700 neuen und
    // 500 requeued bleibt der Lauf unter dem 4000er-Deckel.
    steps.image_probe = await runStep('image_probe', async () => {
      execStep(
        'Probe image widths',
        `npx tsx ${envFlag}src/scripts/probe-image-widths.ts --limit 4000 --requeue-failed 500 --recheck-measured 2500`,
      );
    }, steps);

    if (!opts.skipCategorization) {
      if (!opts.skipCategorizationBackfill) {
        steps.categorization_backfill = await runStep('categorization_backfill', async () => {
          // Deterministische Kategorie-Einordnung (Taxonomie v3), der
          // einzige Kategorieschritt seit dem Ende der KI-Anreicherung
          // (MASTERPLAN §6). Ordnet jede Zeile mit veralteter
          // Classifier-Version neu ein; reconcile schützt stärkere
          // bestehende Kategorien. Idempotent.
          execStep('Categorize events (deterministic backfill)',
            `npx tsx ${envFlag}src/scripts/categorize-events.ts --deterministic-backfill`);
        }, steps);
      }

    }

    // fn-25 C3: Adress-Geocoder (Nominatim, 1,2 s Takt, Tagesbudget) füllt
    // den Cache für Eventadressen mit Hausnummer und entscheidet die
    // betroffenen Events über den gemeinsamen Resolver neu.
    if (!opts.skipGeocoding) {
      steps.address_geocoding = await runStep('address_geocoding', async () => {
        // 1 Anfrage je 1,2 s: 1.500 Adressen sind 30 Minuten, innerhalb der
        // Nominatim-Regel (max. 1/s) und weit unter Massengeocodierung.
        execStep('Geocode event addresses', `npx tsx ${envFlag}src/scripts/geocode-addresses.ts --limit 1500`);
      }, steps);
    }

    if (!opts.skipScore) {
      steps.scoring = await runStep('scoring', async () => {
        execStep('Calculate scores', `npx tsx ${envFlag}src/scripts/calculate-scores.ts`);
      }, steps);
    }

    if (!opts.skipDedup) {
      steps.dedup = await runStep('dedup', async () => {
        // Cross-source dedup: garbage filter + fingerprint blocks + fuzzy
        // within (date, venue, location) blocks. Marks losers with
        // publish_status='duplicate'; the app filters those out.
        execStep('Deduplicate events', `npx tsx ${envFlag}src/scripts/dedup.ts`);
      }, steps);
    }

    steps.artist_matching = await runStep('artist_matching', async () => {
      await triggerMatchArtists();
    }, steps);

    // KI-Enrichment + Embeddings entfernt (2026-07, MASTERPLAN §6 —
    // Grundsatz-Entscheidung: kein KI-Enrichment mehr, Datenqualität
    // deterministisch an der Quelle). Die enrich-*-Scripts wurden gelöscht;
    // Kategorien kommen aus dem deterministischen Classifier oben.

    if (!opts.skipIndexing) {
      steps.indexing = await runStep('indexing', async () => {
        // Submits event URLs to IndexNow (Bing/Yandex) and Google Indexing
        // API. Defaults to --since<pipeline_start_iso> so only freshly-
        // scraped or updated rows are notified, saving daily API quota.
        const since = results.started_at;
        execStep('Submit URLs to IndexNow + Google Indexing API',
          `npx tsx ${envFlag}src/scripts/submit-to-indexing.ts --since ${since}`);
      }, steps);
    }

    // Report generation (always runs, no dependencies)
    // fn-25 O1: Kennzahlen zur Ortsqualität (Abdeckung, Konflikte, Drift,
    // Wiederholbarkeit) mit Alarmgrenzen → workflow_runs 'location-audit'.
    steps.location_metrics = await runStep('location_metrics', async () => {
      execStep('Location metrics', `npx tsx ${envFlag}src/scripts/location-metrics.ts`);
    }, steps);

    steps.report = await runStep('report', async () => {
      execStep('Generate scrape report', `npx tsx ${envFlag}src/scripts/generate-scrape-report.ts`);
    }, steps);

  } finally {
    results.steps = steps;
    results.finished_at = new Date().toISOString();
    results.total_errors = Object.values(steps).filter((s) => s.status === 'failed').length;

    // Der naechtliche Workflow scrapt in eigenen Shard-Jobs und ruft dieses
    // Skript danach mit --skip-scrapers auf. Ohne Nachladen berichtet der
    // Lauf dann "0 Events gefunden, 0 Scraper" — obwohl die Shards gerade
    // 144 Scraper gefahren sind (Bericht vom 2026-09-07). Die echten Zahlen
    // stehen in source_runs.
    if (opts.skipScrapers && !opts.dryRun && results.scraper_results.length === 0) {
      try {
        results.scraper_results = await loadScraperResultsFromSourceRuns();
        results.total_events_scraped = results.scraper_results.reduce((n, r) => n + r.events_found, 0);
        results.total_events_updated = results.scraper_results.reduce((n, r) => n + r.events_updated, 0);
        const failed = results.scraper_results.filter((r) => r.status !== 'success').length;
        results.total_errors += failed;
        console.log(
          `[pipeline] Scraper-Zahlen aus source_runs: ${results.scraper_results.length} Quellen, ` +
            `${results.total_events_scraped} gefunden, ${failed} gescheitert`,
        );
      } catch (err) {
        console.error(`[pipeline] source_runs nicht lesbar: ${err}`);
      }
    }

    if (!opts.dryRun && runId) {
      console.log(`[pipeline] Finalizing run ${runId}...`);
      try {
        await finalizePipelineRun(runId, results);
        console.log(`[pipeline] Run ${runId} finalized successfully`);
      } catch (err) {
        console.error(`[pipeline] Failed to finalize: ${err}`);
      }

      try {
        await sendAlertIfNeeded(results);
      } catch (err) {
        console.error(`[pipeline] Failed to send alert: ${err}`);
      }
    }

    writeGitHubSummary(results);

    const status = computeFinalStatus(results.steps, results.total_errors);
    const elapsed = results.finished_at
      ? ((new Date(results.finished_at).getTime() - new Date(results.started_at).getTime()) / 1000 / 60).toFixed(1)
      : '?';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Pipeline ${status} | ${elapsed} min | ${results.total_errors} step errors`);
    if (opts.dryRun) console.log('  (DRY RUN — nothing written to Supabase)');
    console.log(`${'='.repeat(60)}\n`);

    // Store exit code but don't call process.exit() inside finally —
    // let main() resolve first so all async work completes.
    results._exitCode = status === 'failed' ? 1 : 0;
  }

  return results;
}

main()
  .then((results) => {
    if (results._exitCode) process.exit(results._exitCode);
  })
  .catch((err) => {
    console.error(`[pipeline] Unhandled error: ${err}`);
    process.exit(1);
  });
