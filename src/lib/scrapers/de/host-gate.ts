/**
 * Abrufe je Website über alle DE-Adapter eines Prozesses (fn-29.18).
 *
 * Jeder Adapter hält seine eigene Pause (Crawl-delay, mindestens 1 s). Im
 * Nachtlauf laufen aber mehrere Adapter in einem Shard gleichzeitig, und
 * einige Websites lesen zwei Adapter (amt-sn.de: ionas und tribe;
 * kalender.digital: Events Manager und communice). Ohne gemeinsame Sperre
 * träfen sie dieselbe Website parallel und hielten die Pause nicht ein;
 * verwaltungsportal.de sperrte bei parallelen Abrufen die IP (fn-29.11).
 *
 * Hier wartet jeder Abruf, bis der vorige Abruf derselben Website fertig ist
 * und dessen Pause verstrichen ist. Über Shards hinweg sorgt die Aufteilung
 * dafür, dass Adapter mit gemeinsamer Website im selben Shard laufen
 * (`nachtlauf.ts`). robots.txt liest der Prozess je Website einmal.
 */

interface HostState {
  /** Ende des letzten Abrufs dieser Website (inklusive Wartezeit). */
  tail: Promise<void>;
  /** Frühester Beginn des nächsten Abrufs (ms). */
  nextAt: number;
}

const hosts = new Map<string, HostState>();
const robots = new Map<string, Promise<string | null>>();

/** Website eines Abrufs: Host ohne „www.", damit beide Schreibweisen eine Sperre teilen. */
export function hostKey(url: string): string {
  return new URL(url).host.toLowerCase().replace(/^www\./, '');
}

/**
 * `run` ausführen, sobald die Website frei ist: kein anderer Abruf derselben
 * Website läuft, und seit dem letzten sind `gapMs` vergangen. Danach gilt
 * die Pause `gapMs` für den nächsten Abruf, auch wenn `run` fehlschlägt.
 */
export async function throughHostGate<T>(url: string, gapMs: number, run: () => Promise<T>): Promise<T> {
  const key = hostKey(url);
  const state = hosts.get(key) ?? { tail: Promise.resolve(), nextAt: 0 };
  hosts.set(key, state);
  const prev = state.tail;
  let release!: () => void;
  state.tail = new Promise<void>(r => { release = r; });
  await prev;
  try {
    const wait = state.nextAt - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    return await run();
  } finally {
    state.nextAt = Date.now() + gapMs;
    release();
  }
}

/** robots.txt einer Website, je Prozess einmal gelesen (null = keine oder nicht lesbar). */
export function sharedRobotsTxt(origin: string, load: () => Promise<string | null>): Promise<string | null> {
  let p = robots.get(origin);
  if (!p) {
    p = load();
    robots.set(origin, p);
  }
  return p;
}

/** Nur für Tests: Zustand zurücksetzen. */
export function resetHostGate(): void {
  hosts.clear();
  robots.clear();
}
