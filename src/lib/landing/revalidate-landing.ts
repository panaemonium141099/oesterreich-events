/**
 * Startseite (ISR, revalidate 3600) sofort neu bauen.
 *
 * Aufrufer: /api/admin/landing-feature nach jeder Buchung und
 * /api/cron/revalidate-landing um 00:05 Wien (der Wiener Tag wechselt, der
 * Tipp des Tages und das Programm „Heute Abend“ mit ihm).
 *
 * `/[locale]` als Seitenmuster trifft alle Sprachfassungen; `/` (Deutsch,
 * localePrefix 'as-needed') und `/en` zusätzlich als konkrete Pfade, damit
 * der Eintrag im Cache fällt, egal unter welchem Schlüssel er liegt.
 */

import { revalidatePath } from 'next/cache';

export const LANDING_PATHS = ['/', '/en'] as const;

export function revalidateLanding(): void {
  revalidatePath('/[locale]', 'page');
  for (const path of LANDING_PATHS) revalidatePath(path);
}
