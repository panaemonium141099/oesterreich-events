// Ein roter Pipeline-Schritt soll in der Alarm-Mail sagen, warum
// (Abschlussprüfung 2026-10-08: nur „Command failed: npx tsx …").

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reportStepReason } from '@/lib/pipeline/step-reason';

describe('reportStepReason', () => {
  const saved = process.env.STEP_REASON_FILE;
  afterEach(() => { process.env.STEP_REASON_FILE = saved; });

  it('schreibt den Grund in die vom Pipeline-Schritt übergebene Datei', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'step-')), 'reason.txt');
    process.env.STEP_REASON_FILE = file;
    reportStepReason('Sicherheitsventil: 4218 neue Duplikate > Grenze 1500');
    expect(readFileSync(file, 'utf8')).toBe('Sicherheitsventil: 4218 neue Duplikate > Grenze 1500');
  });

  it('tut ohne Pipeline nichts (Aufruf von Hand)', () => {
    delete process.env.STEP_REASON_FILE;
    expect(() => reportStepReason('x')).not.toThrow();
    expect(existsSync('reason.txt')).toBe(false);
  });
});
