/**
 * fetch mit harter Deadline via AbortController.
 *
 * Root-Cause 2026-04-29 (seo_snapshots-Rows brachen an dem Tag schlagartig
 * ab, ohne Code- oder Config-Änderung): Die GSC-/CrUX-Clients fetchten
 * OHNE Timeout. Hängt ein Google-Endpoint (Verbindung offen, keine
 * Antwort — typisch bei Rate-Limiting/Token-Problemen/Netzwerkdegradation),
 * hängt `await fetch` unbegrenzt. Die try/catch-Blöcke in buildSnapshot
 * fangen nur Rejections, NICHT einen Hang → buildSnapshot läuft ins
 * 60s-Vercel-Funktionslimit, die Invocation wird mit 504 gekillt BEVOR
 * writeSnapshot() jemals den Row schreibt. Ergebnis: kein Row, aber auch
 * kein sichtbarer Fehler (die Route swallowed alles und gibt 200).
 *
 * Der Timeout verwandelt einen Hang in eine gefangene Rejection: der
 * betroffene Collector wird übersprungen, buildSnapshot liefert die
 * übrigen (Teil-)Metriken, writeSnapshot schreibt den Row. Damit kann der
 * Cron nie wieder still an einem Hang sterben — jeder Lauf hinterlässt
 * mindestens einen Heartbeat-Row.
 */
export const SEO_FETCH_TIMEOUT_MS = 10_000;

export function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = SEO_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`[seo/http] fetch timed out nach ${timeoutMs}ms: ${url}`)),
    timeoutMs,
  );
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}
