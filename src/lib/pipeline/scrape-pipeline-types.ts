// src/lib/pipeline/scrape-pipeline-types.ts

export type PipelineTrigger = 'cron' | 'manual' | 'github_dispatch';

export type PipelineRunStatus = 'running' | 'success' | 'partial_failure' | 'failed';

export type StepStatus = 'success' | 'failed' | 'partial_failure' | 'skipped_dependency';

export type ScraperStatStatus = 'success' | 'failed' | 'skipped';

export interface StepResult {
  status: StepStatus;
  duration_ms: number;
  error?: string;
  reason?: string;
  // Step-specific extras (scrapers)
  succeeded?: number;
  failed?: number;
  // Step-specific extras (geocoding)
  fix_count?: number;
  gemini_count?: number;
}

export interface ScraperResult {
  scraper_name: string;
  status: ScraperStatStatus;
  events_found: number;
  events_updated: number;
  duration_ms: number;
  error_message: string | null;
  retry_count: number;
}

export interface PipelineResults {
  trigger: PipelineTrigger;
  run_id: string | null; // null in dry-run
  started_at: string;
  finished_at: string | null;
  steps: Record<string, StepResult>;
  scraper_results: ScraperResult[];
  total_events_scraped: number;
  total_events_updated: number;
  total_errors: number;
  github_run_id: string | null;
  github_run_url: string | null;
  dry_run: boolean;
}

export interface PipelineOptions {
  trigger: PipelineTrigger;
  source?: string; // run only this scraper
  skipScrapers?: boolean;
  skipVenues?: boolean;
  skipGeocoding?: boolean;
  /**
   * Skip the master-coords resolution step (fix-duplicate-coords.ts --pipeline-mode).
   * That step pins all events with the same (location_name, postal_code) to one
   * verified coord and persists via DB trigger. Idempotent — only new clusters
   * get external lookups (Nominatim/OpenAI). Skip if you've just touched the
   * step manually.
   */
  skipMasterCoords?: boolean;
  skipScore?: boolean;
  /** Skip both categorization sub-steps (backfill + AI residue). */
  skipCategorization?: boolean;
  /** Skip only the deterministic backfill sub-step (4a), keep AI residue (4b). */
  skipCategorizationBackfill?: boolean;
  /** Skip the cross-source dedup pass (not recommended — duplicates bleed through). */
  skipDedup?: boolean;
  /**
   * Skip the OpenAI-based enrichment step. Default is to skip — Enrichment is
   * now decoupled from the pipeline (run `npm run enrich:claude` /
   * `npm run enrich:openai` standalone). Kept as a backwards-compatible knob
   * for the rare case where someone explicitly opts in via `--with-enrichment`
   * but still wants to disable it again from a wrapper script.
   */
  skipEnrichment?: boolean;
  /**
   * Opt-in flag to run the legacy OpenAI enrichment step inline with the
   * pipeline. Default behaviour (fn-14.1) is to NOT run any enrichment as
   * part of `scrape:pipeline`; pass `--with-enrichment` to restore the
   * pre-fn-14 behaviour.
   */
  withEnrichment?: boolean;
  /**
   * Skip building pgvector embeddings for /entdecken (semantic search).
   * Resume-safe + hash-gated — only new or content-changed rows are
   * embedded, so running it every cycle is cheap (~$0 for a quiet cycle).
   */
  skipEmbeddings?: boolean;
  /** Skip submitting new URLs to IndexNow + Google Indexing API. */
  skipIndexing?: boolean;
  dryRun?: boolean;
}

/** Error patterns that indicate transient/retryable failures */
export const RETRYABLE_PATTERNS = [
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'socket hang up',
  'network timeout',
  'UND_ERR_CONNECT_TIMEOUT',
  'fetch failed',
  '502',
  '503',
  '504',
  '429',
] as const;

export const MAX_RETRIES = 2;
export const RETRY_DELAYS_MS = [30_000, 60_000] as const;
