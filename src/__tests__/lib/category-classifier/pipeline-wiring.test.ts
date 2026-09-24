import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { STEP_DEPENDENCIES } from '@/lib/pipeline/step-runner';

describe('scrape-pipeline wiring (cat-v2)', () => {
  it('declares categorization_backfill and categorization in STEP_DEPENDENCIES', () => {
    expect(STEP_DEPENDENCIES.categorization_backfill).toBeDefined();
    expect(STEP_DEPENDENCIES.categorization_backfill).toContain('normalize');
    expect(STEP_DEPENDENCIES.categorization).toBeDefined();
    expect(STEP_DEPENDENCIES.categorization).toContain('normalize');
    expect(STEP_DEPENDENCIES.categorization).toContain('categorization_backfill');
  });

  it('deterministic backfill is the only categorization step (no AI step since fn KI-Ende 2026-07)', () => {
    const file = readFileSync(join(process.cwd(), 'src/scripts/scrape-pipeline.ts'), 'utf8');
    expect(file.indexOf("runStep('categorization_backfill'")).toBeGreaterThan(-1);
    expect(file.indexOf("runStep('categorization'")).toBe(-1);
  });

  it('pipeline passes --deterministic-backfill to the backfill sub-step', () => {
    const file = readFileSync(join(process.cwd(), 'src/scripts/scrape-pipeline.ts'), 'utf8');
    expect(file).toMatch(/categorize-events\.ts --deterministic-backfill/);
  });

  it('categorization_backfill runs before address geocoding', () => {
    const file = readFileSync(join(process.cwd(), 'src/scripts/scrape-pipeline.ts'), 'utf8');
    const bIdx = file.indexOf("runStep('categorization_backfill'");
    const gIdx = file.indexOf("runStep('address_geocoding'");
    expect(bIdx).toBeGreaterThan(-1);
    expect(gIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeLessThan(gIdx);
  });

  it('supports --skip-categorization-backfill flag', () => {
    const file = readFileSync(join(process.cwd(), 'src/scripts/scrape-pipeline.ts'), 'utf8');
    expect(file).toMatch(/skipCategorizationBackfill/);
    expect(file).toMatch(/--skip-categorization-backfill/);
  });

  it('supports --skip-categorization flag (gates both sub-steps)', () => {
    const file = readFileSync(join(process.cwd(), 'src/scripts/scrape-pipeline.ts'), 'utf8');
    expect(file).toMatch(/skipCategorization\b/);
    expect(file).toMatch(/--skip-categorization\b/);
  });

  it('AI residue mode filters on hard-case signals', () => {
    const file = readFileSync(join(process.cwd(), 'src/scripts/categorize-events.ts'), 'utf8');
    expect(file).toMatch(/category_needs_review\.eq\.true/);
    expect(file).toMatch(/category_version\.is\.null/);
    expect(file).toMatch(/category_version\.neq\./);
    expect(file).toMatch(/category\.eq\.Sonstiges/);
  });

  it('deterministic-backfill mode filters on stale version', () => {
    const file = readFileSync(join(process.cwd(), 'src/scripts/categorize-events.ts'), 'utf8');
    expect(file).toMatch(/deterministicBackfill/);
    expect(file).toMatch(/CLASSIFIER_VERSION_PREFIX/);
  });

  it('deterministic-backfill mode skips OpenAI client init', () => {
    const file = readFileSync(join(process.cwd(), 'src/scripts/categorize-events.ts'), 'utf8');
    // Ensure the conditional guard exists.
    expect(file).toMatch(/opts\.deterministicBackfill/);
    expect(file).toMatch(/if \(opts\.deterministicBackfill\) return null;/);
  });

  it('package.json exposes the scripts used by the pipeline', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts['categorize-events']).toBeDefined();
    expect(pkg.scripts['scrape:pipeline']).toBeDefined();
  });
});
