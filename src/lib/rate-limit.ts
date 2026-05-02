/**
 * In-memory sliding-window rate limiter — per Function-Instance.
 *
 * Hintergrund: Pentest am 02.05.26 zeigte, dass /api/events ohne jede
 * Drosselung 5+ rapid requests beantwortet. Komplette DB scrapebar in
 * Sekunden, Vercel-Function-Invocations und Bandwidth-Bills sprengbar.
 *
 * Diese Implementation ist absichtlich einfach: ein Map<key, Bucket> im
 * Memory der laufenden Function-Instance. Mit Vercel-Fluid-Compute werden
 * Instances über concurrent requests wiederverwendet — d.h. der Cache
 * persistiert über Requests hinweg, solange die Instance läuft. Beim Cold
 * Start wird zurückgesetzt; das ist OK für ein erstes Schutzlevel.
 *
 * Für echten Distributed-DDoS-Schutz später: Upstash Redis via Marketplace
 * + @upstash/ratelimit. Migration ist trivial — gleiches Interface.
 *
 * Garbage-Collection: alle 100 Insertionen werden expirte Einträge gefegt.
 * Memory-Pressure begrenzt; bei extrem hohen Rates kann Map wachsen, aber
 * Buckets sind klein (24 Bytes pro Eintrag).
 */

interface Bucket {
  /** Anzahl Requests im aktuellen Fenster. */
  count: number;
  /** Unix-ms, bei dem das Fenster läuft aus und resettet wird. */
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let opCount = 0;

export interface RateLimitResult {
  /** True wenn unter dem Limit (Request darf durch). */
  ok: boolean;
  /** Verbleibende Requests im aktuellen Fenster. */
  remaining: number;
  /** Wann das Fenster resettet (Unix-ms). */
  resetAt: number;
}

/**
 * Prüft + erhöht den Counter für `key`. Sliding-window.
 *
 * @param key      Eindeutige Identifier (z.B. `${ip}:${path}`).
 * @param limit    Max requests im Fenster.
 * @param windowMs Fenster-Größe in ms.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    const fresh: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    sweepIfNeeded(now);
    return { ok: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

function sweepIfNeeded(now: number): void {
  opCount++;
  if (opCount % 100 !== 0) return;
  for (const [k, v] of buckets) {
    if (now >= v.resetAt) buckets.delete(k);
  }
}

/**
 * Liefert die best-effort Client-IP aus den Vercel-Edge-Headers.
 * `x-forwarded-for` ist eine Liste, der erste Eintrag ist der originale Client.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}
