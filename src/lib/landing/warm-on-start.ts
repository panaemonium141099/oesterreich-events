/**
 * Startseite bei jedem Serverstart neu rendern.
 *
 * Der Build rendert `/` und `/en` vor und backt das Ergebnis ins Image.
 * Scheitert dort eine Abfrage (statement timeout unter Build-Last), ist die
 * Sektion im Vorrender leer, und dieser Vorrender kommt nach JEDEM Neustart
 * des Containers wieder hervor: Deploy, ISR-Guard (`/opt/app/isr-guard.sh`
 * erzeugt den Container neu und verwirft damit den Laufzeit-Cache), Reboot.
 * Der erste Besucher danach bekommt die gebackene Seite, erst der zweite
 * eine frische (stale-while-revalidate). deploy.yml rendert nur nach dem
 * Deploy neu; die anderen Neustarts rendert niemand. Deshalb macht es der
 * Server selbst, aus `src/instrumentation.ts`: warten, bis er antwortet,
 * `/api/cron/revalidate-landing` mit dem CRON_SECRET aufrufen, beide
 * Sprachfassungen zweimal abholen (der erste Abruf nach der Revalidierung
 * kann noch die alte Seite liefern und den Render nur anstoßen).
 *
 * Nie werfen: ein Fehler hier darf den Serverstart nicht stören. Aus mit
 * `LANDING_WARM_ON_START=off`.
 */

import { LANDING_PATHS } from './revalidate-landing';

export interface WarmDeps {
  fetch: (url: string, init?: { headers?: Record<string, string> }) => Promise<{ status: number }>;
  sleep: (ms: number) => Promise<void>;
  log: (message: string) => void;
  env: Record<string, string | undefined>;
}

export type WarmResult =
  | { outcome: 'skipped'; reason: 'off' | 'no_secret' }
  | { outcome: 'not_reachable'; attempts: number }
  | { outcome: 'warmed'; rounds: number; statuses: Record<string, number[]> }
  | { outcome: 'failed'; rounds: number; statuses: Record<string, number[]> };

/** Warten auf /api/health: Takt und Höchstzahl der Versuche. */
export const HEALTH_POLL_MS = 2_000;
export const HEALTH_POLL_MAX = 30;
/** Runden Revalidieren + Abholen; zwischen zwei Runden diese Pause. */
export const WARM_ROUNDS = 3;
export const WARM_ROUND_PAUSE_MS = 30_000;

const UA = 'lt-warm-on-start';

const defaultDeps = (): WarmDeps => ({
  fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  log: (message) => console.log(`[landing-warm] ${message}`),
  env: process.env,
});

export async function warmLandingOnStart(deps: WarmDeps = defaultDeps()): Promise<WarmResult> {
  try {
    return await run(deps);
  } catch (err) {
    deps.log(`abgebrochen: ${err instanceof Error ? err.message : String(err)}`);
    return { outcome: 'failed', rounds: 0, statuses: {} };
  }
}

async function run(deps: WarmDeps): Promise<WarmResult> {
  if (deps.env.LANDING_WARM_ON_START === 'off') return { outcome: 'skipped', reason: 'off' };
  const secret = deps.env.CRON_SECRET;
  if (!secret) {
    deps.log('CRON_SECRET fehlt, Startseite wird nicht neu gerendert');
    return { outcome: 'skipped', reason: 'no_secret' };
  }
  const base = `http://127.0.0.1:${deps.env.PORT ?? '3000'}`;
  const status = (url: string, headers: Record<string, string> = {}) =>
    deps.fetch(url, { headers: { 'User-Agent': UA, ...headers } }).then((r) => r.status, () => 0);

  // Der Server hört erst nach register(); warten, bis /api/health antwortet.
  for (let attempt = 1; ; attempt++) {
    await deps.sleep(HEALTH_POLL_MS);
    if (await status(`${base}/api/health`) === 200) break;
    if (attempt >= HEALTH_POLL_MAX) {
      deps.log(`Server antwortet nach ${attempt} Versuchen nicht, kein Neu-Render`);
      return { outcome: 'not_reachable', attempts: attempt };
    }
  }

  let statuses: Record<string, number[]> = {};
  for (let round = 1; round <= WARM_ROUNDS; round++) {
    if (round > 1) await deps.sleep(WARM_ROUND_PAUSE_MS);
    statuses = {};
    const revalidate = await status(`${base}/api/cron/revalidate-landing`, { Authorization: `Bearer ${secret}` });
    statuses.revalidate = [revalidate];
    let ok = revalidate === 200;
    for (const path of LANDING_PATHS) {
      statuses[path] = [];
      for (let i = 0; i < 2; i++) {
        const s = await status(`${base}${path}`);
        statuses[path].push(s);
        ok &&= s === 200;
      }
    }
    deps.log(`Runde ${round}: ${JSON.stringify(statuses)}`);
    if (ok) return { outcome: 'warmed', rounds: round, statuses };
  }
  deps.log('Startseite nicht neu gerendert, letzte Runde fehlgeschlagen');
  return { outcome: 'failed', rounds: WARM_ROUNDS, statuses };
}
