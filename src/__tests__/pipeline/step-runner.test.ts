import { describe, it, expect, vi } from 'vitest';
import { runStep, shouldSkipStep, STEP_DEPENDENCIES } from '@/lib/pipeline/step-runner';
import type { StepResult } from '@/lib/pipeline/scrape-pipeline-types';

describe('STEP_DEPENDENCIES', () => {
  it('scrapers has no dependencies', () => {
    expect(STEP_DEPENDENCIES.scrapers).toEqual([]);
  });

  it('geocoding depends on normalize', () => {
    expect(STEP_DEPENDENCIES.geocoding).toContain('normalize');
  });

  it('scoring depends on normalize', () => {
    expect(STEP_DEPENDENCIES.scoring).toContain('normalize');
  });

  it('report has no dependencies', () => {
    expect(STEP_DEPENDENCIES.report).toEqual([]);
  });
});

describe('shouldSkipStep', () => {
  it('returns null for steps with no dependencies', () => {
    const completed: Record<string, StepResult> = {};
    expect(shouldSkipStep('scrapers', completed)).toBeNull();
  });

  it('returns null when dependency succeeded', () => {
    const completed: Record<string, StepResult> = {
      normalize: { status: 'success', duration_ms: 1000 },
    };
    expect(shouldSkipStep('geocoding', completed)).toBeNull();
  });

  it('returns null when dependency had partial_failure', () => {
    const completed: Record<string, StepResult> = {
      normalize: { status: 'partial_failure', duration_ms: 1000 },
    };
    expect(shouldSkipStep('geocoding', completed)).toBeNull();
  });

  it('returns skip reason when dependency failed', () => {
    const completed: Record<string, StepResult> = {
      normalize: { status: 'failed', duration_ms: 1000, error: 'Connection refused' },
    };
    const reason = shouldSkipStep('geocoding', completed);
    expect(reason).toContain('normalize failed');
  });

  it('returns skip reason when dependency was skipped', () => {
    const completed: Record<string, StepResult> = {
      normalize: { status: 'skipped_dependency', duration_ms: 0, reason: 'something' },
    };
    expect(shouldSkipStep('geocoding', completed)).toContain('normalize');
  });
});

describe('runStep', () => {
  it('runs function and returns success result', async () => {
    const fn = vi.fn().mockResolvedValue({ extra: 42 });
    const result = await runStep('scrapers', fn, {});
    expect(result.status).toBe('success');
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('returns failed result on error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await runStep('scrapers', fn, {});
    expect(result.status).toBe('failed');
    expect(result.error).toBe('boom');
  });

  it('returns skipped_dependency when dependency failed', async () => {
    const fn = vi.fn();
    const completed: Record<string, StepResult> = {
      normalize: { status: 'failed', duration_ms: 100, error: 'crash' },
    };
    const result = await runStep('geocoding', fn, completed);
    expect(result.status).toBe('skipped_dependency');
    expect(result.reason).toContain('normalize failed');
    expect(fn).not.toHaveBeenCalled();
  });
});
