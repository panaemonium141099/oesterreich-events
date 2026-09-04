/**
 * Entrypoint-Guard fuer CLI-Skripte.
 *
 * `isDirectRun(import.meta.url)` ist true, wenn das Modul der Prozess-
 * Entrypoint ist (`tsx src/scripts/foo.ts`), und false, wenn es nur
 * importiert wurde — unter Vitest zeigt `process.argv[1]` dann auf
 * `node_modules/vitest/dist/workers/forks.js`.
 *
 * Warum das noetig ist: Ein Skript, das `main()` ungeschuetzt auf
 * Top-Level aufruft, startet seine echte Arbeit (Overpass-Fetches,
 * Supabase-Queries) schon beim blossen Import. Ein Unit-Test, der nur
 * die puren Helfer aus dem Skript importiert, loest damit Netzwerk-
 * Verkehr aus; die offenen Sockets und Retry-Timer halten danach den
 * Event-Loop des Test-Workers am Leben. Vitest bekommt den Worker nicht
 * mehr beendet ("Timeout terminating forks worker"), der belegte
 * Pool-Slot hungert den Rest der Suite aus und fremde Tests reissen den
 * 5-s-Default-Timeout.
 *
 * Vgl. `src/scripts/lib/osm-venue-utils.ts`: Module, die aus Tests
 * importiert werden, muessen beim Import seiteneffektfrei sein.
 */
import { fileURLToPath } from 'url';
import { resolve } from 'path';

export function isDirectRun(moduleUrl: string): boolean {
  try {
    const entry = process.argv[1];
    if (!entry) return false;
    return resolve(fileURLToPath(moduleUrl)) === resolve(entry);
  } catch {
    // fileURLToPath wirft bei nicht-file:-URLs (z. B. Bundler-Kontexte).
    // Im Zweifel NICHT ausfuehren: ein nicht gestartetes Skript faellt
    // sofort auf, ein im Test gestartetes kostet Stunden Debugging.
    return false;
  }
}
