'use client';

/**
 * Wiener Kalendertag für Client-Inseln der Tagesausgabe (fn-30).
 *
 * Die Startseite wird zur ISR-Zeit gerendert; nach Mitternacht stimmt der
 * im HTML stehende Tag nicht mehr. `DateLine` rechnet den Tag im Browser
 * neu und meldet ihn hier an; Programmliste und andere Inseln lesen ihn
 * über `useViennaDay`. Der zuletzt gemeldete Tag bleibt im Modul stehen,
 * damit eine Insel, die erst nach der Meldung abonniert, nicht den alten
 * Server-Tag behält (Effekte der Geschwister laufen nacheinander).
 */

import { useEffect, useState } from 'react';

export const VIENNA_DAY_EVENT = 'lasstreffen:vienna-day';

let currentDay: string | null = null;

/** Zuletzt im Browser gemeldeter Wiener Tag, null vor der ersten Meldung. */
export function announcedViennaDay(): string | null {
  return currentDay;
}

/** Meldet den neu berechneten Wiener Tag an alle Inseln (nur im Browser). */
export function announceViennaDay(day: string): void {
  currentDay = day;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(VIENNA_DAY_EVENT, { detail: { day } }));
}

/** Nur für Tests: Modulzustand zurücksetzen. */
export function resetViennaDayForTests(): void {
  currentDay = null;
}

/**
 * Aktueller Wiener Tag: beginnt mit dem Server-Tag der Ausgabe (gleiches
 * HTML wie der Server, keine Hydrations-Warnung) und folgt danach der
 * DateLine.
 */
export function useViennaDay(initial: string): string {
  const [day, setDay] = useState(initial);

  useEffect(() => {
    if (currentDay) setDay(currentDay);
    const onDay = (e: Event) => {
      const next = (e as CustomEvent<{ day?: string }>).detail?.day;
      if (next) setDay(next);
    };
    window.addEventListener(VIENNA_DAY_EVENT, onDay);
    return () => window.removeEventListener(VIENNA_DAY_EVENT, onDay);
  }, []);

  return day;
}
