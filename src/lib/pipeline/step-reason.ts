// src/lib/pipeline/step-reason.ts

/**
 * Grund für einen roten Pipeline-Schritt. scrape-pipeline.ts übergibt jedem
 * Kindprozess eine Datei (STEP_REASON_FILE); was das Skript hineinschreibt,
 * steht im Fehler des Schritts und damit in der Alarm-Mail. Ohne Pipeline
 * (Aufruf von Hand) passiert nichts.
 */

import { writeFileSync } from 'node:fs';

export function reportStepReason(message: string): void {
  const file = process.env.STEP_REASON_FILE;
  if (!file) return;
  try {
    writeFileSync(file, message);
  } catch {
    // Der Grund ist Zusatz; der Exit-Code meldet den Fehler ohnehin.
  }
}
