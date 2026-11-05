/**
 * Testuhr: die ganze Suite läuft an einem festen Tag, kein Test liest die
 * echte Uhr.
 *
 * Vorher hing jeder Test, dessen Fixture einen festen Termin trug, am echten
 * Datum: war der Termin vorbei, hielt der Freigabevertrag die Zeile als
 * start_in_past, der Test wurde rot und das Test-Gate stoppte jedes Deploy
 * (03.11. und 05.11.2026, zusammen 14 Testdateien, bis dahin je Datei von
 * Hand eingefroren).
 *
 * Gestellt ist nur `Date`, und es steht; setTimeout und Co. laufen echt.
 *  - Anderer Tag: die Datei stellt die Uhr selbst
 *    (`vi.useFakeTimers({ toFake: ['Date'], now })` oder `vi.setSystemTime`).
 *  - `vi.useRealTimers()` gibt die echten Timer zurück, die Uhr fällt dabei
 *    auf den Testtag, nie auf die echte Uhr.
 *  - Misst ein Test Dauern über `Date.now()`, ruft er `useRealClock()`.
 */
import { vi } from 'vitest';

/**
 * Tag der Einführung, sonst ohne Bedeutung. Wer ihn ändert, ändert das
 * Ergebnis jedes Tests ohne eigene Uhr.
 */
export const TEST_NOW = new Date('2026-11-05T12:00:00Z');

const realTimers = vi.useRealTimers.bind(vi);

function freeze(): void {
  vi.useFakeTimers({ toFake: ['Date'], now: TEST_NOW });
}

/** Einmal je Testdatei aus `setup.ts`, vor dem Laden der Datei. */
export function installTestClock(): void {
  vi.useRealTimers = () => {
    realTimers();
    freeze();
    return vi;
  };
  freeze();
}

/**
 * Echte, laufende Uhr bis zum Ende des Tests. Nur für Tests, die Dauern
 * messen (Pausen, Deadlines) und denen das Datum gleich ist; im Test selbst
 * aufrufen.
 */
export function useRealClock(): void {
  realTimers();
}

/** Nach jedem Test: zurück auf die Testuhr, falls er die echte Uhr nahm. */
export function restoreTestClock(): void {
  if (!vi.isFakeTimers()) freeze();
}
