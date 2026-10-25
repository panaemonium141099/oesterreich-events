/**
 * Gesperrte Personen (Entscheidung des Betreibers, 2026-10-25).
 *
 * Veranstaltungen, die eine dieser Personen im Titel nennen, nimmt die
 * Plattform nicht auf: der Freigabevertrag (`evaluateAdmission`) verwirft
 * die Zeile, der Sync schreibt sie also nie; die nächtliche Nachprüfung im
 * Bestand (`admission_recheck`) hält jede trotzdem vorhandene Zeile zurück
 * und der Dedup gibt kein Duplikat als Ersatz frei (`contentQuarantineReasons`).
 *
 * Geprüft wird NUR der Titel, als ganzes Wort: Beschreibungen anderer
 * Events dürfen den Namen nennen (Preisträger-Historie eines
 * Kabarettpreises, Festival-Rückblick), diese Events bleiben.
 *
 * REIN — kein I/O.
 */

interface BlockedPerformer {
  /** Anzeigename für Protokoll und Tests. */
  label: string;
  /** Alle Schreibweisen, unter denen die Person in Titeln auftaucht. */
  patterns: RegExp[];
}

/** `\b` kennt kein ü — deshalb Buchstaben-Lookarounds mit Unicode-Klasse. */
const word = (name: string): RegExp => new RegExp(`(?<!\\p{L})${name}(?!\\p{L})`, 'iu');

export const BLOCKED_PERFORMERS: readonly BlockedPerformer[] = [
  {
    label: 'Gunkl',
    // Künstlername (auch Genitiv „Gunkls“), bürgerlicher Name.
    patterns: [word('gunkls?'), word('g[üu]nther\\s+paal')],
  },
];

/** Name der gesperrten Person im Titel, sonst `null`. */
export function blockedPerformerIn(title: string | null | undefined): string | null {
  if (!title) return null;
  for (const p of BLOCKED_PERFORMERS) {
    if (p.patterns.some(re => re.test(title))) return p.label;
  }
  return null;
}

export function isBlockedPerformer(title: string | null | undefined): boolean {
  return blockedPerformerIn(title) !== null;
}
