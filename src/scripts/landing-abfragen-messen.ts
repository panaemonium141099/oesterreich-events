/**
 * Misst die Abfragen der Startseite einzeln gegen die Datenbank (fn-31.12).
 *
 *   SITE_COUNTRY=DE npx tsx src/scripts/landing-abfragen-messen.ts
 *
 * Die Startseite stellt ihre Abfragen sonst parallel. Über 177.613 kommende
 * deutsche Events liefen fast alle in den Statement-Timeout und füllten den
 * Verbindungspool (lokale Vorschau 14.11.2026, PGRST003 auch für
 * lasstreffen.at). Dieses Skript lässt deshalb immer nur EINE Anfrage zur
 * Zeit zu und schreibt je Anfrage Dauer und Status. Nur lesend.
 *
 * `landingSkip` der Seite wird für die Messung aufgehoben, damit auch die
 * abgeschalteten Abfragen laufen.
 */
import { getSite } from '@/lib/site';

interface Sample { label: string; ms: number; status: number; rows: number | null }
const samples: Sample[] = [];

const realFetch = globalThis.fetch;
let chain: Promise<unknown> = Promise.resolve();

/** Kurzname aus der PostgREST-Adresse: Tabelle bzw. RPC plus die prägenden Filter. */
function labelOf(url: string): string {
  const u = new URL(url);
  const target = u.pathname.replace(/^.*\/rest\/v1\//, '');
  const keys = [...u.searchParams.keys()].filter(k => !['select', 'limit', 'offset'].includes(k));
  const order = u.searchParams.get('order') ?? '';
  const or = u.searchParams.get('or') ? ' or(…)' : '';
  return `${target} [${keys.filter(k => k !== 'order' && k !== 'or').join(',')}]${or}${order ? ` order=${order}` : ''} limit=${u.searchParams.get('limit') ?? '-'}`;
}

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes('/rest/v1/')) return realFetch(input, init);
  const run = async () => {
    const t0 = Date.now();
    const res = await realFetch(input, init);
    const clone = res.clone();
    let rows: number | null = null;
    try {
      const body = await clone.json();
      rows = Array.isArray(body) ? body.length : null;
    } catch { /* kein JSON */ }
    samples.push({ label: labelOf(url), ms: Date.now() - t0, status: res.status, rows });
    return res;
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}) as typeof fetch;

async function main() {
  const site = getSite();
  (site as { landingSkip: readonly string[] }).landingSkip = [];
  const { getLandingData } = await import('@/lib/v4/get-landing-data');
  const t0 = Date.now();
  try {
    await getLandingData();
    console.log(`Startseite ${site.domain}: alle Abfragen ok, ${Date.now() - t0} ms nacheinander`);
  } catch (err) {
    console.log(`Startseite ${site.domain}: ${err instanceof Error ? err.message : err}`);
  }
  for (const s of samples.sort((a, b) => b.ms - a.ms)) {
    console.log(`${String(s.ms).padStart(6)} ms  ${s.status}  ${s.rows === null ? '   -' : String(s.rows).padStart(4)}  ${s.label}`);
  }
}

main().then(() => process.exit(0));
