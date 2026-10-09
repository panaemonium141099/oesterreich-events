/**
 * Uhrzeit (HH:MM) aus einem Listen-Eintrag. Datumsangaben werden vorher
 * entfernt: sonst liest "14.10.2026" sich als 14:10 (Prod-Befund
 * 2026-10-06 bei gemeinden-generic, 2026-10-09 bei den Uni-Scrapern:
 * die Minute war bei fast allen Events der Monat). Ein Punkt als Trenner
 * zählt nur mit folgendem "Uhr" ("19.30 Uhr"), der Doppelpunkt immer.
 * Stunden/Minuten außerhalb des Tages gelten als keine Uhrzeit.
 */
export function extractTimeOfDay(text: string): string | null {
  // Datumsfragmente auch ohne Jahr ("9.11.") und mit Jahr entfernen.
  const withoutDates = text.replace(/\d{1,2}\.\d{1,2}\.(?:\d{2,4})?/g, ' ');
  const re = /(?<![\d:])(\d{1,2})(?::(\d{2})(?!\d)|\.(\d{2})(?=\s*Uhr))/g;
  for (const m of withoutDates.matchAll(re)) {
    const h = Number(m[1]);
    const min = Number(m[2] ?? m[3]);
    if (h <= 23 && min <= 59) return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  return null;
}
