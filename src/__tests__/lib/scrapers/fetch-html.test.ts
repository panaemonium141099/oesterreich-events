import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchHtml, MAX_HTML_BYTES } from '@/lib/scrapers/fetch-html';
import { BaseScraper } from '@/lib/scrapers/BaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Body als Stream, der mitzählt, wie viele Chunks gelesen wurden und ob er
 * abgebrochen wurde. `chunks` = Infinity simuliert einen Endlos-Download.
 */
function countingBody(chunkSize: number, chunks: number, fill = 0x41) {
  const state = { pulled: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (state.pulled >= chunks) { controller.close(); return; }
      state.pulled++;
      controller.enqueue(new Uint8Array(chunkSize).fill(fill));
    },
    cancel() { state.cancelled = true; },
  });
  return { stream, state };
}

function stubFetch(response: Response | (() => Promise<Response>)) {
  const fn = vi.fn(typeof response === 'function' ? response : async () => response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchHtml', () => {
  it('liefert HTML (text/html; charset) als Text', async () => {
    stubFetch(new Response('<html><body>Ölkürbis</body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }));
    const r = await fetchHtml('https://www.gemeinde.at/termine', { timeoutMs: 1000 });
    expect(r).toEqual({ html: '<html><body>Ölkürbis</body></html>' });
  });

  it('nimmt XHTML an', async () => {
    stubFetch(new Response('<html/>', { headers: { 'content-type': 'application/xhtml+xml' } }));
    expect((await fetchHtml('https://x.at/', { timeoutMs: 1000 })).html).toBe('<html/>');
  });

  it('Strobl: application/pdf wird abgewiesen, ohne den Body zu lesen', async () => {
    const { stream, state } = countingBody(64 * 1024, Infinity);
    stubFetch(new Response(stream, { headers: { 'content-type': 'application/pdf', 'content-length': '77669838' } }));
    const r = await fetchHtml('https://www.strobl.salzburg.at/system/web/GetDocument.ashx?fileId=2225464', { timeoutMs: 1000 });
    expect(r).toEqual({ html: null, error: 'kein HTML (application/pdf)', permanent: true });
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThanOrEqual(1);
  });

  it('Content-Length über der Obergrenze: Abbruch vor dem Lesen', async () => {
    const { stream, state } = countingBody(64 * 1024, Infinity);
    stubFetch(new Response(stream, { headers: { 'content-type': 'text/html', 'content-length': String(MAX_HTML_BYTES + 1) } }));
    const r = await fetchHtml('https://x.at/riesig', { timeoutMs: 1000 });
    expect(r.html).toBeNull();
    expect(r.error).toBe(`zu groß (${MAX_HTML_BYTES + 1} Bytes)`);
    expect(r.permanent).toBe(true);
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThanOrEqual(1);
  });

  it('ohne Content-Length: bricht beim Lesen ab, sobald die Obergrenze überschritten ist', async () => {
    const { stream, state } = countingBody(1024, Infinity);
    stubFetch(new Response(stream, { headers: { 'content-type': 'text/html' } }));
    const r = await fetchHtml('https://x.at/endlos', { timeoutMs: 1000, maxBytes: 10 * 1024 });
    expect(r).toEqual({ html: null, error: 'zu groß (über 10240 Bytes)', permanent: true });
    expect(state.cancelled).toBe(true);
    // 10 KiB erlaubt: der elfte Chunk löst den Abbruch aus (plus höchstens einer im Puffer)
    expect(state.pulled).toBeGreaterThanOrEqual(11);
    expect(state.pulled).toBeLessThanOrEqual(12);
  });

  it('ohne Content-Length unter der Obergrenze: ganzer Body', async () => {
    const { stream } = countingBody(1024, 3, 0x62);
    stubFetch(new Response(stream, { headers: { 'content-type': 'text/html' } }));
    const r = await fetchHtml('https://x.at/klein', { timeoutMs: 1000, maxBytes: 10 * 1024 });
    expect(r.html).toBe('b'.repeat(3 * 1024));
  });

  it('text/plain ist kein HTML', async () => {
    stubFetch(new Response('<html>ok</html>', { headers: { 'content-type': 'text/plain; charset=utf-8' } }));
    expect((await fetchHtml('https://x.at/a', { timeoutMs: 1000 })).error).toBe('kein HTML (text/plain)');
  });

  it('ohne Content-Type: HTML ja, PDF nein', async () => {
    const bare = (body: string) => {
      const res = new Response(body);
      res.headers.delete('content-type');
      return res;
    };
    stubFetch(bare('<html>ok</html>'));
    expect((await fetchHtml('https://x.at/b', { timeoutMs: 1000 })).html).toBe('<html>ok</html>');
    stubFetch(bare('%PDF-1.7\n%âãÏÓ'));
    expect(await fetchHtml('https://x.at/c', { timeoutMs: 1000 })).toEqual({ html: null, error: 'kein HTML (binär)', permanent: true });
  });

  it('HTTP-Fehler: 4xx dauerhaft, 5xx vorübergehend', async () => {
    stubFetch(new Response('weg', { status: 404 }));
    expect(await fetchHtml('https://x.at/404', { timeoutMs: 1000 })).toEqual({ html: null, error: 'HTTP 404', permanent: true });
    stubFetch(new Response('kaputt', { status: 503 }));
    expect(await fetchHtml('https://x.at/503', { timeoutMs: 1000 })).toEqual({ html: null, error: 'HTTP 503', permanent: false });
  });

  it('Timeout meldet "timeout"', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const r = await fetchHtml('https://x.at/langsam', { timeoutMs: 20 });
    expect(r).toEqual({ html: null, error: 'timeout' });
  });
});

class TestScraper extends BaseScraper {
  readonly name = 'test-source';
  protected delayMs = 0;
  async scrape(): Promise<ScrapedEvent[]> { return []; }
  public get = (url: string, retries?: number) => this.fetchHtml(url, { timeoutMs: 1000, retries });
  protected log(): void { /* still */ }
}

describe('BaseScraper.fetchHtml', () => {
  it('wiederholt vorübergehende Fehler', async () => {
    const responses = [new Response('x', { status: 503 }), new Response('<p>ok</p>', { headers: { 'content-type': 'text/html' } })];
    const fn = stubFetch(async () => responses.shift()!);
    const r = await new TestScraper().get('https://x.at/', 3);
    expect(r.html).toBe('<p>ok</p>');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('wiederholt kein PDF und schickt die Scraper-Header mit', async () => {
    const fn = stubFetch(async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }));
    const r = await new TestScraper().get('https://x.at/doc', 3);
    expect(r.error).toBe('kein HTML (application/pdf)');
    expect(fn).toHaveBeenCalledTimes(1);
    const headers = (fn.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('BurgenlandEvents-Scraper');
    expect(headers['Accept']).toContain('text/html');
  });
});
