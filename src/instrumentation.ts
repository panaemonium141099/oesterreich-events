/**
 * Next-Instrumentation: läuft einmal je Serverinstanz, auch im Edge-Bundle
 * der Middleware. Deshalb KEIN Import außerhalb des Node-Zweigs (Ausfall
 * 2026-09-10: node:path im Edge-Bundle) und nur dynamisch.
 *
 * Aufgabe: die Startseite nach jedem Start neu rendern, damit nicht der
 * Vorrender aus dem Build (Sektionen leer, wenn dort eine Abfrage im
 * statement timeout lag) eine Stunde lang ausgespielt wird
 * (`src/lib/landing/warm-on-start.ts`).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.NODE_ENV !== 'production') return;
  const { warmLandingOnStart } = await import('@/lib/landing/warm-on-start');
  // Nicht awaiten: der Server soll sofort antworten, das Warmlaufen wartet selbst auf ihn.
  void warmLandingOnStart();
}
