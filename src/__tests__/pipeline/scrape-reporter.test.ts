import { describe, it, expect } from 'vitest';
import { computeFinalStatus, buildGitHubSummary } from '@/lib/scrape-reporter';
import type { PipelineResults, StepResult } from '@/lib/pipeline/scrape-pipeline-types';

describe('computeFinalStatus', () => {
  it('returns success when all steps succeeded', () => {
    const steps: Record<string, StepResult> = {
      scrapers: { status: 'success', duration_ms: 1000 },
      venues: { status: 'success', duration_ms: 500 },
      normalize: { status: 'success', duration_ms: 200 },
    };
    expect(computeFinalStatus(steps, 0)).toBe('success');
  });

  it('returns partial_failure when scrapers partially failed', () => {
    const steps: Record<string, StepResult> = {
      scrapers: { status: 'partial_failure', duration_ms: 1000, succeeded: 138, failed: 3 },
      venues: { status: 'success', duration_ms: 500 },
    };
    expect(computeFinalStatus(steps, 3)).toBe('partial_failure');
  });

  it('returns failed when a critical step failed', () => {
    const steps: Record<string, StepResult> = {
      scrapers: { status: 'success', duration_ms: 1000 },
      normalize: { status: 'failed', duration_ms: 100, error: 'crash' },
    };
    expect(computeFinalStatus(steps, 0)).toBe('failed');
  });

  it('returns partial_failure when only scrapers had errors', () => {
    const steps: Record<string, StepResult> = {
      scrapers: { status: 'success', duration_ms: 1000 },
    };
    expect(computeFinalStatus(steps, 5)).toBe('partial_failure');
  });
});

describe('buildGitHubSummary', () => {
  it('produces markdown with status and step table', () => {
    const results: PipelineResults = {
      trigger: 'cron',
      run_id: 'test-id',
      started_at: '2026-04-09T03:17:00Z',
      finished_at: '2026-04-09T04:30:00Z',
      steps: {
        scrapers: { status: 'success', duration_ms: 3600000, succeeded: 141, failed: 0 },
      },
      scraper_results: [],
      total_events_scraped: 5000,
      total_events_updated: 200,
      total_errors: 0,
      github_run_id: '12345',
      github_run_url: 'https://github.com/test/actions/runs/12345',
      dry_run: false,
    };
    const md = buildGitHubSummary(results);
    expect(md).toContain('Scrape Pipeline');
    expect(md).toContain('5000');
    expect(md).toContain('scrapers');
  });
});
