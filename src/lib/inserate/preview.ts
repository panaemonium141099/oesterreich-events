/**
 * Vorschau eines Inserats: dieselbe `events`-Zeile, die die Freigabe
 * anlegen würde, nur als Objekt für die Detail-Komponente statt als Insert.
 *
 * REIN — baut auf `buildEventRow` auf, damit Vorschau und veröffentlichtes
 * Event nie auseinanderlaufen: jede Regel (Adresse, Bundesland, Quelle,
 * Veranstalter) gilt automatisch für beide.
 */

import type { Event } from '@/types/events';
import { buildEventRow, type ApprovableSubmission, type ApproveOptions } from './approve';

export function buildPreviewEvent(
  submission: ApprovableSubmission,
  options: ApproveOptions = {},
): Event {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const row = buildEventRow(submission, { ...options, now });
  return {
    ...(row as Omit<Event, 'id' | 'created_at' | 'updated_at'>),
    // Die Einreichung hat eine gültige UUID; die Detail-Komponente fragt
    // damit den persönlichen Kontext ab, der für eine Nicht-Event-ID still
    // leer bleibt.
    id: submission.id,
    created_at: nowIso,
    updated_at: nowIso,
  };
}
