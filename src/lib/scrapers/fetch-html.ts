/**
 * Geschützter HTML-Abruf für Seiten, die ein Scraper selbst gefunden hat
 * (Kalenderliste, Folgeseite, Monatsansicht, Detailseite).
 *
 * Bis 2026-10 las jeder dieser Abrufe die Antwort ungeprüft komplett als
 * Text: Strobls "Voranschlag 2026" (GetDocument.ashx, application/pdf,
 * 77,7 MB, keine .pdf-Endung in der URL) ging als "Seite 2" durch cheerio
 * und riss den Scrape-Shard mit 4,3 GB Heap ab. Hier kommt nur HTML durch:
 * Content-Type text/html oder XHTML, Content-Length und tatsächlich
 * gelesene Bytes unter `maxBytes`. Alles andere bricht ab, bevor der Body
 * gelesen ist, und meldet den Grund.
 */

/** Obergrenze für eine HTML-Seite. Kalenderlisten der Stichprobe 2026-10: höchstens 0,6 MB. */
export const MAX_HTML_BYTES = 5 * 1024 * 1024;

const HTML_TYPE = /^\s*(text\/html|application\/xhtml\+xml)\s*(;|$)/i;
const XML_TYPE = /^\s*(text|application)\/xml\s*(;|$)/i;

export interface FetchHtmlOptions {
  timeoutMs: number;
  headers?: Record<string, string>;
  maxBytes?: number;
}

export interface FetchHtmlResult {
  html: string | null;
  /** Grund, wenn `html` null ist: "HTTP 404", "timeout", "kein HTML (application/pdf)", "zu groß (…)" */
  error?: string;
  /** Ein zweiter Versuch ändert nichts: kein HTML, zu groß, HTTP 4xx */
  permanent?: boolean;
}

export async function fetchHtml(url: string, opts: FetchHtmlOptions): Promise<FetchHtmlResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: opts.headers });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      controller.abort();
      return { html: null, error: `HTTP ${response.status}`, permanent: response.status < 500 && response.status !== 429 };
    }
    const result = await readHtml(response, { maxBytes: opts.maxBytes });
    if (result.html === null) controller.abort();
    return result;
  } catch (err) {
    if (controller.signal.aborted) return { html: null, error: 'timeout' };
    const msg = err instanceof Error ? err.message : String(err);
    return { html: null, error: msg.substring(0, 80) };
  } finally {
    clearTimeout(timer);
  }
}

export interface ReadHtmlOptions {
  maxBytes?: number;
  /** Auch text/xml bzw. application/xml annehmen (sitemap.xml) */
  xml?: boolean;
}

/**
 * Body einer schon erhaltenen 2xx-Antwort lesen, aber nur HTML bis `maxBytes`.
 * Alles andere wird verworfen, bevor der Body gelesen ist. Für Abrufe mit
 * eigener Weiterleitungs-Logik (gem2go, Homepage-Suche); sonst `fetchHtml`.
 */
export async function readHtml(response: Response, opts: ReadHtmlOptions = {}): Promise<FetchHtmlResult> {
  const maxBytes = opts.maxBytes ?? MAX_HTML_BYTES;
  const discard = async (error: string): Promise<FetchHtmlResult> => {
    await response.body?.cancel().catch(() => undefined);
    return { html: null, error, permanent: true };
  };

  const type = response.headers.get('content-type');
  if (type && !HTML_TYPE.test(type) && !(opts.xml && XML_TYPE.test(type))) {
    return discard(`kein HTML (${type.split(';')[0].trim()})`);
  }
  const length = Number(response.headers.get('content-length'));
  if (length > maxBytes) return discard(`zu groß (${length} Bytes)`);

  const body = await readCapped(response, maxBytes);
  if (!body) return { html: null, error: `zu groß (über ${maxBytes} Bytes)`, permanent: true };
  if (!type && looksBinary(body)) return { html: null, error: 'kein HTML (binär)', permanent: true };
  // Wie response.text(): UTF-8, BOM entfernt
  return { html: new TextDecoder().decode(body) };
}

/** Body lesen, Abbruch sobald mehr als `maxBytes` ankommen (fehlende oder falsche Content-Length). */
async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Ohne Content-Type: PDF-Kopf oder Nullbytes am Anfang sind kein HTML. */
function looksBinary(body: Uint8Array): boolean {
  const head = body.subarray(0, 1024);
  return Buffer.from(head.subarray(0, 5)).toString('latin1') === '%PDF-' || head.includes(0);
}
