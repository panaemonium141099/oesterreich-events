import type {
  EventfrogEvent,
  EventfrogEventsPage,
  EventfrogLocation,
  EventfrogLocationsPage,
  EventfrogRubric,
  EventfrogRubricsPage,
} from './types';

/**
 * Client für die Eventfrog Public API v1.
 *
 * Ratenlimit laut Hilfe-Center: 30 Anfragen/Minute und 2.000/Tag je
 * Eventfrog-Konto, über ALLE Keys dieses Kontos. Deshalb ein fester
 * Abstand zwischen Anfragen und bei 429 die Wartezeit aus
 * `X-RateLimit-Retry-After-Seconds`. Ein Vollabruf AT kostet ~8 Anfragen
 * (4 Event-Seiten à 1000 + Locations in 100er-Blöcken), DE ~84 + Locations.
 */

const BASE = 'https://api.eventfrog.net/public/v1';
const PER_PAGE = 1000;
/** Höchstzahl IDs je Batch-Abfrage laut Doku ("up to 100 entities"). */
const ID_BATCH = 100;
/** 30/min → mindestens 2 s Abstand; etwas Luft für parallele Nutzer desselben Kontos. */
const MIN_GAP_MS = 2_200;
const TIMEOUT_MS = 90_000;
const MAX_RETRIES = 3;

export function eventfrogApiKey(): string | undefined {
  return process.env.EVENTFROG_API_KEY?.trim() || undefined;
}

export class EventfrogClient {
  private lastRequestAt = 0;
  /** Gezählte Anfragen, fürs Log (Tageslimit 2.000). */
  requests = 0;

  constructor(
    private readonly apiKey: string,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  private async get<T>(path: string, params: URLSearchParams): Promise<T> {
    const url = `${BASE}/${path}?${params.toString()}`;
    for (let attempt = 0; ; attempt++) {
      const wait = this.lastRequestAt + MIN_GAP_MS - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.lastRequestAt = Date.now();
      this.requests++;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return (await res.json()) as T;
      const body = await res.text().catch(() => '');
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get('x-ratelimit-retry-after-seconds'));
        await this.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 30_000);
        continue;
      }
      // 403 mit keyType ORGANIZER heißt: falscher Key-Typ (Public-API-Key nötig).
      throw new Error(`Eventfrog ${path} HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
  }

  /** Alle Events eines Landes ab `fromIso` (laufende mehrtägige Events eingeschlossen). */
  async fetchEvents(country: string, fromIso: string): Promise<EventfrogEvent[]> {
    const out: EventfrogEvent[] = [];
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ country, from: fromIso, perPage: String(PER_PAGE), page: String(page) });
      const r = await this.get<EventfrogEventsPage>('events', params);
      out.push(...r.events);
      // Kurze Seite ODER Gesamtzahl erreicht = Ende. Beides prüfen, damit
      // eine still gekappte Seite nicht als Ende durchgeht.
      if (r.events.length === 0 || out.length >= r.totalNumberOfResources) break;
    }
    return out;
  }

  async fetchLocations(ids: string[]): Promise<EventfrogLocation[]> {
    const out: EventfrogLocation[] = [];
    const unique = [...new Set(ids)];
    for (let i = 0; i < unique.length; i += ID_BATCH) {
      const params = new URLSearchParams({ perPage: String(ID_BATCH) });
      for (const id of unique.slice(i, i + ID_BATCH)) params.append('id', id);
      const r = await this.get<EventfrogLocationsPage>('locations', params);
      out.push(...r.locations);
    }
    return out;
  }

  async fetchRubrics(): Promise<EventfrogRubric[]> {
    const r = await this.get<EventfrogRubricsPage>('rubrics', new URLSearchParams());
    return r.rubrics;
  }
}
