import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { STEP_DEPENDENCIES } from '@/lib/pipeline/step-runner';

describe('scrape-pipeline wiring', () => {
  it('declares a categorization step that depends on normalize', () => {
    expect(STEP_DEPENDENCIES.categorization).toBeDefined();
    expect(STEP_DEPENDENCIES.categorization).toContain('normalize');
  });

  it('scrape-pipeline.ts invokes the categorization step', () => {
    const file = readFileSync(
      join(process.cwd(), 'src/scripts/scrape-pipeline.ts'),
      'utf8',
    );
    expect(file).toMatch(/runStep\('categorization'/);
    expect(file).toMatch(/categorize-events\.ts/);
  });

  it('scrape-pipeline.ts supports the --skip-categorization flag', () => {
    const file = readFileSync(
      join(process.cwd(), 'src/scripts/scrape-pipeline.ts'),
      'utf8',
    );
    expect(file).toMatch(/skipCategorization/);
    expect(file).toMatch(/--skip-categorization/);
  });

  it('categorize-events.ts filters on hard-case signals', () => {
    const file = readFileSync(
      join(process.cwd(), 'src/scripts/categorize-events.ts'),
      'utf8',
    );
    expect(file).toMatch(/category_needs_review\.eq\.true/);
    expect(file).toMatch(/category_version\.is\.null/);
    expect(file).toMatch(/category_version\.neq\./);
    expect(file).toMatch(/category\.eq\.Sonstiges/);
  });

  it('categorization step runs before geocoding in the pipeline', () => {
    const file = readFileSync(
      join(process.cwd(), 'src/scripts/scrape-pipeline.ts'),
      'utf8',
    );
    const catIdx = file.indexOf("runStep('categorization'");
    const geoIdx = file.indexOf("runStep('geocoding'");
    expect(catIdx).toBeGreaterThan(-1);
    expect(geoIdx).toBeGreaterThan(-1);
    expect(catIdx).toBeLessThan(geoIdx);
  });

  it('package.json exposes categorize-events as an npm script', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts['categorize-events']).toBeDefined();
    expect(pkg.scripts['scrape:pipeline']).toBeDefined();
  });
});
