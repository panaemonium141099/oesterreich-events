/**
 * Deskline-WebAPI-Client fuer `infrastructures` (fn-18, Task 2 / Epic E2).
 *
 * Wiederverwendet das verprobte Fetch-Muster des Event-Scrapers
 * (src/lib/scrapers/FeratelScraper.ts:444-481): Header `DW-Source:
 * desklineweb` + `DW-SessionId`, 429-Backoff via Retry-After, exponentielles
 * Retry bei sonstigen Fehlern. pageSize 400 (live verprobt 2026-07-25;
 * burgenland = 2.587 POIs in 7 Seiten), `sortingFields=name` fuer stabile
 * Pagination (ebenfalls live verprobt — ohne Sortierung ist die Seitenfolge
 * undefiniert und Rows koennten zwischen Seiten verrutschen).
 *
 * Concurrency ist Sache des Aufrufers (import-activities.ts, Pool <=6 —
 * Feratel-IP-Limit ~3500 calls/h, Epic E2); dieser Client holt EINE Region
 * sequenziell Seite fuer Seite.
 */

export const DESKLINE_API_BASE = 'https://webapi.deskline.net';
export const DESKLINE_DW_SOURCE = 'desklineweb';
export const DESKLINE_PAGE_SIZE = 400;

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const BETWEEN_PAGES_DELAY_MS = 300;
/** Harte Obergrenze gegen Endlos-Pagination bei kaputtem paging-Block
 *  (groesste Region blsalzb = ~11.600 POIs = 29 Seiten a 400). */
const MAX_PAGES_PER_REGION = 200;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Feldliste = bekanntes Schema aus der Live-Verprobung (Task-Spec):
 * id, name, type, topics, location{town,coordinate}, openingTimes,
 * openStatus, images{copyright,license,author,urls}, plainDescriptions,
 * guestCards, onlineBookable.
 *
 * plainDescriptions: der `types:`-Parameter wird vom Endpoint ignoriert
 * (live gesehen 2026-07-25 — Response enthaelt trotzdem alle Typen);
 * die Auswahl 41 (Kurztext) / 42 (Langtext) passiert client-seitig im
 * Transform (ingest-transform.ts).
 * images: sizes:[10] = grosses Bild (~1200px, gleiche Wahl wie der
 * Event-Scraper, dort ausgemessen 2026-05-26), count:3 fuer Detailseiten.
 */
export const INFRASTRUCTURE_FIELDS = [
  'id',
  'name',
  'type',
  'onlineBookable',
  'openStatus',
  'openingTimes{dateFrom,dateTo,timeFrom,timeTo,weekdays}',
  'topics{id,name}',
  'location{town,coordinate{name,long,lat}}',
  'images(count:3,sizes:[10]){copyright,license,author,urls}',
  'plainDescriptions{description,type}',
  'guestCards{id,name,type,webLink}',
].join(',');

// ── Response-Typen (Fremddaten — Felder bewusst optional/nullable) ──────────

export interface DesklineTopic {
  id?: string;
  name?: string;
}

export interface DesklineOpeningTime {
  dateFrom?: string;
  dateTo?: string;
  timeFrom?: string;
  timeTo?: string;
  weekdays?: number;
}

export interface DesklineImage {
  copyright?: string | null;
  license?: string | null;
  author?: string | null;
  urls?: string[] | null;
}

export interface DesklinePlainDescription {
  description?: string | null;
  type?: number;
}

export interface DesklineGuestCard {
  id?: string;
  name?: string;
  type?: number | string;
  webLink?: string | null;
}

export interface DesklineInfrastructure {
  id?: string;
  name?: string;
  type?: number;
  onlineBookable?: boolean;
  openStatus?: number;
  openingTimes?: DesklineOpeningTime[] | null;
  topics?: DesklineTopic[] | null;
  location?: {
    town?: string | null;
    coordinate?: { name?: string; long?: number; lat?: number } | null;
  } | null;
  images?: DesklineImage[] | null;
  plainDescriptions?: DesklinePlainDescription[] | null;
  guestCards?: DesklineGuestCard[] | null;
}

interface DesklineInfraResponse {
  data: DesklineInfrastructure[];
  paging: {
    pageNo: number;
    pageSize: number;
    pageCount: number;
    totalRecordCount: number;
  };
}

/** Session-ID im Format des Deskline-Widgets (wie FeratelScraper). */
export function generateDesklineSessionId(): string {
  return `L${Date.now()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ein API-Call mit 429-Backoff analog FeratelScraper.ts:444-481:
 * 429 -> Retry-After abwarten (Retry zaehlt nicht als Fehlversuch-Delay),
 * sonstige Fehler -> exponentielles Backoff, nach MAX_RETRIES wird geworfen
 * (der Aufrufer zaehlt die Region dann als failed — Run-Bookkeeping E6).
 */
async function fetchDesklinePage(url: string, sessionId: string): Promise<DesklineInfraResponse> {
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'DW-Source': DESKLINE_DW_SOURCE,
          'DW-SessionId': sessionId,
          'User-Agent': USER_AGENT,
        },
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body.substring(0, 200)}`);
      }

      return (await response.json()) as DesklineInfraResponse;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
      }
    }
  }
  throw new Error(`Deskline fetch failed after ${MAX_RETRIES} attempts: ${lastError}`);
}

/**
 * Holt ALLE infrastructures einer Region (volle Pagination). Wirft bei
 * endgueltigem Fehlschlag einer Seite — halbe Regionen duerfen nie als
 * "gesehen" gelten, sonst wuerde der Prune fehlende POIs fuer verschwunden
 * halten (Epic E6: Region ganz ok oder ganz failed).
 */
export async function fetchRegionInfrastructures(
  regionCode: string,
  sessionId: string,
  log?: (msg: string) => void,
): Promise<DesklineInfrastructure[]> {
  const items: DesklineInfrastructure[] = [];
  let pageNo = 0;
  let pageCount = 1;

  while (pageNo < pageCount && pageNo < MAX_PAGES_PER_REGION) {
    const url =
      `${DESKLINE_API_BASE}/${regionCode}/de/infrastructures` +
      `?fields=${INFRASTRUCTURE_FIELDS}&sortingFields=name&pageNo=${pageNo}&pageSize=${DESKLINE_PAGE_SIZE}`;

    const response = await fetchDesklinePage(url, sessionId);
    if (!Array.isArray(response.data)) {
      throw new Error(`Deskline ${regionCode}: malformed response (no data array) on page ${pageNo}`);
    }

    pageCount = response.paging?.pageCount ?? pageNo + 1;
    items.push(...response.data);
    pageNo++;

    if (pageNo < pageCount) {
      await sleep(BETWEEN_PAGES_DELAY_MS);
    }
  }

  log?.(`[deskline] ${regionCode}: ${items.length} infrastructures (${pageNo} pages)`);
  return items;
}
